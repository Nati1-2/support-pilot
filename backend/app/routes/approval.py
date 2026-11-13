import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, require_roles
from backend.app.services.guardrail_service import guardrail_service
from backend.app.models.ticket import ProposedAction

router = APIRouter(prefix="/approval", tags=["Human Approval Queue"])


async def validate_and_execute_action(
    action: Optional[Dict[str, Any]], order_id: Optional[str], workspace_id: str
) -> Optional[Dict[str, Any]]:
    if not action or not order_id:
        return action

    orders_col = get_collection("orders")
    order = await orders_col.find_one({"_id": order_id, "workspace_id": workspace_id})
    if not order:
        raise HTTPException(status_code=404, detail="Associated order not found")

    action = dict(action)
    params = dict(action.get("parameters", {}))
    action["parameters"] = params
    action_type = action.get("action_type")

    if action_type == "update_shipping_address":
        passed, reason = guardrail_service.validate_shipping_address_update(
            order, params.get("shipping_address", {})
        )
        if not passed:
            raise HTTPException(status_code=400, detail={"error": "GuardrailViolation", "reason": reason})
        await orders_col.update_one(
            {"_id": order_id, "workspace_id": workspace_id},
            {"$set": {"shipping_address": params["shipping_address"]}},
        )
    elif action_type == "issue_store_credit":
        customer = await get_collection("customers").find_one(
            {"_id": order.get("customer_id"), "workspace_id": workspace_id}
        ) or {}
        workspace = await get_collection("workspaces").find_one({"_id": workspace_id}) or {}
        cap = workspace.get("settings", {}).get("store_credit_max_cap", 50.0)
        amount = float(params.get("amount", 0.0))
        passed, allowable, reason = guardrail_service.validate_store_credit_issuance(
            order, customer, amount, cap
        )
        if not passed:
            raise HTTPException(
                status_code=400,
                detail={"error": "GuardrailViolation", "reason": reason, "max_allowable": allowable},
            )
        await orders_col.update_one(
            {"_id": order_id, "workspace_id": workspace_id},
            {"$inc": {"credits_issued": amount}},
        )
    elif action_type == "generate_rma_label":
        passed, reason = guardrail_service.validate_rma_label_generation(order)
        if not passed:
            raise HTTPException(status_code=400, detail={"error": "GuardrailViolation", "reason": reason})
        rma_obj = {
            "label_id": f"RMA-{uuid.uuid4().hex[:8].upper()}",
            "tracking_number": f"9400111899{uuid.uuid4().hex[:6]}",
            "carrier": "USPS Return Service",
            "status": "active",
            "item_skus": params.get("item_skus") or [i.get("sku") for i in order.get("items", [])],
            "created_at": datetime.utcnow().isoformat(),
        }
        await orders_col.update_one(
            {"_id": order_id, "workspace_id": workspace_id},
            {"$push": {"rma_labels": rma_obj}},
        )
        params["rma_label"] = rma_obj
    elif action_type not in (None, "escalate_ticket"):
        raise HTTPException(status_code=400, detail=f"Unsupported action type: {action_type}")

    action["status"] = "executed"
    action["executed_at"] = datetime.utcnow()
    return action

class ApproveRequest(BaseModel):
    execute_action: bool = True

class EditAndApproveRequest(BaseModel):
    edited_reply: str
    modified_action: Optional[Dict[str, Any]] = None
    execute_action: bool = True

class RejectRequest(BaseModel):
    reason: str

