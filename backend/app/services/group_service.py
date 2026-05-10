import re
from collections import defaultdict, deque
from datetime import datetime, timezone
from time import monotonic
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group, GroupMember, GroupMessage
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupListItem,
    GroupMemberResponse,
    GroupMessageResponse,
    GroupResponse,
    GroupUnreadSummary,
    GroupUpdate,
)
from app.services.ai_client import AIClient

# In-process rate limiter: max RATE_LIMIT_MAX messages per RATE_LIMIT_WINDOW
# seconds per (user_id, group_id). Keyed by tuples of stringified UUIDs so
# the deques survive across instance methods on the singleton service.
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 10.0
_rate_buckets: dict[tuple[str, str], deque[float]] = defaultdict(deque)

# --- AI moderator config -----------------------------------------------------

AI_MODERATOR_NAME = "MindEase"
AI_MENTION_PATTERN = re.compile(r"@mindease\b[\s,!.?:;]*", re.IGNORECASE)
AI_CONTEXT_LIMIT = 10
# Skip auto-moderation if MindEase has spoken in the last N messages — this
# prevents the AI from dominating the conversation.
AI_AUTOMOD_COOLDOWN_MESSAGES = 10
# Trigger periodic encouragement every N user messages.
AI_AUTOMOD_PERIODIC_EVERY = 30
# A negative-spiral trigger fires when this many of the last 5 user messages
# contain a distress keyword.
AI_AUTOMOD_NEGATIVE_THRESHOLD = 3
AI_AUTOMOD_NEGATIVE_WINDOW = 5

NEGATIVE_KEYWORDS = [
    "hopeless",
    "worthless",
    "can't cope",
    "cant cope",
    "give up",
    "no point",
    "hate myself",
    "breaking down",
    "exhausted",
    "overwhelmed",
    "falling apart",
    "can't do this",
    "cant do this",
    "want to cry",
    # Amharic equivalents
    "ተስፋ ቆርጠሃል",
    "ተስፋ ያጣሁ",
    "መቋቋም አልችልም",
]

MINDEASE_GROUP_PROMPT = """You are MindEase, an AI wellness companion participating in a peer support group called "{group_name}" (category: {category}).

A group member just asked you for help. Respond helpfully and warmly.

Rules:
- Keep responses concise (2-3 paragraphs max) — this is a group chat, don't write essays
- You can offer coping strategies: breathing exercises, grounding techniques, CBT tips, mindfulness suggestions
- You can share relevant information about mental health topics
- Never diagnose anyone or prescribe medication
- Be aware of the group context — other members are reading too
- If someone seems in crisis, provide crisis resources
- Be warm, not clinical
- Address the person who asked, but make your response useful for everyone reading

Recent group conversation for context:
{context}
"""

MODERATOR_PROMPT = """You are MindEase, an AI moderator in a peer support group called "{group_name}".

Your job is to gently support the conversation. You've been asked to intervene because: {trigger_reason}

Recent messages:
{context}

Respond with a SHORT, warm message (1-2 sentences max). Options:
- Offer a quick coping technique relevant to what's being discussed
- Validate the group's feelings and gently encourage
- Suggest a group activity ("Let's all try a quick breathing exercise together")
- Share a brief helpful insight

Do NOT:
- Write long responses
- Diagnose anyone
- Be preachy or condescending
- Repeat yourself if you've already intervened recently

Keep it natural — like a supportive friend in the group, not a bot.
"""


def strip_ai_mention(content: str) -> str:
    """Remove the '@mindease' token (and trailing punctuation) so the AI sees
    just the question."""
    cleaned = AI_MENTION_PATTERN.sub("", content, count=1).strip()
    return cleaned or content.strip()


def has_ai_mention(content: str) -> bool:
    return bool(AI_MENTION_PATTERN.search(content))


def _has_negative_keyword(content: str) -> bool:
    lowered = (content or "").lower()
    return any(kw in lowered for kw in NEGATIVE_KEYWORDS)

