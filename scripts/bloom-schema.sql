-- ============================================================
-- Garden Bloom — Supabase Schema
-- Workboard / Roadmap / 月次ダイジェスト / 日次ログ / Chatwork 連携
--
-- 前提: scripts/bloom-helper-functions.sql を先に適用済みであること
-- RLS:  scripts/bloom-rls.sql を後続で適用すること
--
-- Run in: Supabase Dashboard > SQL Editor (garden-dev のみ)
-- 関連設計書: docs/specs/2026-04-24-bloom-workboard-design.md
-- ============================================================

-- Chatwork API トークンの暗号化用（§10.3 判1: pgcrypto で DB 内完結）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. enum 定義（4 個）
-- ============================================================

-- 個人ステータス（auto モード隠蔽済の一般業務用語）
DO $$ BEGIN
  CREATE TYPE bloom_worker_status_kind AS ENUM (
    'available',   -- 🟢 対応可能（質問・依頼OK）
    'busy_light',  -- 🟡 取り込み中（電話可、メッセは後回し）
    'focus',       -- 🔴 集中業務中（緊急以外NG）
    'away'         -- ⚪ 外出中（翌日以降）
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ロードマップのエントリ種別
DO $$ BEGIN
  CREATE TYPE bloom_roadmap_entry_kind AS ENUM (
    'phase',      -- Phase A / B / C / D
    'milestone',  -- 主要マイルストーン
    'module',     -- 個別モジュール進捗
    'risk',       -- リスクカード
    'banner'      -- お知らせ（遅延・変更アラート）
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 月次ダイジェスト状態
DO $$ BEGIN
  CREATE TYPE bloom_monthly_digest_status AS ENUM (
    'draft',      -- 編集中
    'published',  -- 会議配布可
    'archived'    -- 過去分
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chatwork 通知種別
DO $$ BEGIN
  CREATE TYPE bloom_chatwork_kind AS ENUM (
    'daily',      -- 18:00 日次
    'weekly',     -- 金 18:00 週次
    'monthly',    -- 14日 18:00 月次ダイジェスト
    'alert'       -- 随時（PRマージ・Phase完了・スケジュール変更）
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 2. テーブル定義（7 個）
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 bloom_worker_status: 個人の現在ステータス（1 社員 1 行、upsert で更新）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloom_worker_status (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status      bloom_worker_status_kind NOT NULL DEFAULT 'available',
  status_note text,                                       -- 自由記述（「顧客打合せ中」等）
  until       timestamptz,                                -- 予想復帰時刻
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id)              -- 代理更新対応
);

CREATE INDEX IF NOT EXISTS bloom_worker_status_updated_idx
  ON bloom_worker_status(updated_at DESC);

-- ------------------------------------------------------------
-- 2.2 bloom_daily_logs: 日次作業ログ（1 ユーザー × 1 日 = 1 行）
-- 既存 send_report.py 日報（個人ルーム）と共存。Bloom は別テーブル／別ルーム。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloom_daily_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date        date NOT NULL,
  planned_items   jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{title, estimate_min, done_bool}]
  completed_items jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{title, actual_min, notes}]
  next_steps      jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{title, target_date}]
  highlights      text,
  hours_logged    numeric(4,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS bloom_daily_logs_user_date_idx
  ON bloom_daily_logs(user_id, log_date DESC);

-- ------------------------------------------------------------
-- 2.3 bloom_roadmap_entries: ロードマップのエントリ
-- Phase / Milestone / Module / Risk / Banner を統一テーブルで管理
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloom_roadmap_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            bloom_roadmap_entry_kind NOT NULL,
  parent_id       uuid REFERENCES bloom_roadmap_entries(id) ON DELETE CASCADE,
  sort_order      int NOT NULL DEFAULT 0,
  label_dev       text NOT NULL,                          -- ⚙️開発向け: "Phase A / Bud Phase 1b.2"
  label_ops       text,                                   -- 👥みんな向け: "経理ソフト構築"
  description     text,
  target_month    text,                                   -- "M1" 〜 "M8"
  starts_on       date,
  due_on          date,
  completed_on    date,
  progress_pct    int CHECK (progress_pct BETWEEN 0 AND 100),
  banner_severity text CHECK (banner_severity IN ('info','warn','critical')),
  is_archived     bool NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bloom_roadmap_kind_idx
  ON bloom_roadmap_entries(kind, sort_order);
CREATE INDEX IF NOT EXISTS bloom_roadmap_parent_idx
  ON bloom_roadmap_entries(parent_id, sort_order);

-- ------------------------------------------------------------
-- 2.4 bloom_project_progress: プロジェクト別進捗率（週次スナップショット）
-- 時系列グラフ描画用
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloom_project_progress (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_entry_id uuid NOT NULL REFERENCES bloom_roadmap_entries(id) ON DELETE CASCADE,
  snapshot_on      date NOT NULL,                         -- 週次（月曜 or 金曜固定）
  progress_pct     int NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roadmap_entry_id, snapshot_on)
);

CREATE INDEX IF NOT EXISTS bloom_project_progress_entry_idx
  ON bloom_project_progress(roadmap_entry_id, snapshot_on DESC);

-- ------------------------------------------------------------
-- 2.5 bloom_module_progress: Garden 9 モジュールの現在進捗（UI 高速化用メタ）
-- roadmap_entries.kind='module' と二重持ちだが集計クエリ回避で別持ち
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloom_module_progress (
  module_code     text PRIMARY KEY CHECK (
    module_code IN ('soil','root','tree','leaf','bud','bloom','forest','rill','seed')
  ),
  label_dev       text NOT NULL,                          -- "Garden-Bud"
  label_ops       text NOT NULL,                          -- "経理ソフト"
  phase_label     text,                                   -- "Phase 1b.2 Task 5/13"
  progress_pct    int NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  status          text CHECK (status IN ('planned','in_progress','at_risk','done')),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  last_commit_sha text,
  last_commit_at  timestamptz,
  display_order   int NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- 2.6 bloom_monthly_digests: 月次ダイジェスト（メタ + pages jsonb）
-- 毎月15-20日の責任者会議用。pages は DigestPage[] 型運用（§10.3 判3）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloom_monthly_digests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_month  date NOT NULL,                            -- 月の 1 日（2026-05-01 等）
  status        bloom_monthly_digest_status NOT NULL DEFAULT 'draft',
  title         text NOT NULL,                            -- "2026年5月 Garden 進捗"
  summary       text,                                     -- 冒頭コメント
  pages         jsonb NOT NULL DEFAULT '[]'::jsonb,       -- DigestPage[]
  published_at  timestamptz,
  published_by  uuid REFERENCES auth.users(id),
  pdf_url       text,                                     -- Supabase Storage URL
  image_urls    jsonb,                                    -- ページ別画像（Chatwork 貼付用）
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (digest_month)
);

CREATE INDEX IF NOT EXISTS bloom_monthly_digests_month_idx
  ON bloom_monthly_digests(digest_month DESC);

-- ------------------------------------------------------------
-- 2.7 bloom_chatwork_config: Chatwork API トークン / ルーム ID（単一行）
-- api_token は pgcrypto で暗号化保存（§10.3 判1）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloom_chatwork_config (
  id               int PRIMARY KEY CHECK (id = 1),        -- 単一行強制
  api_token        text,                                  -- pgcrypto で暗号化推奨
  room_id_progress text,                                  -- "Garden開発進捗" ルーム ID
  room_id_alert    text,                                  -- 重要アラート用
  enabled          bool NOT NULL DEFAULT false,           -- Cron 配信 ON/OFF
  last_success_at  timestamptz,
  last_error       text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id)
);
