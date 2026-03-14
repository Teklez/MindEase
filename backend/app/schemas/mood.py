from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MoodEntryCreate(BaseModel):
    mood_level: int = Field(ge=1, le=5)
    note: str | None = Field(None, max_length=280)


class MoodEntryResponse(BaseModel):
    entry_id: UUID
    user_id: UUID
    mood_level: int
    note: str | None
    entry_source: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MoodDayAggregate(BaseModel):
    date: str  # "2026-01-15"
    average_mood: float
    entry_count: int
    entries: list[MoodEntryResponse]


class MoodStats(BaseModel):
    total_entries: int
    average_mood: float | None
    current_streak: int  # consecutive days with at least 1 entry
    longest_streak: int
    most_common_mood: int | None
    entries_this_week: int
    entries_this_month: int
    mood_distribution: dict  # {1: count, 2: count, 3: count, 4: count, 5: count}
    weekly_averages: list[dict]  # [{"week": "2026-W03", "average": 3.5}, ...]


class MoodTrend(BaseModel):
    date: str
    average_mood: float
    entry_count: int


class MoodHistoryResponse(BaseModel):
    entries: list[MoodEntryResponse]
    stats: MoodStats
    daily_trends: list[MoodTrend]  # for line chart
    calendar_data: list[MoodDayAggregate]  # for heatmap


class BadgeResponse(BaseModel):
    badge_id: UUID
    name: str
    name_am: str | None
    description: str
    description_am: str | None
    icon: str
    earned_at: datetime | None  # None if not earned yet
    is_earned: bool
    model_config = ConfigDict(from_attributes=True)
