"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QuantTooltip from "@/components/quant/QuantTooltip";
import SignalBadge from "@/components/quant/SignalBadge";
import FairValuePanel from "@/components/quant/FairValuePanel";
import PasteAnalyzer from "@/components/quant/PasteAnalyzer";
import JournalTimeline from "@/components/quant/JournalTimeline";
import PasswordGate from "@/components/quant/PasswordGate";

interface Stock {
  id: string;
  ticker: string;
  market: string;
  name: string;
  current_price?: number;
  forward_eps?: number;
  bps?: number;
  eps_growth_rate?: number;
  target_pe?: number;
  overhang_note?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  action: string;
  price?: number;
  quantity?: number;
  analysis_text?: string;
  signal?: string;
  forward_pe?: number;
  fair_value_pe?: number;
  fair_value_graham?: number;
  fair_value_peg?: number;
  created_at: string;
}

interface Metrics {
  forward_pe?: number;
  fair_value_pe?: number;
  fair_value_graham?: number;
  fair_value_peg?: number;
  avg_fair_value?: number;
  signal?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

const QuantNav = () => (
  <nav style={{
    borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
    background: "var(--header-bg)", backdropFilter: "blur(16px)",
  }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/dashboard" style={{
          width: 30, height: 30, borderRadius: 8, background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
        }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>W</span>
        </Link>
        <Link href="/dashboard" style={{ textDecoration: "none", color: "inherit" }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>Whalyx</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>Quant</span>
        </Link>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {[
          { href: "/quant", label: "리서치 저널", active: true },
          { href: "/autotrade", label: "자동매매", active: false },
        ].map(({ href, label, active }) => (
          <Link key={href} href={href} style={{
            padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 400,
            textDecoration: "none",
            background: active ? "var(--accent-dim)" : "transparent",
            border: active ? "1px solid var(--accent-glow)" : "1px solid transparent",
            color: active ? "var(--accent)" : "var(--text-secondary)",
          }}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  </nav>
);

function StockDetailContent() {
  const { ticker } = useParams<{ ticker: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lastMetrics, setLastMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    const [s, j] = await Promise.all([
      fetch(`${API}/quant/stocks/${ticker}`).then((r) => r.json()),
      fetch(`${API}/quant/journal/${ticker}`).then((r) => r.json()),
    ]);
    setStock(s?.ticker ? s : null);
    setEntries(Array.isArray(j) ? j : []);
    if (Array.isArray(j) && j.length > 0) setLastMetrics(j[0]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [ticker]);

  function handleAnalyzed(result: Metrics & { current_price?: number }) {
    setLastMetrics(result);
    fetchData();
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩 중...</p>
    </div>
  );

  if (!stock) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>종목을 찾을 수 없습니다.</p>
    </div>
  );

  const signal = lastMetrics?.signal;
  const cp = stock.current_price;

  const signalBg = signal === "buy"
    ? "var(--green-dim)" : signal === "sell"
    ? "var(--red-dim)" : "var(--gold-dim)";
  const signalBorder = signal === "buy"
    ? "rgba(16,185,129,0.35)" : signal === "sell"
    ? "rgba(239,68,68,0.35)" : "rgba(232,168,85,0.35)";

  const metricCards = [
    {
      label: "현재가",
      value: cp ? (stock.market === "KR" ? `${cp.toLocaleString()}원` : `$${cp.toLocaleString()}`) : "N/A",
      color: "var(--text-primary)",
      tooltip: null,
    },
    {
      label: "Forward P/E",
      value: lastMetrics?.forward_pe ?? "N/A",
      color: "var(--gold)",
      tooltip: "Forward P/E" as string,
    },
    {
      label: "EPS(FWD)",
      value: stock.forward_eps ? `$${stock.forward_eps}` : "N/A",
      color: "var(--green)",
      tooltip: "EPS" as string,
    },
    {
      label: "오버행",
      value: stock.overhang_note ? "있음" : "없음",
      color: stock.overhang_note ? "var(--red)" : "var(--text-muted)",
      tooltip: "오버행" as string,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      <QuantNav />

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* 브레드크럼 + 종목명 */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Link href="/quant" style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "none" }}>
              리서치 저널
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>›</span>
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{stock.ticker} · {stock.market}</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{stock.name}</h1>
        </div>

        {/* 시그널 배너 */}
        {signal && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: signalBg, border: `1px solid ${signalBorder}`,
            borderRadius: 12, padding: "14px 18px",
          }}>
            <SignalBadge signal={signal} />
            {lastMetrics?.forward_pe && (
              <QuantTooltip term="Forward P/E">
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Forward P/E {lastMetrics.forward_pe}
                </span>
              </QuantTooltip>
            )}
          </div>
        )}

        {/* 지표 카드 4개 */}
        {cp && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {metricCards.map(({ label, value, color, tooltip }) => (
              <div key={label} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "14px 16px", textAlign: "center",
              }}>
                <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {tooltip ? (
                    <QuantTooltip term={tooltip}>{label}</QuantTooltip>
                  ) : label}
                </p>
                <p style={{ color, fontSize: 18, fontWeight: 800, margin: 0 }}>{String(value)}</p>
              </div>
            ))}
          </div>
        )}

        {/* 적정가 패널 */}
        {cp && lastMetrics && (
          <FairValuePanel
            currentPrice={cp}
            fairValuePe={lastMetrics.fair_value_pe ?? null}
            fairValueGraham={lastMetrics.fair_value_graham ?? null}
            fairValuePeg={lastMetrics.fair_value_peg ?? null}
            avgFairValue={lastMetrics.avg_fair_value ?? null}
          />
        )}

        {/* AI 분석 붙여넣기 */}
        <PasteAnalyzer
          ticker={ticker as string}
          targetPe={stock.target_pe ?? 30}
          onAnalyzed={handleAnalyzed}
        />

        {/* 분석 이력 */}
        <div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 14px" }}>
            분석 이력
          </p>
          <JournalTimeline entries={entries as any} />
        </div>

      </main>
    </div>
  );
}

export default function StockDetailPage() {
  return (
    <PasswordGate>
      <StockDetailContent />
    </PasswordGate>
  );
}
