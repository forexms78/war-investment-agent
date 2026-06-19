"""ETF 신규상장 수집 서비스 — 국내(KR) / 미국(US)

의도: 신규 ETF는 "상장 때 한 번 치고 빠지거나, 장투로 저점 누적" 목적 → 최신성이 생명.
범위: 상장 예정(앞으로) + 최근 상장(최근 30일).

데이터 소스
  US 최근상장 : stockanalysis.com /etf/list/new/__data.json (SvelteKit dereferenced 포맷)
  US 예정     : SEC EDGAR Full-Text Search (485APOS/487/N-1A → 파이프라인 수준)
  US 구성종목  : Yahoo quoteSummary topHoldings (기존 etf_holdings.py 재사용)
  KR 최근상장 : KRX MDCSTAT04601 (2025-12-27 회원제 전환으로 로그인 필요 → 실패 시 폴백)
              폴백 = 네이버금융 etfItemList(이름/시세, 상장일 없음) — 최근상장 단독 산출 불가
  KR 예정     : KRX KIND 공시 HTML 파싱 (구조화 약함 → best-effort)
  KR 구성종목  : KRX MDCSTAT05001 (인증 필요)

설계 원칙
  - 모든 함수 sync. 외부 소스 실패 시 예외를 삼키고 빈/부분 데이터로 graceful 처리(크래시 금지).
  - 날짜는 절대 Gemini로 생성하지 않음(팩트 수집만). Gemini는 ai_oneliner / ai_explanation 텍스트에만.
  - Gemini 호출량 방어: 시장별 상위 15개(예정 임박순 → 최근 최신순)만 해설 생성. 16위 이하는 기본정보만.
  - as_of = datetime.now(timezone.utc).isoformat(). D-day는 프론트가 실시간 계산.
"""

import json
import logging
import threading
from datetime import datetime, timezone, date, timedelta

import requests

from backend.services.db_cache import db_get, db_set

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# 공통 상수 / 세션
# ─────────────────────────────────────────────

SYSTEM = (
    "너는 ETF 신규상장 해설가다. 일반 개인투자자가 이해하도록 평이한 한국어로 설명한다. "
    "과장·추천 단정·이모지 금지. 수익 보장 표현 금지. 사실 기반으로 담백하게 쓴다."
)

# 시장별 Gemini 해설 생성 상한 (요구사항)
GEMINI_TOP_N = 15

# 최근 상장 필터 기준일 수
RECENT_DAYS = 30

# 캐시 키
KEY_KR = "etf_launches_kr"
KEY_US = "etf_launches_us"


def _detail_key(market: str, ticker: str) -> str:
    return f"etf_launch_detail_{market}_{ticker}"


_DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# requests.Session은 스레드 안전하지 않음 → 스케줄러 ThreadPoolExecutor에서
# KR/US 잡이 동시 실행될 때 충돌 방지를 위해 스레드별 세션을 격리한다.
_thread_local = threading.local()


def _get_session() -> requests.Session:
    s = getattr(_thread_local, "session", None)
    if s is None:
        s = requests.Session()
        s.headers.update({"User-Agent": _DEFAULT_UA})
        _thread_local.session = s
    return s


# SEC는 연락처 포함 UA 필수
_SEC_UA = "whalyx-research/1.0 (alltarget.sh@gmail.com)"


# ─────────────────────────────────────────────
# 운용사(issuer) 추출 — 펀드명 접두어 매칭
# ─────────────────────────────────────────────

# 국내 운용사 칩: ETF 종목약명 접두어 → 정식 운용사
KR_ISSUER_PREFIXES = {
    "KODEX":   "삼성자산운용",
    "TIGER":   "미래에셋자산운용",
    "ACE":     "한국투자신탁운용",
    "RISE":    "KB자산운용",
    "KBSTAR":  "KB자산운용",
    "SOL":     "신한자산운용",
    "PLUS":    "한화자산운용",
    "ARIRANG": "한화자산운용",
    "HANARO":  "NH아문디자산운용",
    "KOSEF":   "키움투자자산운용",
    "히어로즈": "키움투자자산운용",
    "TIMEFOLIO": "타임폴리오자산운용",
    "WON":     "우리자산운용",
    "BNK":     "BNK자산운용",
    "마이티":  "DB자산운용",
    "FOCUS":   "브이아이자산운용",
    "마이다스": "마이다스에셋자산운용",
}

