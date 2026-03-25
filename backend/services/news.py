import os
import requests
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWS_API_URL = "https://newsapi.org/v2/everything"


def _fetch_news(q: str, limit: int, language: str = "en") -> list[dict]:
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
        return [
            {
                "title": a["title"],
                "description": a.get("description", ""),
                "source": a["source"]["name"],
                "published_at": a["publishedAt"],
                "url": a["url"],
            }
            for a in articles
            if a.get("title") and "[Removed]" not in a.get("title", "")
        ]
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