def calculate_levenshtein(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return calculate_levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

@router.get("/queue")
async def get_approval_queue(workspace_id: str = Depends(get_current_workspace_id)):
    tickets_col = get_collection("tickets")
    cursor = tickets_col.find({
        "workspace_id": workspace_id,
        "status": "needs_approval"
    }).sort("priority", -1)
    tickets = await cursor.to_list()

    # Enrich customer context
    cust_col = get_collection("customers")
    customers = await cust_col.find({"workspace_id": workspace_id}).to_list()
    cust_map = {str(c["_id"]): c for c in customers}

    orders_col = get_collection("orders")
    orders = await orders_col.find({"workspace_id": workspace_id}).to_list()
    ord_map = {str(o["_id"]): o for o in orders}

    for t in tickets:
        t["id"] = str(t["_id"])
        c = cust_map.get(t.get("customer_id"))
        if c:
            t["customer"] = c
        o = ord_map.get(t.get("order_id"))
        if o:
            t["order"] = o

    return tickets

@router.post("/{ticket_id}/approve")
async def approve_ticket(
    ticket_id: str,
    req: ApproveRequest,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    tickets_col = get_collection("tickets")
    ticket = await tickets_col.find_one({"_id": ticket_id, "workspace_id": workspace_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("status") == "resolved" and not ticket.get("requires_approval"):
        return {"status": "success", "message": "Ticket was already approved", "idempotent_replay": True}
    if ticket.get("status") != "needs_approval":
        raise HTTPException(status_code=409, detail="Ticket is not awaiting approval")

    messages_col = get_collection("messages")
    feedback_col = get_collection("edit_feedback")
    now = datetime.utcnow()

    # 1. Execute proposed action if applicable
    proposed = ticket.get("proposed_action")
    if req.execute_action:
        proposed = await validate_and_execute_action(proposed, ticket.get("order_id"), workspace_id)

    # 2. Post the approved draft as a reply message
    draft_reply = ticket.get("ai_draft_reply")
    if draft_reply:
        await messages_col.insert_one({
            "_id": f"msg_{uuid.uuid4().hex[:8]}",
            "workspace_id": workspace_id,
            "ticket_id": ticket_id,
            "sender_type": "ai",
            "sender_name": f"SupportPilot AI (Approved by {current_user.get('full_name', 'Agent')})",
            "content": draft_reply,
            "citations": ticket.get("citations", []),
            "confidence_score": ticket.get("ai_confidence"),
            "created_at": now
        })

    # 3. Log edit feedback (identical = 0 edit distance)
    if draft_reply:
        await feedback_col.insert_one({
            "_id": f"fb_{uuid.uuid4().hex[:8]}",
            "workspace_id": workspace_id,
            "ticket_id": ticket_id,
            "agent_id": str(current_user["_id"]),
            "agent_name": current_user.get("full_name", "Agent"),
            "original_draft": draft_reply,
            "edited_draft": draft_reply,
            "edit_distance": 0,
            "edit_ratio": 0.0,
            "action_decision": "approved",
            "created_at": now
        })

    # 4. Update ticket status
    await tickets_col.update_one(
        {"_id": ticket_id, "workspace_id": workspace_id},
        {
            "$set": {
                "status": "resolved",
                "requires_approval": False,
                "proposed_action": proposed,
                "updated_at": now
            }
        }
    )

    return {"status": "success", "message": "Ticket draft and action approved and executed successfully", "idempotent_replay": False}

@router.post("/{ticket_id}/edit-and-approve")
async def edit_and_approve_ticket(
    ticket_id: str,
    req: EditAndApproveRequest,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    tickets_col = get_collection("tickets")
    ticket = await tickets_col.find_one({"_id": ticket_id, "workspace_id": workspace_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("status") == "resolved" and not ticket.get("requires_approval"):
        return {"status": "success", "message": "Ticket was already approved", "idempotent_replay": True}
    if ticket.get("status") != "needs_approval":
        raise HTTPException(status_code=409, detail="Ticket is not awaiting approval")

    messages_col = get_collection("messages")
    feedback_col = get_collection("edit_feedback")
    now = datetime.utcnow()

    # 1. Execute action (or modified action)
    action_to_exec = req.modified_action or ticket.get("proposed_action")
    if req.execute_action:
        action_to_exec = await validate_and_execute_action(action_to_exec, ticket.get("order_id"), workspace_id)

    # 2. Post human edited reply
    await messages_col.insert_one({
        "_id": f"msg_{uuid.uuid4().hex[:8]}",
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "sender_type": "agent",
        "sender_name": current_user.get("full_name", "Agent"),
        "content": req.edited_reply,
        "citations": ticket.get("citations", []),
        "created_at": now
    })

    # 3. Calculate edit distance and log continuous edit feedback
    original_draft = ticket.get("ai_draft_reply", "")
    edit_dist = calculate_levenshtein(original_draft, req.edited_reply)
    max_len = max(len(original_draft), len(req.edited_reply), 1)
    edit_ratio = round(edit_dist / max_len, 3)

    await feedback_col.insert_one({
        "_id": f"fb_{uuid.uuid4().hex[:8]}",
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "agent_id": str(current_user["_id"]),
        "agent_name": current_user.get("full_name", "Agent"),
        "original_draft": original_draft,
        "edited_draft": req.edited_reply,
        "edit_distance": edit_dist,
        "edit_ratio": edit_ratio,
        "action_decision": "edited_and_approved",
        "created_at": now
    })

    # 4. Update ticket status
    await tickets_col.update_one(
        {"_id": ticket_id, "workspace_id": workspace_id},
        {
            "$set": {
                "status": "resolved",
                "requires_approval": False,
                "proposed_action": action_to_exec,
                "updated_at": now
            }
        }
    )

    return {
        "status": "success",
        "message": "Edited response sent and action recorded",
        "edit_distance": edit_dist,
        "edit_ratio": edit_ratio
    }

@router.post("/{ticket_id}/reject")
async def reject_ticket(
    ticket_id: str,
    req: RejectRequest,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    tickets_col = get_collection("tickets")
    ticket = await tickets_col.find_one({"_id": ticket_id, "workspace_id": workspace_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("status") != "needs_approval":
        raise HTTPException(status_code=409, detail="Ticket is not awaiting approval")

    feedback_col = get_collection("edit_feedback")
    now = datetime.utcnow()

    proposed = ticket.get("proposed_action")
    if proposed:
        proposed["status"] = "rejected"
        proposed["reason"] = req.reason

    original_draft = ticket.get("ai_draft_reply", "")
    await feedback_col.insert_one({
        "_id": f"fb_{uuid.uuid4().hex[:8]}",
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "agent_id": str(current_user["_id"]),
        "agent_name": current_user.get("full_name", "Agent"),
        "original_draft": original_draft,
        "edited_draft": "",
        "edit_distance": len(original_draft),
        "edit_ratio": 1.0,
        "action_decision": "rejected",
        "rejection_reason": req.reason,
        "created_at": now
    })

    await tickets_col.update_one(
        {"_id": ticket_id, "workspace_id": workspace_id},
        {
            "$set": {
                "status": "open",
                "requires_approval": False,
                "proposed_action": proposed,
                "escalation_reason": f"Rejected by agent: {req.reason}",
                "updated_at": now
            }
        }
    )

    return {"status": "success", "message": "Draft and proposed action rejected. Ticket reassigned to agent."}
