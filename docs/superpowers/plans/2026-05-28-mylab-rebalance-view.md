# My Lab 리밸런싱 적용 뷰 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6번모드 리밸런싱 추천(`analyses/*-rebalance.json`)을 My Lab 대시보드의 "적용" 뷰에서 현재 포트폴리오 위에 오버레이로 표시한다.

**Architecture:** stock78 git repo에 날짜별 rebalance JSON을 수동 push → 백엔드 `GET /mylab/rebalance`가 최신 1개 파싱 → 프론트 `RebalanceView`가 `/mylab/portfolio`와 조합해 테마 바(before→after) + 종목 액션 오버레이 + 보유종목 도넛 렌더.

**Tech Stack:** FastAPI(async, `_run()` 래핑), Next.js 16 + TypeScript, recharts ^3.8.0(도넛), GitHub API.

> 검증 주의: 이 프로젝트는 pytest 인프라가 없다. 백엔드는 `curl`로, 프론트는 `npm run build` + 브라우저로 검증한다. Next.js 16 breaking changes — 컴포넌트 작성 전 `node_modules/next/dist/docs/` 확인(AGENTS.md). 이모지 전면 금지.

---

### Task 1: 샘플 rebalance 분석 파일 생성 및 stock78 push

테스트 데이터부터 만든다. 이게 있어야 백엔드/프론트를 실제로 확인할 수 있다.

**Files:**
- Create (stock78 repo): `analyses/2026-05-28-rebalance.json`
- Create (stock78 repo): `analyses/2026-05-28-rebalance.md`

- [ ] **Step 1: JSON 파일 내용 작성** (스키마는 spec 기준, 실제 포트폴리오 종목 사용)

```json
{
  "date": "2026-05-28",
  "title": "리스크오프 대응 리밸런싱",
  "current_allocation": { "테크": 65, "우주": 15, "금": 0, "방어": 20 },
  "target_allocation":  { "테크": 50, "우주": 12, "금": 8, "방어": 30 },
  "actions": [
    { "ticker": "SOXX", "name": "iShares 반도체", "action": "trim", "weight_from": 9.1, "weight_to": 4.5, "reason": "빅테크 7중 중복 축소" },
    { "ticker": "XLK", "name": "기술주 ETF", "action": "trim", "weight_from": 4.5, "weight_to": 2.0, "reason": "QQQ와 중복 정리" },
    { "ticker": "VGT", "name": "기술주 ETF", "action": "sell", "weight_from": 2.8, "weight_to": 0, "reason": "XLK/QQQ와 완전 중복" },
    { "ticker": "ACE KRX금현물", "name": "금 현물 ETF", "action": "buy", "weight_from": 0, "weight_to": 8, "reason": "안전판 0% → 편입" }
  ]
}
```

- [ ] **Step 2: 사람용 MD 파일 작성** (히스토리 뷰어용, 간단 요약)

```markdown
# 리밸런싱 — 2026-05-28

리스크오프 대응. 테크 65%→50%, 금 0%→8% 신규 편입.

- SOXX 일부 매도 (9.1%→4.5%): 빅테크 7중 중복 축소
- VGT 전량 매도: XLK/QQQ와 완전 중복
- ACE KRX금현물 신규 8%: 안전판 편입
```

- [ ] **Step 3: stock78에 push**

```bash
# stock78를 임시 클론하거나 gh api로 직접 생성. gh api 방식:
cd /tmp && gh repo clone forexms78/stock78 stock78-tmp && cd stock78-tmp
mkdir -p analyses
# 위 두 파일을 analyses/에 작성 후
git add analyses/2026-05-28-rebalance.json analyses/2026-05-28-rebalance.md
git commit -m "analysis: 2026-05-28 리밸런싱 추천 (6번모드)"
git push
```

- [ ] **Step 4: 검증** — `gh api repos/forexms78/stock78/contents/analyses/2026-05-28-rebalance.json --jq '.name'` 이 파일명을 반환하면 성공.

---

### Task 2: 백엔드 `get_latest_rebalance()` + 엔드포인트

**Files:**
- Modify: `backend/services/mylab.py` (파일 끝에 함수 추가)
- Modify: `backend/api/main.py` (snapshots 엔드포인트 근처에 추가)

- [ ] **Step 1: `mylab.py`에 함수 추가** (파일 맨 끝)