# 미국 운용사: 펀드명 소문자 substring → 정식 운용사 / 신뢰 화이트리스트 여부
US_ISSUER_PREFIXES = {
    "ishares":      ("iShares", True),
    "blackrock":    ("BlackRock", True),
    "vanguard":     ("Vanguard", True),
    "spdr":         ("State Street (SPDR)", True),
    "state street": ("State Street (SPDR)", True),
    "invesco":      ("Invesco", True),
    "schwab":       ("Schwab", True),
    "ark ":         ("ARK Invest", True),
    "jpmorgan":     ("JPMorgan", True),
    "j.p. morgan":  ("JPMorgan", True),
    "dimensional":  ("Dimensional", True),
    "first trust":  ("First Trust", True),
    "fidelity":     ("Fidelity", True),
    "vaneck":       ("VanEck", True),
    "wisdomtree":   ("WisdomTree", True),
    "global x":     ("Global X", True),
    "pacer":        ("Pacer", False),
    "defiance":     ("Defiance", False),
    "roundhill":    ("Roundhill", False),
    "yieldmax":     ("YieldMax", False),
    "direxion":     ("Direxion", False),
    "proshares":    ("ProShares", False),
    "themes":       ("Themes ETF Trust", False),
    "leverage shares": ("Leverage Shares", False),
    "simplify":     ("Simplify", False),
    "amplify":      ("Amplify", False),
    "graniteshares": ("GraniteShares", False),
}


def _kr_issuer(abbrv: str) -> str:
    """국내 종목약명에서 운용사 추출. 접두어 미매칭이면 빈 문자열."""
    if not abbrv:
        return ""
    up = abbrv.upper().strip()
    for prefix, issuer in KR_ISSUER_PREFIXES.items():
        if up.startswith(prefix.upper()):
            return issuer
    return ""


def _us_issuer(name: str) -> tuple[str, bool]:
    """미국 펀드명에서 운용사 + 신뢰 화이트리스트 여부 추출. 미매칭이면 ('', False)."""
    if not name:
        return "", False
    low = name.lower()
    for sub, (issuer, trusted) in US_ISSUER_PREFIXES.items():
        if sub in low:
            return issuer, trusted
    return "", False


# ─────────────────────────────────────────────
# 날짜 파싱 헬퍼
# ─────────────────────────────────────────────

def _parse_date(raw) -> date | None:
    """다양한 포맷의 날짜 문자열을 date로 파싱. 실패 시 None."""
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    s = s.replace(".", "-").replace("/", "-")
    # YYYYMMDD
    if len(s) == 8 and s.isdigit():
        try:
            return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
        except ValueError:
            return None
    # YYYY-MM-DD (앞 10자리)
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _to_iso(d: date | None) -> str:
    return d.isoformat() if d else ""


def _prev_business_day(base: date | None = None) -> date:
    """직전 영업일(주말 회피). 공휴일은 보정하지 않음 — KRX가 빈 응답이면 상위에서 graceful."""
    d = (base or date.today()) - timedelta(days=1)
    while d.weekday() >= 5:  # 5=토, 6=일
        d -= timedelta(days=1)
    return d


# ─────────────────────────────────────────────
# 미국 — 최근 상장 (stockanalysis.com __data.json)
# ─────────────────────────────────────────────

