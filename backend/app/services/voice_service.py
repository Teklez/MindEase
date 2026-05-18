from __future__ import annotations
import asyncio
import base64
import logging
import uuid
from typing import Any, Awaitable, Callable

from google import genai
from google.genai import types
from sqlalchemy import select

from app.config import get_settings
from app.database import async_session_maker
from app.models import Conversation, Message
from app.services.ai_client import AIClient
from app.services.memory_service import memory_service
from app.services.voice_context_service import voice_context_service

logger = logging.getLogger(__name__)


# ---------- helpers ----------

def _build_persona_prompt(persona_name: str, persona_blurb: str) -> str:
    return (
        f"You are {persona_name}, a warm and empathetic AI wellness companion. "
        f"Your style: {persona_blurb or 'warm, attentive, easy to talk to.'} "
        f"Stay in character as {persona_name} throughout — if asked your name, "
        f"you are {persona_name}, never another assistant. "
        "You help people explore feelings, offer emotional support, and use "
        "CBT/mindfulness-style guidance. Keep responses conversational, under "
        "3 sentences unless more detail is truly needed. Never diagnose. "
        "Validate feelings first."
    )


def _format_chunks(chunks: list) -> str:
    lines: list[str] = []
    for c in chunks:
        d = c.created_at.date().isoformat()
        text = (c.text or "").strip().replace("\n", " ")
        if len(text) > 500:
            text = text[:497] + "..."
        lines.append(f"[{d}, {c.source_kind}] {text}")
    return "\n".join(lines)


# ---------- service ----------

