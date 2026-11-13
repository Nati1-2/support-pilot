import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, require_roles
from backend.app.models.automation import AutomationRuleCreate, AutomationRuleUpdate

router = APIRouter(prefix="/automations", tags=["Automations & Rules Engine"])

@router.get("/rules")
async def list_rules(workspace_id: str = Depends(get_current_workspace_id)):
    rules_col = get_collection("automation_rules")
    cursor = rules_col.find({"workspace_id": workspace_id}).sort("created_at", -1)
    rules = await cursor.to_list()
    for r in rules:
        r["id"] = str(r["_id"])
    return rules

@router.post("/rules")
async def create_rule(
    rule_in: AutomationRuleCreate,
    current_user: dict = Depends(require_roles("admin")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    rules_col = get_collection("automation_rules")
    rid = f"rule_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()
    doc = {
        "_id": rid,
        "workspace_id": workspace_id,
        "name": rule_in.name,
        "description": rule_in.description,
        "trigger_event": rule_in.trigger_event,
        "conditions": rule_in.conditions,
        "actions": rule_in.actions,
        "is_active": rule_in.is_active,
        "execution_count": 0,
        "created_at": now,
        "last_triggered_at": None
    }
    await rules_col.insert_one(doc)
    doc["id"] = rid
    return doc

@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: str,
    rule_in: AutomationRuleUpdate,
    current_user: dict = Depends(require_roles("admin")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    rules_col = get_collection("automation_rules")
    update_data = {k: v for k, v in rule_in.model_dump().items() if v is not None}
    res = await rules_col.update_one(
        {"_id": rule_id, "workspace_id": workspace_id},
        {"$set": update_data}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    updated = await rules_col.find_one({"_id": rule_id, "workspace_id": workspace_id})
    updated["id"] = str(updated["_id"])
    return updated

@router.patch("/rules/{rule_id}/toggle")
async def toggle_rule(
    rule_id: str,
    current_user: dict = Depends(require_roles("admin")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    rules_col = get_collection("automation_rules")
    rule = await rules_col.find_one({"_id": rule_id, "workspace_id": workspace_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    new_state = not rule.get("is_active", True)
    await rules_col.update_one(
        {"_id": rule_id, "workspace_id": workspace_id},
        {"$set": {"is_active": new_state}}
    )
    rule["is_active"] = new_state
    rule["id"] = str(rule["_id"])
    return rule
