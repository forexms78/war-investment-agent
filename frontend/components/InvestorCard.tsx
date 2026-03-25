"use client";
import { InvestorSummary } from "@/types";

interface Props {
  investor: InvestorSummary;
  onClick: () => void;
}

export default function InvestorCard({ investor, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "20px 22px", cursor: "pointer",
        transition: "all 0.18s",
        borderTop: `2px solid ${investor.color}`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "var(--card-hover)";
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = `0 8px 32px rgba(0,0,0,0.3)`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "var(--card)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `${investor.color}22`,
            border: `1.5px solid ${investor.color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: investor.color, flexShrink: 0,
          }}>
            {investor.avatar_initial}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{investor.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{investor.firm}</div>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "3px 8px",
          background: `${investor.color}18`, color: investor.color,
          borderRadius: 6, letterSpacing: "0.03em", whiteSpace: "nowrap",
        }}>
          {investor.style}
        </span>
      </div>

      {/* 설명 */}
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
        {investor.description}
      </p>

      {/* 주요 종목 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {investor.holdings_data.map(h => {
          const isUp = (h.change_30d_pct ?? 0) >= 0;
          return (
            <div key={h.ticker} style={{
              background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
              borderRadius: 7, padding: "4px 10px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{h.ticker}</span>
              {h.change_30d_pct !== null && h.change_30d_pct !== undefined && (
                <span style={{ fontSize: 11, color: isUp ? "var(--green)" : "var(--red)", fontWeight: 500 }}>
                  {isUp ? "+" : ""}{h.change_30d_pct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 최근 동향 */}
      <div style={{
        fontSize: 12, color: "var(--text-secondary)",
        borderTop: "1px solid var(--border)", paddingTop: 12,
        lineHeight: 1.55,
      }}>
        <span style={{ color: "var(--gold)", fontWeight: 600, fontSize: 11, marginRight: 4 }}>LATEST</span>
        {investor.recent_moves}
      </div>
    </div>
  );
}
