import json
import httpx
from app.config import get_settings

FALLBACK_MESSAGE = (
    "I'm having trouble responding right now. Please try again in a moment."
)


class InferenceService:
    def __init__(self):
        self.settings = get_settings()
        self.timeout = 60.0

    async def generate_response(self, messages: list[dict]) -> str:
        """Call Ollama /api/chat with stream=False. Returns full response string."""
        url = f"{self.settings.OLLAMA_URL.rstrip('/')}/api/chat"
        payload = {
            "model": self.settings.MODEL_NAME,
            "messages": messages,
            "stream": False,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                message = (data.get("message") or {}).get("content") or ""
                return message
        except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPStatusError):
            return FALLBACK_MESSAGE
        except Exception:
            return FALLBACK_MESSAGE

    async def generate_response_stream(self, messages: list[dict]):
        """Call Ollama /api/chat with stream=True. Yields token strings."""
        url = f"{self.settings.OLLAMA_URL.rstrip('/')}/api/chat"
        payload = {
            "model": self.settings.MODEL_NAME,
            "messages": messages,
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            content = (data.get("message") or {}).get("content") or ""
                            yield content
                        except json.JSONDecodeError:
                            continue
        except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPStatusError):
            yield FALLBACK_MESSAGE
        except Exception:
            yield FALLBACK_MESSAGE
