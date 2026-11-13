from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class WorkspaceSettings(BaseModel):
    confidence_threshold: float = 0.90
    store_credit_max_cap: float = 50.0
    auto_pilot_enabled: bool = True
    delay_compensation_credit: float = 15.0
    gemini_model: str = "gemini-2.5-flash"
    simulated_carrier: str = "FedEx Express"

class Workspace(BaseModel):
    id: str = Field(alias="_id")
    name: str
    slug: str
    settings: WorkspaceSettings = Field(default_factory=WorkspaceSettings)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    settings: Optional[WorkspaceSettings] = None
