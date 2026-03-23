# War-Inve: Geopolitical Risk Investment Agent

> AI 에이전트 팀이 지정학 리스크를 분석하여 포트폴리오 위험도를 실시간으로 평가합니다.

## Architecture

멀티 에이전트 오케스트레이션 구조 (LangGraph 기반):

```
사용자 포트폴리오 입력
        ↓
   [PM 에이전트]
   태스크 분배 & QA
      ↙        ↘
[백엔드 #1]  [백엔드 #2]
 뉴스 수집    금융 데이터
 이벤트 분류  리스크 스코어
      ↘        ↙
  [프론트 에이전트]
  리포트 생성 & 시각화
        ↓
   최종 리스크 리포트
```

## Agent Roles

| 에이전트 | 역할 |
|---------|------|
| PM Agent | 사용자 요청 파싱, 태스크 분배, 결과 QA |
| Backend Agent #1 | 지정학 뉴스 수집, 이벤트 분류 (전쟁/제재/분쟁) |
| Backend Agent #2 | 주가 데이터 조회, 섹터별 리스크 스코어링 |
| Frontend Agent | 결과 종합, 리포트 생성, 시각화 구성 |

## Tech Stack

- **LLM**: Google Gemini 2.0 Flash (Free Tier)
- **Orchestration**: LangGraph
- **Backend**: Python FastAPI
- **Frontend**: Next.js + Tailwind CSS
- **Data**: NewsAPI + yfinance
- **Deploy**: Vercel + Railway

## Cost

**$0/month** — Gemini Flash 무료 티어 사용

## Getting Started

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # API 키 설정
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
```
