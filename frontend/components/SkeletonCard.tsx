"use client";

interface Props { height?: number; }

export default function SkeletonCard({ height = 200 }: Props) {
  return (
    <div style={{
      background: "var(--card)", borderRadius: 14,
      border: "1px solid var(--border)", padding: 20,
      height, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="skeleton" style={{ height: 14, width: "60%" }} />
          <div className="skeleton" style={{ height: 11, width: "40%" }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 11, width: "100%", marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 11, width: "80%" }} />
    </div>
  );
}
