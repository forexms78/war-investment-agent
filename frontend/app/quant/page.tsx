"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PasswordGate from "@/components/quant/PasswordGate";
import StockCard from "@/components/quant/StockCard";

interface Stock {
  id: string;
  ticker: string;
  market: string;
  name: string;
  current_price?: number;
  forward_eps?: number;
  target_pe?: number;
}

interface Journal {
  ticker: string;
  forward_pe?: number;
  signal?: string;
  date: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

function QuantResearchJournal() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [journals, setJournals] = useState<Record<string, Journal>>({});
  const [loading, setLoading] = useState(true);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch(`${API}/quant/stocks`).then((r) => r.json());
    const list: Stock[] = Array.isArray(res) ? res : [];
    setStocks(list);

    const entries = await Promise.all(
      list.map((s) =>
        fetch(`${API}/quant/journal/${s.ticker}`)
          .then((r) => r.json())
          .then((j) => ({ ticker: s.ticker, entry: Array.isArray(j) ? j[0] : null }))
      )
    );
    const map: Record<string, Journal> = {};
    for (const { ticker, entry } of entries) {
      if (entry) map[ticker] = entry;
    }
    setJournals(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicker.trim()) return;
    setAdding(true);
    await fetch(`${API}/quant/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: newTicker.trim().toUpperCase(), market: "US", name: newTicker.trim().toUpperCase() }),
    });
    setNewTicker("");
    await load();
    setAdding(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
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

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">리서치 저널</h1>
          <p className="text-gray-500 text-sm mt-1">AI 분석 텍스트를 붙여넣어 퀀트 지표를 계산하고 기록합니다.</p>
        </div>

        <form onSubmit={addStock} className="flex gap-2">
          <input
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            placeholder="종목 티커 추가 (예: AAPL, 005930)"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {adding ? "추가 중..." : "추가"}
          </button>
        </form>

        {loading ? (
          <p className="text-gray-500 text-center py-12">로딩 중...</p>
        ) : stocks.length === 0 ? (
          <p className="text-gray-600 text-center py-12">추적 중인 종목이 없습니다. 티커를 추가해보세요.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {stocks.map((s) => {
              const j = journals[s.ticker];
              return (
                <StockCard
                  key={s.ticker}
                  ticker={s.ticker}
                  market={s.market}
                  name={s.name}
                  currentPrice={s.current_price}
                  forwardPe={j?.forward_pe}
                  signal={j?.signal}
                  lastDate={j?.date}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function QuantPage() {
  return (
    <PasswordGate>
      <QuantResearchJournal />
    </PasswordGate>
  );
}