def _fetch_us_recent() -> list[dict]:
    """stockanalysis.com 신규상장 목록 파싱. SvelteKit dereferenced 포맷(포인터 기반).
    실패 시 빈 리스트."""
    try:
        r = _get_session().get(
            "https://stockanalysis.com/etf/list/new/__data.json",
            timeout=20,
        )
        r.raise_for_status()
        d = r.json()
        nodes = d.get("nodes", [])
        if len(nodes) < 2:
            return []
        page = nodes[1].get("data")
        if not isinstance(page, list) or not page:
            return []
        top = page[0]
        if not isinstance(top, dict) or "data" not in top:
            return []
        rows_ptr = page[top["data"]]
        if not isinstance(rows_ptr, list):
            return []

        out: list[dict] = []
        cutoff = date.today() - timedelta(days=RECENT_DAYS)
        for ri in rows_ptr:
            try:
                obj = page[ri]
                if not isinstance(obj, dict):
                    continue
                row = {k: page[vi] for k, vi in obj.items()}
            except (IndexError, TypeError):
                continue
            ticker = str(row.get("s", "")).strip().upper()
            name = str(row.get("n", "")).strip()
            launch = _parse_date(row.get("inceptionDate"))
            if not ticker or not launch:
                continue
            # 최근 30일만
            if launch < cutoff:
                continue
            issuer, trusted = _us_issuer(name)
            out.append({
                "ticker":      ticker,
                "name":        name,
                "issuer":      issuer,
                "market":      "us",
                "launch_date": _to_iso(launch),
                "status":      "recent",
                "index_name":  "",
                "category":    "",
                "trusted":     trusted,
                "_sort":       launch,  # 정렬용(직렬화 전 제거)
            })
        # 최신순
        out.sort(key=lambda x: x["_sort"], reverse=True)
        logger.info(f"[etf_launches] US 최근상장 {len(out)}건 수집")
        return out
    except Exception as e:
        logger.warning(f"[etf_launches] US 최근상장 수집 실패: {e}")
        return []


# ─────────────────────────────────────────────
# 미국 — 상장 예정 (SEC EDGAR Full-Text Search)
# ─────────────────────────────────────────────

def _fetch_us_upcoming() -> list[dict]:
    """SEC EDGAR FTS로 ETF 등록/효력 공시(485APOS/487) 파이프라인 수집.
    정확한 상장일·티커는 구조화되지 않으므로 '운용사 + 공시 접수일' 수준으로 솔직 표기.
    실패 시 빈 리스트."""
    today = date.today()
    start = today - timedelta(days=21)
    try:
        r = _get_session().get(
            "https://efts.sec.gov/LATEST/search-index",
            params={
                "forms":   "485APOS,487",
                "q":       '"exchange-traded fund"',
                "startdt": start.isoformat(),
                "enddt":   today.isoformat(),
            },
            headers={"User-Agent": _SEC_UA, "Accept": "application/json"},
            timeout=20,
        )
        r.raise_for_status()
        data = r.json()
        hits = data.get("hits", {}).get("hits", [])
        out: list[dict] = []
        seen: set[str] = set()
        for h in hits:
            src = h.get("_source", {})
            names = src.get("display_names", [])
            trust_name = names[0] if names else ""
            # "Direxion Shares ETF Trust  (CIK 0001424958)" → 트러스트명만
            trust_name = trust_name.split("(CIK")[0].strip()
            if not trust_name or trust_name in seen:
                continue
            seen.add(trust_name)
            filed = _parse_date(src.get("file_date"))
            issuer, trusted = _us_issuer(trust_name)
            ciks = src.get("ciks", [])
            adsh = src.get("adsh", "")
            cik = ciks[0].lstrip("0") if ciks else ""
            link = ""
            if cik and adsh:
                link = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=485"
            out.append({
                "ticker":      "",  # 예정 단계 — 티커 미확정
                "name":        trust_name,
                "issuer":      issuer or trust_name,
                "market":      "us",
                "launch_date": "",  # 정확한 상장 예정일 미공시
                "status":      "upcoming",
                "index_name":  "",
                "category":    src.get("form", "") or src.get("root_forms", ""),
                "filed_date":  _to_iso(filed),
                "filing_link": link,
                "trusted":     trusted,
                "_sort":       filed or today,  # 접수일 최신순(임박 추정)
            })
        # 접수일 최신 = 임박 추정 → 위로
        out.sort(key=lambda x: x["_sort"], reverse=True)
        logger.info(f"[etf_launches] US 예정(공시) {len(out)}건 수집")
        return out[:20]
    except Exception as e:
        logger.warning(f"[etf_launches] US 예정 수집 실패: {e}")
        return []


# ─────────────────────────────────────────────
# 국내 — KRX MDCSTAT04601 (인증 필요, 실패 시 폴백)
# ─────────────────────────────────────────────