```python
import json as _json


def get_latest_rebalance() -> dict:
    """analyses/ 폴더에서 최신 *-rebalance.json 1개를 파싱해 반환. 없으면 {'exists': False}."""
    files = _fetch_md_files(ANALYSES_PATH)  # .md만 반환하므로 json은 별도 조회
    # analyses 폴더 전체 목록을 다시 받아 .json 필터
    url = f"https://api.github.com/repos/{REPO}/contents/{ANALYSES_PATH}?ref={BRANCH}"
    try:
        r = _requests.get(url, headers=_headers(), timeout=10)
        if r.status_code == 404:
            return {"exists": False}
        r.raise_for_status()
        items = r.json()
    except Exception as e:
        print(f"[mylab] get_latest_rebalance 목록 오류: {e}")
        return {"exists": False}

    json_files = sorted(
        [it for it in items if it.get("type") == "file" and it["name"].endswith("-rebalance.json")],
        key=lambda x: x["name"], reverse=True,
    )
    if not json_files:
        return {"exists": False}

    target = json_files[0]
    try:
        cr = _requests.get(target["url"], headers=_headers(), timeout=10)
        cr.raise_for_status()
        raw = cr.json().get("content", "")
        content = base64.b64decode(raw).decode("utf-8")
        data = _json.loads(content)
        data["exists"] = True
        data["filename"] = target["name"]
        return data
    except Exception as e:
        print(f"[mylab] get_latest_rebalance 파싱 오류: {e}")
        return {"exists": False}
```

- [ ] **Step 2: `main.py`에 엔드포인트 추가** (`/mylab/snapshots` 정의 위/아래 근처)

```python
@app.get("/mylab/rebalance")
async def mylab_rebalance():
    """최신 리밸런싱 추천 JSON 반환 (없으면 exists: false)"""
    from backend.services.mylab import get_latest_rebalance
    return await _run(get_latest_rebalance)
```

- [ ] **Step 3: 백엔드 로컬 실행 후 검증**

```bash
cd /Users/bhpark/code/whalyx && python3 -m uvicorn backend.api.main:app --port 8000 &
sleep 3
curl -s localhost:8000/mylab/rebalance | python3 -m json.tool
```
Expected: `"exists": true`, `actions` 배열에 SOXX/XLK/VGT/ACE 4개, `target_allocation` 포함.

- [ ] **Step 4: 커밋**

```bash
git add backend/services/mylab.py backend/api/main.py
git commit -m "feat(mylab): 리밸런싱 추천 JSON 파싱 엔드포인트 추가"
```

---

### Task 3: 프론트 타입 + fetch + "적용" 토글 추가

**Files:**
- Modify: `frontend/components/MyLabSection.tsx`

- [ ] **Step 1: 타입 추가** (기존 인터페이스 블록 근처)

```typescript
type MainView = "portfolio" | "rebalance" | "history";

interface RebalanceAction {
  ticker: string;
  name: string;
  action: "sell" | "trim" | "buy" | "hold";
  weight_from: number;
  weight_to: number;
  reason: string;
}
interface RebalanceData {
  exists: boolean;
  date?: string;
  title?: string;
  filename?: string;
  current_allocation?: Record<string, number>;
  target_allocation?: Record<string, number>;
  actions?: RebalanceAction[];
}
```

- [ ] **Step 2: 토글 버튼 배열에 "적용" 추가** (기존 `[["portfolio","현재"],["history","히스토리"]]` 부분)

```typescript
{([["portfolio", "현재"], ["rebalance", "적용"], ["history", "히스토리"]] as [MainView, string][]).map(([id, label]) => (
```

- [ ] **Step 3: rebalance 분기 렌더 추가** (기존 `mainView === "history" ? <SnapshotHistoryView /> : (...)` 조건을 3분기로)

```typescript
{mainView === "history" ? (
  <SnapshotHistoryView />
) : mainView === "rebalance" ? (
  <RebalanceView portfolio={portfolio} />
) : (
  <> ...기존 현재 뷰... </>
)}
```

- [ ] **Step 4: 빌드 확인** — `cd frontend && npm run build` → 타입 에러 없이 통과 (RebalanceView는 다음 태스크에서 정의하므로 임시 스텁 `function RebalanceView(_:{portfolio:PortfolioData}){return null;}` 추가 후 빌드).

- [ ] **Step 5: 커밋** — `git add frontend/components/MyLabSection.tsx && git commit -m "feat(mylab): 적용 뷰 토글 + 타입 추가"`

---

