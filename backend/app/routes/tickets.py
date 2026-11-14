import uuid
import logging
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, get_current_user, require_roles
from backend.app.services.agent_service import agent_service
from backend.app.models.ticket import TicketCreate, MessageCreate

router = APIRouter(prefix="/tickets", tags=["Tickets & Conversations"])
logger = logging.getLogger(__name__)

@router.get("")
async def list_tickets(
    queue: Optional[str] = Query(None, description="inbox, needs_approval, vip, resolved"),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id)
):
    tickets_col = get_collection("tickets")
    query = {"workspace_id": workspace_id}
    if current_user.get("role") == "customer":
        query["customer_id"] = current_user.get("customer_id", "__none__")

    if queue == "needs_approval":
        query["status"] = "needs_approval"
    elif queue == "vip":
        query["$or"] = [{"is_vip": True}, {"vip_churn_risk": True}]
    elif queue == "resolved":
        query["status"] = "resolved"
    elif queue == "inbox":
        # standard inbox shows all active or open tickets
        pass

    if status and not queue:
        query["status"] = status

    if priority:
        query["priority"] = priority

    cursor = tickets_col.find(query).sort("created_at", -1)
    tickets = await cursor.to_list()

    # If search specified, filter in memory
    if search:
        s = search.lower()
        tickets = [
            t for t in tickets
            if s in t.get("title", "").lower() or s in t.get("intent", "").lower() or s in t.get("order_id", "").lower()
        ]

    # Enrich with customer names for clean display
    cust_col = get_collection("customers")
    customers = await cust_col.find({"workspace_id": workspace_id}).to_list()
    cust_map = {str(c["_id"]): c for c in customers}

    for t in tickets:
        t["id"] = str(t["_id"])
        c = cust_map.get(t.get("customer_id"))
        if c:
            t["customer_name"] = c.get("name", "Unknown Customer")
            t["customer_email"] = c.get("email", "")
            t["customer_spent"] = c.get("total_spent", 0.0)

    return tickets

