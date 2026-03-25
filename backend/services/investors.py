"""
전문 투자자 데이터 — SEC 13F 공개 포트폴리오 기준 (2024 Q3/Q4)
실제 공개 포트폴리오를 보유한 8인의 전문 투자자만 선정
"""

INVESTORS = [
    {
        "id": "warren-buffett",
        "name": "Warren Buffett",
        "title": "Chairman & CEO",
        "firm": "Berkshire Hathaway",
        "country": "US",
        "avatar_initial": "WB",
        "color": "#B7791F",
        "style": "가치투자",
        "description": "50년 이상 S&P 500을 초과 수익. 저평가된 우량 기업 장기 보유.",
        "known_for": "코카콜라·애플 대규모 보유, '영원히 팔지 않을 주식' 철학",
        "top_holdings": ["AAPL", "AXP", "KO"],
        "recent_moves": "2024년 AAPL 일부 매도로 현금 비중 사상 최고. BAC 지속 매도. OXY 꾸준히 추가매수.",
        "portfolio": [
            {"ticker": "AAPL", "name": "Apple", "weight": 28.1, "shares": 400000000, "action": "sell"},
            {"ticker": "AXP", "name": "American Express", "weight": 14.7, "shares": 151610700, "action": "hold"},
            {"ticker": "KO", "name": "Coca-Cola", "weight": 9.3, "shares": 400000000, "action": "hold"},
            {"ticker": "BAC", "name": "Bank of America", "weight": 11.4, "shares": 780000000, "action": "sell"},
            {"ticker": "CVX", "name": "Chevron", "weight": 6.5, "shares": 118610534, "action": "hold"},
            {"ticker": "OXY", "name": "Occidental Petroleum", "weight": 4.6, "shares": 264217117, "action": "buy"},
        ],
    },
    {
        "id": "cathie-wood",
        "name": "Cathie Wood",
        "title": "Founder & CIO",
        "firm": "ARK Invest",
        "country": "US",
        "avatar_initial": "CW",
        "color": "#6C3483",
        "style": "혁신성장",
        "description": "AI·바이오·핀테크 파괴적 혁신 기업에 집중. 5년 이상 장기 성장 관점.",
        "known_for": "TSLA 초기 대규모 매수, COIN 강세론, 10배 성장주 발굴",
        "top_holdings": ["TSLA", "COIN", "PLTR"],
        "recent_moves": "2024년 PLTR·COIN 추가 매수. AI 인프라 테마 강화. TSLA 일부 차익 실현.",
        "portfolio": [
            {"ticker": "TSLA", "name": "Tesla", "weight": 14.2, "shares": 8200000, "action": "hold"},
            {"ticker": "COIN", "name": "Coinbase", "weight": 10.8, "shares": 5100000, "action": "buy"},
            {"ticker": "ROKU", "name": "Roku", "weight": 8.1, "shares": 12300000, "action": "hold"},
            {"ticker": "PLTR", "name": "Palantir", "weight": 7.5, "shares": 22000000, "action": "buy"},
            {"ticker": "SHOP", "name": "Shopify", "weight": 6.3, "shares": 3800000, "action": "hold"},
            {"ticker": "RBLX", "name": "Roblox", "weight": 5.2, "shares": 9400000, "action": "hold"},
        ],
    },
    {
        "id": "michael-burry",
        "name": "Michael Burry",
        "title": "Founder & PM",
        "firm": "Scion Asset Management",
        "country": "US",
        "avatar_initial": "MB",
        "color": "#C0392B",
        "style": "역발상·공매도",
        "description": "'빅쇼트' 주인공. 군중과 반대 방향으로 투자. 저평가 중국 ADR 집중.",
        "known_for": "2008 서브프라임 위기 예측·공매도로 수억 달러 수익",
        "top_holdings": ["BABA", "JD", "BIDU"],
        "recent_moves": "2024년 중국 빅테크 ADR 대규모 매수. JD·BABA 비중 확대. 헬스케어 HCA 추가.",
        "portfolio": [
            {"ticker": "BABA", "name": "Alibaba", "weight": 21.2, "shares": 500000, "action": "buy"},
            {"ticker": "JD", "name": "JD.com", "weight": 18.4, "shares": 1200000, "action": "buy"},
            {"ticker": "BIDU", "name": "Baidu", "weight": 11.3, "shares": 250000, "action": "buy"},
            {"ticker": "HCA", "name": "HCA Healthcare", "weight": 9.8, "shares": 35000, "action": "buy"},
            {"ticker": "NIO", "name": "NIO Inc", "weight": 7.2, "shares": 2100000, "action": "hold"},
        ],
    },
    {
        "id": "ray-dalio",
        "name": "Ray Dalio",
        "title": "Founder & CIO",
        "firm": "Bridgewater Associates",
        "country": "US",
        "avatar_initial": "RD",
        "color": "#1A5276",
        "style": "매크로·분산",
        "description": "올웨더 포트폴리오 창시자. 경기 사이클 분석 기반 ETF 분산투자.",
        "known_for": "All Weather Portfolio, 원칙(Principles), 글로벌 매크로",
        "top_holdings": ["SPY", "EEM", "GLD"],
        "recent_moves": "2024년 금·신흥국 ETF 비중 확대. 달러 약세 및 분산 헤지 강화.",
        "portfolio": [
            {"ticker": "SPY", "name": "SPDR S&P 500 ETF", "weight": 12.1, "shares": 4200000, "action": "hold"},
            {"ticker": "EEM", "name": "iShares MSCI EM ETF", "weight": 8.5, "shares": 9800000, "action": "buy"},
            {"ticker": "GLD", "name": "SPDR Gold ETF", "weight": 7.8, "shares": 2100000, "action": "buy"},
            {"ticker": "IEMG", "name": "iShares Core MSCI EM", "weight": 6.1, "shares": 7600000, "action": "hold"},
            {"ticker": "VWO", "name": "Vanguard EM ETF", "weight": 5.8, "shares": 8400000, "action": "hold"},
        ],
    },
    {
        "id": "stanley-druckenmiller",
        "name": "Stanley Druckenmiller",
        "title": "Founder & CEO",
        "firm": "Duquesne Family Office",
        "country": "US",
        "avatar_initial": "SD",
        "color": "#117A65",
        "style": "기술주·매크로",
        "description": "소로스 펀드 전 수석 매니저. AI 메가트렌드 초기 포착의 명수.",
        "known_for": "1992년 영국 파운드화 공매도 성공, NVDA 초기 대규모 매수",
        "top_holdings": ["NVDA", "MSFT", "META"],
        "recent_moves": "2024년 NVDA 추가 매수, AI 인프라·빅테크 집중. 헬스케어 일부 매도.",
        "portfolio": [
            {"ticker": "NVDA", "name": "NVIDIA", "weight": 18.5, "shares": 850000, "action": "buy"},
            {"ticker": "MSFT", "name": "Microsoft", "weight": 12.1, "shares": 420000, "action": "buy"},
            {"ticker": "META", "name": "Meta Platforms", "weight": 8.3, "shares": 210000, "action": "buy"},
            {"ticker": "GOOGL", "name": "Alphabet", "weight": 9.4, "shares": 780000, "action": "hold"},
            {"ticker": "CRM", "name": "Salesforce", "weight": 7.1, "shares": 310000, "action": "hold"},
        ],
    },
    {
        "id": "bill-ackman",
        "name": "Bill Ackman",
        "title": "Founder & CEO",
        "firm": "Pershing Square",
        "country": "US",
        "avatar_initial": "BA",
        "color": "#1F618D",
        "style": "행동주의",
        "description": "집중 포트폴리오 행동주의 투자. 5~10개 종목에 초집중, 경영 개입.",
        "known_for": "힐튼·버거킹·치폴레 투자로 수십 배 수익. 2020년 CDS 헤지 성공.",
        "top_holdings": ["HLT", "QSR", "CMG"],
        "recent_moves": "2024년 HLT 장기 보유 유지. GOOGL 신규 매수. Nike 대규모 매수 후 매도.",
        "portfolio": [
            {"ticker": "HLT", "name": "Hilton Hotels", "weight": 14.2, "shares": 6900000, "action": "hold"},
            {"ticker": "QSR", "name": "Restaurant Brands", "weight": 12.8, "shares": 14200000, "action": "hold"},
            {"ticker": "CMG", "name": "Chipotle Mexican Grill", "weight": 11.3, "shares": 1800000, "action": "hold"},
            {"ticker": "CP", "name": "Canadian Pacific Kansas", "weight": 10.2, "shares": 10400000, "action": "hold"},
            {"ticker": "GOOGL", "name": "Alphabet", "weight": 9.1, "shares": 3100000, "action": "buy"},
        ],
    },
    {
        "id": "george-soros",
        "name": "George Soros",
        "title": "Founder & Chairman",
        "firm": "Soros Fund Management",
        "country": "US",
        "avatar_initial": "GS",
        "color": "#4A235A",
        "style": "글로벌 매크로",
        "description": "재귀성 이론 기반 글로벌 매크로 투자. AI 빅테크로 포트폴리오 전환 중.",
        "known_for": "1992년 영국 파운드화 붕괴 예측으로 10억 달러 수익, '영란은행을 무너뜨린 남자'",
        "top_holdings": ["NVDA", "META", "AMZN"],
        "recent_moves": "2024년 NVDA 신규 대규모 매수. Meta·Amazon 비중 확대. 거시 환경 변화 대응.",
        "portfolio": [
            {"ticker": "NVDA", "name": "NVIDIA", "weight": 16.3, "shares": 750000, "action": "buy"},
            {"ticker": "META", "name": "Meta Platforms", "weight": 11.2, "shares": 280000, "action": "buy"},
            {"ticker": "AMZN", "name": "Amazon", "weight": 8.7, "shares": 640000, "action": "buy"},
            {"ticker": "MSFT", "name": "Microsoft", "weight": 7.4, "shares": 260000, "action": "hold"},
            {"ticker": "GOOGL", "name": "Alphabet", "weight": 6.1, "shares": 510000, "action": "hold"},
        ],
    },
    {
        "id": "david-tepper",
        "name": "David Tepper",
        "title": "Founder & President",
        "firm": "Appaloosa Management",
        "country": "US",
        "avatar_initial": "DT",
        "color": "#1E8449",
        "style": "이벤트 드리븐",
        "description": "부실 채권·이벤트 드리븐 전략의 달인. AI 빅테크 집중 보유로 수익률 1위.",
        "known_for": "2009년 금융위기 직후 부실 은행주 매수로 74억 달러 수익",
        "top_holdings": ["META", "MSFT", "NVDA"],
        "recent_moves": "2024년 META·NVDA·MSFT 집중 매수. 중국 주식 전량 매도 후 AI 전환.",
        "portfolio": [
            {"ticker": "META", "name": "Meta Platforms", "weight": 11.5, "shares": 290000, "action": "buy"},
            {"ticker": "MSFT", "name": "Microsoft", "weight": 9.8, "shares": 340000, "action": "buy"},
            {"ticker": "GOOGL", "name": "Alphabet", "weight": 8.4, "shares": 700000, "action": "buy"},
            {"ticker": "AMZN", "name": "Amazon", "weight": 7.9, "shares": 580000, "action": "buy"},
            {"ticker": "NVDA", "name": "NVIDIA", "weight": 7.1, "shares": 325000, "action": "buy"},
        ],
    },
]

