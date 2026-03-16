import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.user import TokenResponse, UserCreate, UserResponse


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
    async def get_me(db: AsyncSession, user_id: uuid.UUID) -> User:
        result = await db.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user