### Task 4: `RebalanceView` + `ThemeAllocationBar` (테마 before→after)

**Files:**
- Modify: `frontend/components/MyLabSection.tsx`

- [ ] **Step 1: `ThemeAllocationBar` 컴포넌트 작성**

```typescript
const THEME_COLORS: Record<string, string> = {
  "테크": "#10b981", "우주": "#f59e0b", "금": "#eab308", "방어": "#3b82f6", "기타": "#6b7280",
};

function ThemeAllocationBar({ current, target }: { current: Record<string, number>; target: Record<string, number> }) {
  const themes = Array.from(new Set([...Object.keys(current), ...Object.keys(target)]));
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>테마 비중 변화 (적용 전 → 후)</div>
      {themes.map(th => {
        const from = current[th] ?? 0, to = target[th] ?? 0;
        const arrow = to > from ? "↑" : to < from ? "↓" : "=";
        const col = THEME_COLORS[th] || "#6b7280";
        return (
          <div key={th} style={{ display: "grid", gridTemplateColumns: "60px 1fr 90px", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{th}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ height: 8, width: `${from}%`, background: `${col}66`, borderRadius: 4 }} />
              <span style={{ color: "var(--text-muted)" }}>→</span>
              <div style={{ height: 8, width: `${to}%`, background: col, borderRadius: 4 }} />
            </div>
            <span style={{ textAlign: "right", color: "var(--text-secondary)" }}>{from}% → {to}% {arrow}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `RebalanceView` 스텁을 실제 구현으로 교체** (fetch + 빈 상태 처리)

```typescript
function RebalanceView({ portfolio }: { portfolio: PortfolioData }) {
  const [reb, setReb] = useState<RebalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/mylab/rebalance`).then(r => r.json()).then(setReb).catch(() => setReb({ exists: false })).finally(() => setLoading(false));
  }, []);
  if (loading) return <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>...</div>;
  if (!reb?.exists) return <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>아직 6번모드 분석이 없습니다</div>;
  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{reb.title}</span>
        <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>{reb.date} 기준</span>
      </div>
      {reb.current_allocation && reb.target_allocation && (
        <ThemeAllocationBar current={reb.current_allocation} target={reb.target_allocation} />
      )}
      <ActionList actions={reb.actions || []} portfolio={portfolio} />
      <HoldingDonut portfolio={portfolio} />
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인** — `ActionList`/`HoldingDonut`는 다음 태스크. 임시 스텁 추가 후 `npm run build` 통과 확인.

- [ ] **Step 4: 커밋** — `git commit -am "feat(mylab): 테마 비중 before→after 바 + RebalanceView"`

---

### Task 5: `ActionList` — 종목 액션 오버레이 (매도 빗금 / 매수 초록행)

**Files:**
- Modify: `frontend/components/MyLabSection.tsx`

- [ ] **Step 1: `ActionList` 구현** (현재 보유 종목에 액션 매칭 + 신규 매수 추가행)

```typescript
const ACTION_LABEL: Record<string, string> = { sell: "전량매도", trim: "일부매도", buy: "신규매수", hold: "유지" };

function ActionList({ actions, portfolio }: { actions: RebalanceAction[]; portfolio: PortfolioData }) {
  // 현재 보유 종목 평탄화
  const held = portfolio.sections.flatMap(s => s.holdings);
  const sellTrim = actions.filter(a => a.action === "sell" || a.action === "trim");
  const buys = actions.filter(a => a.action === "buy");
  const sellTickers = new Set(sellTrim.map(a => a.ticker));

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>종목별 액션</div>
      {held.map((h, i) => {
        const act = sellTrim.find(a => a.ticker === h.ticker);
        const hatch = act ? { backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 6px, var(--red) 6px, var(--red) 7px)", backgroundColor: "var(--red)08" } : {};
        return (
          <div key={`${h.ticker}-${i}`} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1.2fr 1.3fr", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, ...hatch }}>
            <div><span style={{ fontWeight: 700 }}>{h.name}</span> <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "monospace" }}>{h.ticker}</span></div>
            <div style={{ textAlign: "right", color: "var(--text-secondary)" }}>{h.qty % 1 === 0 ? h.qty : h.qty.toFixed(2)}</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>{fmtFull(h.value)}</div>
            <div style={{ textAlign: "right", fontWeight: 700, color: act ? "var(--red)" : "var(--text-muted)" }}>
              {act ? `${ACTION_LABEL[act.action]} ${act.weight_from}%→${act.weight_to}%` : "유지"}
            </div>
          </div>
        );
      })}
      {/* 신규 매수 추가행 */}
      {buys.map((a, i) => (
        <div key={`buy-${i}`} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1.2fr 1.3fr", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, border: "1px solid var(--green)", borderRadius: 6, margin: "4px 8px", background: "var(--green)0a" }}>
          <div><span style={{ fontWeight: 700 }}>{a.name}</span> <span style={{ fontSize: 11, color: "var(--green)", fontFamily: "monospace" }}>{a.ticker}</span> <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, marginLeft: 4 }}>신규</span></div>
          <div />
          <div style={{ textAlign: "right", color: "var(--text-muted)", fontSize: 11 }}>목표 {a.weight_to}%</div>
          <div style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>신규매수</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인** — `npm run build` 통과.

- [ ] **Step 3: 커밋** — `git commit -am "feat(mylab): 종목 액션 오버레이(매도 빗금/매수 초록행)"`

---

### Task 6: `HoldingDonut` — 보유종목 비중 도넛 (recharts)

**Files:**
- Modify: `frontend/components/MyLabSection.tsx`

- [ ] **Step 1: recharts import 추가** (파일 상단)

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
```

- [ ] **Step 2: `HoldingDonut` 구현** (전체 보유종목을 평가금 비중으로, 상위 8개 + 기타)

```typescript
const DONUT_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#eab308", "#ef4444", "#06b6d4", "#ec4899", "#6b7280"];

function HoldingDonut({ portfolio }: { portfolio: PortfolioData }) {
  const held = portfolio.sections.flatMap(s => s.holdings).sort((a, b) => b.value - a.value);
  const top = held.slice(0, 8).map(h => ({ name: h.name, value: h.value }));
  const restVal = held.slice(8).reduce((s, h) => s + h.value, 0);
  const data = restVal > 0 ? [...top, { name: "기타", value: restVal }] : top;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>보유종목 비중</div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `${fmtKrw(v)}원`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인** — `npm run build` 통과.

- [ ] **Step 4: 커밋** — `git commit -am "feat(mylab): 보유종목 비중 도넛 차트"`

---

### Task 7: 통합 브라우저 검증 + 버전 갱신 + push

**Files:**
- Modify: `README.md` (버전 히스토리)
- Modify: `frontend/package.json` 또는 버전 표기 위치 (프로젝트 관습 따름)

- [ ] **Step 1: 로컬 풀스택 실행**

```bash
cd /Users/bhpark/code/whalyx && python3 -m uvicorn backend.api.main:app --port 8000 &
cd frontend && npm run dev
```

- [ ] **Step 2: 브라우저 수동 검증** — My Lab 진입(비밀번호) → "적용" 토글 클릭. 확인 항목:
  - 테마 바가 테크 65%→50%, 금 0%→8% 표시
  - SOXX/XLK 빨강 빗금, VGT 빗금
  - ACE KRX금현물 초록 테두리 추가행 "신규매수"
  - 도넛이 보유종목 비중 표시
  - "현재"/"히스토리" 탭 정상 동작(회귀 없음)

- [ ] **Step 3: README 버전 히스토리 갱신** (versioning 정책 — push 전 필수). 새 버전 줄 추가: "My Lab 리밸런싱 적용 뷰 — 6번모드 analyses/ JSON 연동, 테마 before→after 바, 종목 액션 오버레이, 보유종목 도넛".

- [ ] **Step 4: 커밋 + push**

```bash
git add README.md frontend/components/MyLabSection.tsx
git commit -m "feat(mylab): 리밸런싱 적용 뷰 vX.X"
git push origin main
```

Expected: Render(BE) + Vercel(FE) 자동 배포.

---

## Self-Review

- **Spec coverage:** 데이터흐름(T1,T2) / JSON스키마(T1) / 백엔드 엔드포인트(T2) / 토글(T3) / 테마바(T4) / 액션오버레이(T5) / 도넛(T6) — 전 항목 태스크 존재.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. 스텁은 명시적으로 "다음 태스크에서 교체"로 표기.
- **Type consistency:** `RebalanceData`/`RebalanceAction`(T3) → T4·T5에서 동일 필드(`current_allocation`, `actions`, `weight_from/to`, `action`) 사용. `MainView`에 `"rebalance"` 추가(T3) → 토글·분기(T3) 일치.
