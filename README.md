# GemmaLens

> AI-powered repository understanding and architectural memory engine built with Gemma 4.

## Why Gemma 4 31B Dense?

Gemma 4 31B Dense was selected for GemmaLens for four key reasons:

1. **Long-context repository understanding** — Gemma 4's extended context window can ingest hundreds of files, dependency lists, and import maps in a single pass without losing coherence.
2. **Semantic architecture reasoning** — The model accurately reasons about module relationships, design patterns, and architectural decisions from raw code structure.
3. **Multi-file code understanding** — Unlike smaller models, Gemma 4 31B connects import chains across many files to understand cross-cutting concerns.
4. **Repository-level summarization** — Generates accurate, non-hallucinated summaries grounded in the actual files and dependencies it receives.

## Features

| Feature | Description |
|---|---|
| Real Repository Analysis | Clones via GitPython, scans filesystem, detects languages/frameworks/deps |
| Architecture Graph | NetworkX backend → React Flow frontend, built from real imports |
| GemmaChat | Q&A grounded in real repository context |
| LensContext Export | JSON export usable in Claude, Cursor, ChatGPT |
| Documentation Generation | Markdown docs from real analysis |

## Tech Stack

**Frontend:** Next.js · Tailwind CSS · React Flow (@xyflow/react)  
**Backend:** FastAPI · GitPython · NetworkX · httpx  
**AI:** Gemma 4 31B Dense via OpenRouter

## Setup

### 1. Get an OpenRouter API Key

Sign up at [openrouter.ai](https://openrouter.ai) and get an API key.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set your API key
export OPENROUTER_API_KEY=your_key_here

# Run
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
# .env.local is pre-configured for localhost:8000

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter a GitHub repository URL (e.g. `https://github.com/fastapi/fastapi`)
2. Click **Analyze** — backend clones, scans, and builds context
3. View the **Overview** with Gemma's AI summary
4. Explore the **Architecture Graph** (real module relationships)
5. Chat with **GemmaChat** — ask anything about the codebase
6. Generate **Docs** — real markdown documentation
7. **Export** LensContext JSON for use in other AI tools

## Architecture

```
User → Next.js → FastAPI
                   ├── GitPython (clone repo)
                   ├── File scanner (languages, deps, imports)
                   ├── NetworkX (build graph)
                   └── OpenRouter/Gemma (AI reasoning)
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/analyze` | Clone and analyze a repository |
| GET | `/api/analyze/{repo_id}` | Get cached analysis |
| POST | `/api/chat` | Ask Gemma about the repository |
| POST | `/api/docs` | Generate markdown documentation |
| POST | `/api/export` | Download LensContext JSON |
| GET | `/health` | Health check |

## Supported Package Managers

- `package.json` (npm/yarn)
- `requirements.txt` (pip)
- `Cargo.toml` (cargo)
- `pom.xml` (maven)
- `composer.json` (composer)

## Notes

- Repositories are cached in memory per session (restart backend to re-analyze)
- Only public GitHub HTTPS URLs are supported
- Large repositories (>10k files) are sampled for performance
