from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, require_roles
from backend.app.models.workspace import WorkspaceSettings

router = APIRouter(prefix="/settings", tags=["Settings"])

class WorkspaceSettingsUpdate(BaseModel):
    name: Optional[str] = None
    settings: WorkspaceSettings

@router.get("/workspace")
async def get_workspace_settings(workspace_id: str = Depends(get_current_workspace_id)):
    ws_col = get_collection("workspaces")
    ws = await ws_col.find_one({"_id": workspace_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ws["id"] = str(ws["_id"])
    return ws

@router.put("/workspace")
async def update_workspace_settings(
    update_in: WorkspaceSettingsUpdate,
    workspace_id: str = Depends(get_current_workspace_id),
    current_user: dict = Depends(require_roles("admin"))
):
    ws_col = get_collection("workspaces")
    payload = {"settings": update_in.settings.model_dump()}
    if update_in.name:
        payload["name"] = update_in.name

    await ws_col.update_one(
        {"_id": workspace_id},
        {"$set": payload}
    )
    ws = await ws_col.find_one({"_id": workspace_id})
    ws["id"] = str(ws["_id"])
    return ws
