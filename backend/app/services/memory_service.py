from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory_chunk import MemoryChunk
from app.services.ai_client import AIClient

logger = logging.getLogger(__name__)


@dataclass
class IndexItem:
    user_id: uuid.UUID
    source_kind: str
    text: str
    source_id: uuid.UUID | None = None
    conversation_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    attrs: dict[str, Any] | None = None
    embedding: list[float] | None = None


class MemoryService:
    def __init__(self) -> None:
        self.ai_client = AIClient()

    async def index(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        source_kind: str,
        text: str,
        source_id: uuid.UUID | None = None,
        conversation_id: uuid.UUID | None = None,
        group_id: uuid.UUID | None = None,
        attrs: dict[str, Any] | None = None,
        embedding: list[float] | None = None,
    ) -> MemoryChunk:
        """Index a single chunk. If `embedding` is provided, no /embed call is made.
        Caller is responsible for the surrounding commit boundary.
        On the unique (source_kind, source_id) collision, returns the existing row.
        """
        if not text or not text.strip():
            raise ValueError("text must be non-empty")
        if embedding is None:
            vectors = await self.ai_client.embed([text])
            if not vectors:
                raise RuntimeError("embed returned no vectors")
            embedding = vectors[0]

        chunk = MemoryChunk(
            user_id=user_id,
            source_kind=source_kind,
            source_id=source_id,
            conversation_id=conversation_id,
            group_id=group_id,
            text=text,
            embedding=embedding,
            attrs=attrs,
        )
        db.add(chunk)
        try:
            await db.flush()
        except Exception:
            await db.rollback()
            if source_id is not None:
                result = await db.execute(
                    select(MemoryChunk).where(
                        MemoryChunk.source_kind == source_kind,
                        MemoryChunk.source_id == source_id,
                    )
                )
                existing = result.scalar_one_or_none()
                if existing is not None:
                    return existing
            raise
        return chunk

    async def index_many(
        self, db: AsyncSession, items: Sequence[IndexItem],
    ) -> int:
        """Batch-embed and insert N items. Used by the backfill script.
        Returns the number of rows actually inserted (collisions on
        (source_kind, source_id) are silently skipped).
        """
        items = list(items)
        if not items:
            return 0
        to_embed = [it for it in items if it.embedding is None]
        if to_embed:
            vectors = await self.ai_client.embed([it.text for it in to_embed])
            if len(vectors) != len(to_embed):
                raise RuntimeError(
                    f"embed returned {len(vectors)} vectors for {len(to_embed)} texts"
                )
            for it, vec in zip(to_embed, vectors):
                it.embedding = vec

        inserted = 0
        for it in items:
            try:
                await self.index(
                    db,
                    user_id=it.user_id,
                    source_kind=it.source_kind,
                    text=it.text,
                    source_id=it.source_id,
                    conversation_id=it.conversation_id,
                    group_id=it.group_id,
                    attrs=it.attrs,
                    embedding=it.embedding,
                )
                inserted += 1
            except Exception as exc:
                logger.warning(
                    "skip chunk source_kind=%s source_id=%s: %s",
                    it.source_kind, it.source_id, exc,
                )
        return inserted

    async def retrieve(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        query_text: str | None = None,
        query_vec: list[float] | None = None,
        k: int = 6,
        kinds: list[str] | None = None,
        exclude_conversation_id: uuid.UUID | None = None,
        since: datetime | None = None,
    ) -> list[MemoryChunk]:
        """Cosine-similarity top-k retrieval scoped to `user_id`.

        Provide either `query_text` (will be embedded inline) or `query_vec`
        (precomputed — preferred when the caller already embedded the text).
        """
        if query_vec is None:
            if not query_text:
                return []
            vectors = await self.ai_client.embed([query_text])
            if not vectors:
                return []
            query_vec = vectors[0]

        stmt = select(MemoryChunk).where(MemoryChunk.user_id == user_id)
        if kinds:
            stmt = stmt.where(MemoryChunk.source_kind.in_(kinds))
        if exclude_conversation_id is not None:
            stmt = stmt.where(
                (MemoryChunk.conversation_id != exclude_conversation_id)
                | (MemoryChunk.conversation_id.is_(None))
            )
        if since is not None:
            stmt = stmt.where(MemoryChunk.created_at >= since)
        stmt = stmt.order_by(MemoryChunk.embedding.cosine_distance(query_vec)).limit(k)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def list_for_user(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        kinds: list[str] | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[MemoryChunk], int]:
        """Paginated list of a user's chunks, newest first. Returns (rows, total)."""
        base = select(MemoryChunk).where(MemoryChunk.user_id == user_id)
        if kinds:
            base = base.where(MemoryChunk.source_kind.in_(kinds))

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        rows = (
            await db.execute(
                base.order_by(MemoryChunk.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return list(rows), int(total)

    async def delete(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        chunk_id: uuid.UUID,
    ) -> bool:
        """Delete one chunk, scoped to user_id. Returns True if a row was deleted.
        Caller manages the surrounding commit boundary."""
        result = await db.execute(
            delete(MemoryChunk).where(
                MemoryChunk.chunk_id == chunk_id,
                MemoryChunk.user_id == user_id,
            )
        )
        await db.flush()
        return bool(result.rowcount)

    async def delete_all_for_user(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
    ) -> int:
        """Delete every chunk owned by user_id. Returns row count.
        Caller manages the surrounding commit boundary."""
        result = await db.execute(
            delete(MemoryChunk).where(MemoryChunk.user_id == user_id)
        )
        await db.flush()
        return int(result.rowcount or 0)


memory_service = MemoryService()
