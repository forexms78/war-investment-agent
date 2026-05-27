"use client";

import { useEffect, useState } from "react";
import { ETFHoldingsData, ETFSignalItem } from "@/types";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;

const BAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#f97316", "#6366f1", "#84cc16",
];

interface Props {
  etf: ETFSignalItem;
  onClose: () => void;
  onSelectStock?: (ticker: string) => void;
}

function chgColor(v: number | null | undefined): string {
  if (v == null) return "var(--text-muted)";
  return v >= 0 ? "var(--green)" : "var(--red)";
}

function fmtChg(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function ETFHoldingsModal({ etf, onClose, onSelectStock }: Props) {
  const { t } = useT();
  const [data, setData] = useState<ETFHoldingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/etf-holdings/${etf.ticker}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [etf.ticker]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasHoldings = data && data.holdings.length > 0;
  const maxWeight = hasHoldings ? Math.max(...data.holdings.map(h => h.weight)) : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 20, width: "100%", maxWidth: 780,
          maxHeight: "90vh", overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "24px 28px 20px",
          borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0,
          background: "var(--card)", zIndex: 10,
          borderRadius: "20px 20px 0 0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {etf.ticker.replace(".KS", "").replace(".KQ", "")}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                  padding: "3px 10px", borderRadius: 999,
                  background: "var(--accent-dim)", color: "var(--accent)",
                  border: "1px solid var(--accent-glow)",
                }}>
                  {etf.category}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{etf.name}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--bg-2)", border: "1px solid var(--border)",
                borderRadius: 999, width: 32, height: 32,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 16, color: "var(--text-muted)",
                transition: "all 0.15s", flexShrink: 0,
              }}
            >
              x
            </button>
          </div>

          {/* ETF 자체 등락률 */}
          <div style={{ marginTop: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8,
            }}>
              {t("holdings.etf_perf")}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Metric label="RSI" value={Math.round(etf.rsi).toString()} />
              <Metric label="52w" value={`${Math.round(etf.week52_pos)}%`} />
              <Sep />
              {etf.change_7d != null && (
                <Metric label={t("holdings.7d")} value={fmtChg(etf.change_7d)} color={chgColor(etf.change_7d)} />
              )}
              {etf.change_1m != null && (
                <Metric label={t("holdings.1m")} value={fmtChg(etf.change_1m)} color={chgColor(etf.change_1m)} />
              )}
              {etf.change_3m != null && (
                <Metric label="3M" value={fmtChg(etf.change_3m)} color={chgColor(etf.change_3m)} />
              )}
              {etf.change_6m != null && (
                <Metric label={t("holdings.6m")} value={fmtChg(etf.change_6m)} color={chgColor(etf.change_6m)} />
              )}
              <Metric label="1Y" value={fmtChg(etf.change_1y)} color={chgColor(etf.change_1y)} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px 28px 28px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
              {t("holdings.loading")}
            </div>
          ) : !hasHoldings ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
                {t("holdings.unavailable")}
              </div>
              {etf.description && (
                <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
                  {etf.description}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Top Holdings - 수평 바 차트 */}
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "var(--text-muted)",
                  letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14,
                }}>
                  {t("holdings.top")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data!.holdings.map((h, i) => (
                    <button
                      key={h.ticker}
                      onClick={() => h.ticker && onSelectStock?.(h.ticker)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "transparent", border: "none",
                        cursor: h.ticker ? "pointer" : "default",
                        padding: "6px 0", textAlign: "left", width: "100%",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                    >
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
                        width: 50, flexShrink: 0,
                      }}>
                        {h.ticker}
                      </span>
                      <div style={{ flex: 1, position: "relative", height: 24, background: "var(--bg-2)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${(h.weight / maxWeight) * 100}%`,
                          background: BAR_COLORS[i % BAR_COLORS.length],
                          borderRadius: 6,
                          transition: "width 0.6s ease-out",
                          minWidth: 2,
                          opacity: 0.75,
                        }} />
                        <span style={{
                          position: "absolute", top: "50%", transform: "translateY(-50%)",
                          left: `${Math.min((h.weight / maxWeight) * 100 + 2, 92)}%`,
                          fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}>
                          {h.weight.toFixed(1)}%
                        </span>
                      </div>
                      <span style={{
                        fontSize: 11, color: "var(--text-muted)",
                        width: 100, flexShrink: 0, textAlign: "right",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {h.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sector Weights - 도넛 차트 */}
              {data!.sector_weights.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "var(--text-muted)",
                    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14,
                  }}>
                    {t("holdings.sector")}
                  </div>
                  <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                    <DonutChart sectors={data!.sector_weights} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {data!.sector_weights.map(s => (
                          <div key={s.sector} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              width: 10, height: 10, borderRadius: 3,
                              background: s.color, flexShrink: 0,
                            }} />
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>
                              {s.sector}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                              {s.weight.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 편입 종목 등락률 테이블 */}
              {data!.holdings.some(h => h.current_price != null) && (
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "var(--text-muted)",
                    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14,
                  }}>
                    {t("holdings.perf")}
                  </div>

                  {/* 테이블 헤더 */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 70px 60px 60px 60px 60px",
                    gap: 4, padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                    letterSpacing: "0.04em",
                  }}>
                    <span>Ticker</span>
                    <span>Name</span>
                    <span style={{ textAlign: "right" }}>{t("holdings.price")}</span>
                    <span style={{ textAlign: "right" }}>{t("holdings.1d")}</span>
                    <span style={{ textAlign: "right" }}>{t("holdings.7d")}</span>
                    <span style={{ textAlign: "right" }}>{t("holdings.1m")}</span>
                    <span style={{ textAlign: "right" }}>{t("holdings.6m")}</span>
                  </div>

                  {/* 테이블 본문 */}
                  {data!.holdings.map((h, i) => (
                    <button
                      key={h.ticker}
                      onClick={() => h.ticker && onSelectStock?.(h.ticker)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 1fr 70px 60px 60px 60px 60px",
                        gap: 4, padding: "10px 0",
                        borderBottom: "1px solid var(--border)",
                        background: "transparent", border: "none", width: "100%",
                        cursor: h.ticker ? "pointer" : "default",
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                        {h.ticker}
                      </span>
                      <span style={{
                        fontSize: 11, color: "var(--text-muted)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {h.name}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
                        {h.current_price != null ? `$${h.current_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "-"}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: chgColor(h.change_1d_pct), textAlign: "right" }}>
                        {fmtChg(h.change_1d_pct)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: chgColor(h.change_7d_pct), textAlign: "right" }}>
                        {fmtChg(h.change_7d_pct)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: chgColor(h.change_1m_pct), textAlign: "right" }}>
                        {fmtChg(h.change_1m_pct)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: chgColor(h.change_6m_pct), textAlign: "right" }}>
                        {fmtChg(h.change_6m_pct)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", background: "var(--bg-2)", borderRadius: 6 }}>
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />;
}

function DonutChart({ sectors }: { sectors: { sector: string; weight: number; color: string }[] }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 70;
  const innerR = 45;

  const total = sectors.reduce((s, v) => s + v.weight, 0);
  let cumAngle = -90;

  const paths = sectors.map(s => {
    const angle = (s.weight / total) * 360;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1o = cx + outerR * Math.cos(startRad);
    const y1o = cy + outerR * Math.sin(startRad);
    const x2o = cx + outerR * Math.cos(endRad);
    const y2o = cy + outerR * Math.sin(endRad);
    const x1i = cx + innerR * Math.cos(endRad);
    const y1i = cy + innerR * Math.sin(endRad);
    const x2i = cx + innerR * Math.cos(startRad);
    const y2i = cy + innerR * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const d = [
      `M ${x1o} ${y1o}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      "Z",
    ].join(" ");

    return <path key={s.sector} d={d} fill={s.color} opacity={0.85} />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {paths}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="800">
        {sectors.length}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
        sectors
      </text>
    </svg>
  );
}
