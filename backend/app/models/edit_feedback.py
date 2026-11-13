from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class EditFeedback(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    ticket_id: str
    agent_id: str
    agent_name: str
    original_draft: str
    edited_draft: str
    edit_distance: int = 0
    edit_ratio: float = 0.0  # 0.0 means identical, 1.0 means completely rewritten
    action_decision: str = "approved"  # approved, edited_and_approved, rejected
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class EditFeedbackCreate(BaseModel):
    ticket_id: str
    original_draft: str
    edited_draft: str
    action_decision: str = "approved"
    rejection_reason: Optional[str] = None
