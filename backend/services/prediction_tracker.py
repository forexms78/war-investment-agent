"""AI 추천 회고·자기학습 트래커

비대칭 학습 루프:
  [1] save_snapshot                — today_picks 직후 호출, 진입가/근거 보존
  [2] verify_past_predictions      — 매일 새벽, 1d/7d/30d 만기 도래분 hit 판정
  [3] analyze_failures             — 빗나간 케이스만 Gemini로 root_cause+avoid_rule 생성
  [4] get_active_failure_patterns  — 다음 today_picks 생성 시 회피 규칙 + score 페널티 주입

판정 기준 (1B - 느슨):
  buy   : ret > 0     → hit
  sell  : ret < 0     → hit
  watch : abs(ret) ≥ 1 → hit

페널티 (2B):
  각 종목에 대해 매칭되는 failure_category 수만큼 raw_score × 0.7^N
"""
import logging
import time
import json
import re
from datetime import datetime, date, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.services.db_cache import _get_client
from backend.utils.gemini import call_gemini

logger = logging.getLogger(__name__)

# 회피 규칙 매칭 — failure_category가 어떤 입력 조건을 의미하는지 하드코딩
# raw_score 페널티 적용 시 사용. Gemini는 자유 카테고리를 생성하지만,
# 페널티는 아래 정의된 카테고리에만 적용된다.
PATTERN_MATCHERS = {
    "과열매수":      lambda p: p.get("pick_type") == "buy"  and (p.get("momentum_30d") or 0) >= 25,
    "역추세진입":    lambda p: p.get("pick_type") == "buy"  and (p.get("momentum_30d") or 0) < -10,
    "감성무시":      lambda p: p.get("pick_type") == "buy"  and (p.get("sentiment") or 0) <= -0.3,
    "급락추격매도":  lambda p: p.get("pick_type") == "sell" and (p.get("momentum_30d") or 0) < -20,
    "변동성무시":    lambda p: abs((p.get("volume_ratio") or 1) - 1) > 2.0,
}

PENALTY_FACTOR = 0.7  # 매칭 패턴당 raw_score 곱셈 페널티
ACTIVE_LESSON_LOOKBACK_DAYS = 30
ACTIVE_LESSON_TOP_N = 3


# ─────────────────────────────────────────────────────────────
# 1. 스냅샷 저장 — today_picks 직후 호출
# ─────────────────────────────────────────────────────────────

def save_snapshot(picks_result: dict) -> int:
    """today_picks 결과를 prediction_snapshots 테이블에 INSERT.
    picks_result: {"buy": [...], "sell": [...], "watch": [...], "generated_at": "..."}
    각 카드: {ticker, name, price, momentum_30d, sentiment, volume_ratio, raw_score, reason}
    Returns: 저장된 row 수
    """
    sb = _get_client()
    if not sb:
        return 0

    today = date.today().isoformat()
    rows = []
    for pick_type in ("buy", "sell", "watch"):
        for card in picks_result.get(pick_type, []):
            ticker = card.get("ticker")
            price = card.get("price")
            if not ticker or price is None:
                continue
            rows.append({
                "snapshot_date": today,
                "ticker":        ticker,
                "pick_type":     pick_type,
                "entry_price":   float(price),
                "momentum_30d":  card.get("momentum_30d"),
                "sentiment":     card.get("sentiment"),
                "volume_ratio":  card.get("volume_ratio"),
                "raw_score":     card.get("raw_score"),
                "ai_reason":     (card.get("reason") or "")[:500],
            })

    if not rows:
        return 0

    try:
        # 같은 날·같은 종목·같은 타입 중복 방지 — UNIQUE 제약이 있으므로 on_conflict 사용
        sb.table("prediction_snapshots").upsert(
            rows, on_conflict="snapshot_date,ticker,pick_type"
        ).execute()
        logger.info(f"[prediction_tracker] 스냅샷 저장: {len(rows)}건 ({today})")
        return len(rows)
    except Exception as e:
        logger.error(f"[prediction_tracker] 스냅샷 저장 실패: {e}")
        return 0


