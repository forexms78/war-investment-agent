"use client";
import { useState } from "react";

interface AnalyzeResult {
  ticker?: string;
  name?: string;
  current_price?: number;
  forward_pe?: number;
  fair_value_pe?: number;
  fair_value_graham?: number;
  fair_value_peg?: number;
  avg_fair_value?: number;
  signal?: string;
  overhang_note?: string;
  error?: string;
}

interface Props {
  ticker?: string;
  targetPe?: number;
  onAnalyzed: (result: AnalyzeResult) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function PasteAnalyzer({ ticker, targetPe = 30, onAnalyzed }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/quant/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ticker, target_pe: targetPe }),
      });
      const data: AnalyzeResult = await res.json();
      if (data.error) { setError(data.error); return; }
      onAnalyzed(data);
      setText("");
    } catch {
      setError("분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 10px" }}>
        AI 분석 텍스트 붙여넣기
      </p>
      <textarea
        style={{
          width: "100%", background: "var(--bg-2)",
          border: "1px dashed var(--border-light)", borderRadius: 8,
          padding: "12px 14px", fontSize: 13, color: "var(--text-secondary)",
          minHeight: 90, resize: "none", outline: "none", boxSizing: "border-box",
          fontFamily: "inherit",
        }}
        placeholder="Gemini / ChatGPT 분석 결과 + 재무제표 데이터를 여기에 붙여넣으면 자동으로 파싱·계산·저장됩니다..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={e => (e.target.style.borderColor = "var(--accent)")}
        onBlur={e => (e.target.style.borderColor = "var(--border-light)")}
      />
      {error && <p style={{ color: "var(--red)", fontSize: 12, margin: "6px 0 0" }}>{error}</p>}
      <button
        onClick={handleAnalyze}
        disabled={loading || !text.trim()}
        style={{
          marginTop: 10, width: "100%",
          background: loading || !text.trim() ? "var(--card-hover)" : "var(--accent)",
          color: loading || !text.trim() ? "var(--text-muted)" : "#fff",
          border: "none", borderRadius: 8, padding: "10px",
          fontSize: 13, fontWeight: 700,
          cursor: loading || !text.trim() ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {loading ? "분석 중..." : "분석 실행"}
      </button>
    </div>
  );
}
