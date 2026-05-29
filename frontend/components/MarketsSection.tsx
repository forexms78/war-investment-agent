"use client";
import dynamic from "next/dynamic";
import {
  HotStock, RecommendedStock, CoinData, RealEstateIndicator,
  CommodityData, NewsItem, BondData, KoreaRates,
  ETFSignalsData, ETFSignalItem,
} from "@/types";
import HotStocksBar from "@/components/HotStocksBar";
import RecommendSection from "@/components/RecommendSection";
import ETFStockSection from "@/components/ETFStockSection";
import SkeletonCard from "@/components/SkeletonCard";
import { useT } from "@/contexts/LanguageContext";

// 서브 탭 클릭 시점에만 chunk 로드
const CryptoSection     = dynamic(() => import("@/components/CryptoSection"));
const RealEstateSection = dynamic(() => import("@/components/RealEstateSection"));
const CommoditySection  = dynamic(() => import("@/components/CommoditySection"));
const BondsSection      = dynamic(() => import("@/components/BondsSection"));
const RatesSection      = dynamic(() => import("@/components/RatesSection"));

type MarketTab = "etf" | "stocks" | "crypto" | "realestate" | "commodities" | "bonds" | "rates";

interface MarketsProps {
  // 서브탭 제어 (외부에서 주입)
  activeSubTab: MarketTab;
  onSubTabChange: (tab: MarketTab) => void;
  // 주식
  hotStocks: HotStock[];
  recommendations: { buy: RecommendedStock[]; sell: RecommendedStock[] } | null;
  etfSignals: ETFSignalsData | null;
  onSelectStock: (ticker: string) => void;
  onSelectEtf: (item: ETFSignalItem) => void;
  usd_krw?: number;
  // 코인
  coins: CoinData[];
  cryptoNews: NewsItem[];
  loadingCrypto: boolean;
  onLoadCrypto: () => void;
  // 부동산
  reData: { indicators: RealEstateIndicator[]; news: NewsItem[] } | null;
  loadingRE: boolean;
  onLoadRE: () => void;
  // 광물
  commodityData: { commodities: CommodityData[]; news: NewsItem[] } | null;
  loadingCommodity: boolean;
  onLoadCommodity: () => void;
  // 채권
  bondData: { data: BondData; news: NewsItem[] } | null;
  loadingBonds: boolean;
  bondError: boolean;
  onLoadBonds: () => void;
  onRetryBonds: () => void;
}

export default function MarketsSection(props: MarketsProps) {
  const { t } = useT();
  const MARKET_TABS: { id: MarketTab; label: string }[] = [
    { id: "etf",         label: t("tab.etf") },
    { id: "stocks",      label: t("tab.stocks") },
    { id: "crypto",      label: t("tab.crypto") },
    { id: "realestate",  label: t("tab.realestate") },
    { id: "commodities", label: t("tab.commodities") },
    { id: "bonds",       label: t("tab.bonds") },
    { id: "rates",       label: "금리" },
  ];
  const activeTab = props.activeSubTab;

  function handleTabChange(tab: MarketTab) {
    props.onSubTabChange(tab);
    if (tab === "crypto"      && props.coins.length === 0)     props.onLoadCrypto();
    if (tab === "realestate"  && !props.reData)                props.onLoadRE();
    if (tab === "commodities" && !props.commodityData)         props.onLoadCommodity();
    if (tab === "bonds"       && !props.bondData)              props.onLoadBonds();
  }

  return (
    <div className="wx-investors-layout">
      {/* 좌측 세로 네비게이션 */}
      <nav className="wx-inv-nav">
        {MARKET_TABS.map(tab => (
          <MarketNavItem
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
          />
        ))}
      </nav>

      {/* 우측 콘텐츠 */}
      <div style={{ minWidth: 0 }}>
      {/* ETF */}
      {activeTab === "etf" && (
        <div className="fade-in">
          <ETFStockSection
            filter="etf"
            data={props.etfSignals}
            onSelect={props.onSelectStock}
            onSelectEtf={props.onSelectEtf}
            usdKrw={props.usd_krw}
          />
        </div>
      )}

      {/* 주식 */}
      {activeTab === "stocks" && (
        <div className="fade-in">
          <ETFStockSection
            filter="stock"
            data={props.etfSignals}
            onSelect={props.onSelectStock}
            onSelectEtf={props.onSelectEtf}
            usdKrw={props.usd_krw}
          />
          {/* 좌우 레이아웃: 왼쪽 고래 종목 + 오른쪽 매수/매도 추천 */}
          <div className="wx-market-stocks-layout" style={{ marginTop: 32 }}>
            <div className="wx-market-stocks-left">
              <HotStocksBar
                stocks={props.hotStocks}
                onSelect={props.onSelectStock}
                usd_krw={props.usd_krw}
              />
            </div>
            <div className="wx-market-stocks-right">
              {props.recommendations && (
                <RecommendSection
                  recommendations={props.recommendations}
                  onSelect={props.onSelectStock}
                  usd_krw={props.usd_krw}
                />
              )}
            </div>
          </div>

        </div>
      )}

      {/* 코인 */}
      {activeTab === "crypto" && (
        <div className="fade-in">
          {props.loadingCrypto ? (
            <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} height={120} />)}
            </div>
          ) : (
            <CryptoSection coins={props.coins} news={props.cryptoNews} usd_krw={props.usd_krw} />
          )}
        </div>
      )}

      {/* 부동산 */}
      {activeTab === "realestate" && (
        <div className="fade-in">
          {props.loadingRE ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height={80} />)}
            </div>
          ) : props.reData ? (
            <RealEstateSection indicators={props.reData.indicators} news={props.reData.news} />
          ) : null}
        </div>
      )}

      {/* 광물 */}
      {activeTab === "commodities" && (
        <div className="fade-in">
          {props.loadingCommodity ? (
            <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={140} />)}
            </div>
          ) : props.commodityData ? (
            <CommoditySection
              commodities={props.commodityData.commodities || []}
              news={props.commodityData.news || []}
              usd_krw={props.usd_krw}
            />
          ) : null}
        </div>
      )}

      {/* 금리 */}
      {activeTab === "rates" && (
        <div className="fade-in">
          <RatesSection />
        </div>
      )}

      {/* 채권 */}
      {activeTab === "bonds" && (
        <div className="fade-in">
          {props.loadingBonds ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height={80} />)}
            </div>
          ) : props.bondError ? (
            <div style={{
              textAlign: "center", padding: "60px 0",
              color: "var(--text-muted)", fontSize: 13,
            }}>
              {t("bonds.error")}
              <br />
              <button
                onClick={props.onRetryBonds}
                style={{
                  marginTop: 12, padding: "6px 16px", borderRadius: 8,
                  background: "var(--accent-dim)", color: "var(--accent)",
                  border: "1px solid var(--accent-glow)", cursor: "pointer", fontSize: 12,
                }}
              >
                {t("common.retry")}
              </button>
            </div>
          ) : props.bondData ? (
            <BondsSection data={props.bondData.data} news={props.bondData.news} />
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
}

function MarketNavItem({ label, active, onClick }: {
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
