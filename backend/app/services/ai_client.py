import json

import httpx
import logging

logger = logging.getLogger(__name__)

from app.config import get_settings

settings = get_settings()


class AIClient:
    """HTTP client for the AI microservice."""

    def __init__(self):
        self.base_url = settings.AI_SERVICE_URL.rstrip("/")

    async def check_crisis(self, text: str) -> dict:
        """POST to {base_url}/check-crisis
        Body: {"text": text}
        Returns the crisis detection result dict.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/check-crisis",
                json={"text": text},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def generate_response(self, messages: list[dict]) -> str:
        """POST to {base_url}/generate with stream=false
        Returns the full response string.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/generate",
                json={"messages": messages, "stream": False},
                timeout=120.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response") or ""

    async def detect_mood(self, text: str) -> int | None:
        """POST to {base_url}/detect-mood
        Body: {"text": text} → {"mood_level": 1-5 or null}.
        Returns None on error or when no mood is expressed.
        """
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}/detect-mood",
                    json={"text": text},
                    timeout=15.0,
                )
                resp.raise_for_status()
                level = resp.json().get("mood_level")
                return int(level) if level is not None else None
        except Exception:
            return None

    async def generate_assessment(self, prompt: str) -> dict:
        """POST to {base_url}/generate-assessment
        Body: {"prompt": str} → {"spec": dict} or {"refusal": str}
        Returns the raw response dict so callers can detect refusals.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/generate-assessment",
                json={"prompt": prompt},
                timeout=90.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def summarize_export(self, payload: dict) -> str:
        """POST to {base_url}/summarize-export
        Body: { mood_entries, assessments, chat_meta }
        Returns the narrative summary string.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/summarize-export",
                json=payload,
                timeout=60.0,
            )
            resp.raise_for_status()
            return resp.json().get("summary") or ""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """POST to {base_url}/embed
        Body: {"texts": [str, ...]} → returns list of 768-d float vectors.
        Raises on HTTP error so callers can catch and degrade gracefully.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/embed",
                json={"texts": texts},
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("embeddings") or []

    async def translate(
        self, text: str, source_lang: str, target_lang: str, *, timeout: float = 15.0
    ) -> str:
        """POST {base_url}/translate. Returns the translated string, or the
        original text on any failure — callers can write the result back into
        their data shape without extra branching."""
        if not text or not text.strip() or source_lang == target_lang:
            return text
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}/translate",
                    json={
                        "text": text,
                        "source_lang": source_lang,
                        "target_lang": target_lang,
                    },
                    timeout=timeout,
                )
                resp.raise_for_status()
                data = resp.json()
                out = data.get("translated")
                return out if isinstance(out, str) and out.strip() else text
        except Exception as exc:
            logger.warning("translate %s->%s failed: %s", source_lang, target_lang, exc)
            return text

    async def generate_response_stream(
        self, messages: list[dict], *, user_lang: str | None = None
    ):
        """POST to {base_url}/generate with stream=true
        The ai-service returns Server-Sent Events.
        user_lang: optional "en" or "am"; when "am", ai-service translates to/from Amharic.
        """
        body: dict = {"messages": messages, "stream": True}
        if user_lang in ("en", "am"):
            body["user_lang"] = user_lang
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/generate",
                json=body,
                timeout=120.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        json_str = line[6:]
                        try:
                            data = json.loads(json_str)
                        except json.JSONDecodeError:
                            continue
                        if data.get("done"):
                            break
                        yield data.get("token", "")
