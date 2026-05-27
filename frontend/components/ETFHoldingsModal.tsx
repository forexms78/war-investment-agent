"use client";

import { useEffect, useMemo, useState } from "react";
import { ETFHoldingsData, ETFHoldingItem, ETFSignalItem } from "@/types";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;

const DONUT_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#f97316", "#6366f1", "#84cc16",
];

type SortPeriod = "1d" | "7d" | "1m" | "6m";

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

function getChgByPeriod(h: ETFHoldingItem, period: SortPeriod): number | null | undefined {
  if (period === "1d") return h.change_1d_pct;
  if (period === "7d") return h.change_7d_pct;
  if (period === "1m") return h.change_1m_pct;
  return h.change_6m_pct;
}

export default function ETFHoldingsModal({ etf, onClose, onSelectStock }: Props) {
  const { t } = useT();
  const [data, setData] = useState<ETFHoldingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortPeriod, setSortPeriod] = useState<SortPeriod>("1d");

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
  const isKrEtf = etf.ticker.endsWith(".KS") || etf.ticker.endsWith(".KQ");

  const sortedHoldings = useMemo(() => {
    if (!data) return [];
    return [...data.holdings].sort((a, b) => {
      const av = getChgByPeriod(a, sortPeriod) ?? -999;
      const bv = getChgByPeriod(b, sortPeriod) ?? -999;
      return bv - av;
    });
  }, [data, sortPeriod]);

  const PERIODS: { id: SortPeriod; label: string }[] = [
    { id: "1d", label: t("holdings.1d") },
    { id: "7d", label: t("holdings.7d") },
    { id: "1m", label: t("holdings.1m") },
    { id: "6m", label: t("holdings.6m") },
  ];

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
          borderRadius: 20, width: "100%", maxWidth: 720,
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
            <div style={{
              background: "var(--bg-2)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "28px 24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                {t("holdings.unavailable")}
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6,
                maxWidth: 420, margin: "0 auto", marginBottom: etf.description ? 16 : 0,
              }}>
                {isKrEtf
                  ? t("holdings.kr_reason")
                  : t("holdings.us_reason")}
              </div>
              {etf.description && (
                <div style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "14px 18px", textAlign: "left",
                  fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 6 }}>
                    ETF DESCRIPTION
                  </div>
                  {etf.description}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 도넛 차트 — 편입 종목 비중 (메인) */}
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "var(--text-muted)",
                  letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16,
                }}>
                  {t("holdings.top")}
                </div>
                <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <HoldingsDonut holdings={data!.holdings} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {data!.holdings.map((h, i) => (
                        <button
                          key={h.ticker}
                          onClick={() => h.ticker && onSelectStock?.(h.ticker)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            background: "transparent", border: "none", padding: "4px 0",
                            cursor: h.ticker ? "pointer" : "default",
                            textAlign: "left", width: "100%",
                            transition: "opacity 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                        >
                          <span style={{
                            width: 10, height: 10, borderRadius: 3,
                            background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", width: 50 }}>
                            {h.ticker}
                          </span>
                          <span style={{
                            fontSize: 11, color: "var(--text-muted)", flex: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {h.name}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>
                            {h.weight.toFixed(1)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 편입 종목 등락률 — 기간 선택 + 정렬 */}
              {data!.holdings.some(h => h.current_price != null) && (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 14, flexWrap: "wrap", gap: 8,
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: "var(--text-muted)",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>
                      {t("holdings.perf")}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {PERIODS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSortPeriod(p.id)}
                          style={{
                            padding: "5px 14px", borderRadius: 999,
                            background: sortPeriod === p.id ? "var(--text-primary)" : "var(--bg-2)",
                            color: sortPeriod === p.id ? "var(--bg)" : "var(--text-muted)",
                            border: sortPeriod === p.id ? "none" : "1px solid var(--border)",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {sortedHoldings.map((h, i) => {
                    const chgVal = getChgByPeriod(h, sortPeriod);
                    const isUp = (chgVal ?? 0) >= 0;
                    return (
                      <button
                        key={h.ticker}
                        onClick={() => h.ticker && onSelectStock?.(h.ticker)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 4px",
                          borderBottom: "1px solid var(--border)",
                          background: "transparent", border: "none", borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: "var(--border)",
                          width: "100%", cursor: h.ticker ? "pointer" : "default",
                          textAlign: "left", transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 20, textAlign: "center", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{h.ticker}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                          {h.weight.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, width: 55, textAlign: "right", flexShrink: 0 }}>
                          {h.current_price != null ? `$${h.current_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "-"}
                        </span>
                        <span style={{
                          fontSize: 13, fontWeight: 800, width: 70, textAlign: "right", flexShrink: 0,
                          color: chgColor(chgVal),
                        }}>
                          {fmtChg(chgVal)}
                        </span>
                      </button>
                    );
                  })}
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

function HoldingsDonut({ holdings }: { holdings: ETFHoldingItem[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 90;
  const innerR = 58;

  const sorted = [...holdings].sort((a, b) => b.weight - a.weight);
  const total = sorted.reduce((s, v) => s + v.weight, 0);
  let cumAngle = -90;

  const paths = sorted.map((h, i) => {
    const angle = (h.weight / total) * 360;
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

    return <path key={h.ticker} d={d} fill={DONUT_COLORS[i % DONUT_COLORS.length]} opacity={0.85} />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {paths}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="800">
        {sorted.length}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="600">
        holdings
      </text>
    </svg>
  );
}
