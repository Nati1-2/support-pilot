from fastapi import APIRouter, Depends, Query

from backend.app.services.auth_service import get_current_workspace_id
from backend.app.services.product_service import product_service

router = APIRouter(prefix="/products", tags=["Simulated Product Catalog"])


@router.get("")
async def list_demo_products(
    search: str = Query(default=""),
    workspace_id: str = Depends(get_current_workspace_id),
):
    products = await product_service.search_demo_products(workspace_id, search)
    return {
        "source_notice": "Demonstration data only. These are not real customer transactions.",
        "products": products,
    }
