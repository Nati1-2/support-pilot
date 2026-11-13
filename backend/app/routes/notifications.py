from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id

router = APIRouter(prefix="/notifications", tags=["In-App Notifications"])

@router.get("")
async def list_notifications(
    limit: int = 20,
    workspace_id: str = Depends(get_current_workspace_id)
):
    notif_col = get_collection("notifications")
    cursor = notif_col.find({"workspace_id": workspace_id}).sort("created_at", -1).limit(limit)
    notifs = await cursor.to_list()
    for n in notifs:
        n["id"] = str(n["_id"])
    return notifs

@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    workspace_id: str = Depends(get_current_workspace_id)
):
    notif_col = get_collection("notifications")
    res = await notif_col.update_one(
        {"_id": notification_id, "workspace_id": workspace_id},
        {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}

@router.post("/mark-all-read")
async def mark_all_notifications_read(workspace_id: str = Depends(get_current_workspace_id)):
    notif_col = get_collection("notifications")
    await notif_col.update_many(
        {"workspace_id": workspace_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"status": "success", "message": "All notifications marked as read"}
