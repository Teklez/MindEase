from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import health, generate, crisis, translate

app = FastAPI(title="MindEase AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()

app.include_router(health.router, tags=["health"])
app.include_router(generate.router, prefix="/generate", tags=["generate"])
app.include_router(translate.router, prefix="/translate", tags=["translate"])
app.include_router(crisis.router, tags=["crisis"])
