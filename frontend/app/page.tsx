"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SkeletonCard from "@/components/SkeletonCard";

const API = process.env.NEXT_PUBLIC_API_URL;

// ── 타입 ──────────────────────────────────────
interface Headline {
  title: string; url: string; source: string;
  published_at: string; image_url: string;
}
interface MoverItem {
  ticker?: string; symbol?: string; name: string;
  price_change_24h?: number; change_30d_pct?: number; change_1d_pct?: number;
  current_price?: number; price_usd?: number; price?: number;
}
interface NewsItem {
  title: string; url: string; source: string;
  published_at: string; category: string;
  sentiment: "positive" | "neutral" | "negative";
  ai_summary?: string; image_url?: string;
}
interface RealEstateIndicator {
  name: string; value: string; change?: string; trend?: string;
}
interface Movers {
  stocks:      { gainers: MoverItem[]; losers: MoverItem[]; news: NewsItem[]; period: string };
  crypto:      { gainers: MoverItem[]; losers: MoverItem[]; news: NewsItem[]; period: string };
  commodities: { gainers: MoverItem[]; losers: MoverItem[]; news: NewsItem[]; period: string };
  realestate:  { indicators: RealEstateIndicator[]; news: NewsItem[] };
}

type InvestTab = "stocks" | "crypto" | "commodities" | "realestate";

const INVEST_TABS: { id: InvestTab; label: string }[] = [
  { id: "stocks",      label: "주식"   },
  { id: "crypto",      label: "코인"   },
  { id: "commodities", label: "광물"   },
  { id: "realestate",  label: "부동산" },
];

const SENTIMENT_COLOR = {
  positive: "#10b981", neutral: "#94a3b8", negative: "#ef4444",
} as const;

