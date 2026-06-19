"""
백그라운드 스케줄러 — DB-Only 아키텍처

엔드포인트: Supabase에서만 읽음 (< 200ms, 항상 즉시 응답)
스케줄러:  외부 API / Gemini / FinBERT 호출 전담 → Supabase에 저장

Gemini 호출 원칙:
  - 엔드포인트에서는 절대 Gemini 호출 없음
  - warm_all_caches()에서도 Gemini 호출 없음
  - 오직 스케줄러 잡에서만 호출 (주기적, 4초 간격 자동 적용)

잡 주기:
  - investors / stocks_hot / recommendations: 10분 (Yahoo Finance만)
  - investor_details: 1시간 (Yahoo Finance + Gemini × 8명)
  - hot_stock_details: 1시간 (Yahoo Finance + Gemini × 12종목)
  - market_driver (Gemini): 30분
  - today_picks (FinBERT + Gemini): 6시간
"""
import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")


async def _run_sync(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, *args)


def _foreign_flow_needs_backfill(cached: dict | None, now: datetime | None = None) -> bool:
    """부팅/콜드스타트 시 오늘 외국인 매매 데이터 누락 여부 판단.

    Render Free Tier 슬립으로 KST 16:30·17:30 cron을 둘 다 놓친 날을 회수한다.
    콜드스타트(슬립→핑 깨어남)마다 재평가되므로 정각을 놓쳐도 당일분을 수집한다.
    조건: 캐시 없음 OR (평일 AND KST 16:30 이후 AND 저장된 current_date가 오늘이 아님).
    공휴일이면 네이버가 직전 거래일 bizdate를 주므로 한 번 헛돌 뿐 데이터 오염은 없다."""
    if not cached:
        return True
    now = now or datetime.now(_KST)
    if now.weekday() >= 5:                    # 주말 — 장 없음
        return False
    if (now.hour, now.minute) < (16, 30):     # 장 마감 후 수집 시각 전
        return False
    return cached.get("current_date") != now.strftime("%Y-%m-%d")


async def refresh_investors():
    from backend.services.investors import get_all_investors
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
        investors = get_all_investors()
        all_tickers = list({t for inv in investors for t in inv["top_holdings"]})
        prices = await get_multiple_stocks_parallel(all_tickers)
        result = []
        for inv in investors:
            result.append({
                **inv,
                "holdings_data": [
                    {
                        "ticker": t,
                        "price": prices.get(t, {}).get("current_price"),
                        "change_1d_pct": prices.get(t, {}).get("change_1d_pct"),
                        "change_30d_pct": prices.get(t, {}).get("change_30d_pct"),
                    }
                    for t in inv["top_holdings"]
                ],
            })
        await _run_sync(db_set, "investors_list", {"investors": result})
        logger.info("[OK] [scheduler] investors_list 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] investors_list 갱신 실패: {e}")


async def refresh_stocks_hot():
    from backend.services.investors import get_hot_tickers
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
        tickers = get_hot_tickers()
        stocks = await get_multiple_stocks_parallel(tickers)
        result = [data for ticker in tickers if "error" not in (data := stocks.get(ticker, {}))]
        await _run_sync(db_set, "stocks_hot", {"stocks": result})
        logger.info("[OK] [scheduler] stocks_hot 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] stocks_hot 갱신 실패: {e}")


async def refresh_recommendations():
    from backend.services.investors import (
        get_buy_recommendations, get_sell_recommendations,
        get_holdings_consensus, AS_OF_QUARTER, AS_OF_DATE,
    )
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
        buys = get_buy_recommendations()
        sells = get_sell_recommendations()
        holds = get_holdings_consensus()
        all_tickers = list({r["ticker"] for r in buys + sells + holds})
        prices = await get_multiple_stocks_parallel(all_tickers)

        def _px(r):
            return {**r, **{k: prices.get(r["ticker"], {}).get(k) for k in ["current_price", "change_30d_pct", "change_1d_pct"]}}

        await _run_sync(db_set, "stocks_recommendations", {
            "buy":      [_px(r) for r in buys],
            "sell":     [_px(r) for r in sells],
            "holdings": [_px(r) for r in holds],
            "as_of":      AS_OF_QUARTER,
            "as_of_date": AS_OF_DATE,
        })
        logger.info("[OK] [scheduler] stocks_recommendations 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] stocks_recommendations 갱신 실패: {e}")


