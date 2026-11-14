from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from collections import defaultdict, deque
import os
import time

from backend.app.config import settings
from backend.app.database import db_manager
from backend.app.services.seed_service import seed_initial_data

from backend.app.routes import (
    auth,
    overview,
    tickets,
    approval,
    customers,
    orders,
    agent,
    knowledge_base,
    automations,
    analytics,
    settings as settings_routes,
    webhooks,
    notifications,
    followups,
    products,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Agentic Customer Support SaaS Platform with Google Gemini, Guardrails & Human-in-the-Loop workflows."
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_initialized = False
_auth_requests = defaultdict(deque)


def _rate_limit_key(request: Request) -> str:
    client_ip = request.headers.get("x-real-ip")
    if not client_ip:
        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded.split(",", 1)[0].strip() if forwarded else ""
    if not client_ip and request.client:
        client_ip = request.client.host
    return client_ip or "unknown"


def _auth_rate_limit_response(request: Request):
    if request.method != "POST" or request.url.path not in {
        "/api/auth/login",
        "/api/auth/register",
    }:
        return None

    now = time.monotonic()
    window = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS
    bucket = _auth_requests[_rate_limit_key(request)]
    while bucket and now - bucket[0] >= window:
        bucket.popleft()
    if len(bucket) >= settings.AUTH_RATE_LIMIT_REQUESTS:
        retry_after = max(1, int(window - (now - bucket[0])))
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many authentication attempts. Please try again later."},
            headers={"Retry-After": str(retry_after)},
        )
    bucket.append(now)
    return None

async def ensure_initialized():
    global _initialized
    if not _initialized:
        settings.validate_vercel_runtime()
        await db_manager.connect()
        await seed_initial_data()
        _initialized = True

@app.on_event("startup")
async def startup_event():
    # Vercel initializes lazily so the health endpoint can report incomplete
    # configuration instead of the entire function failing before a response.
    if os.getenv("VERCEL"):
        print("[Startup] Vercel runtime will initialize on the first API request.")
        return
    print("[Startup] Initializing database and services...")
    await ensure_initialized()
    print("[Startup] SupportPilot AI backend initialized successfully.")

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    rate_limited = _auth_rate_limit_response(request)
    if rate_limited:
        return rate_limited
    # Ensure database connection on serverless cold starts. Preserve the
    # fail-closed security policy while returning an actionable API response.
    if request.url.path != "/api/health":
        try:
            await ensure_initialized()
        except RuntimeError:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Server configuration is incomplete",
                    "missing_environment_variables": settings.vercel_runtime_issues(),
                },
            )
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# Register API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(overview.router, prefix=settings.API_V1_STR)
app.include_router(tickets.router, prefix=settings.API_V1_STR)
app.include_router(approval.router, prefix=settings.API_V1_STR)
app.include_router(customers.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)
app.include_router(agent.router, prefix=settings.API_V1_STR)
app.include_router(knowledge_base.router, prefix=settings.API_V1_STR)
app.include_router(automations.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(settings_routes.router, prefix=settings.API_V1_STR)
app.include_router(webhooks.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(followups.router, prefix=settings.API_V1_STR)
app.include_router(products.router, prefix=settings.API_V1_STR)

@app.get("/api")
@app.get("/api/")
async def api_root():
    return {
        "status": "online",
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "health": "/api/health",
        "docs": "/docs"
    }

@app.get("/api/health")
async def health_check():
    configuration_issues = settings.vercel_runtime_issues()
    if configuration_issues:
        return JSONResponse(
            status_code=503,
            content={
                "status": "configuration_required",
                "missing_environment_variables": configuration_issues,
            },
        )
    await ensure_initialized()
    health = {
        "status": "healthy",
        "version": settings.VERSION,
        "database": "Atlas" if db_manager.is_atlas else ("MockMotor (ephemeral)" if os.getenv("VERCEL") else "MockMotor (persisted)"),
        "gemini_mode": "Live" if settings.GEMINI_API_KEY else "Simulated Guardrail Engine"
    }
    disabled_integrations = settings.integration_runtime_issues()
    if disabled_integrations:
        health["disabled_integrations"] = disabled_integrations
    return health

# Mount static frontend build if present
dist_dir = os.path.join(os.path.dirname(__file__), "..", "..", "dist")
if not os.path.exists(dist_dir):
    dist_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(dist_dir):
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"detail": "Frontend not built"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
