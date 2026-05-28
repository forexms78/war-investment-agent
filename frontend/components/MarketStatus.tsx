"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type StatusKind = "regular" | "ext" | "closed";
type Segment = { label: string; kind: Exclude<StatusKind, "closed">; start: number; end: number };

const KR_SEGMENTS: Segment[] = [
  { label: "장전 동시호가", kind: "ext", start: 8 * 60 + 30, end: 9 * 60 },        // 08:30~09:00
  { label: "정규장", kind: "regular", start: 9 * 60, end: 15 * 60 + 30 },          // 09:00~15:30
  { label: "장후 시간외", kind: "ext", start: 15 * 60 + 40, end: 16 * 60 },         // 15:40~16:00
  { label: "시간외 단일가", kind: "ext", start: 16 * 60, end: 18 * 60 },            // 16:00~18:00
];

// 미국은 ET(현지) 기준 — Intl이 EDT/EST(서머타임)를 자동 처리
const US_SEGMENTS: Segment[] = [
  { label: "프리마켓", kind: "ext", start: 4 * 60, end: 9 * 60 + 30 },             // 04:00~09:30 ET
  { label: "정규장", kind: "regular", start: 9 * 60 + 30, end: 16 * 60 },          // 09:30~16:00 ET
  { label: "애프터마켓", kind: "ext", start: 16 * 60, end: 20 * 60 },               // 16:00~20:00 ET
];

const KR_SCHEDULE = [
  { label: "장전 동시호가", time: "08:30 ~ 09:00", note: "시가 결정", key: "장전 동시호가" },
  { label: "프리마켓(장전 시간외)", time: "08:30 ~ 08:40", note: "전일 종가", key: "" },
  { label: "정규장", time: "09:00 ~ 15:30", note: "메인 거래", key: "정규장" },
  { label: "장후 시간외(애프터)", time: "15:40 ~ 16:00", note: "당일 종가", key: "장후 시간외" },
  { label: "시간외 단일가", time: "16:00 ~ 18:00", note: "10분 단위 · ±10%", key: "시간외 단일가" },
];

const US_SCHEDULE_KST = {
  EDT: [
    { label: "프리마켓", time: "17:00 ~ 22:30", key: "프리마켓" },
    { label: "정규장", time: "22:30 ~ 05:00", key: "정규장" },
    { label: "애프터마켓", time: "05:00 ~ 09:00", key: "애프터마켓" },
  ],
  EST: [
    { label: "프리마켓", time: "18:00 ~ 23:30", key: "프리마켓" },
    { label: "정규장", time: "23:30 ~ 06:00", key: "정규장" },
    { label: "애프터마켓", time: "06:00 ~ 10:00", key: "애프터마켓" },
  ],
};

const POPOVER_WIDTH = 320;

type Zoned = { minutes: number; dow: number };
function zoned(date: Date, tz: string): Zoned {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { minutes: hour * 60 + minute, dow: map[get("weekday")] ?? 0 };
}

function usTzAbbr(date: Date): "EDT" | "EST" {
  const v = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", timeZoneName: "short",
  }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value;
  return v === "EDT" ? "EDT" : "EST";
}

function fmtClock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function fmtRemain(min: number): string {
  if (min >= 1440) {
    const d = Math.floor(min / 1440);
    const h = Math.round((min % 1440) / 60);
    return h > 0 ? `${d}일 ${h}시간` : `${d}일`;
  }
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  }
  return `${min}분`;
}

function nextOpenRemain(minutes: number, dow: number, segs: Segment[]): number {
  const starts = segs.map((s) => s.start).sort((a, b) => a - b);
  const weekend = dow === 0 || dow === 6;
  if (!weekend) {
    const later = starts.find((s) => s > minutes);
    if (later !== undefined) return later - minutes;
  }
  let days = 1;
  let wd = (dow + 1) % 7;
  while (wd === 0 || wd === 6) { days++; wd = (wd + 1) % 7; }
  return days * 1440 + starts[0] - minutes;
}

type MarketState = {
  label: string;
  kind: StatusKind;
  remainMin: number;
  kstClock: string; // open 또는 close 시각(KST)
  isOpen: boolean;
};

function computeMarket(now: Date, tz: string, segs: Segment[]): MarketState {
  const { minutes, dow } = zoned(now, tz);
  const kst = zoned(now, "Asia/Seoul");
  const weekend = dow === 0 || dow === 6;
  if (!weekend) {
    for (const s of segs) {
      if (minutes >= s.start && minutes < s.end) {
        const remain = s.end - minutes;
        return { label: s.label, kind: s.kind, remainMin: remain, kstClock: fmtClock(kst.minutes + remain), isOpen: true };
      }
    }
  }
  const remain = nextOpenRemain(minutes, dow, segs);
  return { label: "마감", kind: "closed", remainMin: remain, kstClock: fmtClock(kst.minutes + remain), isOpen: false };
}

