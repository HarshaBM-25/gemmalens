"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const GraphView = dynamic(() => import("@/components/GraphView"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Tab = "overview" | "graph" | "chat" | "docs" | "export";

interface RepoData {
  repo_id: string;
  repo_name: string;
  repo_url: string;
  languages: Record<string, number>;
  frameworks: string[];
  dependencies: { manager: string; packages: Record<string, string>; total_count: number };
  stats: { total_files: number; total_modules: number; primary_language: string };
  important_files: string[];
  graph: { nodes: unknown[]; edges: unknown[]; stats: { node_count: number; edge_count: number } };
  ai_summary: string;
}

interface ChatMessage { role: "user" | "assistant"; content: string }

export default function AnalyzePage() {
  const { repoId } = useParams<{ repoId: string }>();
  const router = useRouter();
  const [data, setData] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Docs state
  const [docsContent, setDocsContent] = useState("");
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/analyze/${repoId}`)
      .then(r => r.json())
      .then(d => {
        if (d.detail) throw new Error(d.detail);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [repoId]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: repoId, message: msg }),
      });
      const d = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: d.answer || d.detail || "Error" }]);
    } catch (e: unknown) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, repoId]);

  const generateDocs = useCallback(async () => {
    if (docsLoading) return;
    setDocsLoading(true);
    try {
      const res = await fetch(`${API}/api/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: repoId }),
      });
      const d = await res.json();
      setDocsContent(d.markdown || d.detail || "Error");
    } catch (e: unknown) {
      setDocsContent(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDocsLoading(false);
    }
  }, [docsLoading, repoId]);

  const handleExport = useCallback(async () => {
    const res = await fetch(`${API}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_id: repoId }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gemmalens-${data?.repo_name || repoId}.json`;
    a.click();
  }, [repoId, data]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "graph", label: "Architecture Graph" },
    { id: "chat", label: "GemmaChat" },
    { id: "docs", label: "Docs" },
    { id: "export", label: "Export" },
  ];

  const langColors: Record<string, string> = {
    Python: "#3572A5", JavaScript: "#f1e05a", TypeScript: "#2b7489",
    Java: "#b07219", Go: "#00ADD8", Rust: "#dea584", Ruby: "#701516",
    PHP: "#4F5D95", "C#": "#178600", "C++": "#f34b7d", Swift: "#F05138",
    HTML: "#e34c26", CSS: "#563d7c", SCSS: "#c6538c", Vue: "#41b883",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
        <div style={{ width: 32, height: 32, border: "2px solid var(--border)", borderTop: "2px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Loading analysis...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
        <p style={{ color: "#f87171" }}>{error}</p>
        <button onClick={() => router.push("/")} style={{ padding: "0.6rem 1.2rem", background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
      </div>
    );
  }

  if (!data) return null;

  const totalLangFiles = Object.values(data.languages).reduce((a, b) => a + b, 0);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <header style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", padding: 0 }}>
          ← GemmaLens
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{data.repo_name}</span>
            <a href={data.repo_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)", fontSize: "0.75rem", textDecoration: "none" }}>{data.repo_url}</a>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
            {data.frameworks.slice(0, 4).map(f => (
              <span key={f} style={{ padding: "0.15rem 0.5rem", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 999, fontSize: "0.68rem", color: "var(--accent)" }}>{f}</span>
            ))}
            <span style={{ padding: "0.15rem 0.5rem", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 999, fontSize: "0.68rem", color: "var(--text-muted)" }}>
              {data.stats.total_files} files
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ borderBottom: "1px solid var(--border)", padding: "0 1.5rem", display: "flex", gap: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "docs" && !docsContent) generateDocs(); }}
            style={{
              padding: "0.75rem 1rem", background: "none", border: "none", borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem",
              fontWeight: tab === t.id ? 500 : 400, transition: "all 0.15s", marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", maxWidth: 1100 }} className="animate-fadeIn">
            {/* AI Summary */}
            <div style={{ gridColumn: "1 / -1", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.2rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>Gemma AI Summary</div>
              <div className="prose" style={{ fontSize: "0.85rem" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.ai_summary}</ReactMarkdown>
              </div>
            </div>

            {/* Languages */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.2rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>Languages</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Object.entries(data.languages).slice(0, 8).map(([lang, count]) => {
                  const pct = Math.round((count / totalLangFiles) * 100);
                  return (
                    <div key={lang}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
                        <span style={{ color: "var(--text)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: langColors[lang] || "var(--text-dim)", display: "inline-block" }}></span>
                          {lang}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>{count} files · {pct}%</span>
                      </div>
                      <div style={{ height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: langColors[lang] || "var(--accent)", borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dependencies */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.2rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>
                Dependencies · {data.dependencies.manager} · {data.dependencies.total_count} total
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {Object.keys(data.dependencies.packages).slice(0, 30).map(pkg => (
                  <span key={pkg} style={{ padding: "0.2rem 0.5rem", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.72rem", color: "var(--text-dim)" }}>{pkg}</span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.2rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>Stats</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                {[
                  ["Total Files", data.stats.total_files],
                  ["Modules", data.stats.total_modules],
                  ["Graph Nodes", data.graph.stats.node_count],
                  ["Graph Edges", data.graph.stats.edge_count],
                  ["Primary Language", data.stats.primary_language],
                  ["Package Manager", data.dependencies.manager],
                ].map(([label, val]) => (
                  <div key={String(label)}>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: "0.95rem", color: "var(--text)", fontWeight: 500 }}>{String(val)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Important Files */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.2rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>Important Files</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {data.important_files.map(f => (
                  <div key={f} style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "inherit", padding: "0.25rem 0.4rem", background: "var(--bg-3)", borderRadius: 4 }}>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GRAPH */}
        {tab === "graph" && (
          <div style={{ height: "calc(100vh - 180px)" }} className="animate-fadeIn">
            <GraphView nodes={data.graph.nodes as never} edges={data.graph.edges as never} />
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }} className="animate-fadeIn">
            <div style={{ flex: 1, overflow: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  <p style={{ marginBottom: "1.2rem", fontSize: "0.85rem" }}>Ask Gemma anything about <strong style={{ color: "var(--text)" }}>{data.repo_name}</strong></p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                    {[
                      "Explain the overall architecture",
                      "What are the main entry points?",
                      "How are dependencies organized?",
                      "What frameworks are used and why?",
                    ].map(q => (
                      <button key={q} onClick={() => { setChatInput(q); }} style={{ padding: "0.4rem 0.8rem", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", transition: "border-color 0.15s" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "75%", padding: "0.8rem 1rem",
                    background: m.role === "user" ? "var(--accent-glow)" : "var(--bg-2)",
                    border: `1px solid ${m.role === "user" ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    fontSize: "0.83rem",
                  }}>
                    {m.role === "user" ? (
                      <span style={{ color: "var(--accent)" }}>{m.content}</span>
                    ) : (
                      <div className="prose" style={{ fontSize: "0.83rem" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: "0.3rem", padding: "0.5rem 1rem" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, background: "var(--accent)", borderRadius: "50%", animation: `bounce 0.8s ${i * 0.15}s infinite` }} />
                  ))}
                  <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
                </div>
              )}
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.6rem" }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Ask about this repository..."
                style={{ flex: 1, padding: "0.7rem 1rem", background: "var(--bg-2)", border: "1px solid var(--border-2)", borderRadius: 6, color: "var(--text)", fontFamily: "inherit", fontSize: "0.85rem", outline: "none" }}
              />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ padding: "0.7rem 1.2rem", background: "var(--accent)", border: "none", borderRadius: 6, color: "#0a0b0d", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                Send
              </button>
            </div>
          </div>
        )}

        {/* DOCS */}
        {tab === "docs" && (
          <div style={{ padding: "1.5rem", maxWidth: 860 }} className="animate-fadeIn">
            {docsLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "var(--text-dim)", fontSize: "0.85rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse-glow 1s infinite" }}></div>
                Generating documentation with Gemma...
              </div>
            ) : docsContent ? (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                  <button
                    onClick={() => { const b = new Blob([docsContent], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${data.repo_name}-docs.md`; a.click(); }}
                    style={{ padding: "0.5rem 1rem", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem" }}
                  >
                    ↓ Download .md
                  </button>
                </div>
                <div className="prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{docsContent}</ReactMarkdown>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* EXPORT */}
        {tab === "export" && (
          <div style={{ padding: "2rem 1.5rem", maxWidth: 600 }} className="animate-fadeIn">
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", margin: "0 0 0.5rem" }}>LensContext Export</h2>
              <p style={{ color: "var(--text-dim)", fontSize: "0.83rem", lineHeight: 1.7 }}>
                Download a structured JSON file containing the full repository context — AI summary, architecture map, dependency graph, module relationships, and key files. Use it in Claude, Cursor, ChatGPT, or any AI tool.
              </p>
            </div>
            <button onClick={handleExport} style={{ padding: "0.8rem 1.5rem", background: "var(--accent)", border: "none", borderRadius: 6, color: "#0a0b0d", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
              ↓ Download LensContext JSON
            </button>
            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>Export includes</div>
              <ul style={{ margin: 0, padding: "0 0 0 1.2rem", color: "var(--text-dim)", fontSize: "0.8rem", lineHeight: 2 }}>
                <li>AI-generated repository summary</li>
                <li>Architecture module map</li>
                <li>Full dependency list</li>
                <li>Module import relationships</li>
                <li>Important files list</li>
                <li>File tree sample (100 files)</li>
                <li>Language breakdown</li>
                <li>Framework detection</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
