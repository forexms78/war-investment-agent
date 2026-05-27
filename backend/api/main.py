import asyncio
import os
import time
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.services.investors import get_investor
from backend.services.news import fetch_investor_news, fetch_stock_news
from backend.services.financial import get_stock_data, get_multiple_stocks_parallel
from backend.services.coins import get_coin_detail
from backend.services.db_cache import db_get_stale, db_set

@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.services.scheduler import create_scheduler, warm_all_caches
    scheduler = create_scheduler()
    scheduler.start()
    asyncio.create_task(warm_all_caches())

    # DART corp_code 테이블 초기화 (비어있을 때만 백그라운드 실행)
    try:
        from backend.services.db_cache import _get_client as _sb_init
        from backend.services.dart_service import build_corp_code_table
        count = _sb_init().table("dart_corp_codes").select("ticker", count="exact").limit(1).execute()
        if not count.data:
            import threading
            threading.Thread(target=build_corp_code_table, daemon=True).start()
            print("[startup] DART corp_code 테이블 백그라운드 빌드 시작")
    except Exception as _e:
        print(f"[startup] DART 초기화 스킵: {_e}")

    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Whalyx API", version="3.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=8)


def _run(fn, *args):
    """sync 함수를 현재 이벤트 루프에서 실행"""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(_executor, fn, *args)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Whalyx API", "version": "3.2.0"}


@app.get("/debug/env")
def debug_env():
    import os
    key = os.getenv("GEMINI_API_KEY", "")
    sb_url = os.getenv("SUPABASE_URL", "")
    sb_key = os.getenv("SUPABASE_KEY", "")
    return {
        "GEMINI_API_KEY_set": bool(key),
        "GEMINI_API_KEY_prefix": key[:8] + "..." if key else "NOT SET",
        "SUPABASE_URL": sb_url[:40] + "..." if sb_url else "NOT SET",
        "SUPABASE_KEY_prefix": sb_key[:20] + "..." if sb_key else "NOT SET",
        "BOK_API_KEY_set": bool(os.getenv("BOK_API_KEY")),
    }


@app.get("/debug/kis")
async def debug_kis():
    """KIS 설정 확인 + 토큰 발급 테스트"""
    import os
    from backend.services.kis_trader import BASE_URL, IS_MOCK, APP_KEY, ACCOUNT_NO
    result = {
        "IS_MOCK": IS_MOCK,
        "BASE_URL": BASE_URL,
        "KIS_MOCK_env": os.getenv("KIS_MOCK", "(not set)"),
        "APP_KEY_set": bool(APP_KEY),
        "ACCOUNT_NO": ACCOUNT_NO,
    }
    try:
        from backend.services.kis_trader import get_access_token
        token = await _run(get_access_token)
        result["token_ok"] = True
        result["token_prefix"] = token[:20] + "..."
    except Exception as e:
        result["token_ok"] = False
        result["token_error"] = str(e)
    return result


