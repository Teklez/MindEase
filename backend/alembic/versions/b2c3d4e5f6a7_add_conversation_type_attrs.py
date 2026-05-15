"""add conversation_type and attrs to conversations

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column(
            "conversation_type",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'text'"),
        ),
    )
    op.add_column(
        "conversations",
        sa.Column("attrs", postgresql.JSONB, nullable=True),
    )
    op.create_index(
        "conversations_user_type_last_msg_idx",
        "conversations",
        ["user_id", "conversation_type", sa.text("last_message_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("conversations_user_type_last_msg_idx", table_name="conversations")
    op.drop_column("conversations", "attrs")
    op.drop_column("conversations", "conversation_type")
