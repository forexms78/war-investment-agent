from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.services.news import collect_news
from backend.services.financial import fetch_financial_data
from backend.services.analyzer import analyze
from backend.services.report import generate_report

app = FastAPI(title="War-Investment Agent API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    portfolio: list[str]


class AnalysisResponse(BaseModel):
    final_report: str | None
    alerts: list[str] | None
    visualization_data: dict | None
    portfolio_risk_mapping: dict | None
    overall_risk_level: str | None


@app.get("/")
def health_check():
    return {"status": "ok", "service": "War-Investment Agent"}


@app.post("/analyze", response_model=AnalysisResponse)
def analyze_portfolio(request: AnalysisRequest):
    if not request.portfolio:
        raise HTTPException(status_code=400, detail="포트폴리오를 1개 이상 입력하세요")

    try:
        news = collect_news(request.portfolio)
        financial_data = fetch_financial_data(request.portfolio)
        result = analyze(request.portfolio, news, financial_data)
        final_report = generate_report(
            request.portfolio,
            result["analysis"],
            result["portfolio_risk_mapping"],
            result["alerts"],
        )
        risk_scores = result["analysis"].get("risk_scores", {})
        return AnalysisResponse(
            final_report=final_report,
            alerts=result["alerts"],
            visualization_data=result["visualization_data"],
            portfolio_risk_mapping=result["portfolio_risk_mapping"],
            overall_risk_level=risk_scores.get("overall_risk_level"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