async def refresh_investor_details():
    """투자자 8명 상세 + Gemini 인사이트 갱신 (1시간 주기)
    순차 실행 — gemini.py의 4초 간격 보장으로 레이트 리밋 안전"""
    from backend.services.investors import get_all_investors
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.news import fetch_investor_news
    from backend.services.ai_summary import generate_investor_insight
    from backend.services.db_cache import db_set

    investors = get_all_investors()
    for inv in investors:
        investor_id = inv["id"]
        try:
            tickers = [p["ticker"] for p in inv["portfolio"]]
            prices_task = get_multiple_stocks_parallel(tickers)
            news_task = _run_sync(fetch_investor_news, inv["name"])
            prices, news = await asyncio.gather(prices_task, news_task)

            news_titles = [n["title"] for n in news if n.get("title")]
            insight = await _run_sync(
                generate_investor_insight,
                inv["name"], inv["firm"], inv["recent_moves"], news_titles,
            )
            portfolio_with_prices = [
                {
                    **holding,
                    "current_price": prices.get(holding["ticker"], {}).get("current_price"),
                    "change_30d_pct": prices.get(holding["ticker"], {}).get("change_30d_pct"),
                    "change_1d_pct": prices.get(holding["ticker"], {}).get("change_1d_pct"),
                    "sector": prices.get(holding["ticker"], {}).get("sector", ""),
                }
                for holding in inv["portfolio"]
            ]
            result = {**inv, "portfolio": portfolio_with_prices, "news": news, "insight": insight}
            await _run_sync(db_set, f"investor_detail_{investor_id}", result)
            logger.info(f"[OK] [scheduler] investor_detail_{investor_id} 갱신 완료")
        except Exception as e:
            logger.error(f"[FAIL] [scheduler] investor_detail_{investor_id} 갱신 실패: {e}")


async def refresh_hot_stock_details():
    """핫 종목 12개 상세 + Gemini 인사이트 갱신 (1시간 주기)
    순차 실행 — gemini.py의 4초 간격 보장으로 레이트 리밋 안전"""
    from backend.services.investors import get_hot_tickers
    from backend.services.financial import get_stock_data
    from backend.services.news import fetch_stock_news
    from backend.services.ai_summary import generate_stock_insight
    from backend.services.db_cache import db_set

    tickers = get_hot_tickers()
    for ticker in tickers:
        try:
            data_task = _run_sync(get_stock_data, ticker, "30d")
            news_task = _run_sync(fetch_stock_news, ticker)
            data, news = await asyncio.gather(data_task, news_task)

            if "error" in data:
                continue

            news_titles = [n["title"] for n in news if n.get("title")]
            insight = await _run_sync(
                generate_stock_insight,
                ticker, data.get("name", ticker),
                data.get("change_30d_pct", 0), news_titles,
            )
            result = {**data, "news": news, "insight": insight}
            await _run_sync(db_set, f"stock_detail_{ticker}_30d", result)
            logger.info(f"[OK] [scheduler] stock_detail_{ticker} 갱신 완료")
        except Exception as e:
            logger.error(f"[FAIL] [scheduler] stock_detail_{ticker} 갱신 실패: {e}")


async def refresh_crypto():
    """코인 시세 + 뉴스 갱신 (10분 주기, Gemini 없음)"""
    from backend.services.coins import get_coin_markets
    from backend.services.news import fetch_crypto_news
    from backend.services.db_cache import db_set
    try:
        coins_task = _run_sync(get_coin_markets)
        news_task = _run_sync(fetch_crypto_news)
        coins, news = await asyncio.gather(coins_task, news_task)
        if not coins:
            logger.warning("[WARN] [scheduler] CoinGecko 빈 응답 — 기존 DB 유지")
            return
        await _run_sync(db_set, "crypto", {"coins": coins, "news": news})
        logger.info("[OK] [scheduler] crypto 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] crypto 갱신 실패: {e}")


async def refresh_commodities():
    """광물/원자재 시세 + 뉴스 갱신 (30분 주기, Gemini 없음)"""
    from backend.services.commodities import get_all_commodities
    from backend.services.news import fetch_commodity_news
    from backend.services.db_cache import db_set
    try:
        data_task = get_all_commodities()
        news_task = _run_sync(fetch_commodity_news)
        data, news = await asyncio.gather(data_task, news_task)
        await _run_sync(db_set, "commodities", {"commodities": data, "news": news})
        logger.info("[OK] [scheduler] commodities 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] commodities 갱신 실패: {e}")


async def refresh_bonds():
    """채권 시장 데이터 + 뉴스 갱신 (30분 주기, Gemini 없음)"""
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.news import fetch_bond_news
    from backend.services.fed_rate import get_fed_rate
    from backend.services.db_cache import db_set
    try:
        prices_task = get_multiple_stocks_parallel(["^TNX", "^IRX", "TLT"])
        news_task = _run_sync(fetch_bond_news)
        prices, news = await asyncio.gather(prices_task, news_task)
        fed_rate = await _run_sync(get_fed_rate)
        tnx = prices.get("^TNX", {})
        irx = prices.get("^IRX", {})
        tlt = prices.get("TLT", {})
        result = {
            "data": {
                "fed_rate": fed_rate,
                "yield_10y": tnx.get("current_price"),
                "yield_10y_change": tnx.get("change_30d_pct"),
                "yield_3m": irx.get("current_price"),
                "yield_3m_change": irx.get("change_30d_pct"),
                "tlt_price": tlt.get("current_price"),
                "tlt_change_30d": tlt.get("change_30d_pct"),
                "tlt_change_1d": tlt.get("change_1d_pct"),
                "curve_inverted": (tnx.get("current_price") or 0) < (irx.get("current_price") or 0),
            },
            "news": news,
        }
        await _run_sync(db_set, "bonds", result)
        logger.info("[OK] [scheduler] bonds 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] bonds 갱신 실패: {e}")