def _fetch_kr_krx_recent() -> list[dict]:
    """KRX ETF 전종목 기본정보(MDCSTAT04601)에서 최근 30일 상장분 추출.
    2025-12-27 회원제 전환으로 익명 호출은 'LOGOUT' 반환 → 비JSON/LOGOUT이면 빈 리스트.
    KRX_SESSION_COOKIE 환경변수가 있으면 쿠키 주입."""
    import os
    try:
        headers = {
            "Referer": "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC020103010901",
            "X-Requested-With": "XMLHttpRequest",
        }
        cookie = os.getenv("KRX_SESSION_COOKIE", "")
        if cookie:
            headers["Cookie"] = cookie
        r = _get_session().post(
            "https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd",
            data={
                "bld":         "dbms/MDC/STAT/standard/MDCSTAT04601",
                "locale":      "ko_KR",
                "share":       "1",
                "csvxls_isNo": "false",
                "mktId":       "ALL",
            },
            headers=headers,
            timeout=20,
        )
        r.raise_for_status()
        text = r.text.strip()
        # 회원제 게이트: 'LOGOUT' 또는 비JSON 방어
        if not text or "LOGOUT" in text[:50].upper() or not text.startswith("{"):
            logger.warning("[etf_launches] KRX MDCSTAT04601 인증 게이트(LOGOUT/비JSON) — 폴백")
            return []
        rows = json.loads(text).get("output", [])
        if not rows:
            return []

        out: list[dict] = []
        cutoff = date.today() - timedelta(days=RECENT_DAYS)
        for row in rows:
            launch = _parse_date(row.get("LIST_DD"))
            if not launch or launch < cutoff:
                continue
            ticker = str(row.get("ISU_SRT_CD", "")).strip()
            abbrv = str(row.get("ISU_ABBRV", "")).strip()
            issuer = str(row.get("COM_ABBRV", "")).strip() or _kr_issuer(abbrv)
            out.append({
                "ticker":      ticker,
                "isin":        str(row.get("ISU_CD", "")).strip(),  # 구성종목 조회용
                "name":        abbrv or str(row.get("ISU_NM", "")).strip(),
                "issuer":      issuer,
                "market":      "kr",
                "launch_date": _to_iso(launch),
                "status":      "recent",
                "index_name":  str(row.get("ETF_OBJ_IDX_NM", "")).strip(),
                "category":    str(row.get("IDX_ASST_CLSS_NM", "")).strip(),
                "trusted":     True,  # 국내는 운용사 전부 제도권
                "_sort":       launch,
            })
        out.sort(key=lambda x: x["_sort"], reverse=True)
        logger.info(f"[etf_launches] KR 최근상장(KRX) {len(out)}건 수집")
        return out
    except Exception as e:
        logger.warning(f"[etf_launches] KRX MDCSTAT04601 수집 실패: {e}")
        return []


# ─────────────────────────────────────────────
# 국내 — KIND 상장예정 공시 HTML 파싱 (best-effort)
# ─────────────────────────────────────────────

