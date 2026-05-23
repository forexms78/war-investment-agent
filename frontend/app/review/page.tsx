"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL;

// ─── 타입 ─────────────────────────────────────────────────────
type Summary = {
  total_predictions: number;
  verified_count: number;
  hit_1d: number | null;
  hit_7d: number | null;
  hit_30d: number | null;
  avg_ret_7d: number | null;
  active_lessons: number;
  this_week_hit: number | null;
  last_week_hit: number | null;
};

type Snapshot = {
  id: number;
  snapshot_date: string;
  ticker: string;
  pick_type: "buy" | "sell" | "watch";
  entry_price: number;
  momentum_30d: number | null;
  sentiment: number | null;
  ret_1d: number | null;
  ret_7d: number | null;
  ret_30d: number | null;
  hit_1d: boolean | null;
  hit_7d: boolean | null;
  hit_30d: boolean | null;
  ai_reason: string | null;
};

type Failure = {
  id: number;
  analyzed_at: string;
  horizon: "1d" | "7d" | "30d";
  failure_category: string;
  root_cause: string;
  avoid_rule: string;
  severity: number;
  snapshot?: {
    ticker: string;
    pick_type: string;
    snapshot_date: string;
    entry_price: number;
    momentum_30d: number | null;
    sentiment: number | null;
    ret_1d: number | null;
    ret_7d: number | null;
    ret_30d: number | null;
  };
};

type Lesson = {
  failure_category: string;
  avoid_rule: string;
  severity: number;
  analyzed_at: string;
};

type TopLesson = {
  category: string;
  count: number;
  avg_severity: number;
  weight: number;
  avoid_rule: string;
};

type WeeklyTrend = {
  week_start: string;
  hit_rate_1d: number | null;
  hit_rate_7d: number | null;
  hit_rate_30d: number | null;
  avg_ret_7d: number | null;
  total_1d: number;
};