class VoiceService:
    """One instance per WS connection. Not a singleton."""

    def __init__(
        self,
        *,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        persona_name: str,
        persona_blurb: str,
        persona_id: str,
        voice: str,
        send_event: Callable[[dict], Awaitable[None]],
    ) -> None:
        self.user_id = user_id
        self.conversation_id = conversation_id
        self.persona_id = persona_id
        self.persona_name = persona_name
        self.persona_blurb = persona_blurb
        self.voice = voice
        self.send_event = send_event

        self._settings = get_settings()
        self._ai_client = AIClient()
        self._client: genai.Client | None = None
        self._session: Any | None = None
        self._session_ctx: Any | None = None
        self._receive_task: asyncio.Task | None = None
        self._closed_by_user: bool = False

        # Per-turn transcript buffers (text from Gemini's transcription streams).
        self._user_buf: list[str] = []
        self._ai_buf: list[str] = []

    async def _build_system_instruction(self) -> str:
        async with async_session_maker() as db:
            dossier = await voice_context_service.build(db, self.user_id)
            seed_query = f"voice conversation with {self.persona_name}: {self.persona_blurb}"
            try:
                retrieved = await memory_service.retrieve(
                    db,
                    user_id=self.user_id,
                    query_text=seed_query,
                    k=10,
                    kinds=[
                        "message", "mood_note", "assessment_result",
                        "summary", "profile_fact", "voice_transcript",
                    ],
                    exclude_conversation_id=None,
                )
            except Exception as exc:
                logger.warning("voice retrieve failed: %s", exc)
                retrieved = []

        blocks: list[str] = [_build_persona_prompt(self.persona_name, self.persona_blurb)]
        if dossier:
            blocks.append(dossier)
        if retrieved:
            blocks.append("## Relevant past moments\n" + _format_chunks(retrieved))
        assembled = "\n\n".join(blocks)
        logger.info(
            "voice system_instruction assembled for user=%s persona=%s len=%d",
            self.user_id, self.persona_name, len(assembled),
        )
        logger.debug("voice system_instruction body:\n%s", assembled)
        return assembled

    async def _open_live_session(self) -> None:
        """Open one underlying Gemini Live session. Does NOT start the receive
        loop — the supervisor manages that. Safe to call multiple times across
        the lifetime of one WS connection (transparent reconnect)."""
        system_instruction = await self._build_system_instruction()
        if self._client is None:
            self._client = genai.Client(api_key=self._settings.GEMINI_API_KEY)
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=system_instruction,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(disabled=True),
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice),
                ),
            ),
        )
        self._session_ctx = self._client.aio.live.connect(
            model=self._settings.GEMINI_LIVE_MODEL,
            config=config,
        )
        self._session = await self._session_ctx.__aenter__()
        print(f"[voice] Live session OPEN conv={self.conversation_id} persona={self.persona_name} voice={self.voice}", flush=True)

    async def _close_live_session(self) -> None:
        if self._session_ctx is not None:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception as exc:
                print(f"[voice] _close_live_session __aexit__ failed: {exc}", flush=True)
        self._session = None
        self._session_ctx = None

    async def open(self) -> None:
        if not self._settings.GEMINI_API_KEY:
            await self.send_event({"type": "error", "message": "Voice unavailable (server missing key)"})
            raise RuntimeError("GEMINI_API_KEY not set")
        # Open the first Live session synchronously so we can fail fast.
        await self._open_live_session()
        await self.send_event({"type": "ready"})
        # Supervisor stays alive for the lifetime of the WS, reopening the
        # Live session if Gemini closes it after a turn.
        self._closed_by_user = False
        self._receive_task = asyncio.create_task(self._supervisor_loop())

    async def close(self) -> None:
        self._closed_by_user = True
        if self._receive_task is not None:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except (asyncio.CancelledError, Exception):
                pass
            self._receive_task = None
        await self._close_live_session()

    async def _supervisor_loop(self) -> None:
        """Keep a Live session alive across multiple Gemini turns. The native-
        audio model closes the WS after each turn; we open a fresh one so the
        user's next utterance lands on a ready session."""
        cycle = 0
        while not self._closed_by_user:
            cycle += 1
            if cycle > 1:
                # First session was already opened in `open()`.
                try:
                    await self._open_live_session()
                except Exception as exc:
                    print(f"[voice] reconnect FAILED: {exc}", flush=True)
                    await self.send_event({"type": "error", "message": "voice reconnect failed"})
                    return
                # Tell the client the new Live session is ready to receive the
                # user's next utterance. Without this, the frontend has no way
                # to know the brief swap window has ended, and audio pushed
                # during it would be silently dropped by push_audio (session
                # is None).
                await self.send_event({"type": "ready"})
            try:
                await self._receive_loop()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                print(f"[voice] receive_loop crashed cycle={cycle}: {exc}", flush=True)
            # receive_loop ended (cleanly or otherwise). Tear down this Live
            # session before opening a new one on the next iteration.
            await self._close_live_session()
            if self._closed_by_user:
                break
            print(f"[voice] reconnecting (cycle {cycle + 1}) conv={self.conversation_id}", flush=True)

    # ----- inbound from browser -----

    async def push_audio(self, pcm_b64: str, mime: str = "audio/pcm;rate=16000") -> None:
        if self._session is None:
            return
        try:
            await self._session.send_realtime_input(
                audio=types.Blob(data=base64.b64decode(pcm_b64), mime_type=mime),
            )
        except Exception as exc:
            logger.warning("send_realtime_input failed: %s", exc)
            await self.send_event({"type": "error", "message": "audio relay failed"})

    async def activity_start(self) -> None:
        if self._session is not None:
            await self._session.send_realtime_input(activity_start=types.ActivityStart())

    async def activity_end(self) -> None:
        if self._session is not None:
            await self._session.send_realtime_input(activity_end=types.ActivityEnd())

    # ----- outbound to browser -----

    async def _receive_loop(self) -> None:
        print(f"[voice] receive_loop START conv={self.conversation_id}", flush=True)
        turn_idx = 0
        try:
            async for response in self._session.receive():
                if getattr(response, "data", None):
                    pcm_b64 = base64.b64encode(response.data).decode("ascii")
                    await self.send_event({
                        "type": "audio",
                        "data": pcm_b64,
                        "sample_rate": 24000,
                    })

                sc = getattr(response, "server_content", None)
                if sc is None:
                    continue

                in_t = getattr(sc, "input_transcription", None)
                if in_t is not None and getattr(in_t, "text", None):
                    self._user_buf.append(in_t.text)
                    await self.send_event({
                        "type": "transcript",
                        "role": "user",
                        "text": in_t.text,
                    })

                out_t = getattr(sc, "output_transcription", None)
                if out_t is not None and getattr(out_t, "text", None):
                    self._ai_buf.append(out_t.text)
                    await self.send_event({
                        "type": "transcript",
                        "role": "ai",
                        "text": out_t.text,
                    })

                if getattr(sc, "turn_complete", False):
                    turn_idx += 1
                    # Snapshot the per-turn transcript buffers before kicking
                    # off the background flush — otherwise next-turn tokens
                    # would mix in while the DB write is still running.
                    user_text = "".join(self._user_buf).strip()
                    ai_text = "".join(self._ai_buf).strip()
                    self._user_buf.clear()
                    self._ai_buf.clear()
                    print(
                        f"[voice] turn_complete #{turn_idx} u={len(user_text)} a={len(ai_text)}",
                        flush=True,
                    )
                    # Fire-and-forget: keep the receive loop unblocked so
                    # Gemini doesn't close the session from a stalled WS read.
                    asyncio.create_task(self._flush_turn_bg(user_text, ai_text))
            print(f"[voice] receive_loop ENDED cleanly turns={turn_idx} conv={self.conversation_id}", flush=True)
        except asyncio.CancelledError:
            print(f"[voice] receive_loop CANCELLED conv={self.conversation_id}", flush=True)
            raise
        except Exception as exc:
            import traceback
            print(f"[voice] receive_loop EXC: {exc}\n{traceback.format_exc()}", flush=True)
            await self.send_event({"type": "error", "message": "voice receive failed"})

    async def _flush_turn_bg(self, user_text: str, ai_text: str) -> None:
        """Persist + index a turn off the receive loop's hot path."""
        from datetime import datetime, timezone

        try:
            if not user_text and not ai_text:
                await self.send_event({"type": "turn_complete"})
                return
            await self._flush_turn_inner(user_text, ai_text, datetime, timezone)
        except Exception:
            import traceback
            print(f"[voice] _flush_turn_bg EXC:\n{traceback.format_exc()}", flush=True)
            try:
                await self.send_event({"type": "turn_complete"})
            except Exception:
                pass

    async def _flush_turn_inner(
        self,
        user_text: str,
        ai_text: str,
        datetime,
        timezone,
    ) -> None:

        crisis: dict = {"is_crisis": False}
        user_msg_id: uuid.UUID | None = None
        ai_msg_id: uuid.UUID | None = None

        # ----- Phase A: write messages + bookkeeping (its own session) -----
        try:
            async with async_session_maker() as db:
                if user_text:
                    try:
                        crisis = await self._ai_client.check_crisis(user_text)
                    except Exception:
                        crisis = {"is_crisis": False}

                now = datetime.now(timezone.utc)
                if user_text:
                    user_msg = Message(
                        conversation_id=self.conversation_id,
                        sender_type="user",
                        content=user_text[:5000],
                        is_crisis_flagged=bool(crisis.get("is_crisis")),
                    )
                    db.add(user_msg)
                    await db.flush()
                    user_msg_id = user_msg.message_id

                if ai_text:
                    ai_msg = Message(
                        conversation_id=self.conversation_id,
                        sender_type="ai",
                        content=ai_text[:5000],
                    )
                    db.add(ai_msg)
                    await db.flush()
                    ai_msg_id = ai_msg.message_id

                conv_res = await db.execute(
                    select(Conversation).where(
                        Conversation.conversation_id == self.conversation_id
                    )
                )
                conv = conv_res.scalar_one_or_none()
                if conv is not None:
                    conv.last_message_at = now
                    conv.total_messages = (conv.total_messages or 0) + int(bool(user_msg_id)) + int(bool(ai_msg_id))
                    if crisis.get("is_crisis"):
                        conv.crisis_detected = True
                    if not conv.title and user_text:
                        conv.title = (user_text[:50] + "…") if len(user_text) > 50 else user_text

                await db.commit()
                print(f"[voice] flush_turn DB commit OK user_id={user_msg_id} ai_id={ai_msg_id}", flush=True)
        except Exception as exc:
            import traceback
            print(f"[voice] flush_turn DB EXC: {exc}\n{traceback.format_exc()}", flush=True)

        # ----- Phase B: best-effort indexing (each in its own session so an
        # embedding hang/fail can't poison anything else) -----
        if user_msg_id is not None:
            try:
                async with async_session_maker() as db:
                    await memory_service.index(
                        db,
                        user_id=self.user_id,
                        source_kind="voice_transcript",
                        source_id=user_msg_id,
                        conversation_id=self.conversation_id,
                        text=user_text[:5000],
                        attrs={"sender": "user", "channel": "voice",
                               "persona_id": self.persona_id, "voice": self.voice},
                    )
                    await db.commit()
            except Exception as exc:
                print(f"[voice] index user turn failed: {exc}", flush=True)

        if ai_msg_id is not None:
            try:
                async with async_session_maker() as db:
                    await memory_service.index(
                        db,
                        user_id=self.user_id,
                        source_kind="voice_transcript",
                        source_id=ai_msg_id,
                        conversation_id=self.conversation_id,
                        text=ai_text[:5000],
                        attrs={"sender": "ai", "channel": "voice",
                               "persona_id": self.persona_id, "voice": self.voice},
                    )
                    await db.commit()
            except Exception as exc:
                print(f"[voice] index ai turn failed: {exc}", flush=True)

        if crisis.get("is_crisis"):
            await self.send_event({
                "type": "crisis_alert",
                "resources": crisis.get("resources", {}),
            })

        await self.send_event({"type": "turn_complete"})