CATEGORY_COLORS = {
    "autism": "#6366F1",
    "anxiety": "#F59E0B",
    "depression": "#6B7280",
    "ptsd": "#EF4444",
    "student_stress": "#10B981",
    "grief": "#8B5CF6",
    "addiction_recovery": "#EC4899",
    "mindfulness": "#059669",
    "general": "#4A90A4",
}

CATEGORIES = [
    {"value": "autism", "label": "Autism & Neurodivergence", "label_am": "ኦቲዝም እና ነርቮዳይቨርጀንስ", "icon": "🧩", "color": "#6366F1"},
    {"value": "anxiety", "label": "Anxiety & Panic", "label_am": "ጭንቀት እና ድንጋጤ", "icon": "🫁", "color": "#F59E0B"},
    {"value": "depression", "label": "Depression", "label_am": "ድብርት", "icon": "🌧️", "color": "#6B7280"},
    {"value": "ptsd", "label": "PTSD & Trauma", "label_am": "PTSD እና ስቃይ", "icon": "🛡️", "color": "#EF4444"},
    {"value": "student_stress", "label": "Student Life", "label_am": "የተማሪ ሕይወት", "icon": "📚", "color": "#10B981"},
    {"value": "grief", "label": "Grief & Loss", "label_am": "ሀዘን እና ኪሳራ", "icon": "🕊️", "color": "#8B5CF6"},
    {"value": "addiction_recovery", "label": "Recovery", "label_am": "ማገገም", "icon": "🌅", "color": "#EC4899"},
    {"value": "mindfulness", "label": "Mindfulness & Growth", "label_am": "ንቃተ-ህሊና እና እድገት", "icon": "🌿", "color": "#059669"},
    {"value": "general", "label": "General Support", "label_am": "አጠቃላይ ድጋፍ", "icon": "💬", "color": "#4A90A4"},
]