@router.post("")
async def create_ticket(
    ticket_in: TicketCreate,
    current_user: dict = Depends(require_roles("admin", "agent", "customer")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    if current_user.get("role") == "customer" and ticket_in.customer_id != current_user.get("customer_id"):
        raise HTTPException(status_code=403, detail="Customers may only create inquiries for their own profile")
    ticket_id = f"tick_{uuid.uuid4().hex[:8]}"

    # Process inquiry through AI agent pipeline
    ai_result = await agent_service.process_inquiry(
        workspace_id=workspace_id,
        customer_id=ticket_in.customer_id,
        message_content=ticket_in.message,
        order_id=ticket_in.order_id,
        existing_ticket_id=ticket_id,
        channel=ticket_in.channel
    )

    tickets_col = get_collection("tickets")
    messages_col = get_collection("messages")

    now = datetime.utcnow()
    new_ticket = {
        "_id": ticket_id,
        "workspace_id": workspace_id,
        "customer_id": ticket_in.customer_id,
        "order_id": ticket_in.order_id or (ai_result["order"].get("_id") if ai_result.get("order") else None),
        "title": ticket_in.title,
        "status": ai_result["ticket_status"],
        "priority": ai_result["urgency"],
        "channel": ticket_in.channel,
        "intent": ai_result["intent"],
        "sentiment": ai_result["sentiment"],
        "urgency": ai_result["urgency"],
        "ai_confidence": ai_result["confidence_score"],
        "is_vip": ai_result["is_vip"],
        "vip_churn_risk": ai_result["vip_churn_risk"],
        "requires_approval": ai_result["requires_approval"],
        "escalation_summary": ai_result["escalation_summary"].model_dump() if ai_result.get("escalation_summary") else None,
        "proposed_action": ai_result["proposed_action"].model_dump() if ai_result.get("proposed_action") else None,
        "ai_draft_reply": ai_result["draft_reply"] if ai_result.get("requires_approval") else None,
        "citations": [c.model_dump() for c in ai_result.get("citations", [])],
        "created_at": now,
        "updated_at": now
    }
    await tickets_col.insert_one(new_ticket)

    # Insert customer incoming message
    cust_col = get_collection("customers")
    cust = await cust_col.find_one({"_id": ticket_in.customer_id})
    cust_name = cust.get("name", "Customer") if cust else "Customer"

    await messages_col.insert_one({
        "_id": f"msg_{uuid.uuid4().hex[:8]}",
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "sender_type": "customer",
        "sender_name": cust_name,
        "content": ticket_in.message,
        "pii_redacted_content": None,
        "citations": [],
        "created_at": now
    })

    # If auto-pilot resolved it, insert automated AI response message
    if not ai_result["requires_approval"] and ai_result.get("draft_reply"):
        await messages_col.insert_one({
            "_id": f"msg_{uuid.uuid4().hex[:8]}",
            "workspace_id": workspace_id,
            "ticket_id": ticket_id,
            "sender_type": "ai",
            "sender_name": "SupportPilot AI",
            "content": ai_result["draft_reply"],
            "citations": [c.model_dump() for c in ai_result.get("citations", [])],
            "confidence_score": ai_result["confidence_score"],
            "created_at": now
        })

    new_ticket["id"] = ticket_id
    return new_ticket

@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id)
):
    tickets_col = get_collection("tickets")
    ticket = await tickets_col.find_one({"_id": ticket_id, "workspace_id": workspace_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.get("role") == "customer" and ticket.get("customer_id") != current_user.get("customer_id"):
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket["id"] = str(ticket["_id"])

    # Fetch customer
    cust_col = get_collection("customers")
    customer = await cust_col.find_one({"_id": ticket.get("customer_id"), "workspace_id": workspace_id})
    if customer:
        customer["id"] = str(customer["_id"])
    ticket["customer"] = customer

    # Fetch order
    orders_col = get_collection("orders")
    order = None
    if ticket.get("order_id"):
        order = await orders_col.find_one({"_id": ticket.get("order_id"), "workspace_id": workspace_id})
        if order:
            order["id"] = str(order["_id"])
    ticket["order"] = order

    # Fetch messages
    messages_col = get_collection("messages")
    cursor = messages_col.find({"ticket_id": ticket_id, "workspace_id": workspace_id}).sort("created_at", 1)
    messages = await cursor.to_list()
    for m in messages:
        m["id"] = str(m["_id"])
    ticket["messages"] = messages

    # Fetch audit trace
    audit_col = get_collection("audit_traces")
    traces = await audit_col.find({"ticket_id": ticket_id, "workspace_id": workspace_id}).sort("created_at", -1).to_list(length=1)
    if traces:
        traces[0]["id"] = str(traces[0]["_id"])
    ticket["audit_trace"] = traces[0] if traces else None

    return ticket

@router.post("/{ticket_id}/messages")
async def add_message(
    ticket_id: str,
    message_in: MessageCreate,
    current_user: dict = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id)
):
    tickets_col = get_collection("tickets")
    ticket = await tickets_col.find_one({"_id": ticket_id, "workspace_id": workspace_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    role = current_user.get("role")
    if role not in ("admin", "agent", "customer"):
        raise HTTPException(status_code=403, detail="You do not have permission to reply")
    if role == "customer" and ticket.get("customer_id") != current_user.get("customer_id"):
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not message_in.content.strip():
        raise HTTPException(status_code=422, detail="Please enter a message")

    messages_col = get_collection("messages")
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()

    sender_name = message_in.sender_name or current_user.get("full_name", "Agent")
    sender_type = "customer" if role == "customer" else "agent"
    new_msg = {
        "_id": msg_id,
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "sender_type": sender_type,
        "sender_name": sender_name,
        "content": message_in.content,
        "citations": [c.model_dump() for c in message_in.citations] if message_in.citations else [],
        "created_at": now
    }
    await messages_col.insert_one(new_msg)

    # Reopen a resolved conversation while its new customer message is handled.
    await tickets_col.update_one(
        {"_id": ticket_id, "workspace_id": workspace_id},
        {"$set": {"updated_at": now, **({"status": "open"} if role == "customer" else {})}}
    )

    if role == "customer":
        try:
            history = await messages_col.find({
                "ticket_id": ticket_id, "workspace_id": workspace_id,
                "_id": {"$ne": msg_id},
            }).sort("created_at", -1).to_list(length=10)
            result = await agent_service.process_inquiry(
                workspace_id=workspace_id,
                customer_id=ticket["customer_id"],
                message_content=message_in.content.strip(),
                order_id=ticket.get("order_id"),
                existing_ticket_id=ticket_id,
                channel=ticket.get("channel", "portal"),
                conversation_history="\n".join(
                    f"{row['sender_type']}: {row['content'][:2000]}" for row in reversed(history)
                ),
            )
            citations = [c.model_dump() for c in result.get("citations", [])]
            needs_review = result["requires_approval"] or result["ticket_status"] != "resolved"
            await tickets_col.update_one(
                {"_id": ticket_id, "workspace_id": workspace_id},
                {"$set": {
                    "status": "needs_approval" if needs_review else "resolved",
                    "requires_approval": needs_review,
                    "ai_draft_reply": result["draft_reply"] if needs_review else None,
                    "ai_confidence": result["confidence_score"],
                    "intent": result["intent"], "sentiment": result["sentiment"],
                    "priority": result["urgency"], "urgency": result["urgency"],
                    "vip_churn_risk": result["vip_churn_risk"],
                    "citations": citations,
                    "proposed_action": result["proposed_action"].model_dump() if result.get("proposed_action") else None,
                    "escalation_summary": result["escalation_summary"].model_dump() if result.get("escalation_summary") else None,
                    "updated_at": datetime.utcnow(),
                }},
            )
            response_content = (
                "Thanks for your message. A support agent needs to review your request. Their reply will appear here."
                if needs_review else result["draft_reply"]
            )
            response_type = "system" if needs_review else "ai"
        except Exception:
            logger.exception("Could not generate follow-up response for ticket %s", ticket_id)
            # The message is already saved. Queue it and acknowledge receipt so
            # the customer does not resend and duplicate their request.
            await tickets_col.update_one(
                {"_id": ticket_id, "workspace_id": workspace_id},
                {"$set": {"status": "open", "requires_approval": False,
                          "ai_draft_reply": None, "proposed_action": None,
                          "updated_at": datetime.utcnow()}},
            )
            response_content = "Your message has been saved. The automatic assistant is unavailable, so a support agent will follow up here."
            response_type = "system"
            citations = []

        await messages_col.insert_one({
            "_id": f"msg_{uuid.uuid4().hex[:8]}",
            "workspace_id": workspace_id, "ticket_id": ticket_id,
            "sender_type": response_type, "sender_name": "SupportPilot AI" if response_type == "ai" else "SupportPilot Support",
            "content": response_content,
            "citations": citations if response_type == "ai" else [],
            "created_at": datetime.utcnow(),
        })

    new_msg["id"] = msg_id
    return new_msg

@router.patch("/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    update_data: dict,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    tickets_col = get_collection("tickets")
    update_data["updated_at"] = datetime.utcnow()
    res = await tickets_col.update_one(
        {"_id": ticket_id, "workspace_id": workspace_id},
        {"$set": update_data}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    updated = await tickets_col.find_one({"_id": ticket_id, "workspace_id": workspace_id})
    updated["id"] = str(updated["_id"])
    return updated
