"""코인 데이터 — CoinGecko 무료 API"""
import time
import requests

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
})

_cache: dict[str, tuple] = {}
CACHE_TTL = 600  # 10분 (rate limit 완화)

TRACKED_COINS = [
    "bitcoin", "ethereum", "solana", "binancecoin", "ripple",
    "cardano", "avalanche-2", "dogecoin", "polkadot", "chainlink",
]

COIN_META = {
    "bitcoin":       {"symbol": "BTC", "name": "Bitcoin"},
    "ethereum":      {"symbol": "ETH", "name": "Ethereum"},
    "solana":        {"symbol": "SOL", "name": "Solana"},
    "binancecoin":   {"symbol": "BNB", "name": "BNB"},
    "ripple":        {"symbol": "XRP", "name": "XRP"},
    "cardano":       {"symbol": "ADA", "name": "Cardano"},
    "avalanche-2":   {"symbol": "AVAX", "name": "Avalanche"},
    "dogecoin":      {"symbol": "DOGE", "name": "Dogecoin"},
    "polkadot":      {"symbol": "DOT", "name": "Polkadot"},
    "chainlink":     {"symbol": "LINK", "name": "Chainlink"},
}


def get_coin_markets() -> list[dict]:
    cache_key = "markets"
    now = time.time()
    if cache_key in _cache and now - _cache[cache_key][1] < CACHE_TTL:
        return _cache[cache_key][0]

    try:
        url = "https://api.coingecko.com/api/v3/coins/markets"
        params = {
            "vs_currency": "usd",
            "ids": ",".join(TRACKED_COINS),
            "order": "market_cap_desc",
            "per_page": 10,
            "page": 1,
            "sparkline": True,
            "price_change_percentage": "24h,7d,30d",
        }
        # 최대 2회 재시도 (429 대응)
        raw = None
        for attempt in range(2):
            r = _session.get(url, params=params, timeout=10)
            if r.status_code == 429:
                if attempt == 0:
                    import time as _t; _t.sleep(3)
                    continue
                break
            r.raise_for_status()
            raw = r.json()
            break
        if raw is None:
            return _cache.get(cache_key, ([], 0))[0]
        result = [
            {
                "id": c["id"],
                "symbol": c["symbol"].upper(),
                "name": c["name"],
                "current_price": c["current_price"],
                "market_cap": c["market_cap"],
                "price_change_24h": round(c.get("price_change_percentage_24h") or 0, 2),
                "price_change_7d": round(c.get("price_change_percentage_7d_in_currency") or 0, 2),
                "price_change_30d": round(c.get("price_change_percentage_30d_in_currency") or 0, 2),
                "sparkline": [round(p, 2) for p in (c.get("sparkline_in_7d") or {}).get("prices", [])[::8]],
                "image": c.get("image", ""),
            }
            for c in raw
        ]
        _cache[cache_key] = (result, now)
        return result
    except Exception as e:
        return []


def get_coin_detail(coin_id: str) -> dict | None:
    cache_key = f"detail_{coin_id}"
    now = time.time()
    if cache_key in _cache and now - _cache[cache_key][1] < CACHE_TTL:
        return _cache[cache_key][0]

    try:
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}"
        params = {
            "localization": "false",
            "tickers": "false",
            "market_data": "true",
            "community_data": "false",
            "developer_data": "false",
            "sparkline": "true",
        }
        r = _session.get(url, params=params, timeout=10)
        r.raise_for_status()
        c = r.json()
        md = c.get("market_data", {})
        result = {
            "id": coin_id,
            "symbol": c["symbol"].upper(),
            "name": c["name"],
            "description": c.get("description", {}).get("en", "")[:300],
            "current_price": md.get("current_price", {}).get("usd"),
            "market_cap": md.get("market_cap", {}).get("usd"),
            "price_change_24h": round(md.get("price_change_percentage_24h") or 0, 2),
            "price_change_7d": round(md.get("price_change_percentage_7d") or 0, 2),
            "price_change_30d": round(md.get("price_change_percentage_30d") or 0, 2),
            "ath": md.get("ath", {}).get("usd"),
            "ath_change_percentage": round(md.get("ath_change_percentage", {}).get("usd") or 0, 2),
        }
        _cache[cache_key] = (result, now)
        return result
    except Exception:
        return None
