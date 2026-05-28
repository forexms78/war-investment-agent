"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type Row = { label: string; time: string; note?: string };

const KR_ROWS: Row[] = [
  { label: "장전 동시호가", time: "08:30 ~ 09:00", note: "시가 결정" },
  { label: "프리마켓(장전 시간외)", time: "08:30 ~ 08:40", note: "전일 종가 기준" },
  { label: "정규장(본장)", time: "09:00 ~ 15:30", note: "메인 거래" },
  { label: "애프터(장후 시간외)", time: "15:40 ~ 16:00", note: "당일 종가 기준" },
  { label: "시간외 단일가", time: "16:00 ~ 18:00", note: "10분 단위 · ±10%" },
];

const US_DST_ROWS: Row[] = [
  { label: "프리마켓", time: "17:00 ~ 22:30" },
  { label: "정규장", time: "22:30 ~ 05:00" },
  { label: "애프터마켓", time: "05:00 ~ 09:00" },
];

const US_STD_ROWS: Row[] = [
  { label: "프리마켓", time: "18:00 ~ 23:30" },
  { label: "정규장", time: "23:30 ~ 06:00" },
  { label: "애프터마켓", time: "06:00 ~ 10:00" },
];

const POPOVER_WIDTH = 380;

export default function MarketHoursHelp() {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const isOpen = pos !== null;

  const toggle = useCallback(() => {
    if (!triggerRef.current) return;
    setPos((prev) => {
      if (prev) return null;
      const r = triggerRef.current!.getBoundingClientRect();
      const maxLeft = window.innerWidth - POPOVER_WIDTH - 12;
      return {
        top: r.bottom + window.scrollY + 8,
        left: Math.max(12, Math.min(r.left + window.scrollX, maxLeft)),
      };
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && popRef.current?.contains(e.target)) return;
      setPos(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen]);

  return (
    <span
      ref={triggerRef}
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      <button
        type="button"
        aria-label="장 운영 시간 도움말"
        aria-expanded={isOpen}
        onClick={toggle}
        style={{
          background: isOpen ? "var(--accent-dim)" : "var(--bg-2)",
          border: `1px solid ${isOpen ? "var(--accent-glow)" : "var(--border)"}`,
          borderRadius: 999, padding: "5px 10px", cursor: "pointer",
          fontSize: 10, fontWeight: 700,
          color: isOpen ? "var(--accent)" : "var(--text-secondary)",
          transition: "all 0.15s", flexShrink: 0, letterSpacing: "0.06em",
        }}
      >
        ? 도움말
      </button>

      {pos && createPortal(
        <div
          ref={popRef}
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            width: POPOVER_WIDTH,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "min(72vh, 540px)",
            overflowY: "auto",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            fontSize: 12,
            lineHeight: 1.6,
            padding: "14px 16px",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            border: "1px solid var(--border-strong)",
            zIndex: 99999,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10, letterSpacing: "-0.01em" }}>
            장 운영 시간 안내
          </div>

          <Section title="한국 (KRX) · 한국시간" rows={KR_ROWS} />

          <SubLabel>미국 (NASDAQ / NYSE) · 한국시간 환산</SubLabel>
          <MiniTitle>서머타임 적용 (약 3~11월)</MiniTitle>
          <Section rows={US_DST_ROWS} compact />
          <MiniTitle>서머타임 미적용 (약 11~3월)</MiniTitle>
          <Section rows={US_STD_ROWS} compact />

          <SubLabel>용어</SubLabel>
          <ul style={listStyle}>
            <li>프장 = 프리마켓 · 본장 = 정규장 · 애프터 = 애프터마켓</li>
            <li>동시호가 = 주문을 모아 한 번에 체결</li>
            <li>시간외 단일가 = 장 종료 후 추가 거래</li>
          </ul>

          <SubLabel>알아두기</SubLabel>
          <ul style={listStyle}>
            <li>프리/애프터는 거래량이 적고 변동성이 큼 → 실적·CPI·FOMC 등 뉴스를 선반영</li>
            <li>실질 비용은 보이는 수수료보다 호가가 얇아 생기는 &lsquo;불리한 체결가&rsquo;인 경우가 많음</li>
            <li>초보자는 거래량 많고 안정적인 정규장 위주 권장</li>
          </ul>
        </div>,
        document.body
      )}
    </span>
  );
}

const listStyle: React.CSSProperties = {
  margin: "0 0 6px", paddingLeft: 16, color: "var(--text-secondary)",
};

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, color: "var(--accent)",
      letterSpacing: "0.04em", margin: "12px 0 6px",
    }}>
      {children}
    </div>
  );
}

function MiniTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", margin: "6px 0 3px" }}>
      {children}
    </div>
  );
}

function Section({ title, rows, compact }: { title?: string; rows: Row[]; compact?: boolean }) {
  return (
    <>
      {title && <SubLabel>{title}</SubLabel>}
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 2 : 4 }}>
        {rows.map((r) => (
          <div key={r.label + r.time} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ minWidth: 132, color: "var(--text-primary)", fontWeight: 600 }}>{r.label}</span>
            <span style={{ minWidth: 92, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{r.time}</span>
            {r.note && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{r.note}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
