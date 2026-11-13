import hashlib
import hmac
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.database import get_collection
from backend.app.services.auth_service import get_current_workspace_id, require_roles
from backend.app.services.guardrail_service import guardrail_service
from backend.app.services.idempotency_service import idempotency_service

router = APIRouter(prefix="/webhooks", tags=["Webhooks & Proactive Automation"])


class ShipmentDelayedWebhook(BaseModel):
    event_id: Optional[str] = Field(default=None, min_length=8, max_length=128)
    tracking_number: str
    carrier: str = "FedEx Express"
    delay_hours: int = 48
    reason: str = "Severe weather delay at Memphis distribution hub"
    new_estimated_delivery: Optional[str] = None
    workspace_id: Optional[str] = None


class PaymentFailedWebhook(BaseModel):
    event_id: Optional[str] = Field(default=None, min_length=8, max_length=128)
    order_number: str
    amount: float
    failure_code: str = "insufficient_funds"
    customer_email: str
    workspace_id: Optional[str] = None


async def verify_webhook_secret(x_webhook_secret: str = Header(default="", alias="X-Webhook-Secret")) -> None:
    if not hmac.compare_digest(x_webhook_secret, settings.WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


def derived_event_id(kind: str, *parts: object) -> str:
    material = ":".join([kind, *[str(part) for part in parts]])
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


async def process_shipment_delayed(payload: ShipmentDelayedWebhook, workspace_id: str):
    event_id = payload.event_id or derived_event_id(
        "shipment.delayed", payload.tracking_number, payload.delay_hours, payload.reason
    )
    operation = "webhook:shipment.delayed"
    replay = await idempotency_service.get(workspace_id, operation, event_id)
    if replay:
        return {**replay, "idempotent_replay": True}

    orders_col = get_collection("orders")
    order = await orders_col.find_one(
        {"workspace_id": workspace_id, "tracking_number": payload.tracking_number}
    )
    if not order:
        raise HTTPException(status_code=404, detail="No matching order found for tracking number")

    order_id = str(order["_id"])
    order_num = order.get("order_number", "ORD-XXXX")
    customer_id = order.get("customer_id")
    customer = await get_collection("customers").find_one(
        {"_id": customer_id, "workspace_id": workspace_id}
    ) or {}
    workspace = await get_collection("workspaces").find_one({"_id": workspace_id}) or {}
    cap = workspace.get("settings", {}).get("store_credit_max_cap", 50.0)
    credit_allowed, _, _ = guardrail_service.validate_store_credit_issuance(order, customer, 15.0, cap)
    credit_amount = 15.0 if credit_allowed else 0.0

    new_eta = payload.new_estimated_delivery or f"Delayed by {payload.delay_hours}h due to {payload.reason}"
    update = {"$set": {"status": "delayed", "estimated_delivery": new_eta}}
    if credit_amount:
        update["$inc"] = {"credits_issued": credit_amount}
    await orders_col.update_one(
        {"_id": order_id, "workspace_id": workspace_id}, update
    )

    now = datetime.utcnow()
    notif_id = f"notif_{uuid.uuid4().hex[:8]}"
    await get_collection("notifications").insert_one({
        "_id": notif_id,
        "workspace_id": workspace_id,
        "title": f"Carrier Delay Detected: {order_num}",
        "message": (
            f"Carrier {payload.carrier} reported a {payload.delay_hours}h delay ({payload.reason}). "
            + ("A $15 courtesy credit was issued." if credit_amount else "No duplicate or excess credit was issued.")
        ),
        "type": "warning",
        "read": False,
        "link": f"/orders/{order_id}",
        "created_at": now,
    })

    tickets_col = get_collection("tickets")
    existing_ticket = await tickets_col.find_one({
        "workspace_id": workspace_id,
        "order_id": order_id,
        "channel": "webhook",
        "status": {"$ne": "closed"},
    })
    citation = {
        "section_id": "pol_03",
        "title": "Carrier Delay Compensation & Courtesy Credits",
        "relevance_score": 0.99,
        "snippet": "Verified carrier delays of 48 hours or more may receive a $15 courtesy store credit.",
    }
    if existing_ticket:
        ticket_id = str(existing_ticket["_id"])
    else:
        ticket_id = f"tick_{uuid.uuid4().hex[:8]}"
        await tickets_col.insert_one({
            "_id": ticket_id,
            "workspace_id": workspace_id,
            "customer_id": customer_id,
            "order_id": order_id,
            "title": f"Proactive Resolution: Transit Delay on {order_num}",
            "status": "resolved",
            "priority": "medium",
            "channel": "webhook",
            "intent": "shipping_delay",
            "sentiment": "neutral",
            "urgency": "medium",
            "ai_confidence": 0.95,
            "is_vip": bool(customer.get("total_spent", 0) > 200),
            "vip_churn_risk": False,
            "requires_approval": False,
            "citations": [citation],
            "created_at": now,
            "updated_at": now,
        })

    await get_collection("messages").insert_one({
        "_id": f"msg_{uuid.uuid4().hex[:8]}",
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "sender_type": "system",
        "sender_name": "SupportPilot Proactive Monitor",
        "content": (
            f"Carrier delay recorded for {order_num}. "
            + ("A $15 courtesy credit was applied." if credit_amount else "The order was updated without an additional credit.")
        ),
        "citations": [citation],
        "created_at": now,
    })

    await get_collection("followups").update_one(
        {"_id": f"followup_{ticket_id}_delay", "workspace_id": workspace_id},
        {"$set": {
            "ticket_id": ticket_id,
            "customer_id": customer_id,
            "reason": "Confirm delivery progress after carrier delay",
            "due_at": (now + timedelta(hours=24)).isoformat(),
            "status": "scheduled",
            "created_at": now.isoformat(),
        }},
        upsert=True,
    )
    await get_collection("automation_rules").update_one(
        {"workspace_id": workspace_id, "trigger_event": "shipment.delayed"},
        {"$inc": {"execution_count": 1}, "$set": {"last_triggered_at": now}},
    )

    response = {
        "status": "processed",
        "order_number": order_num,
        "courtesy_credit_issued": credit_amount,
        "notification_id": notif_id,
        "ticket_id": ticket_id,
        "reason": payload.reason,
        "idempotent_replay": False,
    }
    await idempotency_service.store(
        workspace_id, operation, event_id, payload.model_dump(), response
    )
    return response


@router.post("/shipment-delayed")
async def handle_shipment_delayed(
    payload: ShipmentDelayedWebhook,
    _: None = Depends(verify_webhook_secret),
):
    return await process_shipment_delayed(
        payload, payload.workspace_id or settings.DEFAULT_WORKSPACE_ID
    )


@router.post("/payment-failed")
async def handle_payment_failed(
    payload: PaymentFailedWebhook,
    _: None = Depends(verify_webhook_secret),
):
    workspace_id = payload.workspace_id or settings.DEFAULT_WORKSPACE_ID
    event_id = payload.event_id or derived_event_id(
        "payment.failed", payload.order_number, payload.amount, payload.failure_code
    )
    operation = "webhook:payment.failed"
    replay = await idempotency_service.get(workspace_id, operation, event_id)
    if replay:
        return {**replay, "idempotent_replay": True}

    now = datetime.utcnow()
    order = await get_collection("orders").find_one(
        {"workspace_id": workspace_id, "order_number": payload.order_number}
    )
    customer = await get_collection("customers").find_one(
        {"workspace_id": workspace_id, "email": payload.customer_email}
    )
    if not customer and order:
        customer = await get_collection("customers").find_one(
            {"workspace_id": workspace_id, "_id": order.get("customer_id")}
        )

    notif_id = f"notif_{uuid.uuid4().hex[:8]}"
    await get_collection("notifications").insert_one({
        "_id": notif_id,
        "workspace_id": workspace_id,
        "title": f"Payment Failed: {payload.order_number}",
        "message": f"Payment of ${payload.amount:.2f} failed ({payload.failure_code}). Customer follow-up created.",
        "type": "urgent",
        "read": False,
        "link": "/inbox",
        "created_at": now,
    })
    ticket_id = f"tick_{uuid.uuid4().hex[:8]}"
    citation = {
        "section_id": "pol_06",
        "title": "Payment Failure Recovery Policy",
        "relevance_score": 0.99,
        "snippet": "Failed payments require a secure in-app payment-method update; card details must never be requested in support messages.",
    }
    await get_collection("tickets").insert_one({
        "_id": ticket_id,
        "workspace_id": workspace_id,
        "customer_id": str(customer.get("_id")) if customer else "guest",
        "order_id": str(order.get("_id")) if order else None,
        "title": f"Proactive Payment Recovery: {payload.order_number}",
        "status": "open",
        "priority": "high",
        "channel": "webhook",
        "intent": "payment_problem",
        "sentiment": "neutral",
        "urgency": "high",
        "ai_confidence": 0.95,
        "is_vip": bool(customer and customer.get("total_spent", 0) > 200),
        "vip_churn_risk": False,
        "requires_approval": False,
        "citations": [citation],
        "created_at": now,
        "updated_at": now,
    })
    await get_collection("messages").insert_one({
        "_id": f"msg_{uuid.uuid4().hex[:8]}",
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "sender_type": "system",
        "sender_name": "SupportPilot Payment Monitor",
        "content": "We could not process the payment. Please update your payment method through the secure checkout; do not send card details in this conversation.",
        "citations": [citation],
        "created_at": now,
    })
    await get_collection("followups").insert_one({
        "_id": f"followup_{ticket_id}_payment",
        "workspace_id": workspace_id,
        "ticket_id": ticket_id,
        "customer_id": str(customer.get("_id")) if customer else "guest",
        "reason": "Confirm payment recovery",
        "due_at": (now + timedelta(hours=4)).isoformat(),
        "status": "scheduled",
        "created_at": now.isoformat(),
    })

    response = {
        "status": "processed",
        "notification_id": notif_id,
        "ticket_id": ticket_id,
        "idempotent_replay": False,
    }
    await idempotency_service.store(
        workspace_id, operation, event_id, payload.model_dump(), response
    )
    return response


@router.post("/simulate-delay")
async def simulate_carrier_delay(
    current_user: dict = Depends(require_roles("admin", "agent")),
    workspace_id: str = Depends(get_current_workspace_id),
):
    orders_col = get_collection("orders")
    order = await orders_col.find_one({"workspace_id": workspace_id, "status": "in_transit"})
    if not order:
        order = await orders_col.find_one({
            "workspace_id": workspace_id,
            "tracking_number": {"$ne": None},
        })
    if not order:
        raise HTTPException(status_code=404, detail="No order available for simulation")

    payload = ShipmentDelayedWebhook(
        event_id=f"sim_{uuid.uuid4().hex}",
        tracking_number=order.get("tracking_number") or f"SIM-{uuid.uuid4().hex[:8]}",
        carrier=order.get("carrier") or "FedEx Express",
        delay_hours=48,
        reason="Severe winter storm transit halt at regional sorting facility",
        workspace_id=workspace_id,
    )
    return await process_shipment_delayed(payload, workspace_id)
