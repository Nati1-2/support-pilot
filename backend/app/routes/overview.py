from fastapi import APIRouter, Depends
from backend.app.services.auth_service import get_current_workspace_id, require_roles
from backend.app.services.analytics_service import analytics_service

router = APIRouter(prefix="/overview", tags=["Overview Dashboard"])

@router.get("/metrics")
async def get_overview_metrics(
    _: dict = Depends(require_roles("admin", "agent", "viewer")),
    workspace_id: str = Depends(get_current_workspace_id),
):
    return await analytics_service.get_overview_metrics(workspace_id)