async def refresh_korea_rates():
    """한국은행 금리 데이터 갱신 (1시간 주기, Gemini 없음)"""
    from backend.services.korea_rates import get_korea_rates
    from backend.services.db_cache import db_set
    try:
        data = await _run_sync(get_korea_rates)
        await _run_sync(db_set, "korea_rates", data)
        logger.info("[OK] [scheduler] korea_rates 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] korea_rates 갱신 실패: {e}")


async def refresh_rates():
    """미국(FRED)+한국(BOK) 금리 통합 데이터 갱신 (30분 주기)"""
    from backend.services.korea_rates import get_korea_rates_detail
    from backend.services.fred_service import get_us_rates
    from backend.services.db_cache import db_set
    try:
        kr_task = _run_sync(get_korea_rates_detail)
        us_task = _run_sync(get_us_rates)
        kr_data, us_data = await asyncio.gather(kr_task, us_task)

        result = {
            "us": us_data,
            "kr": kr_data,
            "updated_at": kr_data.get("updated_at", ""),
        }
        await _run_sync(db_set, "rates", result)
        logger.info("[OK] [scheduler] rates 갱신 완료 (FRED+BOK)")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] rates 갱신 실패: {e}")


async def refresh_realestate():
    """부동산 뉴스 갱신 (1시간 주기, Gemini 없음)"""
    from backend.services.news import fetch_realestate_news
    from backend.services.db_cache import db_set
    try:
        news = await _run_sync(fetch_realestate_news)
        indicators = [
            {"label": "서울 아파트 매매가격지수", "value": "105.2", "change": "+0.3%", "unit": "2021.01=100", "trend": "up"},
            {"label": "전국 아파트 전세가율", "value": "58.4%", "change": "-0.8%", "unit": "전세/매매", "trend": "down"},
            {"label": "서울 평균 아파트 매매가", "value": "12.4억", "change": "+1.2%", "unit": "원", "trend": "up"},
            {"label": "주택담보대출 금리", "value": "3.92%", "change": "-0.1%", "unit": "연(변동)", "trend": "down"},
            {"label": "미분양 주택 (전국)", "value": "7.2만 호", "change": "+2.1%", "unit": "호수", "trend": "up"},
            {"label": "서울 아파트 거래량", "value": "3,840건", "change": "+8.5%", "unit": "월간", "trend": "up"},
        ]
        await _run_sync(db_set, "realestate", {"indicators": indicators, "news": news})
        logger.info("[OK] [scheduler] realestate 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] realestate 갱신 실패: {e}")


