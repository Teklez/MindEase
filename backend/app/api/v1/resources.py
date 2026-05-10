from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.resource import (
    ResourceListResponse,
    ResourceRecommendation,
    ResourceResponse,
)
from app.services.resource_service import ResourceService

router = APIRouter()
_resources = ResourceService()


@router.get("", response_model=ResourceListResponse)
async def list_resources(
    category: str | None = Query(None),
    type: str | None = Query(None),
    favorites_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResourceListResponse:
    items = await _resources.get_all(
        db,
        current_user.user_id,
        category=category,
        resource_type=type,
        favorites_only=favorites_only,
    )
    categories = await _resources.get_categories(db)
    return ResourceListResponse(
        resources=items,
        categories=[c["name"] for c in categories],
        total=len(items),
    )


@router.get("/categories")
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await _resources.get_categories(db)


@router.get("/recommendations", response_model=list[ResourceRecommendation])
async def get_recommendations(
    limit: int = Query(3, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ResourceRecommendation]:
    return await _resources.get_recommendations(db, current_user.user_id, limit=limit)


@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    resource_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResourceResponse:
    resource = await _resources.get_by_id(db, resource_id, current_user.user_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")
    await _resources.track_view(db, current_user.user_id, resource_id)
    resource.is_viewed = True
    return resource


@router.post("/{resource_id}/view", status_code=status.HTTP_200_OK)
async def track_view(
    resource_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    resource = await _resources.get_by_id(db, resource_id, current_user.user_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")
    new_badges = await _resources.track_view(db, current_user.user_id, resource_id)
    return {"ok": True, "new_badges": new_badges}


@router.post("/{resource_id}/favorite")
async def toggle_favorite(
    resource_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    resource = await _resources.get_by_id(db, resource_id, current_user.user_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")
    is_favorite = await _resources.toggle_favorite(
        db, current_user.user_id, resource_id
    )
    return {"is_favorite": is_favorite}
