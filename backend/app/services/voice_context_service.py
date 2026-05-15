from __future__ import annotations
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Conversation,
    Group,
    GroupMember,
    Message,
    Resource,
    User,
    UserResource,
)
from app.models.memory_chunk import MemoryChunk
from app.services.assessment_service import assessment_service
from app.services.mood_service import mood_service

logger = logging.getLogger(__name__)


class VoiceContextService:
    """Assembles a per-user dossier (identity, engagement, mood, screenings,
    resource preferences, peer groups, crisis signal) handed to Gemini Live
    as part of system_instruction so the avatar opens every call knowing
    everything MindEase knows about the user."""

    PROFILE_FACTS_LIMIT = 15

    async def build(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        sections: list[str] = []
        for fn in (
            self._identity,
            self._engagement,
            self._mood,
            self._screenings,
            self._profile_facts,
            self._resource_preferences,
            self._groups,
            self._crisis_signal,
        ):
            try:
                s = await fn(db, user_id)
            except Exception as exc:
                logger.warning("voice context section %s failed: %s", fn.__name__, exc)
                s = ""
            if s:
                sections.append(s)
        return "\n\n".join(sections)

    async def _identity(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        user = (await db.execute(
            select(User).where(User.user_id == user_id)
        )).scalar_one_or_none()
        if user is None:
            return ""
        lines = ["## About this user"]
        if user.display_name:
            lines.append(f"Name: {user.display_name}")
        if user.created_at:
            age_days = (datetime.now(timezone.utc) - user.created_at).days
            lines.append(f"Member for: {age_days} day(s)")
        return "\n".join(lines)

    async def _engagement(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(
                Conversation.conversation_type,
                func.count(),
                func.max(Conversation.last_message_at),
            )
            .where(Conversation.user_id == user_id)
            .group_by(Conversation.conversation_type)
        )).all()
        if not rows:
            return ""
        text_count = 0
        voice_count = 0
        last_seen: datetime | None = None
        for ctype, count, last in rows:
            if ctype == "voice":
                voice_count = count
            else:
                text_count = count
            if last is not None and (last_seen is None or last > last_seen):
                last_seen = last
        lines = [
            "## Engagement history",
            f"Text conversations so far: {text_count}",
            f"Voice calls so far: {voice_count}",
        ]
        if last_seen is not None:
            delta = datetime.now(timezone.utc) - last_seen
            if delta < timedelta(hours=24):
                lines.append("Last interaction: today")
            elif delta < timedelta(days=2):
                lines.append("Last interaction: yesterday")
            else:
                lines.append(f"Last interaction: {delta.days} day(s) ago")
        return "\n".join(lines)

    async def _mood(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        snapshot = await mood_service.recent_summary(db, user_id, days=7)
        if not snapshot:
            return ""
        try:
            stats = await mood_service.get_stats(db, user_id)
            streak_line = f"Current mood-tracking streak: {stats.current_streak} day(s)."
        except Exception:
            streak_line = ""
        body = snapshot if not streak_line else f"{snapshot}\n{streak_line}"
        return "## Mood snapshot\n" + body

    async def _screenings(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        block = await assessment_service.format_latest_block(db, user_id)
        if not block:
            return ""
        return "## Latest screenings\n" + block

    async def _profile_facts(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(MemoryChunk.text)
            .where(
                MemoryChunk.user_id == user_id,
                MemoryChunk.source_kind == "profile_fact",
            )
            .order_by(MemoryChunk.created_at.desc())
            .limit(self.PROFILE_FACTS_LIMIT)
        )).scalars().all()
        facts = [r for r in rows if r]
        if not facts:
            return ""
        body = "\n".join(f"- {f}" for f in facts)
        return "## Known facts about this user\n" + body

    async def _resource_preferences(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(
                Resource.category,
                func.count(UserResource.id),
                func.bool_or(UserResource.is_favorite),
            )
            .join(UserResource, UserResource.resource_id == Resource.resource_id)
            .where(UserResource.user_id == user_id)
            .group_by(Resource.category)
            .order_by(func.count(UserResource.id).desc())
            .limit(3)
        )).all()
        if not rows:
            return ""
        lines = ["## Resource preferences (top categories viewed)"]
        for category, count, any_fav in rows:
            tag = " (favorited)" if any_fav else ""
            lines.append(f"- {category}: {count} view(s){tag}")
        return "\n".join(lines)

    async def _groups(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        rows = (await db.execute(
            select(Group.name, Group.category)
            .join(GroupMember, GroupMember.group_id == Group.group_id)
            .where(GroupMember.user_id == user_id)
            .where(Group.is_active.is_(True))
        )).all()
        if not rows:
            return ""
        lines = ["## Peer-support groups joined"]
        for name, category in rows:
            lines.append(f"- {name} ({category})")
        return "\n".join(lines)

    async def _crisis_signal(self, db: AsyncSession, user_id: uuid.UUID) -> str:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        count = (await db.execute(
            select(func.count(Message.message_id))
            .join(Conversation, Conversation.conversation_id == Message.conversation_id)
            .where(
                and_(
                    Conversation.user_id == user_id,
                    Message.is_crisis_flagged.is_(True),
                    Message.timestamp >= since,
                )
            )
        )).scalar_one()
        if not count:
            return ""
        return (
            "## Safety note\n"
            f"⚠ User has shown distress signals in the last 30 days ({count} flagged message(s)). "
            "Be extra attentive, validate feelings first, and surface safety resources gently if relevant."
        )


voice_context_service = VoiceContextService()