async def refresh_money_flow():
    """돈의 흐름 데이터 갱신 (30분 주기, Gemini 없음)"""
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.coins import get_coin_markets
    from backend.services.korea_rates import get_korea_rates
    from backend.services.fed_rate import get_fed_rate
    from backend.services.db_cache import db_set
    try:
        prices_task = get_multiple_stocks_parallel(["^TNX", "^IRX", "GLD", "SPY", "TLT"])
        coins_task = _run_sync(get_coin_markets)
        prices, coins = await asyncio.gather(prices_task, coins_task)
        tnx = prices.get("^TNX", {})
        spy = prices.get("SPY", {})
        gld = prices.get("GLD", {})
        tlt = prices.get("TLT", {})
        btc = next((c for c in coins if c["symbol"] == "BTC"), {})
        assets = [
            {"category": "금리", "name": "미 10년 국채 금리",
             "value": f"{tnx.get('current_price', 4.3):.2f}%",
             "change_30d": tnx.get("change_30d_pct"),
             "description": "금리↑ → 채권·예금 매력↑, 주식·코인·부동산↓",
             "color": "#6366f1", "icon": "TNX"},
            {"category": "주식", "name": "S&P 500 (SPY)",
             "value": f"${spy.get('current_price', 0):,.0f}",
             "change_30d": spy.get("change_30d_pct"),
             "description": "금리↓ 수혜, 기업 실적·AI 성장 모멘텀",
             "color": "#10b981", "icon": "SPY"},
            {"category": "채권", "name": "장기채 (TLT)",
             "value": f"${tlt.get('current_price', 0):,.0f}",
             "change_30d": tlt.get("change_30d_pct"),
             "description": "금리↓ 시 가격 상승. 경기침체 헤지 수단.",
             "color": "#3b82f6", "icon": "TLT"},
            {"category": "금", "name": "금 (GLD ETF)",
             "value": f"${gld.get('current_price', 0):,.0f}",
             "change_30d": gld.get("change_30d_pct"),
             "description": "인플레이션·지정학 리스크 헤지. 달러 약세 수혜.",
             "color": "#f59e0b", "icon": "GLD"},
            {"category": "코인", "name": "Bitcoin (BTC)",
             "value": f"${btc.get('current_price', 0):,.0f}" if btc else "-",
             "change_30d": btc.get("price_change_30d") if btc else None,
             "description": "위험 선호 자산. 금리 인하·유동성 확장 시 강세.",
             "color": "#f97316", "icon": "BTC"},
            {"category": "부동산", "name": "서울 아파트",
             "value": "12.4억", "change_30d": 1.2,
             "description": "저금리·유동성 환경에서 강세. 고금리 시 조정.",
             "color": "#ec4899", "icon": "APT"},
        ]
        rate = tnx.get("current_price", 4.3) or 4.3
        if rate > 4.5:
            signal = {"level": "high", "message": "고금리 구간: 현금·채권 비중 확대 유리. 부동산·코인 비중 축소 고려."}
        elif rate > 3.5:
            signal = {"level": "mid", "message": "중립 금리 구간: 우량 주식·금 분산 투자 적합. 섹터 선별 중요."}
        else:
            signal = {"level": "low", "message": "저금리 구간: 성장주·코인·부동산 강세 환경. 리스크 자산 비중 확대 고려."}
        kor = await _run_sync(get_korea_rates)
        fed_rate = await _run_sync(get_fed_rate)
        result = {"assets": assets, "rate_signal": signal, "fed_rate": fed_rate, "korea_rates": kor}
        await _run_sync(db_set, "money_flow", result)
        logger.info("[OK] [scheduler] money_flow 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] money_flow 갱신 실패: {e}")


async def refresh_daily_signal():
    """데일리 시그널 갱신 (6시간 주기, Gemini 포함)"""
    from backend.services.fed_rate import get_fed_rate
    from backend.services.daily_signal import get_daily_signal
    from backend.services.news import fetch_stock_market_news, fetch_asia_market_news, fetch_top_headlines
    from backend.services.ai_summary import generate_market_drivers
    from backend.services.db_cache import db_set
    try:
        fed_rate, market_news, asia_news, headlines = await asyncio.gather(
            _run_sync(get_fed_rate),
            _run_sync(fetch_stock_market_news, 6),
            _run_sync(fetch_asia_market_news, 4),
            _run_sync(fetch_top_headlines, 20),
        )
        market_drivers = (await _run_sync(generate_market_drivers, headlines)).get("drivers", [])

        from backend.services.investors import get_buy_recommendations, get_sell_recommendations
        from backend.services.db_cache import db_get_stale

        buy_recs = await _run_sync(get_buy_recommendations)
        sell_recs = await _run_sync(get_sell_recommendations)
        etf_data = await _run_sync(db_get_stale, "etf_signals") or {}
        foreign_data = await _run_sync(db_get_stale, "foreign_flow") or {}

        signal = await get_daily_signal(
            buy_recs, sell_recs,
            etf_data, foreign_data, market_drivers, fed_rate,
            force=True,  # 스케줄러 잡은 항상 캐시 우회 → 새 Gemini 호출
        )
        result = {**signal, "market_news": market_news, "asia_news": asia_news}
        await _run_sync(db_set, "daily_signal", result)
        logger.info("[OK] [scheduler] daily_signal 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] daily_signal 갱신 실패: {e}")


async def refresh_news_ai():
    """전 자산군 뉴스 AI 분석 갱신 (1시간 주기, Gemini 포함)"""
    from backend.services.news import fetch_market_news_all
    from backend.services.ai_summary import generate_news_analysis
    from backend.services.db_cache import db_set
    try:
        news_by_category = await _run_sync(fetch_market_news_all)
        result = await _run_sync(generate_news_analysis, news_by_category)
        await _run_sync(db_set, "news_ai", result)
        logger.info("[OK] [scheduler] news_ai 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] news_ai 갱신 실패: {e}")


