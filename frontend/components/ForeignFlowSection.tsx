"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type MarketKey = "kospi" | "kosdaq";

interface TopItem {
  ticker: string;
  name: string;
  net_buy_volume: number;
  net_buy_value_mil: number;
  today_volume?: number;
}

interface MarketDay {
  date?: string;
  bizdate?: string;
  personal: number;
  foreign: number;
  institutional: number;
}

interface ForeignFlowData {
  top_buyers:  Record<MarketKey, TopItem[]>;
  top_sellers: Record<MarketKey, TopItem[]>;
  market_today: Record<MarketKey, MarketDay>;
  market_history: Record<MarketKey, MarketDay[]>;
  top_history: Record<MarketKey, Record<string, { buyers: TopItem[]; sellers: TopItem[] }>>;
  available_dates: string[];
  current_date: string | null;
  updated_at: string | null;
}

function fmtMil(mil: number | undefined): string {
  if (mil == null) return "-";
  const v = Math.abs(mil);
  const sign = mil >= 0 ? "+" : "-";
  if (v >= 10_000) return `${sign}${(v / 10_000).toFixed(2)}조`;
  if (v >= 100)    return `${sign}${(v / 100).toFixed(0)}억`;
  return `${sign}${v.toLocaleString()}백만`;
}

function colorOf(v: number | undefined): string {
  if (v == null || v === 0) return "var(--fg-subtle)";
  return v > 0 ? "var(--up)" : "var(--down)";
}

function fmtDateKo(iso: string): string {
  const d = new Date(iso + "T00:00:00+09:00");
  if (isNaN(d.getTime())) return iso;
  const wk = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${wk})`;
}

function Row({ item, side, rank }: { item: TopItem; side: "buy" | "sell"; rank: number }) {
  const isBuy = side === "buy";
  const color = isBuy ? "var(--up)" : "var(--down)";
  const display = isBuy ? item.net_buy_value_mil : -Math.abs(item.net_buy_value_mil);
  return (
    <div className="ff-row">
      <span className="ff-rank">{rank}</span>
      <div className="ff-name">{item.name}</div>
      <div className="ff-val" style={{ color }}>{fmtMil(display)}</div>
      <style jsx>{`
        .ff-row {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 4px;
          border-bottom: 1px solid var(--divider);
        }
        .ff-row:last-child { border-bottom: none; }
        .ff-rank {
          font-family: var(--font-mono); font-size: 10px; font-weight: 500;
          color: var(--fg-subtle); width: 16px; text-align: right; flex-shrink: 0;
        }
        .ff-name {
          flex: 1; min-width: 0;
          font-size: 12px; font-weight: 600; color: var(--fg);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ff-val {
          font-family: var(--font-mono); font-size: 12px; font-weight: 700;
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="ff-stat">
      <div className="ff-stat-k">{label}</div>
      <div className="ff-stat-v" style={{ color: colorOf(value) }}>{fmtMil(value)}</div>
      <style jsx>{`
        .ff-stat {
          display: flex; flex-direction: column; gap: 2px;
        }
        .ff-stat-k {
          font-family: var(--font-mono); font-size: 10px; font-weight: 500;
          color: var(--fg-subtle); letter-spacing: 0.08em; text-transform: uppercase;
        }
        .ff-stat-v {
          font-family: var(--font-mono); font-size: 15px; font-weight: 700;
          font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
        }
      `}</style>
    </div>
  );
}

