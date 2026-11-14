"""Read-only post-deployment smoke test.

Usage:
    python scripts/smoke_test.py https://your-app.vercel.app
    SMOKE_URL=https://your-app.vercel.app python scripts/smoke_test.py

Checks the frontend bundle, SPA routing, API health, auth protection, and
(when demo accounts are enabled) that each role can log in and load its main
views. Nothing is written to the database. Set SMOKE_REQUIRE_ATLAS=1 to fail
when the deployment is not using MongoDB Atlas, SMOKE_REQUIRE_INTEGRATIONS=1
to fail when CRON_SECRET / WEBHOOK_SECRET are missing, and SMOKE_AI=1 to also
run one live AI inquiry (uses one Gemini request).
"""
import os
import re
import sys
import time

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else os.getenv("SMOKE_URL", "")).rstrip("/")
if not BASE.startswith("http"):
    sys.exit("Usage: smoke_test.py <deployment URL>  (or set SMOKE_URL)")

client = httpx.Client(timeout=60, follow_redirects=True)
failures: list[str] = []


def check(name: str, ok: bool, info: object = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'} {name}" + (f"  -> {info}" if info not in ("", None) else ""), flush=True)
    if not ok:
        failures.append(name)


def get_health() -> dict:
    # The first request after a deploy can hit a cold serverless function.
    last = None
    for _ in range(5):
        try:
            r = client.get(f"{BASE}/api/health")
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}: {r.text[:200]}"
        except httpx.HTTPError as exc:
            last = repr(exc)
        time.sleep(5)
    check("API health reachable", False, last)
    return {}


print(f"Smoke testing {BASE}")

# Frontend
home = client.get(f"{BASE}/")
check("frontend index served", home.status_code == 200 and 'id="root"' in home.text, home.status_code)
assets = re.findall(r'(?:src|href)="(/assets/[^"]+)"', home.text)
check("frontend bundles referenced", any(a.endswith(".js") for a in assets), assets)
for asset in assets:
    r = client.get(f"{BASE}{asset}")
    check(f"asset {asset}", r.status_code == 200 and len(r.content) > 500, r.status_code)
for route in ("/login", "/inbox", "/agent-workspace"):
    r = client.get(f"{BASE}{route}")
    check(f"SPA route {route}", r.status_code == 200 and 'id="root"' in r.text, r.status_code)

# Backend
health = get_health()
if health:
    check("API healthy", health.get("status") == "healthy", health)
    if os.getenv("SMOKE_REQUIRE_ATLAS") == "1":
        check("database is MongoDB Atlas", health.get("database") == "Atlas", health.get("database"))
    disabled = health.get("disabled_integrations") or []
    if os.getenv("SMOKE_REQUIRE_INTEGRATIONS") == "1":
        check("webhook and cron secrets configured", not disabled, disabled)
    elif disabled:
        print(f"WARN integrations disabled on this deployment: {', '.join(disabled)}")
    print(f"INFO gemini_mode={health.get('gemini_mode')} database={health.get('database')}")

check("API rejects unauthenticated requests", client.get(f"{BASE}/api/tickets").status_code == 401)

DEMO_USERS = {
    "admin": ("admin@aerowear.com", "admin123", ["/overview/metrics", "/tickets", "/approval/queue", "/agent/status", "/settings/workspace"]),
    "agent": ("sarah.support@aerowear.com", "agent123", ["/tickets", "/approval/queue", "/orders", "/customers"]),
    "viewer": ("viewer@aerowear.com", "viewer123", ["/analytics/summary", "/agent/audit-traces"]),
    "customer": ("customer@aerowear.com", "customer123", ["/tickets", "/orders"]),
}
admin_headers = None
for role, (email, password, paths) in DEMO_USERS.items():
    r = client.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 403 and role == "admin":
        print("INFO demo accounts disabled; skipping role checks")
        break
    check(f"{role} demo login", r.status_code == 200, r.status_code)
    if r.status_code != 200:
        continue
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    if role == "admin":
        admin_headers = headers
    for path in paths:
        resp = client.get(f"{BASE}/api{path}", headers=headers)
        check(f"{role} GET {path}", resp.status_code == 200, resp.status_code)

if admin_headers:
    status = client.get(f"{BASE}/api/agent/status", headers=admin_headers).json()
    print(f"INFO AI model chain: {status.get('model_chain')} last_error: {status.get('last_live_error')}")
    if os.getenv("SMOKE_AI") == "1":
        r = client.post(
            f"{BASE}/api/agent/test-inquiry",
            headers=admin_headers,
            json={"message": "What is your return window?", "customer_id": "cust_sophia"},
        )
        data = r.json() if r.status_code == 200 else {}
        check("live AI reply from Gemini", data.get("engine_mode") == "gemini_live",
              data.get("fallback_reason") or data.get("model") or r.status_code)

print()
if failures:
    print(f"SMOKE TEST FAILED ({len(failures)}): " + ", ".join(failures))
    sys.exit(1)
print("SMOKE TEST PASSED")
