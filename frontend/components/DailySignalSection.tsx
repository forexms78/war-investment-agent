"use client";
import { DailySignal } from "@/types";
import { useT } from "@/contexts/LanguageContext";

const SIGNAL_ICONS: Record<string, string> = {
  investor_buy: "Investor 매수",
  investor_sell: "Investor 매도",
  etf_strong_buy: "ETF 강력매수",
  etf_buy: "ETF 매수",
  etf_sell: "ETF 매도",
  etf_strong_sell: "ETF 강력매도",
  foreign_buy: "외국인 순매수",
  foreign_sell: "외국인 순매도",
  news_impact: "뉴스 임팩트",
};

function SignalTag({ signal }: { signal: string }) {
  const color = signal.includes("buy") || signal.includes("Buy")
    ? "var(--green)"
    : signal.includes("sell") || signal.includes("Sell")
    ? "var(--red)"
    : "var(--orange)";
  return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4,
      background: `${color}18`, color, border: `1px solid ${color}33`,
      fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {SIGNAL_ICONS[signal] || signal}
    </span>
  );
}

function SentimentBadge({ sentiment, score }: { sentiment: string; score: number }) {
  const color = sentiment === "Bullish" ? "#10b981" : sentiment === "Bearish" ? "#ef4444" : "#eab308";
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: `${color}18`, color, border: `1px solid ${color}44`,
    }}>
      {sentiment === "Bullish" ? "Bullish" : sentiment === "Bearish" ? "Bearish" : "Neutral"} · {score}
    </span>
  );
}

