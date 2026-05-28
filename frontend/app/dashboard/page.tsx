"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  InvestorSummary, HotStock, RecommendedStock, CoinData,
  RealEstateIndicator, MoneyFlowAsset, NewsItem, CommodityData,
  KoreaRates, BondData, ETFSignalsData, ETFSignalItem,
} from "@/types";
import MoneyFlowSection from "@/components/MoneyFlowSection";
import SkeletonCard from "@/components/SkeletonCard";
import MarketsSection from "@/components/MarketsSection";
import ETFStockSection from "@/components/ETFStockSection";
import HeroSection from "@/components/HeroSection";
import Tooltip from "@/components/Tooltip";
import MyLabSection from "@/components/MyLabSection";
import { useT } from "@/contexts/LanguageContext";

const InvestorModal      = dynamic(() => import("@/components/InvestorModal"));
const StockModal         = dynamic(() => import("@/components/StockModal"));
const ETFHoldingsModal   = dynamic(() => import("@/components/ETFHoldingsModal"));
const ForeignFlowSection = dynamic(() => import("@/components/ForeignFlowSection"));

const API = process.env.NEXT_PUBLIC_API_URL;

type Tab = "etfstocks" | "markets" | "foreign" | "mylab";
type MarketTab = "stocks" | "investors" | "crypto" | "realestate" | "commodities" | "bonds" | "rates";

