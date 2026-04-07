import time
import asyncio
import httpx
import yfinance as yf
import requests
import statistics
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from backend.services.db_cache import db_get, db_set

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})
yf.utils.requests = _session  # type: ignore

_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 900  # 15분
FUND_CACHE_TTL = 86400  # 펀더멘털 24시간
_executor = ThreadPoolExecutor(max_workers=12)


_PERIOD_CONFIG = {
    "1d":  {"yf_period": "1d",  "yf_interval": "5m",  "rest_interval": "5m",  "rest_range": "1d",  "date_fmt": "%H:%M"},
    "7d":  {"yf_period": "7d",  "yf_interval": "15m", "rest_interval": "15m", "rest_range": "7d",  "date_fmt": "%m/%d"},
    "30d": {"yf_period": "1mo", "yf_interval": "1d",  "rest_interval": "1d",  "rest_range": "1mo", "date_fmt": "%m/%d"},
    "3mo": {"yf_period": "3mo", "yf_interval": "1d",  "rest_interval": "1d",  "rest_range": "3mo", "date_fmt": "%m/%d"},
    "1y":  {"yf_period": "1y",  "yf_interval": "1wk", "rest_interval": "1wk", "rest_range": "1y",  "date_fmt": "%y/%m"},
}

# 차트 포인트 수 (기간별)
_CHART_POINTS = {"1d": 78, "7d": 80, "30d": 30, "3mo": 90, "1y": 52}


def _fetch_via_rest(ticker: str, period: str = "30d") -> dict | None:
    """Yahoo Finance v8 chart REST API — 한국 IP 우회용. meta에서 기본 지표 추출."""
    try:
        cfg = _PERIOD_CONFIG.get(period, _PERIOD_CONFIG["30d"])
        url = (
            f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
            f"?interval={cfg['rest_interval']}&range={cfg['rest_range']}"
        )
        r = _session.get(url, timeout=8)
        r.raise_for_status()
        result_data = r.json()["chart"]["result"][0]
        meta = result_data.get("meta", {})
        closes = [c for c in result_data["indicators"]["quote"][0]["close"] if c is not None]
        if not closes:
            return None
        timestamps = result_data.get("timestamp", [])
        current = closes[-1]
        prev = closes[0]
        change_pct = round((current - prev) / prev * 100, 2)
        changes = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
        date_fmt = cfg["date_fmt"]
        max_pts = _CHART_POINTS.get(period, 30)
        step = max(1, len(closes) // max_pts)
        chart = [
            {"date": datetime.fromtimestamp(timestamps[i]).strftime(date_fmt), "price": round(closes[i], 2)}
            for i in range(0, len(closes), step)
            if i < len(timestamps)
        ]
        return {
            "current_price":     round(current, 2),
            "prev_price":        round(prev, 2),
            "change_30d_pct":    change_pct,
            "change_1d_pct":     round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) > 1 else 0,
            "volatility":        round(statistics.stdev(changes), 2) if len(changes) > 1 else 0,
            "chart":             chart,
            # meta에서 추출 (quoteSummary 없이도 가능)
            "name":              meta.get("longName") or meta.get("shortName") or ticker,
            "week52_high":       meta.get("fiftyTwoWeekHigh"),
            "week52_low":        meta.get("fiftyTwoWeekLow"),
            "day_high":          meta.get("regularMarketDayHigh"),
            "day_low":           meta.get("regularMarketDayLow"),
            "volume":            meta.get("regularMarketVolume"),
            "prev_close":        meta.get("chartPreviousClose"),
            "exchange":          meta.get("fullExchangeName"),
        }
    except Exception:
        return None


