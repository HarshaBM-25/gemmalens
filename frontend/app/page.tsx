"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("");
  const router = useRouter();

  const steps = [
    "Cloning repository...",
    "Scanning file system...",
    "Detecting languages & frameworks...",
    "Parsing dependencies...",
    "Mapping module relationships...",
    "Building architecture graph...",
    "Generating AI summary with Gemma...",
  ];

  async function handleAnalyze() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");

    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      if (stepIdx < steps.length) {
        setStep(steps[stepIdx]);
        stepIdx++;
      }
    }, 2000);

    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Analysis failed");
      clearInterval(stepInterval);
      router.push(`/analyze/${data.repo_id}`);
    } catch (e: unknown) {
      clearInterval(stepInterval);
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
      setStep("");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 28, height: 28, background: "var(--accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="#0a0b0d"/>
              <circle cx="8" cy="8" r="6.5" stroke="#0a0b0d" strokeWidth="1.5" fill="none"/>
              <line x1="8" y1="1" x2="8" y2="3.5" stroke="#0a0b0d" strokeWidth="1.5"/>
              <line x1="8" y1="12.5" x2="8" y2="15" stroke="#0a0b0d" strokeWidth="1.5"/>
              <line x1="1" y1="8" x2="3.5" y2="8" stroke="#0a0b0d" strokeWidth="1.5"/>
              <line x1="12.5" y1="8" x2="15" y2="8" stroke="#0a0b0d" strokeWidth="1.5"/>
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.02em", color: "var(--text)" }}>GemmaLens</span>
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginLeft: "0.5rem" }}>powered by Gemma 4</span>
      </header>

      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", textAlign: "center" }}>
        <div style={{ marginBottom: "1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.8rem", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 999, fontSize: "0.72rem", color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, background: "var(--accent)", borderRadius: "50%", display: "inline-block", animation: "pulse-glow 2s infinite" }}></span>
          Repository Intelligence Engine
        </div>

        <h1 style={{ fontSize: "clamp(2rem, 6vw, 4rem)", fontWeight: 600, margin: "1rem 0 0.5rem", letterSpacing: "-0.04em", lineHeight: 1.1, color: "var(--text)" }}>
          Understand any<br />
          <span style={{ color: "var(--accent)" }}>codebase instantly</span>
        </h1>

        <p style={{ color: "var(--text-dim)", maxWidth: 520, margin: "0 auto 2.5rem", lineHeight: 1.7, fontSize: "1rem" }}>
          GemmaLens clones your repository, maps its architecture, and gives you an AI that truly understands your code — powered by Gemma 4 31B.
        </p>

        {/* Input */}
        <div style={{ width: "100%", maxWidth: 580, display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <div style={{ display: "flex", gap: "0", background: "var(--bg-2)", border: `1px solid ${error ? "#f87171" : "var(--border-2)"}`, borderRadius: 8, overflow: "hidden", transition: "border-color 0.2s" }}>
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAnalyze()}
              placeholder="https://github.com/owner/repository"
              disabled={loading}
              style={{
                flex: 1, padding: "0.85rem 1rem", background: "transparent", border: "none", outline: "none",
                color: "var(--text)", fontFamily: "inherit", fontSize: "0.9rem",
              }}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !url.trim()}
              style={{
                padding: "0.85rem 1.4rem", background: loading ? "var(--bg-3)" : "var(--accent)", border: "none",
                color: loading ? "var(--text-muted)" : "#0a0b0d", fontFamily: "inherit", fontSize: "0.85rem",
                fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap", transition: "background 0.2s",
              }}
            >
              {loading ? "Analyzing..." : "Analyze →"}
            </button>
          </div>

          {error && (
            <div style={{ padding: "0.7rem 1rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, color: "#f87171", fontSize: "0.82rem" }}>
              {error}
            </div>
          )}

          {loading && step && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "var(--text-dim)", fontSize: "0.8rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse-glow 1s infinite" }}></div>
              {step}
            </div>
          )}
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", marginTop: "3rem", maxWidth: 640 }}>
          {["Real code analysis", "Architecture graph", "GemmaChat Q&A", "LensContext export", "Docs generation"].map(f => (
            <span key={f} style={{ padding: "0.3rem 0.8rem", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 999, fontSize: "0.75rem", color: "var(--text-dim)" }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding: "1rem 2rem", borderTop: "1px solid var(--border)", textAlign: "center", color: "var(--text-muted)", fontSize: "0.72rem" }}>
        Built with Gemma 4 31B Dense · GemmaLens · Build With Gemma 4 Competition
      </footer>
    </main>
  );
}
