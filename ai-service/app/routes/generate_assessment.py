from fastapi import APIRouter, HTTPException

from app.services.assessment_generator import assessment_generator

router = APIRouter()


@router.post("")
async def generate_assessment(body: dict) -> dict:
    """POST /generate-assessment
    Body: {"prompt": str}
    Returns the full assessment spec as JSON.
    """
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    try:
        result = await assessment_generator.generate(prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"generation failed: {e}")
    if isinstance(result, dict) and "refusal" in result:
        return {"refusal": result["refusal"]}
    return {"spec": result}
