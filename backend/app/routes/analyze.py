import logging
from fastapi import APIRouter, HTTPException
from app.models import AnalyzeRequest
from app.services.analyzer import analyze_repository, REPO_STORE
from app.services.gemma import generate_summary

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    url = req.repo_url.strip()
    if not url.startswith("https://github.com/"):
        raise HTTPException(400, "Only GitHub HTTPS URLs are supported (e.g. https://github.com/user/repo)")
    
    try:
        logger.info(f"Analyzing: {url}")
        repo_data = analyze_repository(url)
        
        # Generate AI summary
        summary = await generate_summary(repo_data)
        repo_data["ai_summary"] = summary
        REPO_STORE[repo_data["repo_id"]] = repo_data
        
        return {
            "repo_id": repo_data["repo_id"],
            "repo_name": repo_data["repo_name"],
            "repo_url": repo_data["repo_url"],
            "languages": repo_data["languages"],
            "frameworks": repo_data["frameworks"],
            "dependencies": repo_data["dependencies"],
            "stats": repo_data["stats"],
            "important_files": repo_data["important_files"],
            "graph": repo_data["graph"],
            "ai_summary": summary,
        }
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        raise HTTPException(500, f"Internal error: {e}")


@router.get("/analyze/{repo_id}")
def get_analysis(repo_id: str):
    if repo_id not in REPO_STORE:
        raise HTTPException(404, "Repository not found. Please analyze it first.")
    data = REPO_STORE[repo_id]
    return {
        "repo_id": data["repo_id"],
        "repo_name": data["repo_name"],
        "repo_url": data["repo_url"],
        "languages": data["languages"],
        "frameworks": data["frameworks"],
        "dependencies": data["dependencies"],
        "stats": data["stats"],
        "important_files": data["important_files"],
        "graph": data["graph"],
        "ai_summary": data.get("ai_summary", ""),
    }
