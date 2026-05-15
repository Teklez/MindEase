from __future__ import annotations
import logging
from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)


class EmbedderService:
    def __init__(self) -> None:
        settings = get_settings()
        self._model = settings.EMBED_MODEL_NAME
        self._dim = settings.EMBED_DIM
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self._client is None:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        out: list[list[float]] = []
        for i in range(0, len(texts), 100):
            batch = texts[i : i + 100]
            resp = await self._client.aio.models.embed_content(
                model=self._model,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=self._dim,
                ),
            )
            out.extend([e.values for e in resp.embeddings])
        return out


embedder = EmbedderService()
