from __future__ import annotations
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.models.memory_chunk import MemoryChunk
from app.services.assessment_service import assessment_service
from app.services.mood_service import mood_service


class ProfileService:
    PROFILE_FACTS_LIMIT = 15

    async def build_profile_block(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> str:
        """Returns a multi-line block: display_name + mood snapshot + latest
        assessments + recent durable facts. Empty string for a brand-new user."""
        result = await db.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            return ""
        parts: list[str] = []
        if user.display_name:
            parts.append(f"Name: {user.display_name}")
        mood = await mood_service.recent_summary(db, user_id, days=7)
        assess = await assessment_service.format_latest_block(db, user_id)
        if mood:
            parts.append(mood)
        if assess:
            parts.append("Latest screenings:\n" + assess)

        facts = await self._recent_profile_facts(db, user_id, self.PROFILE_FACTS_LIMIT)
        if facts:
            parts.append(
                "Known facts about this user:\n" + "\n".join(f"- {f}" for f in facts)
            )
        return "\n\n".join(parts)

    async def _recent_profile_facts(
        self, db: AsyncSession, user_id: uuid.UUID, limit: int
    ) -> list[str]:
        rows = (
            await db.execute(
                select(MemoryChunk.text)
                .where(
                    MemoryChunk.user_id == user_id,
                    MemoryChunk.source_kind == "profile_fact",
                )
                .order_by(MemoryChunk.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [r for r in rows if r]


profile_service = ProfileService()
