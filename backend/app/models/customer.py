from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Customer(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    name: str
    email: str
    phone: Optional[str] = None
    total_spent: float = 0.0
    orders_count: int = 0
    average_order_value: float = 0.0
    sentiment_score: float = 0.5  # 0.0 (very negative) to 1.0 (very positive)
    is_vip: bool = False
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CustomerCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    total_spent: float = 0.0
    orders_count: int = 0
    notes: Optional[str] = None