function fmtDate(): string {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}
function fmtRelativeTime(publishedAt: string): string {
  if (!publishedAt) return "";
  try {
    const diff = Date.now() - new Date(publishedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  } catch { return ""; }
}
function fmtPct(v: number | undefined | null): string {
  if (v == null) return "–";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}
function pctColor(v: number | undefined | null): string {
  if (v == null) return "var(--text-muted)";
  return v > 0 ? "#10b981" : v < 0 ? "#ef4444" : "var(--text-muted)";
}

// ── 메인 컴포넌트 ──────────────────────────────
export default function TodayPicksPage() {
  const [theme, setTheme]               = useState<"dark" | "light">("light");
  const [headlines, setHeadlines]       = useState<Headline[]>([]);
  const [loadingHL, setLoadingHL]       = useState(true);
  const [showAllHL, setShowAllHL]       = useState(false);
  const [movers, setMovers]             = useState<Movers | null>(null);
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [activeTab, setActiveTab]       = useState<InvestTab>("stocks");

  useEffect(() => { document.documentElement.setAttribute("data-theme", "light"); }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  useEffect(() => {
    fetch(`${API}/headlines?limit=10`)
      .then(r => r.json())
      .then(d => setHeadlines(d.headlines || []))
      .catch(() => {})
      .finally(() => setLoadingHL(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/today-movers`)
      .then(r => r.json())
      .then(setMovers)
      .catch(() => {})
      .finally(() => setLoadingMovers(false));
  }, []);

  const visibleHL = showAllHL ? headlines : headlines.slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)", backdropFilter: "blur(16px)",
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto", padding: "0 24px",
          height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>W</span>
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>Whalyx</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Today&apos;s Picks
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={toggleTheme} style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6,
              padding: "5px 10px", cursor: "pointer", fontSize: 10, fontWeight: 700,
              color: "var(--text-secondary)", letterSpacing: "0.06em",
            }}>
              {theme === "dark" ? "LIGHT" : "DARK"}
            </button>
            <Link href="/dashboard" style={{
              fontSize: 12, color: "var(--text-secondary)", textDecoration: "none",
              border: "1px solid var(--border)", borderRadius: 6, padding: "5px 12px", fontWeight: 500,
            }}>
              전체 대시보드 →
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {/* 타이틀 */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>{fmtDate()}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            오늘의 투자포인트
          </h1>
        </div>

        {/* ── 지금 주목할 뉴스 ── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                지금 주목할 뉴스
              </span>
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>5분마다 갱신</span>
          </div>

          {loadingHL ? (
            <div className="driver-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[0,1,2].map(i => <SkeletonCard key={i} height={280} />)}
            </div>
          ) : (
            <>
              <div className="driver-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {visibleHL.map((h, i) => <HeadlineCard key={i} headline={h} rank={i + 1} />)}
              </div>
              {headlines.length > 3 && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <button
                    onClick={() => setShowAllHL(v => !v)}
                    style={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: 20, padding: "7px 24px", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.color = "var(--accent)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    {showAllHL ? "접기 ↑" : `더보기 +${headlines.length - 3}`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── 오늘의 투자포인트 (탭) ── */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              카테고리별 급등·급락
            </span>
          </div>

          {/* 탭 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {INVEST_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5,
                  background: activeTab === t.id ? "var(--accent)" : "var(--card)",
                  color: activeTab === t.id ? "#fff" : "var(--text-secondary)",
                  border: activeTab === t.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loadingMovers ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SkeletonCard height={140} /><SkeletonCard height={200} />
            </div>
          ) : !movers ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>
              데이터를 불러오는 중입니다
            </div>
          ) : (
            <TabContent tab={activeTab} movers={movers} />
          )}
        </section>

        {/* 하단 */}
        <div style={{ textAlign: "center", marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            기관 투자자 포트폴리오, 돈의 흐름 분석은 전체 대시보드에서
          </p>
          <Link href="/dashboard" style={{
            display: "inline-block", fontSize: 12, color: "var(--text-secondary)",
            border: "1px solid var(--border)", padding: "7px 20px",
            borderRadius: 20, textDecoration: "none",
          }}>
            전체 대시보드 보기
          </Link>
        </div>
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

// ── 탭 콘텐츠 ──────────────────────────────────
function TabContent({ tab, movers }: { tab: InvestTab; movers: Movers }) {
  if (tab === "realestate") {
    const { indicators, news } = movers.realestate;
    return (
      <div>
        {indicators.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            {indicators.map((ind, i) => (
              <div key={i} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{ind.name}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{ind.value}</div>
                {ind.change && (
                  <div style={{ fontSize: 11, color: ind.trend === "up" ? "#10b981" : ind.trend === "down" ? "#ef4444" : "var(--text-muted)", marginTop: 2 }}>
                    {ind.change}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <NewsSection news={news} emptyMsg="부동산 뉴스를 가져오는 중입니다" />
      </div>
    );
  }

  const { gainers, losers, news, period } = movers[tab];
  const periodLabel = period === "24h" ? "24시간" : "30일";

  return (
    <div>
      {/* 급등·급락 */}
      {(gainers.length > 0 || losers.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {/* 급등 */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{
              padding: "10px 14px", background: "rgba(16,185,129,0.06)",
              borderBottom: "1px solid rgba(16,185,129,0.15)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>▲ 급등</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{periodLabel} 기준</span>
            </div>
            {gainers.length === 0 ? (
              <div style={{ padding: "20px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>데이터 준비 중</div>
            ) : (
              gainers.map((item, i) => <MoverRow key={i} item={item} tab={tab} isGainer />)
            )}
          </div>
          {/* 급락 */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{
              padding: "10px 14px", background: "rgba(239,68,68,0.06)",
              borderBottom: "1px solid rgba(239,68,68,0.15)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>▼ 급락</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{periodLabel} 기준</span>
            </div>
            {losers.length === 0 ? (
              <div style={{ padding: "20px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>데이터 준비 중</div>
            ) : (
              losers.map((item, i) => <MoverRow key={i} item={item} tab={tab} isGainer={false} />)
            )}
          </div>
        </div>
      )}

      {/* 관련 뉴스 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          관련 뉴스
        </span>
      </div>
      <NewsSection news={news} emptyMsg="관련 뉴스를 분석 중입니다" />
    </div>
  );
}

function MoverRow({ item, tab, isGainer }: { item: MoverItem; tab: InvestTab; isGainer: boolean }) {
  const pct = tab === "crypto"
    ? item.price_change_24h
    : item.change_1d_pct ?? item.change_30d_pct;
  const price = item.price_usd ?? item.current_price ?? item.price;
  const ticker = item.ticker || item.symbol || "";
  const color = isGainer ? "#10b981" : "#ef4444";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderBottom: "1px solid var(--border)",
    }}>
      {/* 티커 뱃지 */}
      <div style={{
        minWidth: 42, padding: "3px 6px", borderRadius: 6, textAlign: "center",
        background: `${color}15`, border: `1px solid ${color}30`,
        fontSize: 10, fontWeight: 800, color: color, letterSpacing: "0.04em",
      }}>
        {ticker}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {item.name}
        </div>
        {price != null && (
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            ${typeof price === "number" ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price}
          </div>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: pctColor(pct), flexShrink: 0 }}>
        {fmtPct(pct)}
      </div>
    </div>
  );
}

function NewsSection({ news, emptyMsg }: { news: NewsItem[]; emptyMsg: string }) {
  if (news.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 12 }}>
        {emptyMsg}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {news.map((item, i) => <SmallNewsCard key={i} item={item} />)}
    </div>
  );
}

function SmallNewsCard({ item }: { item: NewsItem }) {
  const sc = SENTIMENT_COLOR[item.sentiment] ?? SENTIMENT_COLOR.neutral;
  return (
    <a
      href={item.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", gap: 12, padding: "12px 14px",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 12, textDecoration: "none", color: "inherit",
        transition: "background 0.15s", alignItems: "flex-start",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--card-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--card)")}
    >
      {item.image_url && (
        <div style={{ width: 80, height: 60, flexShrink: 0, borderRadius: 8, overflow: "hidden", background: "var(--border)" }}>
          <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none"; }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.ai_summary && (
          <div style={{
            fontSize: 11, color: sc, background: `${sc}12`,
            border: `1px solid ${sc}30`, borderRadius: 4,
            padding: "2px 8px", marginBottom: 5, display: "inline-block",
          }}>
            {item.ai_summary}
          </div>
        )}
        <div style={{
          fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {item.title}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
          {item.source}{item.published_at && ` · ${fmtRelativeTime(item.published_at)}`}
        </div>
      </div>
    </a>
  );
}

// ── 헤드라인 카드 ──────────────────────────────
function HeadlineCard({ headline, rank }: { headline: Headline; rank: number }) {
  const accents = ["#5B9EC9", "#7AAFC8", "#90BBD6", "#4A8AB5", "#3A7AA5"];
  const accent = accents[(rank - 1) % accents.length];
  return (
    <a
      href={headline.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "hidden", textDecoration: "none", color: "inherit",
        transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
        e.currentTarget.style.borderColor = accent + "66";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div style={{ width: "100%", height: 200, flexShrink: 0, background: "var(--bg-2)", position: "relative", overflow: "hidden" }}>
        {headline.image_url ? (
          <img src={headline.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
          }}>
            <span style={{ fontSize: 28, opacity: 0.2, color: accent }}>■</span>
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)" }} />
        <div style={{
          position: "absolute", top: 8, left: 8, padding: "2px 8px", borderRadius: 6,
          background: accent, fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.04em",
        }}>
          TOP {rank}
        </div>
        {headline.source && (
          <div style={{
            position: "absolute", bottom: 8, left: 8, padding: "2px 8px", borderRadius: 4,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.9)",
            maxWidth: "calc(100% - 16px)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
          }}>
            {headline.source}
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.5,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        }}>
          {headline.title}
        </div>
        <div style={{ marginTop: "auto", fontSize: 10, color: "var(--text-muted)" }}>
          {fmtRelativeTime(headline.published_at)}
        </div>
      </div>
    </a>
  );
}
