"""Finnhub API — 미국 주식 시세/펀더멘털/뉴스/애널리스트"""
import os
import time
import requests

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
_BASE = "https://finnhub.io/api/v1"
_cache: dict = {}
_QUOTE_TTL = 300       # 시세 5분
_PROFILE_TTL = 86400   # 프로필 24시간
_METRIC_TTL = 3600     # 펀더멘털 1시간
_NEWS_TTL = 600        # 뉴스 10분

_session = requests.Session()


def _get(path: str, params: dict, ttl: int) -> dict | list | None:
    cache_key = f"fh:{path}:{sorted(params.items())}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[1] < ttl:
        return cached[0]

    if not FINNHUB_API_KEY:
        return None

    try:
        params["token"] = FINNHUB_API_KEY
        r = _session.get(f"{_BASE}{path}", params=params, timeout=8)
        if r.status_code == 429:
            time.sleep(1)
            r = _session.get(f"{_BASE}{path}", params=params, timeout=8)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data.get("error"):
            return None
        _cache[cache_key] = (data, time.time())
        return data
    except Exception:
        return None


def get_quote(symbol: str) -> dict | None:
    """실시간 시세: c(현재가), d(변동), dp(변동%), h/l/o/pc"""
    data = _get("/quote", {"symbol": symbol}, _QUOTE_TTL)
    if data and data.get("c", 0) > 0:
        return data
    return None


def get_profile(symbol: str) -> dict | None:
    """기업 프로필: name, logo, marketCap, industry, exchange"""
    return _get("/stock/profile2", {"symbol": symbol}, _PROFILE_TTL)


def get_metrics(symbol: str) -> dict | None:
    """펀더멘털 지표: PER, PBR, ROE, 52주, 베타 등"""
    data = _get("/stock/metric", {"symbol": symbol, "metric": "all"}, _METRIC_TTL)
    if data:
        return data.get("metric")
    return None


def get_recommendation(symbol: str) -> list | None:
    """애널리스트 추천: buy/hold/sell/strongBuy/strongSell"""
    return _get("/stock/recommendation", {"symbol": symbol}, _METRIC_TTL)


def get_earnings(symbol: str) -> list | None:
    """실적: EPS actual/estimate/surprise"""
    return _get("/stock/earnings", {"symbol": symbol}, _METRIC_TTL)


def get_company_news(symbol: str, days: int = 7) -> list | None:
    """종목 뉴스 (최근 N일)"""
    from datetime import datetime, timedelta
    to_date = datetime.now().strftime("%Y-%m-%d")
    from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    data = _get("/company-news", {"symbol": symbol, "from": from_date, "to": to_date}, _NEWS_TTL)
    if isinstance(data, list):
        return data[:20]
    return None


def get_market_news(category: str = "general") -> list | None:
    """마켓 뉴스"""
    data = _get("/news", {"category": category}, _NEWS_TTL)
    if isinstance(data, list):
        return data[:30]
    return None


def get_insider_transactions(symbol: str) -> list | None:
    """내부자 거래"""
    data = _get("/stock/insider-transactions", {"symbol": symbol}, _METRIC_TTL)
    if isinstance(data, dict):
        return data.get("data", [])[:20]
    return None


def get_peers(symbol: str) -> list | None:
    """동종업계 티커 목록"""
    return _get("/stock/peers", {"symbol": symbol}, _PROFILE_TTL)


def get_market_status(exchange: str = "US") -> dict | None:
    """시장 개장/폐장 상태"""
    return _get("/stock/market-status", {"exchange": exchange}, 300)


def get_earnings_calendar(from_date: str, to_date: str) -> list | None:
    """어닝 캘린더"""
    data = _get("/calendar/earnings", {"from": from_date, "to": to_date}, _METRIC_TTL)
    if isinstance(data, dict):
        return data.get("earningsCalendar", [])
    return None
