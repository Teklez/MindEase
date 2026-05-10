from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_CATEGORIES = {
    "autism",
    "anxiety",
    "depression",
    "ptsd",
    "student_stress",
    "grief",
    "addiction_recovery",
    "mindfulness",
    "general",
}


class GroupCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    name_am: str | None = None
    description: str = Field(min_length=10, max_length=1000)
    description_am: str | None = None
    category: str
    icon: str = "💬"
    is_public: bool = True
    max_members: int = Field(default=50, ge=5, le=200)
    rules: str | None = None
    rules_am: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in ALLOWED_CATEGORIES:
            raise ValueError(
                f"category must be one of {sorted(ALLOWED_CATEGORIES)}"
            )
        return v


class GroupUpdate(BaseModel):
    name: str | None = None
    name_am: str | None = None
    description: str | None = None
    description_am: str | None = None
    icon: str | None = None
    rules: str | None = None
    rules_am: str | None = None
    max_members: int | None = Field(default=None, ge=5, le=200)


class GroupResponse(BaseModel):
    group_id: UUID
    name: str
    name_am: str | None
    description: str
    description_am: str | None
    category: str
    icon: str
    cover_color: str | None
    created_by: UUID
    creator_name: str
    is_public: bool
    max_members: int
    member_count: int
    is_member: bool
    my_role: str | None
    rules: str | None
    rules_am: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GroupListItem(BaseModel):
    group_id: UUID
    name: str
    name_am: str | None
    description: str
    description_am: str | None
    category: str
    icon: str
    cover_color: str | None
    member_count: int
    is_member: bool
    is_public: bool
    last_activity: datetime | None
    has_unread: bool = False


class GroupUnreadSummary(BaseModel):
    has_unread: bool
    unread_group_count: int


class GroupMemberResponse(BaseModel):
    user_id: UUID
    display_name: str
    role: str
    joined_at: datetime
    is_muted: bool


class GroupMessageResponse(BaseModel):
    message_id: UUID
    group_id: UUID
    user_id: UUID | None
    sender_type: str
    sender_name: str | None
    content: str
    is_crisis_flagged: bool
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


class GroupMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
