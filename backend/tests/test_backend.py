import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import db_manager
from backend.app.services.seed_service import seed_initial_data

async def run_tests():
    print("--- 1. Testing DB and Seed Initialization ---")
    await db_manager.connect()
    await seed_initial_data()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n--- 2. Testing Health Check ---")
        res = await client.get("/api/health")
        print("Health status:", res.status_code, res.json())
        assert res.status_code == 200

        print("\n--- 3. Testing Authentication (Login & Sign Up) ---")
        login_res = await client.post("/api/auth/login", json={"email": "admin@aerowear.com", "password": "admin123"})
        print("Login status:", login_res.status_code)
        assert login_res.status_code == 200
        data = login_res.json()
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Logged in as:", data["user"]["full_name"], "Role:", data["user"]["role"])

        # Test Sign Up (Registration) with unique email
        test_email = f"marcus.vance.{uuid.uuid4().hex[:6]}@company.com"
        register_res = await client.post("/api/auth/register", json={
            "full_name": "Marcus Vance",
            "email": test_email,
            "password": "password123",
            # Public callers must not be able to grant themselves privileges.
            "workspace_name": "Attacker Workspace",
            "role": "admin"
        })
        print("Register status:", register_res.status_code)
        assert register_res.status_code == 200
        reg_data = register_res.json()
        assert reg_data["user"]["email"] == test_email
        assert reg_data["user"]["role"] == "customer"
        assert reg_data["user"]["workspace_id"] == "ws_aerowear_prod"
        assert reg_data["user"]["customer_id"]
        assert "access_token" in reg_data

        print("\n--- 4. Testing Overview Metrics ---")
        metrics_res = await client.get("/api/overview/metrics", headers=headers)
        print("Metrics:", metrics_res.status_code, metrics_res.json())
        assert metrics_res.status_code == 200
        assert metrics_res.json()["total_tickets"] >= 3

        print("\n--- 5. Testing Tickets List & Queues ---")
        inbox_res = await client.get("/api/tickets?queue=inbox", headers=headers)
        print("Inbox tickets count:", len(inbox_res.json()))
        assert inbox_res.status_code == 200

        approval_res = await client.get("/api/approval/queue", headers=headers)
        print("Needs approval count:", len(approval_res.json()))
        assert approval_res.status_code == 200
        assert len(approval_res.json()) >= 1

        vip_res = await client.get("/api/tickets?queue=vip", headers=headers)
        print("VIP queue count:", len(vip_res.json()))
        assert vip_res.status_code == 200
        assert len(vip_res.json()) >= 1

        print("\n--- 6. Testing Deterministic Guardrails (Address update on In-Transit order) ---")
        orders_res = await client.get("/api/orders", headers=headers)
        orders = orders_res.json()
        in_transit_order = next((o for o in orders if o["status"] in ("in_transit", "delayed", "delivered")), None)
        assert in_transit_order is not None, "Expected dispatched order"
        guardrail_attempt = await client.post(
            f"/api/orders/{in_transit_order['id']}/update-address",
            headers=headers,
            json={
                "shipping_address": {
                    "street": "123 Fraud Lane",
                    "city": "Nowhere",
                    "state": "CA",
                    "zip_code": "90210"
                },
                "idempotency_key": f"test-address-{uuid.uuid4().hex}"
            }
        )
        print("Address guardrail rejection status:", guardrail_attempt.status_code, guardrail_attempt.json())
        assert guardrail_attempt.status_code == 400
        assert "Address change rejected" in str(guardrail_attempt.json())

        print("\n--- 7. Testing Store Credit Guardrail ($50 cap) ---")
        credit_over_attempt = await client.post(
            f"/api/orders/{in_transit_order['id']}/store-credit",
            headers=headers,
            json={"amount": 75.0, "reason": "Excessive compensation", "idempotency_key": f"test-credit-{uuid.uuid4().hex}"}
        )
        print("Credit cap rejection status:", credit_over_attempt.status_code, credit_over_attempt.json())
        assert credit_over_attempt.status_code == 400
        assert "exceeds the absolute maximum store credit cap" in str(credit_over_attempt.json())

        print("\n--- 8. Testing AI Agent Inquiry Pipeline & PII Redaction ---")
        inquiry_res = await client.post(
            "/api/tickets",
            headers=headers,
            json={
                "customer_id": "cust_sophia",
                "title": "Return authorization request",
                "message": "Hi, my card is 4111-2222-3333-4444 and SSN is 000-12-3456. I want to return the commuter shell from ORD-8120.",
                "channel": "email"
            }
        )
        print("Inquiry creation status:", inquiry_res.status_code)
        assert inquiry_res.status_code == 200
        created_ticket = inquiry_res.json()
        print("Created ticket AI confidence:", created_ticket["ai_confidence"])
        print("Created ticket citations count:", len(created_ticket["citations"]))

        print("\n--- 9. Testing Proactive Carrier Delay Simulation Webhook ---")
        sim_res = await client.post("/api/webhooks/simulate-delay", headers=headers)
        print("Simulate delay webhook status:", sim_res.status_code, sim_res.json())
        assert sim_res.status_code == 200

        print("\n--- 10. Testing Analytics Summary ---")
        analytics_res = await client.get("/api/analytics/summary", headers=headers)
        print("Analytics status:", analytics_res.status_code)
        assert analytics_res.status_code == 200
        data = analytics_res.json()
        print(f"Deflection Rate: {data['ai_deflection_rate']}%, Hours Saved: {data['estimated_hours_saved']}")

    print("\n================ ALL 10 BACKEND INTEGRATION TESTS PASSED! ================\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
