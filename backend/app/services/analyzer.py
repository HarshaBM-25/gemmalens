import os
import json
import shutil
import hashlib
import logging
import re
import tempfile
from pathlib import Path
from typing import Optional
import git
import networkx as nx

logger = logging.getLogger(__name__)

# In-memory store for analyzed repos (MVP: no DB)
REPO_STORE: dict[str, dict] = {}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "target", "vendor", ".idea", ".vscode",
    "coverage", ".pytest_cache", "*.egg-info", "site-packages"
}

LANGUAGE_EXTENSIONS = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
    ".tsx": "TypeScript", ".jsx": "JavaScript", ".java": "Java",
    ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".php": "PHP",
    ".cs": "C#", ".cpp": "C++", ".c": "C", ".swift": "Swift",
    ".kt": "Kotlin", ".scala": "Scala", ".sh": "Shell",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS",
    ".vue": "Vue", ".svelte": "Svelte", ".dart": "Dart",
    ".ex": "Elixir", ".exs": "Elixir", ".hs": "Haskell",
}

FRAMEWORK_SIGNALS = {
    "Next.js": ["next.config", "next.config.js", "next.config.ts"],
    "React": ["react", "react-dom"],
    "Vue": ["vue", "nuxt"],
    "Angular": ["@angular/core"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Flask": ["flask"],
    "Express": ["express"],
    "Spring": ["spring-boot"],
    "Rails": ["rails"],
    "Laravel": ["laravel/framework"],
    "Svelte": ["svelte", "@sveltejs/kit"],
}


def repo_id_from_url(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:12]


def should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_DIRS or part.endswith(".egg-info"):
            return True
    return False


def detect_languages(root: Path) -> dict[str, int]:
    counts: dict[str, int] = {}
    for f in root.rglob("*"):
        if f.is_file() and not should_skip(f.relative_to(root)):
            ext = f.suffix.lower()
            lang = LANGUAGE_EXTENSIONS.get(ext)
            if lang:
                counts[lang] = counts.get(lang, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: -x[1]))


def parse_package_json(root: Path) -> dict:
    pkg = root / "package.json"
    if not pkg.exists():
        return {}
    try:
        data = json.loads(pkg.read_text(encoding="utf-8", errors="ignore"))
        deps = {}
        deps.update(data.get("dependencies", {}))
        deps.update(data.get("devDependencies", {}))
        return {"manager": "npm/yarn", "packages": deps}
    except Exception:
        return {}


def parse_requirements_txt(root: Path) -> dict:
    req = root / "requirements.txt"
    if not req.exists():
        return {}
    packages = {}
    for line in req.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            parts = re.split(r"[>=<!~]", line)
            name = parts[0].strip()
            if name:
                packages[name] = line.replace(name, "").strip() or "*"
    return {"manager": "pip", "packages": packages}


def parse_cargo_toml(root: Path) -> dict:
    cargo = root / "Cargo.toml"
    if not cargo.exists():
        return {}
    try:
        import toml
        data = toml.loads(cargo.read_text(encoding="utf-8", errors="ignore"))
        deps = data.get("dependencies", {})
        return {"manager": "cargo", "packages": {k: str(v) if not isinstance(v, dict) else v.get("version", "*") for k, v in deps.items()}}
    except Exception:
        return {}


def parse_pom_xml(root: Path) -> dict:
    pom = root / "pom.xml"
    if not pom.exists():
        return {}
    try:
        content = pom.read_text(encoding="utf-8", errors="ignore")
        arts = re.findall(r"<artifactId>(.*?)</artifactId>", content)
        versions = re.findall(r"<version>(.*?)</version>", content)
        packages = dict(zip(arts, versions + ["*"] * len(arts)))
        return {"manager": "maven", "packages": packages}
    except Exception:
        return {}


def parse_composer_json(root: Path) -> dict:
    comp = root / "composer.json"
    if not comp.exists():
        return {}
    try:
        data = json.loads(comp.read_text(encoding="utf-8", errors="ignore"))
        deps = {}
        deps.update(data.get("require", {}))
        deps.update(data.get("require-dev", {}))
        return {"manager": "composer", "packages": deps}
    except Exception:
        return {}


def detect_frameworks(root: Path, pkg_deps: dict) -> list[str]:
    found = []
    all_files = [f.name for f in root.iterdir() if f.is_file()]
    pkg_names = set(pkg_deps.keys()) if pkg_deps else set()

    for framework, signals in FRAMEWORK_SIGNALS.items():
        for signal in signals:
            if signal in all_files or any(signal in p for p in pkg_names):
                found.append(framework)
                break
    return list(set(found))


def extract_python_imports(content: str) -> list[str]:
    imports = []
    for line in content.splitlines():
        m = re.match(r"^(?:from\s+(\S+)\s+import|import\s+(\S+))", line.strip())
        if m:
            mod = m.group(1) or m.group(2)
            if mod:
                imports.append(mod.split(".")[0])
    return imports


def extract_js_imports(content: str) -> list[str]:
    imports = []
    for m in re.finditer(r"""(?:import|require)\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:from\s*)?['"]([^'"]+)['"]""", content):
        imp = m.group(1)
        if imp:
            imports.append(imp)
    return imports


