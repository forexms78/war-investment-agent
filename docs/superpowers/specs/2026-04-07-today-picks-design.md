# 오늘의 투자포인트 (Today Picks) — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

---

## Goal

기존 기능을 `/dashboard`로 이동하고, Whalyx 메인 페이지(`/`)를 "오늘의 투자포인트" 단일 목적 페이지로 교체한다. S&P 500 대표 50종목을 매일 분석해 매수 3 / 매도 3 / 관심 3 종목을 3×3 그리드로 보여준다. 빠른 로딩 + Gemini 설명 + FinBERT 감성 분석 조합으로 데이터 기반 추천을 제공한다.

---

## 데이터 파이프라인

```
S&P 500 대표 50종목 (고정 리스트)
        ↓
yfinance       → 현재가, 30일 수익률, 오늘 거래량, 20일 평균 거래량
NewsAPI        → 종목별 최신 헤드라인 3개 (영문)
        ↓
FinBERT (HF Inference API, ProsusAI/finbert)
        → 헤드라인당 감성 점수: positive(+1) / neutral(0) / negative(-1)
        → 종목당 평균 감성 점수 산출
        ↓
종합 스코어 계산 (종목당):
  score = (momentum_30d_normalized × 0.4)
        + (sentiment_avg × 0.4)
        + (volume_anomaly_normalized × 0.2)

  - momentum_30d_normalized : 50종목 중 백분위 (-1 ~ +1)
  - sentiment_avg            : FinBERT 평균 (-1 ~ +1)
  - volume_anomaly_normalized: (오늘거래량 / 20일평균) 백분위 (-1 ~ +1)
        ↓
상위 3개  → buy  (score 높은 순)
하위 3개  → sell (score 낮은 순)
나머지 중 거래량 이상치 상위 3개 → watch
        ↓
Gemini 2.5 Flash → 각 종목 추천 이유 1~2문장 생성 (한국어)
        ↓
결과 6시간 캐시 → GET /today-picks
```

---

## S&P 500 대표 50종목 (고정)

```python
SP50 = [
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","JPM","V",
    "UNH","XOM","JNJ","WMT","MA","PG","HD","CVX","MRK","ABBV",
    "COST","PEP","KO","BAC","LLY","AVGO","CSCO","TMO","ACN","MCD",
    "ABT","ORCL","NKE","DHR","PM","IBM","INTC","GE","QCOM","AMD",
    "AMGN","TXN","SBUX","LOW","INTU","CAT","AXP","SPGI","GS","OXY"
]
```

---

## 백엔드 설계

### 신규: `backend/services/today_picks.py`

**책임:** 50종목 분석, 스코어 계산, FinBERT 호출, Gemini 설명 생성, 캐시 관리

**주요 함수:**
- `get_today_picks()` → `dict` (캐시 적중 시 즉시 반환)
- `_fetch_price_data(tickers)` → yfinance 병렬 조회 (ThreadPoolExecutor)
- `_fetch_news(ticker)` → NewsAPI 헤드라인 3개
- `_finbert_sentiment(texts)` → HF Inference API 배치 호출
- `_score_tickers(prices, sentiments)` → 종합 스코어 계산
- `_gemini_reason(ticker, score_data)` → 이유 한 줄 생성

**캐시:** TTL 6시간 (메모리 캐시, whale_signal.py 패턴 동일)

**HF API:** `https://api-inference.huggingface.co/models/ProsusAI/finbert`  
- Bearer token: `HF_API_TOKEN` 환경변수  
- 무료 티어: 1000 req/day — 50종목 × 3 헤드라인 = 150 req/갱신, 하루 최대 6회 갱신 가능

**오류 처리:**
- FinBERT 응답 실패 시 sentiment_avg = 0 으로 폴백 (스코어 계산 계속)
- yfinance 실패 종목은 스킵
- Gemini 실패 시 reason = "데이터 분석 중" 폴백

### 신규: `GET /today-picks` in `backend/api/main.py`

**응답 형식:**
```json
{
  "buy": [
    {
      "ticker": "NVDA",
      "name": "NVIDIA Corporation",
      "price": 876.40,
      "change_pct": 3.2,
      "change_1d": 27.3,
      "momentum_30d": 18.2,
      "sentiment": 0.89,
      "volume_ratio": 2.3,
      "reason": "AI 반도체 수요 급증으로 기관 순매수 전환. 감성 지수 역대 최고 구간."
    }
  ],
  "sell": [ ... ],
  "watch": [ ... ],
  "generated_at": "2026-04-07T09:00:00Z",
  "next_update": "2026-04-07T15:00:00Z"
}
```

---

## 프론트엔드 설계

### 라우팅 변경

| 변경 전 | 변경 후 |
|---------|---------|
| `/` → `frontend/app/page.tsx` (대시보드) | `/` → 오늘의 투자포인트 (신규) |
| 없음 | `/dashboard` → 기존 대시보드 이동 |

### 신규: `frontend/app/page.tsx`

**구성:**
1. 헤더: `Whalyx` 로고 + 날짜 + `전체 대시보드 →` 링크
2. AI 갱신 배지: `Gemini AI · FinBERT 분석 · HH:MM 갱신`
3. 섹션 3개 (각각 레이블 + 3카드 그리드):
   - `▲ 매수 추천` (초록)
   - `▼ 매도 추천` (빨강)
   - `◎ 고거래량 관심 종목` (노랑)
4. 하단: `전체 대시보드 보기` 버튼

**로딩 전략:**
- `useEffect` + `fetch('/today-picks 프록시')` — CSR
- 스켈레톤 카드 9개 표시 후 데이터 교체
- API 응답 6시간 캐시이므로 로딩 < 200ms (캐시 적중 시)

### 신규: `frontend/components/StockPickCard.tsx`

**Props:**
```typescript
interface StockPickCardProps {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  reason: string;
  type: 'buy' | 'sell' | 'watch';
}
```

### 신규: `frontend/components/TodayPicksGrid.tsx`

3종목 배열을 받아 `StockPickCard` 3개를 그리드로 렌더링.

### 기존: `frontend/app/dashboard/page.tsx`

기존 `frontend/app/page.tsx` 내용 그대로 이동. `layout.tsx` 수정 없음.

---

## 환경변수 추가

`backend/.env`에 추가:
```
HF_API_TOKEN=hf_...
```

HF 토큰 발급: https://huggingface.co/settings/tokens (무료, Read 권한)

---

## 성능 목표

| 지표 | 목표 |
|------|------|
| 캐시 적중 시 응답 | < 200ms |
| 최초 갱신 시 응답 | < 30초 (yfinance 50종목 병렬) |
| 프론트 FCP | < 1초 (스켈레톤 즉시) |
| HF API 일일 사용량 | < 200 req (6시간 캐시 기준) |
