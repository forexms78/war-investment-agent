"use client";

import { useEffect, useState } from "react";
import { StockDetail } from "@/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  ticker: string;
  onClose: () => void;
}

type ChartPeriod = "1d" | "7d" | "30d" | "3mo" | "1y";

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "1d": "1일", "7d": "1주", "30d": "1개월", "3mo": "3개월", "1y": "1년",
};

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtCap(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtVol(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function recLabel(v: number | null | undefined): { label: string; color: string } {
  if (v == null) return { label: "—", color: "var(--text-muted)" };
  if (v <= 1.5) return { label: "Strong Buy", color: "#10b981" };
  if (v <= 2.5) return { label: "Buy",         color: "#22c55e" };
  if (v <= 3.5) return { label: "Hold",        color: "#f59e0b" };
  if (v <= 4.5) return { label: "Sell",        color: "#ef4444" };
  return { label: "Strong Sell", color: "#dc2626" };
}

export default function StockModal({ ticker, onClose }: Props) {
  const [data, setData] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30d");
  const [chartLoading, setChartLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    fetch(`${API}/stocks/${ticker}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [ticker]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePeriod = (p: ChartPeriod) => {
    if (p === chartPeriod) return;
    setChartPeriod(p);
    setChartLoading(true);
    fetch(`${API}/stocks/${ticker}?period=${p}`)
      .then(r => r.json())
      .then((d: StockDetail) => setData(prev => prev ? { ...prev, chart: d.chart } : prev))
      .finally(() => setChartLoading(false));
  };

  const changeVal = data
    ? (chartPeriod === "1d" ? data.change_1d_pct : data.change_30d_pct) ?? 0
    : 0;
  const isUp = changeVal >= 0;
  const chartColor = isUp ? "#10b981" : "#ef4444";
  const rec = recLabel(data?.recommendation);

  const StatBox = ({ label, value }: { label: string; value: string }) => (
    <div style={{
      background: "var(--bg)", borderRadius: 8, padding: "10px 12px",
      border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--card)", borderRadius: 16,
        border: "1px solid var(--border)",
        width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto",
      }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid var(--border)",
              borderTopColor: "var(--accent)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 14px",
            }} />
            <div style={{ fontSize: 13 }}>데이터 로드 중...</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          </div>
        ) : data ? (
          <>
            {/* ── 헤더 ── */}
            <div style={{
              padding: "20px 24px 16px", borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em" }}>{ticker}</span>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{data.name}</span>
                  {data.exchange && (
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 4,
                      background: "var(--bg)", border: "1px solid var(--border)",
                      color: "var(--text-muted)", fontWeight: 600,
                    }}>{data.exchange}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {data.current_price ? `$${fmtNum(data.current_price)}` : "—"}
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 600,
                    color: isUp ? "#10b981" : "#ef4444",
                    background: isUp ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    padding: "2px 8px", borderRadius: 6,
                  }}>
                    {isUp ? "+" : ""}{fmtNum(changeVal)}%
                    <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>
                      ({chartPeriod === "1d" ? "1일" : "30일"})
                    </span>
                  </span>
                </div>
                {(data.sector || data.industry) && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {[data.sector, data.industry].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <button onClick={onClose} style={{
                background: "var(--bg)", border: "1px solid var(--border)",
                color: "var(--text-primary)", width: 34, height: 34,
                borderRadius: "50%", cursor: "pointer", fontSize: 16, flexShrink: 0,
              }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px" }}>

              {/* ── 차트 ── */}
              {data.chart && data.chart.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {/* 기간 탭 */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                    {(["1d", "7d", "30d", "3mo", "1y"] as ChartPeriod[]).map(p => (
                      <button key={p} onClick={() => handlePeriod(p)} style={{
                        padding: "5px 14px", borderRadius: 8, cursor: "pointer",
                        fontSize: 12, fontWeight: chartPeriod === p ? 700 : 400,
                        background: chartPeriod === p ? "var(--accent)" : "var(--bg)",
                        border: chartPeriod === p ? "1px solid var(--accent)" : "1px solid var(--border)",
                        color: chartPeriod === p ? "#fff" : "var(--text-secondary)",
                        transition: "all 0.15s",
                      }}>
                        {PERIOD_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  {chartLoading ? (
                    <div style={{
                      width: "100%", height: 180,
                      background: "var(--bg)", borderRadius: 8,
                      border: "1px solid var(--border)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }} />
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={data.chart}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={58}
                          tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                        <Tooltip
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "가격"]}
                        />
                        <Line type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* ── 핵심 지표 ── */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>핵심 지표</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  <StatBox label="시가총액"      value={fmtCap(data.market_cap)} />
                  <StatBox label="P/E (TTM)"    value={data.trailing_pe ? fmtNum(data.trailing_pe, 1) : "—"} />
                  <StatBox label="P/E (Fwd)"    value={data.forward_pe   ? fmtNum(data.forward_pe, 1)  : "—"} />
                  <StatBox label="EPS (TTM)"    value={data.eps          ? `$${fmtNum(data.eps)}`       : "—"} />
                  <StatBox label="52주 최고"    value={data.week52_high  ? `$${fmtNum(data.week52_high)}`  : "—"} />
                  <StatBox label="52주 최저"    value={data.week52_low   ? `$${fmtNum(data.week52_low)}`   : "—"} />
                  <StatBox label="베타"          value={data.beta         ? fmtNum(data.beta, 2)         : "—"} />
                  <StatBox label="배당 수익률"   value={data.dividend_yield ? fmtPct(data.dividend_yield) : "—"} />
                  <StatBox label="거래량"        value={fmtVol(data.volume)} />
                  <StatBox label="평균 거래량"   value={fmtVol(data.avg_volume)} />
                  <StatBox label="PBR"           value={data.price_to_book ? fmtNum(data.price_to_book, 2) : "—"} />
                  <StatBox label="전일 종가"     value={data.prev_close    ? `$${fmtNum(data.prev_close)}`  : "—"} />
                </div>
              </div>

              {/* ── 재무 지표 ── */}
              {(data.revenue || data.gross_margins || data.profit_margins || data.roe || data.revenue_growth) && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>재무 지표</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    <StatBox label="매출"        value={fmtCap(data.revenue)} />
                    <StatBox label="매출총이익률" value={fmtPct(data.gross_margins)} />
                    <StatBox label="순이익률"     value={fmtPct(data.profit_margins)} />
                    <StatBox label="ROE"          value={fmtPct(data.roe)} />
                    {data.revenue_growth != null && (
                      <StatBox label="매출 성장률" value={fmtPct(data.revenue_growth)} />
                    )}
                  </div>
                </div>
              )}

              {/* ── 애널리스트 컨센서스 ── */}
              {(data.recommendation != null || data.target_mean_price != null) && (
                <div style={{
                  marginBottom: 24, padding: 14,
                  background: "var(--bg)", borderRadius: 10,
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>애널리스트 의견</div>
                    <span style={{
                      fontSize: 14, fontWeight: 700, padding: "4px 12px",
                      borderRadius: 20, background: rec.color + "22", color: rec.color,
                    }}>{rec.label}</span>
                    {data.analyst_count && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{data.analyst_count}명 기준</span>
                    )}
                  </div>
                  {data.target_mean_price && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>목표 주가</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        ${fmtNum(data.target_mean_price)}
                        {data.current_price && (
                          <span style={{
                            fontSize: 12, marginLeft: 6,
                            color: data.target_mean_price > data.current_price ? "#10b981" : "#ef4444",
                          }}>
                            ({data.target_mean_price > data.current_price ? "+" : ""}
                            {(((data.target_mean_price - data.current_price) / data.current_price) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 기업 소개 ── */}
              {data.description && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>기업 소개</div>
                  <p style={{
                    fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7,
                    background: "var(--bg)", padding: 14, borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}>{data.description}</p>
                </div>
              )}

              {/* ── AI 분석 ── */}
              <div style={{
                marginBottom: 24, padding: 14,
                background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)",
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Gemini AI 분석
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>{data.insight}</p>
              </div>

              {/* ── 뉴스 ── */}
              {data.news && data.news.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>최신 뉴스</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.news.slice(0, 4).map((n, i) => (
                      <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                        <div style={{
                          padding: "10px 12px",
                          background: "var(--bg)", borderRadius: 8,
                          border: "1px solid var(--border)",
                          transition: "border-color 0.15s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                        >
                          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.45 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                            {n.source} · {n.published_at ? new Date(n.published_at).toLocaleDateString("ko-KR") : ""}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 60, textAlign: "center", color: "var(--red)" }}>
            데이터를 불러올 수 없습니다.
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
