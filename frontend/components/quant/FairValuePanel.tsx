"use client";
import QuantTooltip from "./QuantTooltip";

interface Props {
  currentPrice: number;
  fairValuePe: number | null;
  fairValueGraham: number | null;
  fairValuePeg: number | null;
  avgFairValue: number | null;
}

function Row({ label, tooltip, value, currentPrice }: {
  label: string; tooltip: string; value: number | null; currentPrice: number;
}) {
  if (!value) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <QuantTooltip term={tooltip}><span style={{ color: "var(--text-secondary)" }}>{label}</span></QuantTooltip>
      <span style={{ color: "var(--text-muted)" }}>N/A</span>
    </div>
  );
  const isOver = currentPrice > value;
  const diff = ((currentPrice - value) / value * 100).toFixed(1);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <QuantTooltip term={tooltip}><span style={{ color: "var(--text-secondary)" }}>{label}</span></QuantTooltip>
      <div style={{ textAlign: "right" }}>
        <p style={{ color: "var(--green)", fontWeight: 700, margin: 0 }}>${value.toLocaleString()}</p>
        <p style={{ color: isOver ? "var(--red)" : "var(--green)", fontSize: 11, margin: "2px 0 0" }}>
          현재가 대비 {isOver ? "+" : ""}{diff}%
        </p>
      </div>
    </div>
  );
}

export default function FairValuePanel({ currentPrice, fairValuePe, fairValueGraham, fairValuePeg, avgFairValue }: Props) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 4px" }}>
        적정가 분석
      </p>
      <Row label="P/E 기반" tooltip="Forward P/E" value={fairValuePe} currentPrice={currentPrice} />
      <Row label="Graham Number" tooltip="Graham Number" value={fairValueGraham} currentPrice={currentPrice} />
      <Row label="PEG 기반" tooltip="PEG" value={fairValuePeg} currentPrice={currentPrice} />
      {avgFairValue && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, fontSize: 13 }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>평균 적정가</span>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 16, margin: 0 }}>
              ${avgFairValue.toLocaleString()}
            </p>
            <p style={{ color: currentPrice > avgFairValue ? "var(--red)" : "var(--green)", fontSize: 11, margin: "2px 0 0" }}>
              현재가 프리미엄 {((currentPrice / avgFairValue - 1) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
