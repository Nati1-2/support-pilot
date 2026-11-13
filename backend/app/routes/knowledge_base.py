import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, require_roles
from backend.app.services.rag_service import rag_service
from backend.app.models.policy import PolicySectionCreate, PolicySectionUpdate

router = APIRouter(prefix="/knowledge-base", tags=["Knowledge Base & Store Policies"])

class RAGTestRequest(BaseModel):
    query: str
    limit: Optional[int] = 3

@router.get("/policies")
async def list_policies(
    category: Optional[str] = Query(None),
    workspace_id: str = Depends(get_current_workspace_id)
):
    col = get_collection("policy_sections")
    q = {"workspace_id": workspace_id}
    if category:
        q["category"] = category
    cursor = col.find(q).sort("created_at", 1)
    policies = await cursor.to_list()
    for p in policies:
        p["id"] = str(p["_id"])
    return policies

@router.post("/policies")
async def create_policy(
    policy_in: PolicySectionCreate,
    current_user: dict = Depends(require_roles("admin")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    col = get_collection("policy_sections")
    pid = f"pol_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()
    doc = {
        "_id": pid,
        "workspace_id": workspace_id,
        "title": policy_in.title,
        "category": policy_in.category,
        "content": policy_in.content,
        "summary": policy_in.summary or policy_in.content[:160] + "...",
        "tags": policy_in.tags,
        "is_active": policy_in.is_active,
        "created_at": now,
        "updated_at": now
    }
    await col.insert_one(doc)
    doc["id"] = pid
    return doc

@router.put("/policies/{policy_id}")
async def update_policy(
    policy_id: str,
    policy_in: PolicySectionUpdate,
    current_user: dict = Depends(require_roles("admin")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    col = get_collection("policy_sections")
    update_data = {k: v for k, v in policy_in.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()

    res = await col.update_one(
        {"_id": policy_id, "workspace_id": workspace_id},
        {"$set": update_data}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Policy section not found")

    updated = await col.find_one({"_id": policy_id, "workspace_id": workspace_id})
    updated["id"] = str(updated["_id"])
    return updated

@router.delete("/policies/{policy_id}")
async def delete_policy(
    policy_id: str,
    current_user: dict = Depends(require_roles("admin")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    col = get_collection("policy_sections")
    res = await col.delete_one({"_id": policy_id, "workspace_id": workspace_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Policy section not found")
    return {"status": "success", "message": "Policy section deleted"}

@router.post("/test-rag")
async def test_rag(
    req: RAGTestRequest,
    workspace_id: str = Depends(get_current_workspace_id)
):
    citations = await rag_service.search_policies(
        workspace_id=workspace_id,
        query=req.query,
        limit=req.limit or 3
    )
    return {
        "query": req.query,
        "matched_count": len(citations),
        "citations": [c.model_dump() for c in citations]
    }
