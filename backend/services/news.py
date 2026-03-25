import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWS_API_URL = "https://newsapi.org/v2/everything"

_news_cache: dict[str, tuple[list[dict], float]] = {}
NEWS_CACHE_TTL = 900  # 15분


def _fetch_news(q: str, limit: int, language: str = "en") -> list[dict]:
    cache_key = f"{q}_{limit}_{language}"
    now = time.time()
    cached = _news_cache.get(cache_key)
    if cached and now - cached[1] < NEWS_CACHE_TTL:
        return cached[0]

    try:
        params = {
            "q": q,
            "language": language,
            "sortBy": "publishedAt",
            "pageSize": limit,
            "apiKey": NEWS_API_KEY,
        }
        r = requests.get(NEWS_API_URL, params=params, timeout=10)
        r.raise_for_status()
        articles = r.json().get("articles", [])
        result = [
            {
                "title": a["title"],
                "description": a.get("description", ""),
                "source": a["source"]["name"],
                "published_at": a["publishedAt"],
                "url": a["url"],
                "image_url": a.get("urlToImage", ""),
            }
            for a in articles
            if a.get("title") and "[Removed]" not in a.get("title", "")
        ]
        _news_cache[cache_key] = (result, time.time())
        return result
    except Exception:
        return []


def fetch_investor_news(investor_name: str, limit: int = 6) -> list[dict]:
    """투자자 이름으로 뉴스 조회 — 단계적 쿼리"""
    for q in [f'"{investor_name}"', investor_name]:
        results = _fetch_news(q, limit)
        if results:
            return results
    return []


def fetch_stock_news(ticker: str, limit: int = 5) -> list[dict]:
    """종목 뉴스"""
    return _fetch_news(ticker, limit)


def fetch_crypto_news(limit: int = 8) -> list[dict]:
    """코인/암호화폐 최신 뉴스"""
    results = _fetch_news("bitcoin OR ethereum OR crypto OR cryptocurrency", limit)
    if not results:
        results = _fetch_news("crypto", limit)
    return results


def fetch_realestate_news(limit: int = 8) -> list[dict]:
    """한국 부동산 뉴스 — 한국어"""
    queries = [
        "아파트 부동산 서울",
        "부동산 시세 매매",
        "한국 부동산",
    ]
    for q in queries:
        results = _fetch_news(q, limit, language="ko")
        if results:
            return results
    # 영어 폴백
    return _fetch_news("Korea real estate housing market", limit)


def fetch_commodity_news(limit: int = 8) -> list[dict]:
    """광물/원자재 뉴스"""
    results = _fetch_news(
        "gold OR silver OR copper OR oil OR uranium OR lithium commodity",
        limit,
        language="en",
    )
    if not results:
        results = _fetch_news("commodity metals energy", limit)
    return results
