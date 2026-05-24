import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from app.models import DocsRequest
from app.services.analyzer import REPO_STORE
from app.services.gemma import generate_documentation

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/docs")
async def generate_docs(req: DocsRequest):
    if req.repo_id not in REPO_STORE:
        raise HTTPException(404, "Repository not found.")
    
    repo_data = REPO_STORE[req.repo_id]
    
    try:
        docs = await generate_documentation(repo_data)
        return {"markdown": docs, "repo_name": repo_data["repo_name"]}
    except Exception as e:
        logger.exception(f"Docs error: {e}")
        raise HTTPException(500, f"Documentation generation error: {e}")
