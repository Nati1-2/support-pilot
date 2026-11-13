import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SupportPilot AI"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"

    # Database
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "supportpilot")

    # Gemini AI
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    DUMMYJSON_ENABLED: bool = os.getenv("DUMMYJSON_ENABLED", "true").lower() in {"1", "true", "yes"}

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supportpilot_jwt_super_secret_key_v2_2026")
    WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "supportpilot_webhook_secret_v2_2026")
    CRON_SECRET: str = os.getenv("CRON_SECRET", "supportpilot_cron_secret_v2_2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Business Guardrail Defaults
    STORE_CREDIT_MAX_CAP: float = 50.0
    CONFIDENCE_THRESHOLD: float = 0.90
    VIP_SPENT_THRESHOLD: float = 200.0
    DEFAULT_WORKSPACE_ID: str = "ws_aerowear_prod"

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
