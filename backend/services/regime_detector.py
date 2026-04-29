"""
시장 국면(Regime) 감지 모듈

국면 분류:
  bull     — KOSPI MA20 > MA60 + 상승 중 (VKOSPI 낮음)
  sideways — 횡보 (명확한 방향 없음)
  bear     — KOSPI MA20 < MA60 + 하락 중 (또는 VKOSPI >= 25)

Redis 4시간 캐시. 조회 실패 시 'sideways' 반환(보수적 기본값).
"""
from backend.services import redis_cache


def detect_regime() -> str:
    """현재 시장 국면 반환: 'bull' | 'sideways' | 'bear'"""
    cached = redis_cache.get("market_regime")
    if cached is not None:
        return str(cached)

    regime = _compute_regime()
    redis_cache.set("market_regime", regime, ttl=14400)
    print(f"[regime] 국면 감지: {regime}")
    return regime


def _compute_regime() -> str:
    try:
        import yfinance as yf
        hist = yf.Ticker("^KS11").history(period="90d")
        if len(hist) < 60:
            return "sideways"

        closes    = hist["Close"].dropna().tolist()
        ma20      = sum(closes[-20:]) / 20
        ma60      = sum(closes[-60:]) / 60
        ma20_prev = sum(closes[-21:-1]) / 20

        vkospi = _get_vkospi_safe()
        if vkospi is not None and vkospi >= 25:
            return "bear"

        if ma20 > ma60 and ma20 >= ma20_prev:
            return "bull"
        if ma20 < ma60 and ma20 <= ma20_prev:
            return "bear"
        return "sideways"
    except Exception:
        return "sideways"


def _get_vkospi_safe() -> float | None:
    try:
        from backend.services.kis_trader import get_vkospi
        return get_vkospi()
    except Exception:
        return None
