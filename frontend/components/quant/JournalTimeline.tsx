"use client";

interface Entry {
  id: string;
  date: string;
  action: "buy" | "sell" | "hold" | "note";
  price?: number;
  quantity?: number;
  analysis_text?: string;
  signal?: string;
  forward_pe?: number;
  created_at: string;
}

interface Props {
  entries: Entry[];
}

const ACTION_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  buy:  { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(16,185,129,0.3)" },
  sell: { bg: "var(--red-dim)",   color: "var(--red)",   border: "rgba(239,68,68,0.3)" },
  hold: { bg: "var(--accent-dim)", color: "var(--accent)", border: "var(--accent-glow)" },
  note: { bg: "rgba(107,153,187,0.1)", color: "var(--text-muted)", border: "var(--border)" },
};

const ACTION_LABEL = { buy: "매수", sell: "매도", hold: "보유", note: "분석노트" };

export default function JournalTimeline({ entries }: Props) {
  if (!entries.length) return (
    <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
      일지가 없습니다. 분석 텍스트를 붙여넣어 시작하세요.
    </p>
  );

  return (
    <div style={{ borderLeft: "2px solid var(--border)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map((e) => {
        const style = ACTION_COLOR[e.action] ?? ACTION_COLOR.note;
        return (
          <div key={e.id} style={{ paddingBottom: 20, paddingTop: 2 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "0 0 6px" }}>
              {new Date(e.created_at).toLocaleDateString("ko-KR")}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                background: style.bg, color: style.color, border: `1px solid ${style.border}`,
              }}>
                {ACTION_LABEL[e.action]}
              </span>
              {e.price && (
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>
                  ${e.price.toLocaleString()}
                </span>
              )}
              {e.quantity && (
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>× {e.quantity}주</span>
              )}
              {e.forward_pe && (
                <span style={{ color: "var(--gold)", fontSize: 12 }}>P/E {e.forward_pe}</span>
              )}
            </div>
            {e.analysis_text && (
              <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "6px 0 0", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                {e.analysis_text.slice(0, 120)}...
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
