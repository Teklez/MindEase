from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import Assessment, UserAssessment
from app.models.resource import Resource, UserResource
from app.schemas.assessment import (
    AssessmentHistoryItem,
    AssessmentHistoryResponse,
    AssessmentListItem,
    AssessmentResultResponse,
    SubmitAssessmentRequest,
)
from app.schemas.mood import BadgeResponse
from app.services.badge_service import BadgeService

_badge_service = BadgeService()


CRISIS_RESOURCES = {
    "ethiopia": [
        {"name": "Ethiopian Mental Health Support", "phone": "251-111-234-567"},
        {"name": "Emergency Services (Ethiopia)", "phone": "911"},
    ],
    "international": [
        {"name": "Crisis Text Line", "info": "Text HOME to 741741"},
        {
            "name": "International Association for Suicide Prevention",
            "url": "https://www.iasp.info/resources/Crisis_Centres/",
        },
    ],
}


def _classify(score: int, scoring_logic: dict) -> dict:
    """Find the range entry that matches a score."""
    for r in scoring_logic.get("ranges", []):
        if r["min"] <= score <= r["max"]:
            return r
    ranges = scoring_logic.get("ranges", [])
    return ranges[-1] if ranges else {}


def _resource_category_for(assessment_type: str) -> list[str]:
    """Map assessment type to resource categories for recommendations."""
    if assessment_type == "anxiety":
        return ["anxiety", "mindfulness"]
    if assessment_type == "depression":
        return ["depression", "self_esteem", "mindfulness"]
    if assessment_type == "stress":
        return ["stress", "mindfulness", "sleep"]
    return ["mindfulness"]


