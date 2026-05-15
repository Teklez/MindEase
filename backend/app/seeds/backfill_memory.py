from __future__ import annotations
import asyncio
import logging

from sqlalchemy import select

from app.database import async_session_maker
from app.models.assessment import Assessment, UserAssessment
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.mood_entry import MoodEntry
from app.services.memory_service import IndexItem, memory_service

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

BATCH = 100


async def _backfill_messages(db) -> int:
    """Embed and index every existing non-empty Message."""
    total = 0
    result = await db.execute(
        select(Message, Conversation.user_id)
        .join(Conversation, Message.conversation_id == Conversation.conversation_id)
        .order_by(Message.timestamp)
    )
    batch: list[IndexItem] = []
    for msg, user_id in result.all():
        if not msg.content or not msg.content.strip():
            continue
        batch.append(IndexItem(
            user_id=user_id,
            source_kind="message",
            source_id=msg.message_id,
            conversation_id=msg.conversation_id,
            text=msg.content,
            attrs={"sender": msg.sender_type},
        ))
        if len(batch) >= BATCH:
            total += await memory_service.index_many(db, batch)
            await db.commit()
            batch.clear()
    if batch:
        total += await memory_service.index_many(db, batch)
        await db.commit()
    return total


async def _backfill_mood_notes(db) -> int:
    total = 0
    result = await db.execute(
        select(MoodEntry).where(MoodEntry.note.is_not(None)).order_by(MoodEntry.created_at)
    )
    batch: list[IndexItem] = []
    for e in result.scalars().all():
        note = (e.note or "").strip()
        if not note:
            continue
        batch.append(IndexItem(
            user_id=e.user_id,
            source_kind="mood_note",
            source_id=e.entry_id,
            text=note,
            attrs={"mood_level": e.mood_level, "entry_source": e.entry_source},
        ))
        if len(batch) >= BATCH:
            total += await memory_service.index_many(db, batch)
            await db.commit()
            batch.clear()
    if batch:
        total += await memory_service.index_many(db, batch)
        await db.commit()
    return total


async def _backfill_assessments(db) -> int:
    total = 0
    result = await db.execute(
        select(UserAssessment, Assessment.assessment_type)
        .join(Assessment, UserAssessment.assessment_id == Assessment.assessment_id)
        .order_by(UserAssessment.completed_at)
    )
    batch: list[IndexItem] = []
    for ua, atype in result.all():
        text = (ua.feedback_text or "").strip()
        if not text:
            continue
        batch.append(IndexItem(
            user_id=ua.user_id,
            source_kind="assessment_result",
            source_id=ua.user_assessment_id,
            text=text,
            attrs={
                "assessment_type": atype,
                "feedback_level": ua.feedback_level,
                "score": ua.score,
            },
        ))
        if len(batch) >= BATCH:
            total += await memory_service.index_many(db, batch)
            await db.commit()
            batch.clear()
    if batch:
        total += await memory_service.index_many(db, batch)
        await db.commit()
    return total


async def main() -> None:
    async with async_session_maker() as db:
        m = await _backfill_messages(db)
        n = await _backfill_mood_notes(db)
        a = await _backfill_assessments(db)
        logger.info("backfill complete: messages=%d mood_notes=%d assessment_results=%d", m, n, a)


if __name__ == "__main__":
    asyncio.run(main())
