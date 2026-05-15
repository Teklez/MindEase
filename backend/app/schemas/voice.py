import uuid

from pydantic import BaseModel, ConfigDict, Field


class VoiceConversationCreate(BaseModel):
    persona_id: str = Field(..., min_length=1, max_length=64)
    persona_name: str = Field(..., min_length=1, max_length=64)
    persona_blurb: str = Field("", max_length=512)
    voice: str = Field(..., min_length=1, max_length=32)
    conversation_id: uuid.UUID | None = None  # set when continuing an existing voice call


class VoiceConversationResponse(BaseModel):
    conversation_id: uuid.UUID
    persona_id: str
    persona_name: str
    voice: str
    started_at: str
    is_continuation: bool

    model_config = ConfigDict(from_attributes=False)