// ─── 유틸 ─────────────────────────────────────────────────────
function pickColor(pickType: string): string {
  if (pickType === "buy") return "var(--green)";
  if (pickType === "sell") return "var(--red)";
  return "var(--gold)";
}
function pickLabel(pickType: string): string {
  if (pickType === "buy") return "매수";
  if (pickType === "sell") return "매도";
  return "관심";
}
function fmtDate(s: string): string {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtDateFull(s: string): string {
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 페이지 ───────────────────────────────────────────────────
export default function ReviewPage() {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [snaps,    setSnaps]    = useState<Snapshot[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [lessons,  setLessons]  = useState<{ top: TopLesson[]; all: Lesson[] } | null>(null);
  const [trend,    setTrend]    = useState<WeeklyTrend[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    Promise.all([
      fetch(`${API}/review/summary`).then(r => r.json()).catch(() => null),
      fetch(`${API}/review/snapshots?limit=60`).then(r => r.json()).catch(() => null),
      fetch(`${API}/review/failures?limit=15`).then(r => r.json()).catch(() => null),
      fetch(`${API}/review/lessons`).then(r => r.json()).catch(() => null),
      fetch(`${API}/review/weekly-trend`).then(r => r.json()).catch(() => null),
    ]).then(([s, snap, fail, less, tr]) => {
      setSummary(s);
      setSnaps(snap?.items || []);
      setFailures(fail?.items || []);
      setLessons(less || { top: [], all: [] });
      setTrend(tr?.items || []);
      setLoading(false);
    });
  }, []);

  // 추천 분리: 맞춤 / 빗나감 / 미검증
  const hits  = snaps.filter(s => s.hit_7d === true);
  const misses = snaps.filter(s => s.hit_7d === false);

  const weekDelta = summary && summary.this_week_hit != null && summary.last_week_hit != null
    ? +(summary.this_week_hit - summary.last_week_hit).toFixed(1)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      <Header />

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
        {/* 헤드라인 */}
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>AI 추천 회고</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            매일 추천된 종목이 1일·7일·30일 후 어떻게 됐는지 추적합니다.
            빗나간 추천은 Gemini가 원인을 분석해 다음 추천에 회피 규칙으로 자동 주입됩니다.
          </p>
        </div>

        {/* KPI 4종 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <KpiCard label="총 추천 누적" value={summary?.total_predictions ?? 0} suffix="건" accent={false} loading={loading} />
          <KpiCard
            label="통산 적중률 (7d)"
            value={summary?.hit_7d ?? "-"}
            suffix={summary?.hit_7d != null ? "%" : ""}
            accent={(summary?.hit_7d ?? 0) >= 50}
            loading={loading}
          />
          <KpiCard
            label="평균 수익률 (7d)"
            value={summary?.avg_ret_7d ?? "-"}
            suffix={summary?.avg_ret_7d != null ? "%" : ""}
            accent={(summary?.avg_ret_7d ?? 0) > 0}
            loading={loading}
          />
          <KpiCard
            label="적용 중인 회피 규칙"
            value={summary?.active_lessons ?? 0}
            suffix="개"
            accent={(summary?.active_lessons ?? 0) > 0}
            loading={loading}
          />
        </div>

        {/* 주간 변화 카드 */}
        {summary && summary.this_week_hit != null && (
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
          }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>이번주 vs 지난주 (1d 적중률)</p>
              <p style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 0", letterSpacing: "-0.02em" }}>
                {summary.this_week_hit}%
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10, fontWeight: 500 }}>
                  지난주 {summary.last_week_hit ?? "-"}%
                </span>
              </p>
            </div>
            {weekDelta != null && (
              <div style={{
                padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                background: weekDelta >= 0 ? "var(--green-dim)" : "var(--red-dim)",
                color: weekDelta >= 0 ? "var(--green)" : "var(--red)",
              }}>
                {weekDelta >= 0 ? "+" : ""}{weekDelta}%p
              </div>
            )}
          </div>
        )}

        {/* 주간 추이 차트 */}
        <Section title="주간 적중률 추이" subtitle="시간이 지날수록 우상향이면 학습 효과가 가시화되고 있다는 뜻입니다.">
          {trend.length === 0 ? (
            <EmptyMessage text={loading ? "데이터 로딩 중..." : "아직 주간 데이터가 없습니다. 1주일 이상 누적되면 표시됩니다."} />
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="week_start" tickFormatter={fmtDate} stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} unit="%" />
                  <RTooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => fmtDateFull(v as string)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="hit_rate_1d"  name="1일 적중률"  stroke="var(--green)"  strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="hit_rate_7d"  name="7일 적중률"  stroke="var(--accent)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="hit_rate_30d" name="30일 적중률" stroke="var(--purple)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* 빗나간 픽 (좌, 크게) + AI 학습 로그 (우) — 1:1 그리드, 모바일은 1열 */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 16 }} className="review-grid">
          <Section title="빗나간 추천 — 심층 분석" subtitle="실패 케이스만 Gemini가 원인을 진단합니다.">
            {failures.length === 0 ? (
              <EmptyMessage text={loading ? "분석 결과 로딩 중..." : "아직 분석된 실패 사례가 없습니다."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {failures.map(f => <FailureCard key={f.id} item={f} />)}
              </div>
            )}
          </Section>

          <Section title="AI 학습 로그" subtitle="새 회피 규칙이 생성될 때마다 누적됩니다.">
            {!lessons || lessons.all.length === 0 ? (
              <EmptyMessage text={loading ? "로딩 중..." : "아직 학습 로그가 없습니다."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lessons.all.slice(0, 25).map((l, i) => (
                  <div key={i} style={{
                    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>{l.failure_category}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtDate(l.analyzed_at)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>{l.avoid_rule}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* 적용 중 회피 규칙 — 다음 추천에 즉시 반영 */}
        <Section title="현재 적용 중인 회피 규칙 (Top 3)" subtitle="다음 추천 생성 시 프롬프트에 주입되며 매칭 종목은 점수가 30% 차감됩니다.">
          {!lessons || lessons.top.length === 0 ? (
            <EmptyMessage text={loading ? "로딩 중..." : "아직 활성 규칙이 없습니다. 첫 실패 분석 후 생성됩니다."} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {lessons.top.map((p, i) => (
                <div key={i} style={{
                  background: "var(--green-dim)", border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--green)" }}>{i + 1}. {p.category}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>최근 {p.count}건 · sev {p.avg_severity}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>{p.avoid_rule}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 맞춘 추천 (간단) */}
        <Section title={`맞춘 추천 (${hits.length}건)`} subtitle="요약만 표시. 자세한 분석은 빗나간 케이스에서만.">
          {hits.length === 0 ? (
            <EmptyMessage text={loading ? "로딩 중..." : "검증 완료된 적중 추천이 아직 없습니다."} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              {hits.slice(0, 24).map(s => (
                <div key={s.id} style={{
                  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{s.ticker}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0" }}>
                      {fmtDate(s.snapshot_date)} · <span style={{ color: pickColor(s.pick_type) }}>{pickLabel(s.pick_type)}</span>
                    </p>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: (s.ret_7d ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                  }}>
                    {(s.ret_7d ?? 0) > 0 ? "+" : ""}{s.ret_7d?.toFixed(1) ?? "-"}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 빈 페이지 안내 — 데이터 0건일 때 */}
        {summary?.total_predictions === 0 && (
          <div style={{
            textAlign: "center", padding: "40px 20px", background: "var(--card)",
            border: "1px dashed var(--border)", borderRadius: 12, color: "var(--text-muted)",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px", color: "var(--text-primary)" }}>
              아직 추천 누적 데이터가 없습니다
            </p>
            <p style={{ fontSize: 12, margin: 0 }}>
              스케줄러가 6시간마다 추천을 생성합니다. 첫 추천 이후 1일·7일·30일 검증 결과가 차례로 채워집니다.
            </p>
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .review-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────

function Header() {
  return (
    <header style={{
      borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
      background: "var(--header-bg)", backdropFilter: "blur(16px)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>W</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>Whalyx</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>Review</span>
        </Link>
        <Link href="/dashboard" style={{
          padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 400,
          textDecoration: "none", color: "var(--text-muted)",
        }}>
          ← 대시보드
        </Link>
      </div>
    </header>
  );
}

function KpiCard({ label, value, suffix, accent, loading }: {
  label: string; value: number | string; suffix: string; accent: boolean; loading: boolean;
}) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
      padding: "16px 18px",
    }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</p>
      <p style={{
        fontSize: 24, fontWeight: 800, margin: "8px 0 0", letterSpacing: "-0.02em",
        color: loading ? "var(--text-muted)" : accent ? "var(--green)" : "var(--text-primary)",
      }}>
        {loading ? "..." : `${value}${suffix}`}
      </p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div style={{
      background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 10,
      padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12,
    }}>
      {text}
    </div>
  );
}

function FailureCard({ item }: { item: Failure }) {
  const ret = item.snapshot?.[`ret_${item.horizon}` as "ret_1d" | "ret_7d" | "ret_30d"];
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>
            {item.snapshot?.ticker ?? "-"}
          </span>
          <span style={{ fontSize: 11, color: pickColor(item.snapshot?.pick_type ?? ""), fontWeight: 700 }}>
            {pickLabel(item.snapshot?.pick_type ?? "")}
          </span>
          <span style={{
            fontSize: 11, padding: "1px 6px", borderRadius: 4, fontWeight: 700,
            background: "var(--red-dim)", color: "var(--red)",
          }}>
            {item.failure_category}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.horizon}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>sev {item.severity}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--red)" }}>
          {ret != null ? `${ret > 0 ? "+" : ""}${ret}%` : "-"}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--text-primary)" }}>왜 틀렸나:</strong> {item.root_cause}
      </p>
      <div style={{
        background: "var(--bg-2)", borderLeft: "3px solid var(--accent)",
        padding: "8px 12px", borderRadius: 4, fontSize: 12, lineHeight: 1.5,
      }}>
        <strong style={{ color: "var(--accent)" }}>회피 규칙:</strong> {item.avoid_rule}
      </div>
      {item.snapshot && (
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap" }}>
          <span>추천일 {fmtDate(item.snapshot.snapshot_date)}</span>
          <span>진입가 {item.snapshot.entry_price}</span>
          {item.snapshot.momentum_30d != null && <span>모멘텀 {item.snapshot.momentum_30d}%</span>}
          {item.snapshot.sentiment != null && <span>감성 {item.snapshot.sentiment}</span>}
        </div>
      )}
    </div>
  );
}
