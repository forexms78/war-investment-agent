"""ETF 신호 예측 이력 저장 및 실제값 업데이트

테이블 생성 SQL (Supabase 대시보드 → SQL Editor에서 1회 실행):

  CREATE TABLE IF NOT EXISTS prediction_log (
    id               BIGSERIAL PRIMARY KEY,
    signal_date      DATE         NOT NULL,
    ticker           TEXT         NOT NULL,
    signal           TEXT         NOT NULL,
    rsi              NUMERIC,
    trend_phase      TEXT,
    price_at_signal  NUMERIC,
    actual_price_1d  NUMERIC,
    actual_change_1d NUMERIC,
    correct_1d       BOOLEAN,
    evaluated_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (signal_date, ticker)
  );

  CREATE INDEX IF NOT EXISTS idx_prediction_log_date
    ON prediction_log (signal_date DESC);

사용 흐름:
  1. refresh_etf_signals() 완료 시 → save_etf_predictions(result) 호출
  2. 매일 KST 18:30 (UTC 09:30) → evaluate_predictions() 호출
  3. /prediction-accuracy 엔드포인트 → get_accuracy_stats() 호출
"""

import logging
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_client = None
_KST = timezone(timedelta(hours=9))


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        _client = create_client(url, key)
    except Exception:
        pass
    return _client


def _signal_direction(signal: str) -> str:
    s = signal.upper()
    if "BUY" in s:
        return "up"
    if "SELL" in s:
        return "down"
    return "flat"


def save_etf_predictions(etf_signals_data: dict) -> None:
    """ETF 신호 데이터를 prediction_log에 저장.
    같은 날 같은 티커는 upsert로 덮어씀 (30분 주기 갱신에서 마지막 값 유지)."""
    client = _get_client()
    if not client:
        return

    today_kst = datetime.now(_KST).date().isoformat()
    etfs = etf_signals_data.get("etfs", [])

    rows = [
        {
            "signal_date":     today_kst,
            "ticker":          etf.get("ticker", ""),
            "signal":          etf.get("signal", ""),
            "rsi":             etf.get("rsi"),
            "trend_phase":     etf.get("trend_phase"),
            "price_at_signal": etf.get("current_price"),
        }
        for etf in etfs
        if etf.get("ticker") and etf.get("signal")
    ]

    if not rows:
        return

    try:
        client.table("prediction_log").upsert(
            rows, on_conflict="signal_date,ticker"
        ).execute()
        logger.info(f"[prediction_logger] {len(rows)}건 저장 완료 ({today_kst})")
    except Exception as e:
        logger.error(f"[prediction_logger] 저장 실패: {e}")


def evaluate_predictions() -> int:
    """어제 날짜 예측에 실제 가격·변동률·적중 여부 업데이트.
    returns: 업데이트된 행 수."""
    client = _get_client()
    if not client:
        return 0

    yesterday = (datetime.now(_KST) - timedelta(days=1)).date().isoformat()

    try:
        rows_resp = (
            client.table("prediction_log")
            .select("id,ticker,signal,price_at_signal")
            .eq("signal_date", yesterday)
            .is_("actual_price_1d", "null")
            .execute()
        )
    except Exception as e:
        logger.error(f"[prediction_logger] 평가 대상 조회 실패: {e}")
        return 0

    rows = rows_resp.data or []
    if not rows:
        logger.info(f"[prediction_logger] {yesterday} 평가 대상 없음")
        return 0

    tickers = list({r["ticker"] for r in rows})

    from backend.services.financial import get_multiple_stocks

    prices = get_multiple_stocks(tickers, period="5d")

    now_utc = datetime.now(timezone.utc).isoformat()
    updated = 0

    for row in rows:
        ticker = row["ticker"]
        price_data = prices.get(ticker, {})
        actual_price = price_data.get("current_price")
        actual_change = price_data.get("change_1d_pct")

        if actual_price is None:
            continue

        direction = _signal_direction(row["signal"])
        if direction == "up":
            correct = (actual_change or 0) > 0
        elif direction == "down":
            correct = (actual_change or 0) < 0
        else:
            correct = abs(actual_change or 0) < 1.0

        try:
            client.table("prediction_log").update(
                {
                    "actual_price_1d":  actual_price,
                    "actual_change_1d": actual_change,
                    "correct_1d":       correct,
                    "evaluated_at":     now_utc,
                }
            ).eq("id", row["id"]).execute()
            updated += 1
        except Exception as e:
            logger.error(f"[prediction_logger] {ticker} 업데이트 실패: {e}")

    logger.info(f"[prediction_logger] {yesterday} 평가 완료: {updated}/{len(rows)}건")
    return updated


def get_accuracy_stats(days: int = 30) -> dict:
    """최근 N일 예측 적중률 통계."""
    client = _get_client()
    if not client:
        return {}

    since = (datetime.now(_KST) - timedelta(days=days)).date().isoformat()

    try:
        resp = (
            client.table("prediction_log")
            .select("signal,trend_phase,correct_1d,ticker,actual_change_1d")
            .gte("signal_date", since)
            .not_.is_("correct_1d", "null")
            .execute()
        )
    except Exception as e:
        logger.error(f"[prediction_logger] 통계 조회 실패: {e}")
        return {}

    data = resp.data or []
    if not data:
        return {"days": days, "total": 0, "correct": 0, "accuracy": 0, "by_signal": {}}

    total = len(data)
    correct = sum(1 for r in data if r["correct_1d"])

    by_signal: dict = {}
    for r in data:
        s = r["signal"]
        if s not in by_signal:
            by_signal[s] = {"total": 0, "correct": 0}
        by_signal[s]["total"] += 1
        if r["correct_1d"]:
            by_signal[s]["correct"] += 1

    return {
        "days": days,
        "total": total,
        "correct": correct,
        "accuracy": round(correct / total * 100, 1),
        "by_signal": {
            s: {**v, "accuracy": round(v["correct"] / v["total"] * 100, 1)}
            for s, v in by_signal.items()
        },
    }
