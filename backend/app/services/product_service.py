from typing import Any, Dict, List

import httpx

from backend.app.config import settings
from backend.app.database import get_collection


class ProductService:
    async def search_demo_products(self, workspace_id: str, query: str = "") -> List[Dict[str, Any]]:
        try:
            if not settings.DUMMYJSON_ENABLED:
                raise RuntimeError("DummyJSON disabled for offline development")
            endpoint = "https://dummyjson.com/products/search"
            async with httpx.AsyncClient(timeout=5.0, trust_env=False) as client:
                response = await client.get(endpoint, params={"q": query or "jacket", "limit": 5})
                response.raise_for_status()
                rows = response.json().get("products", [])
                return [
                    {
                        "id": f"dummyjson_{row['id']}",
                        "name": row.get("title", "Demo Product"),
                        "description": row.get("description", ""),
                        "price": float(row.get("price", 0)),
                        "stock": int(row.get("stock", 0)),
                        "thumbnail": row.get("thumbnail"),
                        "source": "DummyJSON",
                        "is_simulated": True,
                    }
                    for row in rows
                ]
        except Exception:
            rows = await get_collection("products").find(
                {"workspace_id": workspace_id}
            ).limit(5).to_list()
            return [
                {
                    "id": str(row["_id"]),
                    "name": row.get("name", "Demo Product"),
                    "description": "Workspace fallback demonstration product",
                    "price": float(row.get("price", 0)),
                    "stock": int(row.get("inventory_count", 0)),
                    "thumbnail": None,
                    "source": "DummyJSON-compatible workspace fallback",
                    "is_simulated": True,
                }
                for row in rows
            ]


product_service = ProductService()
