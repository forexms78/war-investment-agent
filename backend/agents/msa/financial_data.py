import yfinance as yf
import requests
from datetime import datetime, timedelta

# Yahoo Finance가 기본 요청을 차단하므로 세션에 User-Agent 주입
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})
yf.utils.requests = _session  # type: ignore

SECTOR_MAP = {
    "삼성전자": "반도체",
    "005930.KS": "반도체",
    "TSM": "반도체",
    "NVDA": "반도체",
    "AAPL": "기술",
    "MSFT": "기술",
    "XOM": "에너지",
    "CVX": "에너지",
    "BA": "방산",
    "LMT": "방산",
    "JPM": "금융",
    "GS": "금융",
}

NAME_MAP = {
    "삼성전자": "005930.KS",
    "삼성": "005930.KS",
    "TSMC": "TSM",
    "엔비디아": "NVDA",
    "애플": "AAPL",
    "마이크로소프트": "MSFT",
}


def get_ticker_symbol(stock_name: str) -> str:
    return NAME_MAP.get(stock_name, stock_name)


def _fetch_via_rest(ticker_symbol: str) -> dict | None:
    """yfinance 실패 시 Yahoo Finance REST API 직접 호출 폴백"""
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker_symbol}?interval=1d&range=30d"
        r = _session.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        result = data["chart"]["result"][0]
        meta = result["meta"]
        closes = result["indicators"]["quote"][0]["close"]
        closes = [c for c in closes if c is not None]
        if not closes:
            return None
        current_price = closes[-1]
        prev_price = closes[0]
        change_pct = ((current_price - prev_price) / prev_price) * 100
        import statistics
        pct_changes = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
        volatility = statistics.stdev(pct_changes) if len(pct_changes) > 1 else 0
        return {
            "current_price": round(current_price, 2),
            "change_30d_pct": round(change_pct, 2),
            "volatility": round(volatility, 2),
        }
    except Exception:
        return None


def fetch_financial_data(portfolio: list[str]) -> dict:
    result = {}
    end_date = datetime.today()
    start_date = end_date - timedelta(days=30)

    for stock in portfolio:
        ticker_symbol = get_ticker_symbol(stock)
        sector = SECTOR_MAP.get(ticker_symbol, SECTOR_MAP.get(stock, "기타"))
        fetched = None

        # 1차: yfinance
        try:
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(start=start_date.strftime("%Y-%m-%d"), end=end_date.strftime("%Y-%m-%d"))
            if not hist.empty:
                current_price = float(hist["Close"].iloc[-1])
                prev_price = float(hist["Close"].iloc[0])
                change_pct = ((current_price - prev_price) / prev_price) * 100
                volatility = float(hist["Close"].pct_change().std() * 100)
                fetched = {
                    "current_price": round(current_price, 2),
                    "change_30d_pct": round(change_pct, 2),
                    "volatility": round(volatility, 2),
                }
        except Exception:
            pass

        # 2차 폴백: REST API 직접 호출
        if fetched is None:
            fetched = _fetch_via_rest(ticker_symbol)

        if fetched:
            result[stock] = {"ticker": ticker_symbol, "sector": sector, **fetched}
        else:
            result[stock] = {"error": "데이터 수집 실패", "ticker": ticker_symbol, "sector": sector}

    return result
