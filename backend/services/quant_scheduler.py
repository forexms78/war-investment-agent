"""
자동매매 스케줄러 — 이동평균선(MA5/MA20) 골든크로스 + PER 필터

신호 로직:
  매수: MA5가 MA20을 상향 돌파(골든크로스) AND PER < PER_MAX_BUY
  매도(익절): MA5가 MA20을 하향 돌파(데드크로스)
  매도(손절): 보유 종목이 STOP_LOSS_PCT 이하 수익률

시장:
  KR — KIS API (한국 증권 코드 6자리)
  US — yfinance (NASDAQ/NYSE 티커)
"""
from datetime import datetime

from backend.services.db_cache import _get_client as _sb
from backend.services.kis_trader import (
    get_price_and_fundamentals,
    get_daily_prices,
    get_us_price_and_fundamentals,
    get_us_daily_prices,
    get_holdings,
    buy_market_order,
    sell_market_order,
    calculate_quantity,
)

MAX_AMOUNT_PER_STOCK = 200_000
STOP_LOSS_PCT = -8.0
PER_MAX_BUY = 30.0      # US 주식은 PER이 높은 편 — 30으로 완화
MA_SHORT = 5
MA_LONG = 20

# 기본 유니버스 — KOSPI 대형주 + NASDAQ/NYSE 주요 종목
DEFAULT_UNIVERSE = [
    # ── 한국 (KOSPI) ─────────────────────────────
    {"ticker": "005930", "name": "삼성전자",         "market": "KR"},
    {"ticker": "000660", "name": "SK하이닉스",        "market": "KR"},
    {"ticker": "035420", "name": "NAVER",             "market": "KR"},
    {"ticker": "051910", "name": "LG화학",            "market": "KR"},
    {"ticker": "006400", "name": "삼성SDI",           "market": "KR"},
    {"ticker": "035720", "name": "카카오",            "market": "KR"},
    {"ticker": "207940", "name": "삼성바이오로직스",   "market": "KR"},
    {"ticker": "068270", "name": "셀트리온",          "market": "KR"},
    {"ticker": "105560", "name": "KB금융",            "market": "KR"},
    {"ticker": "055550", "name": "신한지주",          "market": "KR"},
    {"ticker": "005380", "name": "현대차",            "market": "KR"},
    {"ticker": "000270", "name": "기아",              "market": "KR"},
    {"ticker": "066570", "name": "LG전자",            "market": "KR"},
    # ── 미국 (NASDAQ/NYSE) ───────────────────────
    {"ticker": "AAPL",  "name": "Apple",              "market": "US"},
    {"ticker": "MSFT",  "name": "Microsoft",          "market": "US"},
    {"ticker": "NVDA",  "name": "NVIDIA",             "market": "US"},
    {"ticker": "GOOGL", "name": "Alphabet",           "market": "US"},
    {"ticker": "AMZN",  "name": "Amazon",             "market": "US"},
    {"ticker": "META",  "name": "Meta",               "market": "US"},
    {"ticker": "TSLA",  "name": "Tesla",              "market": "US"},
    {"ticker": "AVGO",  "name": "Broadcom",           "market": "US"},
    {"ticker": "JPM",   "name": "JPMorgan Chase",     "market": "US"},
    {"ticker": "V",     "name": "Visa",               "market": "US"},
    {"ticker": "BRK-B", "name": "Berkshire Hathaway", "market": "US"},
    {"ticker": "LLY",   "name": "Eli Lilly",          "market": "US"},
]


def _ensure_universe():
    """유니버스 테이블이 비어있으면 기본 종목 시딩 (market 컬럼 포함)"""
    existing = _sb().table("autotrade_watchlist").select("ticker").execute().data or []
    existing_tickers = {r["ticker"] for r in existing}
    to_insert = [s for s in DEFAULT_UNIVERSE if s["ticker"] not in existing_tickers]
    if to_insert:
        _sb().table("autotrade_watchlist").insert(to_insert).execute()


def _ma(prices: list[float], n: int) -> float | None:
    if len(prices) < n:
        return None
    return sum(prices[:n]) / n


def _calc_signal(ticker: str, market: str = "KR") -> dict:
    """이동평균선 골든크로스 + PER 필터로 매수/매도 신호 계산"""
    try:
        if market == "US":
            info = get_us_price_and_fundamentals(ticker)
            prices = get_us_daily_prices(ticker, days=MA_LONG + 5)
        else:
            info = get_price_and_fundamentals(ticker)
            prices = get_daily_prices(ticker, days=MA_LONG + 5)
    except Exception as e:
        return {"signal": "hold", "reason": str(e), "current_price": None}

    cp = info["current_price"]
    per = info["per"]

    ma5_now = _ma(prices, MA_SHORT)
    ma20_now = _ma(prices, MA_LONG)
    ma5_prev = _ma(prices[1:], MA_SHORT)
    ma20_prev = _ma(prices[1:], MA_LONG)

    if not all([cp, ma5_now, ma20_now, ma5_prev, ma20_prev]):
        return {"signal": "hold", "reason": "데이터 부족", "current_price": cp, **info}

    golden_cross = ma5_prev <= ma20_prev and ma5_now > ma20_now
    dead_cross = ma5_prev >= ma20_prev and ma5_now < ma20_now

    per_limit = PER_MAX_BUY
    if golden_cross and (per is None or per < per_limit):
        signal = "buy"
        reason = f"골든크로스 (MA{MA_SHORT}>{MA_LONG}) PER={per}"
    elif dead_cross:
        signal = "sell"
        reason = f"데드크로스 (MA{MA_SHORT}<MA{MA_LONG})"
    else:
        signal = "hold"
        reason = f"MA{MA_SHORT}={ma5_now:.2f} MA{MA_LONG}={ma20_now:.2f}"

    return {
        "signal": signal,
        "reason": reason,
        "current_price": cp,
        "ma5": round(ma5_now, 2),
        "ma20": round(ma20_now, 2),
        "per": per,
        "pbr": info.get("pbr"),
        "w52_high": info.get("w52_high"),
        "w52_low": info.get("w52_low"),
    }