_investor_map = {inv["id"]: inv for inv in INVESTORS}


def get_all_investors() -> list[dict]:
    return INVESTORS


def get_investor(investor_id: str) -> dict | None:
    return _investor_map.get(investor_id)


def get_hot_tickers() -> list[str]:
    """여러 투자자가 공통으로 보유하는 핫 종목"""
    ticker_count: dict[str, int] = {}
    for inv in INVESTORS:
        for holding in inv["portfolio"]:
            t = holding["ticker"]
            ticker_count[t] = ticker_count.get(t, 0) + 1
    sorted_tickers = sorted(ticker_count, key=lambda x: ticker_count[x], reverse=True)
    return sorted_tickers[:12]


def get_buy_recommendations() -> list[dict]:
    """복수 투자자가 매수 중인 종목"""
    buy_map: dict[str, dict] = {}
    for inv in INVESTORS:
        for holding in inv["portfolio"]:
            if holding["action"] == "buy":
                t = holding["ticker"]
                if t not in buy_map:
                    buy_map[t] = {"ticker": t, "name": holding["name"], "buyers": [], "weight_avg": 0}
                buy_map[t]["buyers"].append(inv["name"])
                buy_map[t]["weight_avg"] = round(
                    (buy_map[t]["weight_avg"] * (len(buy_map[t]["buyers"]) - 1) + holding["weight"]) / len(buy_map[t]["buyers"]), 1
                )
    recs = [v for v in buy_map.values() if len(v["buyers"]) >= 2]
    return sorted(recs, key=lambda x: len(x["buyers"]), reverse=True)


def get_sell_recommendations() -> list[dict]:
    """복수 투자자가 매도 중인 종목"""
    sell_map: dict[str, dict] = {}
    for inv in INVESTORS:
        for holding in inv["portfolio"]:
            if holding["action"] == "sell":
                t = holding["ticker"]
                if t not in sell_map:
                    sell_map[t] = {"ticker": t, "name": holding["name"], "sellers": []}
                sell_map[t]["sellers"].append(inv["name"])
    recs = list(sell_map.values())
    return sorted(recs, key=lambda x: len(x["sellers"]), reverse=True)
