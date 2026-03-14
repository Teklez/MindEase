from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.badge import Badge, UserBadge
from app.models.conversation import Conversation
from app.models.mood_entry import MoodEntry
from app.schemas.mood import BadgeResponse


class BadgeService:

    async def check_and_award(self, db: AsyncSession, user_id: UUID) -> list[BadgeResponse]:
        """Check all badge criteria and award any newly earned badges.

        Returns list of NEWLY earned badges (not previously earned).
        """
        # Load all active badges
        badges_result = await db.execute(select(Badge).where(Badge.is_active.is_(True)))
        all_badges = badges_result.scalars().all()

        # Load already-earned badge IDs for this user
        earned_result = await db.execute(
            select(UserBadge).where(UserBadge.user_id == user_id)
        )
        earned_map = {ub.badge_id: ub for ub in earned_result.scalars().all()}

        newly_earned: list[BadgeResponse] = []

        for badge in all_badges:
            if badge.badge_id in earned_map:
                continue

            criteria_met = False
            if badge.criteria_type == "mood_count":
                criteria_met = await self._check_mood_count(db, user_id, badge.criteria_value)
            elif badge.criteria_type == "mood_streak":
                criteria_met = await self._check_mood_streak(db, user_id, badge.criteria_value)
            elif badge.criteria_type == "chat_count":
                criteria_met = await self._check_chat_count(db, user_id, badge.criteria_value)
            elif badge.criteria_type == "assessment":
                # Placeholder — no assessment table yet; always False
                criteria_met = False

            if criteria_met:
                user_badge = UserBadge(user_id=user_id, badge_id=badge.badge_id)
                db.add(user_badge)
                await db.flush()
                await db.refresh(user_badge)
                newly_earned.append(
                    BadgeResponse(
                        badge_id=badge.badge_id,
                        name=badge.name,
                        name_am=badge.name_am,
                        description=badge.description,
                        description_am=badge.description_am,
                        icon=badge.icon,
                        earned_at=user_badge.earned_at,
                        is_earned=True,
                    )
                )

        await db.commit()
        return newly_earned

    async def get_user_badges(self, db: AsyncSession, user_id: UUID) -> list[BadgeResponse]:
        """Get all badges with earned status for a user."""
        badges_result = await db.execute(select(Badge).where(Badge.is_active.is_(True)))
        all_badges = badges_result.scalars().all()

        earned_result = await db.execute(
            select(UserBadge).where(UserBadge.user_id == user_id)
        )
        earned_map = {ub.badge_id: ub for ub in earned_result.scalars().all()}

        return [
            BadgeResponse(
                badge_id=badge.badge_id,
                name=badge.name,
                name_am=badge.name_am,
                description=badge.description,
                description_am=badge.description_am,
                icon=badge.icon,
                earned_at=earned_map[badge.badge_id].earned_at if badge.badge_id in earned_map else None,
                is_earned=badge.badge_id in earned_map,
            )
            for badge in all_badges
        ]

    async def _check_mood_count(self, db: AsyncSession, user_id: UUID, value: int) -> bool:
        result = await db.execute(
            select(func.count()).where(MoodEntry.user_id == user_id)
        )
        return (result.scalar() or 0) >= value

    async def _check_mood_streak(self, db: AsyncSession, user_id: UUID, value: int) -> bool:
        result = await db.execute(
            select(func.date(MoodEntry.created_at))
            .where(MoodEntry.user_id == user_id)
            .distinct()
            .order_by(func.date(MoodEntry.created_at).asc())
        )
        dates = sorted({row[0] for row in result.all()})
        if not dates:
            return False
        current_streak = _calc_current_streak(dates)
        return current_streak >= value

    async def _check_chat_count(self, db: AsyncSession, user_id: UUID, value: int) -> bool:
        result = await db.execute(
            select(func.count()).where(Conversation.user_id == user_id)
        )
        return (result.scalar() or 0) >= value


def _calc_current_streak(sorted_dates: list[date]) -> int:
    """Count consecutive days ending at today or yesterday."""
    if not sorted_dates:
        return 0
    today = date.today()
    check = today if today in set(sorted_dates) else today - timedelta(days=1)
    date_set = set(sorted_dates)
    streak = 0
    while check in date_set:
        streak += 1
        check -= timedelta(days=1)
    return streak
