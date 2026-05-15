import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.memory import (
    MemoryChunkResponse,
    MemoryDeleteAllResponse,
    MemoryListResponse,
)
from app.services.memory_service import memory_service

router = APIRouter()


@router.get("/memory", response_model=MemoryListResponse)
async def list_memory(
    kind: Annotated[
        list[str] | None,
        Query(description="Filter by source_kind (repeat for OR-filter)"),
    ] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemoryListResponse:
    """Paginated list of the current user's memory chunks, newest first."""
    rows, total = await memory_service.list_for_user(
        db,
        user_id=current_user.user_id,
        kinds=kind or None,
        limit=limit,
        offset=offset,
    )
    return MemoryListResponse(
        items=[MemoryChunkResponse.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete(
    "/memory/{chunk_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_memory(
    chunk_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete one of the current user's memory chunks."""
    ok = await memory_service.delete(
        db, user_id=current_user.user_id, chunk_id=chunk_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not found"
        )
    return None


@router.delete("/memory", response_model=MemoryDeleteAllResponse)
async def delete_all_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemoryDeleteAllResponse:
    """Delete every memory chunk owned by the current user."""
    n = await memory_service.delete_all_for_user(
        db, user_id=current_user.user_id
    )
    return MemoryDeleteAllResponse(deleted=n)
