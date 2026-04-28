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
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-sm text-gray-400 mb-2">AI 분석 텍스트 붙여넣기</p>
      <textarea
        className="w-full bg-gray-800 border border-dashed border-gray-600 rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 min-h-[80px] resize-none focus:outline-none focus:border-blue-500"
        placeholder="Gemini / ChatGPT 분석 결과 + 재무제표 데이터를 여기에 붙여넣으면 자동으로 파싱·계산·저장됩니다..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      <button
        onClick={handleAnalyze}
        disabled={loading || !text.trim()}
        className="mt-2 w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg py-2 text-sm transition"
      >
        {loading ? "분석 중..." : "분석 실행"}
      </button>
    </div>
  );
}
