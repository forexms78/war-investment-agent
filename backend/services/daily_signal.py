import json
import re
import time
from datetime import datetime
from typing import Optional
from backend.utils.gemini import call_gemini
from backend.services.db_cache import db_get, db_set

_signal_cache: Optional[tuple[dict, float]] = None
SIGNAL_TTL = 7200
DB_CACHE_KEY = "daily_signal"

SYSTEM = """당신은 전문 투자 분석가입니다.
여러 투자 데이터 소스(슈퍼 투자자 포트폴리오, 기술적 신호, 외국인 매매 동향, AI 뉴스 분석)를 종합하여
투자자에게 실행 가능한 구체적인 매수/매도 추천과 집중 종목을 제시합니다.
한국어로 응답하세요.
"""


async def get_daily_signal(
    buy_recs: list[dict],
    sell_recs: list[dict],
    etf_signal_data: dict,
    foreign_flow_data: dict,
    market_drivers: list[dict],
    fed_rate: float,
) -> dict:
    global _signal_cache
    now = time.time()
    if _signal_cache and now - _signal_cache[1] < SIGNAL_TTL:
        return _signal_cache[0]
    db_cached = db_get(DB_CACHE_KEY, SIGNAL_TTL)
    if db_cached:
        _signal_cache = (db_cached, now)
        return db_cached

    prompt = _build_prompt(buy_recs, sell_recs, etf_signal_data, foreign_flow_data, market_drivers, fed_rate)

    try:
        raw = call_gemini(prompt, SYSTEM)
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        parsed = json.loads(match.group() if match else raw)

        result = {
            "headline": parsed.get("headline", "오늘의 데일리 시그널을 준비 중입니다."),
            "sentiment": parsed.get("sentiment", "Neutral"),
            "sentiment_score": parsed.get("sentiment_score", 50),
            "market_summary": parsed.get("market_summary", ""),
            "buy_recommendations": parsed.get("buy_recommendations", []),
            "sell_recommendations": parsed.get("sell_recommendations", []),
            "focus_list": parsed.get("focus_list", []),
            "market_drivers": parsed.get("market_drivers", []),
            "fed_rate": fed_rate,
            "updated_at": datetime.now().isoformat(),
        }
    except Exception:
        result = _fallback(buy_recs, sell_recs, etf_signal_data, fed_rate)

    _signal_cache = (result, time.time())
    db_set(DB_CACHE_KEY, result)
    return result


