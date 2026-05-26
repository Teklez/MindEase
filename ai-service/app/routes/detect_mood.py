from fastapi import APIRouter, HTTPException

from app.services.mood_detector import mood_detector

router = APIRouter()


@router.post("")
async def detect_mood(body: dict) -> dict:
    """POST /detect-mood — body: {"text": str} → {"mood_level": 1-5 or null}."""
    text = body.get("text") or ""
    if not isinstance(text, str):
        raise HTTPException(status_code=400, detail="`text` must be a string")
    level = await mood_detector.detect(text)
    return {"mood_level": level}
