from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class Notification(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    user_id: Optional[str] = None
    title: str
    message: str
    type: str = "info"  # info, warning, urgent, success, webhook
    read: bool = False
    link: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "info"
    link: Optional[str] = None
    user_id: Optional[str] = None