async def refresh_holdings_13f():
    """8인 투자자 13F 분기별 보유 종목 크롤링 (13f.info) → Supabase.
    13F는 분기 공시(2·5·8·11월 중순). 매일 1회 변경 감지(동일하면 덮어쓰기, 무해).
    실패 시 기존 데이터 유지 (외국인 매매 패턴)."""
    from backend.services.holdings_13f import build_investor_13f
    from backend.services.investors import get_all_investors
    from backend.services.db_cache import db_set
    from datetime import datetime

    ok = 0
    for inv in get_all_investors():
        slug = inv.get("cik_slug")
        if not slug:
            continue
        try:
            snaps = await _run_sync(build_investor_13f, slug, 6)
            if snaps:
                await _run_sync(db_set, f"investor_13f_{inv['id']}", {
                    "investor_id": inv["id"],
                    "quarters": snaps,
                    "updated_at": datetime.now(_KST).isoformat(),
                })
                ok += 1
            else:
                logger.warning(f"[WARN] [scheduler] 13f {inv['id']} 빈 응답 — 기존 유지")
        except Exception as e:
            logger.error(f"[FAIL] [scheduler] 13f {inv['id']} 실패: {e}")
        await asyncio.sleep(1.0)  # 13f.info rate limit 예의
    logger.info(f"[OK] [scheduler] holdings_13f 갱신 완료 ({ok}/8)")


async def refresh_foreign_flow():
    """외국인 매매 데이터 갱신 — 종목 TOP(네이버) + 시장 합계(네이버 모바일).
    네이버는 두 데이터 모두 과거 날짜 조회 불가(bizdate 파라미터 무시) — 매일 누적으로 시계열 구축.
      - market_history: 시장 외국인·기관·개인 합계 30일 (작음)
      - top_history:    종목별 외국인 순매수/매도 TOP 15일 (페이로드 절약 위해 더 짧게)
    KST 16:30(1차) + 17:30(백업) 자동 실행."""
    from backend.services.foreign_flow import build_foreign_flow_snapshot
    from backend.services.db_cache import db_get_stale, db_set

    MARKET_LIMIT = 30
    TOP_LIMIT = 15

    def _merge_market(prev_hist: list, today: dict) -> list:
        if not today or not today.get("bizdate"):
            return prev_hist or []
        out = [r for r in (prev_hist or []) if r.get("date") != today["bizdate"]]
        out.append({
            "date":          today["bizdate"],
            "personal":      today.get("personal", 0),
            "foreign":       today.get("foreign", 0),
            "institutional": today.get("institutional", 0),
        })
        out.sort(key=lambda r: r["date"])
        return out[-MARKET_LIMIT:]

    def _slim(items: list) -> list:
        """top_history 페이로드 절약 — 표시 필수 필드만 보관."""
        return [
            {
                "ticker":            it.get("ticker", ""),
                "name":              it.get("name", ""),
                "net_buy_value_mil": it.get("net_buy_value_mil", 0),
                "net_buy_volume":    it.get("net_buy_volume", 0),
            }
            for it in (items or [])
        ]

    def _merge_top(prev_top: dict, bizdate: str, buyers: list, sellers: list) -> dict:
        if not bizdate:
            return prev_top or {}
        out = dict(prev_top or {})
        out[bizdate] = {"buyers": _slim(buyers), "sellers": _slim(sellers)}
        sorted_dates = sorted(out.keys())
        for d in sorted_dates[:-TOP_LIMIT]:
            out.pop(d, None)
        return out

    try:
        snapshot = await _run_sync(build_foreign_flow_snapshot)

        tb = snapshot.get("top_buyers", {}) or {}
        mt = snapshot.get("market_today", {}) or {}
        empty_tb = not (tb.get("kospi") or tb.get("kosdaq"))
        empty_mt = not ((mt.get("kospi") or {}).get("bizdate") or (mt.get("kosdaq") or {}).get("bizdate"))
        if empty_tb and empty_mt:
            logger.warning("[WARN] [scheduler] foreign_flow 빈 응답 — 기존 DB 유지")
            return

        # 기준 날짜 — 시장 합계 bizdate 사용 (종목 TOP 응답에는 날짜 없음)
        bizdate = (mt.get("kospi") or {}).get("bizdate") or (mt.get("kosdaq") or {}).get("bizdate")

        prev = await _run_sync(db_get_stale, "foreign_flow") or {}

        # 시장 합계 시계열 누적
        prev_mh = prev.get("market_history") or {}
        snapshot["market_history"] = {
            "kospi":  _merge_market(prev_mh.get("kospi"),  mt.get("kospi")  or {}),
            "kosdaq": _merge_market(prev_mh.get("kosdaq"), mt.get("kosdaq") or {}),
        }

        # 종목 TOP 시계열 누적
        prev_th = prev.get("top_history") or {}
        snapshot["top_history"] = {
            "kospi":  _merge_top(prev_th.get("kospi"),  bizdate,
                                 snapshot.get("top_buyers", {}).get("kospi"),
                                 snapshot.get("top_sellers", {}).get("kospi")),
            "kosdaq": _merge_top(prev_th.get("kosdaq"), bizdate,
                                 snapshot.get("top_buyers", {}).get("kosdaq"),
                                 snapshot.get("top_sellers", {}).get("kosdaq")),
        }

        # 메타: 사용 가능한 날짜 목록(최신 순) + 현재 기준일
        all_dates = sorted(snapshot["top_history"].get("kospi", {}).keys(), reverse=True)
        snapshot["available_dates"] = all_dates
        snapshot["current_date"] = bizdate

        await _run_sync(db_set, "foreign_flow", snapshot)
        logger.info(
            f"[OK] [scheduler] foreign_flow 갱신 완료 "
            f"(market_history={len(snapshot['market_history']['kospi'])}일, "
            f"top_history={len(all_dates)}일, bizdate={bizdate})"
        )
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] foreign_flow 갱신 실패: {e}")