# ─────────────────────────────────────────────────────────────
# 2. 검증 — 매일 새벽 실행
# ─────────────────────────────────────────────────────────────

def _fetch_current_price(ticker: str) -> float | None:
    """Yahoo Finance REST로 현재가 1개 조회 (today_picks와 동일 경로)"""
    import requests
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=2d"
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=8)
        r.raise_for_status()
        result = r.json()["chart"]["result"][0]
        closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
        return round(float(closes[-1]), 4) if closes else None
    except Exception:
        return None


def _is_hit(pick_type: str, ret_pct: float) -> bool:
    """적중 판정 (1B - 느슨, 양수면 적중)"""
    if pick_type == "buy":
        return ret_pct > 0
    if pick_type == "sell":
        return ret_pct < 0
    # watch — 변동폭 1% 이상이면 적중
    return abs(ret_pct) >= 1.0


def verify_past_predictions() -> dict:
    """hit_*d 컬럼이 NULL인 만기 도래 스냅샷을 검증.
    오늘 기준 D-1, D-7, D-30 도래분 처리."""
    sb = _get_client()
    if not sb:
        return {"verified": 0}

    today = date.today()
    horizons = [(1, "1d"), (7, "7d"), (30, "30d")]
    total_verified = 0

    # 검증 대상 종목 모음 (가격 조회 1회만)
    candidates: dict[str, list[tuple[int, str, str, float, str]]] = {}
    # ticker → [(snapshot_id, horizon_label, pick_type, entry_price, snapshot_date), ...]

    for days_ago, label in horizons:
        target_date = (today - timedelta(days=days_ago)).isoformat()
        hit_col = f"hit_{label}"
        try:
            r = sb.table("prediction_snapshots") \
                .select("id,ticker,pick_type,entry_price,snapshot_date") \
                .eq("snapshot_date", target_date) \
                .is_(hit_col, "null") \
                .execute()
            for row in (r.data or []):
                candidates.setdefault(row["ticker"], []).append((
                    row["id"], label, row["pick_type"], float(row["entry_price"]), row["snapshot_date"]
                ))
        except Exception as e:
            logger.error(f"[prediction_tracker] 만기 조회 실패 ({label}): {e}")

    if not candidates:
        return {"verified": 0}

    # 현재가 병렬 조회
    prices: dict[str, float] = {}
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(_fetch_current_price, t): t for t in candidates}
        for fut in as_completed(futs):
            t = futs[fut]
            p = fut.result()
            if p is not None:
                prices[t] = p

    # 업데이트
    for ticker, jobs in candidates.items():
        cur = prices.get(ticker)
        if cur is None:
            continue
        for snapshot_id, label, pick_type, entry, _ in jobs:
            try:
                ret_pct = round((cur - entry) / entry * 100, 2)
                hit = _is_hit(pick_type, ret_pct)
                update = {
                    f"price_{label}": cur,
                    f"ret_{label}":   ret_pct,
                    f"hit_{label}":   hit,
                }
                sb.table("prediction_snapshots").update(update).eq("id", snapshot_id).execute()
                total_verified += 1
            except Exception as e:
                logger.error(f"[prediction_tracker] 업데이트 실패 (id={snapshot_id}, {label}): {e}")

    logger.info(f"[prediction_tracker] 검증 완료: {total_verified}건")
    return {"verified": total_verified}


# ─────────────────────────────────────────────────────────────
# 3. 실패 분석 — Gemini 호출, 빗나간 케이스만
# ─────────────────────────────────────────────────────────────

_FAILURE_SYSTEM = (
    "너는 투자 추천 시스템의 자기 회고를 담당하는 분석가다. "
    "빗나간 추천을 받으면 그 원인을 진단하고 다음에 같은 실수를 피할 회피 규칙을 작성한다. "
    "출력은 항상 한국어 JSON 객체 1개이며, 마크다운 코드펜스를 사용하지 않는다."
)


