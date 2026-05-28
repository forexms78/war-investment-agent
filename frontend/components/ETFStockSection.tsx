"use client";

import { useEffect, useState, useMemo } from "react";
import { ETFSignalsData, ETFSignalItem, ETFSignal, TrendPhase } from "@/types";
import SkeletonCard from "@/components/SkeletonCard";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;

type Group = "us_etf" | "kr_etf" | "us_stocks" | "kr_stocks";

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
    return {
      main: `₩${krw.toLocaleString("ko-KR")}`,
      sub: usd != null ? `$${usd.toFixed(2)}` : null,
    };
  }
  const usd = item.current_price;
  const krw = usdKrw ? Math.round(usd * usdKrw) : null;
  if (krw == null) {
    return { main: `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, sub: null };
  }
  return {
    main: `₩${krw.toLocaleString("ko-KR")}`,
    sub: `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  };
}

interface MarketDriver {
  headline: string;
  impact: string;
  direction: string;
  url?: string;
  source?: string;
}

interface Props {
  onSelect: (ticker: string) => void;
  onSelectEtf?: (item: ETFSignalItem) => void;
  usdKrw?: number;
  data?: ETFSignalsData | null;
  fedRate?: number;
  krwUsd?: number;
  krwUsdChange?: number | null;
  marketDrivers?: MarketDriver[];
}