async def refresh_etf_signals():
    """ETF/미장/국장 매수매도 시그널 (30분 주기, Gemini 배치 1회)"""
    from backend.services.etf_signals import get_etf_signals
    from backend.services.db_cache import db_set
    from backend.services.prediction_logger import save_etf_predictions
    try:
        result = await _run_sync(get_etf_signals)
        await _run_sync(db_set, "etf_signals", result)
        await _run_sync(save_etf_predictions, result)
        logger.info("[OK] [scheduler] etf_signals 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] etf_signals 갱신 실패: {e}")


async def _refresh_etf_launches(market: str):
    """ETF 신규상장 수집 → 목록 저장 + 상위 15개(예정 임박순→최근 최신순) 상세 미리 캐시.
    market: 'kr' | 'us'. 외부 소스가 비거나 막혀도 graceful(빈 구조 저장 안 함, 기존 캐시 유지)."""
    from backend.services.etf_launches import (
        collect_kr_launches, collect_us_launches, build_detail,
        KEY_KR, KEY_US,
    )
    from backend.services.db_cache import db_set
    try:
        if market == "kr":
            result = await _run_sync(collect_kr_launches)
            list_key = KEY_KR
        else:
            result = await _run_sync(collect_us_launches)
            list_key = KEY_US

        # 빈 수집이면 기존 캐시 유지(요구사항: 실패 시 마지막 캐시 유지)
        if not result.get("upcoming") and not result.get("recent"):
            logger.warning(f"[scheduler] etf_launches_{market} 빈 수집 — 기존 DB 유지")
            return

        # _raw_top: 상세 빌드용 신선 항목(ISIN/_sort 포함, 직렬화 불가) — db_set 전 분리
        raw_top = result.pop("_raw_top", [])

        await _run_sync(db_set, list_key, result)
        logger.info(
            f"[scheduler] etf_launches_{market} 갱신 완료 "
            f"(예정 {len(result['upcoming'])} / 최근 {len(result['recent'])})"
        )

        # 상세 미리 캐시 — 상위 15개 중 티커 있는 항목(=상장 완료분)만.
        # 신선 항목(ISIN 등 내부필드 포함)을 build_detail에 직접 넘겨 KR 구성종목 조회 가능케 함.
        for item in raw_top:
            ticker = (item.get("ticker") or "").strip()
            if not ticker:
                continue  # 예정 건(티커 미정)은 상세 캐시 스킵 — 목록 카드로 충분
            try:
                detail = await _run_sync(build_detail, market, ticker, item)
                await _run_sync(
                    db_set, f"etf_launch_detail_{market}_{ticker.upper()}", detail,
                )
            except Exception as e:
                logger.warning(f"[scheduler] etf_launch_detail {market}/{ticker} 실패: {e}")
    except Exception as e:
        logger.error(f"[scheduler] etf_launches_{market} 갱신 실패: {e}")


async def refresh_etf_launches_kr():
    """국내 ETF 신규상장 갱신 (6시간 주기)"""
    await _refresh_etf_launches("kr")


async def refresh_etf_launches_us():
    """미국 ETF 신규상장 갱신 (6시간 주기)"""
    await _refresh_etf_launches("us")


async def evaluate_predictions():
    """어제 ETF 예측에 실제 가격 대입 → 적중 여부 기록 (KST 18:30 = UTC 09:30)"""
    from backend.services.prediction_logger import evaluate_predictions as _evaluate
    try:
        updated = await _run_sync(_evaluate)
        logger.info(f"[OK] [scheduler] prediction_log 평가 완료: {updated}건")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] prediction_log 평가 실패: {e}")


async def refresh_market_driver():
    """오늘의 마켓 드라이버 (Gemini) → Supabase 갱신"""
    from backend.services.news import fetch_top_headlines
    from backend.services.ai_summary import generate_market_drivers
    try:
        headlines = await _run_sync(fetch_top_headlines, 20)
        await _run_sync(generate_market_drivers, headlines)
        logger.info("[OK] [scheduler] market_driver 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] market_driver 갱신 실패: {e}")


