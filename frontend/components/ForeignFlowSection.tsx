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

function fmtDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00+09:00");
  if (isNaN(d.getTime())) return iso;
  const wk = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${wk})`;
}

function Row({ item, side, rank }: { item: TopItem; side: "buy" | "sell"; rank: number }) {
  const isBuy = side === "buy";
  const color = isBuy ? "var(--up)" : "var(--down)";
  const display = isBuy ? item.net_buy_value_mil : -Math.abs(item.net_buy_value_mil);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px",
      borderBottom: "1px solid var(--divider)",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
        color: "var(--fg-subtle)", width: 16, textAlign: "right", flexShrink: 0,
      }}>{rank}</span>
      <div style={{
        flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--fg)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{item.name}</div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color,
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
      }}>{fmtMil(display)}</div>
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
      <div style={{ padding: 24, color: "var(--fg-subtle)", fontSize: 13 }}>
        외국인 매매 데이터를 불러오는 중...
      </div>
    );
  }
  if (!data) return null;

  const dates = data.available_dates || (data.current_date ? [data.current_date] : []);
  const currentIdx = dates.indexOf(date || "");
  const canPrev = currentIdx >= 0 && currentIdx < dates.length - 1;
  const canNext = currentIdx > 0;

  const statItems = todayMarket ? [
    { label: "외국인", value: todayMarket.foreign },
    { label: "기관", value: todayMarket.institutional },
    { label: "개인", value: todayMarket.personal },
  ] : [];

  return (
    <div style={{ marginBottom: 32 }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em" }}>
          외국인 매매 동향
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-subtle)", marginTop: 4, fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>
          네이버 금융 데이터 / 매일 KST 16:30 / 17:30 자동 누적
        </div>
      </div>

      {/* 컨트롤 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10, marginBottom: 16,
        padding: "10px 14px", background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 10,
      }}>
        <div style={{ display: "inline-flex", gap: 0 }}>
          <button className="wx-range-pill" aria-pressed={market === "kospi"} onClick={() => setMarket("kospi")}>KOSPI</button>
          <button className="wx-range-pill" aria-pressed={market === "kosdaq"} onClick={() => setMarket("kosdaq")}>KOSDAQ</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            disabled={!canPrev}
            onClick={() => { if (canPrev) setDate(dates[currentIdx + 1]); }}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 4, padding: "4px 8px", fontSize: 11,
              color: "var(--fg-muted)", cursor: canPrev ? "pointer" : "not-allowed",
              opacity: canPrev ? 1 : 0.3,
            }}
          >◀</button>
          <select
            value={date || ""}
            onChange={e => setDate(e.target.value)}
            style={{
              background: "var(--surface)", color: "var(--fg)",
              border: "1px solid var(--border)", borderRadius: 4,
              padding: "5px 8px", fontSize: 12, fontWeight: 600,
              fontFamily: "var(--font-mono)", cursor: "pointer",
            }}
          >
            {dates.length === 0 && <option value="">데이터 없음</option>}
            {dates.map(d => <option key={d} value={d}>{fmtDateKo(d)}</option>)}
          </select>
          <button
            disabled={!canNext}
            onClick={() => { if (canNext) setDate(dates[currentIdx - 1]); }}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 4, padding: "4px 8px", fontSize: 11,
              color: "var(--fg-muted)", cursor: canNext ? "pointer" : "not-allowed",
              opacity: canNext ? 1 : 0.3,
            }}
          >▶</button>
        </div>
      </div>

      {/* 빈 상태 */}
      {!todayMarket && !buyers.length && !sellers.length && (
        <div style={{
          padding: 20, textAlign: "center", border: "1px dashed var(--border)",
          borderRadius: 10, color: "var(--fg-subtle)", fontSize: 13,
        }}>
          선택한 날짜의 데이터가 누적되지 않았습니다.
        </div>
      )}

      {/* 메인 레이아웃: 왼쪽 시장 요약 + 오른쪽 순매수/순매도 */}
      {(todayMarket || buyers.length > 0 || sellers.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>

          {/* 왼쪽: 시장 전체 순매수 */}
          {todayMarket && (
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: 0, alignSelf: "start",
            }}>
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border)",
                fontSize: 11, fontWeight: 600, color: "var(--fg-subtle)",
                fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                시장 전체 순매수
              </div>
              <div style={{ padding: "8px 0" }}>
                {statItems.map((s, i) => (
                  <div key={s.label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom: i < statItems.length - 1 ? "1px solid var(--divider)" : "none",
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: "var(--fg)",
                    }}>{s.label}</span>
                    <span style={{
                      fontSize: 18, fontWeight: 800, color: colorOf(s.value),
                      fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-0.01em",
                    }}>{fmtMil(s.value)}</span>
                  </div>
                ))}
              </div>
              <div style={{
                padding: "8px 16px", fontSize: 11, color: "var(--fg-subtle)",
                fontFamily: "var(--font-mono)", borderTop: "1px solid var(--border)",
              }}>
                {fmtDateShort(date || "")}
              </div>
            </div>
          )}

          {/* 오른쪽: 순매수/순매도 TOP */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {buyers.length > 0 && (
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 10, overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 14px", fontSize: 11, fontWeight: 600,
                  color: "var(--up)", letterSpacing: "0.06em", textTransform: "uppercase",
                  borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--up)", flexShrink: 0 }} />
                  순매수 TOP {buyers.length}
                </div>
                <div style={{ padding: "4px 0" }}>
                  {buyers.slice(0, 10).map((it, i) => (
                    <Row key={`b${i}-${it.ticker || it.name}`} item={it} side="buy" rank={i + 1} />
                  ))}
                </div>
              </div>
            )}
            {sellers.length > 0 && (
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 10, overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 14px", fontSize: 11, fontWeight: 600,
                  color: "var(--down)", letterSpacing: "0.06em", textTransform: "uppercase",
                  borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--down)", flexShrink: 0 }} />
                  순매도 TOP {sellers.length}
                </div>
                <div style={{ padding: "4px 0" }}>
                  {sellers.slice(0, 10).map((it, i) => (
                    <Row key={`s${i}-${it.ticker || it.name}`} item={it} side="sell" rank={i + 1} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모바일 대응 */}
      <style jsx>{`
        @media (max-width: 720px) {
          div[style*="gridTemplateColumns: 280px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
