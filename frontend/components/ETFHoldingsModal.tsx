"use client";

import { useEffect, useMemo, useState } from "react";
import { ETFHoldingsData, ETFHoldingItem, ETFSignalItem, ETFSignal } from "@/types";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;

const DONUT_COLORS = [
  "#7CC7E8", "#4ABF8A", "#A37BD8", "#E07A7A", "#D4A85C", "#5BA8C6", "#8B95A8",
];

const SIGNAL_LABEL_KO: Record<ETFSignal, string> = {
  STRONG_BUY: "적극매수", BUY: "매수", HOLD: "관망", SELL: "매도", STRONG_SELL: "적극매도",
};
const SIGNAL_LABEL_EN: Record<ETFSignal, string> = {
  STRONG_BUY: "STRONG BUY", BUY: "BUY", HOLD: "HOLD", SELL: "SELL", STRONG_SELL: "STRONG SELL",
};

function fmtPrice(item: ETFSignalItem, usdKrw?: number): { main: string; sub: string | null } {
  if (item.currency === "KRW") {
    const krw = Math.round(item.current_price);
    const usd = usdKrw ? item.current_price / usdKrw : null;
    return { main: `₩${krw.toLocaleString("ko-KR")}`, sub: usd != null ? `$${usd.toFixed(2)}` : null };
  }
  const usd = item.current_price;
  const krw = usdKrw ? Math.round(usd * usdKrw) : null;
  if (krw == null) return { main: `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, sub: null };
  return { main: `₩${krw.toLocaleString("ko-KR")}`, sub: `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` };
}

function fmtAum(v: number | null | undefined): string {
  if (v == null) return "-";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

interface Props {
  etf: ETFSignalItem;
  onClose: () => void;
  onSelectStock?: (ticker: string) => void;
  usdKrw?: number;
}

export default function ETFHoldingsModal({ etf, onClose, onSelectStock, usdKrw }: Props) {
  const { lang } = useT();
  const [data, setData] = useState<ETFHoldingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [holdingsOpen, setHoldingsOpen] = useState(false);

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

  const price = fmtPrice(etf, usdKrw);
  const isUp1y = (etf.change_1y ?? 0) >= 0;
  const labels = lang === "ko" ? SIGNAL_LABEL_KO : SIGNAL_LABEL_EN;
  const rsi = Math.round(etf.rsi);
  const rsiClass = rsi >= 70 ? "dn" : rsi <= 30 ? "up" : "flat";
  const w52 = Math.round(etf.week52_pos);
  const phaseLabel = lang === "ko"
    ? { MARKUP: "상승", SIDEWAYS: "횡보", MARKDOWN: "하락" }
    : { MARKUP: "MARKUP", SIDEWAYS: "SIDEWAYS", MARKDOWN: "MARKDOWN" };
  const phaseClass = etf.trend_phase === "MARKUP" ? "up" : etf.trend_phase === "MARKDOWN" ? "dn" : "flat";
  const phaseArrow = etf.trend_phase === "MARKUP" ? "↗" : etf.trend_phase === "MARKDOWN" ? "↘" : "→";

  const PERF: { k: string; v: number | null | undefined }[] = [
    { k: "7D", v: etf.change_7d },
    { k: "1M", v: etf.change_1m },
    { k: "3M", v: etf.change_3m },
    { k: "6M", v: etf.change_6m },
    { k: "1Y", v: etf.change_1y },
  ];

  const holdings = data?.holdings ?? [];
  const hasHoldings = holdings.length > 0;

  return (
    <div className="wx-modal-scrim" onClick={onClose}>
      <div className="wx-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="wx-modal-head">
          <div className="wx-modal-head-left">
            <div className="wx-modal-ticker-row">
              <span className="wx-modal-ticker">
                {etf.ticker.replace(".KS", "").replace(".KQ", "")}
              </span>
              <span className={`wx-signal ${etf.signal}`}>{labels[etf.signal]}</span>
            </div>
            <div className="wx-modal-name">{etf.name}</div>
          </div>
          <button className="wx-modal-close" onClick={onClose} aria-label="Close">x</button>
        </div>

        {/* Price */}
        <div className="wx-modal-price">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="wx-modal-price-main">{price.main}</div>
            {price.sub && <div className="wx-modal-price-sub">{price.sub}</div>}
          </div>
          {etf.change_1y != null && (
            <div className="wx-modal-1y">
              <div className="wx-modal-1y-label">1Y</div>
              <div className={`wx-modal-1y-value ${isUp1y ? "up" : "dn"}`}>
                {isUp1y ? "+" : ""}{etf.change_1y.toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* AI Analysis */}
        {etf.reason && (
          <div className="wx-modal-reason">
            <div className="wx-modal-reason-label">
              {lang === "ko" ? "AI 분석" : "AI Analysis"}
            </div>
            {etf.reason}
          </div>
        )}

        {/* Period Returns */}
        <div className="wx-modal-perf">
          <div className="wx-modal-section-head">
            <div className="wx-modal-section-title">
              {lang === "ko" ? "구간별 수익률" : "Performance"}
            </div>
          </div>
          <div className="wx-modal-perf-row">
            {PERF.map(p => {
              if (p.v == null) {
                return (
                  <div key={p.k} className="wx-modal-perf-cell">
                    <span className="k">{p.k}</span>
                    <span className="v flat">—</span>
                  </div>
                );
              }
              const up = p.v >= 0;
              return (
                <div key={p.k} className="wx-modal-perf-cell">
                  <span className="k">{p.k}</span>
                  <span className={`v ${up ? "up" : "dn"}`}>
                    {up ? "+" : ""}{p.v.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Technicals */}
        <div className="wx-modal-tech">
          <div className="wx-modal-section-head">
            <div className="wx-modal-section-title">
              {lang === "ko" ? "기술 지표" : "Technicals"}
            </div>
          </div>
          <div className="wx-modal-tech-grid">
            {/* RSI gauge */}
            <div className="wx-tech-block">
              <div className="wx-tech-head">
                <span className="wx-tech-label">RSI · 14</span>
                <span className={`wx-tech-value ${rsiClass}`}>{rsi}</span>
              </div>
              <div className="wx-bar-zones">
                <div className="wx-bar-marker" style={{ left: `${rsi}%` }} />
              </div>
              <div className="wx-tech-foot">
                <span>{lang === "ko" ? "과매도 30" : "Oversold 30"}</span>
                <span>{lang === "ko" ? "과매수 70" : "Overbought 70"}</span>
              </div>
            </div>

            {/* 52w position */}
            <div className="wx-tech-block">
              <div className="wx-tech-head">
                <span className="wx-tech-label">{lang === "ko" ? "52주 위치" : "52w position"}</span>
                <span className="wx-tech-value">{w52}%</span>
              </div>
              <div className="wx-bar">
                <div
                  className={`wx-bar-fill ${w52 >= 60 ? "up" : w52 <= 30 ? "dn" : ""}`}
                  style={{ width: `${w52}%` }}
                />
              </div>
              <div className="wx-tech-foot">
                <span>{lang === "ko" ? "저점" : "Low"}</span>
                <span>{lang === "ko" ? "고점" : "High"}</span>
              </div>
            </div>

            {/* MA200 */}
            <div className="wx-tech-block">
              <div className="wx-tech-head">
                <span className="wx-tech-label">MA200</span>
                <span className={`wx-tech-value ${etf.above_ma200 ? "up" : "dn"}`}>
                  {etf.above_ma200
                    ? (lang === "ko" ? "↑ 상회" : "↑ Above")
                    : (lang === "ko" ? "↓ 하회" : "↓ Below")}
                </span>
              </div>
              <div className="wx-tech-foot" style={{ marginTop: 8 }}>
                <span>
                  {lang === "ko"
                    ? (etf.above_ma200 ? "장기 추세 상승" : "장기 추세 하락")
                    : (etf.above_ma200 ? "Long-term uptrend" : "Long-term downtrend")}
                </span>
              </div>
            </div>

            {/* Trend phase */}
            <div className="wx-tech-block">
              <div className="wx-tech-head">
                <span className="wx-tech-label">{lang === "ko" ? "추세 단계" : "Trend phase"}</span>
                <span className={`wx-tech-value ${phaseClass}`}>
                  {phaseArrow} {phaseLabel[etf.trend_phase || "SIDEWAYS"]}
                </span>
              </div>
              <div className="wx-tech-foot" style={{ marginTop: 8 }}>
                <span>{lang === "ko" ? "Wyckoff 사이클 기반" : "Wyckoff cycle classification"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Holdings */}
        {loading ? (
          <div style={{ padding: "40px 28px", textAlign: "center", color: "var(--fg-subtle)", fontSize: 13 }}>
            {lang === "ko" ? "편입 종목 로딩 중..." : "Loading holdings..."}
          </div>
        ) : hasHoldings ? (
          <div className="wx-modal-holdings">
            <div className="wx-modal-section-head">
              <div className="wx-modal-section-title">
                {lang === "ko" ? `편입 종목 Top ${holdings.length}` : `Top ${holdings.length} Holdings`}
              </div>
              <div className="wx-modal-section-meta">
                {etf.total_assets != null ? `AUM ${fmtAum(etf.total_assets)} · ` : ""}
                {holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)}% {lang === "ko" ? "합산" : "sum"}
              </div>
            </div>
            <HoldingsDonut
              holdings={holdings}
              lang={lang}
              onSelectStock={onSelectStock}
              etfTicker={etf.ticker}
            />
          </div>
        ) : (
          <div style={{
            padding: "28px", textAlign: "center",
            color: "var(--fg-subtle)", fontSize: 12,
          }}>
            {lang === "ko" ? "편입 종목 데이터 없음" : "No holdings data available"}
          </div>
        )}

        {/* Footer */}
        <div className="wx-modal-foot">
          <span className="wx-modal-foot-meta">
            {data?.source ? `${lang === "ko" ? "출처" : "Source"}: ${data.source}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function HoldingsDonut({ holdings, lang, onSelectStock, etfTicker }: {
  holdings: ETFHoldingItem[];
  lang: string;
  onSelectStock?: (ticker: string) => void;
  etfTicker: string;
}) {
  const [open, setOpen] = useState(false);

  const R = 38;
  const C = 2 * Math.PI * R;
  let offset = 0;

  const total = holdings.reduce((s, h) => s + h.weight, 0);
  const othersPct = Math.max(0, 100 - total);

  const segments = holdings.map((h, i) => {
    const len = (h.weight / 100) * C;
    const seg = { ...h, color: DONUT_COLORS[i % DONUT_COLORS.length], len, offset };
    offset += len;
    return seg;
  });

  const othersLen = (othersPct / 100) * C;
  const othersOffset = offset;
  const othersColor = "#2E3540";

  return (
    <div>
      <div className="wx-holdings-body">
        <div className="wx-donut-wrap">
          <svg viewBox="0 0 100 100">
            {segments.map(s => (
              <circle
                key={s.ticker}
                className="wx-donut-seg"
                cx="50" cy="50" r={R}
                stroke={s.color}
                strokeDasharray={`${s.len.toFixed(2)} ${C.toFixed(2)}`}
                strokeDashoffset={-s.offset}
              />
            ))}
            {othersPct > 0 && (
              <circle
                className="wx-donut-seg"
                cx="50" cy="50" r={R}
                stroke={othersColor}
                strokeDasharray={`${othersLen.toFixed(2)} ${C.toFixed(2)}`}
                strokeDashoffset={-othersOffset}
              />
            )}
          </svg>
          <div className="wx-donut-center">
            <div className="label">Top {holdings.length}</div>
            <div className="value">{total.toFixed(1)}%</div>
            <div className="sub">
              {lang === "ko" ? "편입 비중" : "of portfolio"}
            </div>
          </div>
        </div>

        <div className="wx-holding-legend">
          {segments.map(s => (
            <button
              key={s.ticker}
              className="wx-legend-row"
              style={{ background: "transparent", border: "none", cursor: s.ticker ? "pointer" : "default", textAlign: "left", width: "100%" }}
              onClick={() => s.ticker && onSelectStock?.(s.ticker)}
            >
              <span className="wx-legend-dot" style={{ background: s.color }} />
              <span className="wx-legend-ticker">{s.ticker}</span>
              <span className="wx-legend-name">{s.name}</span>
              <span className="wx-legend-pct">{s.weight.toFixed(1)}%</span>
            </button>
          ))}
          {othersPct > 0 && (
            <div className="wx-legend-row" style={{ color: "var(--fg-subtle)" }}>
              <span className="wx-legend-dot" style={{ background: othersColor }} />
              <span className="wx-legend-ticker" style={{ color: "var(--fg-muted)", fontWeight: 500 }}>
                {lang === "ko" ? "기타" : "Others"}
              </span>
              <span className="wx-legend-name">{lang === "ko" ? "나머지 종목" : "remaining"}</span>
              <span className="wx-legend-pct" style={{ color: "var(--fg-muted)" }}>
                {othersPct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="wx-holdings-more">
          <button
            className="wx-holdings-more-toggle"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span>{lang === "ko" ? "전체 종목 보기" : "See all holdings"}</span>
            <span className="arrow" style={{
              display: "inline-block",
              transition: "transform 0.2s var(--ease-out)",
              transform: open ? "rotate(180deg)" : "none",
            }}>⌄</span>
          </button>
          <div className="wx-holdings-full" data-open={open}>
            <div className="inner">
              <div className="scrollable" style={{ maxHeight: 260, overflow: "auto" }}>
                {holdings.map((h, idx) => {
                  const chg = h.change_1d_pct;
                  const isUp = (chg ?? 0) >= 0;
                  return (
                    <div key={h.ticker} className="wx-full-row">
                      <span className="wx-full-rank">{idx + 1}</span>
                      <span className="wx-full-ticker">{h.ticker}</span>
                      <span className="wx-full-name">{h.name}</span>
                      <span className="wx-full-pct" style={{ color: chg != null ? (isUp ? "var(--up)" : "var(--down)") : undefined }}>
                        {chg != null ? `${isUp ? "+" : ""}${chg.toFixed(1)}%` : `${h.weight.toFixed(2)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <a
                className="wx-holdings-ext"
                href={`https://www.etf.com/${etfTicker}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {lang === "ko"
                  ? `etf.com에서 ${etfTicker} 전체 편입종목 보기 →`
                  : `View all ${etfTicker} holdings on etf.com →`}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
