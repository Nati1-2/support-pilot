from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ExecutionStep(BaseModel):
    step_name: str  # e.g. "pii_sanitization", "intent_classification", "order_investigation", "policy_retrieval", "guardrail_check", "action_execution"
    status: str  # success, warning, failed, skipped
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AuditTrace(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    ticket_id: str
    message_id: Optional[str] = None
    trigger: str = "customer_message"  # customer_message, webhook_event, manual_rescore
    intent: Optional[str] = None
    sentiment: Optional[str] = None
    urgency: Optional[str] = None
    pii_redacted: bool = False
    redacted_items_count: int = 0
    order_looked_up: Optional[str] = None
    policies_cited: List[str] = Field(default_factory=list)
    confidence_score: float = 0.0
    guardrails_passed: bool = True
    guardrail_details: List[str] = Field(default_factory=list)
    selected_action: Optional[str] = None
    action_parameters: Optional[Dict[str, Any]] = None
    action_status: str = "evaluated"  # auto_executed, queued_for_approval, rejected
    execution_steps: List[ExecutionStep] = Field(default_factory=list)
    escalation_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
