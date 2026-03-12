from fastapi import APIRouter

from app.services.translator import TranslationService

router = APIRouter()
translator = TranslationService()


@router.post("")
async def translate(body: dict):
    """POST /translate — direct translation.
    Body: {"text": "...", "source_lang": "am"|"en", "target_lang": "am"|"en"}
    Returns: {"translated": "...", "was_translated": bool}
    """
    text = body.get("text") or ""
    source_lang = (body.get("source_lang") or "en").lower()
    target_lang = (body.get("target_lang") or "en").lower()
    if source_lang not in ("am", "en"):
        source_lang = "en"
    if target_lang not in ("am", "en"):
        target_lang = "en"

    if source_lang == target_lang or not text.strip():
        return {"translated": text, "was_translated": False}

    translated = await translator.translate(text, source_lang, target_lang)
    return {"translated": translated, "was_translated": True}
