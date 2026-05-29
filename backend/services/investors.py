"""
전문 투자자 데이터 — SEC 13F 공개 포트폴리오 기준 (2026 Q1, 2026-05-15 제출분)
실제 공개 포트폴리오를 보유한 8인의 전문 투자자.

주의: weight(비중)·action(증감)은 13F 공시 기반.
      shares(주식수)는 13F 총액 × 비중 ÷ 현재가 근사치 (표시용, 정확치 아님).
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
        "recent_moves": "2026 Q1 기준 AAPL 최대 비중 유지, BAC 지속 축소, CVX·OXY 등 에너지 비중 확대. 현금성 자산 약 $397B로 사상 최고.",
        "portfolio": [
            {"ticker": "AAPL", "name": "Apple",                "weight": 22.0, "shares": 252000000, "action": "hold"},
            {"ticker": "AXP",  "name": "American Express",      "weight": 17.4, "shares": 152500000, "action": "hold"},
            {"ticker": "KO",   "name": "Coca-Cola",             "weight": 11.6, "shares": 435800000, "action": "hold"},
            {"ticker": "BAC",  "name": "Bank of America",       "weight": 9.5,  "shares": 555000000, "action": "sell"},
            {"ticker": "CVX",  "name": "Chevron",               "weight": 6.6,  "shares": 112000000, "action": "buy"},
            {"ticker": "OXY",  "name": "Occidental Petroleum",  "weight": 4.5,  "shares": 263000000, "action": "buy"},
            {"ticker": "MCO",  "name": "Moody's",               "weight": 4.0,  "shares": 21900000,  "action": "hold"},
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
        "top_holdings": ["TSLA", "COIN", "AMD"],
        "recent_moves": "2026 Q1 TSLA 일부 차익실현, COIN·AMD·CRSP 추가매수. AI·게놈·핀테크 테마 비중 강화.",
        "portfolio": [
            {"ticker": "TSLA", "name": "Tesla",                 "weight": 9.8, "shares": 3700000,  "action": "sell"},
            {"ticker": "COIN", "name": "Coinbase",              "weight": 8.2, "shares": 3500000,  "action": "buy"},
            {"ticker": "AMD",  "name": "Advanced Micro Devices","weight": 5.5, "shares": 3900000,  "action": "buy"},
            {"ticker": "CRSP", "name": "CRISPR Therapeutics",   "weight": 5.0, "shares": 12900000, "action": "buy"},
            {"ticker": "SHOP", "name": "Shopify",               "weight": 4.8, "shares": 5600000,  "action": "hold"},
            {"ticker": "PLTR", "name": "Palantir",              "weight": 4.5, "shares": 7200000,  "action": "hold"},
            {"ticker": "ROKU", "name": "Roku",                  "weight": 4.0, "shares": 6850000,  "action": "hold"},
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
        "style": "역발상·집중",
        "description": "'빅쇼트' 주인공. 군중과 반대 방향으로 투자. 소수 종목 초집중.",
        "known_for": "2008 서브프라임 위기 예측·공매도로 수억 달러 수익",
        "top_holdings": ["MOH", "LULU", "SLM"],
        "recent_moves": "최신 공시 기준 MOH·LULU·SLM·BRKR 4종목 초집중. 헬스케어·소비재 역발상 베팅 (풋옵션 별도).",
        "portfolio": [
            {"ticker": "MOH",  "name": "Molina Healthcare",     "weight": 35.1, "shares": 80000,  "action": "buy"},
            {"ticker": "LULU", "name": "Lululemon Athletica",   "weight": 26.1, "shares": 52000,  "action": "buy"},
            {"ticker": "SLM",  "name": "SLM Corp (Sallie Mae)", "weight": 19.5, "shares": 442000, "action": "buy"},
            {"ticker": "BRKR", "name": "Bruker",                "weight": 19.3, "shares": 291000, "action": "buy"},
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
        "top_holdings": ["SPY", "IJR", "AMZN"],
        "recent_moves": "2026 Q1 SPY·IJR 분산 유지, TSM·GOOG·NUE 신규 편입. CRM·WDAY·NOW 청산.",
        "portfolio": [
            {"ticker": "SPY",  "name": "SPDR S&P 500 ETF",        "weight": 12.7, "shares": 4740000,  "action": "hold"},
            {"ticker": "IJR",  "name": "iShares Core S&P SmallCap","weight": 7.8, "shares": 14600000, "action": "hold"},
            {"ticker": "AMZN", "name": "Amazon",                  "weight": 3.5,  "shares": 3560000,  "action": "hold"},
            {"ticker": "TSM",  "name": "Taiwan Semiconductor",    "weight": 3.0,  "shares": 3540000,  "action": "buy"},
            {"ticker": "GOOG", "name": "Alphabet",                "weight": 2.8,  "shares": 3300000,  "action": "buy"},
            {"ticker": "NUE",  "name": "Nucor",                   "weight": 2.2,  "shares": 3520000,  "action": "buy"},
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
        "description": "소로스 펀드 전 수석 매니저. AI·바이오 메가트렌드 초기 포착의 명수.",
        "known_for": "1992년 영국 파운드화 공매도 성공, NVDA 초기 대규모 매수",
        "top_holdings": ["NTRA", "EWZ", "INSM"],
        "recent_moves": "2026 Q1 NTRA 최대 비중, AVGO 신규·YPF 4배·STM 3배 확대. GOOGL·XLF·DAL·AAL 청산.",
        "portfolio": [
            {"ticker": "NTRA", "name": "Natera",                 "weight": 18.1, "shares": 3620000, "action": "hold"},
            {"ticker": "EWZ",  "name": "iShares MSCI Brazil ETF","weight": 8.7,  "shares": 9860000, "action": "hold"},
            {"ticker": "INSM", "name": "Insmed",                 "weight": 5.6,  "shares": 2380000, "action": "buy"},
            {"ticker": "TSM",  "name": "Taiwan Semiconductor",   "weight": 5.0,  "shares": 895000,  "action": "buy"},
            {"ticker": "RSP",  "name": "Invesco S&P 500 EW ETF", "weight": 4.7,  "shares": 864000,  "action": "hold"},
            {"ticker": "YPF",  "name": "YPF SA",                 "weight": 2.0,  "shares": 1700000, "action": "buy"},
            {"ticker": "AVGO", "name": "Broadcom",               "weight": 1.8,  "shares": 255000,  "action": "buy"},
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
        "top_holdings": ["BN", "AMZN", "UBER"],
        "recent_moves": "2026 Q1 MSFT 신규 대규모 편입, AMZN 확대. Hilton 전량 청산, Alphabet 95% 축소. 5종목이 70% 초집중.",
        "portfolio": [
            {"ticker": "BN",   "name": "Brookfield Corp",        "weight": 17.6, "shares": 40200000, "action": "hold"},
            {"ticker": "AMZN", "name": "Amazon",                 "weight": 17.4, "shares": 10830000, "action": "buy"},
            {"ticker": "UBER", "name": "Uber Technologies",      "weight": 15.7, "shares": 26900000, "action": "hold"},
            {"ticker": "MSFT", "name": "Microsoft",              "weight": 15.3, "shares": 4880000,  "action": "buy"},
            {"ticker": "QSR",  "name": "Restaurant Brands Intl", "weight": 12.2, "shares": 23870000, "action": "hold"},
            {"ticker": "HHH",  "name": "Howard Hughes Holdings", "weight": 6.0,  "shares": 10900000, "action": "hold"},
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
        "description": "재귀성 이론 기반 글로벌 매크로 투자. 빅테크 롱과 헤지(풋) 병행.",
        "known_for": "1992년 영국 파운드화 붕괴 예측으로 10억 달러 수익, '영란은행을 무너뜨린 남자'",
        "top_holdings": ["AMZN", "GPN", "NVDA"],
        "recent_moves": "2026 Q1 AMZN·NVDA 등 빅테크 롱 유지, GPN·EA·BILL 보유. SPY·XLE 풋옵션으로 시장 헤지 병행.",
        "portfolio": [
            {"ticker": "AMZN", "name": "Amazon",                 "weight": 5.0, "shares": 2070000, "action": "buy"},
            {"ticker": "GPN",  "name": "Global Payments",        "weight": 3.0, "shares": 2490000, "action": "hold"},
            {"ticker": "NVDA", "name": "NVIDIA",                 "weight": 2.5, "shares": 1270000, "action": "buy"},
            {"ticker": "EA",   "name": "Electronic Arts",        "weight": 2.5, "shares": 1425000, "action": "hold"},
            {"ticker": "BILL", "name": "BILL Holdings",          "weight": 2.0, "shares": 3320000, "action": "hold"},
            {"ticker": "SPOT", "name": "Spotify",                "weight": 2.0, "shares": 304000,  "action": "hold"},
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
        "description": "부실 채권·이벤트 드리븐 전략의 달인. AI 빅테크·반도체 집중 보유.",
        "known_for": "2009년 금융위기 직후 부실 은행주 매수로 74억 달러 수익",
        "top_holdings": ["AMZN", "MU", "GOOG"],
        "recent_moves": "2026 Q1 AMZN +98%·UBER +242% 대량 추가, 마이크론(MU) 비중 확대. SanDisk 신규. AAL·OC·MHK 청산.",
        "portfolio": [
            {"ticker": "AMZN", "name": "Amazon",                 "weight": 15.2, "shares": 4080000, "action": "buy"},
            {"ticker": "MU",   "name": "Micron Technology",      "weight": 9.5,  "shares": 5090000, "action": "hold"},
            {"ticker": "GOOG", "name": "Alphabet",               "weight": 8.4,  "shares": 2610000, "action": "hold"},
            {"ticker": "UBER", "name": "Uber Technologies",      "weight": 7.7,  "shares": 5680000, "action": "buy"},
            {"ticker": "TSM",  "name": "Taiwan Semiconductor",   "weight": 7.6,  "shares": 2360000, "action": "buy"},
            {"ticker": "SNDK", "name": "SanDisk",                "weight": 3.0,  "shares": 3540000, "action": "buy"},
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


def _collect_by_action(action: str, names_key: str) -> list[dict]:
    """해당 action(buy/sell) 종목을 집계 — 보유자(이름·소속사·비중·주식수·색) 명세 포함.
    1인부터 모두 포함하며 보유자 수(count) → 비중합 순으로 정렬."""
    by_ticker: dict[str, dict] = {}
    for inv in INVESTORS:
        for holding in inv["portfolio"]:
            if holding["action"] != action:
                continue
            t = holding["ticker"]
            if t not in by_ticker:
                by_ticker[t] = {"ticker": t, "name": holding["name"], names_key: [], "holders": []}
            by_ticker[t][names_key].append(inv["name"])
            by_ticker[t]["holders"].append({
                "name":   inv["name"],
                "firm":   inv["firm"],
                "color":  inv["color"],
                "weight": holding["weight"],
                "shares": holding["shares"],
            })
    recs = list(by_ticker.values())
    for r in recs:
        r["count"] = len(r["holders"])
    return sorted(
        recs,
        key=lambda x: (x["count"], sum(h["weight"] for h in x["holders"])),
        reverse=True,
    )


def get_buy_recommendations() -> list[dict]:
    """투자자들이 매수 중인 종목 — 보유자 명세 포함 (1인부터)."""
    return _collect_by_action("buy", "buyers")


def get_sell_recommendations() -> list[dict]:
    """투자자들이 매도 중인 종목 — 보유자 명세 포함 (1인부터)."""
    return _collect_by_action("sell", "sellers")
