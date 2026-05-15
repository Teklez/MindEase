from fastapi import APIRouter

from app.api.v1 import assessments, auth, chat, groups, health, mood, resources, voice

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(mood.router, prefix="/mood", tags=["Mood Tracker"])
api_router.include_router(resources.router, prefix="/resources", tags=["Resources"])
api_router.include_router(
    assessments.router, prefix="/assessments", tags=["Assessments"]
)
api_router.include_router(groups.router, prefix="/groups", tags=["Groups"])
api_router.include_router(voice.router, prefix="/voice", tags=["Voice"])
