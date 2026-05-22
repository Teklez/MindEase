"""On-demand data export endpoints. All routes require a registered (non-guest)
account; guests get a 403 from ``get_registered_user``.

PDF assembly is offloaded to a worker thread inside the service so the event
loop stays responsive while reportlab walks the story.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_registered_user
from app.database import get_db
from app.models.user import User
from app.services.export_service import export_service

router = APIRouter()

Format = Literal["csv", "pdf"]


def _today_str() -> str:
    return date.today().isoformat()


def _stream(payload: bytes, media_type: str, filename: str) -> StreamingResponse:
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(iter([payload]), media_type=media_type, headers=headers)


@router.get("/mood")
async def export_mood(
    format: Format = Query("csv"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_registered_user),
) -> StreamingResponse:
    if format == "csv":
        body = await export_service.export_mood_csv(db, current_user.user_id)
        return _stream(
            body.encode("utf-8"),
            "text/csv; charset=utf-8",
            f"mindease-mood-{_today_str()}.csv",
        )
    pdf = await export_service.export_mood_pdf(db, current_user.user_id, current_user)
    return _stream(pdf, "application/pdf", f"mindease-mood-{_today_str()}.pdf")


@router.get("/chat")
async def export_chat(
    format: Format = Query("csv"),
    conversation_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_registered_user),
) -> StreamingResponse:
    suffix = (
        f"chat-{str(conversation_id)[:8]}" if conversation_id else "chat"
    )
    filename_stem = f"mindease-{suffix}-{_today_str()}"
    if format == "csv":
        body = await export_service.export_chat_csv(
            db, current_user.user_id, conversation_id
        )
        return _stream(
            body.encode("utf-8"),
            "text/csv; charset=utf-8",
            f"{filename_stem}.csv",
        )
    pdf = await export_service.export_chat_pdf(
        db, current_user.user_id, current_user, conversation_id
    )
    return _stream(pdf, "application/pdf", f"{filename_stem}.pdf")


@router.get("/assessments")
async def export_assessments(
    format: Format = Query("csv"),
    user_assessment_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_registered_user),
) -> StreamingResponse:
    suffix = (
        f"assessment-{str(user_assessment_id)[:8]}"
        if user_assessment_id
        else "assessments"
    )
    filename_stem = f"mindease-{suffix}-{_today_str()}"
    if format == "csv":
        body = await export_service.export_assessments_csv(
            db, current_user.user_id, user_assessment_id
        )
        return _stream(
            body.encode("utf-8"),
            "text/csv; charset=utf-8",
            f"{filename_stem}.csv",
        )
    pdf = await export_service.export_assessments_pdf(
        db, current_user.user_id, current_user, user_assessment_id
    )
    return _stream(pdf, "application/pdf", f"{filename_stem}.pdf")


@router.get("/all")
async def export_all(
    format: Literal["pdf"] = Query("pdf"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_registered_user),
) -> StreamingResponse:
    if format != "pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF is supported for the combined export",
        )
    pdf = await export_service.export_all_pdf(db, current_user.user_id, current_user)
    return _stream(
        pdf, "application/pdf", f"mindease-export-{_today_str()}.pdf"
    )
