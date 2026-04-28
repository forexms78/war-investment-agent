"use client";
import Link from "next/link";
import SignalBadge from "./SignalBadge";

interface Props {
  ticker: string;
  market: string;
  name: string;
  currentPrice?: number;
  forwardPe?: number;
  signal?: string;
  lastDate?: string;
}

export default function StockCard({
  ticker, market, name, currentPrice, forwardPe, signal, lastDate,
}: Props) {
  return (
    <Link
      href={`/stocks/${ticker}`}
      className="block bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 transition"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-gray-500 text-xs">{ticker} · {market}</p>
          <p className="font-bold text-white">{name}</p>
        </div>
        {signal && <SignalBadge signal={signal} size="sm" />}
      </div>
      <div className="flex gap-4 text-sm">
        {currentPrice && <span className="text-white">${currentPrice.toLocaleString()}</span>}
        {forwardPe && <span className="text-yellow-400">P/E {forwardPe}</span>}
      </div>
      {lastDate && <p className="text-gray-600 text-xs mt-2">최근 기록: {lastDate}</p>}
    </Link>
  );
}
