from __future__ import annotations

import json
import logging

from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a compassionate wellness analyst writing a personal mental health summary report for a MindEase user.

You will receive structured data about the user's mood logs, assessment results, and app engagement.
Your task is to write a warm, insightful, narrative PDF report.

Guidelines:
- Write in second person ("you", "your") — personal and direct
- Tone: warm, professional, encouraging — never clinical or alarmist
- This is NOT a diagnosis. Never diagnose. Focus on patterns and trends
- Use the data to draw meaningful observations, not just repeat numbers
- If data is sparse, acknowledge it warmly and encourage continued tracking
- Keep each section 2–4 sentences

Return your response as plain text using EXACTLY this structure (section headers on their own line starting with ##):

## Overview
[2–3 sentence executive summary of the user's overall wellbeing picture]

## Mood Trends
[Analysis of mood patterns — trajectory, consistency, highs and lows, any notable shifts]

## Assessment Progress
[What the assessment scores tell us — improvement, stability, or areas needing attention; skip if no assessment data]

## Engagement & Consistency
[How consistently the user has been engaging with MindEase — streak, frequency, time span]

## Key Observations
[2–3 specific, personalised observations drawn from the data — meaningful patterns, connections between mood and other factors]

## Moving Forward
[Gentle, actionable encouragement based on what the data shows — what to keep doing, what might help]

Do not include any preamble, JSON, or markdown formatting other than the ## section headers."""


class ExportSummarizerService:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

    async def summarize(self, payload: dict) -> str:
        if not self._client:
            return _fallback_summary(payload)
        prompt = json.dumps(payload, indent=2, default=str)
        try:
            resp = await self._client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=_SYSTEM_PROMPT,
                    temperature=0.6,
                    max_output_tokens=1800,
                ),
            )
            return (resp.text or "").strip()
        except Exception:
            logger.exception("Gemini summarize_export failed")
            return _fallback_summary(payload)


def _fallback_summary(payload: dict) -> str:
    mood = payload.get("mood_entries", [])
    assessments = payload.get("assessments", [])
    meta = payload.get("chat_meta", {})
    return (
        "## Overview\n"
        "Your MindEase data has been compiled below. AI-generated narrative is unavailable at this time.\n\n"
        f"## Mood Trends\n"
        f"You have logged {len(mood)} mood entries.\n\n"
        f"## Assessment Progress\n"
        f"You have completed {len(assessments)} assessments.\n\n"
        f"## Engagement & Consistency\n"
        f"Total conversations: {meta.get('total_conversations', 0)}. "
        f"Total messages: {meta.get('total_messages', 0)}.\n\n"
        "## Moving Forward\n"
        "Keep tracking your mood and engaging with MindEase regularly for the best insights."
    )


export_summarizer = ExportSummarizerService()
