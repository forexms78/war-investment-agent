"""
백그라운드 스케줄러 — DB-First 캐시 갱신

앱 시작 시 즉시 warm_all_caches() 실행 → 이후 10분마다 주요 캐시 자동 갱신.
엔드포인트는 Supabase에서만 읽어 즉시 응답 (< 200ms).
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)


async def _run_sync(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fn, *args)


async def refresh_investors():
    """투자자 목록 + 보유 종목 주가 → Supabase 갱신 (10분 주기)"""
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
    """핫 종목 TOP 12 + 주가 → Supabase 갱신 (10분 주기)"""
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
    """매수/매도 추천 + 주가 → Supabase 갱신 (10분 주기)"""
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


async def warm_all_caches():
    """앱 시작 시 모든 캐시 병렬 웜업 — 외부 API miss 없이 즉시 서비스 가능"""
    logger.info("🔥 [scheduler] 캐시 웜업 시작...")
    await asyncio.gather(
        refresh_investors(),
        refresh_stocks_hot(),
        refresh_recommendations(),
        return_exceptions=True,
    )
    logger.info("🔥 [scheduler] 캐시 웜업 완료")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(refresh_investors, "interval", minutes=10, id="investors", max_instances=1)
    scheduler.add_job(refresh_stocks_hot, "interval", minutes=10, id="stocks_hot", max_instances=1)
    scheduler.add_job(refresh_recommendations, "interval", minutes=10, id="recommendations", max_instances=1)
    return scheduler
