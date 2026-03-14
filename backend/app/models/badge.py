import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Badge(Base):
    __tablename__ = "badges"

    badge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name_am: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    description_am: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)
    criteria_type: Mapped[str] = mapped_column(String(50), nullable=False)
    criteria_value: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )


class UserBadge(Base):
    __tablename__ = "user_badges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=False,
        index=True,
    )
    badge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("badges.badge_id"),
        nullable=False,
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user = relationship("User", backref="user_badges")
    badge = relationship("Badge")

    __table_args__ = (UniqueConstraint("user_id", "badge_id"),)
