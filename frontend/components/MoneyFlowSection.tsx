"use client";
import { MoneyFlowAsset } from "@/types";

interface Props {
  data: {
    assets: MoneyFlowAsset[];
    rate_signal: { level: string; message: string };
    fed_rate: number;
  };
}

export default function MoneyFlowSection({ data }: Props) {
  const { assets, rate_signal, fed_rate } = data;
  const signalColor = rate_signal.level === "high" ? "var(--red)" : rate_signal.level === "low" ? "var(--green)" : "var(--gold)";
  const signalBg = rate_signal.level === "high" ? "var(--red-dim)" : rate_signal.level === "low" ? "var(--green-dim)" : "var(--gold-dim)";

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 타이틀 + 신호 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>돈의 흐름</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Fed 기준금리 {fed_rate}%</span>
        </div>
        <div style={{
          fontSize: 12, color: signalColor, background: signalBg,
          border: `1px solid ${signalColor}33`,
          borderRadius: 8, padding: "6px 14px", maxWidth: 480, lineHeight: 1.5,
        }}>
          {rate_signal.message}
        </div>
      </div>

      {/* 자산 카드 그리드 */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {assets.map(asset => {
          const chg = asset.change_30d ?? 0;
          const isUp = chg >= 0;
          return (
            <div key={asset.name} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "14px 16px",
              flexShrink: 0, minWidth: 156,
              borderTop: `2px solid ${asset.color}`,
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>{asset.icon} {asset.category}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, color: "var(--text-primary)" }}>{asset.value}</div>
              {chg !== 0 && (
                <div style={{ fontSize: 11, color: isUp ? "var(--green)" : "var(--red)", fontWeight: 600, marginBottom: 6 }}>
                  {isUp ? "▲" : "▼"} {Math.abs(chg).toFixed(1)}% (30일)
                </div>
              )}
              <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{asset.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
