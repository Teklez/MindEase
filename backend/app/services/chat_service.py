import logging
import uuid

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Conversation, Message
from app.services.ai_client import AIClient


class ChatService:
    def __init__(self):
        self.ai_client = AIClient()
        self.SYSTEM_PROMPT = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """Load the base system prompt. Can be hardcoded or read from a file."""
        return """You are MindEase, a compassionate AI mental health support companion. 
You are NOT a therapist, doctor, or medical professional. You provide 
emotional support, coping strategies, and a safe space to talk.

Core rules:
- Always be empathetic, warm, and non-judgmental
- Never diagnose mental health conditions or prescribe medication
- Offer coping strategies: breathing exercises, grounding techniques, journaling prompts, cognitive reframing
- If the user seems in crisis, acknowledge their pain and encourage professional help
- Keep responses concise (2-4 paragraphs max)
- Ask thoughtful follow-up questions
- Remember context from the conversation
- Be culturally sensitive, users may be from Ethiopia
- Never say "as an AI language model" — say "as your MindEase companion"
"""

    async def create_conversation(
        self, db: AsyncSession, user_id: uuid.UUID, title: str | None = None
    ) -> Conversation:
        """Create a new conversation."""
        conversation = Conversation(user_id=user_id, title=title)
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        return conversation

    async def get_user_conversations(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> list[Conversation]:
        """Get all non-archived conversations for a user, newest first."""
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .where(Conversation.status != "archived")
            .order_by(Conversation.last_message_at.desc())
        )
        return list(result.scalars().all())

    async def get_conversation_with_messages(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Conversation:
        """Get conversation with messages. Verify user owns it.
        Raise 404 if not found, 403 if wrong user.
        """
        result = await db.execute(
            select(Conversation)
            .where(Conversation.conversation_id == conversation_id)
            .options(selectinload(Conversation.messages))
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        if conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to access this conversation",
            )
        return conversation

    async def process_message_stream(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
        *,
        user_lang: str | None = None,
    ):
        """Main orchestration method. Returns an async generator that yields dict events.
        user_lang: optional "en" or "am" from the frontend; when set, AI service uses it for translation.
        """
        try:
            # 1. Verify conversation belongs to user
            result = await db.execute(
                select(Conversation).where(
                    Conversation.conversation_id == conversation_id
                )
            )
            conversation = result.scalar_one_or_none()
            if conversation is None:
                yield {"type": "error", "content": "Conversation not found"}
                return
            if conversation.user_id != user_id:
                yield {"type": "error", "content": "Not allowed to access this conversation"}
                return

            # 2. Save user message to DB immediately
            user_message = Message(
                conversation_id=conversation_id,
                sender_type="user",
                content=content,
            )
            db.add(user_message)
            await db.commit()
            await db.refresh(user_message)

            # 3. Call ai_client.check_crisis(content)
            crisis_result = await self.ai_client.check_crisis(content)

            # 4. If crisis detected: flag and yield crisis_alert
            if crisis_result.get("is_crisis"):
                user_message.is_crisis_flagged = True
                conversation.crisis_detected = True
                await db.commit()
                yield {
                    "type": "crisis_alert",
                    "resources": crisis_result.get("resources", {}),
                }

            # 5. Build conversation context (last 15 messages, oldest first)
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.timestamp.desc())
                .limit(15)
            )
            last_messages = list(reversed(msg_result.scalars().all()))
            context = [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                *[
                    {
                        "role": "user" if m.sender_type == "user" else "assistant",
                        "content": m.content,
                    }
                    for m in last_messages
                ],
            ]

            # 6. Stream response from ai_client (pass user_lang so ai-service can translate when UI is Amharic)
            full_response: list[str] = []
            async for token in self.ai_client.generate_response_stream(context, user_lang=user_lang):
                full_response.append(token)
                yield {"type": "token", "content": token}

            full_text = "".join(full_response)

            # 7. Save AI message, update conversation, yield done
            ai_message = Message(
                conversation_id=conversation_id,
                sender_type="ai",
                content=full_text,
            )
            db.add(ai_message)
            await db.commit()
            await db.refresh(ai_message)

            conversation.last_message_at = ai_message.timestamp
            was_first_exchange = (conversation.total_messages or 0) == 0
            conversation.total_messages = (conversation.total_messages or 0) + 2
            if was_first_exchange:
                conversation.title = (content[:50] + "…") if len(content) > 50 else content
            await db.commit()

            yield {
                "type": "done",
                "message_id": str(ai_message.message_id),
            }

        except Exception as e:
            logger.exception("Chat stream failed: %s", e)
            yield {
                "type": "error",
                "content": "I'm having trouble right now. Please try again in a moment.",
            }

    async def archive_conversation(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Set conversation status to 'archived'. Verify ownership."""
        result = await db.execute(
            select(Conversation).where(
                Conversation.conversation_id == conversation_id
            )
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        if conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to access this conversation",
            )
        conversation.status = "archived"
        await db.commit()

    async def update_conversation_title(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str | None,
    ) -> Conversation:
        """Update conversation title. Verify ownership."""
        result = await db.execute(
            select(Conversation).where(
                Conversation.conversation_id == conversation_id
            )
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        if conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to access this conversation",
            )
        conversation.title = title
        await db.commit()
        await db.refresh(conversation)
        return conversation
