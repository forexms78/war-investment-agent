"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;
const AUTH_KEY = "mylab_auth";

interface Holding {
  name: string;
  ticker: string;
  qty: number;
  avg_cost: number;
  current_price: number | null;
  value: number;
  pnl: number;
  pnl_pct: number;
  live: boolean;
}

interface Section {
  key: string;
  title: string;
  holdings: Holding[];
  total_value: number;
}

interface PortfolioData {
  updated_at: string;
  usd_krw: number;
  summary: {
    total_value: number;
    total_pnl: number;
    total_pnl_pct: number;
    holdings_count: number;
  };
  sections: Section[];
}

type SectionTab = "all" | "kr_stocks" | "kr_etf" | "us_stocks" | "us_etf";

// ─── 유틸 ────────────────────────────────────────────────────────────────
function fmtKrw(v: number): string {
  if (Math.abs(v) >= 1_000_000) {
    return (v / 10_000).toFixed(0) + "만";
  }
  return v.toLocaleString("ko-KR");
}

function fmtFull(v: number): string {
  return v.toLocaleString("ko-KR");
}

function pnlColor(v: number): string {
  if (v > 0) return "var(--green)";
  if (v < 0) return "var(--red)";
  return "var(--text-muted)";
}


// ─── 비밀번호 게이트 ─────────────────────────────────────────────────────
function LockGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useT();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/mylab/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        localStorage.setItem(AUTH_KEY, "1");
        onUnlock();
      } else {
        setError(t("mylab.lock.wrong"));
        setPw("");
        inputRef.current?.focus();
      }
    } catch {
      setError(t("mylab.lock.wrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>{t("mylab.lock.title")}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("mylab.lock.desc")}</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 320 }}>
        <input ref={inputRef} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={t("mylab.lock.placeholder")}
          style={{ width: "100%", padding: "10px 14px", background: "var(--bg-2)", border: `1px solid ${error ? "var(--red)" : "var(--border)"}`, borderRadius: 8, fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
        {error && <div style={{ fontSize: 12, color: "var(--red)", alignSelf: "flex-start" }}>{error}</div>}
        <button type="submit" disabled={loading || !pw.trim()}
          style={{ width: "100%", padding: "10px 0", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading || !pw.trim() ? 0.6 : 1 }}>
          {loading ? "..." : t("mylab.lock.btn")}
        </button>
      </form>
    </div>
  );
}


// ─── KPI 카드 ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: color || "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}


// ─── 종목 행 ─────────────────────────────────────────────────────────────
function HoldingRow({ h, onTickerClick }: { h: Holding; onTickerClick?: (t: string) => void }) {
  const color = pnlColor(h.pnl);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1.8fr 0.7fr 1.2fr 1.2fr 0.8fr",
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: "1px solid var(--border)",
      fontSize: 13,
    }}>
      <div>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{h.name}</span>
        {h.ticker && (
          <button
            onClick={() => onTickerClick?.(h.ticker)}
            style={{ marginLeft: 8, fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>
            {h.ticker}
          </button>
        )}
        {!h.live && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--text-muted)", opacity: 0.6 }}>offline</span>}
      </div>
      <div style={{ color: "var(--text-secondary)", textAlign: "right" }}>{h.qty % 1 === 0 ? h.qty : h.qty.toFixed(4)}</div>
      <div style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>{fmtFull(h.value)}</div>
      <div style={{ fontWeight: 600, color, textAlign: "right" }}>
        {h.pnl >= 0 ? "+" : ""}{fmtKrw(h.pnl)}
      </div>
      <div style={{
        fontWeight: 700, color, textAlign: "right",
        background: `${color}12`, borderRadius: 4, padding: "2px 6px",
        display: "inline-block", marginLeft: "auto",
      }}>
        {h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct.toFixed(1)}%
      </div>
    </div>
  );
}


// ─── 섹션 테이블 ─────────────────────────────────────────────────────────
function SectionTable({ section, onTickerClick }: { section: Section; onTickerClick?: (t: string) => void }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{section.title}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{section.holdings.length}종목 / {fmtKrw(section.total_value)}원</span>
      </div>
      {/* 헤더 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.8fr 0.7fr 1.2fr 1.2fr 0.8fr",
        padding: "8px 16px",
        borderBottom: "1px solid var(--border)",
        fontSize: 11,
        color: "var(--text-muted)",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}>
        <div>종목</div>
        <div style={{ textAlign: "right" }}>수량</div>
        <div style={{ textAlign: "right" }}>평가금</div>
        <div style={{ textAlign: "right" }}>손익</div>
        <div style={{ textAlign: "right" }}>수익률</div>
      </div>
      {section.holdings.map((h, i) => (
        <HoldingRow key={`${h.name}-${i}`} h={h} onTickerClick={onTickerClick} />
      ))}
    </div>
  );
}


// ─── 배분 바 ─────────────────────────────────────────────────────────────
const SECTION_COLORS: Record<string, string> = {
  kr_stocks: "#3b82f6",
  kr_etf: "#8b5cf6",
  us_stocks: "#10b981",
  us_etf: "#f59e0b",
};

const SECTION_LABELS: Record<string, string> = {
  kr_stocks: "국내 주식",
  kr_etf: "국내 ETF",
  us_stocks: "해외 개별주",
  us_etf: "해외 ETF",
};

function AllocationBar({ sections, total }: { sections: Section[]; total: number }) {
  if (total === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      {/* 바 */}
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        {sections.map(s => (
          <div key={s.key} style={{ width: `${(s.total_value / total) * 100}%`, background: SECTION_COLORS[s.key] || "#666" }} />
        ))}
      </div>
      {/* 범례 */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {sections.map(s => {
          const pct = ((s.total_value / total) * 100).toFixed(1);
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: SECTION_COLORS[s.key] || "#666" }} />
              <span style={{ color: "var(--text-secondary)" }}>{SECTION_LABELS[s.key] || s.title}</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────
export default function MyLabSection() {
  const { t } = useT();
  const [unlocked, setUnlocked] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<SectionTab>("all");

  useEffect(() => {
    if (localStorage.getItem(AUTH_KEY) === "1") setUnlocked(true);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    setError(false);
    fetch(`${API}/mylab/portfolio`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setPortfolio)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [unlocked]);

  if (!unlocked) return <div className="fade-in"><LockGate onUnlock={() => setUnlocked(true)} /></div>;

  if (loading) return (
    <div className="fade-in" style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)" }}>
      {t("mylab.loading")}
    </div>
  );

  if (error || !portfolio) return (
    <div className="fade-in" style={{ padding: "60px 0", textAlign: "center", color: "var(--red)" }}>
      {t("mylab.error")}
    </div>
  );

  const { summary, sections } = portfolio;
  const pnlSign = summary.total_pnl >= 0 ? "+" : "";
  const pnlColor_ = pnlColor(summary.total_pnl);

  const tabs: { id: SectionTab; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "us_stocks", label: "해외 개별주" },
    { id: "us_etf", label: "해외 ETF" },
    { id: "kr_stocks", label: "국내 주식" },
    { id: "kr_etf", label: "국내 ETF" },
  ];

  const visibleSections = activeTab === "all"
    ? sections
    : sections.filter(s => s.key === activeTab);

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>My Portfolio</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            실시간 / {summary.holdings_count}종목 / USD {portfolio.usd_krw.toLocaleString("ko-KR")}원
          </p>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <KpiCard label="총 평가금" value={`${fmtKrw(summary.total_value)}원`} />
        <KpiCard
          label="총 손익"
          value={`${pnlSign}${fmtKrw(summary.total_pnl)}원`}
          sub={`${pnlSign}${summary.total_pnl_pct.toFixed(1)}%`}
          color={pnlColor_}
        />
        <KpiCard label="종목 수" value={`${summary.holdings_count}`} sub="국내 3 / 해외 18" />
      </div>

      {/* 배분 바 */}
      <AllocationBar sections={sections} total={summary.total_value} />

      {/* 탭 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? "var(--accent-dim)" : "transparent",
              border: activeTab === tab.id ? "1px solid var(--accent-glow)" : "1px solid transparent",
              borderRadius: 8, padding: "6px 14px",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 종목 테이블 */}
      {visibleSections.map(s => (
        <SectionTable key={s.key} section={s} />
      ))}
    </div>
  );
}
