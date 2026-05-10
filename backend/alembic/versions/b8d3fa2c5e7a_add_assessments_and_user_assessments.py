"""add assessments and user_assessments

Revision ID: b8d3fa2c5e7a
Revises: a7c2f9d4e1b5
Create Date: 2026-05-04 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b8d3fa2c5e7a"
down_revision: Union[str, None] = "a7c2f9d4e1b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assessments",
        sa.Column(
            "assessment_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_am", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("description_am", sa.Text(), nullable=True),
        sa.Column("assessment_type", sa.String(length=50), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False),
        sa.Column("estimated_time", sa.String(length=20), nullable=True),
        sa.Column("questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "scoring_logic", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("assessment_id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "user_assessments",
        sa.Column(
            "user_assessment_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("assessment_id", sa.UUID(), nullable=False),
        sa.Column("responses", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("feedback_level", sa.String(length=50), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.assessment_id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("user_assessment_id"),
    )
    op.create_index(
        op.f("ix_user_assessments_user_id"),
        "user_assessments",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_user_assessments_user_id"), table_name="user_assessments"
    )
    op.drop_table("user_assessments")
    op.drop_table("assessments")