def _fetch_fundamentals(ticker: str) -> dict:
    """yfinance t.info 펀더멘털 — Supabase 24h 캐시로 Railway 429 완화."""
    cache_key = f"fund_{ticker}"
    # Supabase 캐시
    cached = db_get(cache_key, FUND_CACHE_TTL)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        result = {
            "sector":              info.get("sector", ""),
            "industry":            info.get("industry", ""),
            "market_cap":          info.get("marketCap"),
            "trailing_pe":         info.get("trailingPE"),
            "forward_pe":          info.get("forwardPE"),
            "eps":                 info.get("trailingEps"),
            "price_to_book":       info.get("priceToBook"),
            "beta":                info.get("beta"),
            "dividend_yield":      info.get("dividendYield"),
            "week52_high":         info.get("fiftyTwoWeekHigh"),
            "week52_low":          info.get("fiftyTwoWeekLow"),
            "avg_volume":          info.get("averageVolume"),
            "revenue":             info.get("totalRevenue"),
            "gross_margins":       info.get("grossMargins"),
            "profit_margins":      info.get("profitMargins"),
            "roe":                 info.get("returnOnEquity"),
            "revenue_growth":      info.get("revenueGrowth"),
            "target_mean_price":   info.get("targetMeanPrice"),
            "recommendation":      info.get("recommendationMean"),
            "analyst_count":       info.get("numberOfAnalystOpinions"),
            "description":         (info.get("longBusinessSummary") or "")[:500],
            "name":                info.get("longName") or info.get("shortName") or ticker,
        }
        db_set(cache_key, result)
        return result
    except Exception:
        return {}


def get_stock_data(ticker: str, period: str = "30d") -> dict:
    cache_key = f"{ticker}_{period}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached[1] < CACHE_TTL:
        return cached[0]

    cfg = _PERIOD_CONFIG.get(period, _PERIOD_CONFIG["30d"])

    # v8 REST로 차트 + 기본 지표
    rest_data = _fetch_via_rest(ticker, period)

    # 펀더멘털 (Supabase 캐시 24h)
    fund = _fetch_fundamentals(ticker)

    if rest_data:
        result = {
            "ticker":   ticker,
            "name":     fund.get("name") or rest_data.get("name", ticker),
            "sector":   fund.get("sector", ""),
            "industry": fund.get("industry", ""),
            # 가격 / 차트
            "current_price":  rest_data["current_price"],
            "prev_price":     rest_data["prev_price"],
            "change_30d_pct": rest_data["change_30d_pct"],
            "change_1d_pct":  rest_data["change_1d_pct"],
            "volatility":     rest_data["volatility"],
            "chart":          rest_data["chart"],
            # 시장 지표 (meta 우선, fund 폴백)
            "week52_high":    rest_data.get("week52_high") or fund.get("week52_high"),
            "week52_low":     rest_data.get("week52_low") or fund.get("week52_low"),
            "day_high":       rest_data.get("day_high"),
            "day_low":        rest_data.get("day_low"),
            "volume":         rest_data.get("volume"),
            "prev_close":     rest_data.get("prev_close"),
            "exchange":       rest_data.get("exchange"),
            # 펀더멘털
            "market_cap":     fund.get("market_cap"),
            "trailing_pe":    fund.get("trailing_pe"),
            "forward_pe":     fund.get("forward_pe"),
            "eps":            fund.get("eps"),
            "price_to_book":  fund.get("price_to_book"),
            "beta":           fund.get("beta"),
            "dividend_yield": fund.get("dividend_yield"),
            "avg_volume":     fund.get("avg_volume"),
            "revenue":        fund.get("revenue"),
            "gross_margins":  fund.get("gross_margins"),
            "profit_margins": fund.get("profit_margins"),
            "roe":            fund.get("roe"),
            "revenue_growth": fund.get("revenue_growth"),
            "target_mean_price": fund.get("target_mean_price"),
            "recommendation": fund.get("recommendation"),
            "analyst_count":  fund.get("analyst_count"),
            "description":    fund.get("description", ""),
        }
        _cache[cache_key] = (result, now)
        return result

    return {"ticker": ticker, "name": ticker, "error": "데이터 수집 실패"}


async def get_multiple_stocks_parallel(tickers: list[str], period: str = "30d") -> dict[str, dict]:
    """병렬로 여러 종목 데이터를 동시 조회"""
    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(_executor, get_stock_data, t, period) for t in tickers]
    results = await asyncio.gather(*tasks)
    return {tickers[i]: results[i] for i in range(len(tickers))}


def get_multiple_stocks(tickers: list[str], period: str = "30d") -> dict[str, dict]:
    """동기 버전 (하위 호환)"""
    return asyncio.run(get_multiple_stocks_parallel(tickers, period))
