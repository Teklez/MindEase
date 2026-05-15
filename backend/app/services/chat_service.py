import asyncio
import logging
import uuid

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session_maker
from app.models import Conversation, MemoryChunk, Message
from app.models.mood_entry import MoodEntry
from app.services.ai_client import AIClient
from app.services.fact_extractor import extract_and_index_facts
from app.services.memory_service import memory_service
from app.services.profile_service import profile_service


def _format_chunks(chunks: list) -> str:
    """Render retrieved MemoryChunks as `[YYYY-MM-DD, kind] text` lines so the LLM
    can cite them by time."""
    lines: list[str] = []
    for c in chunks:
        d = c.created_at.date().isoformat()
        text = (c.text or "").strip().replace("\n", " ")
        if len(text) > 500:
            text = text[:497] + "..."
        lines.append(f"[{d}, {c.source_kind}] {text}")
    return "\n".join(lines)


async def _background_index_ai_message(
    *, user_id: uuid.UUID, conversation_id: uuid.UUID,
    message_id: uuid.UUID, text: str,
) -> None:
    """Embed and index an AI message in a fresh session, after the request has closed."""
    if not text or not text.strip():
        return
    try:
        async with async_session_maker() as db:
            await memory_service.index(
                db,
                user_id=user_id,
                source_kind="message",
                source_id=message_id,
                conversation_id=conversation_id,
                text=text,
                attrs={"sender": "ai"},
            )
            await db.commit()
    except Exception as exc:
        logger.warning("background ai-message index failed: %s", exc)


def _simple_emotion_to_mood(text: str) -> int:
    """Keyword-based emotion detection — returns a mood level 1-5."""
    t = text.lower()
    if any(w in t for w in [
        "hopeless", "worthless", "can't go on", "end it", "give up",
        "terrible", "awful", "devastated", "helpless", "meaningless",
    ]):
        return 1
    if any(w in t for w in [
        "sad", "depress", "lonely", "crying", "anxious", "worried",
        "stress", "angry", "frustrated", "scared", "overwhelmed",
        "upset", "hurt", "pain", "miserable",
    ]):
        return 2
    if any(w in t for w in [
        "okay", " ok ", "alright", "fine", "so-so", "meh", "neutral",
        "managing", "coping",
    ]):
        return 3
    if any(w in t for w in [
        "good", "well", "better", "happy", "positive", "calm",
        "relaxed", "hopeful", "grateful", "content", "peaceful",
    ]):
        return 4
    if any(w in t for w in [
        "great", "amazing", "excellent", "wonderful", "fantastic",
        "excited", "joy", "joyful", "thrilled", "elated", "awesome",
    ]):
        return 5
    return 3


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
        """Get all conversations for a user, newest first."""
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
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

            # 3. Parallel: crisis check + user-content embedding
            crisis_task = asyncio.create_task(self.ai_client.check_crisis(content))
            embed_task = asyncio.create_task(self.ai_client.embed([content]))
            user_vec: list[float] | None
            try:
                crisis_result, vecs = await asyncio.gather(crisis_task, embed_task)
                user_vec = vecs[0] if vecs else None
            except Exception as exc:
                logger.warning("embed/crisis parallel failed: %s", exc)
                try:
                    crisis_result = await self.ai_client.check_crisis(content)
                except Exception:
                    crisis_result = {"is_crisis": False}
                user_vec = None

            # 4. If crisis detected: flag and yield crisis_alert
            if crisis_result.get("is_crisis"):
                user_message.is_crisis_flagged = True
                conversation.crisis_detected = True
                await db.commit()
                yield {
                    "type": "crisis_alert",
                    "resources": crisis_result.get("resources", {}),
                }

            # 4a. Index the user message chunk (reuse the embedding from step 3).
            if user_vec is not None:
                try:
                    await memory_service.index(
                        db,
                        user_id=user_id,
                        source_kind="message",
                        source_id=user_message.message_id,
                        conversation_id=conversation_id,
                        text=content,
                        embedding=user_vec,
                        attrs={"sender": "user", "lang": user_lang},
                    )
                    await db.commit()
                except Exception as exc:
                    logger.warning("index user message failed: %s", exc)

            # 4b. Extract durable user facts in the background. Failure modes
            # must not affect the chat turn — this task owns its own session.
            asyncio.create_task(
                extract_and_index_facts(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    source_message_id=user_message.message_id,
                    content=content,
                )
            )

            # 5. Build layered conversation context.
            profile_block = await profile_service.build_profile_block(db, user_id)
            retrieved: list = []
            if user_vec is not None:
                try:
                    retrieved = await memory_service.retrieve(
                        db,
                        user_id=user_id,
                        query_vec=user_vec,
                        k=6,
                        kinds=["message", "mood_note", "assessment_result", "summary", "profile_fact"],
                        exclude_conversation_id=conversation_id,
                    )
                except Exception as exc:
                    logger.warning("retrieve failed: %s", exc)

            # Last 10 messages of the current conversation, oldest first.
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.timestamp.desc())
                .limit(10)
            )
            last_messages = list(reversed(msg_result.scalars().all()))

            system_blocks: list[str] = [self.SYSTEM_PROMPT]
            if profile_block:
                system_blocks.append("## About this user\n" + profile_block)
            if retrieved:
                system_blocks.append(
                    "## Relevant past moments\n" + _format_chunks(retrieved)
                )

            context = [
                {"role": "system", "content": "\n\n".join(system_blocks)},
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

            # Index the AI message in the background — must not delay the `done` event.
            asyncio.create_task(
                _background_index_ai_message(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    message_id=ai_message.message_id,
                    text=full_text,
                )
            )

            conversation.last_message_at = ai_message.timestamp
            prev_total = conversation.total_messages or 0
            was_first_exchange = prev_total == 0
            conversation.total_messages = prev_total + 2
            should_auto_log_mood = prev_total < 10 and conversation.total_messages >= 10
            if was_first_exchange:
                conversation.title = (content[:50] + "…") if len(content) > 50 else content
            await db.commit()

            yield {
                "type": "done",
                "message_id": str(ai_message.message_id),
            }

            # Auto-log mood once when conversation reaches 10 messages (non-blocking)
            if should_auto_log_mood:
                try:
                    mood_level = _simple_emotion_to_mood(content)
                    auto_entry = MoodEntry(
                        user_id=user_id,
                        mood_level=mood_level,
                        note="Auto-logged from chat session",
                        entry_source="automatic",
                    )
                    db.add(auto_entry)
                    await db.commit()
                    logger.info("Auto-logged mood %d for user %s", mood_level, user_id)
                except Exception as exc:
                    logger.warning("Auto mood log failed: %s", exc)

        except Exception as e:
            logger.exception("Chat stream failed: %s", e)
            yield {
                "type": "error",
                "content": "I'm having trouble right now. Please try again in a moment.",
            }

    async def delete_conversation(
        self,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        """Permanently delete a conversation, all its messages (cascade via FK),
        and every memory_chunks row tied to it for this user. Atomic."""
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
        # memory_chunks has no FK to conversations, so cascade can't help — scrub
        # explicitly. Scope by user_id too as defense in depth.
        await db.execute(
            delete(MemoryChunk).where(
                MemoryChunk.user_id == user_id,
                MemoryChunk.conversation_id == conversation_id,
            )
        )
        # Bypass ORM relationship handling (which would try to null out
        # messages.conversation_id before delete and violate NOT NULL).
        # The DB-level ondelete=CASCADE on messages_conversation_id_fkey
        # handles message cleanup.
        await db.execute(
            delete(Conversation).where(
                Conversation.conversation_id == conversation_id
            )
        )
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
