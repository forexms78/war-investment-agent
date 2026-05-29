"use client";
import { useState } from "react";
import { InvestorSummary, RecommendedStock } from "@/types";
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
  const [selected, setSelected] = useState<string>("consensus");
  const buy = recommendations?.buy ?? [];
  const sell = recommendations?.sell ?? [];
  const activeInvestor = investors.find(i => i.id === selected) ?? null;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {lang === "ko" ? "대형 투자자 포트폴리오" : "Super Investor Portfolios"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {lang === "ko" ? "SEC 13F 분기 공시 기반 · 누가 무엇을 사고 파는가" : "Based on SEC 13F quarterly filings"}
        </div>
      </div>

      <div className="wx-investors-layout">
        {/* 좌측 네비 */}
        <nav className="wx-inv-nav">
          <NavItem
            label={lang === "ko" ? "종합 컨센서스" : "Consensus"}
            sub={lang === "ko" ? "지금 사는 / 파는 종목" : "Buying / Selling now"}
            active={selected === "consensus"}
            onClick={() => setSelected("consensus")}
            color="var(--accent)"
          />
          <div style={{ height: 1, background: "var(--border)", margin: "8px 4px" }} />
          {loadingInvestors
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height={44} />)
            : investors.map(inv => (
                <NavItem
                  key={inv.id}
                  label={inv.name}
                  sub={inv.firm}
                  active={selected === inv.id}
                  onClick={() => setSelected(inv.id)}
                  color={inv.color}
                  initial={inv.avatar_initial}
                />
              ))}
        </nav>

        {/* 우측 콘텐츠 */}
        <div style={{ minWidth: 0 }}>
          {selected === "consensus" ? (
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
          ) : activeInvestor ? (
            <InvestorPanel
              investor={activeInvestor}
              lang={lang}
              onOpenDetail={() => onSelectInvestor(activeInvestor.id)}
              onSelectStock={onSelectStock}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NavItem({ label, sub, active, onClick, color, initial }: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
  color: string;
  initial?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "9px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
        background: active ? "var(--accent-dim)" : "transparent",
        border: active ? "1px solid var(--accent-glow)" : "1px solid transparent",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--card-hover)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {initial ? (
        <span style={{
          width: 30, height: 30, borderRadius: 8, background: `${color}22`,
          border: `1px solid ${color}55`, color, fontSize: 11, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{initial}</span>
      ) : (
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, margin: "0 11px" }} />
      )}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{
          display: "block", fontSize: 13, fontWeight: active ? 700 : 600,
          color: active ? "var(--accent)" : "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{label}</span>
        <span style={{
          display: "block", fontSize: 11, color: "var(--text-muted)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{sub}</span>
      </span>
    </button>
  );
}

function InvestorPanel({ investor, lang, onOpenDetail, onSelectStock }: {
  investor: InvestorSummary;
  lang: string;
  onOpenDetail: () => void;
  onSelectStock: (ticker: string) => void;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: 22, borderTop: `2px solid ${investor.color}`,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, background: `${investor.color}22`,
            border: `1.5px solid ${investor.color}55`, color: investor.color,
            fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>{investor.avatar_initial}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{investor.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {investor.firm} · {investor.title}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px",
            background: `${investor.color}18`, color: investor.color, borderRadius: 6, whiteSpace: "nowrap",
          }}>{investor.style}</span>
          <button
            onClick={onOpenDetail}
            style={{
              fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
              background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-glow)", whiteSpace: "nowrap",
            }}
          >
            {lang === "ko" ? "포트폴리오 자세히" : "Full portfolio"}
          </button>
        </div>
      </div>

      {/* 설명 */}
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 12 }}>
        {investor.description}
      </p>
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 18 }}>
        <span style={{ color: investor.color, fontWeight: 700, marginRight: 6 }}>{lang === "ko" ? "대표 이력" : "Known for"}</span>
        {investor.known_for}
      </div>

      {/* 보유 종목 */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        {lang === "ko" ? "주요 보유 종목" : "Top holdings"}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {investor.holdings_data.map(h => {
          const isUp = (h.change_30d_pct ?? 0) >= 0;
          return (
            <button
              key={h.ticker}
              onClick={() => onSelectStock(h.ticker)}
              style={{
                background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
                borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{h.ticker}</span>
              {h.change_30d_pct != null && (
                <span style={{ fontSize: 11, fontWeight: 500, color: isUp ? "var(--up)" : "var(--down)" }}>
                  {isUp ? "+" : ""}{h.change_30d_pct.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 최근 동향 */}
      <div style={{
        fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
        borderTop: "1px solid var(--border)", paddingTop: 14,
      }}>
        <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 11, marginRight: 6 }}>LATEST</span>
        {investor.recent_moves}
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
