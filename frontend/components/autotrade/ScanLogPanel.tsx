"use client";
import { useEffect, useState } from "react";

interface ScanLogIndicators {
  current_price?: number;
  ma5?: number;
  ma20?: number;
  rsi?: number;
  per?: number;
  pbr?: number;
  macd_ok?: boolean;
  vol_ok?: boolean;
  mtf_ok?: boolean;
}

interface ScanLogEntry {
  ticker: string;
  name: string;
  market: string;
  regime?: string;
  signal: string;
  reason: string;
  stage: string;
  indicators?: ScanLogIndicators;
}

interface ScanLog {
  scan_at: string | null;
  status: string;
  summary: string;
  regime?: string | null;
  kr_open?: boolean;
  us_open?: boolean;
  cash_kr?: number;
  cash_usd?: number;
  pos_mult?: number;
  held_tickers?: string[];
  logs: ScanLogEntry[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

const STAGE_COLOR: Record<string, string> = {
  executed:         "var(--green)",
  signal_calc:      "var(--text-muted)",
  financial_filter: "#f59e0b",
  dart_block:       "var(--red)",
  news_block:       "var(--red)",
  market_halt:      "var(--red)",
  low_cash:         "#f59e0b",
  position_limit:   "var(--text-muted)",
  already_held:     "#3b82f6",
  sector_filter:    "#a855f7",
  duplicate_check:  "var(--text-muted)",
  qty_zero:         "#f59e0b",
  cash_error:       "var(--red)",
  error:            "var(--red)",
};

const STAGE_LABEL: Record<string, string> = {
  executed:         "체결",
  signal_calc:      "시그널",
  financial_filter: "재무필터",
  dart_block:       "DART차단",
  news_block:       "뉴스차단",
  market_halt:      "시장중단",
  low_cash:         "잔고부족",
  position_limit:   "포지션한도",
  already_held:     "보유중",
  sector_filter:    "섹터한도",
  duplicate_check:  "당일중복",
  qty_zero:         "수량0",
  cash_error:       "잔고오류",
  error:            "오류",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  no_data:        { label: "스캔 대기 중",       color: "var(--text-muted)" },
  skipped:        { label: "장 시간 외",         color: "var(--text-muted)" },
  halted:         { label: "매매 중단",          color: "var(--red)" },
  force_close_kr: { label: "KR 강제 청산",       color: "#f59e0b" },
  force_close_us: { label: "US 강제 청산",       color: "#f59e0b" },
  position_full:  { label: "포지션 한도 도달",   color: "#3b82f6" },
  completed:      { label: "스캔 완료",          color: "var(--green)" },
  error:          { label: "오류",               color: "var(--red)" },
  running:        { label: "스캔 중",            color: "var(--accent)" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function ScanLogPanel() {
  const [log, setLog]         = useState<ScanLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "executed" | "rejected">("all");
  const [refreshAt, setRefreshAt] = useState<Date | null>(null);

  async function fetchScanLog() {
    try {
      const res = await fetch(`${API}/autotrade/scan-logs`);
      const data = await res.json();
      setLog(data);
      setRefreshAt(new Date());
    } catch {
      setLog({ scan_at: null, status: "error", summary: "스캔 로그 조회 실패", logs: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchScanLog();
    const t = setInterval(fetchScanLog, 60000);
    return () => clearInterval(t);
  }, []);

  if (loading && !log) {
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>스캔 로그 로딩 중...</div>
      </div>
    );
  }

  if (!log) return null;

  const status = STATUS_LABEL[log.status] || { label: log.status, color: "var(--text-muted)" };
  const filtered = (log.logs || []).filter(l => {
    if (filter === "executed") return l.signal === "executed_buy";
    if (filter === "rejected") return l.signal !== "executed_buy" && l.signal !== "buy";
    return true;
  });

  const executedCount = (log.logs || []).filter(l => l.signal === "executed_buy").length;
  const rejectedCount = (log.logs || []).length - executedCount;

  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <header style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>스캔 로그</h2>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              직전 자동매매 스캔 결과 · 60초마다 자동 갱신
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); fetchScanLog(); }}
            style={{
              padding: "6px 12px", fontSize: 12, fontWeight: 500,
              background: "var(--card-hover)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", fontSize: 12 }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>상태: </span>
            <span style={{ color: status.color, fontWeight: 600 }}>{status.label}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>스캔 시각: </span>
            <span style={{ color: "var(--text-primary)" }}>{formatTime(log.scan_at)}</span>
          </div>
          {log.regime && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>국면: </span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{log.regime}</span>
            </div>
          )}
          {log.cash_kr != null && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>KR 잔고: </span>
              <span style={{ color: "var(--text-primary)" }}>{log.cash_kr.toLocaleString()}원</span>
            </div>
          )}
          {log.cash_usd != null && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>US 잔고: </span>
              <span style={{ color: "var(--text-primary)" }}>${log.cash_usd.toLocaleString()}</span>
            </div>
          )}
          {refreshAt && (
            <div style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}>
              조회: {refreshAt.toLocaleTimeString("ko-KR")}
            </div>
          )}
        </div>

        {log.summary && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--bg)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)" }}>
            {log.summary}
          </div>
        )}
      </header>

      {(log.logs || []).length > 0 && (
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 6 }}>
          {[
            { id: "all", label: `전체 ${log.logs.length}` },
            { id: "executed", label: `매수 ${executedCount}` },
            { id: "rejected", label: `거절 ${rejectedCount}` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as "all" | "executed" | "rejected")}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 500,
                background: filter === t.id ? "var(--accent)" : "transparent",
                color: filter === t.id ? "#fff" : "var(--text-primary)",
                border: filter === t.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: 6, cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ maxHeight: 600, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {(log.logs || []).length === 0 ? "스캔 로그가 없습니다" : "필터 조건에 맞는 항목이 없습니다"}
          </div>
        ) : (
          filtered.map((entry, i) => {
            const stageColor = STAGE_COLOR[entry.stage] || "var(--text-muted)";
            const stageLabel = STAGE_LABEL[entry.stage] || entry.stage;
            const ind = entry.indicators || {};
            return (
              <div key={`${entry.ticker}-${i}`} style={{
                padding: "12px 20px", borderBottom: "1px solid var(--border)",
                background: entry.signal === "executed_buy" ? "rgba(16, 185, 129, 0.06)" : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "3px 8px", fontSize: 10, fontWeight: 700, borderRadius: 4,
                    background: stageColor, color: "#fff",
                  }}>
                    {stageLabel}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{entry.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{entry.ticker} · {entry.market}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-primary)" }}>{entry.reason}</span>
                </div>
                {(ind.current_price || ind.rsi || ind.per || ind.ma5) && (
                  <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--text-muted)" }}>
                    {ind.current_price != null && <span>현재가 {ind.current_price.toLocaleString()}</span>}
                    {ind.ma5 != null && ind.ma20 != null && <span>MA5/20: {ind.ma5.toLocaleString()} / {ind.ma20.toLocaleString()}</span>}
                    {ind.rsi != null && <span>RSI {ind.rsi}</span>}
                    {ind.per != null && <span>PER {ind.per}</span>}
                    {ind.pbr != null && <span>PBR {ind.pbr}</span>}
                    {ind.macd_ok != null && <span style={{ color: ind.macd_ok ? "var(--green)" : "var(--red)" }}>MACD {ind.macd_ok ? "OK" : "X"}</span>}
                    {ind.vol_ok != null && <span style={{ color: ind.vol_ok ? "var(--green)" : "var(--red)" }}>거래량 {ind.vol_ok ? "OK" : "X"}</span>}
                    {ind.mtf_ok != null && <span style={{ color: ind.mtf_ok ? "var(--green)" : "var(--red)" }}>MTF {ind.mtf_ok ? "OK" : "X"}</span>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
