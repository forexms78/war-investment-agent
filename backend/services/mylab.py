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


# ── portfolio.md 파서 ──────────────────────────────────────────────────

import re

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


def parse_portfolio() -> dict:
    """portfolio.md → 구조화된 포트폴리오 JSON"""
    raw = get_analysis_content("portfolio.md")
    if not raw:
        return {"error": "portfolio.md를 찾을 수 없습니다"}

    content = raw["content"]
    lines = content.split("\n")

    result = {
        "updated_at": "",
        "summary": {"total_value": 0, "total_pnl": 0, "total_pnl_pct": 0, "holdings_count": 0},
        "sections": [],
    }

    # 갱신일 추출
    for line in lines:
        m = re.search(r"최종 갱신:\s*(.+?)(?:\s*\(|$)", line)
        if m:
            result["updated_at"] = m.group(1).strip()
            break

    # 요약 테이블 파싱
    for i, line in enumerate(lines):
        if "총 평가금" in line:
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if len(cells) >= 2:
                result["summary"]["total_value"] = _parse_money(cells[1])
        if "총 손익" in line:
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if len(cells) >= 2:
                val = cells[1]
                pnl_match = re.search(r"([+-]?₩[\d,]+)", val)
                pct_match = re.search(r"\(([+-]?[\d.]+%)\)", val)
                if pnl_match:
                    result["summary"]["total_pnl"] = _parse_money(pnl_match.group(1))
                if pct_match:
                    result["summary"]["total_pnl_pct"] = _parse_pct(pct_match.group(1))
        if "종목 수" in line:
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if len(cells) >= 2:
                count_match = re.search(r"(\d+)", cells[1])
                if count_match:
                    result["summary"]["holdings_count"] = int(count_match.group(1))

    # 섹션별 종목 파싱
    section_headers = {
        "국내 주식": "kr_stocks",
        "국내 ETF": "kr_etf",
        "해외 개별주": "us_stocks",
        "해외 ETF": "us_etf",
    }

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped.startswith("## "):
            continue
        title = stripped[3:].strip()
        section_key = None
        for label, key in section_headers.items():
            if label in title:
                section_key = key
                break
        if not section_key:
            continue

        # 테이블 헤더 찾기
        table_start = None
        for j in range(i + 1, min(i + 5, len(lines))):
            if lines[j].strip().startswith("| "):
                table_start = j
                break
        if table_start is None:
            continue

        header_cells = [c.strip() for c in lines[table_start].split("|")[1:-1]]
        data_rows = _parse_table_rows(lines, table_start + 1)

        holdings = []
        for row in data_rows:
            if len(row) < 4:
                continue
            holding = {"name": row[0]}

            has_ticker = "티커" in "".join(header_cells).lower() or "ticker" in "".join(header_cells).lower()
            col = 1

            if has_ticker and len(row) > 4:
                holding["ticker"] = row[col]
                col += 1
            else:
                holding["ticker"] = ""

            holding["qty"] = _parse_qty(row[col]) if col < len(row) else 0
            col += 1
            holding["value"] = _parse_money(row[col]) if col < len(row) else 0
            col += 1
            holding["pnl"] = _parse_money(row[col]) if col < len(row) else 0
            col += 1
            holding["pnl_pct"] = _parse_pct(row[col]) if col < len(row) else 0

            holdings.append(holding)

        section_value = sum(h["value"] for h in holdings)
        result["sections"].append({
            "key": section_key,
            "title": title,
            "holdings": holdings,
            "total_value": section_value,
        })

    return result
