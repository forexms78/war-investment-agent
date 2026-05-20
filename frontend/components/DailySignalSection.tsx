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
}: {
  item: { ticker: string; name: string; reason?: string; confidence?: number; signals?: string[] };
  type: "buy" | "sell" | "focus";
}) {
  const signals = item.signals || [];
  const reason = item.reason || "";
  const confidence = item.confidence ?? null;
  const borderColor = type === "buy" ? "#10b981" : type === "sell" ? "#ef4444" : "#3b82f6";
  const label = type === "buy" ? "Buy" : type === "sell" ? "Sell" : "Watch";

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 12,
      padding: "14px 16px",
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{item.ticker}</span>
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
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>
          {reason}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {signals.map(s => <SignalTag key={s} signal={s} />)}
      </div>
    </div>
  );
}

export default function DailySignalSection({
  data,
}: {
  data: DailySignal;
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

      {/* ── Buy / Sell / Focus 3-column grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {/* Buy Recommendations */}
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#10b981",
            letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
          }}>
            Buy ({data.buy_recommendations.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.buy_recommendations.length > 0 ? (
              data.buy_recommendations.map((item, i) => (
                <RecommendationCard key={i} item={item} type="buy" />
              ))
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>
                No buy signals
              </div>
            )}
          </div>
        </div>

        {/* Sell Recommendations */}
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#ef4444",
            letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
          }}>
            Sell ({data.sell_recommendations.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.sell_recommendations.length > 0 ? (
              data.sell_recommendations.map((item, i) => (
                <RecommendationCard key={i} item={item} type="sell" />
              ))
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>
                No sell signals
              </div>
            )}
          </div>
        </div>

        {/* Focus List */}
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#3b82f6",
            letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
          }}>
            Watch ({data.focus_list.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.focus_list.length > 0 ? (
              data.focus_list.map((item, i) => (
                <RecommendationCard key={i} item={item} type="focus" />
              ))
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>
                No watch items
              </div>
            )}
          </div>
        </div>
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