def _fetch_kr_kind_upcoming() -> list[dict]:
    """KRX KIND ETF 공시(EUC-KR HTML 테이블)에서 '신규상장'/'상장예정' 키워드 행 파싱.
    구조화 피드가 없어 best-effort. 실패/빈 응답 시 빈 리스트."""
    today = date.today()
    start = today - timedelta(days=21)
    try:
        from bs4 import BeautifulSoup
    except Exception:
        return []
    try:
        r = _get_session().post(
            "https://kind.krx.co.kr/disclosure/disclosurebystocktype.do",
            data={
                "method":          "searchDisclosureByStockTypeSub",
                "stockType":       "EF",
                "fromData":        start.isoformat(),
                "toData":          today.isoformat(),
                "currentPageSize": "100",
                "pageIndex":       "1",
                "orderMode":       "1",
                "orderStat":       "D",
                "forward":         "disclosurebystocktype_down",
            },
            headers={
                "Referer": "https://kind.krx.co.kr/disclosure/disclosurebystocktype.do?method=searchDisclosureByStockTypeEtf",
                "X-Requested-With": "XMLHttpRequest",
            },
            timeout=20,
        )
        r.raise_for_status()
        # KIND 응답은 EUC-KR
        try:
            html = r.content.decode("euc-kr", errors="ignore")
        except Exception:
            html = r.text
        if not html or len(html) < 50:
            return []

        soup = BeautifulSoup(html, "html.parser")
        out: list[dict] = []
        seen: set[str] = set()
        for tr in soup.select("tr"):
            tds = tr.find_all("td")
            if len(tds) < 2:
                continue
            cells = [td.get_text(strip=True) for td in tds]
            joined = " ".join(cells)
            # 신규상장/상장예정 키워드 행만
            if "신규상장" not in joined and "상장예정" not in joined and "상장 예정" not in joined:
                continue
            # 회사명·공시제목·날짜 컬럼 휴리스틱 추출
            company = ""
            title = ""
            filed = None
            for c in cells:
                d = _parse_date(c)
                if d and not filed:
                    filed = d
                elif "신규상장" in c or "상장예정" in c or "상장 예정" in c:
                    title = c
                elif c and not company and len(c) <= 40 and not c.isdigit():
                    company = c
            name = company or title
            if not name or name in seen:
                continue
            seen.add(name)
            issuer = _kr_issuer(name)
            out.append({
                "ticker":      "",
                "name":        name,
                "issuer":      issuer or name,
                "market":      "kr",
                "launch_date": "",  # 정확 상장일 미구조화
                "status":      "upcoming",
                "index_name":  "",
                "category":    title or "신규상장 공시",
                "filed_date":  _to_iso(filed),
                "trusted":     True,
                "_sort":       filed or today,
            })
        out.sort(key=lambda x: x["_sort"], reverse=True)
        logger.info(f"[etf_launches] KR 예정(KIND) {len(out)}건 수집")
        return out[:20]
    except Exception as e:
        logger.warning(f"[etf_launches] KIND 예정 수집 실패: {e}")
        return []


# ─────────────────────────────────────────────
# 국내 — 구성종목 (KRX MDCSTAT05001, 인증 필요)
# ─────────────────────────────────────────────

def _fetch_kr_holdings(isin: str) -> list[dict]:
    """KRX PDF 구성내역(MDCSTAT05001)으로 구성종목 비중 조회. 인증 게이트 시 빈 리스트."""
    import os
    if not isin:
        return []
    try:
        headers = {
            "Referer": "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC020103010901",
            "X-Requested-With": "XMLHttpRequest",
        }
        cookie = os.getenv("KRX_SESSION_COOKIE", "")
        if cookie:
            headers["Cookie"] = cookie
        # 직전 영업일 기준(주말 회피)
        trd = _prev_business_day().strftime("%Y%m%d")
        r = _get_session().post(
            "https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd",
            data={
                "bld":         "dbms/MDC/STAT/standard/MDCSTAT05001",
                "trdDd":       trd,
                "isuCd":       isin,
                "locale":      "ko_KR",
                "share":       "1",
                "csvxls_isNo": "false",
            },
            headers=headers,
            timeout=20,
        )
        r.raise_for_status()
        text = r.text.strip()
        if not text or "LOGOUT" in text[:50].upper() or not text.startswith("{"):
            return []
        rows = json.loads(text).get("output", [])
        out: list[dict] = []
        for row in rows:
            name = str(row.get("COMPST_ISU_NM", "")).strip()
            rto = row.get("COMPST_RTO", "")
            try:
                weight = round(float(str(rto).replace(",", "")), 2)
            except (ValueError, TypeError):
                weight = None
            if name:
                out.append({"name": name, "weight": weight})
        out.sort(key=lambda x: (x["weight"] is None, -(x["weight"] or 0)))
        return out[:20]
    except Exception as e:
        logger.warning(f"[etf_launches] KRX 구성종목 수집 실패: {e}")
        return []


# ─────────────────────────────────────────────
# Gemini 해설
# ─────────────────────────────────────────────