class GroupService:
    def __init__(self):
        self.ai_client = AIClient()

    async def create_group(
        self, db: AsyncSession, user_id: UUID, data: GroupCreate
    ) -> Group:
        group = Group(
            name=data.name,
            name_am=data.name_am,
            description=data.description,
            description_am=data.description_am,
            category=data.category,
            icon=data.icon,
            cover_color=CATEGORY_COLORS.get(data.category),
            created_by=user_id,
            is_public=data.is_public,
            max_members=data.max_members,
            rules=data.rules,
            rules_am=data.rules_am,
        )
        db.add(group)
        await db.flush()

        creator_membership = GroupMember(
            group_id=group.group_id,
            user_id=user_id,
            role="creator",
        )
        db.add(creator_membership)
        await db.commit()
        await db.refresh(group)
        return group

    async def list_groups(
        self,
        db: AsyncSession,
        user_id: UUID,
        category: str | None = None,
        my_groups: bool = False,
        search: str | None = None,
    ) -> list[GroupListItem]:
        member_count_sq = (
            select(
                GroupMember.group_id,
                func.count(GroupMember.id).label("member_count"),
            )
            .group_by(GroupMember.group_id)
            .subquery()
        )
        last_activity_sq = (
            select(
                GroupMessage.group_id,
                func.max(GroupMessage.timestamp).label("last_activity"),
            )
            .where(GroupMessage.is_deleted.is_(False))
            .group_by(GroupMessage.group_id)
            .subquery()
        )
        # Per-user membership row carries last_read_at so we can compute unread
        # in the same query.
        my_membership_sq = (
            select(
                GroupMember.group_id.label("group_id"),
                GroupMember.last_read_at.label("last_read_at"),
            )
            .where(GroupMember.user_id == user_id)
            .subquery()
        )

        stmt = (
            select(
                Group,
                func.coalesce(member_count_sq.c.member_count, 0).label("member_count"),
                last_activity_sq.c.last_activity,
                my_membership_sq.c.group_id.isnot(None).label("is_member"),
                my_membership_sq.c.last_read_at,
            )
            .outerjoin(member_count_sq, member_count_sq.c.group_id == Group.group_id)
            .outerjoin(last_activity_sq, last_activity_sq.c.group_id == Group.group_id)
            .outerjoin(
                my_membership_sq, my_membership_sq.c.group_id == Group.group_id
            )
            .where(Group.is_active.is_(True))
        )

        if category:
            stmt = stmt.where(Group.category == category)
        if my_groups:
            stmt = stmt.where(my_membership_sq.c.group_id.isnot(None))
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(Group.name.ilike(pattern), Group.description.ilike(pattern))
            )

        stmt = stmt.order_by(
            desc("member_count"),
            desc(Group.created_at),
        )

        rows = (await db.execute(stmt)).all()
        items: list[GroupListItem] = []
        for g, member_count, last_activity, is_member, last_read_at in rows:
            has_unread = bool(
                is_member
                and last_activity is not None
                and (last_read_at is None or last_activity > last_read_at)
            )
            items.append(
                GroupListItem(
                    group_id=g.group_id,
                    name=g.name,
                    name_am=g.name_am,
                    description=g.description,
                    description_am=g.description_am,
                    category=g.category,
                    icon=g.icon,
                    cover_color=g.cover_color,
                    member_count=int(member_count or 0),
                    is_member=bool(is_member),
                    is_public=g.is_public,
                    last_activity=last_activity,
                    has_unread=has_unread,
                )
            )
        return items

    async def mark_read(
        self, db: AsyncSession, group_id: UUID, user_id: UUID
    ) -> None:
        """Bump the user's last_read_at to now for this group. No-op if not
        a member (we silently succeed rather than 404 to avoid extra UI logic
        for the 'just left' race)."""
        membership = await self._get_membership(db, group_id, user_id)
        if membership is None:
            return
        membership.last_read_at = datetime.now(timezone.utc)
        await db.commit()

    async def get_unread_summary(
        self, db: AsyncSession, user_id: UUID
    ) -> GroupUnreadSummary:
        """Count groups where the user is a member and there is at least one
        message newer than their last_read_at."""
        last_msg_sq = (
            select(
                GroupMessage.group_id,
                func.max(GroupMessage.timestamp).label("last_msg"),
            )
            .where(GroupMessage.is_deleted.is_(False))
            .group_by(GroupMessage.group_id)
            .subquery()
        )
        stmt = (
            select(func.count())
            .select_from(GroupMember)
            .join(Group, Group.group_id == GroupMember.group_id)
            .join(last_msg_sq, last_msg_sq.c.group_id == GroupMember.group_id)
            .where(
                GroupMember.user_id == user_id,
                Group.is_active.is_(True),
                or_(
                    GroupMember.last_read_at.is_(None),
                    last_msg_sq.c.last_msg > GroupMember.last_read_at,
                ),
            )
        )
        count = int((await db.execute(stmt)).scalar() or 0)
        return GroupUnreadSummary(has_unread=count > 0, unread_group_count=count)

    async def get_group(
        self, db: AsyncSession, group_id: UUID, user_id: UUID
    ) -> GroupResponse:
        group = await self._get_active_group_or_404(db, group_id)

        member_count = await self._member_count(db, group_id)
        my_membership = await self._get_membership(db, group_id, user_id)
        creator_name = await self._get_user_display_name(db, group.created_by)

        return GroupResponse(
            group_id=group.group_id,
            name=group.name,
            name_am=group.name_am,
            description=group.description,
            description_am=group.description_am,
            category=group.category,
            icon=group.icon,
            cover_color=group.cover_color,
            created_by=group.created_by,
            creator_name=creator_name or "Unknown",
            is_public=group.is_public,
            max_members=group.max_members,
            member_count=member_count,
            is_member=my_membership is not None,
            my_role=my_membership.role if my_membership else None,
            rules=group.rules,
            rules_am=group.rules_am,
            created_at=group.created_at,
        )

    async def update_group(
        self,
        db: AsyncSession,
        group_id: UUID,
        user_id: UUID,
        data: GroupUpdate,
    ) -> Group:
        group = await self._get_active_group_or_404(db, group_id)
        membership = await self._get_membership(db, group_id, user_id)
        if membership is None or membership.role not in ("creator", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only creator or admin can update the group",
            )

        update_fields = data.model_dump(exclude_unset=True)
        for field, value in update_fields.items():
            setattr(group, field, value)
        await db.commit()
        await db.refresh(group)
        return group

    async def delete_group(
        self, db: AsyncSession, group_id: UUID, user_id: UUID
    ) -> None:
        group = await self._get_active_group_or_404(db, group_id)
        if group.created_by != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can delete the group",
            )
        group.is_active = False
        await db.commit()

    async def join_group(
        self, db: AsyncSession, group_id: UUID, user_id: UUID
    ) -> tuple[GroupMember, GroupMessageResponse]:
        """Add the user to the group and persist a system message announcing it.

        Returns (membership, system_message). The route layer broadcasts the
        system_message to everyone currently connected via the group WS map.
        """
        group = await self._get_active_group_or_404(db, group_id)
        if not group.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group is not public",
            )

        existing = await self._get_membership(db, group_id, user_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already a member of this group",
            )

        member_count = await self._member_count(db, group_id)
        if member_count >= group.max_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group is full",
            )

        display_name = await self._get_user_display_name(db, user_id) or "A member"
        now = datetime.now(timezone.utc)
        membership = GroupMember(
            group_id=group_id,
            user_id=user_id,
            role="member",
            last_read_at=now,
        )
        db.add(membership)
        system_msg = GroupMessage(
            group_id=group_id,
            user_id=None,
            sender_type="system",
            sender_name=None,
            content=f"{display_name} joined the group",
        )
        db.add(system_msg)
        await db.commit()
        await db.refresh(membership)
        await db.refresh(system_msg)
        return membership, GroupMessageResponse.model_validate(system_msg)

    async def leave_group(
        self, db: AsyncSession, group_id: UUID, user_id: UUID
    ) -> GroupMessageResponse:
        """Remove the user and persist a system message. Returns the system
        message so the route can broadcast it."""
        group = await self._get_active_group_or_404(db, group_id)
        if group.created_by == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transfer ownership or delete the group",
            )
        membership = await self._get_membership(db, group_id, user_id)
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Not a member of this group",
            )
        display_name = await self._get_user_display_name(db, user_id) or "A member"
        system_msg = GroupMessage(
            group_id=group_id,
            user_id=None,
            sender_type="system",
            sender_name=None,
            content=f"{display_name} left the group",
        )
        db.add(system_msg)
        await db.delete(membership)
        await db.commit()
        await db.refresh(system_msg)
        return GroupMessageResponse.model_validate(system_msg)

    @staticmethod
    def check_rate_limit(user_id: UUID, group_id: UUID) -> bool:
        """Sliding-window rate check. Returns True if the message is allowed
        and records its timestamp; False if the user has exceeded the limit.

        Stored in-process — fine for single-worker dev. Multi-worker production
        would need Redis or similar."""
        key = (str(user_id), str(group_id))
        now = monotonic()
        bucket = _rate_buckets[key]
        # Drop timestamps outside the window
        while bucket and now - bucket[0] > RATE_LIMIT_WINDOW:
            bucket.popleft()
        if len(bucket) >= RATE_LIMIT_MAX:
            return False
        bucket.append(now)
        return True

    async def get_members(
        self, db: AsyncSession, group_id: UUID
    ) -> list[GroupMemberResponse]:
        await self._get_active_group_or_404(db, group_id)
        role_order = case(
            (GroupMember.role == "creator", 0),
            (GroupMember.role == "admin", 1),
            else_=2,
        )
        rows = await db.execute(
            select(GroupMember, User)
            .join(User, User.user_id == GroupMember.user_id)
            .where(GroupMember.group_id == group_id)
            .order_by(role_order, GroupMember.joined_at)
        )
        return [
            GroupMemberResponse(
                user_id=member.user_id,
                display_name=user.display_name,
                role=member.role,
                joined_at=member.joined_at,
                is_muted=member.is_muted,
            )
            for member, user in rows.all()
        ]

    async def promote_member(
        self,
        db: AsyncSession,
        group_id: UUID,
        user_id: UUID,
        target_user_id: UUID,
    ) -> None:
        group = await self._get_active_group_or_404(db, group_id)
        if group.created_by != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator can promote members",
            )
        target = await self._get_membership(db, group_id, target_user_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this group",
            )
        if target.role == "creator":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Creator cannot be promoted",
            )
        target.role = "admin"
        await db.commit()

    async def mute_member(
        self,
        db: AsyncSession,
        group_id: UUID,
        user_id: UUID,
        target_user_id: UUID,
        mute: bool,
    ) -> None:
        group = await self._get_active_group_or_404(db, group_id)
        actor = await self._get_membership(db, group_id, user_id)
        if actor is None or actor.role not in ("creator", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only creator or admin can mute members",
            )
        target = await self._get_membership(db, group_id, target_user_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this group",
            )
        if target.role == "creator":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot mute the creator",
            )
        target.is_muted = mute
        await db.commit()

    async def remove_member(
        self,
        db: AsyncSession,
        group_id: UUID,
        user_id: UUID,
        target_user_id: UUID,
    ) -> None:
        group = await self._get_active_group_or_404(db, group_id)
        actor = await self._get_membership(db, group_id, user_id)
        if actor is None or actor.role not in ("creator", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only creator or admin can remove members",
            )
        target = await self._get_membership(db, group_id, target_user_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this group",
            )
        if target.role == "creator":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the creator",
            )
        await db.delete(target)
        await db.commit()

    async def get_messages(
        self,
        db: AsyncSession,
        group_id: UUID,
        user_id: UUID,
        limit: int = 50,
        before: datetime | None = None,
    ) -> list[GroupMessageResponse]:
        await self._get_active_group_or_404(db, group_id)
        membership = await self._get_membership(db, group_id, user_id)
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Must be a group member to read messages",
            )

        stmt = (
            select(GroupMessage)
            .where(
                GroupMessage.group_id == group_id,
                GroupMessage.is_deleted.is_(False),
            )
            .order_by(desc(GroupMessage.timestamp))
            .limit(limit)
        )
        if before is not None:
            stmt = stmt.where(GroupMessage.timestamp < before)

        rows = (await db.execute(stmt)).scalars().all()
        # Newest-first from query → reverse for chronological display
        ordered = list(reversed(rows))
        return [GroupMessageResponse.model_validate(m) for m in ordered]

    async def send_message(
        self,
        db: AsyncSession,
        group_id: UUID,
        user_id: UUID,
        content: str,
        sender_name: str,
    ) -> tuple[GroupMessageResponse, GroupMessageResponse | None, dict | None]:
        """Persist a user message; on crisis, also persist a system follow-up.

        Returns (user_message, system_message_or_none, crisis_resources_or_none)
        so callers (notably the WebSocket handler) can broadcast all three.
        """
        await self._get_active_group_or_404(db, group_id)
        membership = await self._get_membership(db, group_id, user_id)
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Must be a group member to send messages",
            )
        if membership.is_muted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are muted in this group",
            )

        crisis_result: dict = {}
        try:
            crisis_result = await self.ai_client.check_crisis(content)
        except Exception:
            crisis_result = {}
        is_crisis = bool(crisis_result.get("is_crisis"))
        resources = crisis_result.get("resources") if is_crisis else None

        message = GroupMessage(
            group_id=group_id,
            user_id=user_id,
            sender_type="user",
            sender_name=sender_name,
            content=content,
            is_crisis_flagged=is_crisis,
        )
        db.add(message)
        await db.flush()

        system_message_model: GroupMessage | None = None
        if is_crisis:
            system_message_model = GroupMessage(
                group_id=group_id,
                user_id=None,
                sender_type="system",
                sender_name=None,
                content=self._format_crisis_notice(resources or {}),
            )
            db.add(system_message_model)
            await db.flush()

        await db.commit()
        await db.refresh(message)
        if system_message_model is not None:
            await db.refresh(system_message_model)

        return (
            GroupMessageResponse.model_validate(message),
            (
                GroupMessageResponse.model_validate(system_message_model)
                if system_message_model is not None
                else None
            ),
            resources,
        )

    async def delete_message(
        self,
        db: AsyncSession,
        group_id: UUID,
        user_id: UUID,
        message_id: UUID,
    ) -> None:
        await self._get_active_group_or_404(db, group_id)
        result = await db.execute(
            select(GroupMessage).where(
                GroupMessage.message_id == message_id,
                GroupMessage.group_id == group_id,
            )
        )
        message = result.scalar_one_or_none()
        if message is None or message.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found",
            )

        if message.user_id != user_id:
            actor = await self._get_membership(db, group_id, user_id)
            if actor is None or actor.role not in ("creator", "admin"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot delete another member's message",
                )

        message.is_deleted = True
        await db.commit()

    async def get_categories(self) -> list[dict]:
        return CATEGORIES

    # ---- AI moderator (on-demand + auto) ----

    async def generate_ai_mention_response(
        self,
        db: AsyncSession,
        group_id: UUID,
        question: str,
    ) -> GroupMessageResponse | None:
        """Generate a MindEase reply to an @mention and persist it as a
        group message. Returns the persisted message, or None if the AI
        call failed (caller decides whether to surface anything)."""
        group = await self._get_active_group_or_404(db, group_id)
        context = await self._build_ai_context(db, group_id)
        system_prompt = MINDEASE_GROUP_PROMPT.format(
            group_name=group.name,
            category=group.category,
            context=context,
        )
        try:
            text = await self.ai_client.generate_response(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question},
                ]
            )
        except Exception:
            return None
        text = (text or "").strip()
        if not text:
            return None
        return await self._persist_ai_message(db, group_id, text)

    async def maybe_auto_moderate(
        self, db: AsyncSession, group_id: UUID
    ) -> GroupMessageResponse | None:
        """Decide whether to intervene without being prompted. Returns the
        persisted AI message if we did intervene, otherwise None.

        Called as a background task after each non-@mention user message,
        so the cost of doing nothing must stay tiny — only the cooldown
        check + a couple of small queries before bailing out."""
        # Cooldown: don't pile on if the AI spoke recently.
        if await self._ai_spoke_recently(
            db, group_id, AI_AUTOMOD_COOLDOWN_MESSAGES
        ):
            return None

        group = await self._get_active_group_or_404(db, group_id)

        # Fetch the most recent user-sent messages once and reuse for both checks.
        recent_user_msgs = await self._recent_user_messages(
            db, group_id, AI_AUTOMOD_NEGATIVE_WINDOW
        )

        trigger_reason: str | None = None

        # 1) Negative spiral
        negative_count = sum(
            1 for m in recent_user_msgs if _has_negative_keyword(m.content)
        )
        if negative_count >= AI_AUTOMOD_NEGATIVE_THRESHOLD:
            trigger_reason = (
                "The conversation seems to be in a difficult place. "
                "Multiple members are expressing distress."
            )

        # 2) Periodic encouragement (only if no spiral trigger)
        if trigger_reason is None:
            user_msg_total = await self._user_message_count(db, group_id)
            if (
                user_msg_total > 0
                and user_msg_total % AI_AUTOMOD_PERIODIC_EVERY == 0
            ):
                trigger_reason = "It's been a while. Check in with the group."

        if trigger_reason is None:
            return None

        context = await self._build_ai_context(db, group_id)
        system_prompt = MODERATOR_PROMPT.format(
            group_name=group.name,
            trigger_reason=trigger_reason,
            context=context,
        )
        try:
            text = await self.ai_client.generate_response(
                [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": "Please respond now.",
                    },
                ]
            )
        except Exception:
            return None
        text = (text or "").strip()
        if not text:
            return None
        # Prefix with a sparkle so the frontend can render it visually
        # distinct from on-demand replies without needing another DB column.
        if not text.startswith("💡"):
            text = f"💡 {text}"
        return await self._persist_ai_message(db, group_id, text)

    async def _persist_ai_message(
        self, db: AsyncSession, group_id: UUID, content: str
    ) -> GroupMessageResponse:
        message = GroupMessage(
            group_id=group_id,
            user_id=None,
            sender_type="ai_moderator",
            sender_name=AI_MODERATOR_NAME,
            content=content,
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return GroupMessageResponse.model_validate(message)

    async def _build_ai_context(
        self, db: AsyncSession, group_id: UUID
    ) -> str:
        rows = await db.execute(
            select(GroupMessage)
            .where(
                GroupMessage.group_id == group_id,
                GroupMessage.is_deleted.is_(False),
                GroupMessage.sender_type != "system",
            )
            .order_by(desc(GroupMessage.timestamp))
            .limit(AI_CONTEXT_LIMIT)
        )
        msgs = list(reversed(rows.scalars().all()))
        lines = [
            f"{m.sender_name or 'Member'}: {m.content}" for m in msgs
        ]
        return "\n".join(lines) if lines else "(no prior messages)"

    async def _ai_spoke_recently(
        self, db: AsyncSession, group_id: UUID, window: int
    ) -> bool:
        rows = await db.execute(
            select(GroupMessage.sender_type)
            .where(
                GroupMessage.group_id == group_id,
                GroupMessage.is_deleted.is_(False),
            )
            .order_by(desc(GroupMessage.timestamp))
            .limit(window)
        )
        return any(row[0] == "ai_moderator" for row in rows.all())

    async def _recent_user_messages(
        self, db: AsyncSession, group_id: UUID, limit: int
    ) -> list[GroupMessage]:
        rows = await db.execute(
            select(GroupMessage)
            .where(
                GroupMessage.group_id == group_id,
                GroupMessage.is_deleted.is_(False),
                GroupMessage.sender_type == "user",
            )
            .order_by(desc(GroupMessage.timestamp))
            .limit(limit)
        )
        return list(rows.scalars().all())

    async def _user_message_count(
        self, db: AsyncSession, group_id: UUID
    ) -> int:
        result = await db.execute(
            select(func.count(GroupMessage.message_id)).where(
                GroupMessage.group_id == group_id,
                GroupMessage.is_deleted.is_(False),
                GroupMessage.sender_type == "user",
            )
        )
        return int(result.scalar() or 0)

    # ---- helpers ----

    async def _get_active_group_or_404(
        self, db: AsyncSession, group_id: UUID
    ) -> Group:
        result = await db.execute(
            select(Group).where(
                Group.group_id == group_id, Group.is_active.is_(True)
            )
        )
        group = result.scalar_one_or_none()
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )
        return group

    async def _get_membership(
        self, db: AsyncSession, group_id: UUID, user_id: UUID
    ) -> GroupMember | None:
        result = await db.execute(
            select(GroupMember).where(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def _member_count(self, db: AsyncSession, group_id: UUID) -> int:
        result = await db.execute(
            select(func.count(GroupMember.id)).where(
                GroupMember.group_id == group_id
            )
        )
        return int(result.scalar() or 0)

    async def _get_user_display_name(
        self, db: AsyncSession, user_id: UUID
    ) -> str | None:
        result = await db.execute(
            select(User.display_name).where(User.user_id == user_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _format_crisis_notice(resources: dict) -> str:
        lines = [
            "A message in this group raised a crisis signal. "
            "If you or someone here is in distress, please reach out to one of "
            "the resources below.",
        ]
        for region, items in (resources or {}).items():
            for item in items or []:
                name = item.get("name", "Support resource")
                contact = item.get("phone") or item.get("info") or item.get("url") or ""
                if contact:
                    lines.append(f"• {name}: {contact}")
                else:
                    lines.append(f"• {name}")
        return "\n".join(lines)
