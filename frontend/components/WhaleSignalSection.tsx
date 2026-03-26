"use client";
import { WhaleSignal } from "@/types";

type Tab = "signal" | "stocks" | "crypto" | "realestate" | "commodities";

const ASSET_TAB_MAP: Record<string, Tab | null> = {
  "주식":   "stocks",
  "코인":   "crypto",
  "부동산": "realestate",
  "금/광물": "commodities",
  "채권":   null,
};

export default function WhaleSignalSection({ data, onTabChange }: { data: WhaleSignal; onTabChange?: (tab: Tab) => void }) {
  return (
    <div>
      {/* 메인 헤드라인 배너 */}
      <div style={{
        background: "linear-gradient(135deg, rgba(91,158,201,0.15) 0%, rgba(91,158,201,0.05) 100%)",
        border: "1px solid rgba(91,158,201,0.3)",
        borderRadius: 16, padding: "28px 32px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          🐋 Whale Signal — 거대한 돈의 방향
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, marginBottom: 12 }}>
          {data.headline}
        </div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 720 }}>
          {data.ai_insight}
        </p>
        <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-muted)" }}>
          Fed 기준금리 {data.fed_rate}% · {data.updated_at ? new Date(data.updated_at).toLocaleString("ko-KR") : ""} 업데이트
        </div>
      </div>

      {/* 자산군별 신호 카드 */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>자산군 투자 신호</div>
      <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 32 }}>
        {data.signals.map((s) => {
          const targetTab = ASSET_TAB_MAP[s.asset];
          return (
          <div key={s.asset} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "18px 20px",
            borderLeft: `4px solid ${s.color}`,
            transition: "all 0.15s",
            cursor: targetTab ? "pointer" : "default",
          }}
            onClick={() => targetTab && onTabChange?.(targetTab)}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--card)"; }}
          >
            {/* 자산명 + 뱃지 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{s.asset}</span>
                {targetTab && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
                )}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 20,
                color: s.color,
                background: `${s.color}1a`,
                border: `1px solid ${s.color}55`,
                letterSpacing: "0.04em",
              }}>
                {s.badge ?? s.label}
              </span>
            </div>

            {/* 점수 바 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                <span>{s.label === "Super Sell" ? "매도 압력" : "투자 매력도"}</span>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.score}/100</span>
              </div>
              <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                {s.label === "Super Sell" ? (
                  <>
                    <div style={{ flex: s.score }} />
                    <div style={{ flex: 100 - s.score, background: s.color, borderRadius: 3, transition: "flex 0.6s ease" }} />
                  </>
                ) : (
                  <div style={{ height: "100%", width: `${s.score}%`, background: s.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                )}
              </div>
            </div>

            {/* Super Sell: 매도 경고 종목 */}
            {s.label === "Super Sell" && s.sell_warns && s.sell_warns.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 6, fontWeight: 600 }}>보유 중이라면 매도 검토</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.sell_warns.map(w => (
                    <span key={w} style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 6,
                      background: "rgba(239,68,68,0.1)", color: "#ef4444",
                      border: "1px solid rgba(239,68,68,0.3)",
                    }}>
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 일반 추천 종목 (SS 제외) */}
            {s.label !== "Super Sell" && s.picks && s.picks.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>추천 종목/ETF</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.picks.slice(0, 3).map(p => (
                    <span key={p} style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 6,
                      background: "var(--border)", color: "var(--text-secondary)",
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
        })}
      </div>
    </div>
  );
}