async def refresh_today_picks():
    """S&P 50종목 FinBERT + Gemini 분석 → Supabase 갱신"""
    from backend.services.today_picks import get_today_picks
    try:
        await _run_sync(get_today_picks)
        logger.info("[OK] [scheduler] today_picks 갱신 완료")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] today_picks 갱신 실패: {e}")


async def refresh_review_cycle():
    """AI 추천 회고 — 매일 새벽 1회.
      1. verify_past_predictions: 만기 도래(1d/7d/30d) 스냅샷의 hit/ret 판정
      2. analyze_failures: 빗나간 케이스만 Gemini로 root_cause·avoid_rule 생성
    실패 분석은 Gemini 호출 비용 절감을 위해 horizon당 최대 10건 cap."""
    from backend.services.prediction_tracker import verify_past_predictions, analyze_failures
    try:
        v = await _run_sync(verify_past_predictions)
        logger.info(f"[OK] [scheduler] review verify 완료: {v}")
        a = await _run_sync(analyze_failures)
        logger.info(f"[OK] [scheduler] review analyze 완료: {a}")
    except Exception as e:
        logger.error(f"[FAIL] [scheduler] review_cycle 실패: {e}")


async def send_telegram_morning():
    """텔레그램 오전 시황 (KST 07:00 = UTC 22:00)"""
    from backend.services.telegram_notifier import send_news_to_telegram
    await _run_sync(send_news_to_telegram, 7)


async def send_telegram_lunch():
    """텔레그램 점심 시황 (KST 12:00 = UTC 03:00)"""
    from backend.services.telegram_notifier import send_news_to_telegram
    await _run_sync(send_news_to_telegram, 12)


async def send_telegram_evening():
    """텔레그램 저녁 시황 (KST 18:00 = UTC 09:00)"""
    from backend.services.telegram_notifier import send_news_to_telegram
    await _run_sync(send_news_to_telegram, 18)


