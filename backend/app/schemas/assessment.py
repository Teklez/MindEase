from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AssessmentResponse(BaseModel):
    assessment_id: UUID
    name: str
    name_am: str | None
    description: str
    description_am: str | None
    assessment_type: str
    icon: str
    estimated_time: str | None
    questions: list[dict]
    scoring_logic: dict
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class AssessmentListItem(BaseModel):
    """Lightweight version for listing — no questions/scoring."""

    assessment_id: UUID
    name: str
    name_am: str | None
    description: str
    description_am: str | None
    assessment_type: str
    icon: str
    estimated_time: str | None
    question_count: int
    last_taken: datetime | None
    times_taken: int


class SubmitAssessmentRequest(BaseModel):
    responses: list[dict]


class AssessmentResultResponse(BaseModel):
    user_assessment_id: UUID
    assessment_name: str
    assessment_type: str
    score: int
    max_score: int
    feedback_level: str
    feedback_text: str
    feedback_text_am: str | None
    color: str
    recommended_avatar: str | None
    recommended_resources: list[dict]
    completed_at: datetime
    responses: list[dict]
    crisis_detected: bool = False
    crisis_resources: dict | None = None
    new_badges: list[dict] = []


class AssessmentHistoryItem(BaseModel):
    user_assessment_id: UUID
    assessment_id: UUID
    assessment_name: str
    assessment_type: str
    icon: str
    score: int
    max_score: int
    feedback_level: str
    color: str
    completed_at: datetime


class AssessmentHistoryResponse(BaseModel):
    history: list[AssessmentHistoryItem]
    total: int
    score_trends: dict
