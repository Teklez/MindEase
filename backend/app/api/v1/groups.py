import asyncio
import logging
import uuid
from datetime import datetime

from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Query,
    Response,
    WebSocket,
    status,
)
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.core.security import get_current_user, get_registered_user, verify_token
from app.database import async_session_maker, get_db
from app.models.group import GroupMember
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
from app.services.group_service import GroupService, has_ai_mention, strip_ai_mention

router = APIRouter()
group_service = GroupService()


# ---------- REST ----------


@router.get("/categories")
async def list_categories(
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return await group_service.get_categories()


@router.get("/unread-summary", response_model=GroupUnreadSummary)
async def get_unread_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupUnreadSummary:
    return await group_service.get_unread_summary(db, current_user.user_id)


@router.post(
    "",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_registered_user),
) -> GroupResponse:
    group = await group_service.create_group(db, current_user.user_id, body)
    return await group_service.get_group(db, group.group_id, current_user.user_id)


@router.get("", response_model=list[GroupListItem])
async def list_groups(
    category: str | None = Query(None),
    my_groups: bool = Query(False),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupListItem]:
    return await group_service.list_groups(
        db,
        current_user.user_id,
        category=category,
        my_groups=my_groups,
        search=search,
    )


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    return await group_service.get_group(db, group_id, current_user.user_id)


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: uuid.UUID,
    body: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    await group_service.update_group(db, group_id, current_user.user_id, body)
    return await group_service.get_group(db, group_id, current_user.user_id)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await group_service.delete_group(db, group_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{group_id}/join", response_model=GroupMemberResponse)
async def join_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupMemberResponse:
    membership, system_msg = await group_service.join_group(
        db, group_id, current_user.user_id
    )
    # Broadcast the persisted system message so anyone already in the room
    # sees it live without a refresh.
    await _broadcast(
        str(group_id),
        {"type": "message", "data": system_msg.model_dump(mode="json")},
    )
    return GroupMemberResponse(
        user_id=membership.user_id,
        display_name=current_user.display_name,
        role=membership.role,
        joined_at=membership.joined_at,
        is_muted=membership.is_muted,
    )


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    system_msg = await group_service.leave_group(
        db, group_id, current_user.user_id
    )
    await _broadcast(
        str(group_id),
        {"type": "message", "data": system_msg.model_dump(mode="json")},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{group_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_group_read(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await group_service.mark_read(db, group_id, current_user.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
async def list_members(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupMemberResponse]:
    return await group_service.get_members(db, group_id)


@router.post("/{group_id}/members/{target_user_id}/promote")
async def promote_member(
    group_id: uuid.UUID,
    target_user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    await group_service.promote_member(
        db, group_id, current_user.user_id, target_user_id
    )
    return {"ok": True}


@router.post("/{group_id}/members/{target_user_id}/mute")
async def mute_member(
    group_id: uuid.UUID,
    target_user_id: uuid.UUID,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    mute = bool(body.get("mute", True))
    await group_service.mute_member(
        db, group_id, current_user.user_id, target_user_id, mute
    )
    return {"ok": True, "is_muted": mute}


@router.post(
    "/{group_id}/members/{target_user_id}/remove",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    group_id: uuid.UUID,
    target_user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await group_service.remove_member(
        db, group_id, current_user.user_id, target_user_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{group_id}/messages", response_model=list[GroupMessageResponse]
)
async def list_messages(
    group_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    before: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupMessageResponse]:
    return await group_service.get_messages(
        db, group_id, current_user.user_id, limit=limit, before=before
    )


@router.delete(
    "/{group_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_message(
    group_id: uuid.UUID,
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await group_service.delete_message(
        db, group_id, current_user.user_id, message_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- WebSocket ----------

# In-process registry of live group sockets.
# {group_id: {user_id: WebSocket}}
group_connections: dict[str, dict[str, WebSocket]] = {}
# Parallel display-name registry so join/leave/online events have human-readable names
# without an extra DB hit.  Keyed identically to group_connections.
group_display_names: dict[str, dict[str, str]] = {}


async def _broadcast(
    group_id_str: str,
    payload: dict,
    *,
    exclude_user_id: str | None = None,
) -> None:
    """Send `payload` to every live socket in the group. Drop any that error out."""
    bucket = group_connections.get(group_id_str)
    if not bucket:
        return
    for uid, ws in list(bucket.items()):
        if exclude_user_id and uid == exclude_user_id:
            continue
        try:
            await ws.send_json(payload)
        except Exception:
            bucket.pop(uid, None)
            group_display_names.get(group_id_str, {}).pop(uid, None)


# ---------- AI orchestration (background tasks) ----------


async def _handle_ai_mention(group_id: uuid.UUID, question: str) -> None:
    """Run an @mention AI reply: emit ai_thinking, generate, broadcast the
    reply as a normal message, emit ai_done. Always emits ai_done even on
    failure so the frontend doesn't get stuck on the indicator."""
    gid = str(group_id)
    await _broadcast(gid, {"type": "ai_thinking"})
    try:
        async with async_session_maker() as db:
            ai_msg = await group_service.generate_ai_mention_response(
                db, group_id, question
            )
        if ai_msg is not None:
            await _broadcast(
                gid,
                {"type": "message", "data": ai_msg.model_dump(mode="json")},
            )
    except Exception:
        logger.exception("AI mention task failed for group %s", group_id)
    finally:
        await _broadcast(gid, {"type": "ai_done"})


async def _handle_auto_moderation(group_id: uuid.UUID) -> None:
    """Run the auto-moderator. Silent if no trigger fires (the common case),
    so we deliberately do NOT emit ai_thinking up front — only emit it once
    we've decided to actually call the model. To keep the flow simple, we
    do the trigger checks first and only then surface the indicator."""
    gid = str(group_id)
    try:
        async with async_session_maker() as db:
            ai_msg = await group_service.maybe_auto_moderate(db, group_id)
        if ai_msg is not None:
            await _broadcast(
                gid,
                {"type": "message", "data": ai_msg.model_dump(mode="json")},
            )
    except Exception:
        logger.exception("Auto-moderation task failed for group %s", group_id)


async def websocket_group(websocket: WebSocket, group_id: uuid.UUID):
    """WebSocket for a support-group chat. Token in query: ?token=jwt_string."""
    # ---- 1. JWT validation ----
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    try:
        payload = verify_token(token)
    except Exception:
        await websocket.close(code=4001)
        return
    sub = payload.get("sub")
    if not sub:
        await websocket.close(code=4001)
        return
    try:
        user_id = uuid.UUID(sub)
    except ValueError:
        await websocket.close(code=4001)
        return

    # ---- 2. Membership check + display-name lookup ----
    async with async_session_maker() as db:
        try:
            await group_service._get_active_group_or_404(db, group_id)
        except HTTPException:
            await websocket.close(code=4004)
            return

        member_row = (
            await db.execute(
                select(GroupMember).where(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if member_row is None:
            await websocket.close(code=4003)
            return

        user_row = (
            await db.execute(select(User).where(User.user_id == user_id))
        ).scalar_one_or_none()
        if user_row is None:
            await websocket.close(code=4001)
            return
        display_name = user_row.display_name

    await websocket.accept()

    gid = str(group_id)
    uid = str(user_id)
    group_connections.setdefault(gid, {})[uid] = websocket
    group_display_names.setdefault(gid, {})[uid] = display_name

    await _broadcast(
        gid,
        {"type": "user_joined", "user_id": uid, "display_name": display_name},
        exclude_user_id=uid,
    )

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                await websocket.send_json(
                    {"type": "error", "content": "Invalid message format"}
                )
                continue

            mtype = data.get("type")

            if mtype == "message":
                content = (data.get("content") or "").strip()
                if not content:
                    await websocket.send_json(
                        {"type": "error", "content": "Content cannot be empty"}
                    )
                    continue
                # Rate-limit before touching the DB. Sender-only error event so
                # other members aren't notified.
                if not group_service.check_rate_limit(user_id, group_id):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "content": "You're sending messages too fast. Please slow down.",
                        }
                    )
                    continue
                try:
                    async with async_session_maker() as db:
                        user_msg, system_msg, crisis_resources = (
                            await group_service.send_message(
                                db, group_id, user_id, content, display_name
                            )
                        )
                except HTTPException as e:
                    await websocket.send_json(
                        {"type": "error", "content": e.detail}
                    )
                    continue
                except Exception:
                    await websocket.send_json(
                        {"type": "error", "content": "Failed to send message"}
                    )
                    continue

                await _broadcast(
                    gid,
                    {
                        "type": "message",
                        "data": user_msg.model_dump(mode="json"),
                    },
                )
                if crisis_resources:
                    await _broadcast(
                        gid,
                        {"type": "crisis_alert", "resources": crisis_resources},
                    )
                if system_msg is not None:
                    await _broadcast(
                        gid,
                        {
                            "type": "message",
                            "data": system_msg.model_dump(mode="json"),
                        },
                    )

                # Fire AI orchestration in the background so the user message
                # round-trip stays snappy. Either an @mention reply OR an
                # auto-moderation pass — never both, to avoid the AI piling
                # multiple posts onto a single user message.
                if has_ai_mention(content):
                    question = strip_ai_mention(content)
                    if question:
                        asyncio.create_task(
                            _handle_ai_mention(group_id, question)
                        )
                else:
                    asyncio.create_task(_handle_auto_moderation(group_id))

            elif mtype == "get_online":
                names = group_display_names.get(gid, {})
                members = [
                    {"user_id": u, "display_name": n} for u, n in names.items()
                ]
                await websocket.send_json(
                    {"type": "online_members", "members": members}
                )

            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "content": f"Unknown message type: {mtype!r}",
                    }
                )
    finally:
        bucket = group_connections.get(gid)
        if bucket is not None:
            bucket.pop(uid, None)
            if not bucket:
                group_connections.pop(gid, None)
        names = group_display_names.get(gid)
        left_name = display_name
        if names is not None:
            left_name = names.pop(uid, display_name)
            if not names:
                group_display_names.pop(gid, None)
        await _broadcast(
            gid,
            {"type": "user_left", "user_id": uid, "display_name": left_name},
        )