@app.get("/debug/kis-vs-yahoo")
async def debug_kis_vs_yahoo(ticker: str = "005930.KS"):
    """동일 시점 KIS vs Yahoo 시세 비교 — 신선도·지연·가격 차이 측정.

    예: /debug/kis-vs-yahoo?ticker=005930.KS  (삼성전자)
        /debug/kis-vs-yahoo?ticker=000660.KS  (SK하이닉스)
    """
    import time as _t
    import httpx
    from datetime import datetime, timezone
    from backend.services.kis_trader import get_price_and_fundamentals

    code = ticker.split(".")[0]

    # KIS 호출
    t0 = _t.time()
    try:
        kis_data = await _run(get_price_and_fundamentals, code)
        kis_block = {
            "price":      kis_data.get("current_price"),
            "elapsed_ms": round((_t.time() - t0) * 1000),
            "per":        kis_data.get("per"),
            "pbr":        kis_data.get("pbr"),
            "error":      None,
        }
    except Exception as e:
        kis_block = {"price": None, "elapsed_ms": round((_t.time() - t0) * 1000), "error": f"{type(e).__name__}: {e}"}

    # Yahoo 호출 (1m 간격, 1일 범위 — 가장 신선한 데이터)
    t1 = _t.time()
    yahoo_block: dict = {"elapsed_ms": None}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1m&range=1d",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            data = r.json()["chart"]["result"][0]
            meta = data.get("meta", {})
            market_ts = meta.get("regularMarketTime")
            yahoo_block = {
                "price":            meta.get("regularMarketPrice"),
                "market_time_utc":  datetime.fromtimestamp(market_ts, tz=timezone.utc).isoformat() if market_ts else None,
                "delay_status":     meta.get("marketState"),  # REGULAR / PRE / POST / CLOSED
                "elapsed_ms":       round((_t.time() - t1) * 1000),
                "currency":         meta.get("currency"),
                "exchange":         meta.get("fullExchangeName"),
                "error":            None,
            }
    except Exception as e:
        yahoo_block["error"] = f"{type(e).__name__}: {e}"
        yahoo_block["elapsed_ms"] = round((_t.time() - t1) * 1000)

    # 가격 차이
    price_diff_pct = None
    if kis_block.get("price") and yahoo_block.get("price"):
        price_diff_pct = round((kis_block["price"] - yahoo_block["price"]) / yahoo_block["price"] * 100, 4)

    # Yahoo 가격이 몇 초 전 데이터인지
    yahoo_lag_sec = None
    if yahoo_block.get("market_time_utc"):
        try:
            mt = datetime.fromisoformat(yahoo_block["market_time_utc"])
            yahoo_lag_sec = round((datetime.now(timezone.utc) - mt).total_seconds())
        except Exception:
            pass

    return {
        "ticker":         ticker,
        "called_at_utc":  datetime.now(timezone.utc).isoformat(),
        "kis":            kis_block,
        "yahoo":          yahoo_block,
        "yahoo_lag_sec":  yahoo_lag_sec,
        "price_diff_pct": price_diff_pct,
    }


@app.get("/debug/gemini")
async def debug_gemini():
    """Gemini 직접 호출 테스트 — 에러 메시지 노출"""
    try:
        from backend.utils.gemini import call_gemini
        result = call_gemini("한국어로 '테스트 성공'이라고만 답하세요.")
        return {"status": "ok", "response": result}
    except Exception as e:
        return {"status": "error", "error": str(e), "type": type(e).__name__}


# ─────────────────────────────────────────────
# 투자자
# ─────────────────────────────────────────────

@app.get("/investors")
async def list_investors():
    """전체 투자자 목록 + 각 투자자 상위 3개 종목 주가 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "investors_list")
    if cached:
        return cached
    return {"investors": []}


@app.get("/investors/{investor_id}")
async def get_investor_detail(investor_id: str):
    """투자자 상세 (DB-Only — 스케줄러가 1시간마다 Gemini 인사이트 포함 갱신)"""
    cache_key = f"investor_detail_{investor_id}"
    cached = await _run(db_get_stale, cache_key)
    if cached:
        return cached

    # DB에 없으면 Gemini 없이 주가+뉴스만 즉시 반환 (스케줄러가 나중에 insight 채움)
    investor = get_investor(investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="투자자를 찾을 수 없습니다")

    tickers = [p["ticker"] for p in investor["portfolio"]]
    prices_task = get_multiple_stocks_parallel(tickers)
    news_task = _run(fetch_investor_news, investor["name"])
    prices, news = await asyncio.gather(prices_task, news_task)

    portfolio_with_prices = [
        {
            **holding,
            "current_price": prices.get(holding["ticker"], {}).get("current_price"),
            "change_30d_pct": prices.get(holding["ticker"], {}).get("change_30d_pct"),
            "change_1d_pct": prices.get(holding["ticker"], {}).get("change_1d_pct"),
            "sector": prices.get(holding["ticker"], {}).get("sector", ""),
        }
        for holding in investor["portfolio"]
    ]

    result = {**investor, "portfolio": portfolio_with_prices, "news": news, "insight": ""}
    await _run(db_set, cache_key, result)
    return result


# ─────────────────────────────────────────────
# 종목
# ─────────────────────────────────────────────

@app.get("/stocks/hot")
async def hot_stocks():
    """유명 투자자들이 주목하는 핫 종목 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "stocks_hot")
    if cached:
        return cached
    return {"stocks": []}


