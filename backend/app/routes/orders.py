import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_user, get_current_workspace_id, require_roles
from backend.app.services.idempotency_service import idempotency_service
from backend.app.services.guardrail_service import guardrail_service
from backend.app.models.order import OrderUpdateAddressRequest, StoreCreditRequest, RMAGenerateRequest

router = APIRouter(prefix="/orders", tags=["Orders & Guardrailed Actions"])

@router.get("")
async def list_orders(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id)
):
    orders_col = get_collection("orders")
    q = {"workspace_id": workspace_id}
    if current_user.get("role") == "customer":
        q["customer_id"] = current_user.get("customer_id")
    if status:
        q["status"] = status

    cursor = orders_col.find(q).sort("created_at", -1)
    orders = await cursor.to_list()

    # Customer map
    cust_col = get_collection("customers")
    customers = await cust_col.find({"workspace_id": workspace_id}).to_list()
    cust_map = {str(c["_id"]): c for c in customers}

    for o in orders:
        o["id"] = str(o["_id"])
        c = cust_map.get(o.get("customer_id"))
        if c:
            o["customer_name"] = c.get("name")
            o["customer_email"] = c.get("email")

    if search:
        s = search.lower()
        orders = [
            o for o in orders
            if s in o.get("order_number", "").lower() or s in o.get("customer_name", "").lower() or s in (o.get("tracking_number") or "").lower()
        ]

    return orders

@router.get("/{order_id}")
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    workspace_id: str = Depends(get_current_workspace_id)
):
    orders_col = get_collection("orders")
    order = await orders_col.find_one({"_id": order_id, "workspace_id": workspace_id})
    if not order:
        order = await orders_col.find_one({"order_number": order_id, "workspace_id": workspace_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.get("role") == "customer" and order.get("customer_id") != current_user.get("customer_id"):
        raise HTTPException(status_code=404, detail="Order not found")

    order["id"] = str(order["_id"])
    cust_col = get_collection("customers")
    cust = await cust_col.find_one({"_id": order.get("customer_id"), "workspace_id": workspace_id})
    order["customer"] = cust

    return order

@router.post("/{order_id}/update-address")
async def update_shipping_address(
    order_id: str,
    req: OrderUpdateAddressRequest,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    if not req.idempotency_key:
        raise HTTPException(status_code=422, detail="idempotency_key is required")
    operation = f"order:{order_id}:update_address"
    replay = await idempotency_service.get(workspace_id, operation, req.idempotency_key)
    if replay:
        return {**replay, "idempotent_replay": True}
    orders_col = get_collection("orders")
    order = await orders_col.find_one({"_id": order_id, "workspace_id": workspace_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Guardrail check
    addr_dict = req.shipping_address.model_dump()
    passed, reason = guardrail_service.validate_shipping_address_update(order, addr_dict)
    if not passed:
        raise HTTPException(status_code=400, detail={"error": "GuardrailViolation", "reason": reason})

    # Execute update
    await orders_col.update_one(
        {"_id": order_id, "workspace_id": workspace_id},
        {"$set": {"shipping_address": addr_dict}}
    )

    response = {
        "status": "success",
        "message": reason,
        "shipping_address": addr_dict,
        "is_simulated": True,
        "idempotent_replay": False,
    }
    await idempotency_service.store(workspace_id, operation, req.idempotency_key, req.model_dump(), response)
    return response

@router.post("/{order_id}/store-credit")
async def issue_store_credit(
    order_id: str,
    req: StoreCreditRequest,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    if not req.idempotency_key:
        raise HTTPException(status_code=422, detail="idempotency_key is required")
    operation = f"order:{order_id}:store_credit"
    replay = await idempotency_service.get(workspace_id, operation, req.idempotency_key)
    if replay:
        return {**replay, "idempotent_replay": True}
    orders_col = get_collection("orders")
    order = await orders_col.find_one({"_id": order_id, "workspace_id": workspace_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cust_col = get_collection("customers")
    customer = await cust_col.find_one({"_id": order.get("customer_id"), "workspace_id": workspace_id}) or {}

    # Guardrail check
    passed, allowable, reason = guardrail_service.validate_store_credit_issuance(order, customer, req.amount)
    if not passed:
        raise HTTPException(status_code=400, detail={"error": "GuardrailViolation", "reason": reason, "max_allowable": allowable})

    # Execute credit issuance
    await orders_col.update_one(
        {"_id": order_id, "workspace_id": workspace_id},
        {"$inc": {"credits_issued": req.amount}}
    )

    response = {
        "status": "success",
        "message": reason,
        "credits_issued": req.amount,
        "order_total_credits": order.get("credits_issued", 0.0) + req.amount,
        "is_simulated": True,
        "idempotent_replay": False,
    }
    await idempotency_service.store(workspace_id, operation, req.idempotency_key, req.model_dump(), response)
    return response

@router.post("/{order_id}/rma")
async def generate_rma_label(
    order_id: str,
    req: RMAGenerateRequest,
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id)
):
    if not req.idempotency_key:
        raise HTTPException(status_code=422, detail="idempotency_key is required")
    operation = f"order:{order_id}:generate_rma"
    replay = await idempotency_service.get(workspace_id, operation, req.idempotency_key)
    if replay:
        return {**replay, "idempotent_replay": True}
    orders_col = get_collection("orders")
    order = await orders_col.find_one({"_id": order_id, "workspace_id": workspace_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Guardrail check
    passed, reason = guardrail_service.validate_rma_label_generation(order)
    if not passed:
        raise HTTPException(status_code=400, detail={"error": "GuardrailViolation", "reason": reason})

    # Generate RMA
    rma_id = f"RMA-{uuid.uuid4().hex[:8].upper()}"
    rma_obj = {
        "label_id": rma_id,
        "tracking_number": f"9400111899{uuid.uuid4().hex[:6]}",
        "carrier": "USPS Return Service",
        "status": "active",
        "item_skus": req.item_skus or [item["sku"] for item in order.get("items", [])],
        "created_at": datetime.utcnow().isoformat()
    }

    await orders_col.update_one(
        {"_id": order_id, "workspace_id": workspace_id},
        {"$push": {"rma_labels": rma_obj}}
    )

    response = {
        "status": "success",
        "message": reason,
        "rma_label": rma_obj,
        "is_simulated": True,
        "idempotent_replay": False,
    }
    await idempotency_service.store(workspace_id, operation, req.idempotency_key, req.model_dump(), response)
    return response
