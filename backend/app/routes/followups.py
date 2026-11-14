import hmac
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, require_roles

router = APIRouter(prefix="/followups", tags=["Scheduled Follow-ups"])


class FollowupCreate(BaseModel):
    ticket_id: str
    customer_id: Optional[str] = None
    reason: str = Field(min_length=3, max_length=500)
    due_at: datetime


async def verify_cron_request(
    authorization: str = Header(default=""),
    x_cron_secret: str = Header(default="", alias="X-Cron-Secret"),
) -> None:
    bearer = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    if not (
        hmac.compare_digest(bearer, settings.CRON_SECRET)
        or hmac.compare_digest(x_cron_secret, settings.CRON_SECRET)
    ):
        raise HTTPException(status_code=401, detail="Invalid cron authorization")


@router.get("")
async def list_followups(
    workspace_id: str = Depends(get_current_workspace_id),
):
    rows = await get_collection("followups").find(
        {"workspace_id": workspace_id}
    ).sort("due_at", 1).to_list()
    for row in rows:
        row["id"] = str(row["_id"])
    return rows


@router.post("")
async def schedule_followup(
    request: FollowupCreate,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id),
):
    ticket = await get_collection("tickets").find_one(
        {"_id": request.ticket_id, "workspace_id": workspace_id}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    followup_id = f"followup_{uuid.uuid4().hex[:10]}"
    row = {
        "_id": followup_id,
        "workspace_id": workspace_id,
        "ticket_id": request.ticket_id,
        "customer_id": request.customer_id or ticket.get("customer_id"),
        "reason": request.reason,
        "due_at": request.due_at.isoformat(),
        "status": "scheduled",
        "created_by": str(current_user["_id"]),
        "created_at": datetime.utcnow().isoformat(),
    }
    await get_collection("followups").insert_one(row)
    row["id"] = followup_id
    return row


@router.api_route("/process-due", methods=["GET", "POST"])
async def process_due_followups(_: None = Depends(verify_cron_request)):
    now = datetime.utcnow()
    now_iso = now.isoformat()
    followups_col = get_collection("followups")
    due = await followups_col.find(
        {"status": "scheduled", "due_at": {"$lte": now_iso}}
    ).to_list()
    processed = []
    for followup in due:
        followup_id = str(followup["_id"])
        workspace_id = followup["workspace_id"]
        ticket_id = followup["ticket_id"]
        notification_id = f"notif_{uuid.uuid4().hex[:8]}"
        await get_collection("notifications").insert_one({
            "_id": notification_id,
            "workspace_id": workspace_id,
            "title": "Customer follow-up due",
            "message": followup.get("reason", "Review unresolved customer inquiry"),
            "type": "warning",
            "read": False,
            "link": f"/inbox/{ticket_id}",
            "created_at": now,
        })
        await followups_col.update_one(
            {"_id": followup_id, "workspace_id": workspace_id, "status": "scheduled"},
            {"$set": {
                "status": "notified",
                "processed_at": now_iso,
                "notification_id": notification_id,
            }},
        )
        processed.append(followup_id)
    return {"status": "success", "processed_count": len(processed), "followup_ids": processed}
