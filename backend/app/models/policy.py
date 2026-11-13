from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PolicySection(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    title: str
    category: str  # returns, shipping, store_credit, escalations, general
    content: str
    summary: str
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class PolicySectionCreate(BaseModel):
    title: str
    category: str
    content: str
    summary: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True

class PolicySectionUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