def _strip_json(text: str) -> str:
    """Gemini 응답에서 ```json ... ``` 같은 코드펜스 제거"""
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    return m.group(0) if m else text


def _analyze_one(row: dict, horizon: str, ret_pct: float) -> dict | None:
    """단일 빗나간 추천 → Gemini로 카테고리·원인·회피규칙 생성"""
    prompt = (
        f"빗나간 추천:\n"
        f"- 종목: {row['ticker']}\n"
        f"- 타입: {row['pick_type']}\n"
        f"- 추천일: {row['snapshot_date']}\n"
        f"- 검증 기간: {horizon}\n"
        f"- 진입가 → 현재가: {row['entry_price']} → {row.get(f'price_{horizon}')}\n"
        f"- 실제 수익률: {ret_pct:+.2f}%\n"
        f"- 진입 시점 지표:\n"
        f"  · 30일 모멘텀: {row.get('momentum_30d')}%\n"
        f"  · 뉴스 감성:   {row.get('sentiment')}\n"
        f"  · 거래량 비율: {row.get('volume_ratio')}x\n"
        f"- 당시 추천 이유: {row.get('ai_reason')}\n\n"
        "다음 JSON 구조로만 답해라:\n"
        "{\n"
        '  "failure_category": "과열매수" 또는 "역추세진입" 또는 "감성무시" 또는 "급락추격매도" 또는 "변동성무시" 또는 "거시이벤트누락" 또는 "기타",\n'
        '  "root_cause": "왜 틀렸는지 2~3문장",\n'
        '  "avoid_rule": "다음에 이런 패턴이 보이면 어떻게 할지 1문장 규칙",\n'
        '  "severity": 1~5 정수 (손실 크기·재현 가능성 기반)\n'
        "}"
    )
    try:
        text = call_gemini(prompt, system=_FAILURE_SYSTEM, retries=2)
        data = json.loads(_strip_json(text))
        return {
            "failure_category": str(data.get("failure_category", "기타"))[:40],
            "root_cause":       str(data.get("root_cause", ""))[:600],
            "avoid_rule":       str(data.get("avoid_rule", ""))[:300],
            "severity":         max(1, min(5, int(data.get("severity", 3)))),
        }
    except Exception as e:
        logger.warning(f"[prediction_tracker] 실패분석 파싱 오류 ({row['ticker']}/{horizon}): {e}")
        return None


def analyze_failures(limit_per_horizon: int = 10) -> dict:
    """검증 완료된 빗나간 스냅샷 중 아직 분석되지 않은 것을 Gemini로 처리.
    horizon별로 최대 limit_per_horizon건만 — 토큰·시간 절약."""
    sb = _get_client()
    if not sb:
        return {"analyzed": 0}

    analyzed = 0
    for horizon in ("1d", "7d", "30d"):
        hit_col = f"hit_{horizon}"
        ret_col = f"ret_{horizon}"
        try:
            # 빗나간 케이스 (hit=false) + 아직 분석 안 된 (failure_analyses에 없음) 추출
            # SQL: snapshots LEFT JOIN failure_analyses USING horizon WHERE hit=false AND analysis IS NULL
            # Supabase Python SDK는 JOIN 직접 지원이 약하므로 2-step 조회로 처리
            r = sb.table("prediction_snapshots") \
                .select("*") \
                .eq(hit_col, False) \
                .order("snapshot_date", desc=True) \
                .limit(limit_per_horizon * 3) \
                .execute()
            candidates = r.data or []
            if not candidates:
                continue

            # 이미 분석된 snapshot_id 조회
            ids = [c["id"] for c in candidates]
            existing = sb.table("failure_analyses") \
                .select("snapshot_id") \
                .in_("snapshot_id", ids) \
                .eq("horizon", horizon) \
                .execute()
            done_ids = {row["snapshot_id"] for row in (existing.data or [])}

            pending = [c for c in candidates if c["id"] not in done_ids][:limit_per_horizon]
            for row in pending:
                ret_pct = row.get(ret_col)
                if ret_pct is None:
                    continue
                result = _analyze_one(row, horizon, float(ret_pct))
                if not result:
                    continue
                try:
                    sb.table("failure_analyses").insert({
                        "snapshot_id":      row["id"],
                        "horizon":          horizon,
                        "failure_category": result["failure_category"],
                        "root_cause":       result["root_cause"],
                        "avoid_rule":       result["avoid_rule"],
                        "severity":         result["severity"],
                        "active":           True,
                    }).execute()
                    analyzed += 1
                except Exception as e:
                    logger.error(f"[prediction_tracker] failure_analyses INSERT 실패: {e}")
        except Exception as e:
            logger.error(f"[prediction_tracker] analyze_failures 오류 ({horizon}): {e}")

    logger.info(f"[prediction_tracker] 실패 분석 완료: {analyzed}건")
    return {"analyzed": analyzed}


