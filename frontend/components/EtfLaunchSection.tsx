"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EtfLaunch, EtfLaunchDetail, EtfLaunchListResponse, EtfLaunchStatus,
} from "@/types";
import SkeletonCard from "@/components/SkeletonCard";
import { useT } from "@/contexts/LanguageContext";

const API = process.env.NEXT_PUBLIC_API_URL;

type Market = "kr" | "us";

// 운용사 칩 색상 (대표 브랜드만 강조, 나머지는 중립)
const ISSUER_COLORS: Record<string, string> = {
  TIGER: "#E07A7A",
  KODEX: "#5BA8C6",
  ACE: "#4ABF8A",
  SOL: "#D4A85C",
  RISE: "#A37BD8",
  KOSEF: "#7CC7E8",
  ARIRANG: "#8B95A8",
};

function issuerColor(issuer?: string | null): string {
  if (!issuer) return "var(--fg-subtle)";
  const key = issuer.trim().toUpperCase();
  return ISSUER_COLORS[key] ?? "var(--accent)";
}

// 자정 기준 D-day 계산 (시/분 영향 제거)
function diffDays(launchDate: string, now: Date): number | null {
  const d = new Date(launchDate);
  if (isNaN(d.getTime())) return null;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

// 상장(예정)일 표기
function fmtLaunchDate(launchDate: string, lang: string): string {
  const d = new Date(launchDate);
  if (isNaN(d.getTime())) return launchDate;
  return d.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function fmtAsOf(asOf: string | null | undefined, lang: string): string {
  if (!asOf) return "";
  const d = new Date(asOf);
  if (isNaN(d.getTime())) return asOf;
  return d.toLocaleString(lang === "ko" ? "ko-KR" : "en-US", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

interface MarketState {
  data: EtfLaunchListResponse | null;
  error: boolean;
}

const INIT_STATE: MarketState = { data: null, error: false };

export default function EtfLaunchSection() {
  const { t, lang } = useT();
  const [market, setMarket] = useState<Market>("kr");

  // 시장별 상태 (서브탭 전환 시 재조회 방지 — 캐시 유지)
  const [krState, setKrState] = useState<MarketState>(INIT_STATE);
  const [usState, setUsState] = useState<MarketState>(INIT_STATE);
  // 재시도 트리거 (값이 바뀌면 해당 시장 effect 재실행)
  const [reloadKr, setReloadKr] = useState(0);
  const [reloadUs, setReloadUs] = useState(0);

  const [selected, setSelected] = useState<{ market: Market; item: EtfLaunch } | null>(null);

  // 이미 fetch를 시작한 시장 기록 (서브탭 전환 시 캐시 유지·재조회 방지)
  const startedRef = useRef<Record<Market, boolean>>({ kr: false, us: false });

  // D-day 실시간 계산을 위한 기준 시각 (1분마다 갱신)
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // 활성 시장이 미조회거나 재시도 트리거 시 fetch. 상태 변경은 전부 async 콜백 안에서만 수행.
  const reloadKey = market === "kr" ? reloadKr : reloadUs;
  useEffect(() => {
    // 이미 시작했고 재시도가 아니면(reloadKey===0) 캐시 사용
    if (startedRef.current[market] && reloadKey === 0) return;
    startedRef.current[market] = true;
    const setState = market === "kr" ? setKrState : setUsState;
    let cancelled = false;
    fetch(`${API}/etf-launches/${market}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((raw: Partial<EtfLaunchListResponse>) => {
        if (cancelled) return;
        const norm: EtfLaunchListResponse = {
          as_of: raw?.as_of ?? null,
          upcoming: Array.isArray(raw?.upcoming) ? raw!.upcoming! : [],
          recent: Array.isArray(raw?.recent) ? raw!.recent! : [],
        };
        setState({ data: norm, error: false });
      })
      // 실패 시 마지막 캐시(prev.data)는 유지하고 에러 플래그만 세움
      .catch(() => { if (!cancelled) setState(prev => ({ data: prev.data, error: true })); });
    return () => { cancelled = true; };
  }, [market, reloadKey]);

  function handleMarketChange(m: Market) {
    setMarket(m);
  }

  function retry() {
    if (market === "kr") { setKrState(INIT_STATE); setReloadKr(v => v + 1); }
    else { setUsState(INIT_STATE); setReloadUs(v => v + 1); }
  }

  const state = market === "kr" ? krState : usState;
  const data = state.data;
  const error = state.error;
  // 로딩 = 아직 데이터도 에러도 없는 상태 (별도 동기 setState 없이 파생)
  const loading = !data && !error;

  // 정렬: 예정(임박순 = D-day 오름차순) / 최근(최신순 = launch_date 내림차순).
  // 날짜 미정(예정 건 launch_date="")은 NaN이므로 항상 뒤로 보내고, 둘 다 미정이면
  // 원래 순서(BE 접수일 최신순)를 유지한다. (NaN-NaN=NaN으로 인한 불안정 정렬 방지)
  const upcoming = useMemo(() => {
    const arr = [...(data?.upcoming ?? [])];
    arr.sort((a, b) => {
      const ta = new Date(a.launch_date).getTime();
      const tb = new Date(b.launch_date).getTime();
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return ta - tb;
    });
    return arr;
  }, [data]);

  const recent = useMemo(() => {
    const arr = [...(data?.recent ?? [])];
    arr.sort((a, b) => {
      const ta = new Date(a.launch_date).getTime();
      const tb = new Date(b.launch_date).getTime();
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });
    return arr;
  }, [data]);

  const SUB_TABS: { id: Market; label: string }[] = [
    { id: "kr", label: t("etflaunch.sub.kr") },
    { id: "us", label: t("etflaunch.sub.us") },
  ];

  return (
    <div className="wx-investors-layout">
      {/* 좌측 세로 네비게이션 (마켓 패턴 동일) */}
      <nav className="wx-inv-nav">
        {SUB_TABS.map(tab => (
          <SubNavItem
            key={tab.id}
            label={tab.label}
            active={market === tab.id}
            onClick={() => handleMarketChange(tab.id)}
          />
        ))}
      </nav>

      {/* 우측 콘텐츠 */}
      <div style={{ minWidth: 0 }}>
        {/* 헤더 + as_of 기준일 */}
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap", marginBottom: 20,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
              {t("tab.etfLaunch")} · {market === "kr" ? t("etflaunch.sub.kr") : t("etflaunch.sub.us")}
            </h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("etflaunch.section.upcoming")} · {t("etflaunch.section.recent")}
            </span>
          </div>
          {data?.as_of && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("etflaunch.asof")} {fmtAsOf(data.as_of, lang)}
            </span>
          )}
        </div>

        {loading ? (
          <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height={150} />)}
          </div>
        ) : error && !data ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            color: "var(--text-muted)", fontSize: 13,
          }}>
            {t("etflaunch.error")}
            <br />
            <button
              onClick={retry}
              style={{
                marginTop: 12, padding: "6px 16px", borderRadius: 8,
                background: "var(--accent-dim)", color: "var(--accent)",
                border: "1px solid var(--accent-glow)", cursor: "pointer", fontSize: 12,
              }}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* 수집은 됐으나 비어있는 경우에도 마지막 캐시(as_of) 유지를 안내 */}
            {error && data && (
              <div style={{ fontSize: 11, color: "var(--gold)" }}>
                {t("etflaunch.error")} · {t("etflaunch.asof")} {fmtAsOf(data.as_of, lang)}
              </div>
            )}

            {/* 상장 예정 */}
            <LaunchGroup
              title={t("etflaunch.section.upcoming")}
              count={upcoming.length}
              empty={t("etflaunch.upcoming.empty")}
            >
              {upcoming.map((item, idx) => (
                <LaunchCard
                  key={item.ticker || `${item.name}-${idx}`}
                  item={item}
                  now={now}
                  lang={lang}
                  t={t}
                  onClick={() => setSelected({ market, item })}
                />
              ))}
            </LaunchGroup>

            {/* 최근 상장 */}
            <LaunchGroup
              title={t("etflaunch.section.recent")}
              count={recent.length}
              empty={t("etflaunch.recent.empty")}
            >
              {recent.map((item, idx) => (
                <LaunchCard
                  key={item.ticker || `${item.name}-${idx}`}
                  item={item}
                  now={now}
                  lang={lang}
                  t={t}
                  onClick={() => setSelected({ market, item })}
                />
              ))}
            </LaunchGroup>
          </div>
        )}
      </div>

      {selected && (
        <EtfLaunchModal
          market={selected.market}
          base={selected.item}
          now={now}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SubNavItem({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
        background: active ? "var(--accent-dim)" : "transparent",
        border: active ? "1px solid var(--accent-glow)" : "1px solid transparent",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--card-hover)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: active ? "var(--accent)" : "var(--text-muted)",
      }} />
      <span style={{
        fontSize: 14, fontWeight: active ? 700 : 600,
        color: active ? "var(--accent)" : "var(--text-primary)",
      }}>{label}</span>
    </button>
  );
}

function LaunchGroup({ title, count, empty, children }: {
  title: string; count: number; empty: string; children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{count}</span>
      </div>
      {count === 0 ? (
        <div style={{
          padding: "32px 20px", textAlign: "center",
          color: "var(--text-muted)", fontSize: 13,
          border: "1px dashed var(--border)", borderRadius: 12,
        }}>
          {empty}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {children}
        </div>
      )}
    </section>
  );
}

// 상태 뱃지: 예정이면 D-day, 최근이면 N일 전
function StatusBadge({ status, ddays, t }: {
  status: EtfLaunchStatus; ddays: number | null; t: (k: string) => string;
}) {
  if (ddays == null) return null;

  if (status === "upcoming") {
    const label = ddays <= 0 ? t("etflaunch.badge.today") : `D-${ddays}`;
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
        background: "var(--accent-dim)", color: "var(--accent)",
        border: "1px solid var(--accent-glow)", whiteSpace: "nowrap",
      }}>
        {label} {t("etflaunch.badge.dday")}
      </span>
    );
  }

  // recent
  const ago = Math.max(0, -ddays);
  const label = ago === 0 ? t("etflaunch.badge.today") : `${t("etflaunch.badge.new")} ${ago}${t("etflaunch.days.suffix")}`;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
      background: "var(--up-soft)", color: "var(--up)",
      border: "1px solid var(--up-glow)", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function IssuerChip({ issuer }: { issuer?: string | null }) {
  if (!issuer) return null;
  const color = issuerColor(issuer);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      background: "var(--bg-2)", color: "var(--text-primary)",
      border: "1px solid var(--border)", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {issuer}
    </span>
  );
}

function LaunchCard({ item, now, lang, t, onClick }: {
  item: EtfLaunch; now: Date; lang: string; t: (k: string) => string; onClick: () => void;
}) {
  const ddays = diffDays(item.launch_date, now);

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", gap: 10, textAlign: "left",
        width: "100%", padding: 16, borderRadius: 12, cursor: "pointer",
        background: "var(--card)", border: "1px solid var(--border)",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "var(--card-hover)";
        e.currentTarget.style.borderColor = "var(--border-light)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "var(--card)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* 운용사 칩 + 상태 뱃지 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <IssuerChip issuer={item.issuer} />
        <StatusBadge status={item.status} ddays={ddays} t={t} />
      </div>

      {/* 종목명 + 티커 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.35 }}>
          {item.name}
        </span>
        <span style={{
          fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
        }}>
          {[item.ticker, item.launch_date ? fmtLaunchDate(item.launch_date, lang) : ""]
            .filter(Boolean).join(" · ")}
        </span>
      </div>

      {/* 추종지수 / 카테고리 */}
      {(item.index_name || item.category) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {item.index_name && (
            <span style={{
              fontSize: 11, color: "var(--text-secondary)", padding: "2px 8px",
              borderRadius: 6, background: "var(--bg-2)", border: "1px solid var(--border)",
            }}>
              {item.index_name}
            </span>
          )}
          {item.category && (
            <span style={{
              fontSize: 11, color: "var(--text-muted)", padding: "2px 8px",
              borderRadius: 6, background: "var(--bg-2)", border: "1px solid var(--border)",
            }}>
              {item.category}
            </span>
          )}
        </div>
      )}

      {/* AI 한줄 */}
      {item.ai_oneliner && (
        <p style={{
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, margin: 0,
        }}>
          {item.ai_oneliner}
        </p>
      )}
    </button>
  );
}

function EtfLaunchModal({ market, base, now, onClose }: {
  market: Market; base: EtfLaunch; now: Date; onClose: () => void;
}) {
  const { t, lang } = useT();
  const [detail, setDetail] = useState<EtfLaunchDetail | null>(null);
  const [error, setError] = useState(false);
  // 예정 건(ticker 미정)은 상세 캐시가 없으므로 fetch 대상 아님 — 목록 카드 정보로 표시
  const hasDetail = !!base.ticker;
  // 로딩 = fetch 대상인데 아직 상세도 에러도 없는 상태 (동기 setState 없이 파생)
  const loading = hasDetail && !detail && !error;

  useEffect(() => {
    if (!base.ticker) return;
    let cancelled = false;
    fetch(`${API}/etf-launches/${market}/${base.ticker}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((d: EtfLaunchDetail) => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [market, base.ticker]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 상세 응답이 늦거나 실패해도 카드 기본정보는 항상 표시
  const view: EtfLaunch = detail ?? base;
  const ddays = diffDays(view.launch_date, now);
  const holdings = detail?.holdings ?? [];
  const hasHoldings = holdings.length > 0;
  const isUpcoming = view.status === "upcoming";

  return (
    <div className="wx-modal-scrim" onClick={onClose}>
      <div className="wx-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wx-modal-head">
          <div className="wx-modal-head-left">
            <div className="wx-modal-ticker-row">
              <span className="wx-modal-ticker">{view.ticker}</span>
              <StatusBadge status={view.status} ddays={ddays} t={t} />
            </div>
            <div className="wx-modal-name">{view.name}</div>
          </div>
          <button className="wx-modal-close" onClick={onClose} aria-label={lang === "ko" ? "닫기" : "Close"}>×</button>
        </div>

        {/* 메타 (운용사 / 상장일 / 추종지수 / 카테고리) */}
        <div style={{
          padding: "16px 28px 20px", display: "flex", flexWrap: "wrap", gap: 16,
          borderBottom: "1px solid var(--divider)",
        }}>
          <MetaCol label={lang === "ko" ? "운용사" : "Issuer"} value={view.issuer ?? "-"} />
          <MetaCol label={lang === "ko" ? "상장일" : "Listing date"} value={fmtLaunchDate(view.launch_date, lang)} />
          {view.index_name && (
            <MetaCol label={t("etflaunch.index")} value={view.index_name} />
          )}
          {view.category && (
            <MetaCol label={t("etflaunch.category")} value={view.category} />
          )}
        </div>

        {/* 상세 로딩/에러 */}
        {loading ? (
          <div style={{ padding: "40px 28px", textAlign: "center", color: "var(--fg-subtle)", fontSize: 13 }}>
            {t("etflaunch.detail.loading")}
          </div>
        ) : (
          <>
            {error && (
              <div style={{ padding: "12px 28px", color: "var(--gold)", fontSize: 12 }}>
                {t("etflaunch.detail.error")}
              </div>
            )}

            {/* AI 해설 */}
            {detail?.ai_explanation && (
              <div className="wx-modal-reason">
                <div className="wx-modal-reason-label">{t("etflaunch.detail.ai")}</div>
                {detail.ai_explanation}
              </div>
            )}

            {/* 구성종목 */}
            <div style={{ padding: "20px 28px" }}>
              <div className="wx-modal-section-head" style={{ marginBottom: 12 }}>
                <div className="wx-modal-section-title">{t("etflaunch.detail.holdings")}</div>
              </div>

              {hasHoldings ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {/* 헤더 */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8,
                    padding: "0 0 6px", fontSize: 10, color: "var(--fg-subtle)",
                    letterSpacing: "0.06em", borderBottom: "1px solid var(--divider)",
                  }}>
                    <span></span>
                    <span>{lang === "ko" ? "종목" : "Name"}</span>
                    <span style={{ textAlign: "right" }}>{t("etflaunch.detail.weight")}</span>
                  </div>
                  {holdings.map((h, idx) => (
                    <div
                      key={`${h.name}-${idx}`}
                      style={{
                        display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8,
                        alignItems: "center", padding: "8px 0",
                        borderBottom: idx === holdings.length - 1 ? "none" : "1px solid var(--divider)",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{h.name}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
                        textAlign: "right", fontVariantNumeric: "tabular-nums",
                      }}>
                        {h.weight != null ? `${h.weight.toFixed(2)}%` : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: "20px", textAlign: "center", borderRadius: 10,
                  background: "var(--bg-2)", border: "1px solid var(--border)",
                  fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.6,
                }}>
                  {isUpcoming ? t("etflaunch.detail.pending") : t("etflaunch.detail.noplan")}
                  {(view.index_name || view.category) && (
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
                      {view.index_name && (
                        <span style={{
                          fontSize: 11, color: "var(--text-secondary)", padding: "2px 8px",
                          borderRadius: 6, background: "var(--card)", border: "1px solid var(--border)",
                        }}>
                          {view.index_name}
                        </span>
                      )}
                      {view.category && (
                        <span style={{
                          fontSize: 11, color: "var(--text-muted)", padding: "2px 8px",
                          borderRadius: 6, background: "var(--card)", border: "1px solid var(--border)",
                        }}>
                          {view.category}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer — as_of 기준일 */}
        <div className="wx-modal-foot">
          <span className="wx-modal-foot-meta">
            {detail?.as_of ? `${t("etflaunch.asof")} ${fmtAsOf(detail.as_of, lang)}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetaCol({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{
        fontSize: 10, color: "var(--fg-subtle)", fontWeight: 600,
        letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
