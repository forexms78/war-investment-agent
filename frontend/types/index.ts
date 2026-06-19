export interface HoldingData {
  ticker: string;
  price?: number | null;
  change_1d_pct?: number | null;
  change_30d_pct?: number | null;
}

export interface InvestorSummary {
  id: string;
  name: string;
  title: string;
  firm: string;
  style: string;
  avatar_initial: string;
  color: string;
  description: string;
  known_for: string;
  top_holdings: string[];
  recent_moves: string;
  holdings_data: HoldingData[];
  total_positions?: number;
}

export interface PortfolioHolding {
  ticker: string;
  name: string;
  weight: number;
  shares: number;
  action: "buy" | "sell" | "hold";
  current_price?: number | null;
  change_30d_pct?: number | null;
  change_1d_pct?: number | null;
  sector?: string;
}

export interface NewsItem {
  title: string;
  description: string;
  source: string;
  published_at: string;
  url: string;
  image_url?: string;
}

export interface InvestorDetail {
  id: string;
  name: string;
  title: string;
  firm: string;
  style: string;
  avatar_initial: string;
  color: string;
  description: string;
  known_for: string;
  recent_moves: string;
  portfolio: PortfolioHolding[];
  news: NewsItem[];
  insight: string;
  total_positions?: number;
}

export interface ChartPoint {
  date: string;
  price: number;
}

export interface StockDetail {
  ticker: string;
  name: string;
  sector?: string;
  industry?: string;
  exchange?: string;
  description?: string;
  // 가격
  current_price?: number;
  prev_close?: number;
  day_high?: number;
  day_low?: number;
  change_30d_pct?: number;
  change_1d_pct?: number;
  volatility?: number;
  // 시장 지표
  market_cap?: number | null;
  volume?: number | null;
  avg_volume?: number | null;
  week52_high?: number | null;
  week52_low?: number | null;
  // 밸류에이션
  trailing_pe?: number | null;
  forward_pe?: number | null;
  eps?: number | null;
  price_to_book?: number | null;
  beta?: number | null;
  dividend_yield?: number | null;
  // 재무
  revenue?: number | null;
  gross_margins?: number | null;
  profit_margins?: number | null;
  roe?: number | null;
  revenue_growth?: number | null;
  // 애널리스트
  target_mean_price?: number | null;
  recommendation?: number | null;
  analyst_count?: number | null;
  // 차트 / 뉴스 / AI
  chart: ChartPoint[];
  news: NewsItem[];
  insight: string;
}

export interface HotStock {
  ticker: string;
  name: string;
  current_price?: number;
  change_30d_pct?: number;
  change_1d_pct?: number;
  sector?: string;
}

export interface ConsensusHolder {
  name: string;
  firm: string;
  color: string;
  weight: number;
  shares: number;
  action?: "buy" | "sell" | "hold";
}

export interface RecommendedStock {
  ticker: string;
  name: string;
  buyers?: string[];
  sellers?: string[];
  holders?: ConsensusHolder[];
  count: number;
  current_price?: number | null;
  change_30d_pct?: number | null;
}

export interface Holding13F {
  ticker: string;
  name: string;
  cusip?: string;
  value_usd: number;
  weight: number;
  shares: number;
  action: "buy" | "sell" | "hold";
}

export interface Quarter13F {
  as_of: string;
  as_of_date?: string;
  filed_date?: string;
  filing_id?: string;
  total_value_usd: number;
  count: number;
  holdings: Holding13F[];
}

export interface Investor13F {
  investor_id: string;
  quarters: Quarter13F[];
  updated_at?: string;
}

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_24h: number;
  price_change_7d: number;
  price_change_30d: number;
  sparkline: number[];
  image: string;
}

export interface RealEstateIndicator {
  label: string;
  value: string;
  change: string;
  unit: string;
  trend: "up" | "down" | "flat";
}

export interface CommodityData {
  ticker: string;
  name: string;
  category: string;
  current_price: number;
  change_30d_pct: number;
  change_1d_pct: number;
  chart: ChartPoint[];
  description: string;
}

export interface MoneyFlowAsset {
  category: string;
  name: string;
  value: string;
  change_30d: number | null;
  description: string;
  color: string;
  icon: string;
}

export interface DailySignalRecommendation {
  ticker: string;
  name: string;
  reason?: string;
  confidence?: number;
  signals?: string[];
}

export interface DailySignalDriver {
  headline: string;
  impact: string;
  direction: string;
}

