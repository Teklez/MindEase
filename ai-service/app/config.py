from pydantic_settings import BaseSettings


def get_settings() -> "Settings":
    return Settings()


class Settings(BaseSettings):
    OLLAMA_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.2:3b"
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"
