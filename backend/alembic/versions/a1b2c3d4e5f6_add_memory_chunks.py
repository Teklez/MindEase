"""add memory_chunks

Revision ID: a1b2c3d4e5f6
Revises: 3624aaa18a82
Create Date: 2026-05-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "3624aaa18a82"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "memory_chunks",
        sa.Column(
            "chunk_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_kind", sa.String(32), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("embedding", Vector(768), nullable=False),
        sa.Column("attrs", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.execute(
        "CREATE INDEX memory_chunks_embedding_idx "
        "ON memory_chunks USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )

    op.create_index(
        "memory_chunks_user_kind_created_idx",
        "memory_chunks",
        ["user_id", "source_kind", sa.text("created_at DESC")],
    )
    op.create_index(
        "memory_chunks_user_conv_idx",
        "memory_chunks",
        ["user_id", "conversation_id"],
    )
    op.create_index(
        "memory_chunks_source_unique_idx",
        "memory_chunks",
        ["source_kind", "source_id"],
        unique=True,
        postgresql_where=sa.text("source_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("memory_chunks_source_unique_idx", table_name="memory_chunks")
    op.drop_index("memory_chunks_user_conv_idx", table_name="memory_chunks")
    op.drop_index("memory_chunks_user_kind_created_idx", table_name="memory_chunks")
    op.execute("DROP INDEX IF EXISTS memory_chunks_embedding_idx")
    op.drop_table("memory_chunks")
