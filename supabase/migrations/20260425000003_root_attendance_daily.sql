-- ============================================================
-- Garden Root — 日次勤怠テーブル `root_attendance_daily`（Phase A-3-d）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-24-root-a3d-daily-workings-sync.md
-- 作成: 2026-04-25
--
-- 目的:
--   KoT /daily-workings から取得する**日次粒度**の勤怠レコードを格納する。
--   既存 `root_attendance` は月次集計専用のため、日次データは本テーブルに
--   分離して保持する（月次計算ロジックとの混在を避ける）。
--
-- 月次との関係:
--   - 月次（`root_attendance`）: 給与計算の正本、Phase A-2 で実装済
--   - 日次（本テーブル）: 勤怠の生データ。直近確認・打刻修正対応用
--   - どちらを正本にするかは業務仕様で将来決定（現時点は月次が正本）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor に貼付 → Run。
--   garden-prod への適用は Phase A-3 全完了後にまとめて。
--
-- 冪等性:
--   create table if not exists / drop policy if exists / CREATE OR REPLACE で
--   何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- テーブル本体
-- ------------------------------------------------------------
create table if not exists public.root_attendance_daily (
  id                 uuid primary key default gen_random_uuid(),

  employee_id        text not null references public.root_employees(employee_id) on delete cascade,
  work_date          date not null,

  -- 打刻時刻（未打刻日は null）
  clock_in_at        timestamptz,
  clock_out_at       timestamptz,

  -- 分単位の集計
  break_minutes      integer not null default 0,
  work_minutes       integer not null default 0,
  overtime_minutes   integer not null default 0,
  night_minutes      integer not null default 0,
  holiday_minutes    integer not null default 0,
  late_minutes       integer not null default 0,
  early_leave_minutes integer not null default 0,

  -- 休暇種別 / メモ（KoT 側の詳細文字列）
  leave_type         text,
  note               text,

  -- 出所識別
  source             text not null default 'kot-api-daily'
    check (source in ('kot-api-daily', 'manual', 'csv-manual')),

  -- KoT 元データの一意識別（再取込の冪等性確保）
  kot_record_id      text,

  -- 取込メタ
  imported_at        timestamptz,
  import_status      text not null default '取込済'
    check (import_status in ('未取込', '取込済', 'エラー')),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- 同一従業員の同一日は 1 行（upsert キー）
  unique (employee_id, work_date)
);

comment on table public.root_attendance_daily is
  'KoT /daily-workings から取得する日次勤怠レコード（Phase A-3-d）。'
  ' 月次 root_attendance と並存、業務仕様に応じて正本決定。';

-- ------------------------------------------------------------
-- updated_at trigger（既存 root_update_updated_at 関数再利用）
-- ------------------------------------------------------------
drop trigger if exists trg_root_attendance_daily_updated_at on public.root_attendance_daily;

create trigger trg_root_attendance_daily_updated_at
  before update on public.root_attendance_daily
  for each row execute function public.root_update_updated_at();

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_root_attendance_daily_work_date
  on public.root_attendance_daily (work_date desc);

create index if not exists idx_root_attendance_daily_employee_date
  on public.root_attendance_daily (employee_id, work_date desc);

create index if not exists idx_root_attendance_daily_kot_record_id
  on public.root_attendance_daily (kot_record_id)
  where kot_record_id is not null;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.root_attendance_daily enable row level security;

-- SELECT: 本人 or manager 以上（既存 root_attendance のポリシーと揃える）
drop policy if exists root_attendance_daily_select on public.root_attendance_daily;

create policy root_attendance_daily_select
  on public.root_attendance_daily
  for select
  using (
    -- 本人：自分の勤怠は見られる
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.employee_id = root_attendance_daily.employee_id
        and e.is_active = true
    )
    or
    -- manager 以上：全員の勤怠を閲覧可能
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.is_active = true
        and e.garden_role in ('manager', 'admin', 'super_admin')
    )
  );

-- WRITE: admin 以上（手動修正用）。日次取込は service_role (Cron) が担うため
-- anon / authenticated の書込はデフォルト拒否。手動修正 UI を将来追加する場合は
-- このポリシーで admin 以上に限定できる。
drop policy if exists root_attendance_daily_write on public.root_attendance_daily;

create policy root_attendance_daily_write
  on public.root_attendance_daily
  for all
  using (
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.is_active = true
        and e.garden_role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.is_active = true
        and e.garden_role in ('admin', 'super_admin')
    )
  );

-- service_role は RLS バイパス、Cron / server action からの書込はこのルートを使う

-- ------------------------------------------------------------
-- 確認クエリ
-- ------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'root_attendance_daily';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'root_attendance_daily' ORDER BY cmd;
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'root_attendance_daily';
