-- ============================================================
-- Garden Root — 日報ヘッダーテーブル（Phase 1a）
-- ============================================================
-- 対応 dispatch: 2026-05-05(火) 19:00 a-main-012 main- No. 53
-- 作成: 2026-05-05（Bloom 開発進捗ページ Phase 1a）
--
-- 目的:
--   Garden 全体の日報（state.txt）を蓄積し、Bloom 開発進捗ページ
--   /bloom/progress 等から実データとして参照可能にする。
--
-- 関連:
--   - root_daily_report_logs: 日報明細（1 行 = 1 work_log エントリ）
--   - root_module_progress: モジュール別進捗
--   - データソース: G:\マイドライブ\..._東海林美琴\006_日報自動配信\state\state.txt
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod への適用は Phase 2 完了後（5/22 以降）に検討。
--
-- 冪等性:
--   `create table if not exists` / `drop trigger if exists` /
--   `drop policy if exists` で何度実行しても同じ結果。
-- ============================================================

-- ------------------------------------------------------------
-- テーブル本体
-- ------------------------------------------------------------
create table if not exists public.root_daily_reports (
  date              date primary key,

  -- 業務形態
  workstyle         text,                                       -- 'office' / 'home' / 'irregular' / null
  is_irregular      boolean not null default false,
  irregular_label   text,                                       -- 'GW期間' 等

  -- Chatwork 送信状態
  chatwork_sent     boolean not null default false,
  chatwork_sent_at  timestamptz,

  -- データソース
  source            text not null default 'state.txt'
                    check (source in ('state.txt', 'manual', 'reconstructed')),

  -- 監査
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.root_daily_reports is
  'Garden 日報ヘッダー（Phase 1a, dispatch main- No. 53）。date を PK とし、明細は root_daily_report_logs。';
comment on column public.root_daily_reports.workstyle is
  '業務形態。office / home / irregular / null。';
comment on column public.root_daily_reports.source is
  'データソース。state.txt（自動同期）/ manual（東海林さん手入力）/ reconstructed（過去ログから復元）';

-- ------------------------------------------------------------
-- updated_at 自動更新（既存 helper 関数 root_update_updated_at() を再利用）
-- ------------------------------------------------------------
drop trigger if exists trg_root_daily_reports_updated_at on public.root_daily_reports;

create trigger trg_root_daily_reports_updated_at
  before update on public.root_daily_reports
  for each row execute function public.root_update_updated_at();

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
-- date は PK のため自動 index あり、追加不要

-- 不規則日（GW・連休）の絞込で頻出するため index 追加
create index if not exists idx_root_daily_reports_irregular
  on public.root_daily_reports (date desc)
  where is_irregular = true;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.root_daily_reports enable row level security;

-- admin / super_admin のみ閲覧（root_kot_sync_log と同パターン）
drop policy if exists root_daily_reports_select_admin on public.root_daily_reports;

create policy root_daily_reports_select_admin
  on public.root_daily_reports
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
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'root_daily_reports';
-- SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'root_daily_reports';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'root_daily_reports';
