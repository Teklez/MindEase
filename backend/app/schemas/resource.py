from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ResourceResponse(BaseModel):
    resource_id: UUID
    title: str
    title_am: str | None
    description: str
    description_am: str | None
    resource_type: str
    url: str
    thumbnail_url: str | None
    category: str
    duration: str | None
    is_favorite: bool = False
    is_viewed: bool = False
    model_config = ConfigDict(from_attributes=True)


class ResourceListResponse(BaseModel):
    resources: list[ResourceResponse]
    categories: list[str]
    total: int


class ResourceRecommendation(BaseModel):
    resource: ResourceResponse
    reason: str
    reason_am: str | None
