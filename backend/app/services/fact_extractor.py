"""Extract durable user-fact statements from a chat message.

The extractor is fire-and-forget — failures must never break the chat turn.
It calls the same Ollama-backed `generate_response` the chat already uses,
parses a JSON array of short, third-person factual statements out of the
reply, and indexes the survivors as memory_chunks(source_kind='profile_fact').
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.memory_chunk import MemoryChunk
from app.services.ai_client import AIClient
from app.services.memory_service import memory_service

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """\
You extract durable, third-person facts about the USER from a chat message.

Output rules:
- Reply ONLY with a JSON array of strings. No prose, no preamble, no code fences.
- Each string is a short, neutral, third-person fact about the user (e.g. "User
  is a 20-year-old engineering student.", "User lives in Addis Ababa.", "User
  is allergic to peanuts.", "User dislikes guided breathing exercises.").
- Only extract facts that are likely to remain true for weeks or months — NOT
  ephemeral states ("user is sad today"), NOT chat pleasantries, NOT meta
  questions about the assistant.
- If the message contains no extractable durable facts, reply with an empty
  array: [].
- Maximum 5 facts per message.
- Each fact <= 200 characters.
"""

# Skip extraction for content that obviously won't carry a durable fact.
_MIN_CHARS = 20
_MIN_WORDS = 4
_MAX_INPUT_CHARS = 5000
_MAX_FACTS_PER_CALL = 5
_MAX_FACT_LEN = 200


def _should_skip(content: str) -> bool:
    text = (content or "").strip()
    if len(text) < _MIN_CHARS:
        return True
    if len(text.split()) < _MIN_WORDS:
        return True
    return False


def _parse_facts(raw: str) -> list[str]:
    """Defensive JSON-array extraction. Accepts a bare array, a fenced ```json
    block, or a JSON array embedded in surrounding prose. Returns [] on any
    parse failure."""
    if not raw:
        return []
    candidate = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)```", candidate)
    if fence:
        candidate = fence.group(1).strip()
    start = candidate.find("[")
    end = candidate.rfind("]")
    if start == -1 or end == -1 or end < start:
        return []
    try:
        parsed = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            continue
        s = item.strip()
        if not s:
            continue
        if len(s) > _MAX_FACT_LEN:
            s = s[: _MAX_FACT_LEN - 3].rstrip() + "..."
        out.append(s)
        if len(out) >= _MAX_FACTS_PER_CALL:
            break
    return out


class FactExtractor:
    def __init__(self) -> None:
        self._ai_client = AIClient()

    async def extract(self, content: str) -> list[str]:
        """Call the LLM with a strict JSON prompt. Returns [] on any failure
        or when the content is too short to be worth analyzing."""
        if _should_skip(content):
            return []
        truncated = content[:_MAX_INPUT_CHARS]
        try:
            raw = await self._ai_client.generate_response(
                [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": truncated},
                ]
            )
        except Exception as exc:
            logger.warning("fact extractor LLM call failed: %s", exc)
            return []
        return _parse_facts(raw)


fact_extractor = FactExtractor()


async def _existing_fact_texts(
    db: AsyncSession, user_id: uuid.UUID, candidates: Iterable[str]
) -> set[str]:
    """Return the subset of `candidates` that already exist as profile_fact
    chunks for this user. Exact-text equality."""
    candidate_list = list({c for c in candidates if c})
    if not candidate_list:
        return set()
    rows = (
        await db.execute(
            select(MemoryChunk.text).where(
                MemoryChunk.user_id == user_id,
                MemoryChunk.source_kind == "profile_fact",
                MemoryChunk.text.in_(candidate_list),
            )
        )
    ).scalars().all()
    return set(rows)


async def extract_and_index_facts(
    *,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    source_message_id: uuid.UUID,
    content: str,
) -> None:
    """Background-task entry point: extract facts from `content`, dedupe against
    the user's existing profile_facts, and index the survivors. Never raises."""
    try:
        facts = await fact_extractor.extract(content)
    except Exception as exc:
        logger.warning("fact extraction failed: %s", exc)
        return
    if not facts:
        return

    try:
        async with async_session_maker() as db:
            existing = await _existing_fact_texts(db, user_id, facts)
            new_facts = [f for f in facts if f not in existing]
            if not new_facts:
                return
            for fact in new_facts:
                try:
                    await memory_service.index(
                        db,
                        user_id=user_id,
                        source_kind="profile_fact",
                        text=fact,
                        attrs={
                            "source_message_id": str(source_message_id),
                            "source_conversation_id": str(conversation_id),
                        },
                    )
                except Exception as exc:
                    logger.warning("index profile_fact failed: %s", exc)
            await db.commit()
            logger.info(
                "indexed %d new profile_fact(s) for user=%s (from %d extracted, %d duplicates)",
                len(new_facts), user_id, len(facts), len(facts) - len(new_facts),
            )
    except Exception as exc:
        logger.warning("extract_and_index_facts session failed: %s", exc)
