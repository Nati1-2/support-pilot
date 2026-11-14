import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from backend.app.config import settings
from backend.app.database import db_manager
from backend.app.main import app
from backend.app.models.ticket import GeminiAgentResult
from backend.app.services.seed_service import seed_initial_data


async def login(client: AsyncClient, email: str, password: str):
    response = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def run_tests():
    def checkpoint(name: str):
        print(f"[acceptance] {name}", flush=True)

    await db_manager.connect()
    await seed_initial_data()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin = await login(client, "admin@aerowear.com", "admin123")
        agent = await login(client, "sarah.support@aerowear.com", "agent123")
        viewer = await login(client, "viewer@aerowear.com", "viewer123")
        customer = await login(client, "customer@aerowear.com", "customer123")
        checkpoint("authentication and threshold")

        assert (await client.get("/api/tickets")).status_code == 401
        workspace = (await client.get("/api/settings/workspace", headers=admin)).json()
        assert workspace["settings"]["confidence_threshold"] == 0.90

        forbidden_calls = [
            client.put("/api/settings/workspace", headers=viewer, json={"name": workspace["name"], "settings": workspace["settings"]}),
            client.post("/api/customers", headers=viewer, json={"name": "Blocked", "email": "blocked@example.com", "total_spent": 0, "orders_count": 0}),
            client.post("/api/knowledge-base/policies", headers=viewer, json={"title": "Blocked", "category": "general", "content": "Blocked mutation", "tags": []}),
            client.post("/api/agent/test-inquiry", headers=viewer, json={"message": "Blocked"}),
        ]
        for call in forbidden_calls:
            assert (await call).status_code == 403
        checkpoint("viewer RBAC")

        orders = (await client.get("/api/orders", headers=agent)).json()
        unfulfilled = next(order for order in orders if order["status"] == "unfulfilled")
        address_key = f"address-{uuid.uuid4().hex}"
        address_payload = {
            "shipping_address": {"street": "100 SRS Lane", "city": "Seattle", "state": "WA", "zip_code": "98102", "country": "United States"},
            "idempotency_key": address_key,
        }
        first = await client.post(f"/api/orders/{unfulfilled['id']}/update-address", headers=agent, json=address_payload)
        replay = await client.post(f"/api/orders/{unfulfilled['id']}/update-address", headers=agent, json=address_payload)
        assert first.status_code == 200 and replay.status_code == 200
        assert replay.json()["idempotent_replay"] is True

        viewer_order_write = await client.post(
            f"/api/orders/{unfulfilled['id']}/store-credit",
            headers=viewer,
            json={"amount": 5, "reason": "blocked", "idempotency_key": f"blocked-{uuid.uuid4().hex}"},
        )
        assert viewer_order_write.status_code == 403
        checkpoint("order idempotency and RBAC")

        inquiry = await client.post(
            "/api/tickets",
            headers=agent,
            json={
                "customer_id": "cust_sophia",
                "title": "SRS acceptance: payment and phone redaction",
                "message": "My card 4111-2222-3333-4444 failed. Call me at 555-222-3333. Please give store credit.",
                "channel": "portal",
            },
        )
        assert inquiry.status_code == 200, inquiry.text
        created = inquiry.json()
        assert created["ai_confidence"] < 0.90
        assert created["status"] == "needs_approval"
        assert created["citations"], "Every AI result must include a policy citation"
        detail = (await client.get(f"/api/tickets/{created['id']}", headers=agent)).json()
        pii = next(step for step in detail["audit_trace"]["execution_steps"] if step["step_name"] == "pii_sanitization")
        assert {"credit_card", "phone_number"}.issubset(set(pii["details"]["detected_types"]))
        assert "4111-2222-3333-4444" not in pii["details"]["preview_sanitized"]
        checkpoint("confidence gate, citations, and PII")

        customer_tickets = (await client.get("/api/tickets", headers=customer)).json()
        assert customer_tickets and all(row["customer_id"] == "cust_sophia" for row in customer_tickets)
        foreign = await client.get("/api/tickets/tick_addr_gate_01", headers=customer)
        assert foreign.status_code == 404
        foreign_profile = await client.get("/api/customers/cust_marcus", headers=customer)
        assert foreign_profile.status_code == 404
        customer_orders = (await client.get("/api/orders", headers=customer)).json()
        assert all(row["customer_id"] == "cust_sophia" for row in customer_orders)
        own_create = await client.post(
            "/api/tickets",
            headers=customer,
            json={"customer_id": "cust_sophia", "title": "Customer portal test", "message": "Can I return order ORD-8120?", "channel": "portal"},
        )
        assert own_create.status_code == 200
        foreign_create = await client.post(
            "/api/tickets",
            headers=customer,
            json={"customer_id": "cust_marcus", "title": "Blocked", "message": "Not my profile", "channel": "portal"},
        )
        assert foreign_create.status_code == 403
        checkpoint("customer ownership")

        webhook_event = f"evt-{uuid.uuid4().hex}"
        in_transit = next(
            (order for order in orders if order["status"] == "in_transit"),
            next(order for order in orders if order.get("tracking_number")),
        )
        webhook_payload = {
            "event_id": webhook_event,
            "tracking_number": in_transit.get("tracking_number"),
            "delay_hours": 48,
            "reason": "SRS idempotency acceptance",
            "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        }
        webhook_headers = {"X-Webhook-Secret": settings.WEBHOOK_SECRET}
        checkpoint("calling shipment webhook")
        hook_first = await client.post("/api/webhooks/shipment-delayed", headers=webhook_headers, json=webhook_payload)
        checkpoint("shipment webhook first call returned")
        hook_replay = await client.post("/api/webhooks/shipment-delayed", headers=webhook_headers, json=webhook_payload)
        checkpoint("shipment webhook replay returned")
        assert hook_first.status_code == 200, hook_first.text
        assert hook_replay.json()["idempotent_replay"] is True
        assert (await client.post("/api/webhooks/shipment-delayed", json=webhook_payload)).status_code == 401

        payment_payload = {
            "event_id": f"pay-{uuid.uuid4().hex}",
            "order_number": "ORD-8120",
            "amount": 130,
            "customer_email": "sophia.rodriguez@techhub.io",
            "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        }
        checkpoint("calling payment webhook")
        payment = await client.post("/api/webhooks/payment-failed", headers=webhook_headers, json=payment_payload)
        assert payment.status_code == 200 and payment.json()["ticket_id"]
        checkpoint("signed idempotent webhooks")

        due = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)).isoformat()
        scheduled = await client.post(
            "/api/followups",
            headers=agent,
            json={"ticket_id": created["id"], "reason": "SRS due follow-up", "due_at": due},
        )
        assert scheduled.status_code == 200
        assert (await client.get("/api/followups/process-due")).status_code == 401
        processed = await client.get(
            "/api/followups/process-due",
            headers={"Authorization": f"Bearer {settings.CRON_SECRET}"},
        )
        assert processed.status_code == 200 and processed.json()["processed_count"] >= 1
        checkpoint("protected scheduled follow-ups")

        catalog = await client.get("/api/products?search=jacket", headers=customer)
        assert catalog.status_code == 200
        assert catalog.json()["products"]
        assert all(product["is_simulated"] for product in catalog.json()["products"])
        checkpoint("simulated product integration")

        try:
            GeminiAgentResult.model_validate({"reply": "x", "confidence": "high", "proposed_action": None})
            raise AssertionError("Malformed Gemini output was accepted")
        except ValidationError:
            pass
        checkpoint("strict Gemini schema")

        registered_email = f"registered-{uuid.uuid4().hex[:8]}@example.com"
        registered = await client.post(
            "/api/auth/register",
            json={"full_name": "Registered User", "email": registered_email, "password": "password123", "workspace_name": "Injected Workspace", "role": "admin"},
        )
        assert registered.status_code == 200
        registered_user = registered.json()["user"]
        assert registered_user["role"] == "customer"
        assert registered_user["workspace_id"] == settings.DEFAULT_WORKSPACE_ID
        assert registered_user["customer_id"]
        registered_headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
        assert (await client.get("/api/tickets", headers=registered_headers)).json() == []
        assert (await client.get("/api/orders", headers=registered_headers)).json() == []
        assert (await client.get("/api/overview/metrics", headers=registered_headers)).status_code == 403
        checkpoint("public registration role enforcement")

        original_demo_mode = settings.DEMO_MODE
        settings.DEMO_MODE = False
        try:
            disabled_demo_login = await client.post(
                "/api/auth/login",
                headers={"X-Real-IP": "203.0.113.20"},
                json={"email": "admin@aerowear.com", "password": "admin123"},
            )
            assert disabled_demo_login.status_code == 403
            assert (await client.post(
                "/api/auth/demo/admin",
                headers={"X-Real-IP": "203.0.113.20"},
            )).status_code == 404
        finally:
            settings.DEMO_MODE = original_demo_mode
        checkpoint("demo-account disable switch")

        rate_headers = {"X-Real-IP": "203.0.113.30"}
        for _ in range(settings.AUTH_RATE_LIMIT_REQUESTS):
            attempt = await client.post(
                "/api/auth/login",
                headers=rate_headers,
                json={"email": "missing@example.com", "password": "incorrect"},
            )
            assert attempt.status_code == 401
        throttled = await client.post(
            "/api/auth/login",
            headers=rate_headers,
            json={"email": "missing@example.com", "password": "incorrect"},
        )
        assert throttled.status_code == 429 and throttled.headers.get("retry-after")
        checkpoint("authentication rate limiting")

        cors_preflight = await client.options(
            "/api/auth/login",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert cors_preflight.headers.get("access-control-allow-origin") == "http://localhost:5173"
        blocked_origin = await client.options(
            "/api/auth/login",
            headers={
                "Origin": "https://malicious.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" not in blocked_origin.headers
        checkpoint("restricted CORS")

        original_vercel = os.environ.get("VERCEL")
        original_values = {
            name: getattr(settings, name)
            for name in ("MONGODB_URI", "JWT_SECRET", "WEBHOOK_SECRET", "CRON_SECRET")
        }
        os.environ["VERCEL"] = "1"
        settings.MONGODB_URI = ""
        settings.JWT_SECRET = "short"
        settings.WEBHOOK_SECRET = "short"
        settings.CRON_SECRET = "short"
        try:
            health = await client.get("/api/health")
            assert health.status_code == 503
            missing = set(health.json()["missing_environment_variables"])
            assert missing == {"MONGODB_URI", "JWT_SECRET", "WEBHOOK_SECRET", "CRON_SECRET"}
        finally:
            for name, value in original_values.items():
                setattr(settings, name, value)
            if original_vercel is None:
                os.environ.pop("VERCEL", None)
            else:
                os.environ["VERCEL"] = original_vercel
        checkpoint("actionable Vercel configuration error")

    print("ALL SRS ACCEPTANCE TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(run_tests())
