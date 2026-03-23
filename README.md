# War-Inve: Geopolitical Risk Investment Agent

> 지정학 리스크(전쟁, 제재, 분쟁)를 실시간 분석하여 포트폴리오 위험도를 평가하는 멀티 에이전트 시스템

---

## OMS Team Structure

실제 대형 조직 구조를 AI 에이전트로 모델링한 16-agent 오케스트레이션 시스템입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                        PM AGENT                                 │
│         요구사항 정의 / 우선순위 결정 / 최종 승인               │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                       TPM AI AGENT                              │
│         스프린트 계획 / 기술 아키텍처 / 의존성 관리             │
└──────────┬──────────────────────────────────────┬───────────────┘
           │                                      │
     ┌─────▼──────┐    ┌──────────────┐    ┌─────▼──────┐
     │Supervisor 1│    │ Supervisor 2 │    │Supervisor 3│
     │ 데이터파이프│    │  분석 파이프  │    │아웃풋 파이프│
     └─────┬──────┘    └──────┬───────┘    └─────┬──────┘
           │                  │                  │
   ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐
   │  MSA #1       │  │  MSA #5       │  │  MSA #9       │
   │ NewsCollector │  │  RiskScorer   │  │ReportGenerator│
   ├───────────────┤  ├───────────────┤  ├───────────────┤
   │  MSA #2       │  │  MSA #6       │  │  MSA #10      │
   │EventClassifier│  │PortfolioMapper│  │  Visualizer   │
   ├───────────────┤  ├───────────────┤  ├───────────────┤
   │  MSA #3       │  │  MSA #7       │  │  MSA #11      │
   │SentimentAnalyz│  │HistoricalAnalz│  │  DataStorage  │
   ├───────────────┤  ├───────────────┤  └───────────────┘
   │  MSA #4       │  │  MSA #8       │
   │FinancialData  │  │ AlertManager  │
   └───────────────┘  └───────────────┘
```

---

## Agent Roles

### Management Layer

| 에이전트 | 역할 |
|---------|------|
| PM Agent | 사용자 요청 파싱, 태스크 우선순위 결정, 최종 결과물 승인 또는 재작업 지시 |
| TPM AI Agent | 기술 아키텍처 결정, 스프린트 계획, MSA 간 의존성 및 실행 순서 관리 |

### Context Supervisor Layer

| 에이전트 | 담당 MSA | 역할 |
|---------|---------|------|
| Supervisor #1 | MSA #1~4 | 데이터 수집 파이프라인 감독, 에이전트 간 컨텍스트 유지 |
| Supervisor #2 | MSA #5~8 | 분석 파이프라인 감독, 중간 결과물 검증 |
| Supervisor #3 | MSA #9~11 | 아웃풋 파이프라인 감독, 최종 산출물 품질 관리 |

### MSA Layer (11 Microservice Agents)

| # | MSA Agent | 담당 | 사용 도구 |
|---|-----------|------|---------|
| 1 | NewsCollector | 지정학 뉴스 수집 | NewsAPI |
| 2 | EventClassifier | 전쟁/제재/분쟁 분류 | Gemini Flash |
| 3 | SentimentAnalyzer | 뉴스 감정 분석 | Gemini Flash |
| 4 | FinancialData | 주가/환율 데이터 수집 | yfinance |
| 5 | RiskScorer | 섹터별 리스크 점수 산출 | Gemini Flash |
| 6 | PortfolioMapper | 보유 종목 ↔ 리스크 매핑 | 내부 로직 |
| 7 | HistoricalAnalyzer | 과거 유사 이벤트 비교 | Gemini Flash |
| 8 | AlertManager | 임계값 초과 시 알림 발송 | 내부 로직 |
| 9 | ReportGenerator | 최종 리스크 리포트 생성 | Gemini Flash |
| 10 | Visualizer | 차트/대시보드 데이터 구성 | 내부 로직 |
| 11 | DataStorage | DB 저장 및 조회 | Supabase |

---

## Execution Pipeline

```
사용자: "내 포트폴리오 리스크 분석해줘 (삼성전자, TSMC, NVDA)"
        │
        ▼
[PM Agent]
 - 요청 파싱
 - TPM에 태스크 위임
        │
        ▼
[TPM Agent]
 - 실행 계획 수립
 - Supervisor #1, #2 병렬 실행 지시
        │
   ┌────┴────┐
   ▼         ▼
[Supervisor 1]    [Supervisor 2]
 MSA #1~4 실행     (Supervisor 1 완료 후 실행)
 뉴스 수집          MSA #5~8 실행
 이벤트 분류        리스크 스코어링
 감정 분석          포트폴리오 매핑
 주가 조회          과거 비교 분석
   │
   ▼
[Supervisor 3]
 MSA #9~11 실행
 리포트 생성
 시각화
 DB 저장
        │
        ▼
[PM Agent]
 - 결과물 QA
 - 승인 또는 재작업 지시
        │
        ▼
사용자에게 최종 리스크 리포트 전달
```

---

## Tech Stack

| 구분 | 기술 |
|------|------|
| Orchestration | LangGraph |
| LLM | Google Gemini 2.0 Flash (Free Tier) |
| Backend | Python FastAPI |
| Frontend | Next.js + Tailwind CSS |
| News Data | NewsAPI |
| Financial Data | yfinance |
| Database | Supabase |
| Deploy | Vercel (Frontend) + Railway (Backend) |

**총 운영 비용: $0/month**

---

## Project Structure

```
war-inve/
├── backend/
│   ├── agents/
│   │   ├── pm_agent.py
│   │   ├── tpm_agent.py
│   │   ├── supervisors/
│   │   │   ├── supervisor_1.py
│   │   │   ├── supervisor_2.py
│   │   │   └── supervisor_3.py
│   │   └── msa/
│   │       ├── news_collector.py
│   │       ├── event_classifier.py
│   │       ├── sentiment_analyzer.py
│   │       ├── financial_data.py
│   │       ├── risk_scorer.py
│   │       ├── portfolio_mapper.py
│   │       ├── historical_analyzer.py
│   │       ├── alert_manager.py
│   │       ├── report_generator.py
│   │       ├── visualizer.py
│   │       └── data_storage.py
│   ├── api/
│   │   └── main.py
│   ├── utils/
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/
        └── components/
```

---

## Getting Started

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn api.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

```
GEMINI_API_KEY=your_gemini_api_key
NEWS_API_KEY=your_newsapi_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```
