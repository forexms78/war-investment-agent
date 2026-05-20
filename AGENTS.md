# Whalyx — AGENTS.md

## Project Structure
- `backend/` — Python **FastAPI** (async), port 8000
- `frontend/` — **Next.js 16** + React 19 + Tailwind v4 + Recharts

## Architecture: DB-Only (v2.0+)
- **API endpoints** read only from Supabase (`db_get_stale`), never call external APIs
- **APScheduler** background jobs handle ALL external API calls (Yahoo Finance, Gemini, Naver, KIS, CoinGecko)
- Scheduler jobs defined in `backend/services/scheduler.py`
- Cache keys: `investors_list`, `stocks_hot`, `stocks_recommendations`, `whale_signal_full`, `etf_signals`, `foreign_flow`, `market_driver`, `news_ai`, `money_flow`, etc.

## Key Files
| File | Purpose |
|------|---------|
| `backend/api/main.py` | All API routes + lifespan (scheduler startup) |
| `backend/services/scheduler.py` | APScheduler job definitions + warm_all_caches() |
| `backend/services/daily_signal.py` | Daily Signal recommendation engine (Gemini aggregation) |
| `backend/services/etf_signals.py` | ETF/stock technical signals (RSI, MA, Gemini batch) |
| `backend/services/investors.py` | 8 super investors 13F portfolio data |
| `backend/services/foreign_flow.py` | KRX foreign investor flow (Naver + KIS) |
| `backend/services/ai_summary.py` | Gemini news analysis + market drivers |
| `frontend/app/dashboard/page.tsx` | Main dashboard |
| `frontend/components/DailySignalSection.tsx` | Daily Signal UI component |
| `frontend/types/index.ts` | TypeScript type definitions |

## Dev Commands
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn backend.api.main:app --reload --port 8000

# Frontend
cd frontend && npm install
npm run dev
```

## Important Conventions
- All frontend API calls go to `NEXT_PUBLIC_API_URL` env var
- Gemini calls are ONLY made from scheduler jobs (never from API endpoints)
- Scheduler jobs use `_run_sync(fn, *args)` to run sync functions in executor
- Korean stock tickers use `.KS` suffix for Yahoo Finance (e.g., `005930.KS`)
- Foreign flow data from Naver Finance (iframe scraping) — KST 16:30/17:30
- KIS auto-trading is DISABLED — `KIS_MOCK=true` forced in code