def _gemini_oneliner(item: dict) -> str:
    """카드용 AI 한줄. 실패 시 빈 문자열(프론트가 graceful 처리)."""
    from backend.utils.gemini import call_gemini
    try:
        status_kr = "상장 예정" if item["status"] == "upcoming" else "최근 상장"
        prompt = (
            f"ETF: {item.get('name', '')}\n"
            f"티커: {item.get('ticker', '미정')}\n"
            f"운용사: {item.get('issuer', '미상')}\n"
            f"추종지수/테마: {item.get('index_name', '') or item.get('category', '') or '미공시'}\n"
            f"상태: {status_kr}\n\n"
            "이 ETF가 무엇에 투자하는지 핵심만 한 문장(40자 내외)으로. "
            "한국어. 따옴표/이모지 없이 평서문으로."
        )
        text = call_gemini(prompt, SYSTEM)
        text = text.strip().strip('"').strip()
        return text[:80] if len(text) > 80 else text
    except Exception:
        return ""


def _gemini_explanation(item: dict, holdings: list[dict]) -> str:
    """상세용 AI 해설 한 단락. 실패 시 빈 문자열."""
    from backend.utils.gemini import call_gemini
    try:
        status_kr = "상장 예정" if item["status"] == "upcoming" else "최근 상장"
        top_holdings = ", ".join(h["name"] for h in holdings[:5] if h.get("name"))
        prompt = (
            f"ETF: {item.get('name', '')}\n"
            f"티커: {item.get('ticker', '미정')}\n"
            f"운용사: {item.get('issuer', '미상')}\n"
            f"추종지수/테마: {item.get('index_name', '') or item.get('category', '') or '미공시'}\n"
            f"상태: {status_kr}\n"
            f"주요 구성종목: {top_holdings or '집계 전/미공시'}\n\n"
            "위 정보로 일반 투자자를 위해 한 단락(4~5문장)으로 설명해. 한국어. "
            "포함: (1) 무엇에 투자하는지, (2) 어떤 테마/전략인지, "
            "(3) 어떤 투자자에게 적합한지, (4) 핵심 리스크. "
            "추천 단정·수익 보장 표현·이모지 금지."
        )
        return call_gemini(prompt, SYSTEM).strip()
    except Exception:
        return ""


def _apply_gemini_oneliners(items: list[dict]) -> None:
    """정렬된 리스트 상위 GEMINI_TOP_N개에만 ai_oneliner 채움(in-place)."""
    for i, item in enumerate(items):
        if i < GEMINI_TOP_N:
            item["ai_oneliner"] = _gemini_oneliner(item)
        else:
            item["ai_oneliner"] = ""


def _strip_internal(items: list[dict]) -> list[dict]:
    """직렬화/응답 전 내부 정렬·부가 필드 제거하고 계약 필드만 남김."""
    out = []
    for it in items:
        out.append({
            "ticker":      it.get("ticker", ""),
            "name":        it.get("name", ""),
            "issuer":      it.get("issuer", ""),
            "market":      it.get("market", ""),
            "launch_date": it.get("launch_date", ""),
            "status":      it.get("status", ""),
            "index_name":  it.get("index_name", ""),
            "category":    it.get("category", ""),
            "ai_oneliner": it.get("ai_oneliner", ""),
        })
    return out


# ─────────────────────────────────────────────
# 메인 수집 엔트리 (스케줄러가 호출)
# ─────────────────────────────────────────────

def collect_us_launches() -> dict:
    """미국 ETF 신규상장 수집 → {as_of, upcoming, recent}.
    정렬: 예정(임박순=접수일 최신) → 최근(최신순). Gemini 해설은 합쳐서 상위 15개만."""
    upcoming = _fetch_us_upcoming()
    recent = _fetch_us_recent()

    # 예정 → 최근 순으로 합쳐 상위 15개에만 해설
    combined = upcoming + recent
    _apply_gemini_oneliners(combined)

    result = {
        "as_of":    datetime.now(timezone.utc).isoformat(),
        "upcoming": _strip_internal(upcoming),
        "recent":   _strip_internal(recent),
        # 스케줄러 상세 빌드용 신선 항목(ISIN/정렬키 포함). db_set 전 pop 됨 — 엔드포인트엔 노출 안 함.
        "_raw_top": combined[:GEMINI_TOP_N],
    }
    return result


