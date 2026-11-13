import os
import sys

# Ensure project root is in the Python module search path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.main import app

# Vercel Serverless Function entrypoint
# The ASGI application is exposed as `app`
