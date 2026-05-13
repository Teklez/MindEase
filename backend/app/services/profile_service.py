from __future__ import annotations
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.assessment_service import assessment_service
from app.services.mood_service import mood_service


class ProfileService:
    async def build_profile_block(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> str:
        """Returns a 3-6 line block: display_name + mood snapshot + latest assessments.
        Empty string if the user is brand new."""
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
        return "\n\n".join(parts)


profile_service = ProfileService()
