from fastapi import APIRouter, HTTPException

from app.services.embedder import embedder

router = APIRouter()


@router.post("")
async def embed(body: dict) -> dict:
    """POST /embed — body: {"texts": [str, ...]} → {"embeddings": [[float; 768], ...]}."""
    texts = body.get("texts") or []
    if not isinstance(texts, list) or not all(isinstance(t, str) for t in texts):
        raise HTTPException(status_code=400, detail="`texts` must be a list of strings")
    if not texts:
        return {"embeddings": []}
    try:
        vectors = await embedder.embed_batch(texts)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"embed failed: {exc}") from exc
    return {"embeddings": vectors}
