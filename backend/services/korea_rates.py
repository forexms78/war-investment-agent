import requests
import time
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

BOK_API_KEY = os.getenv("BOK_API_KEY", "")
BOK_BASE = "https://ecos.bok.or.kr/api/StatisticSearch"

_cache: dict = {}
CACHE_TTL = 3600  # 1시간 (금리는 자주 안 바뀜)

_session = requests.Session()
_session.headers.update({"User-Agent": "Mozilla/5.0"})


def _get_bok(stat_code: str, item_code: str, period: str = "MM") -> float | None:
    """한국은행 ECOS API에서 최신 통계값 조회"""
    cache_key = f"{stat_code}_{item_code}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[1] < CACHE_TTL:
        return cached[0]

    try:
        end_date = datetime.today().strftime("%Y%m")
        start_date = (datetime.today() - timedelta(days=90)).strftime("%Y%m")
        url = f"{BOK_BASE}/{BOK_API_KEY}/json/kr/1/10/{stat_code}/{period}/{start_date}/{end_date}/{item_code}"
        r = _session.get(url, timeout=8)
        r.raise_for_status()
        data = r.json()
        rows = data.get("StatisticSearch", {}).get("row", [])
        if not rows:
            return None
        # 가장 최신 값 (마지막 행)
        latest = rows[-1].get("DATA_VALUE", "")
        value = float(latest) if latest else None
        if value is not None:
            _cache[cache_key] = (value, time.time())
        return value
    except Exception:
        return None


def get_korea_rates() -> dict:
    """한국 주요 금리 데이터 반환"""
    # 한국 기준금리: 통계표코드 722Y001, 항목코드 0101000
    base_rate = _get_bok("722Y001", "0101000", "MM")
    # 국고채 3년: 817Y002, 010190000
    treasury_3y = _get_bok("817Y002", "010190000", "MM")
    # CD 91일물: 817Y002, 010220000 (없으면 None)
    cd_rate = _get_bok("817Y002", "010220000", "MM")

    return {
        "base_rate": base_rate,          # 기준금리 (예: 3.0)
        "treasury_3y": treasury_3y,       # 국고채 3년물
        "cd_rate": cd_rate,               # CD 91일물
        "updated_at": datetime.now().isoformat(),
    }
