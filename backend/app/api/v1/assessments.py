from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.assessment import (
    AssessmentHistoryResponse,
    AssessmentListItem,
    AssessmentResponse,
    AssessmentResultResponse,
    SubmitAssessmentRequest,
)
from app.services.assessment_service import AssessmentService

router = APIRouter()
_assessments = AssessmentService()


@router.get("", response_model=list[AssessmentListItem])
async def list_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AssessmentListItem]:
    return await _assessments.get_all(db, current_user.user_id)


@router.get("/history", response_model=AssessmentHistoryResponse)
async def get_history(
    assessment_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentHistoryResponse:
    return await _assessments.get_history(
        db, current_user.user_id, assessment_type=assessment_type
    )


@router.get("/results/{user_assessment_id}", response_model=AssessmentResultResponse)
async def get_result(
    user_assessment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResultResponse:
    result = await _assessments.get_result(
        db, user_assessment_id, current_user.user_id
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Assessment result not found")
    return result


@router.get("/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment(
    assessment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    assessment = await _assessments.get_by_id(db, assessment_id)
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return AssessmentResponse.model_validate(assessment)


@router.post(
    "/{assessment_id}/submit",
    response_model=AssessmentResultResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_assessment(
    assessment_id: UUID,
    body: SubmitAssessmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResultResponse:
    try:
        return await _assessments.submit(db, current_user.user_id, assessment_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
