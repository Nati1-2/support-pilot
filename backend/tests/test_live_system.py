import httpx
import uuid
import sys
import re

BASE_URL = "http://127.0.0.1:8000"

def test_full_system():
    print("=" * 60)
    print("SUPPORTPILOT AI v2.0 - FULL SYSTEM VERIFICATION")
    print("=" * 60)

    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    # 1. Health & Configuration Check
    print("\n1. Verifying Health & Live Services...")
    health_res = client.get("/api/health")
    assert health_res.status_code == 200, f"Health check failed: {health_res.text}"
    health_data = health_res.json()
    print("   ✓ Health Status:", health_data["status"])
    print("   ✓ Database Engine:", health_data["database"])
    print("   ✓ Gemini Mode:", health_data["gemini_mode"])
    assert health_data["status"] == "healthy"
    assert health_data["database"] in ("Atlas", "MockMotor (persisted)")

    # 2. Frontend Assets Serving
    print("\n2. Verifying Frontend Production Bundle...")
    index_res = client.get("/")
    assert index_res.status_code == 200
    assert "SupportPilot AI" in index_res.text
    print("   ✓ Single Page Application index.html served (200 OK)")

    asset_paths = re.findall(r'(?:src|href)="([^"]*/assets/[^"]+)"', index_res.text)
    assert asset_paths, "No production assets referenced by index.html"
    for asset_path in asset_paths:
        asset_res = client.get(asset_path)
        assert asset_res.status_code == 200, f"Missing frontend asset: {asset_path}"
    print(f"   ✓ {len(asset_paths)} fingerprinted production assets verified (200 OK)")

    # 3. Demo Role Logins (Admin, Agent, Auditor, Customer)
    print("\n3. Verifying Demo Role Authentication (Segmented Pills)...")
    for role in ["admin", "agent", "viewer", "customer"]:
        res = client.post(f"/api/auth/demo/{role}")
        assert res.status_code == 200, f"Demo login failed for {role}: {res.text}"
        user_info = res.json()["user"]
        print(f"   ✓ Demo [{role.capitalize()}]: Authenticated as '{user_info['full_name']}' (Role: {user_info['role']})")

    viewer_auth = client.post("/api/auth/login", json={"email": "viewer@aerowear.com", "password": "viewer123"})
    viewer_headers = {"Authorization": f"Bearer {viewer_auth.json()['access_token']}"}
    current_settings = client.get("/api/settings/workspace", headers=viewer_headers).json()
    denied_update = client.put(
        "/api/settings/workspace",
        headers=viewer_headers,
        json={"name": current_settings["name"], "settings": current_settings["settings"]},
    )
    assert denied_update.status_code == 403
    print("   ✓ Viewer role is read-only for workspace settings (HTTP 403)")

    customer_auth = client.post("/api/auth/login", json={"email": "customer@aerowear.com", "password": "customer123"})
    customer_headers = {"Authorization": f"Bearer {customer_auth.json()['access_token']}"}
    owned_tickets = client.get("/api/tickets", headers=customer_headers).json()
    owned_orders = client.get("/api/orders", headers=customer_headers).json()
    assert all(row["customer_id"] == "cust_sophia" for row in owned_tickets + owned_orders)
    assert client.get("/api/customers/cust_marcus", headers=customer_headers).status_code == 404
    print("   ✓ Customer role is restricted to Sophia's own tickets, orders, and profile")

    # 4. Standard User Registration (Sign Up)
    print("\n4. Verifying Sign Up (Default User Creation)...")
    test_email = f"user.{uuid.uuid4().hex[:6]}@domain.com"
    reg_res = client.post("/api/auth/register", json={
        "full_name": "Jordan Lee",
        "email": test_email,
        "password": "securepassword123",
        "workspace_name": "AeroWear Goods",
        "role": "agent"
    })
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
    reg_user = reg_res.json()["user"]
    print(f"   ✓ New User Registered: {reg_user['full_name']} ({reg_user['email']}) [Role: {reg_user['role']}]")

    # Obtain Admin Bearer Token
    admin_auth = client.post("/api/auth/login", json={"email": "admin@aerowear.com", "password": "admin123"})
    token = admin_auth.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Core Platform Dashboard Endpoints
    print("\n5. Verifying Core Dashboards & API Endpoints...")
    endpoints = [
        ("/api/overview/metrics", "Overview Metrics"),
        ("/api/tickets", "Tickets Inbox"),
        ("/api/approval/queue", "Needs Approval Queue"),
        ("/api/orders", "Orders & Fulfillment"),
        ("/api/customers", "Customer Profiles & LTV"),
        ("/api/knowledge-base/policies", "Policy Knowledge Base"),
        ("/api/automations/rules", "Active Guardrail Automations"),
        ("/api/analytics/summary", "Deflection & Operational Analytics"),
        ("/api/settings/workspace", "Workspace & Policy Settings"),
    ]

    for path, label in endpoints:
        resp = client.get(path, headers=headers)
        assert resp.status_code == 200, f"Failed GET {path}: {resp.status_code}"
        print(f"   ✓ {label} ({path}) -> HTTP 200 OK")
    assert client.get("/api/settings/workspace", headers=headers).json()["settings"]["confidence_threshold"] == 0.90
    print("   ✓ Autonomous confidence barrier is fixed at the SRS-required 90%")

    # 6. Safety Guardrail Enforcement Tests
    print("\n6. Verifying Safety Limits & Financial Guardrails...")
    # Test A: Address modification lock on In-Transit order
    orders = client.get("/api/orders", headers=headers).json()
    in_transit_order = next((o for o in orders if o["status"] in ("in_transit", "delayed", "delivered")), None)
    if in_transit_order:
        addr_res = client.post(
            f"/api/orders/{in_transit_order['id']}/update-address",
            headers=headers,
            json={"shipping_address": {"street": "999 Fraud St", "city": "NYC", "state": "NY", "zip_code": "10001"}, "idempotency_key": f"live-address-{uuid.uuid4().hex}"}
        )
        assert addr_res.status_code == 400
        print("   ✓ Fulfillment Lock: Prevented address update on dispatched order (HTTP 400 GuardrailViolation)")

    # Test B: Store credit $50 limit ceiling
    credit_res = client.post(
        f"/api/orders/{orders[0]['id']}/store-credit",
        headers=headers,
        json={"amount": 95.0, "reason": "Test Overlimit", "idempotency_key": f"live-credit-{uuid.uuid4().hex}"}
    )
    assert credit_res.status_code == 400
    print("   ✓ Financial Ceiling: Blocked store credit exceeding $50 cap (HTTP 400 GuardrailViolation)")

    # 7. Live AI inquiry processing (PII redaction is tested in the isolated suite)
    print("\n7. Verifying Live AI Pipeline & Policy Citations...")
    inquiry_res = client.post(
        "/api/tickets",
        headers=headers,
        json={
            "customer_id": "cust_sophia",
            "title": "Live verification: return policy for ORD-8120",
            "message": "Can I return order ORD-8120? Please explain the applicable store policy.",
            "channel": "email"
        }
    )
    assert inquiry_res.status_code == 200
    ticket_data = inquiry_res.json()
    ticket_detail = client.get(f"/api/tickets/{ticket_data['id']}", headers=headers).json()
    audit_trace = ticket_detail.get("audit_trace") or {}
    pii_step = next(
        (step for step in audit_trace.get("execution_steps", []) if step.get("step_name") == "pii_sanitization"),
        {},
    )
    pii_details = pii_step.get("details", {})
    ai_messages = [m for m in ticket_detail.get("messages", []) if m.get("sender_type") == "ai"]
    draft_or_response = ticket_detail.get("ai_draft_reply") or (ai_messages[-1].get("content") if ai_messages else None)
    assert audit_trace.get("id"), "Audit trace ID was not serialized"
    assert pii_details.get("detected_types", []) == []
    assert draft_or_response, "No AI draft or automated response was produced"
    assert ticket_data.get("citations"), "AI result did not include a policy citation"
    print("   ✓ Inquiry Ingested & Processed (HTTP 200 OK)")
    print("   ✓ Live fixture contains no sensitive data; isolated PII suite covers redaction")
    print(f"   ✓ AI Confidence Score: {ticket_data.get('ai_confidence')}")
    print(f"   ✓ Draft Reply / AI Response: \"{str(draft_or_response)[:70]}...\"")

    print("\n" + "=" * 60)
    print("ALL VERIFICATIONS COMPLETED WITH 100% SUCCESS!")
    print("Frontend and Backend are running cleanly and ready for deployment.")
    print("=" * 60)

if __name__ == "__main__":
    test_full_system()
