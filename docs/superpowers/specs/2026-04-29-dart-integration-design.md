# DART API 통합 설계

**목표:** yfinance.KS 의존성 제거 + 공시 기반 긴급차단 + Gemini 프롬프트 고도화

**배경:**
- yfinance.KS는 업데이트 지연(수일~수주), 누락·오류, 비공식 소스 문제
- DART는 법적 의무 제출 데이터, 공시 즉시 API 반영, XBRL 구조화

---

## 아키텍처

```
quant_scheduler._buy_stocks()
    │
    ├─ 1. 재무 필터 (financial_filter.py)
    │      KIS: PER, PBR, 시가총액, 투자주의 (실시간 유지)
    │      DART: ROE, 부채비율, 유동비율, 매출성장, 영업이익성장 (교체)
    │
    ├─ 2. DART 긴급차단 (dart_service.py) ← Gemini 호출 전
    │      공시목록 조회 → 키워드 매칭 → 즉시 차단
    │      차단 키워드: 유상증자, 전환사채, 신주인수권부사채
    │      Gemini 호출 없음
    │
    └─ 3. 뉴스 감성 분석 (quant_scheduler.py)
           System Instruction 분리
           DART 공시 요약 컨텍스트 추가
           block_reason 필드 추가
```

---

## 파일 맵

| 액션 | 경로 | 책임 |
|------|------|------|
| 신규 | `backend/services/dart_service.py` | DART API 전용 모듈 |
| 수정 | `backend/services/financial_filter.py` | `_get_kr_fundamentals()` yfinance.KS → DART |
| 수정 | `backend/services/quant_scheduler.py` | 긴급차단 삽입 + Gemini 프롬프트 개선 |
| 수정 | `backend/api/main.py` | 서버 시작 시 corp_code 초기화 |

---

## 컴포넌트 상세

### dart_service.py

**corp_code 매핑**
- 서버 최초 시작 시 DART XML 다운로드: `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=<KEY>`
- ZIP 해제 → XML 파싱 → Supabase `dart_corp_codes(ticker, corp_code, corp_name)` 저장
- 이후 조회는 DB만 사용. 매주 자동 갱신 불필요 (수동 트리거 충분)
- `get_corp_code(ticker: str) -> str | None`

**재무 데이터**
- DART API: `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json`
- 파라미터: `corp_code`, `bsns_year=<최근년도>`, `reprt_code=11011` (사업보고서)
- 추출 항목: ROE(당기순이익/자본총계), 부채비율(부채총계/자본총계), 유동비율(유동자산/유동부채), 매출성장(YoY), 영업이익성장(YoY)
- Supabase `api_cache` TTL: 6시간 (기존 패턴)
- `get_kr_financials(corp_code: str) -> dict`

**긴급차단**
- DART API: `https://opendart.fss.or.kr/api/list.json`
- 파라미터: `corp_code`, `pblntf_ty=C` (주요사항보고서), 최근 3일
- 차단 키워드: `["유상증자", "전환사채", "신주인수권부사채"]`
- Redis 4시간 캐시 (기존 redis_cache 패턴)
- `check_emergency_block(corp_code: str) -> tuple[bool, str]`
  - 반환: `(차단여부, 공시제목)`

---

### financial_filter.py 변경

`_get_kr_fundamentals(ticker)`:
- 제거: `yfinance.Ticker(f"{ticker}.KS").info` 호출 전체
- 추가: `dart_service.get_corp_code(ticker)` → `dart_service.get_kr_financials(corp_code)`
- 유지: KIS `inquire-price` (PER, PBR, 시가총액, 투자주의)
- corp_code 없는 종목(소형주 등): DART 항목은 None 처리 → 기존대로 통과

매핑 필드:
```
DART fnlttSinglAcnt → financial_filter 내부 키
당기순이익 / 자본총계 → roe
부채총계 / 자본총계   → debt_to_equity
유동자산 / 유동부채   → current_ratio
매출액 YoY           → revenue_growth
영업이익 YoY         → earnings_growth
```

---

### quant_scheduler.py 변경

**_buy_stocks() 순서 변경:**
```python
sig = _calc_signal(ticker, market)
if sig["signal"] != "buy": continue

# 재무 필터 (기존)
if USE_FINANCIAL_FILTER:
    ok, reason_f, _ = passes_5stage_filter(ticker, market)
    if not ok: continue

# DART 긴급차단 (신규 — Gemini 전)
if market == "KR":
    corp_code = dart_service.get_corp_code(ticker)
    if corp_code:
        blocked, disc_title = dart_service.check_emergency_block(corp_code)
        if blocked:
            print(f"[quant] {ticker} DART 긴급차단: {disc_title}")
            continue

# 뉴스 감성 (기존 위치)
news_blocked, news_info = _news_blocks_trade(ticker, name)
```

**_news_blocks_trade() 프롬프트 개선:**
```python
SENTIMENT_SYSTEM = """
당신은 퀀트 트레이딩 리스크 필터입니다. 매수 차단 여부를 판단합니다.

block_trading=true 기준 (아래 중 하나라도 해당):
- 실적 쇼크 또는 대규모 손실 공시
- 경영진 횡령·배임·검찰 수사 개시
- 주요 사업 중단 또는 핵심 계약 취소
- 회계감사 의견 거절·한정

데이터 신뢰도: 공시(50%) > 재무지표(20%) > 뉴스헤드라인(30%)
판단 불가 시 block_trading=false로 응답.
"""

# User 메시지 구성:
# [뉴스 헤드라인] 5개
# [최근 공시] dart_service에서 가져온 요약 (있을 경우)
# [재무 요약] PER, ROE, 부채비율 (있을 경우)
```

**응답 JSON 변경:**
```json
{
  "sentiment": 0.0,
  "block_trading": false,
  "category": "일반",
  "block_reason": ""
}
```
`block_reason` → `auto_trades.details` 에 저장.

---

## 에러 처리

- DART API 429/503: 재시도 없이 해당 항목 None 처리 → 필터 통과 (보수적)
- corp_code 없는 종목: DART 항목 전체 None → 통과
- XML 파싱 실패: 로그 출력 후 corp_code 테이블 미갱신 (기존 데이터 유지)

---

## 환경 변수

```
DART_API_KEY=d403095e08c5593f8b6cb965f7ef8d73d44f7d26
```

로컬: `backend/.env`
배포: Render 환경변수에 추가 필요

---

## Supabase 테이블

```sql
create table dart_corp_codes (
  ticker   text primary key,
  corp_code text not null,
  corp_name text not null,
  updated_at timestamptz default now()
);
```
