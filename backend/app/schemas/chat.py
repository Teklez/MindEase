import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    message_id: uuid.UUID
    conversation_id: uuid.UUID
    sender_type: str
    content: str
    detected_emotion: str | None
    timestamp: datetime
    is_crisis_flagged: bool

    model_config = ConfigDict(from_attributes=True)


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationUpdate(BaseModel):
    title: str | None = None


class ConversationResponse(BaseModel):
    conversation_id: uuid.UUID
    user_id: uuid.UUID
    title: str | None
    started_at: datetime
    last_message_at: datetime
    status: str
    total_messages: int
    crisis_detected: bool

    model_config = ConfigDict(from_attributes=True)


class ConversationWithMessages(ConversationResponse):
    messages: list[MessageResponse]

    model_config = ConfigDict(from_attributes=True)