function fmtTime(d: Date) {
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

export default function Home() {
  const { t, lang, toggleLang } = useT();
  const [activeTab, setActiveTab] = useState<Tab>("etfstocks");
  const [marketSubTab, setMarketSubTab] = useState<MarketTab>("stocks");

  // 공통 데이터
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [hotStocks, setHotStocks] = useState<HotStock[]>([]);
  const [recommendations, setRecommendations] = useState<{ buy: RecommendedStock[]; sell: RecommendedStock[] } | null>(null);
  const [moneyFlow, setMoneyFlow] = useState<{ assets: MoneyFlowAsset[]; rate_signal: { level: string; message: string }; fed_rate: number; korea_rates?: KoreaRates } | null>(null);
  const [etfSignals, setEtfSignals] = useState<ETFSignalsData | null>(null);
  const [selectedEtf, setSelectedEtf] = useState<ETFSignalItem | null>(null);
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [initialFetchedAt, setInitialFetchedAt] = useState<Date | null>(null);
  const [marketDrivers, setMarketDrivers] = useState<{ headline: string; impact: string; direction: string; url?: string; source?: string }[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const etfSignalsForHero = etfSignals?.etfs ?? [];

  // 마켓 서브 데이터 (lazy)
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [loadingCrypto, setLoadingCrypto] = useState(false);

  const [reData, setReData] = useState<{ indicators: RealEstateIndicator[]; news: NewsItem[] } | null>(null);
  const [loadingRE, setLoadingRE] = useState(false);

  const [commodityData, setCommodityData] = useState<{ commodities: CommodityData[]; news: NewsItem[] } | null>(null);
  const [loadingCommodity, setLoadingCommodity] = useState(false);

  const [bondData, setBondData] = useState<{ data: BondData; news: NewsItem[] } | null>(null);
  const [loadingBonds, setLoadingBonds] = useState(false);
  const [bondError, setBondError] = useState(false);

  const [selectedInvestor, setSelectedInvestor] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const heroReturn = useMemo(() => {
    if (etfSignalsForHero.length === 0) return 8.5;
    const returns = etfSignalsForHero
      .map(e => e.change_1y)
      .filter((v): v is number => v != null);
    if (returns.length === 0) return 8.5;
    return returns.reduce((s, v) => s + v, 0) / returns.length;
  }, [etfSignalsForHero]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // 마켓 드라이버 (초기 로드)
  useEffect(() => {
    fetch(`${API}/market-driver`)
      .then(r => r.json())
      .then(data => setMarketDrivers(data.drivers || []))
      .finally(() => setLoadingDrivers(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/investors`).then(r => r.json()),
      fetch(`${API}/stocks/hot`).then(r => r.json()),
      fetch(`${API}/stocks/recommendations`).then(r => r.json()),
      fetch(`${API}/money-flow`).then(r => r.json()),
      fetch(`${API}/etf-signals`).then(r => r.json()),
    ]).then(([invData, stockData, recData, flowData, etfData]) => {
      setInvestors(invData.investors || []);
      setHotStocks(stockData.stocks || []);
      setRecommendations(recData);
      setMoneyFlow(flowData);
      if (etfData && Array.isArray(etfData.etfs)) {
        setEtfSignals(etfData);
      }
      setInitialFetchedAt(new Date());
    }).finally(() => setLoadingInvestors(false));
  }, []);

  // Lazy 로더
  function loadCrypto() {
    if (coins.length > 0) return;
    setLoadingCrypto(true);
    fetch(`${API}/crypto`).then(r => r.json()).then(data => {
      setCoins(data.coins || []);
      setCryptoNews(data.news || []);
    }).finally(() => setLoadingCrypto(false));
  }

  function loadRE() {
    if (reData) return;
    setLoadingRE(true);
    fetch(`${API}/realestate`).then(r => r.json()).then(setReData).finally(() => setLoadingRE(false));
  }

  function loadCommodity() {
    if (commodityData) return;
    setLoadingCommodity(true);
    fetch(`${API}/commodities`).then(r => r.json()).then(setCommodityData).finally(() => setLoadingCommodity(false));
  }

  function loadBonds() {
    if (bondData) return;
    setBondError(false);
    setLoadingBonds(true);
    fetch(`${API}/bonds`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(setBondData)
      .catch(() => setBondError(true))
      .finally(() => setLoadingBonds(false));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "etfstocks", label: t("tab.etfstocks") },
    { id: "markets",   label: t("tab.markets")   },
    { id: "foreign",   label: t("tab.foreign")   },
    { id: "mylab",     label: t("tab.mylab")     },
  ];

  const FED_TOOLTIP = t("tooltip.fed");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {loadingInvestors && (
        <div style={{
          position: "fixed", top: 60, left: 0, right: 0, height: 2, zIndex: 200,
          overflow: "hidden", background: "var(--border)",
        }}>
          <div style={{
            height: "100%", background: "var(--accent)",
            animation: "loadingBar 1.8s ease-in-out infinite", transformOrigin: "left",
          }} />
        </div>
      )}
      {/* 헤더 */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--header-bg)", backdropFilter: "blur(16px)",
      }}>
        <div className="header-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="header-top-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, textDecoration: "none", color: "inherit" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "var(--accent)", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>W</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.03em" }}>Whalyx</span>
            </Link>
            <button
              onClick={toggleTheme}
              style={{
                background: "var(--bg-2)", border: "1px solid var(--border)",
                borderRadius: 999, padding: "5px 10px", cursor: "pointer",
                fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
                transition: "all 0.15s", flexShrink: 0, letterSpacing: "0.06em",
              }}
            >
              {theme === "dark" ? t("theme.light") : t("theme.dark")}
            </button>
          </div>

          <nav className="header-nav" style={{ display: "flex", gap: 4 }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className="tab-btn"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? "var(--accent-dim)" : "transparent",
                  border: activeTab === tab.id ? "1px solid var(--accent-glow)" : "1px solid transparent",
                  borderRadius: 8, padding: "6px 14px",
                  color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="header-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 8px var(--green)",
              animation: "pulseLive 2.4s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.10em", fontWeight: 700 }}>
              {t("live")}
            </span>
            <button
              onClick={toggleLang}
              title={lang === "ko" ? t("lang.title.toEn") : t("lang.title.toKo")}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 10, fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "all 0.15s",
                marginLeft: 4,
              }}
            >
              {lang === "ko" ? t("lang.en") : t("lang.ko")}
            </button>
          </div>
        </div>
      </header>

      {/* 티커 바 */}
      {moneyFlow && (
        <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto", padding: "0 24px",
            height: 38, display: "flex", alignItems: "center", gap: 0,
            overflowX: "auto", scrollbarWidth: "none",
          }}>
            {/* Fed Rate — 툴팁 포함 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
              <Tooltip content={FED_TOOLTIP} width={320}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Fed Rate</span>
                <span style={{
                  fontSize: 9, marginLeft: 3, color: "var(--accent)",
                  border: "1px solid var(--accent-glow)", borderRadius: 3,
                  padding: "0 4px", fontWeight: 600,
                }}>?</span>
              </Tooltip>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{moneyFlow.fed_rate}%</span>
              <Tooltip content={t("tooltip.fed.target")} width={260}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", cursor: "help", textDecoration: "underline dotted" }}>3.50–3.75 target</span>
              </Tooltip>
            </div>

            {/* 자산별 30일 수익률 */}
            {moneyFlow.assets.slice(0, 4).map(asset => {
              const chg = asset.change_30d ?? 0;
              const isUp = chg >= 0;
              return (
                <div key={asset.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
                  <Tooltip content={`${asset.name}\n\n${asset.description}\n\n${t("tooltip.asset.30d")}`} width={240}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, cursor: "help" }}>{asset.name.split(" ")[0]}</span>
                  </Tooltip>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isUp ? "var(--green)" : "var(--red)" }}>
                    {isUp ? "+" : ""}{chg.toFixed(1)}%
                  </span>
                </div>
              );
            })}

            {/* KRW/USD */}
            {moneyFlow.korea_rates?.usd_krw && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", flexShrink: 0 }}>
                <Tooltip content={`${t("tooltip.krwusd")}\n\n${initialFetchedAt ? `${t("data.refresh")}: ${fmtTime(initialFetchedAt)}` : ""}`} width={240}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, cursor: "help" }}>KRW/USD</span>
                </Tooltip>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                  {moneyFlow.korea_rates.usd_krw.toLocaleString("ko-KR")}
                </span>
                {moneyFlow.korea_rates.usd_krw_change_1d != null && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: moneyFlow.korea_rates.usd_krw_change_1d >= 0 ? "var(--red)" : "var(--green)" }}>
                    {moneyFlow.korea_rates.usd_krw_change_1d >= 0 ? "+" : ""}{moneyFlow.korea_rates.usd_krw_change_1d.toFixed(2)}%
                  </span>
                )}
              </div>
            )}

            {/* 데이터 갱신 시간 */}
            {initialFetchedAt && (
              <div style={{ padding: "0 16px", flexShrink: 0, marginLeft: "auto" }}>
                <Tooltip content={t("tooltip.refresh")} width={220}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", cursor: "help" }}>
                    {t("data.refresh")} {fmtTime(initialFetchedAt)}
                  </span>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>

        {/* ETF·주식 — 메인 랜딩 */}
        {activeTab === "etfstocks" && (
          <div className="fade-in">
            <ETFStockSection
              onSelect={setSelectedStock}
              onSelectEtf={setSelectedEtf}
              usdKrw={moneyFlow?.korea_rates?.usd_krw ?? undefined}
              data={etfSignals}
              fedRate={moneyFlow?.fed_rate}
              krwUsd={moneyFlow?.korea_rates?.usd_krw ?? undefined}
              krwUsdChange={moneyFlow?.korea_rates?.usd_krw_change_1d ?? undefined}
              marketDrivers={marketDrivers}
            />

            {/* MoneyFlowSection 비활성 — 데이터는 유지, 다른 탭에서 재사용 예정 */}
          </div>
        )}

        {/* 마켓 (통합) */}
        {activeTab === "markets" && (
          <div className="fade-in">
            <MarketsSection
              activeSubTab={marketSubTab}
              onSubTabChange={setMarketSubTab}
              hotStocks={hotStocks}
              recommendations={recommendations}
              investors={investors}
              loadingInvestors={loadingInvestors}
              onSelectStock={setSelectedStock}
              onSelectInvestor={setSelectedInvestor}
              usd_krw={moneyFlow?.korea_rates?.usd_krw ?? undefined}
              coins={coins}
              cryptoNews={cryptoNews}
              loadingCrypto={loadingCrypto}
              onLoadCrypto={loadCrypto}
              reData={reData}
              loadingRE={loadingRE}
              onLoadRE={loadRE}
              commodityData={commodityData}
              loadingCommodity={loadingCommodity}
              onLoadCommodity={loadCommodity}
              bondData={bondData}
              loadingBonds={loadingBonds}
              bondError={bondError}
              onLoadBonds={loadBonds}
              onRetryBonds={() => { setBondData(null); setBondError(false); loadBonds(); }}
            />
          </div>
        )}

        {activeTab === "foreign" && (
          <div className="fade-in">
            <ForeignFlowSection />
          </div>
        )}

        {activeTab === "mylab" && (
          <MyLabSection />
        )}
      </main>

      {selectedInvestor && (
        <InvestorModal investorId={selectedInvestor} onClose={() => setSelectedInvestor(null)} />
      )}
      {selectedStock && (
        <StockModal ticker={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
      {selectedEtf && (
        <ETFHoldingsModal
          etf={selectedEtf}
          onClose={() => setSelectedEtf(null)}
          onSelectStock={(ticker) => { setSelectedEtf(null); setSelectedStock(ticker); }}
          usdKrw={moneyFlow?.korea_rates?.usd_krw ?? undefined}
        />
      )}
    </div>
  );
}
