import logging
from fastapi import APIRouter, HTTPException
from app.models import ChatRequest
from app.services.analyzer import REPO_STORE
from app.services.gemma import answer_question

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat")
async def chat(req: ChatRequest):
    if req.repo_id not in REPO_STORE:
        raise HTTPException(404, "Repository not found. Please analyze it first.")
    
    repo_data = REPO_STORE[req.repo_id]
    
    try:
        answer = await answer_question(repo_data, req.message)
        return {"answer": answer, "repo_name": repo_data["repo_name"]}
    except Exception as e:
        logger.exception(f"Chat error: {e}")
        raise HTTPException(500, f"Chat error: {e}")
