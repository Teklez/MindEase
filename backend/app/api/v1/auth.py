from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_current_user
from app.database import get_db
from app.models import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()


class GoogleTokenBody(BaseModel):
    token: str


class GuestUpgradeBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await AuthService.register(db, user_data)
    access_token = create_access_token(data={"sub": str(user.user_id)})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# TODO: Add rate limiting (e.g. with slowapi) to prevent brute-force attempts
@router.post("/login", response_model=TokenResponse)
async def login(
    body: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await AuthService.login(db, body.email, body.password)


@router.post("/google", response_model=TokenResponse)
async def google(
    body: GoogleTokenBody,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await AuthService.google_oauth(db, body.token)


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post(
    "/guest",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def guest(db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await AuthService.register_guest(db)
    access_token = create_access_token(data={"sub": str(user.user_id)})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/guest/upgrade", response_model=TokenResponse)
async def guest_upgrade(
    body: GuestUpgradeBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await AuthService.upgrade_guest(
        db, current_user, body.email, body.password, body.display_name
    )
    access_token = create_access_token(data={"sub": str(user.user_id)})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )
