import os
import json
import logging
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemma-3-27b-it"  # Gemma 4 31B Dense via OpenRouter

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://gemmalens.dev",
    "X-Title": "GemmaLens",
}


def build_repo_context(repo_data: dict) -> str:
    name = repo_data.get("repo_name", "unknown")
    url = repo_data.get("repo_url", "")
    langs = repo_data.get("languages", {})
    frameworks = repo_data.get("frameworks", [])
    deps = repo_data.get("dependencies", {})
    file_tree = repo_data.get("file_tree", [])[:60]
    important_files = repo_data.get("important_files", [])
    key_files = repo_data.get("key_file_contents", {})
    module_imports = repo_data.get("module_imports", {})
    stats = repo_data.get("stats", {})

    ctx = f"""Repository: {name}
URL: {url}

Languages detected: {json.dumps(langs, indent=2)}
Frameworks: {', '.join(frameworks) if frameworks else 'None detected'}
Package manager: {deps.get('manager', 'unknown')}
Total dependencies: {deps.get('total_count', 0)}
Top dependencies: {', '.join(list(deps.get('packages', {}).keys())[:20])}

Stats:
- Total files: {stats.get('total_files', 0)}
- Primary language: {stats.get('primary_language', 'Unknown')}
- Modules with imports: {stats.get('total_modules', 0)}

File tree (sample):
{chr(10).join(file_tree[:50])}

Important files: {', '.join(important_files)}

Module import relationships (file -> imports):
"""
    for f, imps in list(module_imports.items())[:15]:
        ctx += f"\n  {f} -> {', '.join(imps)}"

    ctx += "\n\nKey file contents:\n"
    for fname, content in key_files.items():
        ctx += f"\n--- {fname} ---\n{content[:1500]}\n"

    return ctx


async def call_gemma(system_prompt: str, user_message: str) -> str:
    if not OPENROUTER_API_KEY:
        return "Error: OPENROUTER_API_KEY not set. Please add it to your .env file."

    payload = {
        "model": MODEL,
        "max_tokens": 2048,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(OPENROUTER_URL, headers=HEADERS, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenRouter HTTP error: {e.response.status_code} {e.response.text}")
        return f"AI error: {e.response.status_code} - {e.response.text[:200]}"
    except Exception as e:
        logger.error(f"OpenRouter error: {e}")
        return f"AI error: {str(e)}"


async def generate_summary(repo_data: dict) -> str:
    ctx = build_repo_context(repo_data)
    system = (
        "You are GemmaLens, an AI code architect. Analyze real repository data and produce "
        "a clear, insightful summary. Be specific about the actual code you see — do not hallucinate. "
        "Format your response in markdown."
    )
    user = f"""Based on this real repository analysis, provide a comprehensive summary:

{ctx}

Include:
1. What this repository does (purpose/function)
2. Architecture overview (how it's structured)
3. Key technologies and why they're used
4. Main entry points and important modules
5. Notable patterns or design decisions visible from the code
"""
    return await call_gemma(system, user)


async def answer_question(repo_data: dict, question: str) -> str:
    ctx = build_repo_context(repo_data)
    system = (
        "You are GemmaLens, an AI code architect with deep knowledge of this specific repository. "
        "Answer questions accurately based only on the real repository data provided. "
        "If something is not visible in the data, say so honestly. "
        "Be specific, technical, and helpful. Format in markdown."
    )
    user = f"""Repository context:
{ctx}

User question: {question}

Answer based strictly on the repository data above. Be specific and reference actual files, modules, or dependencies when relevant."""
    return await call_gemma(system, user)


async def generate_documentation(repo_data: dict) -> str:
    ctx = build_repo_context(repo_data)
    system = (
        "You are GemmaLens generating real technical documentation from repository analysis. "
        "Generate accurate, useful markdown documentation based only on what you can see in the data. "
        "Do not invent features or APIs that aren't evident in the code."
    )
    user = f"""Generate comprehensive markdown documentation for this repository:

{ctx}

Create documentation including:
# Overview
# Architecture
# Directory Structure  
# Dependencies
# Getting Started
# Key Modules
# Contributing

Base everything on the actual repository data provided."""
    return await call_gemma(system, user)
