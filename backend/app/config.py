from pydantic_settings import BaseSettings


def get_settings() -> "Settings":
    return Settings()


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://mindease:mindease_dev@localhost:5432/mindease"
    SECRET_KEY: str = "dev-secret-change-me"
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    FRONTEND_URL: str = "http://localhost:3000"
    REDIS_URL: str = "redis://localhost:6379/0"
    AI_SERVICE_URL: str = "http://ai-service:8001"
    GEMINI_API_KEY: str = ""
    GEMINI_LIVE_MODEL: str = "models/gemini-2.5-flash-native-audio-latest"
    # SMTP (optional — if unset, emails are logged instead of sent)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = True
    FROM_EMAIL: str = "noreply@mindease.app"
    FROM_NAME: str = "MindEase"

    class Config:
        env_file = ".env"
        extra = "ignore"
