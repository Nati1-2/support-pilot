import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_user, get_current_workspace_id, require_roles
from backend.app.models.customer import CustomerCreate

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("")
async def list_customers(
    vip_only: bool = False,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id)
):
    cust_col = get_collection("customers")
    q = {"workspace_id": workspace_id}
    if current_user.get("role") == "customer":
        q["_id"] = current_user.get("customer_id")
    if vip_only:
        q["is_vip"] = True

    cursor = cust_col.find(q).sort("total_spent", -1)
    customers = await cursor.to_list()

    if search:
        s = search.lower()
        customers = [
            c for c in customers
            if s in c.get("name", "").lower() or s in c.get("email", "").lower() or s in c.get("phone", "").lower()
        ]

    for c in customers:
        c["id"] = str(c["_id"])

    return customers

@router.get("/{customer_id}")
async def get_customer(
    customer_id: str,
    current_user: dict = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id)
):
    if current_user.get("role") == "customer" and customer_id != current_user.get("customer_id"):
        raise HTTPException(status_code=404, detail="Customer not found")
    cust_col = get_collection("customers")
    customer = await cust_col.find_one({"_id": customer_id, "workspace_id": workspace_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer["id"] = str(customer["_id"])

    # Orders for customer
    orders_col = get_collection("orders")
    orders = await orders_col.find({"customer_id": customer_id, "workspace_id": workspace_id}).sort("created_at", -1).to_list()
    for o in orders:
        o["id"] = str(o["_id"])
    customer["orders"] = orders

    # Tickets for customer
    tickets_col = get_collection("tickets")
    tickets = await tickets_col.find({"customer_id": customer_id, "workspace_id": workspace_id}).sort("created_at", -1).to_list()
    for t in tickets:
        t["id"] = str(t["_id"])
    customer["tickets"] = tickets

    return customer

@router.post("")
async def create_customer(
    cust_in: CustomerCreate,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    cust_col = get_collection("customers")
    cid = f"cust_{uuid.uuid4().hex[:8]}"
    doc = {
        "_id": cid,
        "workspace_id": workspace_id,
        "name": cust_in.name,
        "email": cust_in.email,
        "phone": cust_in.phone,
        "total_spent": cust_in.total_spent,
        "orders_count": cust_in.orders_count,
        "average_order_value": round(cust_in.total_spent / max(1, cust_in.orders_count), 2),
        "sentiment_score": 0.5,
        "is_vip": cust_in.total_spent >= 200.0,
        "tags": ["vip"] if cust_in.total_spent >= 200.0 else ["standard"],
        "notes": cust_in.notes,
        "created_at": datetime.utcnow()
    }
    await cust_col.insert_one(doc)
    doc["id"] = cid
    return doc