export default function ETFStockSection({
  onSelect, onSelectEtf, usdKrw, data: dataProp,
  fedRate, krwUsd, krwUsdChange, marketDrivers,
}: Props) {
  const { t, lang } = useT();
  const [data, setData] = useState<ETFSignalsData | null>(dataProp ?? null);
  const [loading, setLoading] = useState(!dataProp);
  const [activeGroup, setActiveGroup] = useState<Group>("us_etf");

  useEffect(() => {
    if (dataProp) { setData(dataProp); setLoading(false); return; }
    if (data) return;
    fetch(`${API}/etf-signals`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dataProp]);

  const items: ETFSignalItem[] = useMemo(() => {
    if (!data) return [];
    if (activeGroup === "us_etf") {
      const usEtfs = data.etfs.filter(e => !e.ticker.endsWith(".KS") && !e.ticker.endsWith(".KQ"));
      return [...usEtfs].sort((a, b) => (b.total_assets ?? 0) - (a.total_assets ?? 0));
    }
    if (activeGroup === "kr_etf") {
      const krEtfs = data.etfs.filter(e => e.ticker.endsWith(".KS") || e.ticker.endsWith(".KQ"));
      return [...krEtfs].sort((a, b) => (b.total_assets ?? 0) - (a.total_assets ?? 0));
    }
    return data[activeGroup] || [];
  }, [data, activeGroup]);

  const isEtfGroup = activeGroup === "us_etf" || activeGroup === "kr_etf";

  const heroReturn = useMemo(() => {
    if (!data) return 0;
    const allEtfs = data.etfs;
    if (allEtfs.length === 0) return 0;
    const returns = allEtfs.map(e => e.change_1y).filter((v): v is number => v != null);
    if (returns.length === 0) return 0;
    return returns.reduce((s, v) => s + v, 0) / returns.length;
  }, [data]);

  const counts = useMemo(() => {
    if (!data) return { us_etf: 0, kr_etf: 0, us_stocks: 0, kr_stocks: 0 };
    return {
      us_etf: data.etfs.filter(e => !e.ticker.endsWith(".KS") && !e.ticker.endsWith(".KQ")).length,
      kr_etf: data.etfs.filter(e => e.ticker.endsWith(".KS") || e.ticker.endsWith(".KQ")).length,
      us_stocks: (data.us_stocks || []).length,
      kr_stocks: (data.kr_stocks || []).length,
    };
  }, [data]);

  const GROUP_LABELS: Record<Group, { ko: string; en: string }> = {
    us_etf:    { ko: "미장 ETF",  en: "US ETFs" },
    kr_etf:    { ko: "국장 ETF",  en: "KR ETFs" },
    us_stocks: { ko: "미장 주식", en: "US Stocks" },
    kr_stocks: { ko: "국장 주식", en: "KR Stocks" },
  };

  const groupTitle = lang === "ko" ? GROUP_LABELS[activeGroup].ko : GROUP_LABELS[activeGroup].en;
  const updatedStr = data?.updated_at
    ? new Date(data.updated_at).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : "";

  return (
    <div className="wx-main fade-in">
      {/* Sidebar */}
      <aside className="wx-sidebar">
        <div className="wx-sidebar-block">
          <div className="wx-sidebar-title">
            <span>{lang === "ko" ? "오늘의 마켓" : "Today"}</span>
          </div>
          <div>
            <div className="wx-mini-kpi">
              <div className="k">{lang === "ko" ? "ETF 1년 평균" : "ETF 1Y avg"}</div>
              <div className={`v ${heroReturn >= 0 ? "up" : "dn"}`}>
                {heroReturn >= 0 ? "+" : ""}{heroReturn.toFixed(1)}%
              </div>
              <div className="sub">
                {data ? `${data.etfs.length}${lang === "ko" ? "종 추적" : " ETFs tracked"}` : ""}
              </div>
            </div>
            {fedRate != null && (
              <div className="wx-mini-kpi">
                <div className="k">Fed Rate</div>
                <div className="v">{fedRate}%</div>
                <div className="sub">target 3.50-3.75</div>
              </div>
            )}
            {krwUsd != null && (
              <div className="wx-mini-kpi">
                <div className="k">KRW / USD</div>
                <div className="v">{krwUsd.toLocaleString("ko-KR")}</div>
                {krwUsdChange != null && (
                  <div className="sub" style={{ color: krwUsdChange >= 0 ? "var(--down)" : "var(--up)" }}>
                    {krwUsdChange >= 0 ? "+" : ""}{krwUsdChange.toFixed(2)}%
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="wx-sidebar-block">
          <div className="wx-sidebar-title">
            <span>{lang === "ko" ? "카테고리" : "Category"}</span>
          </div>
          <div className="wx-sidebar-nav">
            {(["us_etf", "kr_etf", "us_stocks", "kr_stocks"] as Group[]).map(gid => (
              <button
                key={gid}
                aria-pressed={activeGroup === gid}
                onClick={() => setActiveGroup(gid)}
              >
                <span>{lang === "ko" ? GROUP_LABELS[gid].ko : GROUP_LABELS[gid].en}</span>
                <span className="count">{counts[gid]}</span>
              </button>
            ))}
          </div>
        </div>

        {marketDrivers && marketDrivers.length > 0 && (
          <div className="wx-sidebar-block">
            <div className="wx-sidebar-title">
              <span>{lang === "ko" ? "오늘의 뉴스" : "Market drivers"}</span>
              <button className="wx-sidebar-action">{lang === "ko" ? "전체 →" : "All →"}</button>
            </div>
            <div className="wx-side-news">
              {marketDrivers.slice(0, 3).map((d, i) => (
                <a key={i} href={d.url || "#"} target="_blank" rel="noopener noreferrer">
                  <div className="row">
                    <span className={`wx-tag ${d.direction}`}>
                      {lang === "ko"
                        ? d.direction === "bullish" ? "강세" : d.direction === "bearish" ? "약세" : "혼조"
                        : d.direction.toUpperCase()}
                    </span>
                    <span className="src">{d.source}</span>
                  </div>
                  <div className="hl">{d.headline}</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="wx-content">
        <div className="wx-section-head">
          <div className="ttl">
            <span className="name">{groupTitle}</span>
            <span className="meta">
              {items.length} · Updated {updatedStr}
            </span>
          </div>
          <div className="wx-groups" role="tablist">
            {(["us_etf", "kr_etf", "us_stocks", "kr_stocks"] as Group[]).map(gid => (
              <button
                key={gid}
                className="wx-group-btn"
                aria-pressed={activeGroup === gid}
                onClick={() => setActiveGroup(gid)}
              >
                <span className="top">
                  {lang === "ko" ? GROUP_LABELS[gid].ko : GROUP_LABELS[gid].en}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading || !data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height={56} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            color: "var(--fg-subtle)", fontSize: 13,
            borderTop: "1px solid var(--border)",
          }}>
            {t("etf.empty")}
          </div>
        ) : (
          <div className="wx-card-grid">
            <div className="wx-list-header">
              <span></span>
              <span>{lang === "ko" ? "종목" : "Asset"}</span>
              <span>{lang === "ko" ? "시그널" : "Signal"}</span>
              <span>{lang === "ko" ? "가격" : "Price"}</span>
              <span>1Y</span>
              <span>30D</span>
              <span className="wx-header-tip" data-tip={lang === "ko" ? "상대강도지수(0~100). 70 이상이면 과매수(비쌈), 30 이하면 과매도(쌈). 매수/매도 타이밍 참고 지표" : "Relative Strength Index (0-100). Above 70 = overbought, below 30 = oversold"}>RSI</span>
              <span className="wx-header-tip" data-tip={lang === "ko" ? "52주(1년) 최저가 대비 현재 위치. 0%=1년 최저, 100%=1년 최고. 저점 매수 기회 판단에 활용" : "Current price position within 52-week range. 0%=yearly low, 100%=yearly high"}>52W</span>
              <span className="wx-header-tip" data-tip={lang === "ko" ? "200일 이동평균선 대비 위치. 위(상회)면 장기 상승 추세, 아래(하회)면 장기 하락 추세. 추세 방향 판단의 기본 지표" : "Position vs 200-day moving average. Above = long-term uptrend, Below = downtrend"}>MA200</span>
              <span></span>
            </div>
            {items.map((item, idx) => (
              <ETFRow
                key={item.ticker}
                item={item}
                rank={isEtfGroup ? idx + 1 : undefined}
                isEtf={isEtfGroup}
                onSelect={isEtfGroup && onSelectEtf ? () => onSelectEtf(item) : () => onSelect(item.ticker)}
                usdKrw={usdKrw}
                lang={lang}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ETFRow({ item, rank, isEtf, onSelect, usdKrw, lang }: {
  item: ETFSignalItem;
  rank?: number;
  isEtf?: boolean;
  onSelect: () => void;
  usdKrw?: number;
  lang: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const price = fmtPrice(item, usdKrw);
  const isUp1y = (item.change_1y ?? 0) >= 0;
  const isUp30d = (item.change_1m ?? 0) >= 0;
  const labels = lang === "ko" ? SIGNAL_LABEL_KO : SIGNAL_LABEL_EN;
  const phaseLabel = lang === "ko"
    ? { MARKUP: "상승", SIDEWAYS: "횡보", MARKDOWN: "하락" }
    : { MARKUP: "MARKUP", SIDEWAYS: "SIDEWAYS", MARKDOWN: "MARKDOWN" };
  const phaseArrow = item.trend_phase === "MARKUP" ? "↗" : item.trend_phase === "MARKDOWN" ? "↘" : "→";
  const phaseClass = item.trend_phase === "MARKUP" ? "up" : item.trend_phase === "MARKDOWN" ? "dn" : "flat";

  return (
    <div className="wx-etf-row" onClick={onSelect}>
      <span className={`wx-card-rank ${rank != null && rank > 3 ? "muted" : ""}`}>
        {rank != null ? String(rank).padStart(2, "0") : ""}
      </span>
      <div className="wx-card-ticker-col">
        <div className="wx-card-ticker">{item.ticker.replace(".KS", "").replace(".KQ", "")}</div>
        <div className="wx-card-name">{item.name}</div>
      </div>
      <span className={`wx-signal ${item.signal}`}>{labels[item.signal]}</span>
      <div className="wx-card-price" style={{ textAlign: "right" }}>{price.main}</div>
      <span className={`wx-cell-num ${isUp1y ? "up" : "dn"}`}>
        {isUp1y ? "+" : ""}{(item.change_1y ?? 0).toFixed(1)}%
      </span>
      <span className={`wx-cell-num ${isUp30d ? "up" : "dn"}`}>
        {item.change_1m != null ? `${isUp30d ? "+" : ""}${item.change_1m.toFixed(1)}%` : "—"}
      </span>
      <span className="wx-cell-num">{Math.round(item.rsi)}</span>
      <span className="wx-cell-num">{Math.round(item.week52_pos)}%</span>
      <span className={`wx-cell-num ${item.above_ma200 ? "up" : "dn"}`}>
        {item.above_ma200 ? "↑" : "↓"}
      </span>
      <button
        className="wx-row-toggle"
        aria-expanded={expanded}
        onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
      >
        <span className="arrow">⌄</span>
      </button>

      <div className="wx-row-details" data-open={expanded} onClick={e => e.stopPropagation()}>
        <div className="inner">
          <div className="padding">
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="wx-meta-row">
                  <span className="k">{lang === "ko" ? "추세" : "Trend"}</span>
                  <span className={`v ${phaseClass}`}>
                    {phaseArrow} {phaseLabel[item.trend_phase || "SIDEWAYS"]}
                  </span>
                </div>
                {item.change_7d != null && (
                  <div className="wx-meta-row">
                    <span className="k">7D</span>
                    <span className={`v ${item.change_7d >= 0 ? "up" : "dn"}`}>
                      {item.change_7d >= 0 ? "+" : ""}{item.change_7d.toFixed(1)}%
                    </span>
                  </div>
                )}
                {item.change_6m != null && (
                  <div className="wx-meta-row">
                    <span className="k">6M</span>
                    <span className={`v ${item.change_6m >= 0 ? "up" : "dn"}`}>
                      {item.change_6m >= 0 ? "+" : ""}{item.change_6m.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            {item.reason && (
              <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.55 }}>
                {item.reason}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
