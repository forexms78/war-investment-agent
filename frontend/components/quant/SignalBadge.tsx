"use client";

interface Props {
  signal: "buy" | "hold" | "sell" | string;
  size?: "sm" | "md";
}

const CONFIG = {
  buy: { label: "매수", bg: "bg-green-500/20 border-green-500", text: "text-green-400" },
  hold: { label: "보류", bg: "bg-yellow-500/20 border-yellow-500", text: "text-yellow-400" },
  sell: { label: "매도", bg: "bg-red-500/20 border-red-500", text: "text-red-400" },
};

export default function SignalBadge({ signal, size = "md" }: Props) {
  const cfg = CONFIG[signal as keyof typeof CONFIG] || CONFIG.hold;
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span className={`border rounded font-bold ${cfg.bg} ${cfg.text} ${padding}`}>
      {cfg.label}
    </span>
  );
}