class AssessmentService:

    async def get_all(
        self, db: AsyncSession, user_id: UUID
    ) -> list[AssessmentListItem]:
        """All active assessments + per-user metadata (last_taken / times_taken)."""
        rows = await db.execute(
            select(Assessment).where(Assessment.is_active.is_(True)).order_by(Assessment.created_at)
        )
        assessments = list(rows.scalars().all())

        meta_rows = await db.execute(
            select(
                UserAssessment.assessment_id,
                func.count(UserAssessment.user_assessment_id),
                func.max(UserAssessment.completed_at),
            )
            .where(UserAssessment.user_id == user_id)
            .group_by(UserAssessment.assessment_id)
        )
        meta = {
            assessment_id: (count, last_taken)
            for assessment_id, count, last_taken in meta_rows.all()
        }

        items: list[AssessmentListItem] = []
        for a in assessments:
            count, last_taken = meta.get(a.assessment_id, (0, None))
            items.append(
                AssessmentListItem(
                    assessment_id=a.assessment_id,
                    name=a.name,
                    name_am=a.name_am,
                    description=a.description,
                    description_am=a.description_am,
                    assessment_type=a.assessment_type,
                    icon=a.icon,
                    estimated_time=a.estimated_time,
                    question_count=len(a.questions or []),
                    last_taken=last_taken,
                    times_taken=count,
                )
            )
        return items

    async def get_by_id(
        self, db: AsyncSession, assessment_id: UUID
    ) -> Assessment | None:
        result = await db.execute(
            select(Assessment).where(
                Assessment.assessment_id == assessment_id,
                Assessment.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def submit(
        self,
        db: AsyncSession,
        user_id: UUID,
        assessment_id: UUID,
        data: SubmitAssessmentRequest,
    ) -> AssessmentResultResponse:
        """Score a submission, persist it, check crisis flags, recommend next steps."""
        assessment = await self.get_by_id(db, assessment_id)
        if assessment is None:
            raise ValueError("Assessment not found")

        responses = data.responses or []
        score = sum(int(r.get("value", 0)) for r in responses)
        scoring = assessment.scoring_logic or {}
        bucket = _classify(score, scoring)
        max_score = int(scoring.get("max_score", score))

        # Crisis detection — only if scoring_logic declares a crisis_question_id.
        crisis_detected = False
        crisis_question_id = scoring.get("crisis_question_id")
        crisis_threshold = scoring.get("crisis_threshold", 1)
        if crisis_question_id is not None:
            for r in responses:
                if int(r.get("question_id", -1)) == int(crisis_question_id):
                    if int(r.get("value", 0)) >= int(crisis_threshold):
                        crisis_detected = True
                    break

        # Persist
        ua = UserAssessment(
            user_id=user_id,
            assessment_id=assessment.assessment_id,
            responses=responses,
            score=score,
            feedback_level=bucket.get("level", "unknown"),
            feedback_text=bucket.get("feedback", ""),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(ua)
        await db.flush()
        await db.refresh(ua)

        # Recommended resources from the library (un-viewed first, capped to 3)
        recommended_resources = await self._recommend_resources(
            db, user_id, assessment.assessment_type
        )

        # Badge check (Self-Aware on first assessment, etc.)
        new_badges = await _badge_service.check_and_award(db, user_id)

        return AssessmentResultResponse(
            user_assessment_id=ua.user_assessment_id,
            assessment_name=assessment.name,
            assessment_type=assessment.assessment_type,
            score=score,
            max_score=max_score,
            feedback_level=bucket.get("level", "unknown"),
            feedback_text=bucket.get("feedback", ""),
            feedback_text_am=bucket.get("feedback_am"),
            color=bucket.get("color", "#94A3B8"),
            recommended_avatar=bucket.get("recommended_avatar"),
            recommended_resources=recommended_resources,
            completed_at=ua.completed_at,
            responses=responses,
            crisis_detected=crisis_detected,
            crisis_resources=CRISIS_RESOURCES if crisis_detected else None,
            new_badges=[b.model_dump() if hasattr(b, "model_dump") else b for b in new_badges],
        )

    async def get_history(
        self,
        db: AsyncSession,
        user_id: UUID,
        assessment_type: str | None = None,
    ) -> AssessmentHistoryResponse:
        stmt = (
            select(UserAssessment, Assessment)
            .join(Assessment, Assessment.assessment_id == UserAssessment.assessment_id)
            .where(UserAssessment.user_id == user_id)
            .order_by(desc(UserAssessment.completed_at))
        )
        if assessment_type:
            stmt = stmt.where(Assessment.assessment_type == assessment_type)
        rows = (await db.execute(stmt)).all()

        history: list[AssessmentHistoryItem] = []
        trends: dict[str, list[dict]] = defaultdict(list)
        for ua, a in rows:
            scoring = a.scoring_logic or {}
            bucket = _classify(ua.score, scoring)
            history.append(
                AssessmentHistoryItem(
                    user_assessment_id=ua.user_assessment_id,
                    assessment_name=a.name,
                    assessment_type=a.assessment_type,
                    icon=a.icon,
                    score=ua.score,
                    max_score=int(scoring.get("max_score", ua.score)),
                    feedback_level=ua.feedback_level,
                    color=bucket.get("color", "#94A3B8"),
                    completed_at=ua.completed_at,
                )
            )
            trends[a.assessment_type].append(
                {
                    "date": ua.completed_at.isoformat(),
                    "score": ua.score,
                }
            )
        # Trends should be oldest → newest for line charts
        for key in trends:
            trends[key].sort(key=lambda x: x["date"])

        return AssessmentHistoryResponse(
            history=history,
            total=len(history),
            score_trends=dict(trends),
        )

    async def get_result(
        self,
        db: AsyncSession,
        user_assessment_id: UUID,
        user_id: UUID,
    ) -> AssessmentResultResponse | None:
        result = await db.execute(
            select(UserAssessment, Assessment)
            .join(Assessment, Assessment.assessment_id == UserAssessment.assessment_id)
            .where(
                UserAssessment.user_assessment_id == user_assessment_id,
                UserAssessment.user_id == user_id,
            )
        )
        row = result.first()
        if row is None:
            return None
        ua, a = row
        scoring = a.scoring_logic or {}
        bucket = _classify(ua.score, scoring)
        max_score = int(scoring.get("max_score", ua.score))

        crisis_detected = False
        crisis_question_id = scoring.get("crisis_question_id")
        crisis_threshold = scoring.get("crisis_threshold", 1)
        if crisis_question_id is not None:
            for r in ua.responses or []:
                if int(r.get("question_id", -1)) == int(crisis_question_id):
                    if int(r.get("value", 0)) >= int(crisis_threshold):
                        crisis_detected = True
                    break

        recommended_resources = await self._recommend_resources(db, user_id, a.assessment_type)

        return AssessmentResultResponse(
            user_assessment_id=ua.user_assessment_id,
            assessment_name=a.name,
            assessment_type=a.assessment_type,
            score=ua.score,
            max_score=max_score,
            feedback_level=ua.feedback_level,
            feedback_text=ua.feedback_text,
            feedback_text_am=bucket.get("feedback_am"),
            color=bucket.get("color", "#94A3B8"),
            recommended_avatar=bucket.get("recommended_avatar"),
            recommended_resources=recommended_resources,
            completed_at=ua.completed_at,
            responses=ua.responses or [],
            crisis_detected=crisis_detected,
            crisis_resources=CRISIS_RESOURCES if crisis_detected else None,
            new_badges=[],
        )

    async def _recommend_resources(
        self, db: AsyncSession, user_id: UUID, assessment_type: str
    ) -> list[dict]:
        """Pick up to 3 active resources matching the assessment_type, preferring un-viewed."""
        categories = _resource_category_for(assessment_type)
        stmt = (
            select(Resource, UserResource)
            .outerjoin(
                UserResource,
                (UserResource.resource_id == Resource.resource_id)
                & (UserResource.user_id == user_id),
            )
            .where(Resource.is_active.is_(True), Resource.category.in_(categories))
        )
        rows = (await db.execute(stmt)).all()
        # Sort un-viewed first, then by category order, then by title
        cat_priority = {c: i for i, c in enumerate(categories)}
        rows.sort(
            key=lambda pair: (
                pair[1] is not None,
                cat_priority.get(pair[0].category, len(categories)),
                pair[0].title,
            )
        )
        out: list[dict] = []
        for resource, _ur in rows[:3]:
            out.append(
                {
                    "resource_id": str(resource.resource_id),
                    "title": resource.title,
                    "title_am": resource.title_am,
                    "resource_type": resource.resource_type,
                    "url": resource.url,
                    "thumbnail_url": resource.thumbnail_url,
                    "category": resource.category,
                    "duration": resource.duration,
                    "reason": f"Helpful for {assessment_type.replace('_', ' ')}",
                }
            )
        return out


# Helper for serializing BadgeResponse safely
def _badge_to_dict(badge: BadgeResponse) -> dict:
    return badge.model_dump()
