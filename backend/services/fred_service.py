"""FRED API (Federal Reserve Economic Data) — 미국 금리/경제지표 공식 데이터"""
import os
import time
import requests

FRED_API_KEY = os.getenv("FRED_API_KEY", "")
_BASE = "https://api.stlouisfed.org/fred/series/observations"
_cache: dict = {}
_CACHE_TTL = 1800  # 30분

_session = requests.Session()

SERIES = {
    "fed_rate":   "FEDFUNDS",
    "yield_3m":   "DGS3MO",
    "yield_2y":   "DGS2",
    "yield_5y":   "DGS5",
    "yield_10y":  "DGS10",
    "yield_30y":  "DGS30",
}


def _get_series(series_id: str, limit: int = 5) -> list[float]:
    cache_key = f"fred_{series_id}_{limit}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[1] < _CACHE_TTL:
        return cached[0]

    if not FRED_API_KEY:
        return []

    try:
        r = _session.get(_BASE, params={
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "sort_order": "desc",
            "limit": limit + 5,
        }, timeout=8)
        r.raise_for_status()
        obs = r.json().get("observations", [])
        values = []
        for o in obs:
            v = o.get("value", ".")
            if v != ".":
                try:
                    values.append(float(v))
                except ValueError:
                    pass
        if values:
            values.reverse()
            _cache[cache_key] = (values, time.time())
        return values
    except Exception:
        return []


def get_latest(series_id: str) -> float | None:
    values = _get_series(series_id, limit=5)
    return values[-1] if values else None


def get_change(series_id: str) -> float | None:
    values = _get_series(series_id, limit=5)
    if len(values) >= 2:
        return round(values[-1] - values[-2], 3)
    return None


def get_us_rates() -> dict:
    """미국 금리 전체 — FRED 공식 데이터"""
    result = {}
    for key, sid in SERIES.items():
        result[key] = get_latest(sid)
        result[f"{key}_change"] = get_change(sid)

    y10 = result.get("yield_10y")
    y3m = result.get("yield_3m")
    y2y = result.get("yield_2y")

    result["spread_10y_3m"] = round(y10 - y3m, 3) if y10 and y3m else None
    result["spread_10y_2y"] = round(y10 - y2y, 3) if y10 and y2y else None
    result["curve_inverted"] = (y10 or 0) < (y3m or 0)

    return result
