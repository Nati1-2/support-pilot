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
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in {"1", "true", "yes"}

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supportpilot_jwt_super_secret_key_v2_2026")
    WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "supportpilot_webhook_secret_v2_2026")
    CRON_SECRET: str = os.getenv("CRON_SECRET", "supportpilot_cron_secret_v2_2026")
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )
    AUTH_RATE_LIMIT_REQUESTS: int = int(os.getenv("AUTH_RATE_LIMIT_REQUESTS", "10"))
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60"))
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

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def vercel_runtime_issues(self) -> list[str]:
        """Return critical settings that must exist before the app can start."""
        if not os.getenv("VERCEL"):
            return []

        defaults = {
            "JWT_SECRET": "supportpilot_jwt_super_secret_key_v2_2026",
        }
        invalid = [
            name
            for name, default in defaults.items()
            if (
                not getattr(self, name)
                or getattr(self, name) == default
                or getattr(self, name).startswith("REPLACE_WITH")
                or len(getattr(self, name)) < 32
            )
        ]
        if (
            not self.MONGODB_URI.startswith(("mongodb://", "mongodb+srv://"))
            or "USERNAME:PASSWORD@HOST" in self.MONGODB_URI
        ):
            invalid.append("MONGODB_URI")
        return sorted(set(invalid))

    def integration_runtime_issues(self) -> list[str]:
        """Return optional integrations disabled by absent secure credentials."""
        if not os.getenv("VERCEL"):
            return []
        defaults = {
            "WEBHOOK_SECRET": "supportpilot_webhook_secret_v2_2026",
            "CRON_SECRET": "supportpilot_cron_secret_v2_2026",
        }
        return sorted(
            name
            for name, default in defaults.items()
            if (
                not getattr(self, name)
                or getattr(self, name) == default
                or getattr(self, name).startswith("REPLACE_WITH")
                or len(getattr(self, name)) < 32
            )
        )

    def validate_vercel_runtime(self) -> None:
        """Refuse to start an insecure or non-persistent Vercel deployment."""
        invalid = self.vercel_runtime_issues()
        if invalid:
            raise RuntimeError(
                "Missing secure Vercel environment variables: " + ", ".join(invalid)
            )

settings = Settings()
