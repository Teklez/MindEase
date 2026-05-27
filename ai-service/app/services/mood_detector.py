from __future__ import annotations
import json
import logging

import httpx
from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a mood detection assistant for a mental health app.

Given a user message, decide if the user is expressing their current emotional state.
If yes, return a mood level 1-5:
  1 = Crisis / very distressed (hopeless, suicidal, can't go on)
  2 = Low / struggling (sad, anxious, stressed, overwhelmed, depressed, scared)
  3 = Neutral / okay (fine, managing, so-so, coping)
  4 = Good (happy, calm, positive, relieved)
  5 = Great (excellent, very happy, energized, amazing)

If the message does NOT express a personal emotional state, return null.

Respond ONLY with valid JSON: {"mood_level": <1-5 or null>}
No explanation. No extra text."""


class MoodDetectorService:
    def __init__(self) -> None:
        settings = get_settings()
        self._settings = settings
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

    async def detect(self, text: str) -> int | None:
        if not text.strip():
            return None
        if self._client:
            try:
                resp = await self._client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=text,
                    config=types.GenerateContentConfig(
                        system_instruction=_SYSTEM_PROMPT,
                        temperature=0.1,
                        max_output_tokens=20,
                    ),
                )
                return _parse_level(resp.text)
            except Exception as exc:
                logger.warning("Gemini mood detection failed, falling back to Ollama: %s", exc)
        return await self._detect_ollama(text)

    async def _detect_ollama(self, text: str) -> int | None:
        url = f"{self._settings.OLLAMA_URL.rstrip('/')}/api/chat"
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ]
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json={"model": self._settings.MODEL_NAME, "messages": messages, "stream": False})
                resp.raise_for_status()
                content = (resp.json().get("message") or {}).get("content") or ""
                return _parse_level(content)
        except Exception as exc:
            logger.warning("Ollama mood detection failed: %s", exc)
            return None


def _parse_level(text: str) -> int | None:
    if not text:
        return None
    try:
        # Extract JSON even if surrounded by extra text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        data = json.loads(text[start:end])
        level = data.get("mood_level")
        if level is None:
            return None
        level = int(level)
        return level if 1 <= level <= 5 else None
    except Exception:
        return None


mood_detector = MoodDetectorService()
