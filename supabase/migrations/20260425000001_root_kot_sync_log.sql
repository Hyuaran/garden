-- ============================================================
-- Garden Root — KoT 同期履歴ログテーブル
-- ============================================================
-- 対応 spec: docs/specs/2026-04-24-root-a3a-kot-sync-log-migration.md
-- 作成: 2026-04-25（Phase A-3-a）
--
-- 目的:
--   KoT 連携（月次・日次・マスタ）の同期履歴を一元管理し、
--   失敗した同期の可視化、過去結果の監査、Cron 経由の自動同期の可観測性、
--   admin による同期トラブルの一次切り分けを可能にする。
--
-- 使い分け:
--   - root_audit_log: ユーザー操作ログ（login / master_update 等）
--   - root_kot_sync_log: システム同期履歴（API 呼出の start/complete/failure）
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod への適用は Phase A-3 全完了後にまとめて実施。
--
-- 冪等性:
--   `create table if not exists` / `drop trigger if exists` / `drop policy if exists`
--   で何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- テーブル本体
-- ------------------------------------------------------------
create table if not exists public.root_kot_sync_log (
  id                uuid primary key default gen_random_uuid(),

  -- 何の同期か
  sync_type         text not null check (sync_type in ('masters', 'monthly_attendance', 'daily_attendance')),
  sync_target       text,                                       -- '2026-04' / '2026-04-24' / 'all'

  -- 誰が起動したか
  triggered_by      text not null,                              -- user_id (uuid 文字列) or 'cron'
  triggered_at      timestamptz not null default now(),

  -- 実行時間
  started_at        timestamptz,
  completed_at      timestamptz,
  duration_ms       integer,

  -- 結果
  status            text not null check (status in ('running', 'success', 'partial', 'failure')),
  records_fetched   integer not null default 0,
  records_inserted  integer not null default 0,
  records_updated   integer not null default 0,
  records_skipped   integer not null default 0,

  -- エラー詳細（失敗時のみ）
  error_code        text,
  error_message     text,
  error_stack       text,

  -- 監査
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.root_kot_sync_log is
  'KoT 同期履歴（A-3-a）。ユーザー操作ログ root_audit_log とは別、システム同期の start/complete/failure を記録。';

-- ------------------------------------------------------------
-- updated_at 自動更新（既存 helper 関数 root_update_updated_at() を再利用）
-- ------------------------------------------------------------
drop trigger if exists trg_root_kot_sync_log_updated_at on public.root_kot_sync_log;

create trigger trg_root_kot_sync_log_updated_at
  before update on public.root_kot_sync_log
  for each row execute function public.root_update_updated_at();

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_root_kot_sync_log_triggered_at
  on public.root_kot_sync_log (triggered_at desc);

create index if not exists idx_root_kot_sync_log_type_time
  on public.root_kot_sync_log (sync_type, triggered_at desc);

-- 失敗 / 部分成功のみを高速抽出（一覧 UI の「エラー絞込」用）
create index if not exists idx_root_kot_sync_log_status_failure
  on public.root_kot_sync_log (triggered_at desc)
  where status in ('failure', 'partial');

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.root_kot_sync_log enable row level security;

-- admin / super_admin のみ閲覧（manager 以下は履歴に含まれる社員情報を保護）
drop policy if exists root_kot_sync_log_select_admin on public.root_kot_sync_log;

create policy root_kot_sync_log_select_admin
  on public.root_kot_sync_log
  for select
  using (
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.is_active = true
        and e.garden_role in ('admin', 'super_admin')
    )
  );

-- service_role は RLS をバイパスするため明示的な insert/update ポリシーは不要。
-- anon / authenticated からの書込は許可しない（= RLS 有効下で暗黙的に拒否）。

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'root_kot_sync_log';
-- SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'root_kot_sync_log';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'root_kot_sync_log';
