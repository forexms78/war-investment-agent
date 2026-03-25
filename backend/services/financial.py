import time
import asyncio
import httpx
import yfinance as yf
import requests
import statistics
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})
yf.utils.requests = _session  # type: ignore

_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 900  # 15분
_executor = ThreadPoolExecutor(max_workers=12)


_PERIOD_CONFIG = {
    "30d": {"yf_period": "1mo", "yf_interval": "1d", "rest_interval": "1d", "rest_range": "30d", "days": 35},
    "7d":  {"yf_period": "7d",  "yf_interval": "15m", "rest_interval": "15m", "rest_range": "7d", "days": 10},
    "1d":  {"yf_period": "1d",  "yf_interval": "5m",  "rest_interval": "5m",  "rest_range": "1d", "days": 2},
}


def _fetch_via_rest(ticker: str, period: str = "30d") -> dict | None:
    try:
        cfg = _PERIOD_CONFIG.get(period, _PERIOD_CONFIG["30d"])
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval={cfg['rest_interval']}&range={cfg['rest_range']}"
        r = _session.get(url, timeout=8)
        r.raise_for_status()
        data = r.json()["chart"]["result"][0]
        closes = [c for c in data["indicators"]["quote"][0]["close"] if c is not None]
        if not closes:
            return None
        timestamps = data.get("timestamp", [])
        current = closes[-1]
        prev = closes[0]
        change_pct = round((current - prev) / prev * 100, 2)
        changes = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
        date_fmt = "%H:%M" if period in ("1d", "7d") else "%m/%d"
        chart = [
            {"date": datetime.fromtimestamp(timestamps[i]).strftime(date_fmt), "price": round(closes[i], 2)}
            for i in range(len(closes))
            if i < len(timestamps)
        ] if timestamps else []
        return {
            "current_price": round(current, 2),
            "prev_price": round(prev, 2),
            "change_30d_pct": change_pct,
            "change_1d_pct": round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) > 1 else 0,
            "volatility": round(statistics.stdev(changes), 2) if len(changes) > 1 else 0,
            "chart": chart[-20:],
        }
    except Exception:
        return None


def get_stock_data(ticker: str, period: str = "30d") -> dict:
    cache_key = f"{ticker}_{period}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached[1] < CACHE_TTL:
        return cached[0]

    cfg = _PERIOD_CONFIG.get(period, _PERIOD_CONFIG["30d"])

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        hist = t.history(period=cfg["yf_period"], interval=cfg["yf_interval"])
        if not hist.empty:
            closes = hist["Close"].tolist()
            date_fmt = "%H:%M" if cfg["yf_interval"] in ("5m", "15m") else "%m/%d"
            dates = [d.strftime(date_fmt) for d in hist.index]
            current = round(float(closes[-1]), 2)
            prev = round(float(closes[0]), 2)
            change_pct = round((current - prev) / prev * 100, 2)
            changes = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
            result = {
                "ticker": ticker,
                "name": info.get("longName") or info.get("shortName") or ticker,
                "sector": info.get("sector", ""),
                "industry": info.get("industry", ""),
                "market_cap": info.get("marketCap"),
                "current_price": current,
                "prev_price": prev,
                "change_30d_pct": change_pct,
                "change_1d_pct": round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) > 1 else 0,
                "volatility": round(statistics.stdev(changes), 2) if len(changes) > 1 else 0,
                "chart": [{"date": dates[i], "price": round(closes[i], 2)} for i in range(len(closes))][-20:],
            }
            _cache[cache_key] = (result, time.time())
            return result
    except Exception:
        pass

    fallback = _fetch_via_rest(ticker, period)
    if fallback:
        result = {"ticker": ticker, "name": ticker, "sector": "", "industry": "", "market_cap": None, **fallback}
        _cache[cache_key] = (result, time.time())
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
