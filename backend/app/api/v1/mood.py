from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.mood import (
    BadgeResponse,
    MoodDayAggregate,
    MoodEntryCreate,
    MoodEntryResponse,
    MoodHistoryResponse,
    MoodStats,
    MoodTrend,
)
from app.services.badge_service import BadgeService
from app.services.mood_service import MoodService

router = APIRouter()
_mood = MoodService()
_badges = BadgeService()


@router.post("/entries", status_code=status.HTTP_201_CREATED)
async def create_entry(
    body: MoodEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    entry, new_badges = await _mood.create_entry(db, current_user.user_id, body)
    return {"entry": entry, "new_badges": new_badges}


@router.get("/entries", response_model=list[MoodEntryResponse])
async def get_entries(
    days: int = Query(30, ge=1),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MoodEntryResponse]:
    entries = await _mood.get_entries(
        db, current_user.user_id, days=days, start_date=start_date, end_date=end_date
    )
    return [MoodEntryResponse.model_validate(e) for e in entries]


@router.get("/entries/today", response_model=list[MoodEntryResponse])
async def get_today_entries(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MoodEntryResponse]:
    entries = await _mood.get_today_entries(db, current_user.user_id)
    return [MoodEntryResponse.model_validate(e) for e in entries]


@router.get("/stats", response_model=MoodStats)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodStats:
    return await _mood.get_stats(db, current_user.user_id)


@router.get("/history", response_model=MoodHistoryResponse)
async def get_history(
    days: int = Query(90, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodHistoryResponse:
    return await _mood.get_full_history(db, current_user.user_id, days=days)


@router.get("/trends", response_model=list[MoodTrend])
async def get_trends(
    days: int = Query(90, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MoodTrend]:
    return await _mood.get_daily_trends(db, current_user.user_id, days=days)


@router.get("/calendar/{year}/{month}", response_model=list[MoodDayAggregate])
async def get_calendar(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MoodDayAggregate]:
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be between 1 and 12")
    return await _mood.get_calendar_data(db, current_user.user_id, year, month)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await _mood.delete_entry(db, current_user.user_id, entry_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/badges", response_model=list[BadgeResponse])
async def get_badges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BadgeResponse]:
    return await _badges.get_user_badges(db, current_user.user_id)
