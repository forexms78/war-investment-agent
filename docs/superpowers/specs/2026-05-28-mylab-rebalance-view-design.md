# My Lab 리밸런싱 적용 뷰 — 설계

> 작성: 2026-05-28 · 상태: 승인됨 (구현 대기)

## 목적

6번모드(invest-pro)가 생성한 매수/매도 리밸런싱 추천을 My Lab 대시보드에서 시각적으로 확인한다. "이걸 팔고 이걸 사라"를 현재 포트폴리오 위에 오버레이로 표시해 적용 전/후를 비교한다.

## 데이터 흐름

```
[6번모드 분석]
   ↓ 수동 push (날짜별 파일, 누적)
stock78/analyses/YYYY-MM-DD-rebalance.json   ← 대시보드가 읽음 (기계용)
stock78/analyses/YYYY-MM-DD-rebalance.md     ← 히스토리 뷰어용 (사람용)
   ↓ GET /mylab/rebalance (최신 .json 1개 파싱)
[MyLabSection "적용" 뷰]
```

형상관리: `stock78`이 git repo이므로 push 시 커밋 히스토리로 자동 추적. 파일은 날짜별로 누적(덮어쓰기 금지).

## JSON 스키마

```json
{
  "date": "2026-05-28",
  "title": "리스크오프 대응 리밸런싱",
  "current_allocation": { "테크": 65, "우주": 15, "금": 0, "방어": 25, "기타": 5 },
  "target_allocation":  { "테크": 50, "우주": 12, "금": 8, "방어": 25, "기타": 5 },
  "actions": [
    { "ticker": "SOXX", "name": "iShares 반도체", "action": "trim",
      "weight_from": 9.1, "weight_to": 4.5, "reason": "빅테크 7중 중복 축소" },
    { "ticker": "XLK", "name": "기술주 ETF", "action": "sell",
      "weight_from": 4.5, "weight_to": 0, "reason": "중복 정리" },
    { "ticker": "ACE KRX금현물", "name": "금 현물 ETF", "action": "buy",
      "weight_from": 0, "weight_to": 8, "reason": "안전판 0% → 편입" }
  ]
}
```

- `action`: `sell`(전량) / `trim`(일부 축소) / `buy`(신규·추가) / `hold`
- `current_allocation` / `target_allocation`: 테마 비중은 **6번모드가 분석 시점에 계산해 기록** (백엔드가 테마 분류를 추측하지 않음)
- 종목 비중(`weight_from/to`)도 6번모드 산출값

## 백엔드 변경 (`backend/services/mylab.py` + `api/main.py`)

- 신규 함수 `get_latest_rebalance()` — `analyses/`에서 `*-rebalance.json` 중 최신 1개 fetch + 파싱
- 신규 엔드포인트 `GET /mylab/rebalance` — 위 JSON을 그대로 반환 (없으면 `{"exists": false}`)
- 실시간 현재 포트폴리오는 기존 `GET /mylab/portfolio` 그대로 사용 (프론트가 두 응답을 조합)
- `_run()` 래핑, 기존 패턴 준수

## 프론트 변경 (`frontend/components/MyLabSection.tsx`)

- `MainView` 타입에 `"rebalance"` 추가 → 토글 3개 (현재 / 적용 / 히스토리)
- 신규 컴포넌트:
  - `RebalanceView` — `/mylab/rebalance` + `/mylab/portfolio` 동시 fetch, 조합
  - `ThemeAllocationBar` — 테마별 current → target 가로 바 (↑↓ 표시)
  - 종목 액션 오버레이: 기존 `HoldingRow` 확장 — `trim`/`sell`은 빨강 빗금(`repeating-linear-gradient`), `buy`는 초록 테두리 추가행
  - `HoldingDonut` — 보유종목 비중 도넛 (별도 카드, 액션 무관 순수 현황)
- 분석 없을 때: "아직 6번모드 분석이 없습니다" 안내
- 기존 "현재" 뷰·"히스토리" 뷰는 변경 없음

## 주의사항

- Next.js 16 breaking changes — 구현 전 `node_modules/next/dist/docs/` 확인 (AGENTS.md 지침)
- 이모지 전면 금지 (UI/코드/커밋)
- 도넛 차트: 기존 recharts 사용 여부 확인 후 결정 (v3.3에서 recharts 사용 흔적 있음)
- 종목 액션의 `ticker`는 portfolio.md 티커와 매칭 → 신규 매수 종목은 매칭 대상 없음(추가행)

## 범위 밖 (YAGNI)

- 6번모드 분석의 자동/반자동 생성 (수동 push만)
- 실제 매매 주문 연동
- 분석 결과의 백테스트/검증 루프 (기존 review 시스템과 별개)
