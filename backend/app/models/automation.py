from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class AutomationRule(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    name: str
    description: str
    trigger_event: str  # shipment.delayed, payment.failed, customer.inquiry, ticket.created
    conditions: Dict[str, Any] = Field(default_factory=dict)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True
    execution_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_triggered_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

class AutomationRuleCreate(BaseModel):
    name: str
    description: str
    trigger_event: str
    conditions: Dict[str, Any] = Field(default_factory=dict)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True

class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_event: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None