export default function ForeignFlowSection() {
  const [data, setData]       = useState<ForeignFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket]   = useState<MarketKey>("kospi");
  const [date, setDate]       = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/foreign-flow`)
      .then(r => r.json())
      .then((d: ForeignFlowData) => {
        if (!alive) return;
        setData(d);
        setDate(d.current_date || (d.available_dates?.[0] ?? null));
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const { buyers, sellers } = useMemo(() => {
    if (!data || !date) return { buyers: [] as TopItem[], sellers: [] as TopItem[] };
    const hist = data.top_history?.[market]?.[date];
    if (hist) return { buyers: hist.buyers || [], sellers: hist.sellers || [] };
    if (date === data.current_date) {
      return { buyers: data.top_buyers?.[market] || [], sellers: data.top_sellers?.[market] || [] };
    }
    return { buyers: [], sellers: [] };
  }, [data, market, date]);

  const todayMarket = useMemo(() => {
    if (!data || !date) return null;
    const histRow = (data.market_history?.[market] || []).find(r => r.date === date);
    if (histRow) return histRow;
    if (date === data.current_date) {
      const t = data.market_today?.[market];
      if (t) return { date: t.bizdate, personal: t.personal, foreign: t.foreign, institutional: t.institutional };
    }
    return null;
  }, [data, market, date]);

  if (loading) {
    return (
      <div className="ff-loading">
        외국인 매매 데이터를 불러오는 중...
        <style jsx>{`
          .ff-loading { padding: 24px; color: var(--fg-subtle); font-size: 13px; }
        `}</style>
      </div>
    );
  }
  if (!data) return null;

  const dates = data.available_dates || (data.current_date ? [data.current_date] : []);
  const marketHistLen = (data.market_history?.[market] || []).length;
  const currentIdx = dates.indexOf(date || "");
  const canPrev = currentIdx >= 0 && currentIdx < dates.length - 1;
  const canNext = currentIdx > 0;

  return (
    <div className="ff-wrap">

      {/* ── HEADER ── */}
      <div className="ff-header">
        <div className="ff-title">외국인 매매 동향</div>
        <div className="ff-subtitle">네이버 금융 데이터 · 매일 KST 16:30 / 17:30 자동 누적</div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="ff-controls">
        <div className="ff-pills">
          <button className="wx-range-pill" aria-pressed={market === "kospi"} onClick={() => setMarket("kospi")}>KOSPI</button>
          <button className="wx-range-pill" aria-pressed={market === "kosdaq"} onClick={() => setMarket("kosdaq")}>KOSDAQ</button>
        </div>
        <div className="ff-date-nav">
          <button className="ff-nav-btn" disabled={!canPrev} onClick={() => { if (canPrev) setDate(dates[currentIdx + 1]); }}>◀</button>
          <select className="ff-date-select" value={date || ""} onChange={e => setDate(e.target.value)}>
            {dates.length === 0 && <option value="">데이터 없음</option>}
            {dates.map(d => <option key={d} value={d}>{fmtDateKo(d)}</option>)}
          </select>
          <button className="ff-nav-btn" disabled={!canNext} onClick={() => { if (canNext) setDate(dates[currentIdx - 1]); }}>▶</button>
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {!todayMarket && !buyers.length && !sellers.length && (
        <div className="ff-empty">선택한 날짜의 데이터가 누적되지 않았습니다.</div>
      )}

      {/* ── MARKET SUMMARY ── */}
      {todayMarket && (
        <div className="ff-summary">
          <div className="ff-summary-label">
            시장 전체 순매수 · <strong>{fmtDateKo(date || "")}</strong>
          </div>
          <div className="ff-summary-grid">
            <StatCell label="외국인" value={todayMarket.foreign} />
            <StatCell label="기관"   value={todayMarket.institutional} />
            <StatCell label="개인"   value={todayMarket.personal} />
          </div>
          {marketHistLen >= 2 && (
            <div className="ff-hist-note">시계열 누적: 최근 {marketHistLen}일분</div>
          )}
        </div>
      )}

      {/* ── TOP STOCKS ── */}
      {(buyers.length > 0 || sellers.length > 0) && (
        <div className="ff-top-grid">
          {buyers.length > 0 && (
            <div className="ff-top-col">
              <div className="ff-col-head up">
                <span className="ff-dot up" />
                순매수 TOP {buyers.length}
              </div>
              <div className="ff-col-body">
                {buyers.slice(0, 10).map((it, i) => (
                  <Row key={`b${i}-${it.ticker || it.name}`} item={it} side="buy" rank={i + 1} />
                ))}
              </div>
            </div>
          )}
          {sellers.length > 0 && (
            <div className="ff-top-col">
              <div className="ff-col-head dn">
                <span className="ff-dot dn" />
                순매도 TOP {sellers.length}
              </div>
              <div className="ff-col-body">
                {sellers.slice(0, 10).map((it, i) => (
                  <Row key={`s${i}-${it.ticker || it.name}`} item={it} side="sell" rank={i + 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .ff-wrap { margin-bottom: 32px; }

        .ff-header { margin-bottom: 16px; }
        .ff-title {
          font-family: var(--font-sans);
          font-size: 16px; font-weight: 700; color: var(--fg);
          letter-spacing: -0.02em;
        }
        .ff-subtitle {
          font-family: var(--font-mono);
          font-size: 11px; color: var(--fg-subtle); margin-top: 4px;
          letter-spacing: 0.02em;
        }

        .ff-controls {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 10px;
          margin-bottom: 16px;
          padding: 10px 14px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md, 10px);
        }
        .ff-pills { display: inline-flex; gap: 0; }
        .ff-date-nav { display: flex; align-items: center; gap: 4px; }
        .ff-nav-btn {
          background: transparent; border: 1px solid var(--border);
          border-radius: var(--r-xs, 4px);
          padding: 4px 8px; font-size: 11px; color: var(--fg-muted);
          cursor: pointer; transition: opacity 0.15s;
        }
        .ff-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .ff-date-select {
          background: var(--surface); color: var(--fg);
          border: 1px solid var(--border); border-radius: var(--r-xs, 4px);
          padding: 5px 8px; font-size: 12px; font-weight: 600;
          font-family: var(--font-mono); cursor: pointer;
        }

        .ff-empty {
          padding: 20px; text-align: center;
          border: 1px dashed var(--border); border-radius: var(--r-md, 10px);
          color: var(--fg-subtle); font-size: 13px;
        }

        .ff-summary {
          margin-bottom: 20px;
          padding: 14px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md, 10px);
        }
        .ff-summary-label {
          font-family: var(--font-mono);
          font-size: 10px; color: var(--fg-subtle);
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-bottom: 10px;
        }
        .ff-summary-label strong { color: var(--fg-muted); }
        .ff-summary-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
        }
        .ff-hist-note {
          font-family: var(--font-mono);
          font-size: 10px; color: var(--fg-subtle); margin-top: 8px;
        }

        .ff-top-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        }
        .ff-top-col {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md, 10px);
          overflow: hidden;
        }
        .ff-col-head {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 14px;
          font-family: var(--font-mono);
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          border-bottom: 1px solid var(--border);
        }
        .ff-col-head.up { color: var(--up); }
        .ff-col-head.dn { color: var(--down); }
        .ff-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
        .ff-dot.up { background: var(--up); }
        .ff-dot.dn { background: var(--down); }
        .ff-col-body { padding: 4px 10px; }

        @media (max-width: 720px) {
          .ff-top-grid { grid-template-columns: 1fr; }
          .ff-controls { flex-direction: column; align-items: stretch; }
          .ff-date-nav { justify-content: center; }
          .ff-summary-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
        }
      `}</style>
    </div>
  );
}