const DOT_COLOR: Record<StatusKind, string> = {
  regular: "var(--green)",
  ext: "var(--accent)",
  closed: "var(--text-muted)",
};

export default function MarketStatus() {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 20000);
    const t = setTimeout(tick, 0);
    return () => { clearInterval(id); clearTimeout(t); };
  }, []);

  const open = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - POPOVER_WIDTH - 12;
    setPos({
      top: r.bottom + window.scrollY + 8,
      left: Math.max(12, Math.min(r.left + window.scrollX, maxLeft)),
    });
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPos(null), 140);
  }, []);

  const kr = now ? computeMarket(now, "Asia/Seoul", KR_SEGMENTS) : null;
  const us = now ? computeMarket(now, "America/New_York", US_SEGMENTS) : null;
  const usDst = now ? usTzAbbr(now) : "EDT";

  return (
    <span
      ref={triggerRef}
      style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0, cursor: "default" }}
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      <Chip region="한국" state={kr} />
      <span style={{ width: 1, height: 12, background: "var(--border)" }} />
      <Chip region="미국" state={us} />

      {pos && createPortal(
        <div
          onMouseEnter={open}
          onMouseLeave={scheduleClose}
          style={{
            position: "absolute", top: pos.top, left: pos.left,
            width: POPOVER_WIDTH, maxWidth: "calc(100vw - 24px)",
            maxHeight: "min(74vh, 560px)", overflowY: "auto",
            background: "var(--bg-elevated)", color: "var(--text-secondary)",
            fontSize: 12, lineHeight: 1.6, padding: "14px 16px", borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)", border: "1px solid var(--border-strong)",
            zIndex: 99999,
          }}
        >
          <MarketBlock region="한국 (KRX)" state={kr} schedule={KR_SCHEDULE} extraTz="" />
          <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
          <MarketBlock
            region="미국 (NASDAQ / NYSE)"
            state={us}
            schedule={US_SCHEDULE_KST[usDst]}
            extraTz={usDst === "EDT" ? "서머타임 적용중 (EDT) · KST 환산" : "표준시 (EST) · KST 환산"}
          />
          <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-muted)" }}>
            현재 한국시간 기준 · 20초마다 자동 갱신 · 공휴일은 미반영
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}

function Chip({ region, state }: { region: string; state: MarketState | null }) {
  const kind = state?.kind ?? "closed";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: DOT_COLOR[kind], flexShrink: 0,
        boxShadow: kind === "regular" ? `0 0 8px ${DOT_COLOR.regular}` : "none",
        animation: kind === "regular" ? "pulseLive 2.4s ease-in-out infinite" : "none",
      }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
        {region} <span style={{ color: kind === "closed" ? "var(--text-muted)" : "var(--text-primary)" }}>{state ? state.label : "—"}</span>
      </span>
    </span>
  );
}

function MarketBlock({
  region, state, schedule, extraTz,
}: {
  region: string;
  state: MarketState | null;
  schedule: { label: string; time: string; note?: string; key: string }[];
  extraTz: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>{region}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{extraTz}</span>
      </div>

      {state && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
          padding: "6px 10px", borderRadius: 8,
          background: state.isOpen ? "var(--accent-dim)" : "var(--bg-2)",
          border: `1px solid ${state.isOpen ? "var(--accent-glow)" : "var(--border)"}`,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: DOT_COLOR[state.kind], flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{state.label}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            {state.isOpen
              ? `${state.kstClock} 마감 · ${fmtRemain(state.remainMin)} 남음`
              : `${state.kstClock} 개장 · ${fmtRemain(state.remainMin)} 후`}
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {schedule.map((r) => {
          const active = !!state?.isOpen && r.key !== "" && r.key === state.label;
          return (
            <div key={r.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{
                minWidth: 116, fontWeight: active ? 800 : 600,
                color: active ? "var(--accent)" : "var(--text-primary)",
              }}>
                {active ? "▸ " : ""}{r.label}
              </span>
              <span style={{ minWidth: 88, fontVariantNumeric: "tabular-nums", color: active ? "var(--accent)" : "var(--text-secondary)" }}>{r.time}</span>
              {r.note && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{r.note}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
