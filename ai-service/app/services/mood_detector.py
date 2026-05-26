from __future__ import annotations
import json
import logging

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
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

    async def detect(self, text: str) -> int | None:
        if not self._client or not text.strip():
            return None
        try:
            resp = await self._client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=text,
                config=types.GenerateContentConfig(
                    system_instruction=_SYSTEM_PROMPT,
                    temperature=0.1,
                    max_output_tokens=20,
                ),
            )
            data = json.loads(resp.text.strip())
            level = data.get("mood_level")
            if level is None:
                return None
            level = int(level)
            return level if 1 <= level <= 5 else None
        except Exception as exc:
            logger.warning("mood detection failed: %s", exc)
            return None


mood_detector = MoodDetectorService()