@app.get("/stocks/recommendations")
async def recommendations():
    """매수/매도 추천 종목 + 주가 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "stocks_recommendations")
    if cached:
        return cached
    return {"buy": [], "sell": []}


@app.get("/stocks/{ticker}")
async def stock_detail(ticker: str, period: str = "30d"):
    """종목 상세 (DB-Only — 스케줄러가 1시간마다 Gemini 인사이트 포함 갱신)"""
    ticker = ticker.upper()
    cache_key = f"stock_detail_{ticker}_{period}"
    cached = await _run(db_get_stale, cache_key)
    if cached:
        return cached

    # DB에 없으면 Gemini 없이 주가+뉴스만 즉시 반환 (스케줄러가 나중에 insight 채움)
    data_task = _run(get_stock_data, ticker, period)
    news_task = _run(fetch_stock_news, ticker)
    data, news = await asyncio.gather(data_task, news_task)

    if "error" in data:
        raise HTTPException(status_code=404, detail="종목 데이터를 가져올 수 없습니다")

    result = {**data, "news": news, "insight": ""}
    await _run(db_set, cache_key, result)
    return result


# ─────────────────────────────────────────────
# 코인
# ─────────────────────────────────────────────

@app.get("/crypto")
async def crypto_markets():
    """코인 시장 데이터 + 최신 뉴스 (DB-Only — 스케줄러 10분 주기)"""
    cached = await _run(db_get_stale, "crypto")
    if cached:
        return cached
    return {"coins": [], "news": []}


@app.get("/crypto/{coin_id}")
async def crypto_detail(coin_id: str):
    """개별 코인 상세"""
    detail = await _run(get_coin_detail, coin_id)
    if not detail:
        raise HTTPException(status_code=404, detail="코인 데이터를 가져올 수 없습니다")
    news = await _run(fetch_stock_news, detail["symbol"])
    return {**detail, "news": news}


# ─────────────────────────────────────────────
# 광물/원자재
# ─────────────────────────────────────────────

@app.get("/commodities")
async def commodities():
    """광물/원자재 시장 데이터 + 뉴스 (DB-Only — 스케줄러 30분 주기)"""
    cached = await _run(db_get_stale, "commodities")
    if cached:
        return cached
    return {"commodities": [], "news": []}


# ─────────────────────────────────────────────
# 부동산
# ─────────────────────────────────────────────

@app.get("/realestate")
async def realestate():
    """한국 부동산 뉴스 + 주요 지표 (DB-Only — 스케줄러 1시간 주기)"""
    cached = await _run(db_get_stale, "realestate")
    if cached:
        return cached
    return {"indicators": [], "news": []}


# ─────────────────────────────────────────────
# 돈의 흐름 (Money Flow)
# ─────────────────────────────────────────────

@app.get("/money-flow")
async def money_flow():
    """금리·자산군별 수익률 — 돈의 흐름 파악 (DB-Only — 스케줄러 30분 주기)"""
    cached = await _run(db_get_stale, "money_flow")
    if cached:
        return cached
    return {"assets": [], "rate_signal": {"level": "mid", "message": "데이터를 불러오는 중입니다."}, "fed_rate": None, "korea_rates": None}


# ─────────────────────────────────────────────
# 채권 (Bonds)
# ─────────────────────────────────────────────

@app.get("/bonds")
async def bonds():
    """채권 시장 데이터 (DB-Only — 스케줄러 30분 주기)"""
    cached = await _run(db_get_stale, "bonds")
    if cached:
        return cached
    return {"data": {}, "news": []}


# ─────────────────────────────────────────────
# 한국어 헤드라인 (Gemini 없음, 5분 RSS 캐시)
# ─────────────────────────────────────────────

@app.get("/headlines")
async def headlines(limit: int = 10):
    """한국어 Google News 최신 헤드라인 — Gemini 분석 없이 RSS 직접 반환 (5분 캐시)"""
    from backend.services.news import fetch_korean_headlines
    items = await _run(fetch_korean_headlines, limit)
    return {"headlines": items, "total": len(items)}


# ─────────────────────────────────────────────
# 오늘의 마켓 드라이버
# ─────────────────────────────────────────────

@app.get("/market-driver")
async def market_driver():
    """오늘의 마켓 드라이버 (DB-Only — 스케줄러가 30분마다 Gemini 분석 후 갱신)"""
    cached = await _run(db_get_stale, "market_driver")  # TTL 무시 — 스케줄러가 신선도 보장
    if cached:
        return cached
    return {"drivers": [], "updated_at": None}


# ─────────────────────────────────────────────
# AI 뉴스 분석
# ─────────────────────────────────────────────

@app.get("/news-ai")
async def news_ai():
    """전 자산군 뉴스 AI 분석 (DB-Only — 스케줄러 1시간 주기 Gemini 분석)"""
    cached = await _run(db_get_stale, "news_ai")
    if cached:
        return cached
    return {
        "sentiment": "Neutral",
        "sentiment_score": 50,
        "summary": "AI 뉴스 분석을 준비 중입니다. 잠시 후 새로고침해 주세요.",
        "themes": [],
        "news": [],
        "updated_at": None,
    }


# ─────────────────────────────────────────────
# ETF / 미장 / 국장 매수·매도 시그널
# ─────────────────────────────────────────────

@app.get("/etf-signals")
async def etf_signals():
    """ETF + 미장 + 국장 매수/매도 시그널 (DB-Only — 스케줄러 30분 주기 Gemini 배치 분석)"""
    cached = await _run(db_get_stale, "etf_signals")
    if cached:
        return cached
    return {"etfs": [], "us_stocks": [], "kr_stocks": [], "updated_at": None}


@app.get("/etf-holdings/{ticker}")
async def etf_holdings(ticker: str):
    """ETF 편입 종목 조회 — Yahoo Finance topHoldings (24시간 캐시)"""
    from backend.services.etf_holdings import get_etf_holdings
    return await _run(get_etf_holdings, ticker)


_LAST_ADMIN_REFRESH_AT: float = 0.0
_ADMIN_REFRESH_COOLDOWN_SEC = 60.0


@app.post("/admin/refresh-etf-signals")
async def admin_refresh_etf_signals(
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
    """수동 ETF 시그널 강제 갱신 — 30분 주기 잡 사이에 즉시 캐시 재빌드.

    인증:
      - `ADMIN_TOKEN` ENV 설정 시: `X-Admin-Token` 헤더 값 일치 필수
      - 미설정 시: 60초 쿨다운만 적용 (남용 방지)
    """
    global _LAST_ADMIN_REFRESH_AT

    expected = os.getenv("ADMIN_TOKEN")
    if expected:
        if x_admin_token != expected:
            raise HTTPException(status_code=401, detail="invalid admin token")
    else:
        now = time.time()
        elapsed = now - _LAST_ADMIN_REFRESH_AT
        if elapsed < _ADMIN_REFRESH_COOLDOWN_SEC:
            wait = int(_ADMIN_REFRESH_COOLDOWN_SEC - elapsed)
            raise HTTPException(status_code=429, detail=f"cooldown {wait}s remaining")
        _LAST_ADMIN_REFRESH_AT = now

    from backend.services.scheduler import refresh_etf_signals
    await refresh_etf_signals()

    cached = await _run(db_get_stale, "etf_signals")
    return {
        "ok": True,
        "updated_at": cached.get("updated_at") if cached else None,
        "count": {
            "etfs":      len(cached.get("etfs", []))      if cached else 0,
            "us_stocks": len(cached.get("us_stocks", [])) if cached else 0,
            "kr_stocks": len(cached.get("kr_stocks", [])) if cached else 0,
        },
    }


@app.post("/admin/refresh-daily-signal")
async def admin_refresh_daily_signal(
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
    """수동 데일리 시그널 강제 갱신 — 6시간 주기 잡 사이에 캐시 즉시 재빌드.

    인증은 /admin/refresh-etf-signals와 동일 규칙(ADMIN_TOKEN 또는 60초 쿨다운).
    """
    global _LAST_ADMIN_REFRESH_AT

    expected = os.getenv("ADMIN_TOKEN")
    if expected:
        if x_admin_token != expected:
            raise HTTPException(status_code=401, detail="invalid admin token")
    else:
        now = time.time()
        elapsed = now - _LAST_ADMIN_REFRESH_AT
        if elapsed < _ADMIN_REFRESH_COOLDOWN_SEC:
            wait = int(_ADMIN_REFRESH_COOLDOWN_SEC - elapsed)
            raise HTTPException(status_code=429, detail=f"cooldown {wait}s remaining")
        _LAST_ADMIN_REFRESH_AT = now

    # daily_signal 모듈 인메모리 캐시도 무효화 (DB 캐시는 refresh_daily_signal이 덮어씀)
    from backend.services import daily_signal as ds
    ds._signal_cache = None

    from backend.services.scheduler import refresh_daily_signal
    await refresh_daily_signal()

    cached = await _run(db_get_stale, "daily_signal")
    return {
        "ok": True,
        "updated_at": cached.get("updated_at") if cached else None,
        "headline":   cached.get("headline")   if cached else None,
        "count": {
            "buy_recommendations":  len(cached.get("buy_recommendations", []))  if cached else 0,
            "sell_recommendations": len(cached.get("sell_recommendations", [])) if cached else 0,
            "focus_list":           len(cached.get("focus_list", []))           if cached else 0,
        },
    }


# ─────────────────────────────────────────────
# 한국 금리 (Korea Rates)
# ─────────────────────────────────────────────

@app.get("/korea-rates")
async def korea_rates():
    """한국은행 ECOS API (DB-Only — 스케줄러 1시간 주기)"""
    cached = await _run(db_get_stale, "korea_rates")
    if cached:
        return cached
    return {}


# ─────────────────────────────────────────────
# 외국인 매매 (Foreign Flow — KRX)
# ─────────────────────────────────────────────

@app.get("/foreign-flow")
async def foreign_flow():
    """외국인 매매 종합 — KOSPI·KOSDAQ
    - top_buyers/top_sellers: 외국인 순매수·순매도 종목 TOP 20 (당일, 네이버)
    - market_today: 시장 전체 외국인·기관·개인 당일 합계 (네이버 모바일)
    - market_history: 시장 합계 30일 시계열 (스케줄러가 매일 누적)
    (DB-Only — 스케줄러 KST 16:30 + 17:30)"""
    cached = await _run(db_get_stale, "foreign_flow")
    if cached:
        return cached
    return {
        "top_buyers":      {"kospi": [], "kosdaq": []},
        "top_sellers":     {"kospi": [], "kosdaq": []},
        "market_today":    {"kospi": {}, "kosdaq": {}},
        "market_history":  {"kospi": [], "kosdaq": []},
        "top_history":     {"kospi": {}, "kosdaq": {}},
        "available_dates": [],
        "current_date":    None,
        "updated_at":      None,
        "source":          {"top": "naver_iframe", "market": "naver_mobile"},
    }


@app.get("/foreign-flow/{ticker}")
async def foreign_flow_by_ticker(ticker: str):
    """종목별 외국인·기관·개인 일별 매매 추이 — KIS Open API (5분 캐시)"""
    from backend.services.foreign_flow import get_foreign_flow_by_ticker
    cache_key = f"foreign_flow_{ticker.strip()}"
    cached = await _run(db_get_stale, cache_key)
    if cached:
        return cached
    result = await _run(get_foreign_flow_by_ticker, ticker)
    if "error" in result and not result.get("flow"):
        raise HTTPException(status_code=502, detail=result.get("error", "조회 실패"))
    await _run(db_set, cache_key, result)
    return result


# ─────────────────────────────────────────────
# 데일리 시그널 (Daily Signal)
# ─────────────────────────────────────────────

@app.get("/daily-signal")
async def daily_signal():
    """데일리 시그널 — 슈퍼 Investor + ETF 신호 + 외국인 동향 + AI 뉴스 종합 (DB-Only, 스케줄러 6시간 주기 Gemini)"""
    cached = await _run(db_get_stale, "daily_signal")
    if cached:
        return cached
    return {
        "headline": "",
        "sentiment": "Neutral",
        "sentiment_score": 50,
        "market_summary": "",
        "buy_recommendations": [],
        "sell_recommendations": [],
        "focus_list": [],
        "market_drivers": [],
        "fed_rate": None,
        "updated_at": None,
    }

# ─────────────────────────────────────────────
# 오늘의 투자포인트
# ─────────────────────────────────────────────

@app.get("/today-movers")
async def today_movers():
    """카테고리별 주요 자산 급등·급락 + 관련 뉴스 (기존 DB 캐시 집계, 실시간성 보장)"""
    crypto_data, commodity_data, stocks_data, re_data, news_ai = await asyncio.gather(
        _run(db_get_stale, "crypto"),
        _run(db_get_stale, "commodities"),
        _run(db_get_stale, "stocks_hot"),
        _run(db_get_stale, "realestate"),
        _run(db_get_stale, "news_ai"),
    )

    # 카테고리별 뉴스 분류
    all_news = (news_ai or {}).get("news", [])
    news_by_cat: dict[str, list] = {}
    for n in all_news:
        cat = n.get("category", "")
        news_by_cat.setdefault(cat, []).append(n)

    # 코인: 24h 변동 기준 급등/급락 각 3개
    coins = sorted(
        (c for c in (crypto_data or {}).get("coins", []) if c.get("price_change_24h") is not None),
        key=lambda x: x["price_change_24h"],
    )
    crypto_gainers = coins[-3:][::-1]
    crypto_losers  = coins[:3]

    # 광물: 30d 변동 기준 급등/급락 각 3개
    comms = sorted(
        (c for c in (commodity_data or {}).get("commodities", []) if c.get("change_30d_pct") is not None),
        key=lambda x: x["change_30d_pct"],
    )
    comm_gainers = comms[-3:][::-1]
    comm_losers  = comms[:3]

    # 주식: 30d 수익률 기준 급등/급락 각 3개 (change_1d_pct 우선)
    def stock_sort_key(s):
        return s.get("change_1d_pct") if s.get("change_1d_pct") is not None else s.get("change_30d_pct", 0)

    stocks_list = sorted(
        (s for s in (stocks_data or {}).get("stocks", []) if s.get("change_30d_pct") is not None),
        key=stock_sort_key,
    )
    stock_gainers = stocks_list[-3:][::-1]
    stock_losers  = stocks_list[:3]

    return {
        "stocks": {
            "gainers": stock_gainers,
            "losers":  stock_losers,
            "news":    news_by_cat.get("주식", [])[:4],
            "period":  "30d",
        },
        "crypto": {
            "gainers": crypto_gainers,
            "losers":  crypto_losers,
            "news":    news_by_cat.get("코인", [])[:4],
            "period":  "24h",
        },
        "commodities": {
            "gainers": comm_gainers,
            "losers":  comm_losers,
            "news":    news_by_cat.get("광물", [])[:4],
            "period":  "30d",
        },
        "realestate": {
            "indicators": (re_data or {}).get("indicators", []),
            "news": (re_data or {}).get("news", [])[:4] or news_by_cat.get("부동산", [])[:4],
        },
    }


@app.get("/today-picks")
async def today_picks():
    """오늘의 투자포인트 — 전 자산군 뉴스 AI 분석 (news_ai 데이터 재활용, 1시간 주기)"""
    cached = await _run(db_get_stale, "news_ai")
    if cached:
        return cached
    return {
        "sentiment": "Neutral",
        "sentiment_score": 50,
        "summary": "AI 뉴스 분석을 준비 중입니다. 잠시 후 새로고침해 주세요.",
        "themes": [],
        "news": [],
        "updated_at": None,
    }


# ── AI 추천 회고 — 자기학습 루프 가시화 ────────────────────────────────────────
from datetime import datetime as _dt, timedelta as _td, date as _date
from backend.services.db_cache import _get_client as _sb_review

def _summary_sync() -> dict:
    sb = _sb_review()
    if not sb:
        return {"error": "supabase 미연결"}
    out = {
        "total_predictions": 0, "verified_count": 0,
        "hit_1d": None, "hit_7d": None, "hit_30d": None,
        "avg_ret_7d": None, "active_lessons": 0,
        "this_week_hit": None, "last_week_hit": None,
    }
    try:
        all_rows = sb.table("prediction_snapshots").select(
            "hit_1d,hit_7d,hit_30d,ret_7d,snapshot_date"
        ).execute().data or []
        out["total_predictions"] = len(all_rows)

        def rate(rows, col):
            ver = [r for r in rows if r.get(col) is not None]
            if not ver: return None
            wins = sum(1 for r in ver if r[col])
            return round(wins / len(ver) * 100, 1)

        out["hit_1d"]  = rate(all_rows, "hit_1d")
        out["hit_7d"]  = rate(all_rows, "hit_7d")
        out["hit_30d"] = rate(all_rows, "hit_30d")
        out["verified_count"] = sum(1 for r in all_rows if r.get("hit_7d") is not None)

        rets = [float(r["ret_7d"]) for r in all_rows if r.get("ret_7d") is not None]
        out["avg_ret_7d"] = round(sum(rets) / len(rets), 2) if rets else None

        # 이번주 vs 지난주 (1d hit 기준)
        today = _date.today()
        wk_start = today - _td(days=today.weekday())
        last_wk_start = wk_start - _td(days=7)
        this_wk = [r for r in all_rows if r["snapshot_date"] >= wk_start.isoformat()]
        last_wk = [r for r in all_rows if last_wk_start.isoformat() <= r["snapshot_date"] < wk_start.isoformat()]
        out["this_week_hit"] = rate(this_wk, "hit_1d")
        out["last_week_hit"] = rate(last_wk, "hit_1d")

        lr = sb.table("failure_analyses").select("id", count="exact").eq("active", True).execute()
        out["active_lessons"] = lr.count or 0
    except Exception as e:
        out["error"] = str(e)
    return out


@app.get("/review/summary")
async def review_summary():
    """AI 회고 KPI 통합 — 적중률·평균수익률·적용 중 규칙·주간 비교"""
    return await _run(_summary_sync)


def _snapshots_sync(limit: int) -> list:
    sb = _sb_review()
    if not sb:
        return []
    try:
        r = sb.table("prediction_snapshots") \
            .select("*") \
            .order("snapshot_date", desc=True) \
            .order("id", desc=True) \
            .limit(limit) \
            .execute()
        return r.data or []
    except Exception:
        return []


@app.get("/review/snapshots")
async def review_snapshots(limit: int = 60):
    """최근 추천 이력 (검증 결과 포함)"""
    rows = await _run(_snapshots_sync, max(1, min(200, limit)))
    return {"items": rows, "count": len(rows)}


def _failures_sync(limit: int) -> list:
    sb = _sb_review()
    if not sb:
        return []
    try:
        # 분석 + 원본 스냅샷 JOIN (Supabase select 임베드 문법)
        r = sb.table("failure_analyses") \
            .select("*,snapshot:prediction_snapshots(ticker,pick_type,snapshot_date,entry_price,momentum_30d,sentiment,ret_1d,ret_7d,ret_30d)") \
            .eq("active", True) \
            .order("analyzed_at", desc=True) \
            .limit(limit) \
            .execute()
        return r.data or []
    except Exception as e:
        return [{"error": str(e)}]


@app.get("/review/failures")
async def review_failures(limit: int = 15):
    """빗나간 추천의 심층 분석 (root_cause + avoid_rule)"""
    rows = await _run(_failures_sync, max(1, min(50, limit)))
    return {"items": rows, "count": len(rows)}


def _lessons_sync() -> dict:
    from backend.services.prediction_tracker import get_active_failure_patterns
    sb = _sb_review()
    top = get_active_failure_patterns(top_n=3)
    all_active = []
    if sb:
        try:
            r = sb.table("failure_analyses") \
                .select("failure_category,avoid_rule,severity,analyzed_at") \
                .eq("active", True) \
                .order("analyzed_at", desc=True) \
                .limit(50) \
                .execute()
            all_active = r.data or []
        except Exception:
            pass
    return {"top": top, "all": all_active}


@app.get("/review/lessons")
async def review_lessons():
    """현재 다음 추천 생성에 적용 중인 회피 규칙"""
    return await _run(_lessons_sync)


def _weekly_trend_sync() -> list:
    sb = _sb_review()
    if not sb:
        return []
    try:
        # 뷰 활용 — 마이그레이션에서 v_weekly_hit_rate 생성됨
        r = sb.from_("v_weekly_hit_rate").select("*").limit(26).execute()
        rows = r.data or []
        # 차트용 변환 — 백분율
        out = []
        for row in rows:
            out.append({
                "week_start": row["week_start"],
                "hit_rate_1d":  round(row["win_1d"]  / row["total_1d"]  * 100, 1) if row["total_1d"]  else None,
                "hit_rate_7d":  round(row["win_7d"]  / row["total_7d"]  * 100, 1) if row["total_7d"]  else None,
                "hit_rate_30d": round(row["win_30d"] / row["total_30d"] * 100, 1) if row["total_30d"] else None,
                "avg_ret_7d":   row.get("avg_ret_7d"),
                "total_1d":     row["total_1d"],
            })
        return list(reversed(out))  # 오래된 → 최신
    except Exception:
        return []


@app.get("/review/weekly-trend")
async def review_weekly_trend():
    """주간 적중률 추이 — 라인차트용"""
    rows = await _run(_weekly_trend_sync)
    return {"items": rows, "count": len(rows)}



# ─────────────────────────────────────────────
# My Lab (GitHub stock78 분석 파일 연동)
# ─────────────────────────────────────────────

@app.post("/mylab/auth")
async def mylab_auth(request: Request):
    """My Lab 비밀번호 인증 — MYLAB_PASSWORD 환경변수와 비교"""
    from backend.services.mylab import check_password
    body = await request.json()
    pw = body.get("password", "")
    if check_password(pw):
        return {"ok": True}
    raise HTTPException(status_code=401, detail="비밀번호가 틀렸습니다")


@app.get("/mylab/portfolio")
async def mylab_portfolio():
    """portfolio.md 파싱 → 구조화된 포트폴리오 대시보드 데이터"""
    from backend.services.mylab import parse_portfolio
    return await _run(parse_portfolio)


@app.get("/mylab/analyses")
async def mylab_list():
    """stock78/analyses/ 폴더 MD 파일 목록"""
    from backend.services.mylab import list_analyses
    files = await _run(list_analyses)
    return {"files": files}


@app.get("/mylab/analyses/{filename}")
async def mylab_content(filename: str):
    """특정 분석 MD 파일 내용 반환"""
    from backend.services.mylab import get_analysis_content
    result = await _run(get_analysis_content, filename)
    if result is None:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    return result
