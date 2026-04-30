"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PasswordGate from "@/components/quant/PasswordGate";
import SignalBadge from "@/components/quant/SignalBadge";

interface Stock {
  id: string;
  ticker: string;
  market: string;
  name: string;
  current_price?: number;
  forward_eps?: number;
  target_pe?: number;
}

interface Journal {
  forward_pe?: number;
  signal?: string;
  date: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

const QuantNav = ({ active }: { active: "journal" | "autotrade" }) => (
  <nav style={{
    borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
    background: "var(--header-bg)", backdropFilter: "blur(16px)",
  }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/dashboard" style={{
          width: 30, height: 30, borderRadius: 8, background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
        }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>W</span>
        </Link>
        <Link href="/dashboard" style={{ textDecoration: "none", color: "inherit" }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>Whalyx</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>Quant</span>
        </Link>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {[
          { href: "/quant", label: "리서치 저널", id: "journal" },
          { href: "/autotrade", label: "자동매매", id: "autotrade" },
        ].map(({ href, label, id }) => {
          const isActive = active === id;
          return (
            <Link key={href} href={href} style={{
              padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: isActive ? 600 : 400,
              textDecoration: "none",
              background: isActive ? "var(--accent-dim)" : "transparent",
              border: isActive ? "1px solid var(--accent-glow)" : "1px solid transparent",
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
            }}>
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  </nav>
);

function QuantResearchJournal() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [journals, setJournals] = useState<Record<string, Journal>>({});
  const [loading, setLoading] = useState(true);
  const [newTicker, setNewTicker] = useState("");
  const [newMarket, setNewMarket] = useState<"US" | "KR">("US");
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch(`${API}/quant/stocks`).then((r) => r.json()).catch(() => []);
    const list: Stock[] = Array.isArray(res) ? res : [];
    setStocks(list);

    const entries = await Promise.all(
      list.map((s) =>
        fetch(`${API}/quant/journal/${s.ticker}`)
          .then((r) => r.json())
          .then((j) => ({ ticker: s.ticker, entry: Array.isArray(j) ? j[0] : null }))
          .catch(() => ({ ticker: s.ticker, entry: null }))
      )
    );
    const map: Record<string, Journal> = {};
    for (const { ticker, entry } of entries) {
      if (entry) map[ticker] = entry;
    }
    setJournals(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicker.trim()) return;
    setAdding(true);
    const t = newTicker.trim().toUpperCase();
    await fetch(`${API}/quant/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: t, market: newMarket, name: t }),
    });
    setNewTicker("");
    await load();
    setAdding(false);
  }

  const signalColor = (sig?: string) =>
    sig === "buy" ? "var(--green)" : sig === "sell" ? "var(--red)" : "var(--gold)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      {loading && (
        <div style={{
          position: "fixed", top: 56, left: 0, right: 0, height: 2, zIndex: 200,
          overflow: "hidden", background: "var(--border)",
        }}>
          <div style={{
            height: "100%", background: "var(--accent)",
            animation: "loadingBar 1.8s ease-in-out infinite", transformOrigin: "left",
          }} />
        </div>
      )}
      <QuantNav active="journal" />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em" }}>리서치 저널</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            종목별 AI 분석 텍스트를 붙여넣어 퀀트 지표를 계산하고 기록합니다.
          </p>
        </div>

        {/* 종목 추가 폼 */}
        <form onSubmit={addStock} style={{ display: "flex", gap: 8 }}>
          <input
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            placeholder="티커 입력 (예: AAPL, 005930)"
            style={{
              flex: 1, background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "9px 14px", color: "var(--text-primary)",
              fontSize: 13, outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <select
            value={newMarket}
            onChange={e => setNewMarket(e.target.value as "US" | "KR")}
            style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "9px 12px", color: "var(--text-secondary)",
              fontSize: 13, outline: "none", cursor: "pointer",
            }}
          >
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
          <button
            type="submit"
            disabled={adding}
            style={{
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600,
              cursor: adding ? "not-allowed" : "pointer", opacity: adding ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {adding ? "추가 중..." : "종목 추가"}
          </button>
        </form>

        {/* 종목 목록 */}
        {loading ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "16px 20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                    <div style={{ width: 4, height: 40, borderRadius: 2, background: "var(--card-hover)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        width: `${100 + (i * 17) % 80}px`, height: 14, borderRadius: 4,
                        background: "var(--card-hover)", marginBottom: 8,
                        animation: `shimmer ${1.2 + i * 0.1}s infinite linear`,
                        backgroundImage: "linear-gradient(90deg, var(--card-hover) 0%, var(--border) 50%, var(--card-hover) 100%)",
                        backgroundSize: "800px 100%",
                      }} />
                      <div style={{
                        width: 60, height: 11, borderRadius: 3,
                        background: "var(--card-hover)",
                      }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    {[60, 60, 50].map((w, j) => (
                      <div key={j} style={{
                        width: w, height: 12, borderRadius: 3,
                        background: "var(--card-hover)",
                        animation: `shimmer ${1.3 + j * 0.1}s infinite linear`,
                        backgroundImage: "linear-gradient(90deg, var(--card-hover) 0%, var(--border) 50%, var(--card-hover) 100%)",
                        backgroundSize: "800px 100%",
                      }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <style>{`
              @keyframes shimmer {
                0%   { background-position: -400px 0; }
                100% { background-position: 400px 0; }
              }
            `}</style>
          </>
        ) : stocks.length === 0 ? (
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "48px 24px", textAlign: "center",
          }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0 0 8px" }}>추적 중인 종목이 없습니다</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>위에서 티커를 입력해 첫 종목을 추가해보세요.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stocks.map((s) => {
              const j = journals[s.ticker];
              const sig = j?.signal;
              return (
                <Link
                  key={s.ticker}
                  href={`/quant/stocks/${s.ticker}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: 12, padding: "16px 20px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "background 0.1s, border-color 0.1s", cursor: "pointer",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-light)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {/* 시그널 인디케이터 */}
                      <div style={{
                        width: 4, height: 40, borderRadius: 2,
                        background: sig ? signalColor(sig) : "var(--border)",
                        flexShrink: 0,
                      }} />
                      <div>
                        <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 15, margin: "0 0 2px" }}>
                          {s.name}
                        </p>
                        <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
                          {s.ticker} · {s.market}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                      {s.current_price && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ color: "var(--text-muted)", fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>현재가</p>
                          <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, margin: 0 }}>
                            {s.market === "KR" ? `${s.current_price.toLocaleString()}원` : `$${s.current_price.toLocaleString()}`}
                          </p>
                        </div>
                      )}
                      {j?.forward_pe && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ color: "var(--text-muted)", fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Forward P/E</p>
                          <p style={{ color: "var(--gold)", fontSize: 14, fontWeight: 700, margin: 0 }}>
                            {j.forward_pe}
                          </p>
                        </div>
                      )}
                      {j?.date && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ color: "var(--text-muted)", fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>최근 기록</p>
                          <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>
                            {new Date(j.date).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                      )}
                      {sig ? (
                        <SignalBadge signal={sig} size="sm" />
                      ) : (
                        <span style={{
                          fontSize: 11, color: "var(--text-muted)", padding: "3px 10px",
                          border: "1px solid var(--border)", borderRadius: 6,
                        }}>
                          미분석
                        </span>
                      )}
                      <span style={{ color: "var(--text-muted)", fontSize: 18 }}>›</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function QuantPage() {
  return (
    <PasswordGate>
      <QuantResearchJournal />
    </PasswordGate>
  );
}
