import requests
import time
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

BOK_API_KEY = os.getenv("BOK_API_KEY", "")
BOK_BASE = "https://ecos.bok.or.kr/api/StatisticSearch"

_cache: dict = {}
CACHE_TTL = 3600  # 1시간 (금리·환율은 자주 안 바뀜)

_session = requests.Session()
_session.headers.update({"User-Agent": "Mozilla/5.0"})


def _get_bok(stat_code: str, item_code: str, cycle: str = "D") -> float | None:
    """한국은행 ECOS API에서 최신 통계값 조회 (D=일별)"""
    cache_key = f"{stat_code}_{item_code}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[1] < CACHE_TTL:
        return cached[0]

    try:
        end_date = datetime.today().strftime("%Y%m%d")
        start_date = (datetime.today() - timedelta(days=14)).strftime("%Y%m%d")
        url = (
            f"{BOK_BASE}/{BOK_API_KEY}/json/kr/1/5"
            f"/{stat_code}/{cycle}/{start_date}/{end_date}/{item_code}"
        )
        r = _session.get(url, timeout=8)
        r.raise_for_status()
        data = r.json()
        rows = data.get("StatisticSearch", {}).get("row", [])
        if not rows:
            return None
        latest = rows[-1].get("DATA_VALUE", "")
        value = float(latest) if latest else None
        if value is not None:
            _cache[cache_key] = (value, time.time())
        return value
    except Exception:
        return None


def get_korea_rates() -> dict:
    """한국 주요 금리 및 환율 데이터 반환"""
    # 한국은행 기준금리: 722Y001 / 0101000 (D 일별)
    base_rate = _get_bok("722Y001", "0101000", "D")
    # 국고채 3년: 817Y002 / 010200000
    treasury_3y = _get_bok("817Y002", "010200000", "D")
    # 국고채 10년: 817Y002 / 010210000
    treasury_10y = _get_bok("817Y002", "010210000", "D")
    # CD 91일물: 817Y002 / 010502000
    cd_rate = _get_bok("817Y002", "010502000", "D")
    # 원/달러 환율(매매기준율): 731Y001 / 0000001
    usd_krw = _get_bok("731Y001", "0000001", "D")

    return {
        "base_rate":    base_rate,     # 기준금리 (연%)
        "treasury_3y":  treasury_3y,   # 국고채 3년 (연%)
        "treasury_10y": treasury_10y,  # 국고채 10년 (연%)
        "cd_rate":      cd_rate,       # CD 91일 (연%)
        "usd_krw":      usd_krw,       # 원/달러 환율 (원)
        "updated_at":   datetime.now().isoformat(),
    }
