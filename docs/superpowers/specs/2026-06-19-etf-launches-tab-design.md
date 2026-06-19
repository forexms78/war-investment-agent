# ETF 신규상장 탭 (국내·미국) — 설계 스펙

> 작성일 2026-06-19. whalyx에 ETF 신규 출시(상장 예정 + 최근 상장) 탭 추가.
> 의도: 신규 ETF는 "상장 때 한 번 치고 빠지거나, 장투로 저점 누적"이 목적 → **최신성이 생명**.

## 1. 범위·위치

- **새 최상위 탭** `ETF 신규` (기존 investors/markets/foreign/mylab 옆). markets 안 기존 `etf`(자금 시그널)와 **별개**.
- 탭 내부 **2개 서브탭**: `국내` / `미국`.
- 범위: **상장 예정(앞으로)** + **최근 상장(최근 30일)** 둘 다.
- 각 카드: 운용사 칩(TIGER·KODEX·ACE·SOL·RISE 등) + 상태 뱃지(`D-7 상장예정` / `신규상장 N일전`) + 추종지수/테마 + AI 한줄.
- 카드 클릭 → 상세: 구성종목(또는 예정은 추종지수·전략) + Gemini 평이한 해설(무엇에 투자/테마/적합 투자자/리스크).

## 2. 데이터 소스 (하이브리드: 날짜·종목=팩트 수집, 해설=Gemini)

| 구분 | 최근 상장 (실제 종목 O) | 상장 예정 (종목 미확정) |
|------|----------------------|----------------------|
| 국내 | KRX 정보데이터시스템(data.krx.co.kr) ETF 전종목 기본정보(상장일 desc, 최근 30일) + CU 구성내역 | KRX KIND 신규상장 공시 / 네이버금융 신규상장 ETF (best-effort). 추종지수·전략·카테고리만 |
| 미국 | StockAnalysis ETF launches + Yahoo `quoteSummary` `topHoldings` 모듈(기존 Yahoo REST 패턴 재사용) | StockAnalysis upcoming / SEC EDGAR 등록 (best-effort). 전략·카테고리만 |
| 해설 | `backend/utils/gemini.py`의 `call_gemini(prompt, system)`로 ETF별 평이한 설명 생성, DB 캐시 | 동일 |

**리스크(명시):** "상장 예정"은 국내·미국 모두 깔끔한 무료 구조화 피드가 없음 → 1차 소스 + 폴백으로 best-effort. 비면 "예정 공시 없음" 솔직 표기. "최근 상장"은 KRX/Yahoo로 견고.

**최신성 보장:** 스케줄러 6시간 주기 수집(출시일은 일 단위로만 변함) + 응답에 `as_of`(데이터 기준 시각) 포함 + D-day는 프론트에서 실시간 계산.

## 3. 아키텍처 (기존 DB-Only 패턴 준수)

- **백엔드 서비스** `backend/services/etf_launches.py` (sync 함수, 상단 `SYSTEM`/TTL 상수, `db_set` 저장, `requests.Session` HTTP, `call_gemini` 해설).
  - `collect_kr_launches()`, `collect_us_launches()`, `build_detail(market, ticker)`.
  - Gemini 호출량 방어: 시장별 상위 **15개**(예정+최근)만 해설 생성·캐시, 초과분은 기본정보만.
- **엔드포인트** `backend/api/main.py` (`db_get_stale`만 읽음, `_run` 래핑):
  - `GET /etf-launches/kr`, `GET /etf-launches/us` (목록)
  - `GET /etf-launches/{market}/{ticker}` (상세)
- **스케줄러** `backend/services/scheduler.py`: `refresh_etf_launches_kr/us` 잡 — interval **6h**, `create_scheduler()` 등록 + `warm_all_caches()` 포함, `_run_sync` 래핑.

## 4. 프론트엔드 (Next.js, 기존 패턴)

- `frontend/components/EtfLaunchSection.tsx` (`"use client"`, useEffect+fetch `${API}/etf-launches/kr|us`, Tailwind, 내부 서브탭 국내/미국, 카드 + 상세 모달).
- `frontend/app/dashboard/page.tsx`: `Tab` 타입 union + `tabs` 배열 + 컨텐츠 렌더 + lazy fetch 등록.
- `frontend/types/index.ts`: `EtfLaunch`, `EtfLaunchDetail` 인터페이스.
- `frontend/contexts/LanguageContext.tsx`: `tab.etfLaunch` 등 라벨 키 (ko/en).

## 5. 엣지/에러 상태 (완료 게이트)

- 로딩 스켈레톤 / 빈 상태("예정 공시 없음") / 수집 실패 시 마지막 캐시 유지 + `as_of` 표시.
- 예정 카드: "구성종목 미확정 — 추종지수/전략" 명시.
- 정렬: 예정(임박순) → 최근상장(최신순).

## 6. 구현 방식

워크플로우 오케스트레이션: ①데이터 소스 리서치(KR/US 병렬) → ②구현(BE/FE 병렬, 파일 셋 분리) → ③통합·빌드·타입체크 → ④코드리뷰(완료 게이트). 빌드/리뷰 통과 후 사용자 승인 시에만 push(=자동배포).
