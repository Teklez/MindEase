"""Admin-only API endpoints. All routes require is_admin=True on the current user."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_registered_user
from app.database import get_db
from app.models.assessment import Assessment, UserAssessment
from app.models.badge import Badge, UserBadge
from app.models.conversation import Conversation
from app.models.group import Group, GroupMember, GroupMessage
from app.models.memory_chunk import MemoryChunk
from app.models.message import Message
from app.models.mood_entry import MoodEntry
from app.models.resource import Resource, UserResource
from app.models.user import User
from app.services.ai_client import AIClient
import asyncio

router = APIRouter()


async def get_admin_user(current_user: User = Depends(get_registered_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ── Stats & charts ────────────────────────────────────────────────────────── #

@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_users = (await db.execute(
        select(func.count()).select_from(User).where(User.last_login >= thirty_days_ago)
    )).scalar_one()
    new_users_7d = (await db.execute(
        select(func.count()).select_from(User).where(User.created_at >= seven_days_ago)
    )).scalar_one()
    total_conversations = (await db.execute(select(func.count()).select_from(Conversation))).scalar_one()
    total_messages = (await db.execute(select(func.count()).select_from(Message))).scalar_one()
    total_mood_entries = (await db.execute(select(func.count()).select_from(MoodEntry))).scalar_one()
    total_assessments_taken = (await db.execute(select(func.count()).select_from(UserAssessment))).scalar_one()
    total_groups = (await db.execute(select(func.count()).select_from(Group))).scalar_one()
    crisis_conversations = (await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.crisis_detected == True)
    )).scalar_one()
    crisis_messages = (await db.execute(
        select(func.count()).select_from(Message).where(Message.is_crisis_flagged == True)
    )).scalar_one()

    return {
        "total_users": total_users,
        "active_users_30d": active_users,
        "new_users_7d": new_users_7d,
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "total_mood_entries": total_mood_entries,
        "total_assessments_taken": total_assessments_taken,
        "total_groups": total_groups,
        "crisis_conversations": crisis_conversations,
        "crisis_messages": crisis_messages,
    }


@router.get("/signups-chart")
async def signups_chart(
    days: int = Query(14, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    """Daily signup counts for the last N days."""
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(
            func.date_trunc("day", User.created_at).label("day"),
            func.count().label("count"),
        )
        .where(User.created_at >= start)
        .group_by("day")
        .order_by("day")
    )
    rows = {r.day.date().isoformat(): r.count for r in result.all()}

    series = []
    for i in range(days):
        d = (start + timedelta(days=i)).date()
        series.append({"date": d.isoformat(), "count": rows.get(d.isoformat(), 0)})
    return {"series": series}


@router.get("/activity")
async def recent_activity(
    limit: int = Query(15, ge=5, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    """Recent platform activity: signups, crisis flags, assessments."""
    items: list[dict[str, Any]] = []

    # Recent signups
    res = await db.execute(select(User).order_by(User.created_at.desc()).limit(limit))
    for u in res.scalars():
        items.append({
            "type": "signup",
            "user_id": str(u.user_id),
            "user_email": u.email,
            "user_name": u.display_name,
            "timestamp": u.created_at.isoformat() if u.created_at else None,
        })

    # Recent crisis flags
    res = await db.execute(
        select(Message).where(Message.is_crisis_flagged == True).order_by(Message.timestamp.desc()).limit(limit)
    )
    for m in res.scalars():
        items.append({
            "type": "crisis",
            "message_id": str(m.message_id),
            "conversation_id": str(m.conversation_id),
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
        })

    # Recent assessments
    res = await db.execute(
        select(UserAssessment).order_by(UserAssessment.completed_at.desc()).limit(limit)
    )
    for a in res.scalars():
        items.append({
            "type": "assessment",
            "user_id": str(a.user_id),
            "score": a.score,
            "level": a.feedback_level,
            "timestamp": a.completed_at.isoformat() if a.completed_at else None,
        })

    items.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return {"items": items[:limit]}


# ── Users ─────────────────────────────────────────────────────────────────── #

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    role_filter: str | None = Query(None, alias="role"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    offset = (page - 1) * limit
    base = select(User)
    count_base = select(func.count()).select_from(User)

    filters = []
    if q:
        like = f"%{q}%"
        filters.append(or_(User.email.ilike(like), User.display_name.ilike(like)))
    if status_filter in ("active", "suspended"):
        filters.append(User.account_status == status_filter)
    if role_filter == "admin":
        filters.append(User.is_admin == True)
    elif role_filter == "user":
        filters.append(User.is_admin == False)

    if filters:
        base = base.where(*filters)
        count_base = count_base.where(*filters)

    total = (await db.execute(count_base)).scalar_one()
    result = await db.execute(base.order_by(User.created_at.desc()).offset(offset).limit(limit))
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "users": [
            {
                "user_id": str(u.user_id),
                "email": u.email,
                "display_name": u.display_name,
                "account_status": u.account_status,
                "is_admin": u.is_admin,
                "is_verified": u.is_verified,
                "oauth_provider": u.oauth_provider,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in users
        ],
    }


@router.get("/users/{user_id}")
async def user_detail(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    user_res = await db.execute(select(User).where(User.user_id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    conv_count = (await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.user_id == user_id)
    )).scalar_one()
    mood_count = (await db.execute(
        select(func.count()).select_from(MoodEntry).where(MoodEntry.user_id == user_id)
    )).scalar_one()
    assessment_count = (await db.execute(
        select(func.count()).select_from(UserAssessment).where(UserAssessment.user_id == user_id)
    )).scalar_one()
    crisis_count = (await db.execute(
        select(func.count()).select_from(Conversation)
        .where(Conversation.user_id == user_id, Conversation.crisis_detected == True)
    )).scalar_one()
    avg_mood_row = await db.execute(
        select(func.avg(MoodEntry.mood_level)).where(MoodEntry.user_id == user_id)
    )
    avg_mood = avg_mood_row.scalar_one_or_none()

    return {
        "user_id": str(user.user_id),
        "email": user.email,
        "display_name": user.display_name,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "account_status": user.account_status,
        "oauth_provider": user.oauth_provider,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "stats": {
            "conversations": conv_count,
            "mood_entries": mood_count,
            "assessments": assessment_count,
            "crisis_conversations": crisis_count,
            "avg_mood": float(avg_mood) if avg_mood is not None else None,
        },
    }


class UserUpdateBody(BaseModel):
    account_status: str | None = None
    is_admin: bool | None = None


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdateBody,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin_user),
) -> dict[str, Any]:
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.user_id == current_admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin account")

    if body.account_status is not None:
        if body.account_status not in ("active", "suspended"):
            raise HTTPException(status_code=400, detail="account_status must be 'active' or 'suspended'")
        user.account_status = body.account_status
    if body.is_admin is not None:
        user.is_admin = body.is_admin

    await db.commit()
    return {"user_id": str(user.user_id), "account_status": user.account_status, "is_admin": user.is_admin}




# ── Conversations ─────────────────────────────────────────────────────────── #

# ── Groups ────────────────────────────────────────────────────────────────── #

@router.get("/groups")
async def list_groups(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    offset = (page - 1) * limit
    total = (await db.execute(select(func.count()).select_from(Group))).scalar_one()
    result = await db.execute(select(Group).order_by(Group.created_at.desc()).offset(offset).limit(limit))
    groups = result.scalars().all()

    out = []
    for g in groups:
        member_count = (await db.execute(
            select(func.count()).select_from(GroupMember).where(GroupMember.group_id == g.group_id)
        )).scalar_one()
        out.append({
            "group_id": str(g.group_id),
            "name": g.name,
            "category": g.category,
            "is_public": g.is_public,
            "is_active": g.is_active,
            "max_members": g.max_members,
            "member_count": member_count,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return {"total": total, "page": page, "limit": limit, "groups": out}


class GroupUpdateBody(BaseModel):
    is_active: bool | None = None


@router.patch("/groups/{group_id}")
async def update_group(
    group_id: uuid.UUID,
    body: GroupUpdateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Group).where(Group.group_id == group_id))
    g = res.scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    if body.is_active is not None:
        g.is_active = body.is_active
    await db.commit()
    return {"group_id": str(g.group_id), "is_active": g.is_active}


# ── Resources ─────────────────────────────────────────────────────────────── #

class ResourceCreateBody(BaseModel):
    title: str
    description: str
    resource_type: str  # article | video | audio | exercise
    category: str
    url: str
    duration: str | None = None
    thumbnail_url: str | None = None


@router.post("/resources")
async def create_resource(
    body: ResourceCreateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    r = Resource(
        title=body.title.strip(),
        description=body.description.strip(),
        resource_type=body.resource_type.strip(),
        category=body.category.strip(),
        url=body.url.strip(),
        duration=body.duration.strip() if body.duration else None,
        thumbnail_url=body.thumbnail_url.strip() if body.thumbnail_url else None,
    )
    if not r.title or not r.description or not r.url:
        raise HTTPException(status_code=400, detail="title, description, and url are required")
    db.add(r)
    await db.commit()
    await db.refresh(r)

    # Always broadcast — respect each user's notification preferences in the service.
    import asyncio
    from app.database import async_session_maker
    from app.services.notification_service import broadcast_new_resource
    async def _fire() -> None:
        async with async_session_maker() as bg_db:
            try:
                await broadcast_new_resource(bg_db, r.title, r.description, r.resource_type)
            except Exception:
                logger.exception("broadcast_new_resource failed")
    asyncio.create_task(_fire())

    return {"resource_id": str(r.resource_id), "title": r.title}


@router.get("/resources")
async def list_resources(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    result = await db.execute(select(Resource).order_by(Resource.created_at.desc()))
    resources = result.scalars().all()
    return {
        "resources": [
            {
                "resource_id": str(r.resource_id),
                "title": r.title,
                "category": r.category,
                "resource_type": r.resource_type,
                "is_active": r.is_active,
                "url": r.url,
                "duration": r.duration,
            }
            for r in resources
        ]
    }


class ResourceUpdateBody(BaseModel):
    is_active: bool | None = None


@router.patch("/resources/{resource_id}")
async def update_resource(
    resource_id: uuid.UUID,
    body: ResourceUpdateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Resource).where(Resource.resource_id == resource_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    if body.is_active is not None:
        r.is_active = body.is_active
    await db.commit()
    return {"resource_id": str(r.resource_id), "is_active": r.is_active}


# ── User: delete account ──────────────────────────────────────────────────── #

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin_user),
) -> dict[str, Any]:
    """Permanent deletion: removes user and all their data."""
    if user_id == current_admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    res = await db.execute(select(User).where(User.user_id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Manual cascade — FKs don't cascade by default
    await db.execute(MemoryChunk.__table__.delete().where(MemoryChunk.user_id == user_id))
    await db.execute(UserBadge.__table__.delete().where(UserBadge.user_id == user_id))
    await db.execute(UserResource.__table__.delete().where(UserResource.user_id == user_id))
    await db.execute(UserAssessment.__table__.delete().where(UserAssessment.user_id == user_id))
    await db.execute(MoodEntry.__table__.delete().where(MoodEntry.user_id == user_id))
    await db.execute(GroupMember.__table__.delete().where(GroupMember.user_id == user_id))
    # Soft-null group messages by this user instead of dropping the history
    from sqlalchemy import update as sa_update
    await db.execute(sa_update(GroupMessage).where(GroupMessage.user_id == user_id).values(user_id=None, is_deleted=True))
    # Delete conversations (messages cascade)
    convs = await db.execute(select(Conversation.conversation_id).where(Conversation.user_id == user_id))
    conv_ids = [r[0] for r in convs.all()]
    if conv_ids:
        await db.execute(Message.__table__.delete().where(Message.conversation_id.in_(conv_ids)))
        await db.execute(Conversation.__table__.delete().where(Conversation.user_id == user_id))
    # Groups created by this user — keep groups, null out creator
    await db.execute(sa_update(Group).where(Group.created_by == user_id).values(created_by=current_admin.user_id))

    await db.delete(user)
    await db.commit()
    return {"deleted": True}


# ── Conversation: delete ──────────────────────────────────────────────────── #

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Conversation).where(Conversation.conversation_id == conversation_id))
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Clear related memory chunks first
    await db.execute(MemoryChunk.__table__.delete().where(MemoryChunk.conversation_id == conversation_id))
    await db.execute(Message.__table__.delete().where(Message.conversation_id == conversation_id))
    await db.delete(conv)
    await db.commit()
    return {"deleted": True}


# ── Group: members, message moderation, delete ───────────────────────────── #

@router.get("/groups/{group_id}/members")
async def group_members(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    g_res = await db.execute(select(Group).where(Group.group_id == group_id))
    g = g_res.scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    mem_res = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id).order_by(GroupMember.joined_at.asc())
    )
    members = mem_res.scalars().all()

    out = []
    for m in members:
        ur = await db.execute(select(User).where(User.user_id == m.user_id))
        u = ur.scalar_one_or_none()
        out.append({
            "user_id": str(m.user_id),
            "email": u.email if u else None,
            "display_name": u.display_name if u else None,
            "role": m.role,
            "is_muted": m.is_muted,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
        })
    return {"group_name": g.name, "members": out}


@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    m = res.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")
    await db.delete(m)
    await db.commit()
    return {"removed": True}


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Group).where(Group.group_id == group_id))
    g = res.scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    # GroupMessage and GroupMember have CASCADE — but be safe explicit
    await db.delete(g)
    await db.commit()
    return {"deleted": True}


# ── Assessments & Badges (content management) ─────────────────────────────── #

class GenerateAssessmentBody(BaseModel):
    prompt: str


@router.post("/assessments/generate")
async def generate_assessment_spec(
    body: GenerateAssessmentBody,
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    """Use Gemini (or local fallback) to draft a complete assessment spec from a short brief.
    The admin reviews and edits before submitting via POST /admin/assessments."""
    from app.services.ai_client import AIClient
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")
    try:
        result = await AIClient().generate_assessment(body.prompt.strip())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"generation failed: {e}")
    # Pass through refusal or spec unchanged
    if "refusal" in result:
        return {"refusal": result["refusal"]}
    return {"spec": result.get("spec") or result}


class ScoringRange(BaseModel):
    min: int
    max: int
    level: str
    label: str
    feedback: str
    color: str | None = None


class AssessmentCreateBody(BaseModel):
    name: str
    description: str
    assessment_type: str  # anxiety | depression | stress | wellbeing | other
    icon: str = "📋"
    estimated_time: str | None = "5 min"
    questions: list[str]  # plain question text — IDs auto-assigned
    response_options: list[dict]  # [{value: int, label: str}]
    ranges: list[ScoringRange]


@router.post("/assessments")
async def create_assessment(
    body: AssessmentCreateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    if not body.name.strip() or not body.description.strip():
        raise HTTPException(status_code=400, detail="name and description are required")
    if len(body.questions) < 1:
        raise HTTPException(status_code=400, detail="at least one question is required")
    if len(body.response_options) < 2:
        raise HTTPException(status_code=400, detail="at least two response options are required")
    if len(body.ranges) < 1:
        raise HTTPException(status_code=400, detail="at least one scoring range is required")

    # Auto-assign integer IDs to questions
    questions = [{"id": i + 1, "text": q.strip()} for i, q in enumerate(body.questions) if q.strip()]
    if not questions:
        raise HTTPException(status_code=400, detail="questions cannot be empty")

    # max_score = (max response value) × (question count)
    max_value = max(int(o.get("value", 0)) for o in body.response_options)
    max_score = max_value * len(questions)

    # Green->red gradient — admin form / AI generator doesn't supply colors, but the
    # user-facing result view requires them, so default any missing colors here.
    _palette = ["#22C55E", "#EAB308", "#F97316", "#EF4444", "#DC2626"]
    _ranges = [r.model_dump() for r in body.ranges]
    for _i, _r in enumerate(_ranges):
        if not _r.get("color"):
            _r["color"] = _palette[min(_i, len(_palette) - 1)]

    # Auto-translate every user-facing string into Amharic so users on the
    # Amharic locale see native copy. Each call falls back to English on
    # failure, so a translator outage downgrades gracefully instead of
    # blocking assessment creation.
    name_en = body.name.strip()
    desc_en = body.description.strip()
    _client = AIClient()

    async def _to_am(text: str) -> str:
        return await _client.translate(text, "en", "am")

    # Build a flat list of strings to translate, then re-zip into the right
    # slots so we can run a single gather() and bound total latency.
    option_idxs = [i for i, o in enumerate(body.response_options) if (o.get("label") or "").strip()]
    flat: list[str] = [name_en, desc_en]
    flat.extend(q["text"] for q in questions)
    flat.extend(body.response_options[i]["label"] for i in option_idxs)
    flat.extend(r["label"] for r in _ranges)
    flat.extend(r["feedback"] for r in _ranges)

    translated = await asyncio.gather(*(_to_am(t) for t in flat))

    cursor = 0
    name_am = translated[cursor]; cursor += 1
    desc_am = translated[cursor]; cursor += 1
    for q in questions:
        q["text_am"] = translated[cursor]; cursor += 1
    response_options_am = [dict(o) for o in body.response_options]
    for idx in option_idxs:
        response_options_am[idx]["label_am"] = translated[cursor]; cursor += 1
    for r in _ranges:
        r["label_am"] = translated[cursor]; cursor += 1
    for r in _ranges:
        r["feedback_am"] = translated[cursor]; cursor += 1

    scoring_logic = {
        "max_score": max_score,
        "options": response_options_am,
        "ranges": _ranges,
    }

    a = Assessment(
        name=name_en,
        name_am=name_am if name_am != name_en else None,
        description=desc_en,
        description_am=desc_am if desc_am != desc_en else None,
        assessment_type=body.assessment_type.strip(),
        icon=body.icon.strip() or "📋",
        estimated_time=(body.estimated_time or "").strip() or None,
        questions=questions,
        scoring_logic=scoring_logic,
    )
    db.add(a)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.exception("create_assessment commit failed: %s", e)
        raise HTTPException(status_code=400, detail=f"Failed to create: {e}")
    await db.refresh(a)

    from app.database import async_session_maker
    from app.services.notification_service import broadcast_new_assessment
    async def _fire() -> None:
        async with async_session_maker() as bg_db:
            try:
                await broadcast_new_assessment(bg_db, a.name, a.description)
            except Exception:
                logger.exception("broadcast_new_assessment failed")
    asyncio.create_task(_fire())

    return {"assessment_id": str(a.assessment_id), "name": a.name}


@router.get("/assessments")
async def list_assessments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Assessment).order_by(Assessment.created_at.desc()))
    out = []
    for a in res.scalars():
        taken = (await db.execute(
            select(func.count()).select_from(UserAssessment).where(UserAssessment.assessment_id == a.assessment_id)
        )).scalar_one()
        out.append({
            "assessment_id": str(a.assessment_id),
            "name": a.name,
            "assessment_type": a.assessment_type,
            "estimated_time": a.estimated_time,
            "question_count": len(a.questions or []),
            "is_active": a.is_active,
            "times_taken": taken,
        })
    return {"assessments": out}


class AssessmentUpdateBody(BaseModel):
    is_active: bool | None = None


@router.patch("/assessments/{assessment_id}")
async def update_assessment(
    assessment_id: uuid.UUID,
    body: AssessmentUpdateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Assessment).where(Assessment.assessment_id == assessment_id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if body.is_active is not None:
        a.is_active = body.is_active
    await db.commit()
    return {"assessment_id": str(a.assessment_id), "is_active": a.is_active}


_VALID_CRITERIA_TYPES = {"mood_count", "mood_streak", "chat_count", "resource_view", "assessment"}


class BadgeCreateBody(BaseModel):
    name: str
    description: str
    icon: str
    criteria_type: str
    criteria_value: int


@router.post("/badges")
async def create_badge(
    body: BadgeCreateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    name = body.name.strip()
    description = body.description.strip()
    icon = body.icon.strip()
    criteria_type = body.criteria_type.strip()
    if not name or not description or not icon:
        raise HTTPException(status_code=400, detail="name, description, and icon are required")
    if criteria_type not in _VALID_CRITERIA_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"criteria_type must be one of: {', '.join(sorted(_VALID_CRITERIA_TYPES))}",
        )
    if body.criteria_value < 1:
        raise HTTPException(status_code=400, detail="criteria_value must be at least 1")

    b = Badge(
        name=name,
        description=description,
        icon=icon,
        criteria_type=criteria_type,
        criteria_value=body.criteria_value,
    )
    db.add(b)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create: {e}")
    await db.refresh(b)
    return {"badge_id": str(b.badge_id), "name": b.name}


@router.get("/badges")
async def list_badges(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Badge))
    out = []
    for b in res.scalars():
        earned = (await db.execute(
            select(func.count()).select_from(UserBadge).where(UserBadge.badge_id == b.badge_id)
        )).scalar_one()
        out.append({
            "badge_id": str(b.badge_id),
            "name": b.name,
            "description": b.description,
            "criteria_type": b.criteria_type,
            "criteria_value": b.criteria_value,
            "is_active": b.is_active,
            "times_earned": earned,
        })
    return {"badges": out}


class BadgeUpdateBody(BaseModel):
    is_active: bool | None = None


@router.patch("/badges/{badge_id}")
async def update_badge(
    badge_id: uuid.UUID,
    body: BadgeUpdateBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(select(Badge).where(Badge.badge_id == badge_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Badge not found")
    if body.is_active is not None:
        b.is_active = body.is_active
    await db.commit()
    return {"badge_id": str(b.badge_id), "is_active": b.is_active}


# ── User memory clear ─────────────────────────────────────────────────────── #

@router.delete("/users/{user_id}/memory")
async def clear_user_memory(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict[str, Any]:
    res = await db.execute(MemoryChunk.__table__.delete().where(MemoryChunk.user_id == user_id))
    await db.commit()
    return {"deleted_rows": res.rowcount}
