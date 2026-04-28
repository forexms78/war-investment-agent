"use client";
import QuantTooltip from "./QuantTooltip";

interface Props {
  currentPrice: number;
  fairValuePe: number | null;
  fairValueGraham: number | null;
  fairValuePeg: number | null;
  avgFairValue: number | null;
}

function Row({
  label, tooltip, value, currentPrice,
}: {
  label: string; tooltip: string; value: number | null; currentPrice: number;
}) {
  if (!value) return (
    <div className="flex justify-between items-center py-2 border-b border-gray-800 text-sm">
      <QuantTooltip term={tooltip}><span className="text-gray-300">{label}</span></QuantTooltip>
      <span className="text-gray-600">N/A</span>
    </div>
  );
  const isOver = currentPrice > value;
  const diff = ((currentPrice - value) / value * 100).toFixed(1);
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-800 text-sm">
      <QuantTooltip term={tooltip}><span className="text-gray-300">{label}</span></QuantTooltip>
      <div className="text-right">
        <p className="text-green-400 font-bold">${value.toLocaleString()}</p>
        <p className={isOver ? "text-red-400 text-xs" : "text-green-400 text-xs"}>
          현재가 대비 {isOver ? "+" : ""}{diff}%
        </p>
      </div>
    </div>
  );
}

export default function FairValuePanel({
  currentPrice, fairValuePe, fairValueGraham, fairValuePeg, avgFairValue,
}: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-sm text-gray-400 mb-3">적정가 분석</h3>
      <Row label="P/E 기반" tooltip="Forward P/E" value={fairValuePe} currentPrice={currentPrice} />
      <Row label="Graham Number" tooltip="Graham Number" value={fairValueGraham} currentPrice={currentPrice} />
      <Row label="PEG 기반" tooltip="PEG" value={fairValuePeg} currentPrice={currentPrice} />
      {avgFairValue && (
        <div className="flex justify-between items-center pt-3 text-sm">
          <span className="text-gray-300 font-bold">평균 적정가</span>
          <div className="text-right">
            <p className="text-white font-bold text-base">${avgFairValue.toLocaleString()}</p>
            <p className={currentPrice > avgFairValue ? "text-red-400 text-xs" : "text-green-400 text-xs"}>
              현재가 프리미엄 {((currentPrice / avgFairValue - 1) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
