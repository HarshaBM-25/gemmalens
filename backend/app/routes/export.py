import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from app.models import ExportRequest
from app.services.analyzer import REPO_STORE

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/export")
def export_context(req: ExportRequest):
    if req.repo_id not in REPO_STORE:
        raise HTTPException(404, "Repository not found.")
    
    data = REPO_STORE[req.repo_id]
    
    export = {
        "gemmalens_version": "1.0.0",
        "repo_url": data["repo_url"],
        "repo_name": data["repo_name"],
        "ai_summary": data.get("ai_summary", ""),
        "languages": data["languages"],
        "frameworks": data["frameworks"],
        "dependencies": {
            "manager": data["dependencies"]["manager"],
            "packages": data["dependencies"]["packages"],
            "total_count": data["dependencies"]["total_count"],
        },
        "architecture": {
            "modules": list(data["graph"]["nodes"]),
            "relationships": [
                {"from": e["source"], "to": e["target"]}
                for e in data["graph"]["edges"]
            ],
        },
        "important_files": data["important_files"],
        "module_imports": data.get("module_imports", {}),
        "file_tree_sample": data["file_tree"][:100],
        "stats": data["stats"],
        "usage_hint": (
            "Paste this JSON into Claude, ChatGPT, Cursor, or any AI tool "
            "to give it full context about this repository."
        ),
    }
    
    return JSONResponse(content=export, headers={
        "Content-Disposition": f'attachment; filename="gemmalens-{data["repo_name"]}.json"'
    })
