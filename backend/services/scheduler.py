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
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)


async def _run_sync(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, *args)


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
        logger.info("✅ [scheduler] investors_list 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] investors_list 갱신 실패: {e}")


async def refresh_stocks_hot():
    from backend.services.investors import get_hot_tickers
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
        tickers = get_hot_tickers()
        stocks = await get_multiple_stocks_parallel(tickers)
        result = [data for ticker in tickers if "error" not in (data := stocks.get(ticker, {}))]
        await _run_sync(db_set, "stocks_hot", {"stocks": result})
        logger.info("✅ [scheduler] stocks_hot 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] stocks_hot 갱신 실패: {e}")


async def refresh_recommendations():
    from backend.services.investors import get_buy_recommendations, get_sell_recommendations
    from backend.services.financial import get_multiple_stocks_parallel
    from backend.services.db_cache import db_set
    try:
        buys = get_buy_recommendations()
        sells = get_sell_recommendations()
        all_tickers = list(set([r["ticker"] for r in buys] + [r["ticker"] for r in sells]))
        prices = await get_multiple_stocks_parallel(all_tickers)
        buy_result = [
            {**r, **{k: prices.get(r["ticker"], {}).get(k) for k in ["current_price", "change_30d_pct", "change_1d_pct"]}}
            for r in buys
        ]
        sell_result = [
            {**r, **{k: prices.get(r["ticker"], {}).get(k) for k in ["current_price", "change_30d_pct", "change_1d_pct"]}}
            for r in sells
        ]
        await _run_sync(db_set, "stocks_recommendations", {"buy": buy_result, "sell": sell_result})
        logger.info("✅ [scheduler] stocks_recommendations 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] stocks_recommendations 갱신 실패: {e}")


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
            logger.info(f"✅ [scheduler] investor_detail_{investor_id} 갱신 완료")
        except Exception as e:
            logger.error(f"❌ [scheduler] investor_detail_{investor_id} 갱신 실패: {e}")


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
            logger.info(f"✅ [scheduler] stock_detail_{ticker} 갱신 완료")
        except Exception as e:
            logger.error(f"❌ [scheduler] stock_detail_{ticker} 갱신 실패: {e}")


async def refresh_market_driver():
    """오늘의 마켓 드라이버 (Gemini) → Supabase 갱신"""
    from backend.services.news import fetch_top_headlines
    from backend.services.ai_summary import generate_market_drivers
    try:
        headlines = await _run_sync(fetch_top_headlines, 20)
        await _run_sync(generate_market_drivers, headlines)
        logger.info("✅ [scheduler] market_driver 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] market_driver 갱신 실패: {e}")


async def refresh_today_picks():
    """S&P 50종목 FinBERT + Gemini 분석 → Supabase 갱신"""
    from backend.services.today_picks import get_today_picks
    try:
        await _run_sync(get_today_picks)
        logger.info("✅ [scheduler] today_picks 갱신 완료")
    except Exception as e:
        logger.error(f"❌ [scheduler] today_picks 갱신 실패: {e}")


async def warm_all_caches():
    """앱 시작 시 캐시 웜업 — Gemini 없이 주가 데이터만 갱신
    Gemini 인사이트는 스케줄러 잡이 주기적으로 채움 (레이트 리밋 안전)"""
    logger.info("🔥 [scheduler] 캐시 웜업 시작 (Gemini 없음)...")
    await asyncio.gather(
        refresh_investors(),
        refresh_stocks_hot(),
        refresh_recommendations(),
        return_exceptions=True,
    )
    logger.info("🔥 [scheduler] 캐시 웜업 완료")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    # 주가 데이터 — 10분 주기 (Gemini 없음)
    scheduler.add_job(refresh_investors, "interval", minutes=10, id="investors", max_instances=1)
    scheduler.add_job(refresh_stocks_hot, "interval", minutes=10, id="stocks_hot", max_instances=1)
    scheduler.add_job(refresh_recommendations, "interval", minutes=10, id="recommendations", max_instances=1)
    # Gemini 인사이트 — 1시간 주기 (순차 실행, 4초 간격 자동 보장)
    scheduler.add_job(refresh_investor_details, "interval", hours=1, id="investor_details", max_instances=1)
    scheduler.add_job(refresh_hot_stock_details, "interval", hours=1, id="hot_stock_details", max_instances=1)
    # Gemini 분석 — 30분/6시간 주기
    scheduler.add_job(refresh_market_driver, "interval", minutes=30, id="market_driver", max_instances=1)
    scheduler.add_job(refresh_today_picks, "interval", hours=6, id="today_picks", max_instances=1)
    return scheduler
