from collections import Counter
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.mood_entry import MoodEntry
from app.models.resource import Resource, UserResource
from app.schemas.resource import ResourceRecommendation, ResourceResponse
from app.services.badge_service import BadgeService

_badge_service = BadgeService()


# Keyword → category mapping for chat-topic recommendations.
# Words are matched case-insensitively against recent user message content.
_CHAT_TOPIC_MAP: list[tuple[str, str]] = [
    ("anxious", "anxiety"),
    ("anxiety", "anxiety"),
    ("panic", "anxiety"),
    ("worry", "anxiety"),
    ("worried", "anxiety"),
    ("nervous", "anxiety"),
    ("depressed", "depression"),
    ("depression", "depression"),
    ("hopeless", "depression"),
    ("sad", "depression"),
    ("empty", "depression"),
    ("stress", "stress"),
    ("stressed", "stress"),
    ("overwhelmed", "stress"),
    ("burnout", "stress"),
    ("burned out", "stress"),
    ("sleep", "sleep"),
    ("insomnia", "sleep"),
    ("tired", "sleep"),
    ("can't sleep", "sleep"),
    ("worthless", "self_esteem"),
    ("not good enough", "self_esteem"),
    ("self-esteem", "self_esteem"),
    ("self esteem", "self_esteem"),
    ("confidence", "self_esteem"),
    ("mindful", "mindfulness"),
    ("meditation", "mindfulness"),
    ("breathing", "mindfulness"),
]


