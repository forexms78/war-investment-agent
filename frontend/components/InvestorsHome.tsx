"use client";
import { useState, useEffect } from "react";
import { InvestorSummary, RecommendedStock, InvestorDetail, Investor13F, Holding13F } from "@/types";
import SkeletonCard from "@/components/SkeletonCard";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;

// 투자자 소속사 → 로고 도메인 (clearbit). 없으면 이니셜 fallback.
const FIRM_DOMAIN: Record<string, string> = {
  "Berkshire Hathaway": "berkshirehathaway.com",
  "ARK Invest": "ark-funds.com",
  "Bridgewater Associates": "bridgewater.com",
  "Pershing Square": "pershingsquareholdings.com",
  "Scion Asset Management": "scionasset.com",
  "Duquesne Family Office": "duquesnefamilyoffice.com",
  "Soros Fund Management": "sorosfundmgmt.com",
  "Appaloosa Management": "appaloosamanagement.com",
};

const ACTION: Record<string, { ko: string; en: string; color: string }> = {
  buy:  { ko: "매수", en: "BUY",  color: "var(--up)" },
  sell: { ko: "매도", en: "SELL", color: "var(--down)" },
  hold: { ko: "보유", en: "HOLD", color: "var(--text-muted)" },
};

function fmtShares(n: number, lang: string): string {
  if (!n) return "-";
  if (lang === "ko") {
    if (n >= 1e8) return (n / 1e8).toFixed(1) + "억주";
    if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + "만주";
    return n.toLocaleString() + "주";
  }
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

function fmtValue(usd: number, krw: number | undefined, lang: string): string {
  if (!usd) return "-";
  const u = usd >= 1e9 ? `$${(usd / 1e9).toFixed(1)}B`
    : usd >= 1e6 ? `$${(usd / 1e6).toFixed(0)}M`
    : `$${Math.round(usd / 1e3)}K`;
  if (!krw) return u;
  const w = usd * krw;
  if (lang !== "ko") return u;
  const k = w >= 1e12 ? `₩${(w / 1e12).toFixed(1)}조`
    : w >= 1e8 ? `₩${Math.round(w / 1e8)}억`
    : `₩${Math.round(w / 1e4)}만`;
  return `${u} · ${k}`;
}

function TickerLogo({ ticker, size = 24 }: { ticker: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <span style={{
        width: size, height: size, borderRadius: 5, background: "var(--accent-dim)",
        color: "var(--accent)", fontSize: size * 0.36, fontWeight: 800,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{ticker.slice(0, 2)}</span>
    );
  }
  return (
    <img
      src={`https://assets.parqet.com/logos/symbol/${ticker}?format=png`}
      width={size} height={size} alt=""
      style={{ borderRadius: 5, objectFit: "contain", background: "#fff", flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

function FirmLogo({ firm, initial, color, size = 30 }: {
  firm: string; initial: string; color: string; size?: number;
}) {
  const domain = FIRM_DOMAIN[firm];
  const [err, setErr] = useState(!domain);
  if (err || !domain) {
    return (
      <span style={{
        width: size, height: size, borderRadius: 8, background: `${color}22`,
        border: `1px solid ${color}55`, color, fontSize: size * 0.36, fontWeight: 800,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{initial}</span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      width={size} height={size} alt=""
      style={{ borderRadius: 8, objectFit: "contain", background: "#fff", padding: 3, flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

function initialsOf(name: string): string {
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

interface Props {
  investors: InvestorSummary[];
  recommendations: { buy: RecommendedStock[]; sell: RecommendedStock[]; holdings?: RecommendedStock[]; as_of?: string } | null;
  loadingInvestors: boolean;
  onSelectInvestor: (id: string) => void;
  onSelectStock: (ticker: string) => void;
  usdKrw?: number;
}

export default function InvestorsHome({
  investors, recommendations, loadingInvestors, onSelectInvestor, onSelectStock, usdKrw,
}: Props) {
  const { lang } = useT();
  const [selected, setSelected] = useState<string>("consensus");
  const buy = recommendations?.buy ?? [];
  const sell = recommendations?.sell ?? [];
  const holdings = recommendations?.holdings ?? [];
  const asOf = recommendations?.as_of || "";
  const activeInvestor = investors.find(i => i.id === selected) ?? null;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {lang === "ko" ? "대형 투자자 포트폴리오" : "Super Investor Portfolios"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            {lang === "ko" ? "SEC 13F 분기 공시 기반 · 누가 무엇을 사고 파는가" : "Based on SEC 13F quarterly filings"}
          </div>
        </div>
        {asOf && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
            background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-glow)", whiteSpace: "nowrap",
          }}>
            {asOf} 13F {lang === "ko" ? "기준" : "filing"}
          </span>
        )}
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
                  firm={inv.firm}
                  initial={inv.avatar_initial}
                />
              ))}
        </nav>

        {/* 우측 콘텐츠 */}
        <div style={{ minWidth: 0 }}>
          {selected === "consensus" ? (
            <div>
              <HoldingsConsensus items={holdings} onSelectStock={onSelectStock} lang={lang} />
              <div className="wx-consensus-grid" style={{ marginTop: 16 }}>
                <ConsensusCard
                  title={lang === "ko" ? "지금 사는 종목" : "Buying now"}
                  side="buy" items={buy} onSelectStock={onSelectStock} lang={lang}
                />
                <ConsensusCard
                  title={lang === "ko" ? "지금 파는 종목" : "Selling now"}
                  side="sell" items={sell} onSelectStock={onSelectStock} lang={lang}
                />
              </div>
            </div>
          ) : activeInvestor ? (
            <InvestorPanel
              investor={activeInvestor}
              lang={lang}
              onSelectStock={onSelectStock}
              onOpenDetail={() => onSelectInvestor(activeInvestor.id)}
              usdKrw={usdKrw}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NavItem({ label, sub, active, onClick, color, initial, firm }: {
  label: string; sub: string; active: boolean; onClick: () => void;
  color: string; initial?: string; firm?: string;
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
      {initial && firm ? (
        <FirmLogo firm={firm} initial={initial} color={color} size={30} />
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

function InvestorPanel({ investor, lang, onSelectStock, onOpenDetail, usdKrw }: {
  investor: InvestorSummary;
  lang: string;
  onSelectStock: (ticker: string) => void;
  onOpenDetail: () => void;
  usdKrw?: number;
}) {
  const [tf, setTf] = useState<Investor13F | null>(null);
  const [detail, setDetail] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qIdx, setQIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setTf(null); setDetail(null); setQIdx(0);
    Promise.all([
      fetch(`${API}/investors/${investor.id}/13f`).then(r => r.json()).catch(() => null),
      fetch(`${API}/investors/${investor.id}`).then(r => r.json()).catch(() => null),
    ]).then(([t, d]) => { if (alive) { setTf(t); setDetail(d); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [investor.id]);

  const quarters = tf?.quarters ?? [];
  const hasQ = quarters.length > 0;
  const q = hasQ ? quarters[Math.min(qIdx, quarters.length - 1)] : null;
  // 13F 분기 데이터 우선, 없으면 하드코딩 portfolio 폴백
  const rows: Array<Holding13F | { ticker: string; name: string; weight: number; shares: number; action: string; change_30d_pct?: number | null }> =
    q ? q.holdings : (detail?.portfolio ?? []);
  const totalCount = q ? q.count : (detail?.total_positions ?? rows.length);
  const period = q ? (q.filed_date ? `${q.filed_date} 공시` : (q.as_of_date ? `${q.as_of_date} 기준` : "")) : "";

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: 22, borderTop: `2px solid ${investor.color}`,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <FirmLogo firm={investor.firm} initial={investor.avatar_initial} color={investor.color} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{investor.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {investor.firm} · {investor.title}
          </div>
        </div>
        <span style={{
          marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "4px 10px",
          background: `${investor.color}18`, color: investor.color, borderRadius: 6, whiteSpace: "nowrap",
        }}>{investor.style}</span>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 18 }}>
        {investor.description}
      </p>

      {/* 포트폴리오 + 분기 선택 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{lang === "ko" ? "보유 포트폴리오" : "Holdings"}</span>
            {hasQ && (
              <select
                value={qIdx}
                onChange={e => setQIdx(Number(e.target.value))}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 8,
                  background: "var(--bg-2)", color: "var(--text-primary)", border: "1px solid var(--border)", cursor: "pointer",
                }}
              >
                {quarters.map((qq, i) => (
                  <option key={i} value={i}>{qq.as_of} ({qq.count}{lang === "ko" ? "종목" : ""})</option>
                ))}
              </select>
            )}
            {totalCount ? (
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>
                {lang === "ko" ? `상위 ${rows.length} / 전체 ${totalCount.toLocaleString()}개` : `top ${rows.length} of ${totalCount.toLocaleString()}`}
              </span>
            ) : null}
          </span>
          <button
            onClick={onOpenDetail}
            style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap" }}
          >{lang === "ko" ? "뉴스·AI 인사이트 →" : "News & AI →"}</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>
          {hasQ
            ? (lang === "ko"
                ? `${q!.as_of} 13F${period ? ` · ${period}` : ""} · 동향은 직전 분기 대비 매수·보유·매도 (평단·정확 매수일은 13F 미공시)`
                : `${q!.as_of} 13F${period ? ` · ${period}` : ""} · action vs prior quarter`)
            : (lang === "ko"
                ? "동향(매수·보유·매도)은 13F 기준 직전 분기 대비 종목별 증감입니다."
                : "Action reflects per-stock change vs prior quarter (13F).")}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height={44} />)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          {lang === "ko" ? "보유 종목 데이터를 준비 중입니다." : "No holdings data"}
        </div>
      ) : (
        <div>
          {/* 헤더 행 */}
          <div className="wx-pf-row" style={{ padding: "4px 10px", color: "var(--text-muted)", fontSize: 11, fontWeight: 600 }}>
            <span>{lang === "ko" ? "종목" : "Stock"}</span>
            <span style={{ textAlign: "right" }}>{lang === "ko" ? "비중" : "Weight"}</span>
            <span style={{ textAlign: "right" }}>{lang === "ko" ? "보유" : "Shares"}</span>
            <span style={{ textAlign: "right" }}>{hasQ ? (lang === "ko" ? "보유액" : "Value") : "30D"}</span>
            <span style={{ textAlign: "center" }}>{lang === "ko" ? "동향" : ""}</span>
          </div>
          {rows.map(h => {
            const act = ACTION[h.action] ?? ACTION.hold;
            const valueUsd = (h as Holding13F).value_usd;
            const chg = (h as { change_30d_pct?: number | null }).change_30d_pct;
            return (
              <div
                key={h.ticker}
                className="wx-pf-row wx-pf-row-item"
                onClick={() => onSelectStock(h.ticker)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <TickerLogo ticker={h.ticker} size={24} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{h.ticker}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                  </span>
                </span>
                <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>{h.weight}%</span>
                <span style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>{fmtShares(h.shares, lang)}</span>
                <span style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>
                  {hasQ
                    ? fmtValue(valueUsd, usdKrw, lang)
                    : (chg == null ? "-" : `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`)}
                </span>
                <span style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `color-mix(in srgb, ${act.color} 18%, transparent)`, color: act.color }}>
                    {lang === "ko" ? act.ko : act.en}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 최근 동향 */}
      <div style={{
        fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
        borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 16,
      }}>
        <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 11, marginRight: 6 }}>LATEST</span>
        {investor.recent_moves}
      </div>
    </div>
  );
}

function HoldingsConsensus({ items, onSelectStock, lang }: {
  items: RecommendedStock[];
  onSelectStock: (ticker: string) => void;
  lang: string;
}) {
  const top = items.slice(0, 12);
  if (top.length === 0) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{lang === "ko" ? "최다 보유 종목" : "Most held"}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{lang === "ko" ? "매수·보유·매도 포함" : "buy · hold · sell"}</span>
      </div>
      <div>
        {top.map(it => {
          const holders = it.holders ?? [];
          return (
            <div key={it.ticker} style={{ borderBottom: "1px solid var(--border)", padding: "10px 14px" }}>
              <div onClick={() => onSelectStock(it.ticker)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <TickerLogo ticker={it.ticker} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{it.ticker}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {it.count ?? holders.length}{lang === "ko" ? "인" : ""}
                </span>
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {holders.map((h, i) => {
                  const act = ACTION[h.action ?? "hold"] ?? ACTION.hold;
                  return (
                    <span key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px",
                      borderRadius: 7, background: "var(--bg-2)", border: "1px solid var(--border)",
                    }}>
                      <FirmLogo firm={h.firm} initial={initialsOf(h.name)} color={h.color} size={14} />
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{h.name.split(" ").slice(-1)[0]}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{h.weight}%</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: act.color }}>{lang === "ko" ? act.ko : act.en}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
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
  const top = items.slice(0, 12);
  const unit = lang === "ko" ? "인" : "";

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
        <div>
          {top.map(it => {
            const holders = it.holders ?? [];
            const cnt = it.count ?? holders.length;
            return (
              <div key={it.ticker} style={{ borderBottom: "1px solid var(--border)", padding: "10px 14px" }}>
                {/* 종목 헤더 */}
                <div
                  onClick={() => onSelectStock(it.ticker)}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                >
                  <TickerLogo ticker={it.ticker} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{it.ticker}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {cnt}{unit}
                  </span>
                </div>
                {/* 보유자 명세 — 누가 얼마나 */}
                {holders.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5, paddingLeft: 2 }}>
                    {holders.map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <FirmLogo firm={h.firm} initial={initialsOf(h.name)} color={h.color} size={16} />
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {h.weight}% · {fmtShares(h.shares, lang)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
