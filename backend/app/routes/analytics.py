from fastapi import APIRouter, Depends
from backend.app.services.auth_service import get_current_workspace_id
from backend.app.services.analytics_service import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics & Visualizations"])

@router.get("/summary")
async def get_analytics_summary(workspace_id: str = Depends(get_current_workspace_id)):
    return await analytics_service.get_detailed_analytics(workspace_id)
