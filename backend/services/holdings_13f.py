"""
13F 보유 종목 크롤러 — 13f.info 집계 사이트 기반

데이터 소스:
  - 매니저 페이지: https://13f.info/manager/{cik-slug}
      → 분기별 13F filing 목록(분기·공시일·filing_id) HTML 파싱
  - 분기 상세 JSON: https://13f.info/data/13f/{filing_id}
      → {"data": [[Sym, Issuer, Class, CUSIP, Value($000), %, Shares, Principal, OptionType], ...]}

robots.txt: /search 만 Disallow. /manager·/13f·/data 허용.
변동(action)은 13F가 직접 제공하지 않으므로 직전 분기 주식수 대비 diff로 산출.
평단·정확 매수일은 13F 구조상 알 수 없음 → 분기·공시일까지만.
"""
import logging
import re
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")
_BASE = "https://13f.info"
_HEADERS = {"User-Agent": "Mozilla/5.0 (Whalyx/2.7 +https://whalyx.vercel.app)"}

# 신규/추가/축소 판정 임계 (주식수 변화율)
_ADD_THRESHOLD = 0.02

# 분기말 날짜 (filed_date 없을 때 폴백 — 13F는 분기말 기준)
_Q_END = {"Q1": "03-31", "Q2": "06-30", "Q3": "09-30", "Q4": "12-31"}


def _quarter_end(quarter: str) -> str:
    """'2026 Q1' → '2026-03-31'"""
    try:
        year, q = quarter.split()
        return f"{year}-{_Q_END.get(q, '12-31')}"
    except Exception:
        return ""


def get_manager_filings(cik_slug: str, limit: int = 8) -> list[dict]:
    """매니저 페이지에서 최근 분기 13F filing 목록.

    Returns: [{"filing_id", "quarter"("2026 Q1"), "filed_date"("2026-05-15")}, ...] 최신순
    """
    url = f"{_BASE}/manager/{cik_slug}"
    try:
        res = requests.get(url, headers=_HEADERS, timeout=15)
        res.raise_for_status()
    except Exception as e:
        logger.error(f"[13f] 매니저 페이지 실패 {cik_slug}: {e}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    filings: list[dict] = []
    seen_q: set[str] = set()
    for a in soup.select("a[href^='/13f/']"):
        href = a.get("href", "")
        m = re.search(r"/13f/(\d+)-.*?-(q[1-4])-(\d{4})", href)
        if not m:
            continue
        quarter = f"{m.group(3)} {m.group(2).upper()}"
        if quarter in seen_q:   # 같은 분기 수정공시(amendment) 중복 → 최신(첫 등장)만
            continue
        seen_q.add(quarter)
        fid = m.group(1)
        filed = ""
        tr = a.find_parent("tr")
        if tr:
            dm = re.search(r"\d{4}-\d{2}-\d{2}", tr.get_text())
            if dm:
                filed = dm.group(0)
        filings.append({"filing_id": fid, "quarter": quarter, "filed_date": filed})
        if len(filings) >= limit:
            break
    return filings


def get_holdings(filing_id: str) -> list[dict]:
    """분기 상세 JSON → 보유 종목(롱 포지션만). 풋/콜 옵션 제외."""
    url = f"{_BASE}/data/13f/{filing_id}"
    try:
        res = requests.get(url, headers=_HEADERS, timeout=15)
        res.raise_for_status()
        rows = (res.json() or {}).get("data", []) or []
    except Exception as e:
        logger.error(f"[13f] holdings JSON 실패 {filing_id}: {e}")
        return []

    holdings: list[dict] = []
    for r in rows:
        if len(r) < 7:
            continue
        # [Sym, Issuer, Class, CUSIP, Value($000), %, Shares, Principal, OptionType]
        option_type = r[8] if len(r) > 8 else None
        if option_type:  # PUT/CALL 등 옵션 포지션 제외 (실보유 롱만)
            continue
        ticker = (r[0] or "").strip()
        if not ticker:
            continue
        holdings.append({
            "ticker":    ticker,
            "name":      (r[1] or "").title().strip(),
            "cusip":     r[3],
            "value_usd": int(r[4]) * 1000 if isinstance(r[4], (int, float)) else 0,  # $000 → $
            "weight":    round(float(r[5]), 1) if isinstance(r[5], (int, float)) else 0.0,
            "shares":    int(r[6]) if isinstance(r[6], (int, float)) else 0,
        })
    return holdings


def _diff_action(ticker: str, shares: int, prev_shares: dict[str, int]) -> str:
    """직전 분기 주식수 대비 증감 판정."""
    prev = prev_shares.get(ticker)
    if prev is None:
        return "buy"          # 신규 편입
    if shares > prev * (1 + _ADD_THRESHOLD):
        return "buy"          # 추가 매수
    if shares < prev * (1 - _ADD_THRESHOLD):
        return "sell"         # 축소
    return "hold"


def build_investor_13f(cik_slug: str, quarters: int = 6) -> list[dict]:
    """매니저의 최근 N분기 보유 스냅샷 + 직전 분기 대비 action.

    Returns: [
      {"as_of": "2026 Q1", "filed_date": "2026-05-15", "filing_id": ...,
       "total_value_usd": ..., "count": N,
       "holdings": [{ticker, name, cusip, value_usd, weight, shares, action}, ...]},
      ...최신순
    ]
    """
    # diff 계산용으로 한 분기 더 가져온다
    filings = get_manager_filings(cik_slug, limit=quarters + 1)
    if not filings:
        return []

    holdings_by_q: dict[str, dict] = {}
    for f in filings:
        h = get_holdings(f["filing_id"])
        if h:
            holdings_by_q[f["quarter"]] = {"filing": f, "holdings": h}

    ordered = [f["quarter"] for f in filings if f["quarter"] in holdings_by_q]
    snapshots: list[dict] = []
    for i, q in enumerate(ordered):
        if len(snapshots) >= quarters:
            break
        cur = holdings_by_q[q]
        prev_q = ordered[i + 1] if i + 1 < len(ordered) else None
        prev_shares = (
            {x["ticker"]: x["shares"] for x in holdings_by_q[prev_q]["holdings"]}
            if prev_q else {}
        )
        hs = [
            {**x, "action": _diff_action(x["ticker"], x["shares"], prev_shares)}
            for x in cur["holdings"]
        ]
        snapshots.append({
            "as_of":           q,
            "as_of_date":      _quarter_end(q),
            "filed_date":      cur["filing"].get("filed_date", ""),
            "filing_id":       cur["filing"]["filing_id"],
            "total_value_usd": sum(x["value_usd"] for x in cur["holdings"]),
            "count":           len(hs),
            "holdings":        hs,
        })
    return snapshots
