"""My Lab — GitHub stock78 repo 분석 파일 연동 서비스"""
import base64
import os
from typing import Optional

import requests as _requests

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
MYLAB_PASSWORD = os.getenv("MYLAB_PASSWORD", "")
REPO = "forexms78/stock78"
BRANCH = "main"
ANALYSES_PATH = "analyses"
SNAPSHOTS_PATH = "snapshots"


def _headers() -> dict:
    h = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "whalyx-mylab",
    }
    if GITHUB_TOKEN:
        h["Authorization"] = f"token {GITHUB_TOKEN}"
    return h


def _filename_to_title(filename: str) -> str:
    """파일명 → 제목 변환. 예: nvidia-analysis-2024-05.md → Nvidia Analysis 2024 05"""
    name = filename.replace(".md", "")
    return " ".join(w.capitalize() for w in name.replace("-", " ").replace("_", " ").split())


def _fetch_md_files(path: str) -> list[dict]:
    """특정 경로의 MD 파일 목록 fetch"""
    url = f"https://api.github.com/repos/{REPO}/contents/{path}?ref={BRANCH}" if path else f"https://api.github.com/repos/{REPO}/contents?ref={BRANCH}"
    try:
        r = _requests.get(url, headers=_headers(), timeout=10)
        if r.status_code == 404:
            return []
        r.raise_for_status()
        items = r.json()
        return [
            {
                "name": item["name"],
                "path": item.get("path", item["name"]),
                "title": _filename_to_title(item["name"]),
                "sha": item["sha"],
                "size": item["size"],
            }
            for item in items
            if item.get("type") == "file" and item["name"].endswith(".md")
        ]
    except Exception as e:
        print(f"[mylab] _fetch_md_files({path}) 오류: {e}")
        return []


def list_analyses() -> list[dict]:
    """stock78 repo 루트 + analyses/ 폴더의 MD 파일 목록 반환 (이름 역순 정렬)"""
    root_files = _fetch_md_files("")
    analyses_files = _fetch_md_files(ANALYSES_PATH)
    all_files = root_files + analyses_files
    return sorted(all_files, key=lambda x: x["name"], reverse=True)


def get_analysis_content(filename: str) -> Optional[dict]:
    """특정 MD 파일 내용 반환. 없으면 None. path 형식: 'file.md' 또는 'analyses/file.md'"""
    # 경로 순회 방지
    if ".." in filename:
        return None
    # 허용 패턴: 루트 파일 또는 analyses/ 하위 파일만
    parts = filename.split("/")
    if len(parts) > 2 or (len(parts) == 2 and parts[0] != ANALYSES_PATH):
        return None

    url = f"https://api.github.com/repos/{REPO}/contents/{filename}?ref={BRANCH}"
    try:
        r = _requests.get(url, headers=_headers(), timeout=10)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        data = r.json()
        raw = data.get("content", "")
        content = base64.b64decode(raw).decode("utf-8")
        return {
            "name": filename,
            "title": _filename_to_title(filename),
            "content": content,
            "sha": data.get("sha", ""),
        }
    except Exception as e:
        print(f"[mylab] get_analysis_content 오류: {e}")
        return None


def check_password(password: str) -> bool:
    """MYLAB_PASSWORD 환경변수와 비교"""
    if not MYLAB_PASSWORD:
        return False
    return password == MYLAB_PASSWORD


def list_snapshots() -> list[dict]:
    """stock78/snapshots/ 폴더의 스냅샷 파일 목록 (날짜 역순)"""
    files = _fetch_md_files(SNAPSHOTS_PATH)
    return sorted(files, key=lambda x: x["name"], reverse=True)


def get_snapshot_content(filename: str) -> Optional[dict]:
    """특정 스냅샷 파일 내용 반환"""
    if ".." in filename:
        return None
    path = f"{SNAPSHOTS_PATH}/{filename}" if not filename.startswith(SNAPSHOTS_PATH) else filename
    return get_analysis_content(path)


# ── portfolio.md 파서 ──────────────────────────────────────────────────

import re
import time as _time

_portfolio_cache: dict | None = None
_portfolio_cache_ts: float = 0
_PORTFOLIO_CACHE_TTL = 600  # 10분


def _parse_money(s: str) -> float:
    """'₩13,829,258' 또는 '+₩411,061' → float"""
    cleaned = re.sub(r"[₩,\s+]", "", s)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_pct(s: str) -> float:
    """'+3.1%' → 3.1"""
    cleaned = re.sub(r"[%\s+]", "", s)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_qty(s: str) -> float:
    """수량 문자열 → float (소수점 매매 대응)"""
    cleaned = s.strip().replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_table_rows(lines: list[str], start_idx: int) -> list[list[str]]:
    """마크다운 테이블의 데이터 행 파싱 (헤더+구분선 건너뜀)"""
    rows = []
    i = start_idx
    while i < len(lines):
        line = lines[i].strip()
        if not line.startswith("|"):
            break
        if re.match(r"^\|[\s\-:]+\|", line):
            i += 1
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if cells:
            rows.append(cells)
        i += 1
    return rows


