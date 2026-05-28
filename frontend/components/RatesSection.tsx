"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

interface USRates {
  fed_rate: number | null;
  yield_3m: number | null;
  yield_3m_change: number | null;
  yield_5y: number | null;
  yield_5y_change: number | null;
  yield_10y: number | null;
  yield_10y_change: number | null;
  yield_30y: number | null;
  yield_30y_change: number | null;
  spread_10y_3m: number | null;
  curve_inverted: boolean;
}

interface KRRates {
  base_rate: number | null;
  treasury_1y: number | null;
  treasury_3y: number | null;
  treasury_5y: number | null;
  treasury_10y: number | null;
  cd_rate: number | null;
  corp_aa: number | null;
  treasury_3y_change: number | null;
  treasury_10y_change: number | null;
  spread_10y_3y: number | null;
  updated_at: string;
}

interface RatesData {
  us: USRates;
  kr: KRRates;
  updated_at: string | null;
}

function RateCard({
  label, value, change, sub,
}: {
  label: string;
  value: string;
  change?: number | null;
  sub?: string;
}) {
  const changeColor = change != null
    ? (change > 0 ? "var(--red)" : change < 0 ? "var(--green)" : "var(--text-muted)")
    : "var(--text-muted)";

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6, letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {change != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: changeColor }}>
            {change > 0 ? "+" : ""}{change.toFixed(3)}%p
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</span>}
      </div>
    </div>
  );
}

function SpreadBanner({ label, value, inverted }: { label: string; value: number | null; inverted?: boolean }) {
  if (value == null) return null;
  const color = inverted ? "#ef4444" : "#10b981";
  return (
    <div style={{
      background: `${color}0a`, border: `1px solid ${color}33`,
      borderRadius: 10, padding: "10px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
        background: `${color}18`, color, border: `1px solid ${color}44`,
      }}>
        {inverted ? "역전" : "정상"}
      </span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        {label}: <strong style={{ color }}>{value > 0 ? "+" : ""}{value.toFixed(3)}%p</strong>
      </span>
    </div>
  );
}

export default function RatesSection() {
  const [data, setData] = useState<RatesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/rates`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 18, height: 90,
          }}>
            <div className="skeleton" style={{ height: 12, width: "60%", marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 22, width: "40%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (!data || (!data.us?.fed_rate && !data.kr?.base_rate)) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        금리 데이터를 불러올 수 없습니다
      </div>
    );
  }

  const { us, kr } = data;
  const fmtRate = (v: number | null) => v != null ? `${v.toFixed(2)}%` : "-";
  const fmtTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>미국 / 한국 금리</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Fed(NY Fed API) / 한국은행(ECOS API) 공식 데이터 / 30분 자동 갱신
          </div>
        </div>
        {data.updated_at && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
            {fmtTime(data.updated_at)}
          </span>
        )}
      </div>

      {/* 미국 금리 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          미국 금리
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
            background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-glow)",
          }}>US Treasury</span>
        </div>

        <SpreadBanner
          label="10Y - 3M 스프레드"
          value={us.spread_10y_3m ?? null}
          inverted={us.curve_inverted}
        />

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}>
          <RateCard label="Fed 기준금리 (EFFR)" value={fmtRate(us.fed_rate)} sub="NY Fed API" />
          <RateCard label="미국 3개월 국채" value={fmtRate(us.yield_3m)} change={us.yield_3m_change} sub="단기" />
          <RateCard label="미국 5년 국채" value={fmtRate(us.yield_5y)} change={us.yield_5y_change} sub="중기" />
          <RateCard label="미국 10년 국채" value={fmtRate(us.yield_10y)} change={us.yield_10y_change} sub="장기 기준" />
          <RateCard label="미국 30년 국채" value={fmtRate(us.yield_30y)} change={us.yield_30y_change} sub="초장기" />
        </div>
      </div>

      {/* 한국 금리 */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          한국 금리
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
            background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-glow)",
          }}>BOK ECOS</span>
        </div>

        {kr.spread_10y_3y != null && (
          <SpreadBanner
            label="국고채 10Y - 3Y 스프레드"
            value={kr.spread_10y_3y}
            inverted={kr.spread_10y_3y < 0}
          />
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}>
          <RateCard label="한국은행 기준금리" value={fmtRate(kr.base_rate)} sub="BOK" />
          <RateCard label="국고채 1년" value={fmtRate(kr.treasury_1y)} sub="단기" />
          <RateCard label="국고채 3년" value={fmtRate(kr.treasury_3y)} change={kr.treasury_3y_change} sub="중기 기준" />
          <RateCard label="국고채 5년" value={fmtRate(kr.treasury_5y)} sub="중기" />
          <RateCard label="국고채 10년" value={fmtRate(kr.treasury_10y)} change={kr.treasury_10y_change} sub="장기" />
          <RateCard label="CD 91일" value={fmtRate(kr.cd_rate)} sub="단기 시장" />
          <RateCard label="회사채 AA-" value={fmtRate(kr.corp_aa)} sub="신용 스프레드 참고" />
        </div>
      </div>
    </div>
  );
}
