"""ETF 편입 종목(Holdings) 조회 서비스

Yahoo Finance v10 quoteSummary topHoldings + v8 chart 가격 이력.
편입 종목별 현재가·1일·7일·1개월·6개월 등락률 제공.
"""
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from backend.services.db_cache import db_get, db_set

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})

SECTOR_COLORS = {
    "Technology":             "#3b82f6",
    "Communication Services": "#8b5cf6",
    "Consumer Cyclical":      "#f59e0b",
    "Consumer Defensive":     "#10b981",
    "Healthcare":             "#ef4444",
    "Financial Services":     "#06b6d4",
    "Industrials":            "#6366f1",
    "Energy":                 "#f97316",
    "Basic Materials":        "#84cc16",
    "Real Estate":            "#ec4899",
    "Utilities":              "#64748b",
}

HOLDINGS_TTL = 86400


def _fetch_yahoo_holdings(ticker: str) -> dict | None:
    try:
        url = (
            f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
            f"?modules=topHoldings"
        )
        r = _session.get(url, timeout=12)
        r.raise_for_status()
        result = r.json()["quoteSummary"]["result"][0]["topHoldings"]

        holdings = []
        for h in result.get("holdings", []):
            pct = h.get("holdingPercent", {})
            weight = pct.get("raw", 0) * 100 if isinstance(pct, dict) else (pct or 0) * 100
            holdings.append({
                "ticker": h.get("symbol", ""),
                "name":   h.get("holdingName", ""),
                "weight": round(weight, 2),
            })

        sector_weights = []
        for sw in result.get("sectorWeightings", []):
            for sector, val in sw.items():
                pct_val = val.get("raw", 0) * 100 if isinstance(val, dict) else (val or 0) * 100
                if pct_val > 0.1:
                    sector_weights.append({
                        "sector": sector.replace("_", " ").title(),
                        "weight": round(pct_val, 2),
                        "color":  SECTOR_COLORS.get(sector.replace("_", " ").title(), "#94a3b8"),
                    })
        sector_weights.sort(key=lambda x: -x["weight"])

        if not holdings:
            return None

        return {
            "holdings":       holdings,
            "sector_weights": sector_weights,
        }
    except Exception as e:
        print(f"[etf_holdings] Yahoo fetch failed for {ticker}: {e}")
        return None


def _fetch_stock_perf(ticker: str) -> dict:
    """v8 chart 6mo 일봉으로 현재가 + 1d/7d/1m/6m 등락률 계산."""
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=6mo"
        r = _session.get(url, timeout=10)
        r.raise_for_status()
        result = r.json()["chart"]["result"][0]
        closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
        if len(closes) < 2:
            return {}
        current = closes[-1]

        def chg(n: int) -> float | None:
            if len(closes) <= n:
                return None
            return round((current - closes[-n - 1]) / closes[-n - 1] * 100, 2)

        return {
            "current_price": round(current, 2),
            "change_1d_pct": chg(1),
            "change_7d_pct": chg(5),
            "change_1m_pct": chg(21),
            "change_6m_pct": chg(len(closes) - 1),
        }
    except Exception:
        return {}


def _fetch_holding_prices(tickers: list[str]) -> dict[str, dict]:
    """편입 종목 가격·등락률 병렬 조회."""
    result: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(_fetch_stock_perf, t): t for t in tickers[:15]}
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                data = fut.result()
                if data:
                    result[t] = data
            except Exception:
                pass
    return result


def get_etf_holdings(ticker: str) -> dict:
    cache_key = f"etf_holdings_v3:{ticker}"
    cached = db_get(cache_key, ttl=HOLDINGS_TTL)
    if cached:
        return cached

    data = _fetch_yahoo_holdings(ticker)
    if not data:
        return {
            "ticker":         ticker,
            "holdings":       [],
            "sector_weights": [],
            "source":         "unavailable",
        }

    holding_tickers = [h["ticker"] for h in data["holdings"] if h["ticker"]]
    prices = _fetch_holding_prices(holding_tickers)

    for h in data["holdings"]:
        p = prices.get(h["ticker"], {})
        h["current_price"] = p.get("current_price")
        h["change_1d_pct"] = p.get("change_1d_pct")
        h["change_7d_pct"] = p.get("change_7d_pct")
        h["change_1m_pct"] = p.get("change_1m_pct")
        h["change_6m_pct"] = p.get("change_6m_pct")

    result = {
        "ticker":         ticker,
        "holdings":       data["holdings"],
        "sector_weights": data["sector_weights"],
        "source":         "yahoo",
    }
    db_set(cache_key, result)
    return result
