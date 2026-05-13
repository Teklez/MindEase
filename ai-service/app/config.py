from pydantic_settings import BaseSettings


def get_settings() -> "Settings":
    return Settings()


class Settings(BaseSettings):
    OLLAMA_URL: str = "http://ollama:11434"
    MODEL_NAME: str = "llama3.1:8b"
    GEMINI_API_KEY: str = ""
    EMBED_MODEL_NAME: str = "gemini-embedding-001"
    EMBED_DIM: int = 768

    class Config:
        env_file = ".env"
        extra = "ignore"
