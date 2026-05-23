-- ─────────────────────────────────────────────────────────────
-- AI 추천 회고 시스템 — v2.7
-- 실행 위치: Supabase 콘솔 > SQL Editor
-- 1B (양수면 적중) + 2B (프롬프트 주입 + raw_score 페널티) 채택
-- ─────────────────────────────────────────────────────────────

-- 1. 추천 스냅샷
-- today_picks 생성 시점의 가격·근거·점수를 보존.
-- hit_*d 컬럼은 매일 새벽 스케줄러가 채움.
CREATE TABLE IF NOT EXISTS prediction_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  snapshot_date   DATE        NOT NULL,
  ticker          TEXT        NOT NULL,
  pick_type       TEXT        NOT NULL CHECK (pick_type IN ('buy', 'sell', 'watch')),
  entry_price     NUMERIC     NOT NULL,
  momentum_30d    NUMERIC,
  sentiment       NUMERIC,
  volume_ratio    NUMERIC,
  raw_score       NUMERIC,
  ai_reason       TEXT,
  -- 검증 결과 (NULL = 미검증)
  price_1d        NUMERIC,
  ret_1d          NUMERIC,
  hit_1d          BOOLEAN,
  price_7d        NUMERIC,
  ret_7d          NUMERIC,
  hit_7d          BOOLEAN,
  price_30d       NUMERIC,
  ret_30d         NUMERIC,
  hit_30d         BOOLEAN,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (snapshot_date, ticker, pick_type)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_date
  ON prediction_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshot_ticker
  ON prediction_snapshots(ticker);
CREATE INDEX IF NOT EXISTS idx_snapshot_pending_1d
  ON prediction_snapshots(snapshot_date) WHERE hit_1d IS NULL;
CREATE INDEX IF NOT EXISTS idx_snapshot_pending_7d
  ON prediction_snapshots(snapshot_date) WHERE hit_7d IS NULL;
CREATE INDEX IF NOT EXISTS idx_snapshot_pending_30d
  ON prediction_snapshots(snapshot_date) WHERE hit_30d IS NULL;

-- 2. 실패 분석
-- 빗나간 추천에 대해 Gemini가 생성한 회고.
-- active=true 항목만 다음 today_picks 프롬프트에 주입됨.
CREATE TABLE IF NOT EXISTS failure_analyses (
  id                 BIGSERIAL PRIMARY KEY,
  snapshot_id        BIGINT      NOT NULL REFERENCES prediction_snapshots(id) ON DELETE CASCADE,
  analyzed_at        TIMESTAMPTZ DEFAULT NOW(),
  horizon            TEXT        NOT NULL CHECK (horizon IN ('1d', '7d', '30d')),
  failure_category   TEXT        NOT NULL,
  root_cause         TEXT        NOT NULL,
  avoid_rule         TEXT        NOT NULL,
  severity           INT         CHECK (severity BETWEEN 1 AND 5),
  active             BOOLEAN     DEFAULT TRUE,
  UNIQUE (snapshot_id, horizon)
);

CREATE INDEX IF NOT EXISTS idx_failure_active
  ON failure_analyses(active, analyzed_at DESC) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_failure_category
  ON failure_analyses(failure_category);

-- 3. 적중률 주간 집계 뷰 (선택적, 차트 쿼리 단순화)
CREATE OR REPLACE VIEW v_weekly_hit_rate AS
SELECT
  DATE_TRUNC('week', snapshot_date)::date AS week_start,
  COUNT(*) FILTER (WHERE hit_1d  IS NOT NULL)                          AS total_1d,
  COUNT(*) FILTER (WHERE hit_1d  = TRUE)                               AS win_1d,
  COUNT(*) FILTER (WHERE hit_7d  IS NOT NULL)                          AS total_7d,
  COUNT(*) FILTER (WHERE hit_7d  = TRUE)                               AS win_7d,
  COUNT(*) FILTER (WHERE hit_30d IS NOT NULL)                          AS total_30d,
  COUNT(*) FILTER (WHERE hit_30d = TRUE)                               AS win_30d,
  ROUND(AVG(ret_7d) FILTER (WHERE ret_7d IS NOT NULL)::numeric, 2)     AS avg_ret_7d
FROM prediction_snapshots
GROUP BY 1
ORDER BY 1 DESC;
