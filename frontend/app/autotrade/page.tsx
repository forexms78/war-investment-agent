"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SignalBadge from "@/components/quant/SignalBadge";
import PasswordGate from "@/components/quant/PasswordGate";

interface Status {
  system_on: boolean;
  trades_today: number;
  total_invested: number;
  total_pnl_pct: number;
  holdings: Holding[];
}

interface Holding {
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  pnl_pct: number;
}

interface Trade {
  id: string;
  ticker: string;
  action: string;
  price: number;
  quantity: number;
  amount: number;
  reason: string;
  executed_at: string;
}

interface Signal {
  ticker: string;
  name: string;
  signal: string;
  current_price?: number;
  ma5?: number;
  ma20?: number;
  per?: number;
  reason?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

const REASON_LABEL: Record<string, string> = {
  signal_buy: "시그널 매수",
  stop_loss: "손절 자동 매도",
  take_profit: "익절",
};

function AutoTradeContent() {
  const [status, setStatus] = useState<Status | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/autotrade/status`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/autotrade/trades`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/autotrade/signals`).then((r) => r.json()).catch(() => []),
    ]).then(([s, t, sig]) => {
      setStatus(s);
      setTrades(Array.isArray(t) ? t : []);
      setSignals(Array.isArray(sig) ? sig : []);
      setLoading(false);
    });
  }, []);

  const systemOn = status?.system_on ?? false;
  const pnl = status?.total_pnl_pct ?? 0;
  const pnlColor = pnl >= 0 ? "var(--green)" : "var(--red)";

  const statCards = [
    {
      label: "시스템 상태",
      value: loading ? "..." : systemOn ? "실행 중" : "오프라인",
      color: loading ? "var(--text-muted)" : systemOn ? "var(--green)" : "var(--red)",
      dot: true,
    },
    {
      label: "오늘 체결",
      value: `${status?.trades_today ?? 0}건`,
      color: "var(--text-primary)",
      dot: false,
    },
    {
      label: "투자 중 금액",
      value: status?.total_invested ? `${Math.round(status.total_invested / 10000)}만원` : "-",
      color: "var(--accent)",
      dot: false,
    },
    {
      label: "오늘 수익률",
      value: status?.total_pnl_pct != null ? `${pnl > 0 ? "+" : ""}${pnl}%` : "-",
      color: pnlColor,
      dot: false,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)", fontFamily: "inherit" }}>

      {/* 헤더 */}
      <header style={{
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
          <nav style={{ display: "flex", gap: 4 }}>
            {[
              { href: "/quant", label: "리서치 저널", active: false },
              { href: "/autotrade", label: "자동매매", active: true },
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
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em" }}>자동매매 대시보드</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            KIS 한국투자증권 · MA5/MA20 골든크로스 신호 · 종목당 최대 20만원 · 손절 -8%
          </p>
        </div>

        {/* 상태 카드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {statCards.map(({ label, value, color, dot }) => (
            <div key={label} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, margin: "0 0 10px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {label}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {dot && (
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: color,
                    boxShadow: systemOn ? `0 0 6px ${color}` : "none",
                  }} />
                )}
                <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0 }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 리스크 설정 바 */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
        }}>
          <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>리스크 설정</span>
          {[
            { label: "종목당 최대", value: "20만원", color: "var(--gold)" },
            { label: "손절선", value: "-8%", color: "var(--red)" },
            { label: "PER 필터", value: "< 20", color: "var(--accent)" },
            { label: "신호", value: "MA5/MA20 골든크로스", color: "var(--text-secondary)" },
          ].map(({ label, value, color }) => (
            <span key={label} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {label} <strong style={{ color }}>{value}</strong>
            </span>
          ))}
          <span style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "3px 10px",
            borderRadius: 6, border: `1px solid ${systemOn ? "rgba(16,185,129,0.4)" : "var(--border)"}`,
            color: systemOn ? "var(--green)" : "var(--text-muted)",
            background: systemOn ? "var(--green-dim)" : "transparent",
          }}>
            {systemOn ? "ON" : "OFF"}
          </span>
        </div>

        {/* 유니버스 시그널 테이블 */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>유니버스 스캔</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 10 }}>KOSPI 대형주 20종목</span>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>MA5 / MA20 · PER 필터</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {[
                    { label: "종목", align: "left" },
                    { label: "현재가", align: "right" },
                    { label: "MA5", align: "right" },
                    { label: "MA20", align: "right" },
                    { label: "PER", align: "right" },
                    { label: "시그널", align: "center" },
                  ].map(({ label, align }) => (
                    <th key={label} style={{
                      padding: "11px 20px", color: "var(--text-muted)", fontSize: 11,
                      fontWeight: 500, textAlign: align as "left" | "right" | "center",
                      letterSpacing: "0.03em",
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      불러오는 중...
                    </td>
                  </tr>
                )}
                {!loading && signals.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      KIS API 연결 확인 필요
                    </td>
                  </tr>
                )}
                {signals.map((s) => (
                  <tr key={s.ticker} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--card-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 20px" }}>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: 0 }}>{s.name}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>{s.ticker}</p>
                    </td>
                    <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--text-primary)" }}>
                      {s.current_price ? `${s.current_price.toLocaleString()}원` : "-"}
                    </td>
                    <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--accent)" }}>
                      {s.ma5 ? s.ma5.toLocaleString() : "-"}
                    </td>
                    <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--purple)" }}>
                      {s.ma20 ? s.ma20.toLocaleString() : "-"}
                    </td>
                    <td style={{ padding: "13px 20px", textAlign: "right", color: "var(--gold)" }}>
                      {s.per?.toFixed(1) ?? "-"}
                    </td>
                    <td style={{ padding: "13px 20px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <SignalBadge signal={s.signal} size="sm" />
                        {s.reason && (
                          <span style={{ color: "var(--text-muted)", fontSize: 10, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.reason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 보유 종목 */}
        {(status?.holdings?.length ?? 0) > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>보유 종목</span>
            </div>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["종목", "수량", "평균단가", "현재가", "수익률"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 20px", color: "var(--text-muted)", fontSize: 11, fontWeight: 500,
                      textAlign: i === 0 ? "left" : "right",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status!.holdings.map(h => {
                  const hColor = h.pnl_pct >= 0 ? "var(--green)" : "var(--red)";
                  return (
                    <tr key={h.ticker} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 20px" }}>
                        <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: 0 }}>{h.name || h.ticker}</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "2px 0 0" }}>{h.ticker}</p>
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: "var(--text-primary)" }}>{h.quantity}주</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: "var(--text-secondary)" }}>{h.avg_price.toLocaleString()}원</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: "var(--text-primary)" }}>{h.current_price.toLocaleString()}원</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: hColor, fontWeight: 700 }}>
                        {h.pnl_pct > 0 ? "+" : ""}{h.pnl_pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 체결 이력 */}
        <div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 14px" }}>
            체결 이력
          </p>
          {trades.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>체결 내역이 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderLeft: "2px solid var(--border)", paddingLeft: 20 }}>
              {trades.map((t) => (
                <div key={t.id} style={{ paddingBottom: 18, paddingTop: 2 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "0 0 6px" }}>
                    {new Date(t.executed_at).toLocaleString("ko-KR")}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                      background: t.action === "buy" ? "var(--green-dim)" : "var(--red-dim)",
                      color: t.action === "buy" ? "var(--green)" : "var(--red)",
                      border: `1px solid ${t.action === "buy" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                    }}>
                      {t.action === "buy" ? "매수" : "매도"}
                    </span>
                    <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{t.ticker}</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {t.price.toLocaleString()}원 × {t.quantity}주
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: "auto" }}>
                      {REASON_LABEL[t.reason] || t.reason}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default function AutoTradePage() {
  return (
    <PasswordGate>
      <AutoTradeContent />
    </PasswordGate>
  );
}