async def warm_all_caches():
    """앱 시작 시 캐시 웜업 — Gemini 없는 데이터 전부 즉시 갱신
    Gemini 잡(daily_signal·news_ai·investor_details·hot_stock_details·market_driver·today_picks)은
    DB 미스 시에만 즉시 1회 실행 (첫 배포 빈 화면 방지), 이후 스케줄러가 주기적으로 갱신"""
    logger.info("[WARMUP] [scheduler] 캐시 웜업 시작...")
    await asyncio.gather(
        refresh_investors(),
        refresh_stocks_hot(),
        refresh_recommendations(),
        refresh_crypto(),
        refresh_commodities(),
        refresh_bonds(),
        refresh_korea_rates(),
        refresh_rates(),
        refresh_realestate(),
        refresh_money_flow(),
        return_exceptions=True,
    )
    logger.info("[WARMUP] [scheduler] 캐시 웜업 완료")

    # Gemini 잡: DB 미스 시에만 즉시 1회 실행 (첫 배포 후 빈 화면 방지)
    from backend.services.db_cache import db_get_stale
    md_cached = await _run_sync(db_get_stale, "market_driver")
    if not md_cached:
        logger.info("[WARMUP] [scheduler] market_driver DB 미스 → 즉시 1회 실행")
        asyncio.create_task(refresh_market_driver())

    picks_cached = await _run_sync(db_get_stale, "today_picks")
    if not picks_cached:
        logger.info("[WARMUP] [scheduler] today_picks DB 미스 → 즉시 1회 실행")
        asyncio.create_task(refresh_today_picks())

    ds_cached = await _run_sync(db_get_stale, "daily_signal")
    if not ds_cached:
        logger.info("[WARMUP] [scheduler] daily_signal DB 미스 → 즉시 1회 실행")
        asyncio.create_task(refresh_daily_signal())

    na_cached = await _run_sync(db_get_stale, "news_ai")
    if not na_cached:
        logger.info("[WARMUP] [scheduler] news_ai DB 미스 → 즉시 1회 실행")
        asyncio.create_task(refresh_news_ai())

    es_cached = await _run_sync(db_get_stale, "etf_signals")
    if not es_cached:
        logger.info("[WARMUP] [scheduler] etf_signals DB 미스 → 즉시 1회 실행")
        asyncio.create_task(refresh_etf_signals())

    ff_cached = await _run_sync(db_get_stale, "foreign_flow")
    if _foreign_flow_needs_backfill(ff_cached):
        logger.info("[WARMUP] [scheduler] foreign_flow 미스/당일 누락 → 즉시 1회 실행")
        asyncio.create_task(refresh_foreign_flow())

    tf_cached = await _run_sync(db_get_stale, "investor_13f_warren-buffett")
    if not tf_cached:
        logger.info("[WARMUP] [scheduler] holdings_13f DB 미스 → 즉시 1회 실행")
        asyncio.create_task(refresh_holdings_13f())

    el_kr_cached = await _run_sync(db_get_stale, "etf_launches_kr")
    if not el_kr_cached:
        logger.info("[scheduler] etf_launches_kr DB 미스 — 즉시 1회 실행")
        asyncio.create_task(refresh_etf_launches_kr())

    el_us_cached = await _run_sync(db_get_stale, "etf_launches_us")
    if not el_us_cached:
        logger.info("[scheduler] etf_launches_us DB 미스 — 즉시 1회 실행")
        asyncio.create_task(refresh_etf_launches_us())


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    # ── Gemini 없음 (빠른 주기) ─────────────────────────────
    scheduler.add_job(refresh_investors,     "interval", minutes=10, id="investors",     max_instances=1)
    scheduler.add_job(refresh_stocks_hot,    "interval", minutes=10, id="stocks_hot",    max_instances=1)
    scheduler.add_job(refresh_recommendations,"interval", minutes=10, id="recommendations",max_instances=1)
    scheduler.add_job(refresh_crypto,        "interval", minutes=10, id="crypto",        max_instances=1)
    scheduler.add_job(refresh_commodities,   "interval", minutes=30, id="commodities",   max_instances=1)
    scheduler.add_job(refresh_bonds,         "interval", minutes=30, id="bonds",         max_instances=1)
    scheduler.add_job(refresh_money_flow,    "interval", minutes=30, id="money_flow",    max_instances=1)
    scheduler.add_job(refresh_korea_rates,   "interval", hours=1,    id="korea_rates",   max_instances=1)
    scheduler.add_job(refresh_rates,         "interval", minutes=30, id="rates",         max_instances=1)
    scheduler.add_job(refresh_realestate,    "interval", hours=1,    id="realestate",    max_instances=1)
    # ── Gemini 포함 (긴 주기, 4초 간격 자동 적용) ───────────
    scheduler.add_job(refresh_investor_details,  "interval", hours=1,  id="investor_details",  max_instances=1)
    scheduler.add_job(refresh_hot_stock_details, "interval", hours=1,  id="hot_stock_details", max_instances=1)
    scheduler.add_job(refresh_news_ai,           "interval", hours=1,  id="news_ai",           max_instances=1)
    scheduler.add_job(refresh_market_driver,     "interval", minutes=30, id="market_driver",   max_instances=1)
    scheduler.add_job(refresh_etf_signals,       "interval", minutes=30, id="etf_signals",     max_instances=1)
    scheduler.add_job(refresh_daily_signal,     "interval", hours=6,  id="daily_signal",      max_instances=1)
    scheduler.add_job(refresh_today_picks,       "interval", hours=6,  id="today_picks",       max_instances=1)
    scheduler.add_job(refresh_etf_launches_kr,   "interval", hours=6,  id="etf_launches_kr",   max_instances=1)
    scheduler.add_job(refresh_etf_launches_us,   "interval", hours=6,  id="etf_launches_us",   max_instances=1)
    # ── AI 추천 회고 — 매일 KST 07:00 (UTC 22:00) 검증 + 실패분석 ──
    scheduler.add_job(refresh_review_cycle, CronTrigger(hour=22, minute=0, timezone="UTC"), id="review_cycle", max_instances=1)
    # ── 외국인 매매 종목 TOP(네이버) — KST 16:30 장 마감 후 1차 + 17:30 백업 (UTC 07:30 / 08:30) ──
    scheduler.add_job(refresh_holdings_13f, CronTrigger(hour=21, minute=0, timezone="UTC"), id="holdings_13f", max_instances=1, misfire_grace_time=7200)
    scheduler.add_job(refresh_foreign_flow, CronTrigger(hour=7, minute=30, timezone="UTC"), id="foreign_flow",        max_instances=1, misfire_grace_time=7200)
    scheduler.add_job(refresh_foreign_flow, CronTrigger(hour=8, minute=30, timezone="UTC"), id="foreign_flow_backup", max_instances=1, misfire_grace_time=7200)
    # ── 예측 정확도 평가 — KST 18:30 장 마감 1시간 후 (UTC 09:30) ──
    scheduler.add_job(evaluate_predictions, CronTrigger(hour=9, minute=30, timezone="UTC"), id="evaluate_predictions", max_instances=1)
    # ── 텔레그램 뉴스 발송 — KST 07:00 / 12:00 / 18:00 (UTC 22:00 / 03:00 / 09:00) ──
    scheduler.add_job(send_telegram_morning, CronTrigger(hour=22, minute=0, timezone="UTC"), id="telegram_morning", max_instances=1)
    scheduler.add_job(send_telegram_lunch,   CronTrigger(hour=3,  minute=0, timezone="UTC"), id="telegram_lunch",   max_instances=1)
    scheduler.add_job(send_telegram_evening, CronTrigger(hour=9,  minute=0, timezone="UTC"), id="telegram_evening", max_instances=1)

    return scheduler

