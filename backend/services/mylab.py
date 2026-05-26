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
