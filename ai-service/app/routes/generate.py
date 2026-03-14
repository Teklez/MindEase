import asyncio
import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.services.inference import InferenceService
from app.services.translator import TranslationService

router = APIRouter()
inference = InferenceService()
translator = TranslationService()

# Path to system prompt: ai-service/prompts/system.txt (from repo root) or /app/prompts (Docker)
_PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"
if not _PROMPTS_DIR.exists():
    _PROMPTS_DIR = Path("/app/prompts")
_SYSTEM_PROMPT_PATH = _PROMPTS_DIR / "system.txt"


def _load_system_prompt() -> str:
    if _SYSTEM_PROMPT_PATH.exists():
        return _SYSTEM_PROMPT_PATH.read_text().strip()
    return "You are MindEase, a compassionate AI mental health support companion."


def _last_user_message(messages: list[dict]) -> tuple[int | None, str]:
    """Return (index, content) of last user message, or (None, '')."""
    for i in range(len(messages) - 1, -1, -1):
        if (messages[i].get("role") or "").lower() == "user":
            return i, (messages[i].get("content") or "").strip()
    return None, ""


def _replace_last_user_content(messages: list[dict], new_content: str) -> list[dict]:
    """Return a new list with the last user message content replaced."""
    out = [dict(m) for m in messages]
    for i in range(len(out) - 1, -1, -1):
        if (out[i].get("role") or "").lower() == "user":
            out[i] = {**out[i], "content": new_content}
            break
    return out


async def _stream_words(text: str, delay_sec: float = 0.05):
    """Yield text word-by-word with small delay to simulate streaming."""
    for word in text.split():
        yield word + " "
        await asyncio.sleep(delay_sec)


@router.post("")
async def generate(
    body: dict,
):
    """POST /generate — main inference endpoint.
    Body: {"messages": [...], "stream": bool, "user_lang": "am"|"en"|null}
    When user_lang is "am", user message is translated to English for Ollama
    and the AI response is translated back to Amharic.
    """
    messages = list(body.get("messages") or [])
    stream = body.get("stream", False)
    user_lang = body.get("user_lang")
    settings = get_settings()

    # Prepend MindEase system prompt if no system message present
    has_system = any(
        (m.get("role") or "").lower() == "system" for m in messages
    )
    if not has_system:
        system_content = _load_system_prompt()
        messages = [{"role": "system", "content": system_content}] + messages

    # Resolve user language: explicit or detect from last user message
    last_idx, last_user_content = _last_user_message(messages)
    if user_lang is None and last_user_content:
        user_lang = translator.detect_language(last_user_content)
    if user_lang not in ("am", "en"):
        user_lang = "en"

    # Inject language instruction into system message so the LLM responds in the correct language
    lang_instruction = (
        "Always respond in Amharic (አማርኛ)."
        if user_lang == "am"
        else "Always respond in English, regardless of the language of previous messages."
    )
    messages = [dict(m) for m in messages]
    system_injected = False
    for m in messages:
        if (m.get("role") or "").lower() == "system":
            m["content"] = m["content"].rstrip() + f"\n- {lang_instruction}"
            system_injected = True
            break
    if not system_injected:
        messages = [{"role": "system", "content": lang_instruction}] + messages

    # If Amharic: translate last user message to English for Ollama
    if user_lang == "am" and last_user_content:
        result = await translator.translate_to_english(last_user_content)
        if result.get("was_translated") and result.get("translated"):
            messages = _replace_last_user_content(messages, result["translated"])

    if not stream:
        full = await inference.generate_response(messages)
        if user_lang == "am":
            full = await translator.translate_from_english(full, "am")
        return {"response": full, "model": settings.MODEL_NAME}

    # Streaming
    if user_lang == "am":
        # Collect full English response, translate to Amharic, then stream word-by-word
        full_english = await inference.generate_response(messages)
        full_amharic = await translator.translate_from_english(full_english, "am")

        async def sse_stream_amharic():
            async for token in _stream_words(full_amharic):
                event = json.dumps({"token": token, "done": False}) + "\n\n"
                yield f"data: {event}"
            yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

        return StreamingResponse(
            sse_stream_amharic(),
            media_type="text/event-stream",
        )

    # user_lang == "en": stream directly from Ollama
    async def sse_stream():
        async for token in inference.generate_response_stream(messages):
            event = json.dumps({"token": token, "done": False}) + "\n\n"
            yield f"data: {event}"
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
    )