export interface DailySignal {
  headline: string;
  sentiment: "Bullish" | "Neutral" | "Bearish";
  sentiment_score: number;
  market_summary: string;
  buy_recommendations: DailySignalRecommendation[];
  sell_recommendations: DailySignalRecommendation[];
  focus_list: DailySignalRecommendation[];
  market_drivers: DailySignalDriver[];
  fed_rate: number;
  updated_at: string;
  market_news?: NewsItem[];
  asia_news?: NewsItem[];
}

export interface KoreaRates {
  base_rate:         number | null;
  treasury_3y:       number | null;
  treasury_10y:      number | null;
  cd_rate:           number | null;
  usd_krw:           number | null;
  usd_krw_change_1d: number | null;
  updated_at:        string;
}

export interface MoneyFlowData {
  assets: MoneyFlowAsset[];
  rate_signal: { level: string; message: string };
  fed_rate: number;
  korea_rates?: KoreaRates;
}

export interface BondData {
  fed_rate: number;
  yield_10y: number | null;
  yield_10y_change: number | null;
  yield_3m: number | null;
  yield_3m_change: number | null;
  tlt_price: number | null;
  tlt_change_30d: number | null;
  tlt_change_1d: number | null;
  curve_inverted: boolean;
}

export interface NewsAIItem {
  title: string;
  source: string;
  published_at: string;
  url: string;
  image_url?: string;
  category: string;
  ai_summary: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface NewsAITheme {
  title: string;
  detail: string;
  assets: string[];
}

export interface NewsAIData {
  sentiment: "Bullish" | "Neutral" | "Bearish";
  sentiment_score: number;
  summary: string;
  themes: NewsAITheme[];
  news: NewsAIItem[];
  updated_at: string;
}

export type ETFSignal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
export type TrendPhase = "MARKUP" | "SIDEWAYS" | "MARKDOWN";
export type SafetyGrade = "SAFE" | "PARTIAL" | "DANGER";

export interface ETFSignalItem {
  ticker: string;
  name: string;
  category: string;
  description?: string;
  currency: string;
  current_price: number;
  rsi: number;
  week52_high: number;
  week52_low: number;
  week52_pos: number;
  ma50: number;
  ma200: number;
  above_ma50: boolean;
  above_ma200: boolean;
  golden_cross: boolean;
  change_7d: number | null;
  change_1m: number | null;
  change_3m: number | null;
  change_6m: number | null;
  change_1y: number;
  signal: ETFSignal;
  reason: string;
  trend_score?: number;
  trend_phase?: TrendPhase;
  safety?: SafetyGrade;
  total_assets?: number | null;
}

export interface ETFSignalsData {
  etfs: ETFSignalItem[];
  us_stocks: ETFSignalItem[];
  kr_stocks: ETFSignalItem[];
  updated_at: string | null;
}


// ETF Holdings
export interface ETFHoldingItem {
  ticker: string;
  name: string;
  weight: number;
  current_price?: number | null;
  change_1d_pct?: number | null;
  change_7d_pct?: number | null;
  change_1m_pct?: number | null;
  change_6m_pct?: number | null;
}

export interface ETFSectorWeight {
  sector: string;
  weight: number;
  color: string;
}

export interface ETFHoldingsData {
  ticker: string;
  holdings: ETFHoldingItem[];
  sector_weights: ETFSectorWeight[];
  source: string;
}

// ETF 신규상장 (국내·미국)
export type EtfLaunchStatus = "upcoming" | "recent";

export interface EtfLaunch {
  ticker: string;
  name: string;
  issuer?: string | null;       // 운용사 (TIGER / KODEX / ACE / SOL / RISE 등)
  launch_date: string;          // 상장(예정)일 — D-day 계산 기준
  status: EtfLaunchStatus;      // upcoming(상장예정) | recent(최근상장)
  index_name?: string | null;   // 추종지수/테마
  category?: string | null;     // 카테고리
  ai_oneliner?: string | null;  // AI 한줄 요약
}

export interface EtfLaunchHolding {
  name: string;
  weight: number | null;        // KR은 비중 파싱 실패 시 null 가능 (UI는 null 가드 후 표기)
}

export interface EtfLaunchDetail extends EtfLaunch {
  holdings: EtfLaunchHolding[]; // 예정 건은 빈 배열일 수 있음
  ai_explanation?: string | null;
  as_of?: string | null;        // 데이터 기준 시각
}

export interface EtfLaunchListResponse {
  as_of?: string | null;
  upcoming: EtfLaunch[];
  recent: EtfLaunch[];
}

// My Lab
export interface AnalysisFile {
  name: string;
  path: string;
  title: string;
  sha: string;
  size: number;
}

export interface AnalysisContent {
  name: string;
  title: string;
  content: string;
  sha: string;
}
