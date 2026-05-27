from fastapi import APIRouter, HTTPException

from app.services.export_summarizer import export_summarizer

router = APIRouter()


@router.post("")
async def summarize_export(body: dict) -> dict:
    """POST /summarize-export
    Body: { mood_entries, assessments, chat_meta }
    Returns: { summary: str }
    """
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid request body")
    summary = await export_summarizer.summarize(body)
    return {"summary": summary}
