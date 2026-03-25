import time
import asyncio
import yfinance as yf
import requests
import statistics
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})
yf.utils.requests = _session  # type: ignore

_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 1800  # 30분
_executor = ThreadPoolExecutor(max_workers=12)

# 광물/원자재 메타데이터
COMMODITY_META: dict[str, dict] = {
    "GC=F": {
        "name": "Gold (금)",
        "category": "귀금속",
        "description": "대표 안전자산. 인플레이션·지정학 리스크 헤지 수단.",
    },
    "SI=F": {
        "name": "Silver (은)",
        "category": "귀금속",
        "description": "귀금속 + 산업용 수요. 태양광 패널·전자기기 핵심 소재.",
    },
    "HG=F": {
        "name": "Copper (구리)",
        "category": "산업금속",
        "description": "경기 선행지표. 건설·전기차·신재생에너지 인프라 필수 소재.",
    },
    "CL=F": {
        "name": "Crude Oil (원유)",
        "category": "에너지",
        "description": "글로벌 에너지 기준가격. OPEC 정책·지정학 리스크에 민감.",
    },
    "URA": {
        "name": "Uranium ETF (우라늄)",
        "category": "에너지",
        "description": "원자력 발전 핵심 연료. AI 데이터센터 전력 수요 증가 수혜.",
    },
    "LIT": {
        "name": "Lithium ETF (리튬)",
        "category": "배터리",
        "description": "EV 배터리 핵심 소재. 전기차 시장 성장과 직결.",
    },
    "PL=F": {
        "name": "Platinum (플래티넘)",
        "category": "귀금속",
        "description": "자동차 촉매변환기·수소경제 핵심 소재. 공급 제한적.",
    },
    "NG=F": {
        "name": "Natural Gas (천연가스)",
        "category": "에너지",
        "description": "난방·발전 연료. 계절성·LNG 수출 수요에 영향.",
    },
}

COMMODITY_TICKERS = list(COMMODITY_META.keys())


def _fetch_via_rest(ticker: str) -> dict | None:
    """REST API fallback"""
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=30d"
        r = _session.get(url, timeout=8)
        r.raise_for_status()
        data = r.json()["chart"]["result"][0]
        closes = [c for c in data["indicators"]["quote"][0]["close"] if c is not None]
        if not closes:
            return None
        timestamps = data.get("timestamp", [])
        current = closes[-1]
        prev = closes[0]
        change_pct = round((current - prev) / prev * 100, 2)
        changes = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
        chart = [
            {"date": datetime.fromtimestamp(timestamps[i]).strftime("%m/%d"), "price": round(closes[i], 2)}
            for i in range(len(closes))
            if i < len(timestamps)
        ] if timestamps else []
        return {
            "current_price": round(current, 2),
            "prev_price": round(prev, 2),
            "change_30d_pct": change_pct,
            "change_1d_pct": round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) > 1 else 0,
            "volatility": round(statistics.stdev(changes), 2) if len(changes) > 1 else 0,
            "chart": chart[-20:],
        }
    except Exception:
        return None


def get_commodity_data(ticker: str) -> dict:
    """단일 광물/원자재 데이터 조회 (yfinance + REST fallback)"""
    now = time.time()
    cached = _cache.get(ticker)
    if cached and now - cached[1] < CACHE_TTL:
        return cached[0]

    meta = COMMODITY_META.get(ticker, {"name": ticker, "category": "", "description": ""})

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        end = datetime.today()
        start = end - timedelta(days=35)
        hist = t.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))
        if not hist.empty:
            closes = hist["Close"].tolist()
            dates = [d.strftime("%m/%d") for d in hist.index]
            current = round(float(closes[-1]), 2)
            prev = round(float(closes[0]), 2)
            change_pct = round((current - prev) / prev * 100, 2)
            changes = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
            result = {
                "ticker": ticker,
                "name": meta["name"],
                "category": meta["category"],
                "description": meta["description"],
                "current_price": current,
                "prev_price": prev,
                "change_30d_pct": change_pct,
                "change_1d_pct": round((closes[-1] - closes[-2]) / closes[-2] * 100, 2) if len(closes) > 1 else 0,
                "volatility": round(statistics.stdev(changes), 2) if len(changes) > 1 else 0,
                "chart": [{"date": dates[i], "price": round(closes[i], 2)} for i in range(len(closes))][-20:],
            }
            _cache[ticker] = (result, time.time())
            return result
    except Exception:
        pass

    # REST fallback
    fallback = _fetch_via_rest(ticker)
    if fallback:
        result = {
            "ticker": ticker,
            "name": meta["name"],
            "category": meta["category"],
            "description": meta["description"],
            **fallback,
        }
        _cache[ticker] = (result, time.time())
        return result

    return {"ticker": ticker, "name": meta["name"], "category": meta["category"], "description": meta["description"], "error": "데이터 수집 실패"}


async def get_all_commodities() -> list[dict]:
    """8종 광물/원자재 병렬 조회"""
    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(_executor, get_commodity_data, t) for t in COMMODITY_TICKERS]
    results = await asyncio.gather(*tasks)
    return list(results)