def _parse_positions_from_md(content: str) -> tuple[list[dict], str]:
    """새 포맷 portfolio.md (평단+수량) 파싱 → positions 리스트 + updated_at"""
    lines = content.split("\n")
    positions = []
    current_section = ""
    updated_at = ""

    section_map = {
        "국내 주식": "kr_stocks",
        "국내 ETF": "kr_etf",
        "해외 개별주": "us_stocks",
        "해외 ETF": "us_etf",
    }

    for line in lines:
        # 갱신일
        m = re.search(r"최종 갱신:\s*(.+?)(?:\s*\(|$)", line)
        if m:
            updated_at = m.group(1).strip()

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("## "):
            title = stripped[3:].strip()
            for label, key in section_map.items():
                if label in title:
                    current_section = key
                    break
            continue

        if not current_section or not stripped.startswith("|"):
            continue
        if re.match(r"^\|[\s\-:]+\|", stripped):
            continue
        # 헤더 행 건너뛰기
        if "종목" in stripped and "티커" in stripped:
            continue

        cells = [c.strip() for c in stripped.split("|")[1:-1]]
        if len(cells) < 4:
            continue

        name = cells[0]
        ticker = cells[1] if cells[1] != "-" else ""
        qty = _parse_qty(cells[2])
        avg_cost = _parse_money(cells[3])

        if qty <= 0:
            continue

        positions.append({
            "name": name,
            "ticker": ticker,
            "qty": qty,
            "avg_cost": avg_cost,
            "section": current_section,
        })

    return positions, updated_at


def _get_usd_krw() -> float:
    """Supabase money_flow 캐시에서 환율 조회"""
    try:
        from backend.services.db_cache import db_get_stale
        cached = db_get_stale("money_flow")
        if cached and cached.get("korea_rates", {}).get("usd_krw"):
            return float(cached["korea_rates"]["usd_krw"])
    except Exception:
        pass
    return 1380.0  # 폴백


def _fetch_current_price(ticker: str) -> float | None:
    """단일 종목 현재가 조회 (financial.py 활용)"""
    try:
        from backend.services.financial import get_stock_data
        data = get_stock_data(ticker, "30d")
        if data and "current_price" in data and data["current_price"]:
            return float(data["current_price"])
    except Exception as e:
        print(f"[mylab] 가격 조회 실패 {ticker}: {e}")
    return None


def parse_portfolio() -> dict:
    """portfolio.md 파싱 + 실시간 가격 연동 → 포트폴리오 대시보드 JSON"""
    global _portfolio_cache, _portfolio_cache_ts

    now = _time.time()
    if _portfolio_cache and now - _portfolio_cache_ts < _PORTFOLIO_CACHE_TTL:
        return _portfolio_cache

    raw = get_analysis_content("portfolio.md")
    if not raw:
        return {"error": "portfolio.md를 찾을 수 없습니다"}

    positions, updated_at = _parse_positions_from_md(raw["content"])
    if not positions:
        return {"error": "포트폴리오 데이터를 파싱할 수 없습니다"}

    usd_krw = _get_usd_krw()

    # 섹션별 종목 구성
    section_order = ["kr_stocks", "kr_etf", "us_stocks", "us_etf"]
    section_titles = {
        "kr_stocks": "국내 주식",
        "kr_etf": "국내 ETF",
        "us_stocks": "해외 개별주",
        "us_etf": "해외 ETF",
    }

    sections_data: dict[str, list] = {k: [] for k in section_order}
    total_value = 0.0
    total_cost = 0.0

    for pos in positions:
        ticker = pos["ticker"]
        section = pos["section"]
        qty = pos["qty"]
        avg_cost = pos["avg_cost"]
        cost_total = avg_cost * qty

        # 현재가 조회
        current_price = None
        current_value = cost_total  # 폴백: 매입가 기준

        if ticker:
            # 한국 종목이면 .KS 붙이기
            api_ticker = f"{ticker}.KS" if section in ("kr_stocks", "kr_etf") and ticker.isdigit() else ticker
            price = _fetch_current_price(api_ticker)
            if price is not None:
                current_price = price
                if section in ("us_stocks", "us_etf"):
                    current_value = price * usd_krw * qty
                else:
                    current_value = price * qty

        pnl = current_value - cost_total
        pnl_pct = (pnl / cost_total * 100) if cost_total > 0 else 0

        holding = {
            "name": pos["name"],
            "ticker": ticker,
            "qty": qty,
            "avg_cost": avg_cost,
            "current_price": current_price,
            "value": round(current_value),
            "pnl": round(pnl),
            "pnl_pct": round(pnl_pct, 2),
            "live": current_price is not None,
        }

        sections_data[section].append(holding)
        total_value += current_value
        total_cost += cost_total

    # 결과 구성
    sections = []
    for key in section_order:
        holdings = sections_data[key]
        if not holdings:
            continue
        section_value = sum(h["value"] for h in holdings)
        sections.append({
            "key": key,
            "title": section_titles[key],
            "holdings": holdings,
            "total_value": round(section_value),
        })

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0

    result = {
        "updated_at": updated_at,
        "usd_krw": usd_krw,
        "summary": {
            "total_value": round(total_value),
            "total_pnl": round(total_pnl),
            "total_pnl_pct": round(total_pnl_pct, 2),
            "holdings_count": len(positions),
        },
        "sections": sections,
    }

    _portfolio_cache = result
    _portfolio_cache_ts = now
    return result
