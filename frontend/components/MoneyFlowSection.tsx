"use client";
import { MoneyFlowAsset, KoreaRates } from "@/types";

interface Props {
  data: {
    assets: MoneyFlowAsset[];
    rate_signal: { level: string; message: string };
    fed_rate: number;
    korea_rates?: KoreaRates;
  };
  korea_rates?: KoreaRates;
}

export default function MoneyFlowSection({ data, korea_rates }: Props) {
  const { assets, rate_signal, fed_rate } = data;
  const resolvedKoreaRates = korea_rates ?? data.korea_rates;
  const signalColor = rate_signal.level === "high" ? "var(--red)" : rate_signal.level === "low" ? "var(--green)" : "var(--gold)";
  const signalBg = rate_signal.level === "high" ? "var(--red-dim)" : rate_signal.level === "low" ? "var(--green-dim)" : "var(--gold-dim)";

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 금리 신호 배너 */}
      <div style={{
        background: signalBg,
        border: `1px solid ${signalColor}33`,
        borderRadius: 12, padding: "16px 24px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 28, width: 48, height: 48, borderRadius: 12,
          background: `${signalColor}22`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {rate_signal.level === "high" ? "🔴" : rate_signal.level === "low" ? "🟢" : "🟡"}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: signalColor, marginBottom: 4 }}>
            돈의 흐름 · Fed 기준금리 {fed_rate}%
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {rate_signal.message}
          </div>
        </div>
      </div>

      {/* 한국/미국 금리 비교 */}
      {resolvedKoreaRates && (
        <div style={{
          display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap",
        }}>
          <div style={{
            flex: 1, minWidth: 140, background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>🇰🇷 한국 기준금리</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {resolvedKoreaRates.base_rate != null ? `${resolvedKoreaRates.base_rate}%` : "—"}
            </div>
          </div>
          <div style={{
            flex: 1, minWidth: 140, background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>🇺🇸 미국 기준금리 (Fed)</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{fed_rate}%</div>
          </div>
          {resolvedKoreaRates.treasury_3y != null && (
            <div style={{
              flex: 1, minWidth: 140, background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 16px",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>🇰🇷 국고채 3년</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{resolvedKoreaRates.treasury_3y}%</div>
            </div>
          )}
        </div>
      )}

      {/* 자산 카드 그리드 (2~3열) */}
      <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {assets.map(asset => {
          const chg = asset.change_30d ?? 0;
          const isUp = chg >= 0;
          return (
            <div key={asset.name} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "18px 20px",
              borderTop: `3px solid ${asset.color}`,
              transition: "all 0.15s",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-light)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{asset.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{asset.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{asset.category}</div>
                  </div>
                </div>
                {chg !== 0 && (
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: isUp ? "var(--green)" : "var(--red)",
                    background: isUp ? "var(--green-dim)" : "var(--red-dim)",
                    borderRadius: 8, padding: "4px 10px",
                  }}>
                    {isUp ? "▲" : "▼"} {Math.abs(chg).toFixed(1)}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>{asset.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{asset.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
