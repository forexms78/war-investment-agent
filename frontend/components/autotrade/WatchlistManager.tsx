"use client";
import { useEffect, useState } from "react";

interface WatchItem {
  ticker: string;
  name: string;
  market: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
  outline: "none",
};

function btnStyle(disabled: boolean, variant: "add" | "del"): React.CSSProperties {
  return {
    padding: variant === "add" ? "9px 18px" : "5px 12px",
    borderRadius: 7,
    border: "none",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled
      ? "var(--card-hover)"
      : variant === "add"
      ? "var(--accent)"
      : "rgba(239,68,68,0.15)",
    color: disabled
      ? "var(--text-muted)"
      : variant === "add"
      ? "#fff"
      : "var(--red)",
  };
}

export default function WatchlistManager({ apiUrl }: { apiUrl: string }) {
  const [items, setItems]     = useState<WatchItem[]>([]);
  const [ticker, setTicker]   = useState("");
  const [market, setMarket]   = useState<"KR" | "US">("KR");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`${apiUrl}/autotrade/watchlist`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/autotrade/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t, name: t, market }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string })?.detail ?? "추가 실패");
      }
      setTicker("");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "추가 실패";
      setError(msg);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(t: string) {
    try {
      await fetch(`${apiUrl}/autotrade/watchlist/${t}`, { method: "DELETE" });
      await load();
    } catch {
      setError("삭제 실패");
      setTimeout(() => setError(null), 3000);
    }
  }

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      <p style={{
        color: "var(--text-muted)", fontSize: 11, fontWeight: 600,
        letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 14px",
      }}>
        워치리스트 관리
      </p>

      {/* 추가 폼 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !loading && handleAdd()}
          placeholder="티커 (예: 005930, AAPL)"
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />
        <select
          value={market}
          onChange={e => setMarket(e.target.value as "KR" | "US")}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="KR">KR</option>
          <option value="US">US</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={loading || !ticker.trim()}
          style={btnStyle(loading || !ticker.trim(), "add")}
        >
          {loading ? "추가 중..." : "+ 추가"}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "var(--red)", margin: "0 0 10px" }}>{error}</p>
      )}

      {/* 목록 테이블 */}
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>등록된 종목 없음</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["티커", "종목명", "시장", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "6px 10px",
                  textAlign: i === 3 ? "right" : "left",
                  fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                  borderBottom: "1px solid var(--border)", letterSpacing: "0.04em",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.ticker} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {item.ticker}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>
                  {item.name}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: item.market === "US" ? "rgba(251,191,36,0.15)" : "rgba(99,102,241,0.15)",
                    color: item.market === "US" ? "var(--gold)" : "var(--accent)",
                  }}>
                    {item.market}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  <button
                    onClick={() => handleDelete(item.ticker)}
                    style={btnStyle(false, "del")}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
