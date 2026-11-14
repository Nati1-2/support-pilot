from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, require_roles
from backend.app.services.agent_service import agent_service
from backend.app.config import settings

router = APIRouter(prefix="/agent", tags=["AI Agent Workspace"])

class TestInquiryRequest(BaseModel):
    message: str
    customer_id: Optional[str] = None
    order_id: Optional[str] = None

@router.get("/status")
async def get_agent_status(workspace_id: str = Depends(get_current_workspace_id)):
    ws_col = get_collection("workspaces")
    ws = await ws_col.find_one({"_id": workspace_id})
    ws_settings = ws.get("settings", {}) if ws else {}

    is_live = bool(settings.GEMINI_API_KEY)
    preferred = ws_settings.get("gemini_model", settings.GEMINI_MODEL)

    return {
        "mode": "live_gemini" if is_live else "simulated_gemini",
        "mode_label": "AI Automation Assistant",
        "api_key_configured": is_live,
        "model": preferred,
        "model_chain": agent_service.candidate_models(preferred) if is_live else [],
        "last_live_model": agent_service.last_live_model,
        "last_live_error": agent_service.last_live_error,
        "last_live_error_at": agent_service.last_live_error_at,
        "confidence_threshold": ws_settings.get("confidence_threshold", settings.CONFIDENCE_THRESHOLD),
        "store_credit_max_cap": ws_settings.get("store_credit_max_cap", settings.STORE_CREDIT_MAX_CAP),
        "auto_pilot_enabled": ws_settings.get("auto_pilot_enabled", True),
        "available_tools": [
            {"name": "lookup_customer", "description": "Retrieve 360 customer profile, orders and LTV", "guardrailed": False},
            {"name": "lookup_order", "description": "Investigate real-time carrier tracking and order items", "guardrailed": False},
            {"name": "retrieve_policies", "description": "RAG semantic search across official store policy sections", "guardrailed": False},
            {"name": "update_shipping_address", "description": "Pre-dispatch destination modification", "guardrailed": True, "rule": "Blocked if status is not 'unfulfilled'"},
            {"name": "issue_store_credit", "description": "Apply courtesy goodwill credit to order", "guardrailed": True, "rule": "Hard cap $50.00 / order total"},
            {"name": "generate_rma_label", "description": "Issue prepaid USPS return authorization label", "guardrailed": True, "rule": "Allowed within 30 days of delivery"},
            {"name": "escalate_ticket", "description": "Route to human review with 3-bullet summary", "guardrailed": True, "rule": "Triggered on VIP_CHURN_RISK or low confidence"}
        ]
    }

@router.post("/test-inquiry")
async def test_inquiry(
    req: TestInquiryRequest,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    # Select customer or fallback to Eleanor Vance (VIP) or Olivia
    cid = req.customer_id or "cust_eleanor"
    result = await agent_service.process_inquiry(
        workspace_id=workspace_id,
        customer_id=cid,
        message_content=req.message,
        order_id=req.order_id,
        channel="simulation_playground"
    )
    return result

@router.get("/audit-traces")
async def list_audit_traces(
    ticket_id: Optional[str] = Query(None),
    limit: int = 25,
    workspace_id: str = Depends(get_current_workspace_id)
):
    audit_col = get_collection("audit_traces")
    q = {"workspace_id": workspace_id}
    if ticket_id:
        q["ticket_id"] = ticket_id

    cursor = audit_col.find(q).sort("created_at", -1).limit(limit)
    traces = await cursor.to_list()
    for tr in traces:
        tr["id"] = str(tr["_id"])
    return traces

@router.get("/audit-traces/{trace_id}")
async def get_audit_trace(
    trace_id: str,
    workspace_id: str = Depends(get_current_workspace_id)
):
    audit_col = get_collection("audit_traces")
    trace = await audit_col.find_one({"_id": trace_id, "workspace_id": workspace_id})
    if not trace:
        raise HTTPException(status_code=404, detail="Audit trace not found")
    trace["id"] = str(trace["_id"])
    return trace
