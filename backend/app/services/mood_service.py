import asyncio
import logging
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.mood_entry import MoodEntry
from app.schemas.mood import (
    MoodDayAggregate,
    MoodEntryCreate,
    MoodEntryResponse,
    MoodHistoryResponse,
    MoodStats,
    MoodTrend,
)
from app.services.badge_service import BadgeService, _calc_current_streak
from app.services.memory_service import memory_service

logger = logging.getLogger(__name__)

_badge_service = BadgeService()


class MoodService:

    async def create_entry(
        self, db: AsyncSession, user_id: UUID, data: MoodEntryCreate
    ) -> tuple[MoodEntryResponse, list]:
        """Create a mood entry and check for badge eligibility.

        Returns (entry, newly_earned_badges).
        """
        entry = MoodEntry(
            user_id=user_id,
            mood_level=data.mood_level,
            note=data.note,
        )
        db.add(entry)
        await db.flush()
        await db.refresh(entry)
        response = MoodEntryResponse.model_validate(entry)
        if data.note and data.note.strip():
            asyncio.create_task(_background_index_mood_note(
                user_id=user_id,
                entry_id=entry.entry_id,
                text=data.note,
                mood_level=data.mood_level,
                entry_source=getattr(entry, "entry_source", "manual"),
            ))
        new_badges = await _badge_service.check_and_award(db, user_id)
        return response, new_badges

    async def get_entries(
        self,
        db: AsyncSession,
        user_id: UUID,
        days: int = 30,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[MoodEntry]:
        """Get mood entries for a user within a date range."""
        if start_date is None:
            start_date = date.today() - timedelta(days=days)
        if end_date is None:
            end_date = date.today()

        start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
        end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)

        result = await db.execute(
            select(MoodEntry)
            .where(
                MoodEntry.user_id == user_id,
                MoodEntry.created_at >= start_dt,
                MoodEntry.created_at <= end_dt,
            )
            .order_by(MoodEntry.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_today_entries(self, db: AsyncSession, user_id: UUID) -> list[MoodEntry]:
        """Get all entries from today for a user."""
        today = date.today()
        start_dt = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
        result = await db.execute(
            select(MoodEntry)
            .where(
                MoodEntry.user_id == user_id,
                MoodEntry.created_at >= start_dt,
            )
            .order_by(MoodEntry.created_at.desc())
        )
        return list(result.scalars().all())

    async def recent_summary(
        self, db: AsyncSession, user_id: UUID, *, days: int = 7
    ) -> str:
        """Returns a compact human-readable block describing the user's last `days` days
        of mood entries. Empty string if the user has nothing in the window.
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await db.execute(
            select(MoodEntry)
            .where(MoodEntry.user_id == user_id)
            .where(MoodEntry.created_at >= since)
            .order_by(MoodEntry.created_at.desc())
            .limit(5)
        )
        entries = list(result.scalars().all())
        if not entries:
            return ""
        avg = sum(e.mood_level for e in entries) / len(entries)
        lines = [f"Avg mood (last {days} days): {avg:.1f} / 5 across {len(entries)} entries."]
        for e in entries[:3]:
            d = e.created_at.date().isoformat()
            note = f' — "{e.note.strip()}"' if e.note else ""
            lines.append(f"- {d}: {e.mood_level}/5{note}")
        return "\n".join(lines)

    async def get_stats(self, db: AsyncSession, user_id: UUID) -> MoodStats:
        """Calculate comprehensive mood statistics."""
        # All entries (for streak / distribution / totals)
        all_result = await db.execute(
            select(MoodEntry)
            .where(MoodEntry.user_id == user_id)
            .order_by(MoodEntry.created_at.asc())
        )
        all_entries = list(all_result.scalars().all())

        total_entries = len(all_entries)
        average_mood = (
            round(sum(e.mood_level for e in all_entries) / total_entries, 1)
            if total_entries
            else None
        )

        # Streak
        entry_dates = sorted({e.created_at.date() for e in all_entries})
        current_streak, longest_streak = self._calculate_streak(all_entries)

        # Most common mood
        if all_entries:
            counts = Counter(e.mood_level for e in all_entries)
            most_common_mood = counts.most_common(1)[0][0]
        else:
            most_common_mood = None

        # This week (Monday to now)
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        entries_this_week = sum(
            1 for e in all_entries if e.created_at.date() >= week_start
        )
        entries_this_month = sum(
            1 for e in all_entries if e.created_at.date() >= month_start
        )

        # Mood distribution
        mood_distribution = {i: 0 for i in range(1, 6)}
        for e in all_entries:
            mood_distribution[e.mood_level] += 1

        # Weekly averages — last 12 weeks
        weekly_averages = _calc_weekly_averages(all_entries, weeks=12)

        return MoodStats(
            total_entries=total_entries,
            average_mood=average_mood,
            current_streak=current_streak,
            longest_streak=longest_streak,
            most_common_mood=most_common_mood,
            entries_this_week=entries_this_week,
            entries_this_month=entries_this_month,
            mood_distribution=mood_distribution,
            weekly_averages=weekly_averages,
        )

    async def get_daily_trends(
        self, db: AsyncSession, user_id: UUID, days: int = 90
    ) -> list[MoodTrend]:
        """Get daily mood averages for chart display. Fills in missing dates."""
        entries = await self.get_entries(db, user_id, days=days)
        by_date: dict[date, list[int]] = {}
        for e in entries:
            d = e.created_at.date()
            by_date.setdefault(d, []).append(e.mood_level)

        today = date.today()
        start = today - timedelta(days=days - 1)
        trends: list[MoodTrend] = []
        current = start
        while current <= today:
            levels = by_date.get(current)
            if levels:
                trends.append(
                    MoodTrend(
                        date=current.isoformat(),
                        average_mood=round(sum(levels) / len(levels), 1),
                        entry_count=len(levels),
                    )
                )
            else:
                trends.append(
                    MoodTrend(date=current.isoformat(), average_mood=0.0, entry_count=0)
                )
            current += timedelta(days=1)
        return trends

    async def get_calendar_data(
        self, db: AsyncSession, user_id: UUID, year: int, month: int
    ) -> list[MoodDayAggregate]:
        """Get mood data organized by day for calendar heatmap."""
        from calendar import monthrange

        _, days_in_month = monthrange(year, month)
        start = date(year, month, 1)
        end = date(year, month, days_in_month)
        entries = await self.get_entries(db, user_id, start_date=start, end_date=end)

        by_date: dict[date, list[MoodEntry]] = {}
        for e in entries:
            d = e.created_at.date()
            by_date.setdefault(d, []).append(e)

        result: list[MoodDayAggregate] = []
        current = start
        while current <= end:
            day_entries = by_date.get(current, [])
            levels = [e.mood_level for e in day_entries]
            result.append(
                MoodDayAggregate(
                    date=current.isoformat(),
                    average_mood=round(sum(levels) / len(levels), 1) if levels else 0.0,
                    entry_count=len(day_entries),
                    entries=[MoodEntryResponse.model_validate(e) for e in day_entries],
                )
            )
            current += timedelta(days=1)
        return result

    async def get_full_history(
        self, db: AsyncSession, user_id: UUID, days: int = 90
    ) -> MoodHistoryResponse:
        """Get everything the frontend needs in one call."""
        today = date.today()
        entries = await self.get_entries(db, user_id, days=days)
        stats = await self.get_stats(db, user_id)
        daily_trends = await self.get_daily_trends(db, user_id, days=days)
        calendar_data = await self.get_calendar_data(db, user_id, today.year, today.month)

        return MoodHistoryResponse(
            entries=[MoodEntryResponse.model_validate(e) for e in entries],
            stats=stats,
            daily_trends=daily_trends,
            calendar_data=calendar_data,
        )

    async def delete_entry(self, db: AsyncSession, user_id: UUID, entry_id: UUID) -> None:
        """Delete a mood entry. Raises ValueError if not found or not owned."""
        result = await db.execute(
            select(MoodEntry).where(
                MoodEntry.entry_id == entry_id,
                MoodEntry.user_id == user_id,
            )
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            raise ValueError("Mood entry not found")
        await db.delete(entry)
        await db.commit()

    def _calculate_streak(self, entries: list[MoodEntry]) -> tuple[int, int]:
        """Calculate (current_streak, longest_streak)."""
        if not entries:
            return 0, 0

        sorted_dates = sorted({e.created_at.date() for e in entries})
        current_streak = _calc_current_streak(sorted_dates)

        # Longest streak: walk through sorted unique dates
        longest = 1
        run = 1
        for i in range(1, len(sorted_dates)):
            if sorted_dates[i] - sorted_dates[i - 1] == timedelta(days=1):
                run += 1
                longest = max(longest, run)
            else:
                run = 1

        return current_streak, max(longest, current_streak)


async def auto_log_mood_from_text(
    user_id: UUID, text: str, source: str = "chat_auto"
) -> None:
    """Detect mood from text via Gemini and log it if the user has no entry today.
    Safe to fire-and-forget — never raises.
    """
    if not text or not text.strip():
        return
    try:
        async with async_session_maker() as db:
            today_entries = await mood_service.get_today_entries(db, user_id)
            if today_entries:
                return
            from app.services.ai_client import AIClient
            level = await AIClient().detect_mood(text)
            if level is None:
                return
            entry = MoodEntry(
                user_id=user_id,
                mood_level=level,
                note=f"Auto-detected from {source.replace('_', ' ')}",
                entry_source=source,
            )
            db.add(entry)
            await db.commit()
            logger.info("Auto-logged mood %d for user %s (source=%s)", level, user_id, source)
    except Exception as exc:
        logger.warning("auto_log_mood_from_text failed: %s", exc)


async def _background_index_mood_note(
    *, user_id, entry_id, text: str, mood_level: int, entry_source: str,
) -> None:
    if not text or not text.strip():
        return
    try:
        async with async_session_maker() as db:
            await memory_service.index(
                db,
                user_id=user_id,
                source_kind="mood_note",
                source_id=entry_id,
                text=text,
                attrs={"mood_level": mood_level, "entry_source": entry_source},
            )
            await db.commit()
    except Exception as exc:
        logger.warning("index mood_note failed: %s", exc)


def _calc_weekly_averages(entries: list[MoodEntry], weeks: int = 12) -> list[dict]:
    """Compute average mood per ISO week for the last N weeks."""
    today = date.today()
    by_week: dict[str, list[int]] = {}

    for e in entries:
        d = e.created_at.date()
        iso = d.isocalendar()
        week_key = f"{iso.year}-W{iso.week:02d}"
        by_week.setdefault(week_key, []).append(e.mood_level)

    # Build ordered list of last N weeks
    result = []
    current = today
    seen: set[str] = set()
    for _ in range(weeks):
        iso = current.isocalendar()
        week_key = f"{iso.year}-W{iso.week:02d}"
        if week_key not in seen:
            seen.add(week_key)
            levels = by_week.get(week_key, [])
            result.append(
                {
                    "week": week_key,
                    "average": round(sum(levels) / len(levels), 1) if levels else 0.0,
                }
            )
        current -= timedelta(days=7)

    return list(reversed(result))


mood_service = MoodService()
