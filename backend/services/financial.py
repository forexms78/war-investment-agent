import time
import yfinance as yf
import requests
import statistics
from datetime import datetime, timedelta

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})
yf.utils.requests = _session  # type: ignore

# 인메모리 캐시 (ticker → (data, timestamp))
_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 900  # 15분


def _fetch_via_rest(ticker: str) -> dict | None:
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=30d"
        r = _session.get(url, timeout=10)
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
        chart = [
            {"date": datetime.fromtimestamp(timestamps[i]).strftime("%m/%d"), "price": round(closes[i], 2)}
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


def get_stock_data(ticker: str) -> dict:
    now = time.time()
    cached = _cache.get(ticker)
    if cached and now - cached[1] < CACHE_TTL:
        return cached[0]

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        end = datetime.today()
        start = end - timedelta(days=30)
        hist = t.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))
        if not hist.empty:
            closes = hist["Close"].tolist()
            dates = [d.strftime("%m/%d") for d in hist.index]
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
            _cache[ticker] = (result, time.time())
            return result
    except Exception:
        pass

    fallback = _fetch_via_rest(ticker)
    if fallback:
        result = {"ticker": ticker, "name": ticker, "sector": "", "industry": "", "market_cap": None, **fallback}
        _cache[ticker] = (result, time.time())
        return result

    return {"ticker": ticker, "name": ticker, "error": "데이터 수집 실패"}


def get_multiple_stocks(tickers: list[str]) -> dict[str, dict]:
    result = {}
    for i, ticker in enumerate(tickers):
        # 캐시 미스인 경우에만 delay로 rate limit 방지
        if ticker not in _cache and i > 0:
            time.sleep(0.5)
        result[ticker] = get_stock_data(ticker)
    return result
