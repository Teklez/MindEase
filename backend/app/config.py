from pydantic_settings import BaseSettings


def get_settings() -> "Settings":
    return Settings()


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://mindease:mindease_dev@localhost:5432/mindease"
    SECRET_KEY: str = "dev-secret-change-me"
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"
