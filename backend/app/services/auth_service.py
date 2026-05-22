import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.models.assessment import UserAssessment
from app.models.badge import UserBadge
from app.models.conversation import Conversation
from app.models.group import GroupMember, GroupMessage
from app.models.mood_entry import MoodEntry
from app.models.resource import UserResource
from app.schemas.user import TokenResponse, UserCreate, UserResponse

logger = logging.getLogger(__name__)


def _validate_password(password: str) -> None:
    """Raise HTTPException 400 if password does not meet requirements."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter",
        )
    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter",
        )
    if not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number",
        )


class AuthService:
    @staticmethod
    async def register(db: AsyncSession, user_data: UserCreate) -> User:
        result = await db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        _validate_password(user_data.password)
        user = User(
            email=user_data.email,
            password_hash=hash_password(user_data.password),
            display_name=user_data.display_name,
            is_verified=False,
            account_status="active",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def login(db: AsyncSession, email: str, password: str) -> TokenResponse:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if user.password_hash is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if user.account_status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not active",
            )
        now = datetime.now(timezone.utc)
        await db.execute(update(User).where(User.user_id == user.user_id).values(last_login=now))
        await db.flush()
        await db.refresh(user)
        access_token = create_access_token(data={"sub": str(user.user_id)})
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    async def google_oauth(db: AsyncSession, google_token: str) -> TokenResponse:
        settings = get_settings()
        try:
            data = google_id_token.verify_oauth2_token(
                google_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token",
            )
        email = data.get("email")
        name = data.get("name") or email or "User"
        google_sub = data.get("sub")
        if not email or not google_sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token: missing email or sub",
            )
        result = await db.execute(
            select(User).where(
                User.oauth_provider == "google",
                User.oauth_id == google_sub,
            )
        )
        user = result.scalar_one_or_none()
        if user is not None:
            now = datetime.now(timezone.utc)
            await db.execute(update(User).where(User.user_id == user.user_id).values(last_login=now))
            await db.flush()
            await db.refresh(user)
            access_token = create_access_token(data={"sub": str(user.user_id)})
            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                user=UserResponse.model_validate(user),
            )
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing is not None:
            now = datetime.now(timezone.utc)
            await db.execute(
                update(User)
                .where(User.user_id == existing.user_id)
                .values(
                    oauth_provider="google",
                    oauth_id=google_sub,
                    is_verified=True,
                    last_login=now,
                )
            )
            await db.flush()
            await db.refresh(existing)
            user = existing
        else:
            user = User(
                email=email,
                password_hash=None,
                display_name=name,
                oauth_provider="google",
                oauth_id=google_sub,
                is_verified=True,
                account_status="active",
            )
            db.add(user)
            await db.flush()
            await db.refresh(user)
        access_token = create_access_token(data={"sub": str(user.user_id)})
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    async def register_guest(db: AsyncSession) -> User:
        """Create a temporary guest user. All data is wiped by cleanup_guest_users."""
        guest_uuid = uuid.uuid4()
        user = User(
            email=f"guest_{guest_uuid}@mindease.temp",
            password_hash=None,
            display_name="Guest",
            is_verified=False,
            account_status="guest",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def upgrade_guest(
        db: AsyncSession,
        user: User,
        email: str,
        password: str,
        display_name: str,
    ) -> User:
        """Convert a guest row into a regular account in place, preserving user_id."""
        if user.account_status != "guest":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is not a guest",
            )
        result = await db.execute(
            select(User).where(User.email == email, User.user_id != user.user_id)
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        _validate_password(password)
        now = datetime.now(timezone.utc)
        await db.execute(
            update(User)
            .where(User.user_id == user.user_id)
            .values(
                email=email,
                password_hash=hash_password(password),
                display_name=display_name,
                account_status="active",
                last_login=now,
            )
        )
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def cleanup_guest_users(db: AsyncSession) -> int:
        """Delete guest users older than 24h plus all their owned rows.

        Most user-owned tables don't have ON DELETE CASCADE at the DB level, so
        related rows are deleted explicitly. memory_chunks does cascade and
        messages cascade via conversations, so those are handled implicitly."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        result = await db.execute(
            select(User.user_id).where(
                User.account_status == "guest",
                User.created_at < cutoff,
            )
        )
        guest_ids = [row[0] for row in result.all()]
        if not guest_ids:
            return 0
        try:
            await db.execute(
                delete(Conversation).where(Conversation.user_id.in_(guest_ids))
            )
            await db.execute(
                delete(MoodEntry).where(MoodEntry.user_id.in_(guest_ids))
            )
            await db.execute(
                delete(UserAssessment).where(UserAssessment.user_id.in_(guest_ids))
            )
            await db.execute(
                delete(UserResource).where(UserResource.user_id.in_(guest_ids))
            )
            await db.execute(
                delete(UserBadge).where(UserBadge.user_id.in_(guest_ids))
            )
            await db.execute(
                delete(GroupMessage).where(GroupMessage.user_id.in_(guest_ids))
            )
            await db.execute(
                delete(GroupMember).where(GroupMember.user_id.in_(guest_ids))
            )
            await db.execute(delete(User).where(User.user_id.in_(guest_ids)))
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("cleanup_guest_users failed")
            raise
        logger.info("cleanup_guest_users removed %d guest accounts", len(guest_ids))
        return len(guest_ids)

    @staticmethod
    async def get_me(db: AsyncSession, user_id: uuid.UUID) -> User:
        result = await db.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user
