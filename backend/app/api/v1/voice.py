import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, status
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, verify_token
from app.database import async_session_maker, get_db
from app.models import Conversation, User
from app.schemas.chat import ConversationResponse
from app.schemas.voice import VoiceConversationCreate
from app.services.voice_service import VoiceService

router = APIRouter()


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_or_reuse_voice_conversation(
    body: VoiceConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new voice conversation, OR reuse an existing one when
    `conversation_id` is provided (the "Continue this call" path)."""
    if body.conversation_id is not None:
        result = await db.execute(
            select(Conversation).where(
                Conversation.conversation_id == body.conversation_id,
            )
        )
        conv = result.scalar_one_or_none()
        if conv is None or conv.user_id != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        if conv.conversation_type != "voice":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conversation is not a voice conversation",
            )
        conv.attrs = {
            **(conv.attrs or {}),
            "persona_id": body.persona_id,
            "persona_name": body.persona_name,
            "persona_blurb": body.persona_blurb,
            "voice": body.voice,
        }
        await db.commit()
        await db.refresh(conv)
        return ConversationResponse.model_validate(conv)

    conv = Conversation(
        user_id=current_user.user_id,
        title=None,
        conversation_type="voice",
        attrs={
            "persona_id": body.persona_id,
            "persona_name": body.persona_name,
            "persona_blurb": body.persona_blurb,
            "voice": body.voice,
        },
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConversationResponse.model_validate(conv)


# --- WebSocket: /ws/voice/{conversation_id}?token=... ---

async def websocket_voice(websocket: WebSocket, conversation_id: uuid.UUID):
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

    async with async_session_maker() as db:
        result = await db.execute(
            select(Conversation).where(
                Conversation.conversation_id == conversation_id
            )
        )
        conv = result.scalar_one_or_none()
        if conv is None or conv.user_id != user_id or conv.conversation_type != "voice":
            await websocket.close(code=4001)
            return
        attrs = conv.attrs or {}
        persona_id = attrs.get("persona_id") or ""
        persona_name = attrs.get("persona_name") or "Serenity"
        persona_blurb = attrs.get("persona_blurb") or ""
        voice = attrs.get("voice") or "Kore"

    await websocket.accept()

    async def send_event(payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:
            pass

    service = VoiceService(
        user_id=user_id,
        conversation_id=conversation_id,
        persona_id=persona_id,
        persona_name=persona_name,
        persona_blurb=persona_blurb,
        voice=voice,
        send_event=send_event,
    )

    try:
        await service.open()
    except Exception as exc:
        import traceback
        print(f"[voice] service.open FAILED: {exc}\n{traceback.format_exc()}", flush=True)
        await websocket.close(code=1011)
        return

    try:
        while True:
            try:
                msg = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                continue

            mtype = msg.get("type")
            if mtype == "audio":
                data = msg.get("data")
                mime = msg.get("mime") or "audio/pcm;rate=16000"
                if isinstance(data, str):
                    await service.push_audio(data, mime=mime)
            elif mtype == "activity_start":
                await service.activity_start()
            elif mtype == "activity_end":
                await service.activity_end()
    finally:
        await service.close()