def scan_modules(root: Path) -> dict[str, list[str]]:
    """Map filename -> list of imported modules (relative only)"""
    module_imports: dict[str, list[str]] = {}
    
    for f in root.rglob("*"):
        if not f.is_file() or should_skip(f.relative_to(root)):
            continue
        ext = f.suffix.lower()
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        
        rel = str(f.relative_to(root))
        imports = []
        
        if ext == ".py":
            raw = extract_python_imports(content)
            imports = [i for i in raw if i and not i.startswith("_")]
        elif ext in {".js", ".ts", ".jsx", ".tsx", ".vue", ".svelte"}:
            raw = extract_js_imports(content)
            # Keep only relative imports for graph edges
            imports = [i for i in raw if i.startswith(".")]
        
        if imports:
            module_imports[rel] = imports[:20]  # cap per file

    return module_imports


def build_architecture_graph(root: Path, module_imports: dict[str, list[str]]) -> dict:
    G = nx.DiGraph()
    
    # Add top-level directories/files as nodes
    top_level = {}
    for f_rel, imports in module_imports.items():
        parts = Path(f_rel).parts
        top = parts[0] if len(parts) > 1 else f_rel
        top_level[top] = top_level.get(top, 0) + 1
        G.add_node(top)

    # Add edges between top-level modules based on imports
    for f_rel, imports in module_imports.items():
        parts = Path(f_rel).parts
        src_top = parts[0] if len(parts) > 1 else f_rel
        
        for imp in imports:
            # Resolve relative import
            imp_path = (Path(f_rel).parent / imp).resolve()
            try:
                imp_rel = str(imp_path.relative_to(root))
                imp_parts = Path(imp_rel).parts
                dst_top = imp_parts[0] if len(imp_parts) > 1 else imp_rel
                if src_top != dst_top and dst_top in top_level:
                    G.add_edge(src_top, dst_top)
            except ValueError:
                pass

    # Build node/edge lists for React Flow
    nodes = []
    edges = []
    
    cols = max(1, int(len(G.nodes()) ** 0.5) + 1)
    for i, node in enumerate(G.nodes()):
        x = (i % cols) * 220 + 60
        y = (i // cols) * 140 + 60
        size = top_level.get(node, 1)
        nodes.append({
            "id": node,
            "data": {"label": node, "fileCount": size},
            "position": {"x": x, "y": y},
            "type": "default"
        })

    seen_edges = set()
    for src, dst in G.edges():
        key = f"{src}->{dst}"
        if key not in seen_edges:
            seen_edges.add(key)
            edges.append({
                "id": key,
                "source": src,
                "target": dst,
                "animated": False
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
        }
    }


def list_important_files(root: Path) -> list[str]:
    important = []
    patterns = [
        "README*", "main.*", "app.*", "index.*", "server.*",
        "Dockerfile*", "docker-compose*", ".env.example",
        "package.json", "requirements.txt", "Cargo.toml",
        "pom.xml", "composer.json", "setup.py", "pyproject.toml",
    ]
    for pattern in patterns:
        for f in root.glob(pattern):
            if f.is_file():
                important.append(str(f.relative_to(root)))
    return important[:20]


def collect_file_tree(root: Path, max_files: int = 200) -> list[str]:
    tree = []
    for f in sorted(root.rglob("*")):
        if f.is_file() and not should_skip(f.relative_to(root)):
            tree.append(str(f.relative_to(root)))
            if len(tree) >= max_files:
                break
    return tree


def read_key_files(root: Path, important: list[str]) -> dict[str, str]:
    content_map = {}
    for rel in important[:8]:
        fp = root / rel
        if fp.exists() and fp.stat().st_size < 50_000:
            try:
                content_map[rel] = fp.read_text(encoding="utf-8", errors="ignore")[:3000]
            except Exception:
                pass
    return content_map


def analyze_repository(repo_url: str) -> dict:
    repo_id = repo_id_from_url(repo_url)
    
    if repo_id in REPO_STORE:
        logger.info(f"Cache hit for {repo_id}")
        return REPO_STORE[repo_id]

    tmpdir = tempfile.mkdtemp(prefix="gemmalens_")
    try:
        logger.info(f"Cloning {repo_url} -> {tmpdir}")
        git.Repo.clone_from(repo_url, tmpdir, depth=1)
        root = Path(tmpdir)

        # Parse dependencies
        deps = {}
        for parser in [parse_package_json, parse_requirements_txt, parse_cargo_toml, parse_pom_xml, parse_composer_json]:
            result = parser(root)
            if result:
                deps.update(result)
                break  # use first found

        pkg_packages = deps.get("packages", {})
        languages = detect_languages(root)
        frameworks = detect_frameworks(root, pkg_packages)
        module_imports = scan_modules(root)
        graph = build_architecture_graph(root, module_imports)
        file_tree = collect_file_tree(root)
        important_files = list_important_files(root)
        key_file_contents = read_key_files(root, important_files)

        result = {
            "repo_id": repo_id,
            "repo_url": repo_url,
            "repo_name": repo_url.rstrip("/").split("/")[-1],
            "languages": languages,
            "frameworks": frameworks,
            "dependencies": {
                "manager": deps.get("manager", "unknown"),
                "packages": dict(list(pkg_packages.items())[:50]),
                "total_count": len(pkg_packages),
            },
            "file_tree": file_tree,
            "important_files": important_files,
            "key_file_contents": key_file_contents,
            "module_imports": {k: v for k, v in list(module_imports.items())[:30]},
            "graph": graph,
            "stats": {
                "total_files": len(file_tree),
                "total_modules": len(module_imports),
                "primary_language": next(iter(languages), "Unknown"),
            }
        }

        REPO_STORE[repo_id] = result
        return result

    except git.exc.GitCommandError as e:
        raise ValueError(f"Git clone failed: {e}")
    except Exception as e:
        raise ValueError(f"Analysis failed: {e}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
