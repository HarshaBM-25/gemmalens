from pydantic import BaseModel
from typing import Any


class AnalyzeRequest(BaseModel):
    repo_url: str


class ChatRequest(BaseModel):
    repo_id: str
    message: str


class ExportRequest(BaseModel):
    repo_id: str


class DocsRequest(BaseModel):
    repo_id: str
