"use client";
import { useState, useEffect, ReactNode } from "react";

const SESSION_KEY = "quant_unlocked";
const PASSWORD = process.env.NEXT_PUBLIC_QUANT_PASSWORD ?? "whalyx2024";

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setInput("");
    }
  }

  if (!mounted) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-blue-400 font-bold text-lg">Whalyx Quant</p>
          <p className="text-gray-500 text-sm mt-1">접근하려면 비밀번호를 입력하세요</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder="비밀번호"
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-xs text-center">비밀번호가 틀렸습니다</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            입장
          </button>
        </form>
      </div>
    </div>
  );
}
