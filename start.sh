#!/bin/bash
set -e

echo "=========================================================="
echo "          Starting SupportPilot AI v2.0 Platform          "
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Always compile the current frontend so one command cannot serve a stale bundle.
echo "[Build] Building frontend React distribution..."
npm run build

echo "[Backend] Launching FastAPI backend server on http://localhost:8000..."
exec backend/venv/bin/python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --ws none