class ResourceService:

    async def get_all(
        self,
        db: AsyncSession,
        user_id: UUID,
        category: str | None = None,
        resource_type: str | None = None,
        favorites_only: bool = False,
    ) -> list[ResourceResponse]:
        """All active resources annotated with the current user's view/favorite state.

        Order: favorites first, then by category, then by title for stability.
        """
        join_target = UserResource.user_id == user_id
        stmt = (
            select(Resource, UserResource)
            .outerjoin(
                UserResource,
                (UserResource.resource_id == Resource.resource_id) & (join_target),
            )
            .where(Resource.is_active.is_(True))
        )
        if category:
            stmt = stmt.where(Resource.category == category)
        if resource_type:
            stmt = stmt.where(Resource.resource_type == resource_type)
        if favorites_only:
            stmt = stmt.where(UserResource.is_favorite.is_(True))

        result = await db.execute(stmt)
        rows = result.all()

        items = [self._to_response(r, ur) for r, ur in rows]
        items.sort(key=lambda x: (not x.is_favorite, x.category, x.title))
        return items

    async def get_by_id(
        self, db: AsyncSession, resource_id: UUID, user_id: UUID
    ) -> ResourceResponse | None:
        stmt = (
            select(Resource, UserResource)
            .outerjoin(
                UserResource,
                (UserResource.resource_id == Resource.resource_id)
                & (UserResource.user_id == user_id),
            )
            .where(Resource.resource_id == resource_id, Resource.is_active.is_(True))
        )
        result = await db.execute(stmt)
        row = result.first()
        if row is None:
            return None
        resource, user_resource = row
        return self._to_response(resource, user_resource)

    async def get_categories(self, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(Resource.category, func.count(Resource.resource_id))
            .where(Resource.is_active.is_(True))
            .group_by(Resource.category)
            .order_by(Resource.category)
        )
        return [{"name": cat, "count": count} for cat, count in result.all()]

    async def track_view(
        self, db: AsyncSession, user_id: UUID, resource_id: UUID
    ) -> list:
        """Record a view (idempotent — bumps viewed_at on re-view) and return any
        newly earned badges."""
        now = datetime.now(timezone.utc)
        stmt = (
            pg_insert(UserResource)
            .values(user_id=user_id, resource_id=resource_id, viewed_at=now)
            .on_conflict_do_update(
                index_elements=["user_id", "resource_id"],
                set_={"viewed_at": now},
            )
        )
        await db.execute(stmt)
        await db.commit()
        return await _badge_service.check_and_award(db, user_id)

    async def toggle_favorite(
        self, db: AsyncSession, user_id: UUID, resource_id: UUID
    ) -> bool:
        """Flip the favorite flag for (user, resource). Creates the row if absent."""
        existing = await db.execute(
            select(UserResource).where(
                UserResource.user_id == user_id,
                UserResource.resource_id == resource_id,
            )
        )
        row = existing.scalar_one_or_none()
        if row is None:
            new_row = UserResource(
                user_id=user_id, resource_id=resource_id, is_favorite=True
            )
            db.add(new_row)
            await db.commit()
            return True
        row.is_favorite = not row.is_favorite
        await db.commit()
        return row.is_favorite

    async def get_recommendations(
        self, db: AsyncSession, user_id: UUID, limit: int = 3
    ) -> list[ResourceRecommendation]:
        """Recommend resources based on recent moods and chat topics.

        Strategy:
          1. Inspect mood entries from the last 7 days. Average mood ≤ 2 → depression /
             self_esteem; average ≤ 3 → mindfulness / stress.
          2. Inspect user-content of messages from the last 3 conversations for keyword
             hits mapped to categories.
          3. Build an ordered list of candidate categories with a reason for each.
          4. Pull active resources in those categories, prefer ones the user hasn't
             viewed, dedupe by resource_id, return up to `limit`.
        """
        category_reasons: dict[str, tuple[str, str | None]] = {}

        # 1. Recent mood signal
        since = datetime.now(timezone.utc) - timedelta(days=7)
        mood_result = await db.execute(
            select(MoodEntry.mood_level).where(
                MoodEntry.user_id == user_id, MoodEntry.created_at >= since
            )
        )
        mood_levels = [row[0] for row in mood_result.all()]
        if mood_levels:
            avg = sum(mood_levels) / len(mood_levels)
            if avg <= 2.0:
                category_reasons.setdefault(
                    "depression",
                    ("Based on your recent mood", "በቅርብ ጊዜ ስሜትዎ መሰረት"),
                )
                category_reasons.setdefault(
                    "self_esteem",
                    ("Based on your recent mood", "በቅርብ ጊዜ ስሜትዎ መሰረት"),
                )
            elif avg <= 3.0:
                category_reasons.setdefault(
                    "mindfulness",
                    ("To help you find calm", "መረጋጋት እንዲያገኙ ለመርዳት"),
                )
                category_reasons.setdefault(
                    "stress",
                    ("To help you find calm", "መረጋጋት እንዲያገኙ ለመርዳት"),
                )

        # 2. Recent chat topics
        convs_result = await db.execute(
            select(Conversation.conversation_id)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.last_message_at.desc())
            .limit(3)
        )
        conv_ids = [row[0] for row in convs_result.all()]
        if conv_ids:
            msgs_result = await db.execute(
                select(Message.content).where(
                    Message.conversation_id.in_(conv_ids),
                    Message.sender_type == "user",
                )
            )
            blob = " ".join((row[0] or "").lower() for row in msgs_result.all())
            hit_counter: Counter[str] = Counter()
            for keyword, cat in _CHAT_TOPIC_MAP:
                if keyword in blob:
                    hit_counter[cat] += 1
            for cat, _ in hit_counter.most_common():
                category_reasons.setdefault(
                    cat,
                    (
                        "Related to topics in your conversations",
                        "በውይይቶችዎ ውስጥ ካሉ ርዕሶች ጋር የተያያዘ",
                    ),
                )

        # 3. Default fallback if no signals
        if not category_reasons:
            category_reasons["mindfulness"] = (
                "A gentle place to start",
                "ለመጀመር ለስለስ ያለ ቦታ",
            )

        # 4. Pull resources in those categories, preferring un-viewed.
        category_order = list(category_reasons.keys())
        stmt = (
            select(Resource, UserResource)
            .outerjoin(
                UserResource,
                (UserResource.resource_id == Resource.resource_id)
                & (UserResource.user_id == user_id),
            )
            .where(
                Resource.is_active.is_(True),
                Resource.category.in_(category_order),
            )
        )
        rows = (await db.execute(stmt)).all()
        # Group rows by category, sort each group with un-viewed first.
        by_category: dict[str, list[tuple[Resource, UserResource | None]]] = {}
        for resource, ur in rows:
            by_category.setdefault(resource.category, []).append((resource, ur))
        for cat in by_category:
            by_category[cat].sort(key=lambda pair: (pair[1] is not None, pair[0].title))

        recommendations: list[ResourceRecommendation] = []
        seen_ids: set[UUID] = set()
        # Round-robin across categories so the user sees variety
        while len(recommendations) < limit:
            picked_this_round = False
            for cat in category_order:
                bucket = by_category.get(cat)
                if not bucket:
                    continue
                resource, ur = bucket.pop(0)
                if resource.resource_id in seen_ids:
                    continue
                reason_en, reason_am = category_reasons[cat]
                recommendations.append(
                    ResourceRecommendation(
                        resource=self._to_response(resource, ur),
                        reason=reason_en,
                        reason_am=reason_am,
                    )
                )
                seen_ids.add(resource.resource_id)
                picked_this_round = True
                if len(recommendations) >= limit:
                    break
            if not picked_this_round:
                break

        return recommendations

    @staticmethod
    def _to_response(
        resource: Resource, user_resource: UserResource | None
    ) -> ResourceResponse:
        return ResourceResponse(
            resource_id=resource.resource_id,
            title=resource.title,
            title_am=resource.title_am,
            description=resource.description,
            description_am=resource.description_am,
            resource_type=resource.resource_type,
            url=resource.url,
            thumbnail_url=resource.thumbnail_url,
            category=resource.category,
            duration=resource.duration,
            is_favorite=bool(user_resource and user_resource.is_favorite),
            is_viewed=user_resource is not None,
        )