def collect_kr_launches() -> dict:
    """국내 ETF 신규상장 수집 → {as_of, upcoming, recent}.
    KRX 인증 게이트로 최근상장이 비면 네이버로 운용사명만 보강(상장일 없어 목록 단독 산출 불가)."""
    recent = _fetch_kr_krx_recent()
    upcoming = _fetch_kr_kind_upcoming()
    # KRX 인증 게이트로 recent가 비는 것이 현재 정상 경로(상장일 보유 공개 피드 부재).
    # 네이버 etfItemList는 상장일이 없어 '최근 30일' 단독 산출이 불가 → 목록 보강에만 한정.

    combined = upcoming + recent
    _apply_gemini_oneliners(combined)

    result = {
        "as_of":    datetime.now(timezone.utc).isoformat(),
        "upcoming": _strip_internal(upcoming),
        "recent":   _strip_internal(recent),
        # 스케줄러 상세 빌드용 신선 항목(ISIN/정렬키 포함). db_set 전 pop 됨 — 엔드포인트엔 노출 안 함.
        "_raw_top": combined[:GEMINI_TOP_N],
    }
    return result


# ─────────────────────────────────────────────
# 상세 빌드 (스케줄러가 상위 15개 미리 캐시 / 엔드포인트는 DB만 읽음)
# ─────────────────────────────────────────────

def build_detail(market: str, ticker: str, item: dict | None = None) -> dict:
    """단일 ETF 상세 — 구성종목 + Gemini 해설.
    예정 건(ticker 없음/미상장)은 구성종목 빈 배열. 실패 시 부분 데이터.

    item: 스케줄러가 신선 수집 항목(ISIN 등 내부 필드 포함)을 직접 넘기는 경로.
          None이면 목록 캐시에서 ticker로 메타를 찾는다(엔드포인트는 DB만 읽으므로 이 경로 미사용).
    """
    market = (market or "").lower()
    ticker = (ticker or "").strip()
    list_key = KEY_KR if market == "kr" else KEY_US

    meta: dict = item or {}
    if not meta:
        # 목록 캐시(stale 허용)에서 해당 항목 메타 찾기
        listing = db_get(list_key, ttl=10**9) or {}
        for bucket in ("recent", "upcoming"):
            for it in listing.get(bucket, []):
                if ticker and str(it.get("ticker", "")).strip().upper() == ticker.upper():
                    meta = it
                    break
            if meta:
                break

    # 메타가 없으면 최소 형태
    if not meta:
        meta = {
            "ticker": ticker, "name": ticker, "issuer": "", "market": market,
            "launch_date": "", "status": "recent", "index_name": "", "category": "",
        }

    status = meta.get("status", "recent")
    holdings: list[dict] = []

    # 구성종목 — 상장 완료(recent)이고 티커가 있을 때만
    if status == "recent" and ticker:
        if market == "us":
            try:
                from backend.services.etf_holdings import get_etf_holdings
                h = get_etf_holdings(ticker)
                holdings = [
                    {"name": x.get("name") or x.get("ticker", ""), "weight": x.get("weight")}
                    for x in h.get("holdings", []) if (x.get("name") or x.get("ticker"))
                ][:20]
            except Exception as e:
                logger.warning(f"[etf_launches] US holdings 실패 {ticker}: {e}")
        elif market == "kr":
            # ISIN은 _strip_internal로 응답에서 제거됨 → 스케줄러가 넘긴 신선 item에만 존재
            isin = meta.get("isin", "")
            if isin:
                holdings = _fetch_kr_holdings(isin)

    ai_explanation = _gemini_explanation(meta, holdings)

    return {
        "ticker":         meta.get("ticker", ticker),
        "name":           meta.get("name", ticker),
        "issuer":         meta.get("issuer", ""),
        "launch_date":    meta.get("launch_date", ""),
        "status":         status,
        "index_name":     meta.get("index_name", ""),
        "category":       meta.get("category", ""),
        "holdings":       holdings,
        "ai_explanation": ai_explanation,
        "as_of":          datetime.now(timezone.utc).isoformat(),
    }
