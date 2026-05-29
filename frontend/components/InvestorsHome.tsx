"use client";
import { InvestorSummary, RecommendedStock } from "@/types";
import InvestorCard from "@/components/InvestorCard";
import SkeletonCard from "@/components/SkeletonCard";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  investors: InvestorSummary[];
  recommendations: { buy: RecommendedStock[]; sell: RecommendedStock[] } | null;
  loadingInvestors: boolean;
  onSelectInvestor: (id: string) => void;
  onSelectStock: (ticker: string) => void;
}

export default function InvestorsHome({
  investors, recommendations, loadingInvestors, onSelectInvestor, onSelectStock,
}: Props) {
  const { lang } = useT();
  const buy = recommendations?.buy ?? [];
  const sell = recommendations?.sell ?? [];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {lang === "ko" ? "대형 투자자 포트폴리오" : "Super Investor Portfolios"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {lang === "ko" ? "SEC 13F 분기 공시 기반 · 누가 무엇을 사고 파는가" : "Based on SEC 13F quarterly filings"}
        </div>
      </div>

      <div className="wx-consensus-grid">
        <ConsensusCard
          title={lang === "ko" ? "지금 사는 종목" : "Buying now"}
          side="buy" items={buy} onSelectStock={onSelectStock} lang={lang}
        />
        <ConsensusCard
          title={lang === "ko" ? "지금 파는 종목" : "Selling now"}
          side="sell" items={sell} onSelectStock={onSelectStock} lang={lang}
        />
      </div>

      <div style={{ marginTop: 30, marginBottom: 14, fontSize: 16, fontWeight: 700 }}>
        {lang === "ko" ? "개별 투자자" : "Individual investors"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {loadingInvestors
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : investors.map(inv => (
              <InvestorCard key={inv.id} investor={inv} onClick={() => onSelectInvestor(inv.id)} />
            ))}
      </div>
    </div>
  );
}

function ConsensusCard({ title, side, items, onSelectStock, lang }: {
  title: string;
  side: "buy" | "sell";
  items: RecommendedStock[];
  onSelectStock: (ticker: string) => void;
  lang: string;
}) {
  const color = side === "buy" ? "var(--up)" : "var(--down)";
  const top = items.slice(0, 8);
  const unit = lang === "ko" ? "인" : "";
  const verb = side === "buy"
    ? (lang === "ko" ? "보유" : " hold")
    : (lang === "ko" ? "매도" : " sell");

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "12px 16px",
        borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700,
        color, letterSpacing: "0.04em", textTransform: "uppercase",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
        {title}
      </div>
      {top.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          {lang === "ko" ? "데이터 없음" : "No data"}
        </div>
      ) : (
        <div style={{ padding: "4px 0" }}>
          {top.map((it, i) => {
            const names = side === "buy" ? it.buyers : it.sellers;
            const cnt = it.count ?? names?.length ?? 0;
            return (
              <div
                key={it.ticker}
                onClick={() => onSelectStock(it.ticker)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 16px", cursor: "pointer", gap: 12,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--card-hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", width: 16, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{it.ticker}</div>
                    <div style={{
                      fontSize: 11, color: "var(--text-muted)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{it.name}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color, flexShrink: 0, whiteSpace: "nowrap" }}>
                  {cnt}{unit}{verb}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
