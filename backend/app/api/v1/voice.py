import base64
import hashlib
import json
import logging
import pathlib
import re
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, status
from fastapi.websockets import WebSocketDisconnect
from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import get_current_user, verify_token
from app.database import async_session_maker, get_db
from app.models import Conversation, User
from app.schemas.chat import ConversationResponse
from app.schemas.voice import TTSRequest, TTSResponse, VoiceConversationCreate
from app.services.voice_service import VoiceService

router = APIRouter()
logger = logging.getLogger(__name__)

_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"
_TTS_VOICES = {
    "Kore", "Aoede", "Charon", "Fenrir", "Puck", "Orus", "Zephyr",
    "Leda", "Algenib", "Iapetus",
}
_PCM_RATE_RE = re.compile(r"rate=(\d+)")


# ── TTS disk cache ───────────────────────────────────────────────────────────
# Gemini TTS is on a 100 req/day free-tier quota. Persona intros are static
# (same text, same voice -> identical audio every time), so cache aggressively
# to disk. A single round of 5 personas + 2 locales = 10 cache files that live
# forever; after that, zero quota usage for previews.
_TTS_CACHE_DIR = pathlib.Path("/app/tts_cache")
_TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _tts_cache_key(text: str, voice: str) -> str:
    h = hashlib.sha256()
    h.update(voice.encode("utf-8"))
    h.update(b"\x00")
    h.update(text.encode("utf-8"))
    return h.hexdigest()[:24]


def _tts_cache_read(text: str, voice: str) -> TTSResponse | None:
    key = _tts_cache_key(text, voice)
    path = _TTS_CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        return TTSResponse(audio=data["audio"], sample_rate=int(data["sample_rate"]))
    except Exception:
        return None


def _tts_cache_write(text: str, voice: str, audio_b64: str, sample_rate: int) -> None:
    key = _tts_cache_key(text, voice)
    path = _TTS_CACHE_DIR / f"{key}.json"
    try:
        path.write_text(json.dumps({"audio": audio_b64, "sample_rate": sample_rate}))
    except Exception as exc:
        print(f"[tts] cache write failed: {exc}", flush=True)



@router.post("/tts", response_model=TTSResponse)
async def synthesize_tts(
    body: TTSRequest,
    current_user: User = Depends(get_current_user),
) -> TTSResponse:
    """One-shot Gemini TTS used by the picker preview. Keeps the API key on
    the server so the frontend never ships it. Mirrors the Gemini REST
    `generateContent` shape but returns just the bytes the client needs."""
    if body.voice not in _TTS_VOICES:
        raise HTTPException(status_code=400, detail=f"Unsupported voice: {body.voice}")

    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="TTS unavailable (server missing GEMINI_API_KEY)",
        )

    # Disk cache check before touching Gemini. Persona intros are static, so
    # the same (text, voice) pair always produces identical bytes.
    cached = _tts_cache_read(body.text, body.voice)
    if cached is not None:
        print(f"[tts] cache HIT voice={body.voice} key={_tts_cache_key(body.text, body.voice)}", flush=True)
        return cached

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    text_preview = body.text[:60].replace(chr(10), " ")
    t0 = time.perf_counter()
    print(f"[tts] start voice={body.voice} len={len(body.text)} preview={text_preview!r}", flush=True)
    try:
        response = await client.aio.models.generate_content(
            model=_GEMINI_TTS_MODEL,
            contents=body.text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=body.voice,
                        ),
                    ),
                ),
            ),
        )
    except Exception as exc:  # noqa: BLE001
        dt = time.perf_counter() - t0
        import traceback
        err_str = str(exc)
        print(f"[tts] FAILED voice={body.voice} after={dt:.2f}s err={exc!r}", flush=True)
        print(traceback.format_exc(), flush=True)
        # Friendlier message for the daily-quota case. Gemini returns
        # "429 RESOURCE_EXHAUSTED" with a retryDelay in the body.
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            retry_match = re.search(r"retry in (\d+h(?:\d+m)?(?:\d+(?:\.\d+)?s)?)", err_str)
            retry_hint = f" Retry in {retry_match.group(1)}." if retry_match else ""
            raise HTTPException(
                status_code=429,
                detail=f"Voice preview unavailable — Gemini TTS daily quota exhausted.{retry_hint}",
            ) from exc
        raise HTTPException(status_code=502, detail=f"Gemini TTS failed: {exc}") from exc
    dt = time.perf_counter() - t0
    print(f"[tts] OK voice={body.voice} in={dt:.2f}s", flush=True)

    try:
        part = response.candidates[0].content.parts[0]
        inline = part.inline_data
        if inline is None or not inline.data:
            raise HTTPException(status_code=502, detail="Gemini TTS returned no audio")
        pcm_bytes: bytes = inline.data
        mime_type: str = inline.mime_type or ""
    except (AttributeError, IndexError) as exc:
        raise HTTPException(status_code=502, detail=f"Malformed Gemini TTS response: {exc}") from exc

    rate_match = _PCM_RATE_RE.search(mime_type)
    sample_rate = int(rate_match.group(1)) if rate_match else 24000

    audio_b64 = base64.b64encode(pcm_bytes).decode("ascii")
    # Write to cache so the next request for this (text, voice) hits disk.
    _tts_cache_write(body.text, body.voice, audio_b64, sample_rate)

    return TTSResponse(audio=audio_b64, sample_rate=sample_rate)


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
            "locale": body.locale or (conv.attrs or {}).get("locale") or "en",
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
            "locale": body.locale or "en",
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
        locale = attrs.get("locale") or "en"

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
        locale=locale,
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
