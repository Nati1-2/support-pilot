from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

class PolicyCitation(BaseModel):
    section_id: str
    title: str
    relevance_score: float = 1.0
    snippet: str

class ProposedAction(BaseModel):
    action_type: str  # update_shipping_address, issue_store_credit, generate_rma_label, escalate_ticket
    parameters: Dict[str, Any]
    status: str = "pending_approval"  # pending_approval, executed, rejected
    reason: Optional[str] = None
    executed_at: Optional[datetime] = None

class EscalationSummary(BaseModel):
    bullets: List[str] = Field(default_factory=list)  # 3 structured bullets
    trigger_reason: str
    recommended_action: str

class Ticket(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    customer_id: str
    order_id: Optional[str] = None
    title: str
    status: str = "open"  # open, needs_approval, resolved, escalated, closed
    priority: str = "medium"  # low, medium, high, urgent
    channel: str = "email"  # email, chat, webhook, api
    intent: Optional[str] = None
    sentiment: Optional[str] = "neutral"  # positive, neutral, negative, frustrated
    urgency: Optional[str] = "medium"
    ai_confidence: Optional[float] = None
    is_vip: bool = False
    vip_churn_risk: bool = False
    requires_approval: bool = False
    escalation_summary: Optional[EscalationSummary] = None
    proposed_action: Optional[ProposedAction] = None
    ai_draft_reply: Optional[str] = None
    citations: List[PolicyCitation] = Field(default_factory=list)
    assigned_agent_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class TicketCreate(BaseModel):
    customer_id: str
    order_id: Optional[str] = None
    title: str
    message: str
    channel: str = "email"

class Message(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    ticket_id: str
    sender_type: str  # customer, agent, ai, system
    sender_name: str
    content: str
    pii_redacted_content: Optional[str] = None
    citations: List[PolicyCitation] = Field(default_factory=list)
    confidence_score: Optional[float] = None
    is_draft: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class MessageCreate(BaseModel):
    content: str
    sender_type: str = "agent"
    sender_name: Optional[str] = None
    citations: Optional[List[PolicyCitation]] = None


class GeminiProposedAction(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    action_type: Literal[
        "update_shipping_address",
        "issue_store_credit",
        "generate_rma_label",
        "escalate_ticket",
    ]
    parameters: Dict[str, Any]


class GeminiAgentResult(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    reply: str = Field(min_length=1, max_length=5000)
    confidence: float = Field(ge=0.0, le=1.0)
    proposed_action: Optional[GeminiProposedAction] = None
