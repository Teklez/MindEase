import uuid

from fastapi import APIRouter, Depends, status, WebSocket
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, verify_token
from app.database import get_db, async_session_maker
from app.models import User, Conversation
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    ConversationWithMessages,
)
from app.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new conversation. Optional title."""
    conversation = await chat_service.create_conversation(
        db, current_user.user_id, title=body.title
    )
    return ConversationResponse.model_validate(conversation)


@router.get(
    "/conversations",
    response_model=list[ConversationResponse],
)
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List current user's conversations, newest first."""
    conversations = await chat_service.get_user_conversations(
        db, current_user.user_id
    )
    return [ConversationResponse.model_validate(c) for c in conversations]


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationWithMessages,
)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a conversation with messages. Must own the conversation."""
    conversation = await chat_service.get_conversation_with_messages(
        db, conversation_id, current_user.user_id
    )
    return ConversationWithMessages.model_validate(conversation)


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
)
async def update_conversation(
    conversation_id: uuid.UUID,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update conversation (e.g. title). Must own the conversation."""
    conversation = await chat_service.update_conversation_title(
        db, conversation_id, current_user.user_id, body.title
    )
    return ConversationResponse.model_validate(conversation)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete the conversation, all messages, and all memory chunks
    tied to it. Cannot be undone."""
    await chat_service.delete_conversation(
        db, conversation_id, current_user.user_id
    )


# --- WebSocket handler (registered in main.py at /ws/chat/{conversation_id}) ---

async def websocket_chat(websocket: WebSocket, conversation_id: uuid.UUID):
    """WebSocket endpoint for chat. Token in query: ?token=jwt_string."""
    # Authentication: token from query
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

    # Verify conversation belongs to user (quick check with a short-lived session)
    async with async_session_maker() as db:
        result = await db.execute(
            select(Conversation).where(
                Conversation.conversation_id == conversation_id
            )
        )
        conv = result.scalar_one_or_none()
        if conv is None or conv.user_id != user_id:
            await websocket.close(code=4001)
            return

    await websocket.accept()

    while True:
        try:
            data = await websocket.receive_json()
        except WebSocketDisconnect:
            break
        except Exception:
            await websocket.send_json({"type": "error", "content": "Invalid message format"})
            continue

        if data.get("type") != "message":
            await websocket.send_json({"type": "error", "content": "Expected type: message"})
            continue
        content = (data.get("content") or "").strip()
        if not content:
            await websocket.send_json({"type": "error", "content": "Content cannot be empty"})
            continue
        user_lang = data.get("locale") if data.get("locale") in ("en", "am") else None

        try:
            async with async_session_maker() as db:
                async for event in chat_service.process_message_stream(
                    db, conversation_id, user_id, content, user_lang=user_lang
                ):
                    await websocket.send_json(event)
        except Exception:
            await websocket.send_json({"type": "error", "content": "Something went wrong"})