# ─────────────────────────────────────────────────────────────
# 4. 활성 회피 규칙 조회 — today_picks가 호출
# ─────────────────────────────────────────────────────────────

def get_active_failure_patterns(top_n: int = ACTIVE_LESSON_TOP_N) -> list[dict]:
    """최근 N일 내 빈도·severity 가중 합산 Top N 카테고리 + 대표 회피 규칙.
    반환: [{"category": "과열매수", "count": 5, "avoid_rule": "...", "avg_severity": 3.4}, ...]"""
    sb = _get_client()
    if not sb:
        return []

    cutoff = (date.today() - timedelta(days=ACTIVE_LESSON_LOOKBACK_DAYS)).isoformat()
    try:
        r = sb.table("failure_analyses") \
            .select("failure_category,avoid_rule,severity") \
            .eq("active", True) \
            .gte("analyzed_at", cutoff) \
            .execute()
        rows = r.data or []
    except Exception as e:
        logger.error(f"[prediction_tracker] 활성 규칙 조회 실패: {e}")
        return []

    # 카테고리별 집계
    buckets: dict[str, dict] = {}
    for row in rows:
        cat = row["failure_category"]
        b = buckets.setdefault(cat, {"category": cat, "count": 0, "sev_sum": 0, "latest_rule": ""})
        b["count"] += 1
        b["sev_sum"] += int(row.get("severity") or 3)
        if row.get("avoid_rule"):
            b["latest_rule"] = row["avoid_rule"]

    # 가중 합산 (count × avg_severity) 기준 정렬
    out = []
    for b in buckets.values():
        avg_sev = b["sev_sum"] / b["count"]
        out.append({
            "category":     b["category"],
            "count":        b["count"],
            "avg_severity": round(avg_sev, 2),
            "weight":       round(b["count"] * avg_sev, 2),
            "avoid_rule":   b["latest_rule"],
        })
    out.sort(key=lambda x: -x["weight"])
    return out[:top_n]


def apply_score_penalty(pick_data: dict, active_patterns: list[dict]) -> tuple[float, list[str]]:
    """raw_score에 패턴 매칭 페널티 적용.
    pick_data: {pick_type, momentum_30d, sentiment, volume_ratio, raw_score}
    Returns: (penalized_score, matched_categories)"""
    score = float(pick_data.get("raw_score") or 0)
    matched = []
    active_cats = {p["category"] for p in active_patterns}
    for cat, matcher in PATTERN_MATCHERS.items():
        if cat in active_cats and matcher(pick_data):
            score *= PENALTY_FACTOR
            matched.append(cat)
    return round(score, 4), matched


def build_lesson_prompt_block(active_patterns: list[dict]) -> str:
    """today_picks 프롬프트 상단에 끼울 회피 규칙 블록"""
    if not active_patterns:
        return ""
    lines = ["[지난 회고에서 도출된 회피 규칙 — 추천 이유 작성 시 반드시 참고]"]
    for i, p in enumerate(active_patterns, 1):
        lines.append(f"{i}. {p['category']} (최근 {p['count']}건): {p['avoid_rule']}")
    return "\n".join(lines) + "\n\n"
