from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.v1.router import api_router
from app.api.v1.chat import websocket_chat
from app.api.v1.groups import websocket_group
from app.api.v1.voice import websocket_voice
from app.database import async_session_maker
from app.seeds.badges import seed_badges
from app.seeds.seed_assessments import seed_assessments
from app.seeds.seed_resources import seed_resources

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_maker() as db:
        await seed_badges(db)
        await seed_resources(db)
        await seed_assessments(db)
    yield


# API errors use consistent format: {"detail": "error message"} (HTTPException and validation)
app = FastAPI(title="MindEase API", lifespan=lifespan)


@app.get("/")
def root():
    return {
        "name": "MindEase API",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


# CORS: allow frontend origin(s) from env; add 127.0.0.1 variant so both localhost and 127.0.0.1 work
def _cors_origins() -> list[str]:
    raw = settings.FRONTEND_URL.strip()
    if "," in raw:
        origins = [o.strip() for o in raw.split(",") if o.strip()]
    else:
        origins = [raw] if raw else []
    # If any origin is localhost, also allow 127.0.0.1 on the same port (browser may send either)
    extra = []
    for o in origins:
        if "localhost" in o and "127.0.0.1" not in o:
            extra.append(o.replace("localhost", "127.0.0.1"))
        elif "127.0.0.1" in o and "localhost" not in o:
            extra.append(o.replace("127.0.0.1", "localhost"))
    return list(dict.fromkeys(origins + extra))


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.websocket("/ws/chat/{conversation_id}")(websocket_chat)
app.websocket("/ws/group/{group_id}")(websocket_group)
app.websocket("/ws/voice/{conversation_id}")(websocket_voice)
