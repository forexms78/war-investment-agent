import math
from datetime import datetime

from backend.services.db_cache import _get_client as _sb
from backend.services.kis_trader import (
    get_current_price,
    get_holdings,
    buy_market_order,
    sell_market_order,
    calculate_quantity,
)

MAX_AMOUNT_PER_STOCK = 500_000
STOP_LOSS_PCT = -8.0


def _calc_signal(stock: dict, current_price: float) -> str:
    eps = stock.get("forward_eps")
    target_pe = stock.get("target_pe") or 30
    if not eps or eps == 0:
        return "hold"
    forward_pe = current_price / eps
    fair_value_pe = target_pe * eps
    bps = stock.get("bps")
    fair_value_graham = math.sqrt(22.5 * eps * bps) if bps and bps > 0 else None
    values = [v for v in [fair_value_pe, fair_value_graham] if v]
    avg_fair = sum(values) / len(values) if values else fair_value_pe
    if current_price > avg_fair * 1.2:
        return "sell"
    if forward_pe < target_pe and current_price < avg_fair:
        return "buy"
    return "hold"


def _notify(action: str, ticker: str, price: float, quantity: int, reason: str):
    action_str = "매수" if action == "buy" else "매도"
    reason_map = {"signal_buy": "시그널 매수", "stop_loss": "손절 자동 매도"}
    reason_str = reason_map.get(reason, reason)
    msg = f"[자동매매] {action_str} · {ticker}\n{price:,.0f}원 x {quantity}주\n사유: {reason_str}"
    try:
        from backend.services.telegram_notifier import send_telegram_message
        send_telegram_message(msg)
    except Exception:
        pass


def _record_trade(ticker: str, action: str, price: float, quantity: int, reason: str, kis_order_id: str = ""):
    _sb().table("auto_trades").insert({
        "ticker": ticker,
        "action": action,
        "price": price,
        "quantity": quantity,
        "amount": price * quantity,
        "reason": reason,
        "kis_order_id": kis_order_id,
    }).execute()
    _notify(action, ticker, price, quantity, reason)


def _is_trading_hours() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    hour, minute = now.hour, now.minute
    return (9, 0) <= (hour, minute) <= (15, 30)


def scan_and_trade():
    if not _is_trading_hours():
        return

    # 보유 종목 손절 체크
    try:
        holdings = get_holdings()
        for h in holdings:
            if h["pnl_pct"] <= STOP_LOSS_PCT:
                result = sell_market_order(h["ticker"], h["quantity"])
                order_id = result.get("output", {}).get("ODNO", "")
                _record_trade(h["ticker"], "sell", h["current_price"], h["quantity"], "stop_loss", order_id)
    except Exception as e:
        print(f"[quant_scheduler] 손절 체크 오류: {e}")

    # 추적 종목 매수 시그널 체크
    try:
        stocks = _sb().table("quant_stocks").select("*").eq("market", "KR").execute().data or []
        holdings = get_holdings()
        holdings_tickers = {h["ticker"] for h in holdings}

        for stock in stocks:
            ticker = stock["ticker"]
            if ticker in holdings_tickers:
                continue
            try:
                current_price = get_current_price(ticker)
                signal = _calc_signal(stock, current_price)
                if signal == "buy":
                    qty = calculate_quantity(MAX_AMOUNT_PER_STOCK, current_price)
                    if qty > 0:
                        result = buy_market_order(ticker, qty)
                        order_id = result.get("output", {}).get("ODNO", "")
                        _record_trade(ticker, "buy", current_price, qty, "signal_buy", order_id)
            except Exception as e:
                print(f"[quant_scheduler] {ticker} 처리 오류: {e}")
    except Exception as e:
        print(f"[quant_scheduler] 매수 스캔 오류: {e}")
