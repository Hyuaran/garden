-- ============================================================
-- Garden Bloom — Cron 実行ログ
--
-- Phase 1 運用での誤送信事故の検知・追跡に使用する二重防護の一要素。
-- 1 Cron 実行 1 行 or 送信先メッセージ単位で記録（本実装は後者）。
--
-- 前提: scripts/bloom-helper-functions.sql / bloom-schema.sql を適用済み
-- 適用: Supabase Dashboard > SQL Editor (garden-dev のみ)
-- ============================================================

CREATE TABLE IF NOT EXISTS bloom_cron_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_kind        text NOT NULL
                   CHECK (cron_kind IN ('daily','weekly','monthly','alert','manual')),
  executed_at      timestamptz NOT NULL DEFAULT now(),
  dry_run          boolean NOT NULL DEFAULT false,
  room_id          text,                                   -- 送信先 Chatwork ルーム ID（文字列保持）
  message_snapshot text,                                   -- 送信予定 / 実送信したメッセージ本文
  chatwork_response jsonb,                                 -- API 応答（message_id 等）
  status           text NOT NULL
                   CHECK (status IN ('pending','success','failure','skipped')),
  error_detail     text,                                   -- status='failure' 時のエラー内容
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bloom_cron_log_kind_executed_idx
  ON bloom_cron_log(cron_kind, executed_at DESC);
CREATE INDEX IF NOT EXISTS bloom_cron_log_status_idx
  ON bloom_cron_log(status) WHERE status IN ('failure','pending');

-- RLS: 閲覧は admin+、書き込みはサーバ（service role）のみ
ALTER TABLE bloom_cron_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bcl_read_admin ON bloom_cron_log;
CREATE POLICY bcl_read_admin ON bloom_cron_log
  FOR SELECT USING (bloom_has_access('admin'));

-- 注意: INSERT / UPDATE は Cron Route Handler で SUPABASE_SERVICE_ROLE_KEY を
-- 使用するため、通常ユーザの書き込みポリシーは意図的に定義しない。
-- service role は RLS をバイパスする。
