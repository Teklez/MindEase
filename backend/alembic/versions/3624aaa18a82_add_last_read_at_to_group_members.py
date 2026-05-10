"""add last_read_at to group_members

Revision ID: 3624aaa18a82
Revises: f56bf0ef7c81
Create Date: 2026-05-10 08:42:08.304417

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3624aaa18a82'
down_revision: Union[str, None] = 'f56bf0ef7c81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'group_members',
        sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill: existing members shouldn't see their entire history as unread.
    # Treat the moment they joined as their "last read" baseline.
    op.execute("UPDATE group_members SET last_read_at = joined_at WHERE last_read_at IS NULL")


def downgrade() -> None:
    op.drop_column('group_members', 'last_read_at')
