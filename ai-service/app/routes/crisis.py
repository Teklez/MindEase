from fastapi import APIRouter
from pydantic import BaseModel

from app.services.crisis_detector import CrisisDetector

router = APIRouter()
crisis_detector = CrisisDetector()


class CheckCrisisBody(BaseModel):
    text: str = ""


@router.post("/check-crisis")
def check_crisis(body: CheckCrisisBody):
    """POST /check-crisis — crisis keyword detection.
    Body: {"text": "user message"}
    Returns: {"is_crisis": bool, "detected_keywords": [], "resources": {}}
    """
    result = crisis_detector.check_message(body.text)
    return result
