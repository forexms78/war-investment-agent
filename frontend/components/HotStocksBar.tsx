"use client";
import { HotStock } from "@/types";

interface Props {
  stocks: HotStock[];
  onSelect: (ticker: string) => void;
  usd_krw?: number | null;
}

export default function HotStocksBar({ stocks, onSelect, usd_krw }: Props) {
  const toKrw = (usd: number) => {
    const v = usd * (usd_krw ?? 0);
    if (v >= 1e6) return `${(v / 1e4).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}만원`;
    return `${Math.round(v).toLocaleString("ko-KR")}원`;
  };

  if (!stocks.length) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>고래들이 주목하는 종목</span>
        <span style={{
          fontSize: 11, color: "var(--accent)", background: "var(--accent-dim)",
          border: "1px solid var(--accent-glow)", borderRadius: 20, padding: "2px 10px",
          fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
        }}>TOP {stocks.length}</span>
      </div>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 12, overflow: "hidden",
      }}>
        {stocks.map((s, idx) => {
          const isUp = (s.change_30d_pct ?? 0) >= 0;
          const changeColor = isUp ? "var(--green)" : "var(--red)";
          return (
            <button
              key={s.ticker}
              onClick={() => onSelect(s.ticker)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: idx < stocks.length - 1 ? "1px solid var(--border)" : "none",
                background: "transparent", border: "none", cursor: "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {/* 왼쪽: 순위 + 종목명 + 티커 */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "var(--accent)", flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                    {s.name || s.ticker}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {s.ticker}
                    {s.sector && <span style={{ marginLeft: 6 }}>{s.sector}</span>}
                  </div>
                </div>
              </div>
              {/* 오른쪽: 가격 + 변동률 */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {s.current_price != null && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                      ${s.current_price.toLocaleString()}
                    </div>
                    {usd_krw ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {toKrw(s.current_price)}
                      </div>
                    ) : null}
                  </>
                )}
                {s.change_30d_pct != null && (
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: changeColor,
                    background: `${changeColor}12`, borderRadius: 4,
                    padding: "1px 6px", display: "inline-block", marginTop: 2,
                  }}>
                    {isUp ? "+" : ""}{s.change_30d_pct.toFixed(1)}%
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
