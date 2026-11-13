from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_initialized = False

async def ensure_initialized():
    global _initialized
    if not _initialized:
        await db_manager.connect()
        await seed_initial_data()
        _initialized = True

@app.on_event("startup")
async def startup_event():
    print("[Startup] Initializing database and services...")
    await ensure_initialized()
    print("[Startup] SupportPilot AI backend initialized successfully.")

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    # Ensure database connection on serverless cold starts
    await ensure_initialized()
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
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

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "database": "Atlas" if db_manager.is_atlas else "MockMotor (persisted)",
        "gemini_mode": "Live" if settings.GEMINI_API_KEY else "Simulated Guardrail Engine"
    }

# Mount static frontend build if present
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