def _build_prompt(
    buy_recs: list[dict],
    sell_recs: list[dict],
    etf_signal_data: dict,
    foreign_flow_data: dict,
    market_drivers: list[dict],
    fed_rate: float,
) -> str:
    def _fmt_etf(items: list[dict], label: str) -> str:
        out = [f"[{label}]"]
        for item in items[:10]:
            sig = item.get("signal", "HOLD")
            if sig in ("STRONG_BUY", "BUY", "STRONG_SELL", "SELL"):
                out.append(f"  {item['ticker']} {item['name']} → {sig} ({item.get('reason', '')})")
        return "\n".join(out)

    etf_lines = []
    for key, label in [("etfs", "ETF"), ("us_stocks", "미국주식"), ("kr_stocks", "한국주식")]:
        items = etf_signal_data.get(key, [])
        if items:
            etf_lines.append(_fmt_etf(items, label))

    fb = foreign_flow_data or {}
    top_buyers = fb.get("top_buyers", {}) or {}
    top_sellers = fb.get("top_sellers", {}) or {}

    def _fmt_foreign(items: list[dict]) -> str:
        return ", ".join(f"{i['name']}({i.get('net_buy_value_mil', 0):,}백만)" for i in items)

    foreign_buyers_text = ""
    for market in ("kospi", "kosdaq"):
        items = top_buyers.get(market, [])[:5]
        if items:
            foreign_buyers_text += f"\n  {market.upper()} 외국인 순매수 Top5: {_fmt_foreign(items)}"
    foreign_sellers_text = ""
    for market in ("kospi", "kosdaq"):
        items = top_sellers.get(market, [])[:5]
        if items:
            foreign_sellers_text += f"\n  {market.upper()} 외국인 순매도 Top5: {_fmt_foreign(items)}"

    driver_text = "\n".join(
        f"- [{d.get('direction', '')}] {d.get('headline', '')}: {d.get('impact', '')}"
        for d in (market_drivers or [])[:3]
    ) or "없음"

    buy_text = "\n".join(
        f"  {r['ticker']} {r['name']} — 매수: {', '.join(r['buyers'][:3])} (평균비중 {r.get('weight_avg', 0)}%)"
        for r in buy_recs
    ) if buy_recs else "  없음"

    sell_text = "\n".join(
        f"  {r['ticker']} {r['name']} — 매도: {', '.join(r['sellers'][:3])}"
        for r in sell_recs
    ) if sell_recs else "  없음"

    return f"""당신은 기관 투자자들을 위한 리서치 애널리스트입니다.
아래 여러 데이터 소스를 종합하여 오늘 집중해야 할 매수/매도 추천과 종목을 골라주세요.

[Fed 기준금리]
{ fed_rate }%

[슈퍼 투자자 매수 추천 종목]
{buy_text}

[슈퍼 투자자 매도 추천 종목]
{sell_text}

[ETF/주식 기술적 신호]
{chr(10).join(etf_lines)}

[외국인 매매 동향]
매수: {foreign_buyers_text}
매도: {foreign_sellers_text}

[오늘의 마켓 드라이버]
{driver_text}

위 데이터를 종합하여 아래 JSON 형식으로만 응답하세요 (코드블록 없이 순수 JSON):
{{
  "headline": "오늘의 핵심 요약 한 줄 (한국어, 60자 이내)",
  "sentiment": "Bullish|Neutral|Bearish",
  "sentiment_score": 0~100,
  "market_summary": "3~4문장 시장 분석 (한국어)",
  "buy_recommendations": [
    {{"ticker": "NVDA", "name": "NVIDIA", "reason": "추천 이유 (한국어)", "confidence": 85, "signals": ["investor_buy", "etf_strong_buy"]}}
  ],
  "sell_recommendations": [
    {{"ticker": "TLT", "name": "장기국채 ETF", "reason": "추천 이유 (한국어)", "confidence": 70, "signals": ["investor_sell", "etf_sell"]}}
  ],
  "focus_list": [
    {{"ticker": "QQQ", "name": "Invesco QQQ Trust", "reason": "집중해야 하는 이유 (한국어)", "signals": ["etf_strong_buy", "foreign_buy"]}}
  ],
  "market_drivers": [
    {{"headline": "핵심뉴스요약", "impact": "시장영향 설명", "direction": "bullish|bearish|mixed"}}
  ]
}}

규칙:
- buy_recommendations: 최대 5개. 여러 신호가 겹치는 종목 우선 (슈퍼 investor 매수 + ETF Strong Buy + 외국인 매수 등)
- sell_recommendations: 최대 5개. investor 매도 + ETF Sell/Strong_Sell + 외국인 매도 겹치는 종목
- focus_list: 최대 5개. 매수/매도 외에 주목할 ETF/종목 (ETF Strong Buy 혹은 외국인 집중 매수 등)
- signals 필드에는 해당 추천의 근거가 된 데이터 소스를 배열로 표시: investor_buy, investor_sell, etf_strong_buy, etf_buy, etf_sell, etf_strong_sell, foreign_buy, foreign_sell, news_impact
- ticker가 없거나 불명확한 항목은 제외할 것
- confidence: 0~100, 숫자가 높을수록 신뢰도 높음 (여러 신호가 겹칠수록 높게)"""


def _fallback(
    buy_recs: list[dict],
    sell_recs: list[dict],
    etf_signal_data: dict,
    fed_rate: float,
) -> dict:
    top_buys = buy_recs[:5] if buy_recs else []
    top_sells = sell_recs[:5] if sell_recs else []
    focus = []
    for key in ("etfs", "us_stocks", "kr_stocks"):
        for item in etf_signal_data.get(key, []):
            if item.get("signal") == "STRONG_BUY" and len(focus) < 5:
                focus.append({
                    "ticker": item["ticker"],
                    "name": item["name"],
                    "reason": f"기술적 STRONG_BUY 신호 (RSI {item.get('rsi', '?')})",
                    "signals": ["etf_strong_buy"],
                })
    top_buy_tickers = [r["ticker"] for r in top_buys]
    focus = [f for f in focus if f["ticker"] not in top_buy_tickers][:5]

    return {
        "headline": f"Fed 금리 {fed_rate}% — {len(top_buys)}개 매수 추천, {len(top_sells)}개 매도 검토",
        "sentiment": "Neutral",
        "sentiment_score": 50,
        "market_summary": f"현재 Fed 기준금리 {fed_rate}% 환경입니다. 슈퍼 투자자들의 매수/매도 동향과 기술적 신호를 종합한 결과입니다.",
        "buy_recommendations": top_buys,
        "sell_recommendations": top_sells,
        "focus_list": focus,
        "market_drivers": [],
        "fed_rate": fed_rate,
        "updated_at": datetime.now().isoformat(),
    }