def _notify(action: str, ticker: str, market: str, price: float, quantity: int, reason: str):
    action_str = "매수" if action == "buy" else "매도"
    currency = "$" if market == "US" else "₩"
    msg = f"[자동매매] {action_str} · {ticker} ({market})\n{currency}{price:,.2f} x {quantity}주\n{reason}"
    try:
        from backend.services.telegram_notifier import send_telegram_message
        send_telegram_message(msg)
    except Exception:
        pass


def _record_trade(ticker: str, action: str, price: float, quantity: int, reason: str, order_id: str = ""):
    _sb().table("auto_trades").insert({
        "ticker": ticker,
        "action": action,
        "price": price,
        "quantity": quantity,
        "amount": price * quantity,
        "reason": reason,
        "kis_order_id": order_id,
    }).execute()


def _is_trading_hours() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    h, m = now.hour, now.minute
    # 한국장: 09:00~15:30 / 미국장: 23:30~06:00 (한국시간) — 둘 다 커버
    kr_open = (9, 0) <= (h, m) <= (15, 30)
    us_open = (h, m) >= (23, 30) or (h, m) <= (6, 0)
    return kr_open or us_open


def scan_and_trade():
    if not _is_trading_hours():
        return

    _ensure_universe()

    # 1. 보유 종목 손절 및 데드크로스 매도 (KR만 KIS 매도 가능)
    try:
        holdings = get_holdings()
        universe = _sb().table("autotrade_watchlist").select("ticker, market").execute().data or []
        market_map = {s["ticker"]: s.get("market", "KR") for s in universe}

        for h in holdings:
            market = market_map.get(h["ticker"], "KR")
            if market != "KR":
                continue  # 미국 주식은 KIS 매도 불가 — 별도 브로커 필요
            sell_reason = None
            if h["pnl_pct"] <= STOP_LOSS_PCT:
                sell_reason = f"손절 ({h['pnl_pct']:.1f}%)"
            else:
                sig = _calc_signal(h["ticker"], market)
                if sig["signal"] == "sell":
                    sell_reason = sig["reason"]
            if sell_reason:
                result = sell_market_order(h["ticker"], h["quantity"])
                order_id = result.get("output", {}).get("ODNO", "")
                _record_trade(h["ticker"], "sell", h["current_price"], h["quantity"], sell_reason, order_id)
                _notify("sell", h["ticker"], market, h["current_price"], h["quantity"], sell_reason)
    except Exception as e:
        print(f"[quant_scheduler] 매도 스캔 오류: {e}")

    # 2. 유니버스 스캔 → 골든크로스 매수 (KR만)
    try:
        universe = _sb().table("autotrade_watchlist").select("ticker, name, market").execute().data or []
        holdings = get_holdings()
        held = {h["ticker"] for h in holdings}

        for stock in universe:
            ticker = stock["ticker"]
            market = stock.get("market", "KR")
            if market != "KR":
                continue  # KIS로는 미국 주식 매수 불가
            if ticker in held:
                continue
            try:
                sig = _calc_signal(ticker, market)
                if sig["signal"] == "buy" and sig.get("current_price"):
                    qty = calculate_quantity(MAX_AMOUNT_PER_STOCK, sig["current_price"])
                    if qty > 0:
                        result = buy_market_order(ticker, qty)
                        order_id = result.get("output", {}).get("ODNO", "")
                        _record_trade(ticker, "buy", sig["current_price"], qty, sig["reason"], order_id)
                        _notify("buy", ticker, market, sig["current_price"], qty, sig["reason"])
            except Exception as e:
                print(f"[quant_scheduler] {ticker} 처리 오류: {e}")
    except Exception as e:
        print(f"[quant_scheduler] 매수 스캔 오류: {e}")


def get_universe_signals() -> list[dict]:
    """자동매매 대시보드용 — 유니버스 전체 시그널 스냅샷"""
    _ensure_universe()
    universe = _sb().table("autotrade_watchlist").select("ticker, name, market").execute().data or []
    results = []
    for stock in universe:
        market = stock.get("market", "KR")
        try:
            sig = _calc_signal(stock["ticker"], market)
            results.append({
                "ticker": stock["ticker"],
                "name": stock["name"],
                "market": market,
                **sig,
            })
        except Exception:
            results.append({
                "ticker": stock["ticker"],
                "name": stock["name"],
                "market": market,
                "signal": "hold",
            })
    return results
