"""messages cascade on conversation delete

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-15 00:00:00.000000

Restores ondelete="CASCADE" on the messages.conversation_id FK so that
hard-deleting a conversation also removes all its messages at the DB level.
This was the original intent in e1f3f93be43d but was lost when d31cbd36eac0
dropped and re-created the constraint without specifying ondelete.
"""
from alembic import op


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("messages_conversation_id_fkey", "messages", type_="foreignkey")
    op.create_foreign_key(
        "messages_conversation_id_fkey",
        "messages",
        "conversations",
        ["conversation_id"],
        ["conversation_id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("messages_conversation_id_fkey", "messages", type_="foreignkey")
    op.create_foreign_key(
        "messages_conversation_id_fkey",
        "messages",
        "conversations",
        ["conversation_id"],
        ["conversation_id"],
    )
