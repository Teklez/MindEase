from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MemoryChunkResponse(BaseModel):
    """Memory chunk as returned to the client. Never includes the embedding."""

    model_config = ConfigDict(from_attributes=True)

    chunk_id: UUID
    source_kind: str
    text: str
    conversation_id: UUID | None = None
    group_id: UUID | None = None
    attrs: dict[str, Any] | None = None
    created_at: datetime


class MemoryListResponse(BaseModel):
    items: list[MemoryChunkResponse]
    total: int
    limit: int
    offset: int


class MemoryDeleteAllResponse(BaseModel):
    deleted: int
