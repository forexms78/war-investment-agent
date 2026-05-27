"use client";

import { useEffect, useState } from "react";
import { StockDetail } from "@/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  ticker: string;
  onClose: () => void;
}

type ChartPeriod = "1d" | "7d" | "30d" | "3mo" | "1y";

const PERIOD_LABELS_KO: Record<ChartPeriod, string> = {
  "1d": "1일",  "7d": "1주",  "30d": "1개월",  "3mo": "3개월",  "1y": "1년",
};
const PERIOD_LABELS_EN: Record<ChartPeriod, string> = {
  "1d": "1D",   "7d": "1W",   "30d": "1M",     "3mo": "3M",     "1y": "1Y",
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

// Maps yfinance recommendationMean (1=Strong Buy → 5=Strong Sell) onto the
// system's 5-step signal scale so it inherits --sig-* colors automatically.
function recSignal(v: number | null | undefined): { ko: string; en: string; sigClass: string } | null {
  if (v == null) return null;
  if (v <= 1.5) return { ko: "적극매수", en: "STRONG BUY",  sigClass: "STRONG_BUY"  };
  if (v <= 2.5) return { ko: "매수",     en: "BUY",         sigClass: "BUY"         };
  if (v <= 3.5) return { ko: "관망",     en: "HOLD",        sigClass: "HOLD"        };
  if (v <= 4.5) return { ko: "매도",     en: "SELL",        sigClass: "SELL"        };
  return         { ko: "적극매도",       en: "STRONG SELL", sigClass: "STRONG_SELL" };
}

export default function StockModal({ ticker, onClose }: Props) {
  const { lang } = useT();
  const [data, setData] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30d");
  const [chartLoading, setChartLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;
  const PERIOD_LABELS = lang === "ko" ? PERIOD_LABELS_KO : PERIOD_LABELS_EN;

  useEffect(() => {
    fetch(`${API}/stocks/${ticker}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [API, ticker]);

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
  const chartColor = isUp ? "var(--up)" : "var(--down)";
  const rec = recSignal(data?.recommendation);

  return (
    <div className="wx-modal-scrim" onClick={onClose}>
      <div className="wx-modal" onClick={e => e.stopPropagation()}>

        {loading ? (
          <div className="sm-loading">
            <div className="sm-spinner" />
            <div className="sm-loading-text">
              {lang === "ko" ? "데이터 불러오는 중…" : "Loading…"}
            </div>
          </div>
        ) : data ? (
          <>
            {/* ── HEADER ── */}
            <div className="wx-modal-head">
              <div className="wx-modal-head-left">
                <div className="wx-modal-ticker-row">
                  <span className="wx-modal-ticker">{ticker}</span>
                  {data.exchange && <span className="sm-exchange">{data.exchange}</span>}
                  {rec && (
                    <span className={`wx-signal ${rec.sigClass}`}>
                      {lang === "ko" ? rec.ko : rec.en}
                    </span>
                  )}
                </div>
                <div className="wx-modal-name">
                  {data.name}
                  {(data.sector || data.industry) && (
                    <span className="sm-sector">
                      {" · "}{[data.sector, data.industry].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </div>
              <button className="wx-modal-close" onClick={onClose} aria-label="Close">✕</button>
            </div>

            {/* ── PRICE ── */}
            <div className="wx-modal-price">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="wx-modal-price-main">
                  {data.current_price ? `$${fmtNum(data.current_price)}` : "—"}
                </div>
                {data.prev_close && (
                  <div className="wx-modal-price-sub">
                    {lang === "ko" ? "전일" : "Prev"} ${fmtNum(data.prev_close)}
                  </div>
                )}
              </div>
              <div className="wx-modal-1y">
                <div className="wx-modal-1y-label">{chartPeriod === "1d" ? "1D" : "30D"}</div>
                <div className={`wx-modal-1y-value ${isUp ? "up" : "dn"}`}>
                  {isUp ? "+" : ""}{fmtNum(changeVal)}%
                </div>
              </div>
            </div>

            {/* ── CHART ── */}
            {data.chart && data.chart.length > 0 && (
              <div className="sm-chart">
                <div className="sm-chart-head">
                  <div className="wx-modal-section-title">
                    {lang === "ko" ? "가격 추이" : "Price Chart"}
                  </div>
                  <div className="sm-period-pills">
                    {(["1d", "7d", "30d", "3mo", "1y"] as ChartPeriod[]).map(p => (
                      <button
                        key={p}
                        className="wx-range-pill"
                        aria-pressed={chartPeriod === p}
                        onClick={() => handlePeriod(p)}
                      >
                        {PERIOD_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
                {chartLoading ? (
                  <div className="sm-chart-skeleton skeleton" />
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data.chart}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "var(--fg-subtle)" }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 10, fill: "var(--fg-subtle)" }}
                        axisLine={false}
                        tickLine={false}
                        width={58}
                        tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--r-sm)",
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          color: "var(--fg)",
                        }}
                        formatter={(v: unknown) => [
                          `$${Number(v).toLocaleString()}`,
                          lang === "ko" ? "가격" : "Price",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke={chartColor}
                        strokeWidth={1.6}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* ── AI INSIGHT ── */}
            {data.insight && (
              <div className="wx-modal-reason">
                <div className="wx-modal-reason-label">
                  {lang === "ko" ? "Gemini AI 분석" : "Gemini AI Analysis"}
                </div>
                {data.insight}
              </div>
            )}

            {/* ── KEY METRICS ── */}
            <div className="sm-section">
              <div className="wx-modal-section-head">
                <div className="wx-modal-section-title">
                  {lang === "ko" ? "핵심 지표" : "Key Metrics"}
                </div>
              </div>
              <div className="sm-stat-grid">
                <Stat k={lang === "ko" ? "시가총액" : "Market Cap"}      v={fmtCap(data.market_cap)} />
                <Stat k="P/E (TTM)"  v={data.trailing_pe ? fmtNum(data.trailing_pe, 1) : "—"} />
                <Stat k="P/E (Fwd)"  v={data.forward_pe  ? fmtNum(data.forward_pe, 1)  : "—"} />
                <Stat k="EPS (TTM)"  v={data.eps         ? `$${fmtNum(data.eps)}`      : "—"} />
                <Stat k={lang === "ko" ? "52주 최고" : "52W High"}        v={data.week52_high ? `$${fmtNum(data.week52_high)}` : "—"} />
                <Stat k={lang === "ko" ? "52주 최저" : "52W Low"}         v={data.week52_low  ? `$${fmtNum(data.week52_low)}`  : "—"} />
                <Stat k={lang === "ko" ? "베타" : "Beta"}                 v={data.beta        ? fmtNum(data.beta, 2)             : "—"} />
                <Stat k={lang === "ko" ? "배당 수익률" : "Div Yield"}     v={data.dividend_yield ? fmtPct(data.dividend_yield)   : "—"} />
                <Stat k={lang === "ko" ? "거래량" : "Volume"}             v={fmtVol(data.volume)} />
                <Stat k={lang === "ko" ? "평균 거래량" : "Avg Vol"}        v={fmtVol(data.avg_volume)} />
                <Stat k="PBR"        v={data.price_to_book ? fmtNum(data.price_to_book, 2) : "—"} />
                <Stat k={lang === "ko" ? "변동성" : "Volatility"}         v={data.volatility != null ? fmtPct(data.volatility) : "—"} />
              </div>
            </div>

            {/* ── FINANCIALS ── */}
            {(data.revenue || data.gross_margins || data.profit_margins || data.roe || data.revenue_growth) && (
              <div className="sm-section">
                <div className="wx-modal-section-head">
                  <div className="wx-modal-section-title">
                    {lang === "ko" ? "재무 지표" : "Financials"}
                  </div>
                </div>
                <div className="sm-stat-grid">
                  <Stat k={lang === "ko" ? "매출" : "Revenue"}            v={fmtCap(data.revenue)} />
                  <Stat k={lang === "ko" ? "매출총이익률" : "Gross"}       v={fmtPct(data.gross_margins)} />
                  <Stat k={lang === "ko" ? "순이익률" : "Net Margin"}      v={fmtPct(data.profit_margins)} />
                  <Stat k="ROE"      v={fmtPct(data.roe)} />
                  {data.revenue_growth != null && (
                    <Stat
                      k={lang === "ko" ? "매출 성장률" : "Rev Growth"}
                      v={fmtPct(data.revenue_growth)}
                      tone={data.revenue_growth >= 0 ? "up" : "dn"}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── ANALYST CONSENSUS ── */}
            {(rec || data.target_mean_price) && (
              <div className="sm-section">
                <div className="wx-modal-section-head">
                  <div className="wx-modal-section-title">
                    {lang === "ko" ? "애널리스트 컨센서스" : "Analyst Consensus"}
                  </div>
                  {data.analyst_count != null && (
                    <div className="wx-modal-section-meta">
                      {data.analyst_count}{lang === "ko" ? "명 기준" : " analysts"}
                    </div>
                  )}
                </div>
                <div className="sm-analyst">
                  {rec && (
                    <div className="sm-analyst-cell">
                      <div className="sm-stat-k">{lang === "ko" ? "의견" : "Rating"}</div>
                      <span className={`wx-signal ${rec.sigClass}`}>
                        {lang === "ko" ? rec.ko : rec.en}
                      </span>
                    </div>
                  )}
                  {data.target_mean_price && (
                    <div className="sm-analyst-cell">
                      <div className="sm-stat-k">{lang === "ko" ? "목표 주가" : "Target"}</div>
                      <div className="sm-target">
                        <span className="sm-target-price">${fmtNum(data.target_mean_price)}</span>
                        {data.current_price && (
                          <span className={`sm-target-delta ${data.target_mean_price > data.current_price ? "up" : "dn"}`}>
                            {data.target_mean_price > data.current_price ? "+" : ""}
                            {(((data.target_mean_price - data.current_price) / data.current_price) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── DESCRIPTION ── */}
            {data.description && (
              <div className="sm-section">
                <div className="wx-modal-section-head">
                  <div className="wx-modal-section-title">
                    {lang === "ko" ? "기업 소개" : "About"}
                  </div>
                </div>
                <p className="sm-desc">{data.description}</p>
              </div>
            )}

            {/* ── NEWS ── */}
            {data.news && data.news.length > 0 && (
              <div className="sm-section sm-section-last">
                <div className="wx-modal-section-head">
                  <div className="wx-modal-section-title">
                    {lang === "ko" ? "최신 뉴스" : "Latest News"}
                  </div>
                </div>
                <div className="sm-news">
                  {data.news.slice(0, 4).map((n, i) => (
                    <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="sm-news-row">
                      <div className="sm-news-hl">{n.title}</div>
                      <div className="sm-news-meta">
                        {n.source}
                        {n.published_at && ` · ${new Date(n.published_at).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US")}`}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ── FOOTER ── */}
            <div className="wx-modal-foot">
              <span className="wx-modal-foot-meta">
                Powered by yfinance · Gemini AI
              </span>
            </div>
          </>
        ) : (
          <div className="sm-empty">
            {lang === "ko" ? "데이터를 불러올 수 없습니다." : "Could not load data."}
          </div>
        )}
      </div>

      <style jsx>{`
        .sm-loading {
          padding: 80px 24px;
          text-align: center;
          color: var(--fg-subtle);
        }
        .sm-spinner {
          width: 28px; height: 28px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 14px;
        }
        .sm-loading-text { font-size: 12px; font-family: var(--font-mono); letter-spacing: 0.04em; }

        .sm-exchange {
          font-size: 10px; font-weight: 600;
          padding: 2px 7px;
          border-radius: var(--r-xs);
          background: var(--surface-sunken);
          border: 1px solid var(--border);
          color: var(--fg-subtle);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .sm-sector {
          color: var(--fg-subtle);
        }

        .sm-section {
          padding: 20px 28px;
          border-bottom: 1px solid var(--divider);
        }
        .sm-section-last { border-bottom: none; }

        .sm-chart {
          padding: 20px 28px;
          border-bottom: 1px solid var(--divider);
        }
        .sm-chart-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
          flex-wrap: wrap; gap: 12px;
        }
        .sm-period-pills {
          display: inline-flex; gap: 0;
        }
        .sm-chart-skeleton {
          width: 100%; height: 180px;
          border-radius: var(--r-sm);
        }

        .sm-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px 24px;
        }
        @media (max-width: 580px) {
          .sm-stat-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .sm-stat-k {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--fg-subtle);
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 3px;
          white-space: nowrap;
        }

        .sm-analyst {
          display: flex;
          align-items: flex-start;
          gap: 32px;
          flex-wrap: wrap;
        }
        .sm-analyst-cell { display: flex; flex-direction: column; gap: 6px; }
        .sm-target { display: flex; align-items: baseline; gap: 8px; }
        .sm-target-price {
          font-family: var(--font-sans);
          font-size: 18px; font-weight: 700;
          color: var(--fg);
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .sm-target-delta {
          font-family: var(--font-mono);
          font-size: 12px; font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .sm-target-delta.up { color: var(--up); }
        .sm-target-delta.dn { color: var(--down); }

        .sm-desc {
          font-size: 13px;
          color: var(--fg-muted);
          line-height: 1.7;
          margin: 0;
          word-break: keep-all;
        }

        .sm-news { display: flex; flex-direction: column; }
        .sm-news-row {
          display: block;
          padding: 10px 0;
          border-bottom: 1px solid var(--divider);
          text-decoration: none;
          transition: opacity var(--dur-fast) var(--ease-out);
        }
        .sm-news-row:last-child { border-bottom: none; }
        .sm-news-row:hover { opacity: 0.7; }
        .sm-news-hl {
          font-size: 13px;
          color: var(--fg);
          line-height: 1.5;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .sm-news-meta {
          font-size: 11px;
          color: var(--fg-subtle);
          font-family: var(--font-mono);
        }

        .sm-empty {
          padding: 60px 24px;
          text-align: center;
          color: var(--down);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "up" | "dn" }) {
  return (
    <div className="sm-stat">
      <div className="sm-stat-k">{k}</div>
      <div className={`sm-stat-v ${tone || ""}`}>{v}</div>
      <style jsx>{`
        .sm-stat { display: flex; flex-direction: column; }
        .sm-stat-k {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--fg-subtle);
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 3px;
          white-space: nowrap;
        }
        .sm-stat-v {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          color: var(--fg);
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum', 'zero';
          letter-spacing: -0.01em;
        }
        .sm-stat-v.up { color: var(--up); }
        .sm-stat-v.dn { color: var(--down); }
      `}</style>
    </div>
  );
}