function RecommendationCard({
  item,
  type,
  onSelect,
}: {
  item: { ticker: string; name: string; reason?: string; confidence?: number; signals?: string[] };
  type: "buy" | "sell" | "focus";
  onSelect?: (ticker: string) => void;
}) {
  const signals = item.signals || [];
  const reason = item.reason || "";
  const confidence = item.confidence ?? null;
  const borderColor = type === "buy" ? "#10b981" : type === "sell" ? "#ef4444" : "#3b82f6";
  const label = type === "buy" ? "Buy" : type === "sell" ? "Sell" : "Watch";
  const clickable = !!onSelect;

  return (
    <div
      onClick={() => onSelect?.(item.ticker)}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 12,
        padding: "14px 16px",
        transition: "transform 0.15s, border-color 0.15s, background 0.15s",
        cursor: clickable ? "pointer" : "default",
      }}
      onMouseEnter={e => {
        if (!clickable) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = borderColor;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        if (!clickable) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{item.ticker}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{item.name}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
            background: `${borderColor}18`, color: borderColor,
            border: `1px solid ${borderColor}44`,
          }}>{label}</span>
          {confidence !== null && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
              {confidence}%
            </span>
          )}
        </div>
      </div>
      {reason && (
        <p style={{
          fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55,
          marginBottom: 10,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {reason}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {signals.map(s => <SignalTag key={s} signal={s} />)}
      </div>
    </div>
  );
}

const PREVIEW_COUNT = 3;

function RecommendationColumn({
  title,
  color,
  items,
  type,
  onTickerSelect,
  onSeeMore,
  emptyMsg,
}: {
  title: string;
  color: string;
  items: { ticker: string; name: string; reason?: string; confidence?: number; signals?: string[] }[];
  type: "buy" | "sell" | "focus";
  onTickerSelect?: (ticker: string) => void;
  onSeeMore?: () => void;
  emptyMsg: string;
}) {
  const total = items.length;
  const visible = items.slice(0, PREVIEW_COUNT);
  const hidden = Math.max(0, total - PREVIEW_COUNT);

  return (
    <div>
      <div style={{
        fontSize: 13, fontWeight: 700, color,
        letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
      }}>
        {title} ({total})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.length > 0 ? (
          visible.map((item, i) => (
            <RecommendationCard key={i} item={item} type={type} onSelect={onTickerSelect} />
          ))
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>
            {emptyMsg}
          </div>
        )}
        {onSeeMore && (hidden > 0 || total > 0) && (
          <button
            onClick={onSeeMore}
            style={{
              marginTop: 4,
              background: "transparent",
              border: `1px dashed ${color}55`,
              color,
              fontSize: 12, fontWeight: 600,
              padding: "10px 12px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = `${color}10`;
              (e.currentTarget as HTMLButtonElement).style.borderColor = color;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}55`;
            }}
          >
            {hidden > 0 ? `+${hidden}개 더 보기 — ETF·주식 탭 →` : `ETF·주식 탭에서 전체 보기 →`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DailySignalSection({
  data,
  onTickerSelect,
  onSeeMore,
}: {
  data: DailySignal;
  onTickerSelect?: (ticker: string) => void;
  onSeeMore?: () => void;
}) {
  const { t, lang } = useT();

  return (
    <div style={{ marginBottom: 32 }}>
      {/* ── 헤더 배너 ── */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "20px 24px",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "var(--accent)",
            letterSpacing: "0.1em", textTransform: "uppercase",
            background: "var(--accent-dim)", padding: "3px 10px", borderRadius: 20,
            border: "1px solid var(--accent-glow)",
          }}>
            Daily Signal
          </span>
          <SentimentBadge sentiment={data.sentiment} score={data.sentiment_score} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Fed Rate <strong style={{ color: "var(--text-secondary)" }}>{data.fed_rate}%</strong>
          </span>
          {data.updated_at && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {new Date(data.updated_at).toLocaleString(lang === "ko" ? "ko-KR" : "en-US")}
            </span>
          )}
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.35, marginBottom: 10, color: "var(--text-primary)" }}>
          {data.headline}
        </div>

        {data.market_summary && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 0 }}>
            {data.market_summary}
          </p>
        )}
      </div>

      {/* ── 마켓 드라이버 ── */}
      {data.market_drivers && data.market_drivers.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            {t("whale.global_market") || "Market Drivers"}
          </div>
          <div className="driver-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {data.market_drivers.slice(0, 3).map((d, i) => {
              const color = d.direction === "bullish" ? "var(--green)" : d.direction === "bearish" ? "var(--red)" : "var(--orange)";
              const tag = d.direction === "bullish" ? "Bullish" : d.direction === "bearish" ? "Bearish" : "Mixed";
              return (
                <div key={i} style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                      color, background: `${color}18`,
                      border: `1px solid ${color}40`,
                      borderRadius: 4, padding: "1px 5px",
                    }}>{tag}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>
                    {d.headline}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {d.impact}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Buy / Sell / Focus 3-column grid (각 3개 미리보기 + 더보기) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <RecommendationColumn
          title="Buy"
          color="#10b981"
          items={data.buy_recommendations}
          type="buy"
          onTickerSelect={onTickerSelect}
          onSeeMore={onSeeMore}
          emptyMsg="No buy signals"
        />
        <RecommendationColumn
          title="Sell"
          color="#ef4444"
          items={data.sell_recommendations}
          type="sell"
          onTickerSelect={onTickerSelect}
          onSeeMore={onSeeMore}
          emptyMsg="No sell signals"
        />
        <RecommendationColumn
          title="Watch"
          color="#3b82f6"
          items={data.focus_list}
          type="focus"
          onTickerSelect={onTickerSelect}
          onSeeMore={onSeeMore}
          emptyMsg="No watch items"
        />
      </div>

      {/* ── 시장 뉴스 ── */}
      {((data.market_news && data.market_news.length > 0) || (data.asia_news && data.asia_news.length > 0)) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
          {data.market_news && data.market_news.length > 0 && (
            <NewsColumn title={t("whale.global_market") || "Global Market"} news={data.market_news} />
          )}
          {data.asia_news && data.asia_news.length > 0 && (
            <NewsColumn title={t("whale.asia_market") || "Asia Market"} news={data.asia_news} />
          )}
        </div>
      )}
    </div>
  );
}

function NewsColumn({ title, news }: { title: string; news: { title: string; source: string; published_at: string; url: string; image_url?: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {news.slice(0, 5).map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", gap: 10,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 12px",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--card-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--card)"; }}
          >
            {item.image_url && (
              <img
                src={item.image_url}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                lineHeight: 1.4, marginBottom: 4,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {item.title}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{item.source}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {item.published_at ? new Date(item.published_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
