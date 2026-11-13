from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class OrderItem(BaseModel):
    product_id: Optional[str] = None
    sku: str
    name: str
    quantity: int = 1
    price: float

class ShippingAddress(BaseModel):
    street: str
    city: str
    state: str
    zip_code: str
    country: str = "United States"

class RMALabel(BaseModel):
    label_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    tracking_number: str
    carrier: str = "USPS Return Service"
    status: str = "active"
    item_skus: List[str] = Field(default_factory=list)

class Order(BaseModel):
    id: str = Field(alias="_id")
    workspace_id: str
    customer_id: str
    order_number: str
    status: str = "unfulfilled"  # unfulfilled, in_transit, delayed, delivered, cancelled
    items: List[OrderItem] = Field(default_factory=list)
    total_amount: float
    shipping_address: ShippingAddress
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery: Optional[str] = None
    delivered_at: Optional[datetime] = None
    credits_issued: float = 0.0
    rma_labels: List[RMALabel] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class OrderUpdateAddressRequest(BaseModel):
    shipping_address: ShippingAddress
    reason: Optional[str] = "Customer request"
    idempotency_key: Optional[str] = None

class StoreCreditRequest(BaseModel):
    amount: float
    reason: str
    idempotency_key: Optional[str] = None

class RMAGenerateRequest(BaseModel):
    reason: str
    item_skus: Optional[List[str]] = None
    idempotency_key: Optional[str] = None
