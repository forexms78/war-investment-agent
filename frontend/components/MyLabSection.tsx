"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisFile, AnalysisContent } from "@/types";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;
const AUTH_KEY = "mylab_auth";

// ─── 간단 마크다운 렌더러 ─────────────────────────────────────────────────
function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 코드 블록
    if (line.startsWith("```")) {
      if (inList) { out.push("</ul>"); inList = false; }
      inCodeBlock = !inCodeBlock;
      out.push(inCodeBlock ? '<pre style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:12px;line-height:1.6;"><code>' : "</code></pre>");
      continue;
    }
    if (inCodeBlock) { out.push(escapeHtml(line)); continue; }

    // 가로줄
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<hr style="border:none;border-top:1px solid var(--border);margin:20px 0;" />');
      continue;
    }

    // 제목
    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2 style="font-size:20px;font-weight:800;color:var(--text-primary);margin:28px 0 12px;letter-spacing:-0.02em;">${inlineFormat(h1[1])}</h2>`);
      continue;
    }
    if (h2) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:22px 0 8px;">${inlineFormat(h2[1])}</h3>`);
      continue;
    }
    if (h3) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h4 style="font-size:14px;font-weight:700;color:var(--accent);margin:18px 0 6px;">${inlineFormat(h3[1])}</h4>`);
      continue;
    }

    // 목록 항목
    const listItem = line.match(/^[-*]\s+(.+)/);
    if (listItem) {
      if (!inList) { out.push('<ul style="margin:8px 0 8px 18px;list-style:disc;">'); inList = true; }
      out.push(`<li style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin:3px 0;">${inlineFormat(listItem[1])}</li>`);
      continue;
    }

    // 번호 목록
    const numItem = line.match(/^\d+\.\s+(.+)/);
    if (numItem) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin:4px 0;">${inlineFormat(line)}</p>`);
      continue;
    }

    // 빈 줄
    if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<div style="margin:8px 0;"></div>');
      continue;
    }

    // 일반 문단
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p style="font-size:14px;color:var(--text-secondary);line-height:1.8;margin:6px 0;">${inlineFormat(line)}</p>`);
  }

  if (inList) out.push("</ul>");
  return out.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // 굵게
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:var(--text-primary);">$1</strong>')
    // 기울임
    .replace(/\*(.+?)\*/g, '<em style="font-style:italic;">$1</em>')
    // 인라인 코드
    .replace(/`(.+?)`/g, '<code style="background:var(--bg-2);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-size:12px;">$1</code>')
    // 링크
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">$1</a>');
}


// ─── 비밀번호 게이트 ─────────────────────────────────────────────────────
interface LockGateProps {
  onUnlock: () => void;
}

function LockGate({ onUnlock }: LockGateProps) {
  const { t } = useT();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/mylab/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        localStorage.setItem(AUTH_KEY, "1");
        onUnlock();
      } else {
        setError(t("mylab.lock.wrong"));
        setPw("");
        inputRef.current?.focus();
      }
    } catch {
      setError(t("mylab.lock.wrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 320, gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>{t("mylab.lock.title")}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("mylab.lock.desc")}</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 320 }}>
        <input
          ref={inputRef}
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder={t("mylab.lock.placeholder")}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "var(--bg-2)",
            border: `1px solid ${error ? "var(--red)" : "var(--border)"}`,
            borderRadius: 8,
            fontSize: 14,
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        {error && (
          <div style={{ fontSize: 12, color: "var(--red)", alignSelf: "flex-start" }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || !pw.trim()}
          style={{
            width: "100%",
            padding: "10px 0",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading || !pw.trim() ? 0.6 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "..." : t("mylab.lock.btn")}
        </button>
      </form>
    </div>
  );
}


// ─── 분석 카드 ──────────────────────────────────────────────────────────
interface AnalysisCardProps {
  file: AnalysisFile;
  onClick: () => void;
}

function AnalysisCard({ file, onClick }: AnalysisCardProps) {
  const sizeKb = (file.size / 1024).toFixed(1);

  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        width: "100%",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-glow)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 1px var(--accent-glow)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.3 }}>
        {file.title}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
        {file.name}
        <span style={{ marginLeft: 10, color: "var(--text-muted)", opacity: 0.7 }}>{sizeKb} KB</span>
      </div>
    </button>
  );
}


// ─── 마크다운 모달 ───────────────────────────────────────────────────────
interface ContentModalProps {
  file: AnalysisFile;
  onClose: () => void;
}

function ContentModal({ file, onClose }: ContentModalProps) {
  const { t } = useT();
  const [content, setContent] = useState<AnalysisContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`${API}/mylab/analyses/${encodeURIComponent(file.name)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setContent)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [file.name]);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 780,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 모달 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{file.title}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{file.name}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 14px",
              fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {t("mylab.close")}
          </button>
        </div>

        {/* 모달 바디 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {loading && (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("mylab.content.loading")}</div>
          )}
          {error && (
            <div style={{ color: "var(--red)", fontSize: 13 }}>{t("mylab.content.error")}</div>
          )}
          {content && (
            <div
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content.content) }}
              style={{ lineHeight: 1.8 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}


// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────
export default function MyLabSection() {
  const { t } = useT();
  const [unlocked, setUnlocked] = useState(false);
  const [files, setFiles] = useState<AnalysisFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<AnalysisFile | null>(null);

  // localStorage에서 인증 상태 복구
  useEffect(() => {
    if (localStorage.getItem(AUTH_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  // 인증 후 파일 목록 로드
  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    setError(false);
    fetch(`${API}/mylab/analyses`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setFiles(data.files || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="fade-in">
        <LockGate onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 섹션 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          My Lab
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          stock78 / analyses
        </p>
      </div>

      {/* 상태별 렌더 */}
      {loading && (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "40px 0", textAlign: "center" }}>
          {t("mylab.loading")}
        </div>
      )}

      {error && (
        <div style={{ color: "var(--red)", fontSize: 13, padding: "40px 0", textAlign: "center" }}>
          {t("mylab.error")}
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          color: "var(--text-muted)", fontSize: 13, lineHeight: 1.8,
        }}>
          {t("mylab.empty")}
        </div>
      )}

      {!loading && !error && files.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}>
          {files.map(f => (
            <AnalysisCard
              key={f.sha}
              file={f}
              onClick={() => setSelected(f)}
            />
          ))}
        </div>
      )}

      {selected && (
        <ContentModal file={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
