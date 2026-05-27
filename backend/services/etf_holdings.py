"""ETF 편입 종목(Holdings) 조회 서비스

Yahoo Finance v10 quoteSummary topHoldings 모듈 사용.
미국 ETF 전용 — 한국 ETF(.KS)는 description 기반 안내 반환.
"""
import json
import requests
from backend.services.db_cache import db_get, db_set

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})

SECTOR_COLORS = {
    "Technology":          "#3b82f6",
    "Communication Services": "#8b5cf6",
    "Consumer Cyclical":   "#f59e0b",
    "Consumer Defensive":  "#10b981",
    "Healthcare":          "#ef4444",
    "Financial Services":  "#06b6d4",
    "Industrials":         "#6366f1",
    "Energy":              "#f97316",
    "Basic Materials":     "#84cc16",
    "Real Estate":         "#ec4899",
    "Utilities":           "#64748b",
}

HOLDINGS_TTL = 86400  # 24시간


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


def get_etf_holdings(ticker: str) -> dict:
    cache_key = f"etf_holdings:{ticker}"
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

    result = {
        "ticker":         ticker,
        "holdings":       data["holdings"],
        "sector_weights": data["sector_weights"],
        "source":         "yahoo",
    }
    db_set(cache_key, result)
    return result
