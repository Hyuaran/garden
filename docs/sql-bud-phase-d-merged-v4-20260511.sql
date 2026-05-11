-- ============================================================
-- Bud Phase D 13 件 + 前提拡張 merged SQL v2 (FK 修正版)
-- ============================================================
-- 起草: a-main-023 / 2026-05-11 19:20
-- 用途: 5/11 仕訳帳本番運用 修復、東海林さん 1 回 paste + Run 用
-- 修正内容: id 列 → employee_id / company_id + uuid → text + RLS subquery + function body 計 26 箇所
-- silent NO-OP リスク: なし（事前 REST 検証で全 13 件未適用確認済）
-- 所要: 約 5-10 分

-- ============================================================
-- §0. 前提拡張（冪等）
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- D-09 必要
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- D-06 必要

-- ============================================================
-- migration: 20260507000001_bud_phase_d01_attendance_schema.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #01: 勤怠取込スキーマ（給与計算インプット）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-01-attendance-schema.md
-- 作成: 2026-05-07（a-bud、main- No.86 全前倒し dispatch 受領後の Phase D 着手 Day 1）
--
-- 目的:
--   給与計算が正しく動くために、勤怠データを Bud 視点で確定させた状態で参照可能にする。
--   Root の KoT 同期データ（root_attendance / root_attendance_daily）を、
--   給与締日基準で Bud のスナップショットテーブルへ転記し、計算結果の再現性を担保する。
--
-- スコープ（本 migration で対応）:
--   1. bud_payroll_periods（給与計算期間の管理）
--   2. bud_payroll_attendance_snapshots（給与締日時点の勤怠スナップショット）
--   3. bud_payroll_attendance_overrides（締日後の手動修正履歴）
--   4. RLS ポリシー（自分閲覧 / manager 自部門 / admin+ 全件 / DELETE 完全禁止）
--
-- 含めない（別 migration / 別 spec）:
--   - 給与計算ロジック → D-02
--   - 賞与 → D-03
--   - 社保計算 → D-05
--   - 取込同期 Cron → 後続 migration（/api/cron/bud-payroll-lock）
--   - 勤怠 UI → Root 側（既実装）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は Phase D 完走時にまとめて。
--
-- 冪等性: create table if not exists / create policy if not exists で何度でも実行可。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_payroll_periods（給与計算期間）
-- ------------------------------------------------------------
-- 「勤怠締めを月初〜月末、給与支払を翌月末営業日」の運用に対応。
-- root_settings から読み出した値で start_date / end_date / payment_date を決定。
-- 設定変更時は新規 period 作成時のみ反映、既存 period は不変（履歴保護）。
create table if not exists public.bud_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.root_companies(company_id),
  period_type text not null
    check (period_type in ('monthly', 'bonus_summer', 'bonus_winter', 'final_settlement')),
  start_date date not null,                    -- 期間開始（例: 2026-04-01）
  end_date date not null,                      -- 期間終了（例: 2026-04-30）
  cutoff_date date not null,                   -- 締日確定日（例: 2026-05-08）
  payment_date date not null,                  -- 支給日（例: 2026-05-29、翌月末最終営業日）
  statement_publish_target_date date,          -- 明細配信目安（例: 2026-05-22、null = 未設定）
  status text not null default 'draft'
    check (status in ('draft', 'locked', 'calculated', 'approved', 'paid')),
  locked_at timestamptz,
  locked_by text references public.root_employees(employee_id),
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),
  updated_at timestamptz not null default now(),
  updated_by text references public.root_employees(employee_id),
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  constraint uq_bud_payroll_periods_company_type_end
    unique (company_id, period_type, end_date),
  constraint chk_bud_payroll_periods_dates
    check (start_date <= end_date and end_date < cutoff_date and cutoff_date <= payment_date)
);

comment on table public.bud_payroll_periods is
  '給与計算期間の管理。1 法人 × 1 期間種別 × 1 月で一意。';
comment on column public.bud_payroll_periods.period_type is
  'monthly=月次給与, bonus_summer=夏季賞与, bonus_winter=冬季賞与, final_settlement=最終精算（退職時）';
comment on column public.bud_payroll_periods.status is
  'draft=期間定義のみ / locked=締日確定 + 勤怠スナップショット完了 / calculated=給与計算完了 / approved=承認済 / paid=振込実行済';
comment on column public.bud_payroll_periods.statement_publish_target_date is
  '明細配信目安日（root_settings.statement_publish_target から導出、null = 未設定）';

create index if not exists idx_bud_payroll_periods_status
  on public.bud_payroll_periods (status, payment_date);
create index if not exists idx_bud_payroll_periods_company_payment
  on public.bud_payroll_periods (company_id, payment_date desc);

-- ------------------------------------------------------------
-- 2. bud_payroll_attendance_snapshots（給与締日時点の勤怠スナップショット）
-- ------------------------------------------------------------
-- KoT は遡及修正可能なため、給与計算時点の勤怠を Bud で固定。
-- 単位: 全て分（minutes）で統一（KoT に合わせる）。
create table if not exists public.bud_payroll_attendance_snapshots (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.bud_payroll_periods(id) on delete cascade,
  employee_id text not null references public.root_employees(employee_id),

  -- 出勤・労働時間（分単位、KoT に合わせる）
  working_days int not null default 0
    check (working_days >= 0 and working_days <= 31),
  scheduled_working_minutes int not null default 0
    check (scheduled_working_minutes >= 0),
  actual_working_minutes int not null default 0
    check (actual_working_minutes >= 0),
  overtime_minutes int not null default 0
    check (overtime_minutes >= 0),
  late_night_minutes int not null default 0          -- 22:00〜5:00
    check (late_night_minutes >= 0),
  holiday_working_minutes int not null default 0     -- 法定休日労働
    check (holiday_working_minutes >= 0),
  legal_overtime_minutes int not null default 0      -- 法定外休日労働
    check (legal_overtime_minutes >= 0),

  -- 欠勤・控除
  absent_days int not null default 0
    check (absent_days >= 0 and absent_days <= 31),
  late_count int not null default 0
    check (late_count >= 0),
  early_leave_count int not null default 0
    check (early_leave_count >= 0),
  late_minutes_total int not null default 0
    check (late_minutes_total >= 0),
  early_leave_minutes_total int not null default 0
    check (early_leave_minutes_total >= 0),

  -- 有給（半休 0.5 日 単位許容）
  paid_leave_days numeric(4, 2) not null default 0
    check (paid_leave_days >= 0 and paid_leave_days <= 31),
  paid_leave_remaining numeric(4, 2),                -- スナップショット時点の残

  -- ソース追跡
  source_root_attendance_id uuid,                    -- root_attendance.id（既存は uuid 想定、FK は root spec 安定後に追加）
  source_synced_at timestamptz not null,

  -- メタ
  is_locked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_bud_snapshots_period_employee
    unique (payroll_period_id, employee_id)
);

comment on table public.bud_payroll_attendance_snapshots is
  '給与計算時点の勤怠スナップショット。KoT 遡及修正の影響を受けず再現性を保証。';
comment on column public.bud_payroll_attendance_snapshots.is_locked is
  'true = period.status >= locked、修正は overrides 経由のみ。';

create index if not exists idx_bud_snapshots_period
  on public.bud_payroll_attendance_snapshots (payroll_period_id);
create index if not exists idx_bud_snapshots_employee
  on public.bud_payroll_attendance_snapshots (employee_id);

-- ------------------------------------------------------------
-- 3. bud_payroll_attendance_overrides（締日後の手動修正履歴）
-- ------------------------------------------------------------
-- 締日後 (period.status >= locked) は overrides 経由でしか snapshot を変更できない。
-- 全変更は監査履歴として保持、誰が・いつ・何を・なぜ を記録。
create table if not exists public.bud_payroll_attendance_overrides (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.bud_payroll_attendance_snapshots(id) on delete restrict,
  changed_field text not null,                       -- 例: 'overtime_minutes', 'paid_leave_days'
  old_value jsonb,
  new_value jsonb,
  reason text not null
    check (length(reason) >= 5),                     -- 最低 5 文字（実態を強制）
  approved_by text not null references public.root_employees(employee_id),
  approved_at timestamptz not null default now(),
  audit_log_id uuid                                  -- 将来 root_audit_log.id へリンク予定
);

comment on table public.bud_payroll_attendance_overrides is
  '締日後 (period.status >= locked) の snapshot 手動修正履歴。誰が・いつ・何を・なぜ を完全保持。';

create index if not exists idx_bud_overrides_snapshot
  on public.bud_payroll_attendance_overrides (snapshot_id, approved_at desc);

-- ------------------------------------------------------------
-- 4. RLS（spec §6 反映）
-- ------------------------------------------------------------
alter table public.bud_payroll_periods enable row level security;
alter table public.bud_payroll_attendance_snapshots enable row level security;
alter table public.bud_payroll_attendance_overrides enable row level security;

-- ----- bud_payroll_periods RLS -----
-- SELECT: payroll_* / manager+ / 自分が作成した period
drop policy if exists bpp_select on public.bud_payroll_periods;
create policy bpp_select on public.bud_payroll_periods
  for select
  using (
    -- manager 以上は全件
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('manager', 'admin', 'super_admin')
        and re.deleted_at is null
    )
    or
    -- 作成者本人
    created_by = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  );

-- INSERT: admin+ のみ（period 作成は管理者業務）
drop policy if exists bpp_insert on public.bud_payroll_periods;
create policy bpp_insert on public.bud_payroll_periods
  for insert
  with check (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

-- UPDATE: admin+ のみ
drop policy if exists bpp_update on public.bud_payroll_periods;
create policy bpp_update on public.bud_payroll_periods
  for update
  using (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

-- DELETE: 完全禁止（横断 Cross History #07 準拠、論理削除は deleted_at 列で）
drop policy if exists bpp_no_delete on public.bud_payroll_periods;
create policy bpp_no_delete on public.bud_payroll_periods
  for delete
  using (false);

-- ----- bud_payroll_attendance_snapshots RLS -----
-- SELECT: 自分の snapshot / manager+ 自部門 / admin+ 全件
drop policy if exists bps_select_own on public.bud_payroll_attendance_snapshots;
create policy bps_select_own on public.bud_payroll_attendance_snapshots
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  );

drop policy if exists bps_select_manager_dept on public.bud_payroll_attendance_snapshots;
create policy bps_select_manager_dept on public.bud_payroll_attendance_snapshots
  for select
  using (
    exists (
      select 1 from public.root_employees viewer
      join public.root_employees target on target.employee_id = bud_payroll_attendance_snapshots.employee_id
      where viewer.user_id = auth.uid()
        and viewer.garden_role = 'manager'
        and viewer.deleted_at is null
        and viewer.department_id is not null
        and viewer.department_id = target.department_id
    )
  );

drop policy if exists bps_select_admin on public.bud_payroll_attendance_snapshots;
create policy bps_select_admin on public.bud_payroll_attendance_snapshots
  for select
  using (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

-- INSERT: service_role（Cron 経由）+ admin+ のみ
-- Supabase service_role は RLS バイパス、追加で admin+ も許可
drop policy if exists bps_insert_admin on public.bud_payroll_attendance_snapshots;
create policy bps_insert_admin on public.bud_payroll_attendance_snapshots
  for insert
  with check (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

-- UPDATE: admin+ のみ（is_locked=true のレコードは override 経由が原則だが、SQL 制御は admin に委ねる）
drop policy if exists bps_update_admin on public.bud_payroll_attendance_snapshots;
create policy bps_update_admin on public.bud_payroll_attendance_snapshots
  for update
  using (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

-- DELETE: 完全禁止
drop policy if exists bps_no_delete on public.bud_payroll_attendance_snapshots;
create policy bps_no_delete on public.bud_payroll_attendance_snapshots
  for delete
  using (false);

-- ----- bud_payroll_attendance_overrides RLS -----
-- SELECT: manager+ / 自分の override
drop policy if exists bpo_select on public.bud_payroll_attendance_overrides;
create policy bpo_select on public.bud_payroll_attendance_overrides
  for select
  using (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('manager', 'admin', 'super_admin')
        and re.deleted_at is null
    )
    or
    approved_by = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  );

-- INSERT: admin+ のみ（reason 5 文字以上は CHECK 制約で強制）
drop policy if exists bpo_insert_admin on public.bud_payroll_attendance_overrides;
create policy bpo_insert_admin on public.bud_payroll_attendance_overrides
  for insert
  with check (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
    and approved_by = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  );

-- UPDATE / DELETE: 完全禁止（監査履歴は不変）
drop policy if exists bpo_no_update on public.bud_payroll_attendance_overrides;
create policy bpo_no_update on public.bud_payroll_attendance_overrides
  for update
  using (false);

drop policy if exists bpo_no_delete on public.bud_payroll_attendance_overrides;
create policy bpo_no_delete on public.bud_payroll_attendance_overrides
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- -- テーブル確認
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('bud_payroll_periods', 'bud_payroll_attendance_snapshots', 'bud_payroll_attendance_overrides');
--
-- -- RLS 有効確認
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename LIKE 'bud_payroll_%';
--
-- -- ポリシー確認
-- SELECT schemaname, tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename LIKE 'bud_payroll_%'
--   ORDER BY tablename, policyname;

-- ============================================================
-- migration: 20260507000002_bud_phase_d09_bank_accounts.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #09: 口座一覧（Kintone App 92 → Garden 口座分離）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-26-bud-phase-d-09-bank-accounts.md
-- 作成: 2026-05-07（a-bud、main- No.86 全前倒し dispatch、Day 1 - 2 件目）
--
-- 目的:
--   Kintone App 92（口座一覧）が「給与振込口座」「外部支払先」「特殊扱い 10 名」を
--   同一アプリで管理しているのを、Garden では用途別に 2 テーブル分離する。
--
-- スコープ（本 migration で対応）:
--   1. root_employee_payroll_roles（payroll role 管理、has_payroll_role の依存先、Bud Phase D で先行起票）
--   2. bud.has_payroll_role() ヘルパー関数（D-09 で先行定義、他 D-* spec から再利用）
--   3. bud_employee_bank_accounts（給与振込口座、全従業員、EXCLUDE 制約で 1 従業員 1 アクティブ）
--   4. bud_payment_recipients（外部支払先 + 特殊扱い 10 名、月変動、employee_id NULL 可）
--   5. view_bud_active_employee_accounts（D-07 振込連携が参照するビュー）
--   6. RLS: 自己 + payroll_* + admin / DELETE は super_admin のみ
--
-- 含めない:
--   - 給与振込実行ロジック → D-07
--   - 給与明細配信 → D-04
--   - Kintone App 92 → Garden migration 実データ → 後続 migration / dual-write スクリプト
--
-- 依存拡張:
--   - btree_gist（EXCLUDE 制約用、Supabase 標準で有効化済の場合あり）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は Phase D 完走時にまとめて。
--
-- 冪等性: create * if not exists / drop policy if exists で何度でも実行可。
-- ============================================================

-- ------------------------------------------------------------
-- 0. 拡張 (btree_gist for EXCLUDE constraint)
-- ------------------------------------------------------------
create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- 1. root_employee_payroll_roles（payroll role 管理）
-- ------------------------------------------------------------
-- Bud Phase D 全体で参照する payroll role 管理テーブル。
-- 本来 Root spec に置くべきだが、D-09 が他 D-* spec の RLS 基盤として最も早く必要なため、
-- Bud 側で先行起票。将来 Root team が public.root_employee_payroll_roles として
-- 正式に owner を移管する想定（テーブル名は public.* で統一済のためスキーマ移動不要）。
create table if not exists public.root_employee_payroll_roles (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  role text not null
    check (role in (
      'payroll_calculator',
      'payroll_approver',
      'payroll_disburser',
      'payroll_auditor',
      'payroll_visual_checker'    -- 4 次 follow-up Cat 4 #26 反映、上田の目視ダブルチェック
    )),
  is_active boolean not null default true,
  granted_at timestamptz not null default now(),
  granted_by text references public.root_employees(employee_id),
  revoked_at timestamptz,
  revoked_by text references public.root_employees(employee_id),
  notes text,

  constraint uq_employee_role_active
    unique (employee_id, role, is_active) deferrable initially deferred
);

comment on table public.root_employee_payroll_roles is
  'Bud Phase D 給与処理の権限ロール（5 種）。同一従業員が複数ロール兼任可。';
comment on column public.root_employee_payroll_roles.role is
  'payroll_calculator=計算者(上田) / payroll_approver=承認者(宮永・小泉) / payroll_disburser=出力者(上田) / payroll_auditor=監査(東海林) / payroll_visual_checker=目視ダブルチェック(上田、4 次 follow-up)';

create index if not exists idx_repr_employee_active
  on public.root_employee_payroll_roles (employee_id, is_active);
create index if not exists idx_repr_role_active
  on public.root_employee_payroll_roles (role, is_active);

-- RLS: SELECT 全 payroll_* + admin、INSERT/UPDATE は admin+ のみ、DELETE 禁止
alter table public.root_employee_payroll_roles enable row level security;

drop policy if exists repr_select on public.root_employee_payroll_roles;
create policy repr_select on public.root_employee_payroll_roles
  for select
  using (
    -- 自分のロール
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    -- または admin+
    or exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

drop policy if exists repr_insert_admin on public.root_employee_payroll_roles;
create policy repr_insert_admin on public.root_employee_payroll_roles
  for insert
  with check (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

drop policy if exists repr_update_admin on public.root_employee_payroll_roles;
create policy repr_update_admin on public.root_employee_payroll_roles
  for update
  using (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.root_employees re
      where re.employee_number = public.auth_employee_number()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  );

drop policy if exists repr_no_delete on public.root_employee_payroll_roles;
create policy repr_no_delete on public.root_employee_payroll_roles
  for delete
  using (false);

-- ------------------------------------------------------------
-- 2. bud_has_payroll_role() ヘルパー関数
-- ------------------------------------------------------------
-- D-09 で先行定義、他 D-* spec（D-04 / D-07 / D-10 / D-11 / D-12）から再利用。
-- SECURITY DEFINER で auth.uid() の値を解決後、呼び出し元の制約を超えて role 確認可能にする。
-- 引数:
--   roles text[]: NULL なら「いずれかの payroll_* ロール」、配列なら「指定ロールのいずれか」
create or replace function public.bud_has_payroll_role(roles text[] default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.root_employee_payroll_roles epr
    join public.root_employees re on re.employee_id = epr.employee_id
    where re.employee_number = public.auth_employee_number()
      and re.deleted_at is null
      and epr.is_active = true
      and (roles is null or epr.role = any(roles))
  );
$$;

comment on function public.bud_has_payroll_role(text[]) is
  'Bud Phase D 給与処理 RLS 用ヘルパー。NULL 引数で payroll_* いずれか、配列で指定ロールのいずれか確認。';

-- 補助ヘルパー: admin / super_admin / super_admin only
create or replace function public.bud_is_admin_or_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.root_employees re
    where re.employee_number = public.auth_employee_number()
      and re.garden_role in ('admin', 'super_admin')
      and re.deleted_at is null
  );
$$;

create or replace function public.bud_is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.root_employees re
    where re.employee_number = public.auth_employee_number()
      and re.garden_role = 'super_admin'
      and re.deleted_at is null
  );
$$;

-- ------------------------------------------------------------
-- 3. bud_employee_bank_accounts（給与振込口座、全従業員）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),

  -- 口座情報
  bank_code text not null
    check (bank_code ~ '^[0-9]{4}$'),                -- 4 桁数字
  bank_name text not null,
  branch_code text not null
    check (branch_code ~ '^[0-9]{3}$'),              -- 3 桁数字
  branch_name text not null,
  account_type text not null
    check (account_type in ('普通', '当座', '貯蓄')),
  account_number text not null
    check (account_number ~ '^[0-9]+$'                -- 数字のみ
       and length(account_number) between 1 and 8),  -- 通常 7 桁、稀に 8 桁
  account_holder_kana text not null
    check (length(account_holder_kana) >= 1),         -- 半角カナ想定（FB 互換）

  -- 状態
  is_active boolean not null default true,
  effective_from date not null,
  effective_to date,                                 -- NULL = 継続中

  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  -- 効果期間の整合性
  constraint chk_eba_dates
    check (effective_to is null or effective_to >= effective_from),

  -- 1 従業員 1 アクティブ口座のみ（履歴管理）— 期間が重ならないことを保証
  constraint uq_eba_active_account_per_employee
    exclude using gist (
      employee_id with =,
      daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
    ) where (is_active = true)
);

comment on table public.bud_employee_bank_accounts is
  '給与振込口座（全従業員、必ず employee_id に紐づく）。EXCLUDE 制約で同一従業員のアクティブ口座が期間重複しないことを保証。';

create index if not exists idx_bud_eba_employee_active
  on public.bud_employee_bank_accounts (employee_id, is_active);
create index if not exists idx_bud_eba_effective
  on public.bud_employee_bank_accounts (effective_from, effective_to)
  where is_active = true;

-- ------------------------------------------------------------
-- 4. bud_payment_recipients（外部支払先 + 特殊扱い 10 名、月変動）
-- ------------------------------------------------------------
create table if not exists public.bud_payment_recipients (
  id uuid primary key default gen_random_uuid(),
  employee_id text references public.root_employees(employee_id),  -- ★ NULL 可
  recipient_type text not null
    check (recipient_type in ('external_company', 'individual_special', 'employee_special')),

  -- 識別
  recipient_name text not null,
  recipient_name_kana text,

  -- 口座情報
  bank_code text not null
    check (bank_code ~ '^[0-9]{4}$'),
  bank_name text not null,
  branch_code text not null
    check (branch_code ~ '^[0-9]{3}$'),
  branch_name text not null,
  account_type text not null
    check (account_type in ('普通', '当座', '貯蓄')),
  account_number text not null
    check (account_number ~ '^[0-9]+$' and length(account_number) between 1 and 8),
  account_holder_kana text not null
    check (length(account_holder_kana) >= 1),

  -- 月単位レコード対応
  applies_month date,                                -- 月の 1 日（例: 2026-05-01）NULL = 通年
  amount bigint
    check (amount is null or amount >= 0),
  payment_purpose text,

  -- 状態
  is_active boolean not null default true,
  notes text,

  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  -- recipient_type と employee_id の整合性
  constraint chk_pr_recipient_type_employee
    check (
      (recipient_type = 'external_company' and employee_id is null)
      or (recipient_type = 'individual_special' and employee_id is null)
      or (recipient_type = 'employee_special' and employee_id is not null)
    ),

  -- applies_month が月初日であることを保証（NULL は OK）
  constraint chk_pr_applies_month_first_day
    check (applies_month is null or extract(day from applies_month) = 1)
);

comment on table public.bud_payment_recipients is
  '外部支払先（取引先）+ 特殊扱い 10 名（従業員だが給与口座とは別）+ 個人外部（フリーランス等）。月単位レコード対応、employee_id は recipient_type で整合性担保。';
comment on column public.bud_payment_recipients.applies_month is
  '当月の 1 日（例: 2026-05-01）。NULL = 通年継続支払（家賃等）。同一支払先の月別額違いは別レコード。';

create index if not exists idx_bud_pr_month_active
  on public.bud_payment_recipients (applies_month, is_active);
create index if not exists idx_bud_pr_employee_special
  on public.bud_payment_recipients (employee_id, applies_month)
  where recipient_type = 'employee_special';
create index if not exists idx_bud_pr_type_active
  on public.bud_payment_recipients (recipient_type, is_active);

-- ------------------------------------------------------------
-- 5. view_bud_active_employee_accounts（D-07 振込連携が参照）
-- ------------------------------------------------------------
create or replace view public.view_bud_active_employee_accounts as
select
  e.employee_id,
  e.employee_number,
  e.last_name || ' ' || e.first_name as full_name,
  eba.id as bank_account_id,
  eba.bank_code,
  eba.bank_name,
  eba.branch_code,
  eba.branch_name,
  eba.account_type,
  eba.account_number,
  eba.account_holder_kana
from public.root_employees e
inner join public.bud_employee_bank_accounts eba
  on eba.employee_id = e.employee_id
  and eba.is_active = true
  and eba.effective_from <= current_date
  and (eba.effective_to is null or eba.effective_to >= current_date)
where e.is_active = true
  and e.deleted_at is null;

comment on view public.view_bud_active_employee_accounts is
  'D-07 振込連携が参照する「当日有効な給与振込口座」ビュー。退職者・無効口座を除外。';

-- ------------------------------------------------------------
-- 6. RLS（spec §4 反映）
-- ------------------------------------------------------------
alter table public.bud_employee_bank_accounts enable row level security;
alter table public.bud_payment_recipients enable row level security;

-- ----- bud_employee_bank_accounts RLS -----
-- SELECT: 本人 or payroll_* 系 or admin+
drop policy if exists eba_select on public.bud_employee_bank_accounts;
create policy eba_select on public.bud_employee_bank_accounts
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()                  -- いずれかの payroll_* ロール
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT / UPDATE: payroll_calculator + admin
drop policy if exists eba_insert on public.bud_employee_bank_accounts;
create policy eba_insert on public.bud_employee_bank_accounts
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists eba_update on public.bud_employee_bank_accounts;
create policy eba_update on public.bud_employee_bank_accounts
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

-- DELETE: super_admin のみ（論理削除推奨、is_active = false で代替）
drop policy if exists eba_delete on public.bud_employee_bank_accounts;
create policy eba_delete on public.bud_employee_bank_accounts
  for delete
  using (public.bud_is_super_admin());

-- ----- bud_payment_recipients RLS（個人情報を含むため SELECT は payroll_* に限定）-----
drop policy if exists pr_select on public.bud_payment_recipients;
create policy pr_select on public.bud_payment_recipients
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists pr_insert on public.bud_payment_recipients;
create policy pr_insert on public.bud_payment_recipients
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists pr_update on public.bud_payment_recipients;
create policy pr_update on public.bud_payment_recipients
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists pr_delete on public.bud_payment_recipients;
create policy pr_delete on public.bud_payment_recipients
  for delete
  using (public.bud_is_super_admin());

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- -- 拡張確認
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';
--
-- -- テーブル + ビュー + 関数 確認
-- SELECT table_schema, table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('root_employee_payroll_roles', 'bud_employee_bank_accounts', 'bud_payment_recipients');
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname = 'view_bud_active_employee_accounts';
-- SELECT proname FROM pg_proc WHERE proname IN ('bud_has_payroll_role', 'bud_is_admin_or_super_admin', 'bud_is_super_admin');
--
-- -- EXCLUDE 制約確認
-- SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.bud_employee_bank_accounts'::regclass
--     AND conname = 'uq_eba_active_account_per_employee';
--
-- -- RLS ポリシー確認
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('root_employee_payroll_roles', 'bud_employee_bank_accounts', 'bud_payment_recipients')
--   ORDER BY tablename, policyname;

-- ============================================================
-- migration: 20260507000003_bud_phase_d05_social_insurance.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #05: 社会保険計算（健保 / 厚年 / 介護 / 雇用）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md
-- 作成: 2026-05-07（a-bud、main- No.86 全前倒し dispatch、Day 2 前倒し着手）
--
-- 目的:
--   月次給与・賞与で控除する社会保険料（健保 / 厚年 / 介護 / 雇用）を法令準拠で計算するための
--   基盤テーブル（等級表 / 料率 / 従業員別履歴 / 免除）を定義。計算ロジックは
--   src/app/bud/payroll/_lib/insurance-calculator.ts （純関数）で実装。
--
-- スコープ（本 migration で対応）:
--   1. bud_standard_remuneration_grades（等級表、健保 50 / 厚年 32 等級）
--   2. bud_insurance_rates（料率、都道府県別 + 業種別）
--   3. bud_employee_remuneration_history（従業員別 標準報酬履歴、月変・算定基礎・産休復帰の根拠）
--   4. bud_employee_insurance_exemptions（産休・育休の免除）
--   5. RLS（自分閲覧 + payroll_* + admin、UPDATE は admin のみ、DELETE 完全禁止）
--
-- 含めない:
--   - 月変判定 Cron → 後続 migration（必要 salary records 整備後）
--   - 算定基礎届 Cron → 同上
--   - 産休・育休 自動検知 → Phase E（当面手動登録）
--   - 計算本体ロジック → src/app/bud/payroll/_lib/insurance-calculator.ts
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   等級表・料率の初期データは UI / 別 SQL で投入（東海林さん作業）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_standard_remuneration_grades（等級表）
-- ------------------------------------------------------------
-- 健保: 50 等級（協会けんぽ）/ 厚年: 32 等級
-- effective_year で年度切替（例: 2026 年度のレコードは effective_year=2026）
create table if not exists public.bud_standard_remuneration_grades (
  id uuid primary key default gen_random_uuid(),
  insurance_type text not null
    check (insurance_type in ('health', 'pension')),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  grade int not null
    check (grade between 1 and 50),
  remuneration_min numeric(10, 0) not null
    check (remuneration_min >= 0),
  remuneration_max numeric(10, 0)
    check (remuneration_max is null or remuneration_max >= remuneration_min),
  standard_amount numeric(10, 0) not null
    check (standard_amount > 0),

  constraint uq_grade unique (insurance_type, effective_year, grade)
);

comment on table public.bud_standard_remuneration_grades is
  '社保 標準報酬月額 等級表。年度別、健保 50 / 厚年 32 等級。算定基礎・月変での grade lookup 元データ。';

create index if not exists idx_grades_lookup
  on public.bud_standard_remuneration_grades (insurance_type, effective_year, remuneration_min);

-- ------------------------------------------------------------
-- 2. bud_insurance_rates（料率）
-- ------------------------------------------------------------
-- 健保・介護: 都道府県別（協会けんぽ）/ 厚年: 一律 / 雇用: 業種別 + 労使比例
create table if not exists public.bud_insurance_rates (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  effective_to date,
  prefecture text,                                -- 健保・介護のみ、null = 全国（厚年・雇用用）
  industry_class text not null
    check (industry_class in ('general', 'agriculture_forestry_fishery', 'construction')),

  -- 健康保険（労使合計、折半は計算時）
  health_rate numeric(7, 6) not null
    check (health_rate >= 0 and health_rate < 1),
  long_term_care_rate numeric(7, 6) not null
    check (long_term_care_rate >= 0 and long_term_care_rate < 1),

  -- 厚生年金（一律）
  pension_rate numeric(7, 6) not null
    check (pension_rate >= 0 and pension_rate < 1),

  -- 雇用保険（業種別、労使比例）
  employment_total_rate numeric(7, 6) not null
    check (employment_total_rate >= 0 and employment_total_rate < 1),
  employment_employee_rate numeric(7, 6) not null
    check (employment_employee_rate >= 0 and employment_employee_rate < 1),

  notes text,
  created_at timestamptz not null default now(),

  constraint uq_rate
    unique (effective_from, prefecture, industry_class),
  constraint chk_rate_dates
    check (effective_to is null or effective_to >= effective_from),
  constraint chk_employment_employee_le_total
    check (employment_employee_rate <= employment_total_rate)
);

comment on table public.bud_insurance_rates is
  '社保料率の年度別マスタ。健保 + 介護は都道府県別、厚年は一律 (prefecture=NULL OK)、雇用は業種別。';

create index if not exists idx_rates_active
  on public.bud_insurance_rates (effective_from desc, prefecture, industry_class)
  where effective_to is null;

-- ------------------------------------------------------------
-- 3. bud_employee_remuneration_history（標準報酬 履歴）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_remuneration_history (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  insurance_type text not null
    check (insurance_type in ('health', 'pension')),
  effective_from date not null,
  effective_to date,
  grade int not null
    check (grade between 1 and 50),
  standard_amount numeric(10, 0) not null
    check (standard_amount > 0),
  reason text not null
    check (reason in ('initial', 'kettei', 'getsu_hen', 'sanzen_hen', 'manual')),
    -- initial=入社時, kettei=算定基礎届, getsu_hen=月変, sanzen_hen=産休・育休復帰時, manual=手動
  source_period_id uuid references public.bud_payroll_periods(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  constraint uq_remuneration_history
    unique (employee_id, insurance_type, effective_from),
  constraint chk_remuneration_dates
    check (effective_to is null or effective_to >= effective_from)
);

comment on table public.bud_employee_remuneration_history is
  '従業員別 標準報酬月額の履歴。月変 / 算定基礎 / 産休復帰時改定の根拠。1 従業員 × 1 保険種別で時系列追跡。';

create index if not exists idx_remuneration_history_active
  on public.bud_employee_remuneration_history (employee_id, insurance_type, effective_from desc)
  where effective_to is null;
create index if not exists idx_remuneration_history_employee_type
  on public.bud_employee_remuneration_history (employee_id, insurance_type, effective_from desc);

-- ------------------------------------------------------------
-- 4. bud_employee_insurance_exemptions（免除）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_insurance_exemptions (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  exemption_type text not null
    check (exemption_type in ('maternity', 'childcare')),
    -- maternity=産前産後 (産前 6 週 + 産後 8 週), childcare=育休 (最長 子 2 歳まで)
  start_date date not null,
  end_date date,
  approved_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),

  constraint chk_exemption_dates
    check (end_date is null or end_date >= start_date)
);

comment on table public.bud_employee_insurance_exemptions is
  '産休・育休による社保免除。健保・厚年・介護は本人負担 + 会社負担とも 100% 免除、雇用は除外しない。';

create index if not exists idx_exemptions_employee_period
  on public.bud_employee_insurance_exemptions (employee_id, start_date desc);

-- ------------------------------------------------------------
-- 5. RLS（spec §6 反映 + D-09 で定義済み bud_has_payroll_role 利用）
-- ------------------------------------------------------------

alter table public.bud_standard_remuneration_grades enable row level security;
alter table public.bud_insurance_rates enable row level security;
alter table public.bud_employee_remuneration_history enable row level security;
alter table public.bud_employee_insurance_exemptions enable row level security;

-- ----- 等級表・料率（マスタデータ、payroll_* 全員 SELECT、admin のみ書込） -----
drop policy if exists grades_select on public.bud_standard_remuneration_grades;
create policy grades_select on public.bud_standard_remuneration_grades
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists grades_insert on public.bud_standard_remuneration_grades;
create policy grades_insert on public.bud_standard_remuneration_grades
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists grades_update on public.bud_standard_remuneration_grades;
create policy grades_update on public.bud_standard_remuneration_grades
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists grades_no_delete on public.bud_standard_remuneration_grades;
create policy grades_no_delete on public.bud_standard_remuneration_grades
  for delete
  using (false);

drop policy if exists rates_select on public.bud_insurance_rates;
create policy rates_select on public.bud_insurance_rates
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rates_insert on public.bud_insurance_rates;
create policy rates_insert on public.bud_insurance_rates
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rates_update on public.bud_insurance_rates;
create policy rates_update on public.bud_insurance_rates
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rates_no_delete on public.bud_insurance_rates;
create policy rates_no_delete on public.bud_insurance_rates
  for delete
  using (false);

-- ----- 標準報酬履歴（自分閲覧 + payroll_* + admin、INSERT/UPDATE は payroll_calculator + admin） -----
drop policy if exists rh_select on public.bud_employee_remuneration_history;
create policy rh_select on public.bud_employee_remuneration_history
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rh_insert on public.bud_employee_remuneration_history;
create policy rh_insert on public.bud_employee_remuneration_history
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rh_update on public.bud_employee_remuneration_history;
create policy rh_update on public.bud_employee_remuneration_history
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rh_no_delete on public.bud_employee_remuneration_history;
create policy rh_no_delete on public.bud_employee_remuneration_history
  for delete
  using (false);

-- ----- 免除（自分閲覧 + payroll_* + admin、INSERT/UPDATE は admin のみ） -----
drop policy if exists ex_select on public.bud_employee_insurance_exemptions;
create policy ex_select on public.bud_employee_insurance_exemptions
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ex_insert on public.bud_employee_insurance_exemptions;
create policy ex_insert on public.bud_employee_insurance_exemptions
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists ex_update on public.bud_employee_insurance_exemptions;
create policy ex_update on public.bud_employee_insurance_exemptions
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists ex_no_delete on public.bud_employee_insurance_exemptions;
create policy ex_no_delete on public.bud_employee_insurance_exemptions
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- -- テーブル確認
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'bud_standard_remuneration_grades',
--       'bud_insurance_rates',
--       'bud_employee_remuneration_history',
--       'bud_employee_insurance_exemptions'
--     );
--
-- -- ポリシー確認
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename LIKE 'bud_%insurance%' OR tablename LIKE 'bud_standard%' OR tablename LIKE 'bud_employee_remuneration%'
--   ORDER BY tablename, policyname;

-- ============================================================
-- migration: 20260507000004_bud_phase_d02_salary_calculation.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #02: 給与計算ロジック（実装着手版）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md
-- 作成: 2026-05-07（a-bud、main- No.94 GO 受領後 Day 3 前倒し着手）
--
-- 目的:
--   月次給与の支給額・控除額・差引支給額を確定するための結果テーブルとマスタ
--   （個別手当 / 控除上書き / 月額表 甲乙 / 住民税）を定義。計算ロジックは
--   src/app/bud/payroll/_lib/salary-calculator.ts （純関数）で実装。
--
-- スコープ（本 migration で対応）:
--   1. bud_salary_records（給与結果、1 employee × 1 period = 1 行）
--   2. bud_employee_allowances（個別手当上書き）
--   3. bud_employee_deductions（個別控除上書き）
--   4. bud_withholding_tax_table_kou（源泉徴収月額表 甲欄）
--   5. bud_withholding_tax_table_otsu（源泉徴収月額表 乙欄）
--   6. bud_resident_tax_assignments（住民税、6 月のみ別額）
--   7. RLS（自分閲覧 + payroll_* + admin、UPDATE は payroll_calculator + admin、DELETE 完全禁止）
--
-- 含めない:
--   - 計算本体ロジック → src/app/bud/payroll/_lib/salary-calculator.ts
--   - 月額表・住民税の初期データ → 国税庁 / 各市町村データから別 SQL 投入（admin 作業）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_salary_records（給与結果）
-- ------------------------------------------------------------
create table if not exists public.bud_salary_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),
  employee_id text not null references public.root_employees(employee_id),

  -- 基本給
  basic_pay numeric(12, 0) not null default 0
    check (basic_pay >= 0),
  hourly_rate numeric(12, 2)
    check (hourly_rate is null or hourly_rate >= 0),
  base_calculation_method text not null
    check (base_calculation_method in ('monthly', 'hourly', 'commission')),

  -- 割増（円）
  overtime_pay numeric(12, 0) not null default 0 check (overtime_pay >= 0),
  late_night_pay numeric(12, 0) not null default 0 check (late_night_pay >= 0),
  holiday_pay numeric(12, 0) not null default 0 check (holiday_pay >= 0),
  legal_overtime_pay numeric(12, 0) not null default 0 check (legal_overtime_pay >= 0),

  -- 手当
  commute_allowance numeric(12, 0) not null default 0 check (commute_allowance >= 0),
  housing_allowance numeric(12, 0) not null default 0 check (housing_allowance >= 0),
  position_allowance numeric(12, 0) not null default 0 check (position_allowance >= 0),
  family_allowance numeric(12, 0) not null default 0 check (family_allowance >= 0),
  qualification_allowance numeric(12, 0) not null default 0 check (qualification_allowance >= 0),
  other_allowances jsonb,
  total_allowances numeric(12, 0) not null default 0 check (total_allowances >= 0),

  -- 欠勤・遅刻控除
  absent_deduction numeric(12, 0) not null default 0 check (absent_deduction >= 0),
  late_deduction numeric(12, 0) not null default 0 check (late_deduction >= 0),
  early_leave_deduction numeric(12, 0) not null default 0 check (early_leave_deduction >= 0),

  -- 総支給額
  gross_pay numeric(12, 0) not null check (gross_pay >= 0),

  -- 社保（D-05 が書込 / 本 spec は読み取り）
  health_insurance numeric(10, 0) not null default 0 check (health_insurance >= 0),
  welfare_pension numeric(10, 0) not null default 0 check (welfare_pension >= 0),
  long_term_care_insurance numeric(10, 0) not null default 0 check (long_term_care_insurance >= 0),
  employment_insurance numeric(10, 0) not null default 0 check (employment_insurance >= 0),
  total_social_insurance numeric(10, 0) not null default 0 check (total_social_insurance >= 0),

  -- 税金
  withholding_tax numeric(10, 0) not null default 0 check (withholding_tax >= 0),
  resident_tax numeric(10, 0) not null default 0 check (resident_tax >= 0),

  -- その他控除
  other_deductions jsonb,
  total_other_deductions numeric(10, 0) not null default 0 check (total_other_deductions >= 0),

  -- 控除合計・差引支給額
  total_deductions numeric(12, 0) not null check (total_deductions >= 0),
  net_pay numeric(12, 0) not null,

  -- 計算メタデータ
  kou_otsu_at_calculation text not null check (kou_otsu_at_calculation in ('kou', 'otsu')),
  dependents_count_at_calculation int not null check (dependents_count_at_calculation between 0 and 20),
  social_insurance_grade int,
  calculation_warnings jsonb,

  -- 状態
  status text not null default 'calculated'
    check (status in ('calculated', 'approved', 'paid', 'cancelled')),

  -- 監査
  calculated_at timestamptz not null default now(),
  calculated_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  paid_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),
  deleted_reason text,

  constraint uq_salary_records_period_employee
    unique (payroll_period_id, employee_id),
  constraint chk_net_pay_consistency
    check (net_pay = gross_pay - total_deductions)
);

comment on table public.bud_salary_records is
  '月次給与の計算結果。1 employee × 1 period = 1 行、UNIQUE 保証。net_pay = gross_pay - total_deductions の整合性 CHECK。';

create index if not exists idx_bud_salary_period
  on public.bud_salary_records (payroll_period_id);
create index if not exists idx_bud_salary_employee_calc
  on public.bud_salary_records (employee_id, calculated_at desc);
create index if not exists idx_bud_salary_status
  on public.bud_salary_records (status);

-- ------------------------------------------------------------
-- 2. bud_employee_allowances（個別手当上書き）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_allowances (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  allowance_type text not null
    check (allowance_type in ('commute', 'housing', 'position', 'family', 'qualification', 'custom')),
  custom_label text,                              -- allowance_type='custom' 時のみ必須
  amount numeric(12, 0) not null check (amount >= 0),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  constraint chk_custom_label_when_custom
    check (
      (allowance_type = 'custom' and custom_label is not null and length(custom_label) > 0)
      or (allowance_type <> 'custom' and custom_label is null)
    )
);

comment on table public.bud_employee_allowances is
  '個別手当上書き。allowance_type=custom 時のみ custom_label 必須。effective_from/to で期間管理。';

create index if not exists idx_bud_emp_allowances_employee
  on public.bud_employee_allowances (employee_id, effective_from desc);

-- ------------------------------------------------------------
-- 3. bud_employee_deductions（個別控除上書き）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  deduction_label text not null check (length(deduction_label) > 0),
  amount numeric(10, 0) not null check (amount >= 0),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id)
);

comment on table public.bud_employee_deductions is
  '個別控除上書き（親睦会費 / 社員旅行積立等）。期間管理。';

create index if not exists idx_bud_emp_deductions_employee
  on public.bud_employee_deductions (employee_id, effective_from desc);

-- ------------------------------------------------------------
-- 4. bud_withholding_tax_table_kou（源泉徴収月額表 甲欄）
-- ------------------------------------------------------------
-- 国税庁「給与所得の源泉徴収税額表」月額表 甲欄
-- 課税対象額（社保控除後）の範囲別 × 扶養親族数別（0-7 人）
-- 7 人超は dependents_7 から所定額（1,610 円）× 超過人数 を減算
create table if not exists public.bud_withholding_tax_table_kou (
  id uuid primary key default gen_random_uuid(),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  taxable_min numeric(10, 0) not null check (taxable_min >= 0),
  taxable_max numeric(10, 0) not null check (taxable_max > taxable_min),
  dependents_0 numeric(8, 0) not null check (dependents_0 >= 0),
  dependents_1 numeric(8, 0) not null check (dependents_1 >= 0),
  dependents_2 numeric(8, 0) not null check (dependents_2 >= 0),
  dependents_3 numeric(8, 0) not null check (dependents_3 >= 0),
  dependents_4 numeric(8, 0) not null check (dependents_4 >= 0),
  dependents_5 numeric(8, 0) not null check (dependents_5 >= 0),
  dependents_6 numeric(8, 0) not null check (dependents_6 >= 0),
  dependents_7 numeric(8, 0) not null check (dependents_7 >= 0),

  constraint uq_kou_year_range
    unique (effective_year, taxable_min, taxable_max)
);

comment on table public.bud_withholding_tax_table_kou is
  '源泉徴収月額表 甲欄。課税対象額の範囲別 × 扶養 0-7 人。7 人超は呼び出し側で 1,610 円 × 超過人数を減算。';

create index if not exists idx_kou_lookup
  on public.bud_withholding_tax_table_kou (effective_year, taxable_min);

-- ------------------------------------------------------------
-- 5. bud_withholding_tax_table_otsu（源泉徴収月額表 乙欄）
-- ------------------------------------------------------------
-- 乙欄: 一律高税率、扶養関係なし
-- 税額 = flat_amount + (taxable_amount - taxable_min) × tax_rate
create table if not exists public.bud_withholding_tax_table_otsu (
  id uuid primary key default gen_random_uuid(),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  taxable_min numeric(10, 0) not null check (taxable_min >= 0),
  taxable_max numeric(10, 0) not null check (taxable_max > taxable_min),
  tax_rate numeric(5, 4) not null
    check (tax_rate >= 0 and tax_rate <= 1),
  flat_amount numeric(8, 0) not null default 0 check (flat_amount >= 0),

  constraint uq_otsu_year_range
    unique (effective_year, taxable_min, taxable_max)
);

comment on table public.bud_withholding_tax_table_otsu is
  '源泉徴収月額表 乙欄。flat_amount + (taxable_amount - taxable_min) × tax_rate で税額算出。';

create index if not exists idx_otsu_lookup
  on public.bud_withholding_tax_table_otsu (effective_year, taxable_min);

-- ------------------------------------------------------------
-- 6. bud_resident_tax_assignments（住民税、6 月のみ別額）
-- ------------------------------------------------------------
create table if not exists public.bud_resident_tax_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  fiscal_year int not null
    check (fiscal_year between 2020 and 2099),         -- 6 月-翌 5 月の年度
  june_amount numeric(10, 0) not null check (june_amount >= 0),
  monthly_amount numeric(10, 0) not null check (monthly_amount >= 0),  -- 7 月-翌 5 月共通
  source_municipality text,
  notes text,
  created_at timestamptz not null default now(),

  constraint uq_resident_tax_employee_year
    unique (employee_id, fiscal_year)
);

comment on table public.bud_resident_tax_assignments is
  '住民税の特別徴収額。fiscal_year は 6 月-翌 5 月、6 月のみ別額（端数調整）、7 月-翌 5 月は monthly_amount。';

create index if not exists idx_resident_tax_employee
  on public.bud_resident_tax_assignments (employee_id, fiscal_year desc);

-- ------------------------------------------------------------
-- 7. RLS（D-09 で定義済み helpers 利用）
-- ------------------------------------------------------------

alter table public.bud_salary_records enable row level security;
alter table public.bud_employee_allowances enable row level security;
alter table public.bud_employee_deductions enable row level security;
alter table public.bud_withholding_tax_table_kou enable row level security;
alter table public.bud_withholding_tax_table_otsu enable row level security;
alter table public.bud_resident_tax_assignments enable row level security;

-- ----- bud_salary_records: 自分閲覧 + payroll_* + admin、INSERT は payroll_calculator + admin -----
drop policy if exists sr_select on public.bud_salary_records;
create policy sr_select on public.bud_salary_records
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists sr_insert on public.bud_salary_records;
create policy sr_insert on public.bud_salary_records
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists sr_update on public.bud_salary_records;
create policy sr_update on public.bud_salary_records
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists sr_no_delete on public.bud_salary_records;
create policy sr_no_delete on public.bud_salary_records
  for delete
  using (false);

-- ----- bud_employee_allowances / deductions: 自分閲覧 + payroll_* + admin、書込は payroll_calculator + admin -----
drop policy if exists ea_select on public.bud_employee_allowances;
create policy ea_select on public.bud_employee_allowances
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ea_write on public.bud_employee_allowances;
create policy ea_write on public.bud_employee_allowances
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ea_update on public.bud_employee_allowances;
create policy ea_update on public.bud_employee_allowances
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ea_no_delete on public.bud_employee_allowances;
create policy ea_no_delete on public.bud_employee_allowances
  for delete
  using (false);

drop policy if exists ed_select on public.bud_employee_deductions;
create policy ed_select on public.bud_employee_deductions
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ed_write on public.bud_employee_deductions;
create policy ed_write on public.bud_employee_deductions
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ed_update on public.bud_employee_deductions;
create policy ed_update on public.bud_employee_deductions
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ed_no_delete on public.bud_employee_deductions;
create policy ed_no_delete on public.bud_employee_deductions
  for delete
  using (false);

-- ----- 月額表 甲乙: payroll_* 全員 SELECT、admin のみ書込 -----
drop policy if exists kou_select on public.bud_withholding_tax_table_kou;
create policy kou_select on public.bud_withholding_tax_table_kou
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists kou_write on public.bud_withholding_tax_table_kou;
create policy kou_write on public.bud_withholding_tax_table_kou
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists kou_update on public.bud_withholding_tax_table_kou;
create policy kou_update on public.bud_withholding_tax_table_kou
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists kou_no_delete on public.bud_withholding_tax_table_kou;
create policy kou_no_delete on public.bud_withholding_tax_table_kou
  for delete
  using (false);

drop policy if exists otsu_select on public.bud_withholding_tax_table_otsu;
create policy otsu_select on public.bud_withholding_tax_table_otsu
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists otsu_write on public.bud_withholding_tax_table_otsu;
create policy otsu_write on public.bud_withholding_tax_table_otsu
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists otsu_update on public.bud_withholding_tax_table_otsu;
create policy otsu_update on public.bud_withholding_tax_table_otsu
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists otsu_no_delete on public.bud_withholding_tax_table_otsu;
create policy otsu_no_delete on public.bud_withholding_tax_table_otsu
  for delete
  using (false);

-- ----- 住民税: 自分閲覧 + payroll_* + admin、admin のみ書込 -----
drop policy if exists rt_select on public.bud_resident_tax_assignments;
create policy rt_select on public.bud_resident_tax_assignments
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rt_write on public.bud_resident_tax_assignments;
create policy rt_write on public.bud_resident_tax_assignments
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rt_update on public.bud_resident_tax_assignments;
create policy rt_update on public.bud_resident_tax_assignments
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rt_no_delete on public.bud_resident_tax_assignments;
create policy rt_no_delete on public.bud_resident_tax_assignments
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'bud_salary_records',
--       'bud_employee_allowances',
--       'bud_employee_deductions',
--       'bud_withholding_tax_table_kou',
--       'bud_withholding_tax_table_otsu',
--       'bud_resident_tax_assignments'
--     );

-- ============================================================
-- migration: 20260507000005_bud_phase_d03_bonus_calculation.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #03: 賞与計算（admin only RLS、Cat 4 #28 反映）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md
-- 作成: 2026-05-07（a-bud、main- No.97 GO 受領後 Day 4 前倒し着手）
--
-- 目的:
--   月次給与とは別系統の賞与（夏冬・決算賞与）の計算結果テーブル + 算出率表を定義。
--   Cat 4 #28（賞与処理 admin only）反映済 = INSERT/UPDATE は admin/super_admin のみ。
--
-- スコープ（本 migration で対応）:
--   1. bud_bonus_records（賞与結果、健保上限到達フラグ等含む）
--   2. bud_bonus_withholding_rate_table（賞与算出率表、甲乙別 + 扶養 0-7 人）
--   3. RLS（Cat 4 #28: admin only INSERT/UPDATE、自分閲覧 OK、DELETE 完全禁止）
--
-- 含めない:
--   - 計算本体 → src/app/bud/payroll/_lib/bonus-calculator.ts （純関数）
--   - 賞与時社保計算 → D-05 calculateBonusInsurance（再利用）
--   - 算出率表の初期データ → 国税庁データから別 SQL 投入（admin 作業）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_bonus_records（賞与結果）
-- ------------------------------------------------------------
create table if not exists public.bud_bonus_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),
  bonus_label text not null check (length(bonus_label) > 0),
  bonus_payment_date date not null,
  employee_id text not null references public.root_employees(employee_id),

  -- 支給額
  base_bonus numeric(12, 0) not null check (base_bonus >= 0),
  performance_addition numeric(12, 0) not null default 0
    check (performance_addition >= 0),
  other_additions jsonb,
  gross_bonus numeric(12, 0) not null check (gross_bonus >= 0),

  -- 社保（標準賞与額ベース、D-05 calculateBonusInsurance 結果）
  health_insurance numeric(10, 0) not null default 0 check (health_insurance >= 0),
  welfare_pension numeric(10, 0) not null default 0 check (welfare_pension >= 0),
  long_term_care_insurance numeric(10, 0) not null default 0 check (long_term_care_insurance >= 0),
  employment_insurance numeric(10, 0) not null default 0 check (employment_insurance >= 0),
  total_social_insurance numeric(10, 0) not null default 0 check (total_social_insurance >= 0),

  -- 源泉徴収（算出率表）
  withholding_rate numeric(5, 4) not null check (withholding_rate >= 0 and withholding_rate < 1),
  withholding_tax numeric(10, 0) not null default 0 check (withholding_tax >= 0),

  -- 控除合計・差引支給額
  total_deductions numeric(10, 0) not null check (total_deductions >= 0),
  net_bonus numeric(12, 0) not null,

  -- スナップショット（再現性、計算時点の値固定）
  previous_month_taxable_amount numeric(12, 0) not null
    check (previous_month_taxable_amount >= 0),
  kou_otsu_at_calculation text not null
    check (kou_otsu_at_calculation in ('kou', 'otsu')),
  dependents_count_at_calculation int not null
    check (dependents_count_at_calculation between 0 and 20),
  health_capped boolean not null default false,
  pension_capped boolean not null default false,

  -- 状態
  status text not null default 'calculated'
    check (status in ('calculated', 'approved', 'paid', 'cancelled')),

  -- 監査
  calculated_at timestamptz not null default now(),
  calculated_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  paid_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),
  deleted_reason text,

  constraint uq_bonus_period_employee
    unique (payroll_period_id, employee_id),
  constraint chk_bonus_net_consistency
    check (net_bonus = gross_bonus - total_deductions)
);

comment on table public.bud_bonus_records is
  '賞与（夏冬・決算）の計算結果。Cat 4 #28 反映: admin のみ INSERT/UPDATE。net_bonus = gross_bonus - total_deductions の整合性 CHECK。';

create index if not exists idx_bud_bonus_period
  on public.bud_bonus_records (payroll_period_id);
create index if not exists idx_bud_bonus_employee_payment
  on public.bud_bonus_records (employee_id, bonus_payment_date desc);
create index if not exists idx_bud_bonus_status
  on public.bud_bonus_records (status);

-- ------------------------------------------------------------
-- 2. bud_bonus_withholding_rate_table（賞与算出率表）
-- ------------------------------------------------------------
-- 国税庁「賞与に対する源泉徴収税額の算出率の表」
-- 前月給与の社会保険料控除後の金額 × 甲乙別 × 扶養人数別
-- 7 人超は dependents_7 の率を流用（実態として変動小）
create table if not exists public.bud_bonus_withholding_rate_table (
  id uuid primary key default gen_random_uuid(),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  kou_otsu text not null check (kou_otsu in ('kou', 'otsu')),
  previous_month_min numeric(10, 0) not null check (previous_month_min >= 0),
  previous_month_max numeric(10, 0)
    check (previous_month_max is null or previous_month_max > previous_month_min),
  dependents_0 numeric(5, 4) not null check (dependents_0 >= 0 and dependents_0 < 1),
  dependents_1 numeric(5, 4) not null check (dependents_1 >= 0 and dependents_1 < 1),
  dependents_2 numeric(5, 4) not null check (dependents_2 >= 0 and dependents_2 < 1),
  dependents_3 numeric(5, 4) not null check (dependents_3 >= 0 and dependents_3 < 1),
  dependents_4 numeric(5, 4) not null check (dependents_4 >= 0 and dependents_4 < 1),
  dependents_5 numeric(5, 4) not null check (dependents_5 >= 0 and dependents_5 < 1),
  dependents_6 numeric(5, 4) not null check (dependents_6 >= 0 and dependents_6 < 1),
  dependents_7 numeric(5, 4) not null check (dependents_7 >= 0 and dependents_7 < 1),

  constraint uq_bonus_rate
    unique (effective_year, kou_otsu, previous_month_min, previous_month_max)
);

comment on table public.bud_bonus_withholding_rate_table is
  '賞与算出率表。前月給与の社保控除後額の範囲別 × 甲乙 × 扶養 0-7 人。7 人超は dependents_7 率を流用。';

create index if not exists idx_bonus_rate_lookup
  on public.bud_bonus_withholding_rate_table (effective_year, kou_otsu, previous_month_min);

-- ------------------------------------------------------------
-- 3. RLS（Cat 4 #28 反映: 賞与処理 admin only）
-- ------------------------------------------------------------

alter table public.bud_bonus_records enable row level security;
alter table public.bud_bonus_withholding_rate_table enable row level security;

-- ----- bud_bonus_records: 自分閲覧 + payroll_* SELECT、INSERT/UPDATE は admin のみ（Cat 4 #28）-----
drop policy if exists br_select on public.bud_bonus_records;
create policy br_select on public.bud_bonus_records
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- Cat 4 #28: 賞与処理 admin only INSERT/UPDATE（給与本体は payroll_calculator も可だが、賞与は admin 限定）
drop policy if exists br_insert_admin_only on public.bud_bonus_records;
create policy br_insert_admin_only on public.bud_bonus_records
  for insert
  with check (public.bud_is_admin_or_super_admin());

-- Cat 4 #28: 自起票禁止（admin が承認する場合は別 admin が必要、給与本体 V6 と同等の原則）
drop policy if exists br_update_admin_only on public.bud_bonus_records;
create policy br_update_admin_only on public.bud_bonus_records
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists br_no_delete on public.bud_bonus_records;
create policy br_no_delete on public.bud_bonus_records
  for delete
  using (false);

-- ----- bud_bonus_withholding_rate_table: payroll_* + admin SELECT、admin のみ書込 -----
drop policy if exists bwr_select on public.bud_bonus_withholding_rate_table;
create policy bwr_select on public.bud_bonus_withholding_rate_table
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bwr_insert_admin on public.bud_bonus_withholding_rate_table;
create policy bwr_insert_admin on public.bud_bonus_withholding_rate_table
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists bwr_update_admin on public.bud_bonus_withholding_rate_table;
create policy bwr_update_admin on public.bud_bonus_withholding_rate_table
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists bwr_no_delete on public.bud_bonus_withholding_rate_table;
create policy bwr_no_delete on public.bud_bonus_withholding_rate_table
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('bud_bonus_records', 'bud_bonus_withholding_rate_table');
--
-- -- Cat 4 #28 admin only RLS 確認
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
--   WHERE tablename = 'bud_bonus_records'
--   ORDER BY cmd, policyname;

-- ============================================================
-- migration: 20260507000006_bud_phase_d07_bank_transfer.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #07: 銀行振込連携（Cat 4 #27 同時出力 + ハイブリッド方式）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md
-- 作成: 2026-05-07（a-bud、main- No.99 GO 受領後 Day 5 前倒し着手）
--
-- 目的:
--   bud_salary_records / bud_bonus_records で確定した給与・賞与を、
--   銀行振込実行（全銀協 FB データ）+ 会計連携（8 大区分階層 CSV）+ MFC CSV（D-11、Cat 4 #27）の
--   3 経路同時出力（exportPayrollBatchHybrid）に対応するためのテーブル定義。
--
-- スコープ（本 migration で対応）:
--   1. bud_payroll_transfer_batches（給与振込バッチ、status 管理）
--   2. bud_payroll_transfer_items（個別明細、振込先スナップショット）
--   3. bud_payroll_accounting_reports（会計連携レポート、8 大区分階層 jsonb）
--   4. RLS（自分閲覧 + payroll_disburser/auditor + admin、admin/payroll_disburser INSERT/UPDATE）
--
-- 含めない:
--   - 計算本体（FB データ生成 / カナ変換 / CSV 生成）→ src/app/bud/payroll/_lib/transfer-* （純関数）
--   - 既存 A-04 連携 → 別 PR で対応想定
--   - 銀行休業日テーブル（root.holidays / bud.bank_holidays）→ Phase E
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_payroll_transfer_batches（給与振込バッチ）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_transfer_batches (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),
  company_id text not null references public.root_companies(company_id),
  source_bank_account_id uuid not null,                -- bud_company_bank_accounts(id) — 既存 Phase A
  transfer_type text not null
    check (transfer_type in ('salary', 'bonus')),
  scheduled_payment_date date not null,
  total_employees int not null check (total_employees >= 0),
  total_amount numeric(14, 0) not null check (total_amount >= 0),
  fb_data_path text,                                    -- Storage パス（generated 後セット）
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'fb_generated', 'uploaded_to_bank', 'completed', 'failed')),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  fb_generated_at timestamptz,
  bank_uploaded_at timestamptz,
  completed_at timestamptz,
  failed_reason text,
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  constraint uq_transfer_batch_per_period_company_type
    unique (payroll_period_id, company_id, transfer_type)
);

comment on table public.bud_payroll_transfer_batches is
  '給与・賞与振込バッチ。1 法人 × 1 期間 × 1 種別（給与/賞与）で一意。Cat 4 #27 同時出力（FB / 会計レポート / MFC CSV）の起点。';

create index if not exists idx_transfer_batches_status
  on public.bud_payroll_transfer_batches (status, scheduled_payment_date);
create index if not exists idx_transfer_batches_period
  on public.bud_payroll_transfer_batches (payroll_period_id, transfer_type);

-- ------------------------------------------------------------
-- 2. bud_payroll_transfer_items（個別明細）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_transfer_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bud_payroll_transfer_batches(id) on delete cascade,
  salary_record_id uuid references public.bud_salary_records(id),
  bonus_record_id uuid references public.bud_bonus_records(id),
  employee_id text not null references public.root_employees(employee_id),

  -- 振込情報スナップショット（A-04 連携用、口座変更時の再現性保証）
  recipient_bank_code text not null check (recipient_bank_code ~ '^[0-9]{4}$'),
  recipient_branch_code text not null check (recipient_branch_code ~ '^[0-9]{3}$'),
  recipient_account_type text not null
    check (recipient_account_type in ('普通', '当座', '貯蓄')),
  recipient_account_number text not null
    check (recipient_account_number ~ '^[0-9]+$' and length(recipient_account_number) between 1 and 8),
  recipient_account_holder text not null,             -- 半角カナ

  transfer_amount numeric(12, 0) not null check (transfer_amount >= 0),

  bud_furikomi_id uuid,                               -- A-04 連携用（既存 bud_furikomi）
  fb_record_no int,                                   -- FB データ内の連番

  item_status text not null default 'pending'
    check (item_status in ('pending', 'submitted', 'completed', 'failed', 'rejected')),
  failed_reason text,

  -- salary_record_id / bonus_record_id は排他（XOR）
  constraint chk_salary_or_bonus
    check (
      (salary_record_id is not null and bonus_record_id is null)
      or (salary_record_id is null and bonus_record_id is not null)
    )
);

comment on table public.bud_payroll_transfer_items is
  '振込明細。1 batch × 1 employee = 1 行。salary_record_id と bonus_record_id は排他。振込先情報をスナップショット保存。';

create index if not exists idx_transfer_items_batch
  on public.bud_payroll_transfer_items (batch_id);
create index if not exists idx_transfer_items_employee
  on public.bud_payroll_transfer_items (employee_id, item_status);

-- ------------------------------------------------------------
-- 3. bud_payroll_accounting_reports（会計連携レポート、8 大区分階層）
-- ------------------------------------------------------------
-- 4 次 follow-up で 5 区分フラット → 8 大区分階層構造に拡張済み。
-- category_hierarchy jsonb に items[] / subtotal / is_future_use の階層構造で保持。
create table if not exists public.bud_payroll_accounting_reports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bud_payroll_transfer_batches(id) on delete cascade,

  -- 出力ファイル情報
  report_csv_storage_path text not null,
  report_csv_filename text not null,
  report_csv_size_bytes int not null check (report_csv_size_bytes > 0),
  report_csv_checksum text not null,                  -- SHA256

  -- 集計（メタ情報）
  total_employees int not null check (total_employees >= 0),
  total_amount numeric(14, 0) not null check (total_amount >= 0),

  -- 8 大区分階層（jsonb）
  -- 構造: {
  --   "役員報酬": { "items": [{name, amount}, ...], "subtotal": N, "is_future_use": false },
  --   "給与": {...},
  --   "賞与": {...},        -- 月次は通常 is_future_use=true
  --   "交通費": {...},
  --   "会社負担社保等": {...},
  --   "外注費": {...},
  --   "販売促進費": {...},
  --   "固定費等": {...}
  -- }
  category_hierarchy jsonb not null,

  -- メタ
  generated_at timestamptz not null default now(),
  generated_by text not null references public.root_employees(employee_id),
  downloaded_at timestamptz,
  downloaded_by text references public.root_employees(employee_id),
  imported_to_mf_at timestamptz,                      -- 東海林さん admin が MFC 会計取込確認後手動更新
  imported_to_mf_by text references public.root_employees(employee_id),
  shared_with_godo_at timestamptz,                    -- 後道さんへ共有時刻（参照系、Garden 上の確認フローには不在）
  shared_with_godo_by text references public.root_employees(employee_id),

  notes text,

  constraint uq_accounting_report_per_batch
    unique (batch_id)
);

comment on table public.bud_payroll_accounting_reports is
  '会計連携レポート（マネーフォワードクラウド会計取込用）。8 大区分階層 jsonb 構造。Cat 4 #27 で振込ファイル生成と同時生成。';

create index if not exists idx_accounting_reports_batch
  on public.bud_payroll_accounting_reports (batch_id);

-- ------------------------------------------------------------
-- 4. RLS（D-09 helpers 利用）
-- ------------------------------------------------------------

alter table public.bud_payroll_transfer_batches enable row level security;
alter table public.bud_payroll_transfer_items enable row level security;
alter table public.bud_payroll_accounting_reports enable row level security;

-- ----- bud_payroll_transfer_batches: payroll_disburser / auditor / admin SELECT、payroll_disburser + admin 書込 -----
drop policy if exists tb_select on public.bud_payroll_transfer_batches;
create policy tb_select on public.bud_payroll_transfer_batches
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists tb_insert on public.bud_payroll_transfer_batches;
create policy tb_insert on public.bud_payroll_transfer_batches
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists tb_update on public.bud_payroll_transfer_batches;
create policy tb_update on public.bud_payroll_transfer_batches
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists tb_no_delete on public.bud_payroll_transfer_batches;
create policy tb_no_delete on public.bud_payroll_transfer_batches
  for delete
  using (false);

-- ----- bud_payroll_transfer_items: 自分閲覧 + payroll_* + admin SELECT、payroll_disburser + admin 書込 -----
drop policy if exists ti_select on public.bud_payroll_transfer_items;
create policy ti_select on public.bud_payroll_transfer_items
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ti_insert on public.bud_payroll_transfer_items;
create policy ti_insert on public.bud_payroll_transfer_items
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ti_update on public.bud_payroll_transfer_items;
create policy ti_update on public.bud_payroll_transfer_items
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ti_no_delete on public.bud_payroll_transfer_items;
create policy ti_no_delete on public.bud_payroll_transfer_items
  for delete
  using (false);

-- ----- bud_payroll_accounting_reports: payroll_* + admin SELECT、payroll_disburser + admin 書込 -----
drop policy if exists ar_select on public.bud_payroll_accounting_reports;
create policy ar_select on public.bud_payroll_accounting_reports
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ar_insert on public.bud_payroll_accounting_reports;
create policy ar_insert on public.bud_payroll_accounting_reports
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ar_update on public.bud_payroll_accounting_reports;
create policy ar_update on public.bud_payroll_accounting_reports
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ar_no_delete on public.bud_payroll_accounting_reports;
create policy ar_no_delete on public.bud_payroll_accounting_reports
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'bud_payroll_transfer_batches',
--       'bud_payroll_transfer_items',
--       'bud_payroll_accounting_reports'
--     );

-- ============================================================
-- migration: 20260507000007_bud_phase_d11_mfc_csv_export.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #11: MFC 互換 CSV 出力（72 列 / cp932 / 9 カテゴリ、4 次 follow-up 7 段階）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-26-bud-phase-d-11-mfc-csv-export.md
-- 作成: 2026-05-07（a-bud、main- No.101 GO 受領後 Day 6 前倒し着手）
--
-- 目的:
--   Garden で計算した給与結果を、マネーフォワードクラウド給与（MFC）が要求する
--   72 列 CSV 仕様に変換して出力する基盤テーブル。MFC 側でインポートして
--   給与確定 → 振込配信する運用を実現。Cat 4 #27 同時出力の経路 C を担う。
--
-- スコープ（本 migration で対応）:
--   1. bud_mfc_csv_exports（出力ログ、4 次 follow-up 7 段階 status）
--   2. bud_mfc_csv_export_items（出力された各従業員行のスナップショット、jsonb csv_row_data）
--   3. Storage バケット注記（運用文書、実 INSERT は手動）
--   4. RLS（4 次 follow-up: 5 ロール対応 = payroll_calculator/approver/disburser/auditor/visual_checker）
--
-- 含めない:
--   - 計算本体（72 列マッパー / cp932 エンコーダー）→ src/app/bud/payroll/_lib/mfc-csv-* （純関数）
--   - Storage バケット作成 → 別 migration（東海林さん admin Dashboard で実行）
--   - 70+ 列の完全マッピング → memory project_mfc_payroll_csv_format.md が正本、本 migration は jsonb で柔軟保持
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_mfc_csv_exports（出力ログ、4 次 follow-up 7 段階）
-- ------------------------------------------------------------
create table if not exists public.bud_mfc_csv_exports (
  id uuid primary key default gen_random_uuid(),
  pay_period date not null,                          -- 支給対象月の 1 日
  pay_date date not null,                             -- 支給日
  generated_at timestamptz not null default now(),
  generated_by text not null references public.root_employees(employee_id),
  generator_role text not null
    check (generator_role in ('payroll_calculator', 'payroll_disburser')),

  -- 集計（メタ情報）
  total_employees int not null check (total_employees >= 0),
  total_taxable_payment bigint not null check (total_taxable_payment >= 0),
  total_non_taxable_payment bigint not null check (total_non_taxable_payment >= 0),
  total_deduction bigint not null check (total_deduction >= 0),

  -- Storage 情報（uuid 化パス、admin only DL）
  csv_storage_path text not null unique,             -- bud-mfc-csv-exports/{uuid}.csv
  csv_filename text not null,                        -- 表示用、e.g. mfc_20260531.csv
  csv_size_bytes int not null check (csv_size_bytes > 0),
  csv_checksum text not null,                        -- SHA256

  -- ステータス（4 次 follow-up: 6 → 7 段階に拡張、D-10 と整合）
  status text not null default 'draft'
    check (status in (
      'draft',                    -- CSV 生成済、未承認
      'approved',                 -- payroll_approver 承認済
      'exported',                 -- payroll_disburser DL + MFC 取込実行
      'confirmed_by_auditor',     -- ④ payroll_auditor 目視確認完了
      'visual_double_checked',    -- ⑤ payroll_visual_checker（上田）目視ダブルチェック OK
      'confirmed_by_sharoshi',    -- ⑥ 社労士 OK 受領済
      'imported_to_mfc'           -- ⑦ MFC 取込最終確認
    )),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  exported_at timestamptz,                            -- DL + MFC 取込実行時刻
  exported_by text references public.root_employees(employee_id),
  confirmed_by_auditor_at timestamptz,                -- ④ 東海林目視確認
  confirmed_by_auditor_by text references public.root_employees(employee_id),
  visual_double_check_requested_at timestamptz,       -- ⑤ 上田に目視ダブルチェック依頼時刻
  visual_double_checked_at timestamptz,               -- ⑤ 上田が OK 戻した時刻
  visual_double_checked_by text references public.root_employees(employee_id),
  visual_check_note text,                             -- ⑤ 上田の特記事項 / NG 内容
  sharoshi_request_sent_at timestamptz,               -- ⑥ 社労士確認依頼送信時刻
  sharoshi_partner_id uuid,                           -- 依頼先 root_partners（D-10 仕様、Root 移管時に FK 追加）
  confirmed_by_sharoshi_at timestamptz,               -- ⑥ 社労士 OK マーク
  confirmed_by_sharoshi_by text references public.root_employees(employee_id),
  sharoshi_confirmation_note text,                    -- 社労士返答内容
  imported_at timestamptz,                            -- ⑦ 最終 MFC 取込確認後に手動更新
  imported_by text references public.root_employees(employee_id),

  -- 監査
  download_count int not null default 0 check (download_count >= 0),
  last_downloaded_at timestamptz,
  last_downloaded_by text references public.root_employees(employee_id),

  -- メタ
  notes text,
  created_at timestamptz not null default now(),

  constraint uq_mfc_export_per_pay_date
    unique (pay_period, pay_date)
);

comment on table public.bud_mfc_csv_exports is
  'MFC 互換 CSV 出力ログ。4 次 follow-up 7 段階 status（visual_double_checked 含む）。Cat 4 #27 同時出力の経路 C。';

create index if not exists idx_mfc_csv_status
  on public.bud_mfc_csv_exports (status, pay_period desc);
create index if not exists idx_mfc_csv_period
  on public.bud_mfc_csv_exports (pay_period desc);

-- ------------------------------------------------------------
-- 2. bud_mfc_csv_export_items（各従業員行のスナップショット）
-- ------------------------------------------------------------
-- 意図: CSV ファイルを再生成しなくても DB から 72 列内容を確認可能（監査・トラブル対応）
create table if not exists public.bud_mfc_csv_export_items (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references public.bud_mfc_csv_exports(id) on delete cascade,
  employee_id text not null references public.root_employees(employee_id),
  payroll_record_id uuid not null references public.bud_salary_records(id),
  row_index int not null check (row_index >= 1),     -- CSV 内の行番号（1-based）
  csv_row_data jsonb not null,                       -- 72 列データのスナップショット
  created_at timestamptz not null default now(),

  constraint uq_export_employee unique (export_id, employee_id),
  constraint uq_export_row unique (export_id, row_index)
);

comment on table public.bud_mfc_csv_export_items is
  'MFC CSV 各行のスナップショット。jsonb で 72 列データを保持、CSV 再生成なしで監査可能。';

create index if not exists idx_mfc_items_employee
  on public.bud_mfc_csv_export_items (employee_id, created_at desc);

-- ------------------------------------------------------------
-- 3. RLS（4 次 follow-up: 5 ロール対応）
-- ------------------------------------------------------------
alter table public.bud_mfc_csv_exports enable row level security;
alter table public.bud_mfc_csv_export_items enable row level security;

-- ----- bud_mfc_csv_exports RLS -----

-- SELECT: payroll_* 全員（visual_checker 含む）+ admin
drop policy if exists mfc_select on public.bud_mfc_csv_exports;
create policy mfc_select on public.bud_mfc_csv_exports
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_calculator + disburser（generateMfcCsv 経由）+ admin
drop policy if exists mfc_insert on public.bud_mfc_csv_exports;
create policy mfc_insert on public.bud_mfc_csv_exports
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

-- ① draft → approved: payroll_approver（V6 自己承認禁止: generated_by != approver）
drop policy if exists mfc_approve on public.bud_mfc_csv_exports;
create policy mfc_approve on public.bud_mfc_csv_exports
  for update
  using (
    status = 'draft'
    and public.bud_has_payroll_role(array['payroll_approver'])
    and generated_by <> (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  )
  with check (
    status = 'approved'
    and public.bud_has_payroll_role(array['payroll_approver'])
  );

-- ② approved → exported: payroll_disburser
drop policy if exists mfc_export on public.bud_mfc_csv_exports;
create policy mfc_export on public.bud_mfc_csv_exports
  for update
  using (status = 'approved' and public.bud_has_payroll_role(array['payroll_disburser']))
  with check (status = 'exported' and public.bud_has_payroll_role(array['payroll_disburser']));

-- ③ exported → confirmed_by_auditor: payroll_auditor（東海林目視確認）
drop policy if exists mfc_audit on public.bud_mfc_csv_exports;
create policy mfc_audit on public.bud_mfc_csv_exports
  for update
  using (status = 'exported' and public.bud_has_payroll_role(array['payroll_auditor']))
  with check (status = 'confirmed_by_auditor' and public.bud_has_payroll_role(array['payroll_auditor']));

-- ④-依頼: confirmed_by_auditor (status 据え置き) → visual_double_check_requested_at セット
drop policy if exists mfc_request_visual_check on public.bud_mfc_csv_exports;
create policy mfc_request_visual_check on public.bud_mfc_csv_exports
  for update
  using (status = 'confirmed_by_auditor' and public.bud_has_payroll_role(array['payroll_auditor']))
  with check (
    status = 'confirmed_by_auditor'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  );

-- ④ confirmed_by_auditor → visual_double_checked: payroll_visual_checker（上田）⭐ 4 次 follow-up
-- 上田は SELECT + 当該遷移のみ、編集権なし
drop policy if exists mfc_visual_check on public.bud_mfc_csv_exports;
create policy mfc_visual_check on public.bud_mfc_csv_exports
  for update
  using (
    status = 'confirmed_by_auditor'
    and public.bud_has_payroll_role(array['payroll_visual_checker'])
    and visual_double_check_requested_at is not null
  )
  with check (
    status = 'visual_double_checked'
    and public.bud_has_payroll_role(array['payroll_visual_checker'])
    and visual_double_checked_at is not null
    and visual_double_checked_by is not null
  );

-- ⑤ visual_double_checked → confirmed_by_sharoshi: payroll_auditor（社労士 OK 後マーク）
drop policy if exists mfc_sharoshi on public.bud_mfc_csv_exports;
create policy mfc_sharoshi on public.bud_mfc_csv_exports
  for update
  using (status = 'visual_double_checked' and public.bud_has_payroll_role(array['payroll_auditor']))
  with check (
    status = 'confirmed_by_sharoshi'
    and public.bud_has_payroll_role(array['payroll_auditor'])
    and sharoshi_request_sent_at is not null
    and sharoshi_partner_id is not null
  );

-- ⑥ confirmed_by_sharoshi → imported_to_mfc: payroll_auditor（最終確認）
drop policy if exists mfc_finalize on public.bud_mfc_csv_exports;
create policy mfc_finalize on public.bud_mfc_csv_exports
  for update
  using (status = 'confirmed_by_sharoshi' and public.bud_has_payroll_role(array['payroll_auditor']))
  with check (status = 'imported_to_mfc' and public.bud_has_payroll_role(array['payroll_auditor']));

-- 巻き戻し: 任意 stage → draft（payroll_auditor のみ、reason 必須は呼び出し側で監査ログ記録）
drop policy if exists mfc_rollback on public.bud_mfc_csv_exports;
create policy mfc_rollback on public.bud_mfc_csv_exports
  for update
  using (
    status in ('approved', 'exported', 'confirmed_by_auditor', 'visual_double_checked', 'confirmed_by_sharoshi')
    and public.bud_has_payroll_role(array['payroll_auditor'])
  )
  with check (status = 'draft' and public.bud_has_payroll_role(array['payroll_auditor']));

-- DELETE: 完全禁止
drop policy if exists mfc_no_delete on public.bud_mfc_csv_exports;
create policy mfc_no_delete on public.bud_mfc_csv_exports
  for delete
  using (false);

-- ----- bud_mfc_csv_export_items RLS -----
-- SELECT: payroll_* + admin（自分の行は ID 経由で個別判定、本テーブルは admin 主体）
drop policy if exists mfc_items_select on public.bud_mfc_csv_export_items;
create policy mfc_items_select on public.bud_mfc_csv_export_items
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_calculator/disburser + admin（CSV 生成と同時に書込）
drop policy if exists mfc_items_insert on public.bud_mfc_csv_export_items;
create policy mfc_items_insert on public.bud_mfc_csv_export_items
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

-- UPDATE / DELETE: 完全禁止（snapshot 不変）
drop policy if exists mfc_items_no_update on public.bud_mfc_csv_export_items;
create policy mfc_items_no_update on public.bud_mfc_csv_export_items
  for update
  using (false);

drop policy if exists mfc_items_no_delete on public.bud_mfc_csv_export_items;
create policy mfc_items_no_delete on public.bud_mfc_csv_export_items
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('bud_mfc_csv_exports', 'bud_mfc_csv_export_items');
--
-- -- 4 次 follow-up 7 段階 status 確認
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.bud_mfc_csv_exports'::regclass
--     AND conname LIKE '%status%';

-- ============================================================
-- migration: 20260508000001_bud_phase_d04_statement_distribution.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #04: 給与明細配信（Y 案 + フォールバック + 上田目視 UI 連携）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-04-statement-distribution.md
-- 作成: 2026-05-08（a-bud、main- No.102 GO 受領後 Friday 朝 D-04 重実装着手）
--
-- 目的:
--   給与・賞与明細の PDF 配信を Y 案 + フォールバック方式で実装する基盤テーブル。
--   - 通常フロー: メール DL リンク（24h ワンタイム、PW なし PDF）+ LINE Bot 通知
--   - 例外フロー: メール DL リンク + PW 保護 PDF（強ランダム 16 文字）+ マイページ PW 確認
--   - 旧採択 MMDD 4 桁 PW は a-review #1 で破棄、本 migration で完全置換
--
-- スコープ（本 migration で対応）:
--   1. bud_payroll_notifications（配信ステータス管理、Y 案 + フォールバック）
--   2. bud_salary_statements（PDF 生成記録、SHA256 改ざん検知）
--   3. RLS（自分閲覧 + admin、INSERT は service_role / payroll_disburser、DELETE 完全禁止）
--
-- 含めない:
--   - PDF 生成本体（@react-pdf/renderer 利用）→ Server Action / API Route
--   - Storage バケット bud-salary-statements 作成 → 別 migration（admin Dashboard）
--   - メール送信（Resend / SendGrid）→ Server Action / Cron
--   - LINE Bot Messaging API → Server Action / Webhook
--   - Cron リトライ → /api/cron/bud-payroll-notification-retry
--   - 純関数（PW gen / token gen / delivery_method 判定）→ src/app/bud/payroll/_lib/distribution-*.ts
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_payroll_notifications（配信ステータス管理）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_notifications (
  id uuid primary key default gen_random_uuid(),
  salary_record_id uuid references public.bud_salary_records(id),
  bonus_record_id uuid references public.bud_bonus_records(id),
  employee_id text not null references public.root_employees(employee_id),

  -- 配信方式（Y 案採択で 3 種に確定）
  delivery_method text not null
    check (delivery_method in ('line_email', 'fallback_email_pw', 'manual')),
    -- 'line_email'         = 通常: メール DL リンク + LINE Bot
    -- 'fallback_email_pw'  = 例外: メール DL リンク + PW 保護 PDF
    -- 'manual'             = メアド未登録・admin 個別対応

  -- 全体ステータス
  overall_status text not null default 'pending'
    check (overall_status in ('pending', 'sent', 'failed', 'pending_retry', 'cancelled')),
  retry_count int not null default 0
    check (retry_count >= 0 and retry_count <= 4),
  last_attempt_at timestamptz,
  next_retry_at timestamptz,

  -- メール経路（DL リンク）
  email_status text
    check (email_status is null or email_status in ('sent', 'failed', 'opened', 'downloaded', 'bounced')),
  email_to text,                                      -- 配信時点のスナップショット
  email_provider_message_id text,                     -- Resend / SendGrid 等の ID
  email_sent_at timestamptz,
  email_failed_reason text,

  -- DL リンク（24h ワンタイム）
  dl_token text unique,                               -- crypto.randomBytes(32).toString('base64url')
  dl_token_expires_at timestamptz,
  dl_used_at timestamptz,                             -- ワンタイム消費時刻
  dl_ip text,                                         -- 使用時の IP（監査）

  -- LINE Bot 経路
  line_status text
    check (line_status is null or line_status in ('sent', 'failed', 'unsupported', 'unfriend')),
  line_user_id_hash text,                             -- 配信時の LINE User ID（hash 化、PII 拡散防止）
  line_message_id text,                               -- LINE Platform 発行 ID
  line_sent_at timestamptz,
  line_failed_reason text,

  -- フォールバック PW（例外フロー時のみ、平文非保存）
  fallback_password_hash text,                        -- bcrypt + ランダムソルト
  fallback_password_plain_temp bytea,                 -- マイページ表示用、24h 期限後マスク（暗号化推奨）
  fallback_password_displayed_at timestamptz,         -- マイページで表示した時刻（監査）

  -- 現金手渡し受領確認
  cash_receipt_confirmed_at timestamptz,
  cash_receipt_paper_signed boolean not null default false,

  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- salary_record_id と bonus_record_id は排他（XOR）
  constraint chk_salary_or_bonus_xor
    check (
      (salary_record_id is not null and bonus_record_id is null)
      or (salary_record_id is null and bonus_record_id is not null)
    ),

  -- フォールバック時は PW 必須
  constraint chk_fallback_pw_required
    check (
      delivery_method <> 'fallback_email_pw'
      or fallback_password_hash is not null
    ),

  -- DL リンク発行時は expiry 必須
  constraint chk_dl_token_expiry
    check (
      dl_token is null
      or dl_token_expires_at is not null
    )
);

comment on table public.bud_payroll_notifications is
  '給与・賞与明細の配信ステータス管理。Y 案 + フォールバック対応、24h ワンタイム DL リンク + LINE Bot 通知 + フォールバック時 PW 保護 PDF。salary_record_id と bonus_record_id は排他（XOR）。';

create index if not exists idx_payroll_noti_pending_retry
  on public.bud_payroll_notifications (next_retry_at)
  where overall_status = 'pending_retry';

create index if not exists idx_payroll_noti_employee
  on public.bud_payroll_notifications (employee_id, created_at desc);

create index if not exists idx_payroll_noti_dl_token
  on public.bud_payroll_notifications (dl_token)
  where dl_token is not null and dl_used_at is null;

create index if not exists idx_payroll_noti_overall_status
  on public.bud_payroll_notifications (overall_status, created_at desc);

-- ------------------------------------------------------------
-- 2. bud_salary_statements（PDF 生成記録）
-- ------------------------------------------------------------
create table if not exists public.bud_salary_statements (
  id uuid primary key default gen_random_uuid(),
  salary_record_id uuid references public.bud_salary_records(id),
  bonus_record_id uuid references public.bud_bonus_records(id),
  employee_id text not null references public.root_employees(employee_id),
  statement_type text not null
    check (statement_type in ('salary', 'bonus')),
  storage_path text not null,                         -- bud-salary-statements/{uuid}/{period}.pdf
  file_size_bytes int not null check (file_size_bytes > 0),
  pdf_checksum text not null,                         -- SHA256（改ざん検知）
  generated_at timestamptz not null default now(),
  generated_by text references public.root_employees(employee_id),
  notification_sent_at timestamptz,
  notification_chatwork_message_id text,
  download_count int not null default 0 check (download_count >= 0),
  last_downloaded_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  constraint chk_salary_or_bonus_type_consistency
    check (
      (salary_record_id is not null and bonus_record_id is null and statement_type = 'salary')
      or (salary_record_id is null and bonus_record_id is not null and statement_type = 'bonus')
    )
);

comment on table public.bud_salary_statements is
  '給与・賞与明細 PDF の生成記録。SHA256 改ざん検知、5 年保管（労基法 109 条）。salary_record_id / bonus_record_id と statement_type の整合性 CHECK。';

create index if not exists idx_statements_employee
  on public.bud_salary_statements (employee_id, generated_at desc);
create index if not exists idx_statements_period
  on public.bud_salary_statements (salary_record_id, bonus_record_id);

-- ------------------------------------------------------------
-- 3. RLS（D-09 helpers 利用）
-- ------------------------------------------------------------
alter table public.bud_payroll_notifications enable row level security;
alter table public.bud_salary_statements enable row level security;

-- ----- bud_payroll_notifications RLS -----
-- SELECT: 自分の通知 + payroll_* + admin
drop policy if exists pn_select on public.bud_payroll_notifications;
create policy pn_select on public.bud_payroll_notifications
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_disburser + admin（service_role は RLS バイパス）
drop policy if exists pn_insert on public.bud_payroll_notifications;
create policy pn_insert on public.bud_payroll_notifications
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

-- UPDATE: payroll_disburser + admin（status 遷移、retry_count 等）
-- 自分の cash_receipt_confirmed_at 更新は別 policy で許容
drop policy if exists pn_update on public.bud_payroll_notifications;
create policy pn_update on public.bud_payroll_notifications
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

-- 自分の cash_receipt_confirmed_at は本人 UPDATE 可（受領確認ボタン）
drop policy if exists pn_update_cash_receipt_self on public.bud_payroll_notifications;
create policy pn_update_cash_receipt_self on public.bud_payroll_notifications
  for update
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  )
  with check (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  );

-- DELETE: 完全禁止（5 年保管、労基法 109 条）
drop policy if exists pn_no_delete on public.bud_payroll_notifications;
create policy pn_no_delete on public.bud_payroll_notifications
  for delete
  using (false);

-- ----- bud_salary_statements RLS -----
-- SELECT: 自分の明細 + payroll_* + admin
drop policy if exists ss_select on public.bud_salary_statements;
create policy ss_select on public.bud_salary_statements
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_disburser + admin（PDF 生成と同時、service_role は RLS バイパス）
drop policy if exists ss_insert on public.bud_salary_statements;
create policy ss_insert on public.bud_salary_statements
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

-- UPDATE: download_count / last_downloaded_at の自己更新のみ + admin
-- 本人による DL カウンター更新を許容（DL Server Action 経由）
drop policy if exists ss_update_download_self on public.bud_salary_statements;
create policy ss_update_download_self on public.bud_salary_statements
  for update
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_is_admin_or_super_admin()
  );

-- DELETE: 完全禁止
drop policy if exists ss_no_delete on public.bud_salary_statements;
create policy ss_no_delete on public.bud_salary_statements
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('bud_payroll_notifications', 'bud_salary_statements');
--
-- -- Y 案 + フォールバック対応の delivery_method 確認
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.bud_payroll_notifications'::regclass
--     AND conname LIKE '%delivery_method%';
--
-- -- フォールバック PW 必須 CHECK 確認
-- SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.bud_payroll_notifications'::regclass
--     AND conname = 'chk_fallback_pw_required';

-- ============================================================
-- migration: 20260508000002_bud_phase_d10_payroll_integration.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #10: 給与計算統合（Excel 排除 + Tree 源泉 + Bloom 集計連携）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-26-bud-phase-d-10-payroll-calculation.md
-- 作成: 2026-05-08（a-bud、main- No.119 GO 受領後 Friday 朝 D-10 統合中核着手）
--
-- 目的:
--   給与計算 Excel（「【月1】給与計算用」+ インセン計算シート）を Bud Phase D に完全統合し、
--   Excel を廃止する。インセン 5 種 + 部署別集計 + Tree 源泉データ取得 + 4 次 follow-up 7 段階フロー
--   + 5 ロール RLS の集大成。Phase D の中核。
--
-- スコープ（本 migration で対応）:
--   1. bud_payroll_records（給与計算結果の正本、4 次 follow-up 7 段階 status + 5 ロール）
--   2. bud_payroll_calculation_history（計算履歴、監査）
--   3. bud_incentive_rate_tables（係数表、jsonb 5 種インセン）
--   4. RLS（5 ロール × 7 段階遷移、V6 自起票禁止、上田 visual_check policy）
--
-- 含めない:
--   - 計算本体（5 種インセン + 部署別集計）→ src/app/bud/payroll/_lib/incentive-*.ts （純関数）
--   - Tree 源泉ビュー定義 → a-tree との協議で別 migration（tree.kpi_summary_for_bud）
--   - Server Action 8 種（calculate / approve / requestVisualDoubleCheck etc.）→ 別実装
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_payroll_records（給与計算結果の正本、Cat 4 #26 7 段階）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_records (
  id uuid primary key default gen_random_uuid(),
  pay_period date not null,                           -- 支給対象月（月初日）
  pay_date date not null,                             -- 支給日
  employee_id text not null references public.root_employees(employee_id),

  -- D-02 連携（法定計算結果のスナップショット）
  salary_record_id uuid references public.bud_salary_records(id),

  -- インセン計算結果（本 spec の主要範囲、5 種）
  ap_incentive bigint not null default 0 check (ap_incentive >= 0),
  case_incentive bigint not null default 0 check (case_incentive >= 0),
  president_incentive bigint not null default 0 check (president_incentive >= 0),
  team_victory_bonus bigint not null default 0 check (team_victory_bonus >= 0),
  p_achievement_bonus bigint not null default 0 check (p_achievement_bonus >= 0),

  -- 部署別集計（参考、計算根拠）
  team_id uuid,                                       -- root.teams(id) FK は Root spec 安定後に追加
  team_efficiency numeric(5,2),
  target_p int check (target_p is null or target_p >= 0),
  achieved_p int check (achieved_p is null or achieved_p >= 0),
  achievement_rate numeric(5,2) check (achievement_rate is null or achievement_rate >= 0),

  -- 集計結果（D-02 + インセン、円）
  total_taxable_payment bigint not null default 0 check (total_taxable_payment >= 0),
  total_non_taxable_payment bigint not null default 0 check (total_non_taxable_payment >= 0),
  total_deduction bigint not null default 0 check (total_deduction >= 0),
  net_payment bigint not null default 0,

  -- 計算スナップショット（再計算時の根拠保存）
  calculation_snapshot jsonb not null,                -- 入力値・係数・式の全履歴
  calculation_version text not null,                  -- ロジックバージョン（'v1.0' 等）

  -- ステータス（4 次 follow-up: 7 段階フロー、Cat 4 #26 反映）
  -- 「⑤ visual_double_checked = 上田君目視ダブルチェック」を挿入
  -- 「後道さん確認」工程は廃止（Garden 上の確認フローに不在）
  status text not null default 'draft'
    check (status in (
      'draft',
      'calculated',               -- ① 上田 (payroll_calculator)
      'approved',                 -- ② 宮永・小泉 (payroll_approver) V6 自起票禁止
      'exported',                 -- ③ 上田 (payroll_disburser) MFC CSV 生成 + 取込実行
      'confirmed_by_auditor',     -- ④ 東海林 (payroll_auditor) 目視確認
      'visual_double_checked',    -- ⑤ 上田 (payroll_visual_checker) 目視ダブルチェック ⭐ Cat 4 #26
      'confirmed_by_sharoshi',    -- ⑥ 社労士 OK 後、東海林がマーク
      'finalized'                 -- ⑦ 東海林 確定処理（=振込実行）
    )),
  calculated_at timestamptz,
  calculated_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  exported_at timestamptz,
  exported_to_csv_id uuid,                            -- D-11 bud_mfc_csv_exports(id) 連携
  confirmed_by_auditor_at timestamptz,
  confirmed_by_auditor_by text references public.root_employees(employee_id),
  visual_double_check_requested_at timestamptz,       -- ⑤ Cat 4 #26
  visual_double_checked_at timestamptz,
  visual_double_checked_by text references public.root_employees(employee_id),
  visual_check_note text,
  sharoshi_request_sent_at timestamptz,
  sharoshi_partner_id uuid,                           -- root.partners(id) FK は Root 移管時に追加
  confirmed_by_sharoshi_at timestamptz,
  confirmed_by_sharoshi_by text references public.root_employees(employee_id),
  sharoshi_confirmation_note text,
  finalized_at timestamptz,
  finalized_by text references public.root_employees(employee_id),

  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,

  constraint uq_payroll_per_employee_month
    unique (employee_id, pay_period)
);

comment on table public.bud_payroll_records is
  '給与計算結果の正本。4 次 follow-up Cat 4 #26 反映 7 段階 status + 5 ロール体制の中核。インセン 5 種 + 部署別集計 + D-02 法定計算 + D-11 MFC CSV を統合。1 employee × 1 month UNIQUE。';

create index if not exists idx_payroll_period
  on public.bud_payroll_records (pay_period desc);
create index if not exists idx_payroll_status
  on public.bud_payroll_records (status, pay_period desc);
create index if not exists idx_payroll_team_period
  on public.bud_payroll_records (team_id, pay_period desc);

-- ------------------------------------------------------------
-- 2. bud_payroll_calculation_history（計算履歴、監査）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_calculation_history (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null references public.bud_payroll_records(id) on delete cascade,
  action text not null
    check (action in (
      'calculated',
      'recalculated',
      'approved',
      'rejected',
      'exported',
      'confirmed_by_auditor',
      'visual_double_check_requested',
      'visual_double_checked',
      'visual_double_check_rejected',
      'sharoshi_requested',
      'confirmed_by_sharoshi',
      'finalized',
      'rolled_back_to_draft'
    )),
  performed_at timestamptz not null default now(),
  performed_by text not null references public.root_employees(employee_id),
  performer_role text not null
    check (performer_role in (
      'payroll_calculator',
      'payroll_approver',
      'payroll_disburser',
      'payroll_auditor',
      'payroll_visual_checker',
      'admin',
      'super_admin'
    )),
  before_snapshot jsonb,                              -- 変更前の payroll_record（再計算時）
  after_snapshot jsonb,
  reason text                                         -- 再計算理由・差戻し理由（巻き戻し時必須は呼び出し側）
);

comment on table public.bud_payroll_calculation_history is
  '計算履歴・状態遷移の監査ログ。すべての action（calculated/approved/visual_double_checked/rolled_back_to_draft 等）を記録。';

create index if not exists idx_pch_record
  on public.bud_payroll_calculation_history (payroll_record_id, performed_at desc);
create index if not exists idx_pch_action
  on public.bud_payroll_calculation_history (action, performed_at desc);

-- ------------------------------------------------------------
-- 3. bud_incentive_rate_tables（係数表、5 種インセン）
-- ------------------------------------------------------------
-- table_data jsonb 構造例:
-- {
--   "ap": { "rate_per_aporan": 500 },
--   "case": [
--     { "from": 0, "to": 5, "amount_per_case": 1000 },
--     { "from": 6, "to": 10, "amount_per_case": 1500 },
--     { "from": 11, "to": null, "amount_per_case": 2000 }
--   ],
--   "president": { "top_n": 3, "rewards": [50000, 30000, 20000] },
--   "team_victory": { "achievement_threshold": 1.0, "amount_per_member": 5000 },
--   "p_achievement": [
--     { "rate_from": 1.0, "rate_to": 1.2, "bonus": 10000 },
--     { "rate_from": 1.2, "rate_to": null, "bonus": 30000 }
--   ]
-- }
create table if not exists public.bud_incentive_rate_tables (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  company_id text references public.root_companies(company_id),  -- NULL = 全社共通
  table_data jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id)
);

comment on table public.bud_incentive_rate_tables is
  'インセン 5 種（AP / 件数 / 社長賞 / チーム勝利金 / P 達成金）の係数・段階表。法人別 + 期別管理。';

create index if not exists idx_incentive_rate_active
  on public.bud_incentive_rate_tables (company_id, effective_from desc)
  where effective_to is null;

-- ------------------------------------------------------------
-- 4. RLS（5 ロール × 7 段階、Cat 4 #26 反映）
-- ------------------------------------------------------------
alter table public.bud_payroll_records enable row level security;
alter table public.bud_payroll_calculation_history enable row level security;
alter table public.bud_incentive_rate_tables enable row level security;

-- ----- bud_payroll_records RLS -----

-- SELECT: 本人 + payroll_* 全員 + admin
drop policy if exists pr_select on public.bud_payroll_records;
create policy pr_select on public.bud_payroll_records
  for select
  using (
    employee_id = (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_calculator + admin（initial draft 起票）
drop policy if exists pr_insert on public.bud_payroll_records;
create policy pr_insert on public.bud_payroll_records
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

-- ① draft → calculated: payroll_calculator
drop policy if exists pr_calculate on public.bud_payroll_records;
create policy pr_calculate on public.bud_payroll_records
  for update
  using (
    status in ('draft', 'calculated')
    and public.bud_has_payroll_role(array['payroll_calculator'])
  )
  with check (
    status = 'calculated'
    and public.bud_has_payroll_role(array['payroll_calculator'])
  );

-- ② calculated → approved: payroll_approver（V6 自己承認禁止: calculated_by != approver）
drop policy if exists pr_approve on public.bud_payroll_records;
create policy pr_approve on public.bud_payroll_records
  for update
  using (
    status = 'calculated'
    and public.bud_has_payroll_role(array['payroll_approver'])
    and calculated_by <> (select employee_id from public.root_employees where employee_number = public.auth_employee_number())
  )
  with check (
    status = 'approved'
    and public.bud_has_payroll_role(array['payroll_approver'])
  );

-- ③ approved → exported: payroll_disburser
drop policy if exists pr_export on public.bud_payroll_records;
create policy pr_export on public.bud_payroll_records
  for update
  using (
    status = 'approved'
    and public.bud_has_payroll_role(array['payroll_disburser'])
  )
  with check (
    status = 'exported'
    and public.bud_has_payroll_role(array['payroll_disburser'])
  );

-- ④ exported → confirmed_by_auditor: payroll_auditor（東海林目視）
drop policy if exists pr_audit on public.bud_payroll_records;
create policy pr_audit on public.bud_payroll_records
  for update
  using (
    status = 'exported'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  )
  with check (
    status = 'confirmed_by_auditor'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  );

-- ④-依頼: confirmed_by_auditor (status 据え置き) → visual_double_check_requested_at セット ⭐ Cat 4 #26
drop policy if exists pr_request_visual_check on public.bud_payroll_records;
create policy pr_request_visual_check on public.bud_payroll_records
  for update
  using (
    status = 'confirmed_by_auditor'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  )
  with check (
    status = 'confirmed_by_auditor'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  );

-- ⑤ confirmed_by_auditor → visual_double_checked: payroll_visual_checker（上田、Cat 4 #26）⭐ NEW
-- 上田は SELECT + 当該遷移のみ、編集権なし、依頼送信済必須
drop policy if exists pr_visual_check on public.bud_payroll_records;
create policy pr_visual_check on public.bud_payroll_records
  for update
  using (
    status = 'confirmed_by_auditor'
    and public.bud_has_payroll_role(array['payroll_visual_checker'])
    and visual_double_check_requested_at is not null
  )
  with check (
    status = 'visual_double_checked'
    and public.bud_has_payroll_role(array['payroll_visual_checker'])
    and visual_double_checked_at is not null
    and visual_double_checked_by is not null
  );

-- ⑥ visual_double_checked → confirmed_by_sharoshi: payroll_auditor
drop policy if exists pr_sharoshi on public.bud_payroll_records;
create policy pr_sharoshi on public.bud_payroll_records
  for update
  using (
    status = 'visual_double_checked'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  )
  with check (
    status = 'confirmed_by_sharoshi'
    and public.bud_has_payroll_role(array['payroll_auditor'])
    and sharoshi_request_sent_at is not null
    and sharoshi_partner_id is not null
  );

-- ⑦ confirmed_by_sharoshi → finalized: payroll_auditor（東海林、振込実行）
drop policy if exists pr_finalize on public.bud_payroll_records;
create policy pr_finalize on public.bud_payroll_records
  for update
  using (
    status = 'confirmed_by_sharoshi'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  )
  with check (
    status = 'finalized'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  );

-- 巻き戻し: 任意 stage → draft（payroll_auditor のみ、reason 必須は監査ログで保証）
drop policy if exists pr_rollback_to_draft on public.bud_payroll_records;
create policy pr_rollback_to_draft on public.bud_payroll_records
  for update
  using (
    status in ('calculated', 'approved', 'exported', 'confirmed_by_auditor', 'visual_double_checked', 'confirmed_by_sharoshi')
    and public.bud_has_payroll_role(array['payroll_auditor'])
  )
  with check (
    status = 'draft'
    and public.bud_has_payroll_role(array['payroll_auditor'])
  );

-- DELETE: 完全禁止（status='draft' 戻しで論理削除代替）
drop policy if exists pr_no_delete on public.bud_payroll_records;
create policy pr_no_delete on public.bud_payroll_records
  for delete
  using (false);

-- ----- bud_payroll_calculation_history RLS -----
-- SELECT: 全 payroll_* + admin
drop policy if exists pch_select on public.bud_payroll_calculation_history;
create policy pch_select on public.bud_payroll_calculation_history
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: 全 payroll_* + admin（status 遷移と同時に履歴追加）
drop policy if exists pch_insert on public.bud_payroll_calculation_history;
create policy pch_insert on public.bud_payroll_calculation_history
  for insert
  with check (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- UPDATE / DELETE: 完全禁止（監査履歴は不変）
drop policy if exists pch_no_update on public.bud_payroll_calculation_history;
create policy pch_no_update on public.bud_payroll_calculation_history
  for update
  using (false);

drop policy if exists pch_no_delete on public.bud_payroll_calculation_history;
create policy pch_no_delete on public.bud_payroll_calculation_history
  for delete
  using (false);

-- ----- bud_incentive_rate_tables RLS -----
-- マスタデータ: payroll_* SELECT、admin のみ書込
drop policy if exists irt_select on public.bud_incentive_rate_tables;
create policy irt_select on public.bud_incentive_rate_tables
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists irt_write on public.bud_incentive_rate_tables;
create policy irt_write on public.bud_incentive_rate_tables
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists irt_update on public.bud_incentive_rate_tables;
create policy irt_update on public.bud_incentive_rate_tables
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists irt_no_delete on public.bud_incentive_rate_tables;
create policy irt_no_delete on public.bud_incentive_rate_tables
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- -- 7 段階 status enum 確認
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.bud_payroll_records'::regclass
--     AND conname LIKE '%status%';
--
-- -- 5 ロール RLS policy 数確認（INSERT 1 + UPDATE 8 = 9 件想定）
-- SELECT count(*) FROM pg_policies
--   WHERE tablename = 'bud_payroll_records';

-- ============================================================
-- migration: 20260508000003_bud_phase_d12_payroll_schedule_reminder.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #12: 給与処理スケジュール + リマインダ通知システム
-- ============================================================
-- 対応 spec: docs/specs/2026-04-26-bud-phase-d-12-payroll-schedule-reminder.md
-- 作成: 2026-05-08（a-bud、main- No.124 GO 受領後 Friday 朝 D-12 着手）
--
-- 目的:
--   7 段階給与確定フロー（D-10 / D-11）の各 stage の予定日管理 + 自動リマインダ。
--   - 4 次 follow-up Cat 4 #26 反映（visual_double_check stage 含む 7 stage）
--   - 日次 Cron 09:00 JST で予定日チェック → Chatwork DM + Garden Toast 通知
--   - エスカレーション 3 段階（通常 / 東海林 DM / 全社員通知）
--   - 社労士外部通知（root_partners 経由、Garden ログイン不要）
--
-- スコープ（本 migration で対応）:
--   1. bud_payroll_schedule（stage 別予定日 / 実績日 / 担当者 / status）
--   2. bud_payroll_schedule_settings（admin 設定、各 stage offset_days）
--   3. bud_payroll_reminder_log（送信履歴）
--   4. RLS（payroll_* SELECT、payroll_auditor + admin 書込、reminder_log は service_role のみ INSERT）
--
-- 含めない:
--   - 計算本体（offset 計算 / severity 判定 / escalation）→ 純関数
--   - リマインダ Cron 実装 → 別実装（/api/cron/bud-payroll-reminder）
--   - Chatwork / Garden Toast 通知送信 → Server Action
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_payroll_schedule（給与処理スケジュール、7 stage）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_schedule (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.bud_payroll_periods(id) on delete cascade,

  stage text not null
    check (stage in (
      'calculation',
      'approval',
      'mfc_import',
      'audit',
      'visual_double_check',  -- 4 次 follow-up Cat 4 #26
      'sharoshi_check',
      'finalization'
    )),

  -- 予定日 / 実績日
  planned_date date not null,
  actual_date date,

  -- 担当者
  assigned_to_employee_id text references public.root_employees(employee_id),
  assigned_to_partner_id uuid,                     -- root.partners(id) FK は Root 移管時に追加

  -- ステータス
  status text not null default 'not_started'
    check (status in (
      'not_started',
      'in_progress',
      'completed',
      'overdue'
    )),

  -- リマインダ送信履歴
  reminder_count int not null default 0
    check (reminder_count >= 0),
  last_reminder_sent_at timestamptz,
  escalation_level int not null default 0
    check (escalation_level between 0 and 2),       -- 0=通常 / 1=東海林さん DM / 2=全社員通知

  -- メタ
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_schedule_per_period_stage
    unique (period_id, stage),
  -- sharoshi_check 時のみ partner_id NOT NULL、それ以外は NULL
  constraint chk_assigned_consistency
    check (
      (stage = 'sharoshi_check' and assigned_to_partner_id is not null)
      or (stage <> 'sharoshi_check' and assigned_to_partner_id is null)
      -- ただし not_started かつ未確定の暫定状態は assigned_to_employee_id NULL も許容
      or (status = 'not_started' and assigned_to_employee_id is null and assigned_to_partner_id is null)
    )
);

comment on table public.bud_payroll_schedule is
  '給与処理 7 stage の予定日管理。calculation / approval / mfc_import / audit / visual_double_check / sharoshi_check / finalization。';

create index if not exists idx_schedule_period
  on public.bud_payroll_schedule (period_id, stage);
create index if not exists idx_schedule_overdue
  on public.bud_payroll_schedule (planned_date, status)
  where status in ('not_started', 'in_progress');
create index if not exists idx_schedule_assigned_employee
  on public.bud_payroll_schedule (assigned_to_employee_id, status);

-- ------------------------------------------------------------
-- 2. bud_payroll_schedule_settings（admin 設定、各 stage offset_days）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_schedule_settings (
  id uuid primary key default gen_random_uuid(),
  company_id text references public.root_companies(company_id),  -- NULL = 全法人共通

  -- 各 stage の予定日（前 stage 完了日 / period_end からの相対営業日数）
  calculation_offset_days int not null default 2
    check (calculation_offset_days >= 0),
  approval_offset_days int not null default 1
    check (approval_offset_days >= 0),
  mfc_import_offset_days int not null default 1
    check (mfc_import_offset_days >= 0),
  audit_offset_days int not null default 1
    check (audit_offset_days >= 0),
  visual_double_check_offset_days int not null default 1
    check (visual_double_check_offset_days >= 0),     -- 4 次 follow-up
  sharoshi_check_offset_days int not null default 3
    check (sharoshi_check_offset_days >= 0),
  finalization_offset_days int not null default 1
    check (finalization_offset_days >= 0),

  -- 担当者デフォルト
  default_calculator_id text references public.root_employees(employee_id),
  default_approver_ids text[] not null default array[]::text[],
  default_disburser_id text references public.root_employees(employee_id),
  default_auditor_id text references public.root_employees(employee_id),
  default_visual_checker_id text references public.root_employees(employee_id),  -- 4 次 follow-up
  default_sharoshi_partner_id uuid,                                      -- root.partners(id) FK は Root 移管時

  -- リマインダ閾値（spec § 3.2）
  warn_after_hours int not null default 24
    check (warn_after_hours >= 0),
  critical_after_hours int not null default 72
    check (critical_after_hours >= warn_after_hours),
  escalation_after_days int not null default 3
    check (escalation_after_days >= 0),
  full_company_notify_after_days int not null default 5
    check (full_company_notify_after_days >= escalation_after_days),

  -- メタ（履歴管理: effective_from で時系列、変更時は新行 INSERT）
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  created_at timestamptz not null default now(),
  updated_by text not null references public.root_employees(employee_id)
);

comment on table public.bud_payroll_schedule_settings is
  '給与スケジュール設定。各 stage の offset_days + 担当者デフォルト + リマインダ閾値。effective_from で履歴管理。company_id NULL = 全法人共通。';

create index if not exists idx_schedule_settings_company
  on public.bud_payroll_schedule_settings (company_id, effective_from desc);

-- ------------------------------------------------------------
-- 3. bud_payroll_reminder_log（リマインダ送信履歴）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_reminder_log (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.bud_payroll_schedule(id) on delete cascade,
  sent_at timestamptz not null default now(),

  severity text not null
    check (severity in ('info', 'warning', 'critical')),
  escalation_level int not null default 0
    check (escalation_level between 0 and 2),

  -- 送信先
  notified_employee_ids uuid[] not null default array[]::uuid[],
  notified_partner_id uuid,                          -- 社労士へ送信した場合のみ

  -- チャネル
  channel text not null
    check (channel in ('chatwork_dm', 'garden_toast', 'email', 'multi')),
  message_text text not null,
  external_message_ids jsonb,                        -- { "chatwork": "msg_xxx", "email_resend": "msg_yyy" }

  -- 結果
  status text not null
    check (status in ('sent', 'failed', 'partial')),
  failed_reason text
);

comment on table public.bud_payroll_reminder_log is
  'リマインダ送信履歴。schedule_id → 各送信記録。UPDATE/DELETE 完全禁止（監査履歴）。';

create index if not exists idx_reminder_log_schedule
  on public.bud_payroll_reminder_log (schedule_id, sent_at desc);
create index if not exists idx_reminder_log_severity
  on public.bud_payroll_reminder_log (severity, sent_at desc);

-- ------------------------------------------------------------
-- 4. RLS（D-09 helpers 利用）
-- ------------------------------------------------------------
alter table public.bud_payroll_schedule enable row level security;
alter table public.bud_payroll_schedule_settings enable row level security;
alter table public.bud_payroll_reminder_log enable row level security;

-- ----- bud_payroll_schedule RLS -----
drop policy if exists ps_select on public.bud_payroll_schedule;
create policy ps_select on public.bud_payroll_schedule
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ps_insert on public.bud_payroll_schedule;
create policy ps_insert on public.bud_payroll_schedule
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ps_update on public.bud_payroll_schedule;
create policy ps_update on public.bud_payroll_schedule
  for update
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ps_no_delete on public.bud_payroll_schedule;
create policy ps_no_delete on public.bud_payroll_schedule
  for delete
  using (false);

-- ----- bud_payroll_schedule_settings RLS（admin / payroll_auditor のみ書込）-----
drop policy if exists pss_select on public.bud_payroll_schedule_settings;
create policy pss_select on public.bud_payroll_schedule_settings
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists pss_write on public.bud_payroll_schedule_settings;
create policy pss_write on public.bud_payroll_schedule_settings
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists pss_update on public.bud_payroll_schedule_settings;
create policy pss_update on public.bud_payroll_schedule_settings
  for update
  using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists pss_no_delete on public.bud_payroll_schedule_settings;
create policy pss_no_delete on public.bud_payroll_schedule_settings
  for delete
  using (false);

-- ----- bud_payroll_reminder_log RLS（INSERT は service_role のみ、SELECT は payroll_*）-----
drop policy if exists prl_select on public.bud_payroll_reminder_log;
create policy prl_select on public.bud_payroll_reminder_log
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: service_role 経由のみ（Cron）→ 通常 RLS 適用ユーザーは INSERT 不可
drop policy if exists prl_no_user_insert on public.bud_payroll_reminder_log;
create policy prl_no_user_insert on public.bud_payroll_reminder_log
  for insert
  with check (false);

-- UPDATE / DELETE: 完全禁止（監査履歴は不変）
drop policy if exists prl_no_update on public.bud_payroll_reminder_log;
create policy prl_no_update on public.bud_payroll_reminder_log
  for update
  using (false);

drop policy if exists prl_no_delete on public.bud_payroll_reminder_log;
create policy prl_no_delete on public.bud_payroll_reminder_log
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- -- 7 stage CHECK 確認
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.bud_payroll_schedule'::regclass
--     AND conname LIKE '%stage%';
--
-- -- offset_days 7 個確認
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'bud_payroll_schedule_settings'
--     AND column_name LIKE '%offset_days%';

-- ============================================================
-- migration: 20260508000004_bud_phase_d06_nenmatsu_integration.sql
-- ============================================================
-- ============================================================
-- Garden Bud — Phase D #06: 年末調整連携（Phase C 連動 + 1 月精算 + マイナンバー暗号化）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md
-- 作成: 2026-05-08（a-bud-002、Phase D 100% 完走に向けて）
--
-- 目的:
--   月次給与・賞与で控除した源泉徴収を、翌年 1 月給与で精算する設計。
--   Phase C（年末調整）と連動するための連携テーブル + マイナンバー暗号化基盤を整備。
--
-- スコープ（本 migration で対応）:
--   1. pgcrypto 拡張（マイナンバー pgp_sym_encrypt/decrypt 用）
--   2. bud_year_end_settlements（精算記録、fiscal_year × employee_id UNIQUE）
--   3. root_employees_pii（マイナンバー暗号化保管、super_admin only）
--   4. bud_pii_access_log（PII 復号アクセス監査、§6.4 反映）
--   5. PII helper 関数（bud_decrypt_my_number, bud_log_pii_access）
--   6. RLS（自分閲覧 / admin+ 全件 / super_admin の PII / payroll_approver 承認）
--
-- 含めない（Phase C 側で別途）:
--   - bud_nenmatsu_chousei（年末調整本体テーブル）→ Phase C-01
--   - bud_gensen_choshu_bo（月次源泉徴収簿）→ Phase C
--   - 年末調整 UI → Phase C-05
--   - 法定調書合計表 → Phase C-04
--   - D-02 / D-03 から bud_gensen_choshu_bo への自動書込 → Phase C 起票後に追補
--   - 1 月給与の settlement 反映 → D-10 給与計算統合の純関数で対応
--
-- 法令準拠:
--   - 所得税法 第 190 条: 年末調整実施
--   - 所得税法 第 226 条: 源泉徴収票交付（翌年 1/31 まで）
--   - マイナンバー法 第 27-29 条: 安全管理措置（暗号化・アクセス制限・監査）
--   - マイナンバー法 第 25 条: 利用目的の限定（年末調整 / 法定調書のみ）
--   - 個人情報保護法 第 23 条: 安全管理措置
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は Phase D 完走時にまとめて。
--
-- 冪等性: create * if not exists / drop policy if exists で何度でも実行可。
-- ============================================================

-- ------------------------------------------------------------
-- 0. pgcrypto 拡張（マイナンバー暗号化用）
-- ------------------------------------------------------------
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. bud_year_end_settlements（年末調整精算記録）
-- ------------------------------------------------------------
-- 1 名 1 年度 1 件（fiscal_year × employee_id UNIQUE）。
-- 12 月初〜中: Phase C で年税額計算 → settlement 作成（status='calculated'）
-- payroll_approver 承認 → status='approved'
-- 翌 1 月給与計算で settlement_amount 反映 → status='reflected'
create table if not exists public.bud_year_end_settlements (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null
    check (fiscal_year between 2020 and 2099),
  employee_id text not null references public.root_employees(employee_id),

  -- Phase C 連動（nenmatsu_chousei_id は Phase C 起票後に有効化、本 migration では nullable）
  -- spec §3.2 では NOT NULL だが Phase C 未起票のため、本 migration では nullable で先行起票。
  -- Phase C-01 起票時に NOT NULL 化 + FK 追加。
  nenmatsu_chousei_id uuid,                          -- Phase C-01 後に references public.bud_nenmatsu_chousei(id)

  -- 既徴収累計（D-02 / D-03 から、Phase C-bud_gensen_choshu_bo 経由で集計）
  total_withheld_to_november numeric(10, 0) not null
    check (total_withheld_to_november >= 0),         -- 11 月までの累計
  december_salary_withheld numeric(10, 0) not null
    check (december_salary_withheld >= 0),           -- 12 月給与の予定徴収額
  bonus_withheld_total numeric(10, 0) not null
    check (bonus_withheld_total >= 0),               -- 賞与累計

  -- 年税額（Phase C 計算結果）
  annual_tax_amount numeric(10, 0) not null
    check (annual_tax_amount >= 0),

  -- 精算
  settlement_amount numeric(10, 0) not null,         -- + 追徴 / - 還付（マイナス可）
  settlement_type text not null
    check (settlement_type in ('refund', 'additional', 'zero')),
  settlement_period_id uuid not null
    references public.bud_payroll_periods(id),       -- 翌 1 月給与の期間 ID

  -- 退職者除外フラグ（spec §11.5: 1 月精算統一、12 月末退職者は最終給与で即時精算）
  excluded_reason text
    check (excluded_reason is null or excluded_reason in (
      'retired_in_year',
      'mid_year_settlement',
      'manual_exclusion'
    )),

  -- 状態
  status text not null default 'calculated'
    check (status in ('calculated', 'approved', 'reflected', 'cancelled')),

  -- メタ
  calculated_at timestamptz not null default now(),
  calculated_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  reflected_at timestamptz,                          -- 1 月給与計算に反映済の日時
  cancelled_at timestamptz,
  cancelled_by text references public.root_employees(employee_id),

  notes text,
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  -- 1 名 1 年度 1 件（excluded フラグ含む）
  constraint uq_yes_per_employee_year
    unique (fiscal_year, employee_id),

  -- 自己承認禁止（V6 自起票承認禁止、§Kintone 解析 #18 反映）
  constraint chk_yes_no_self_approval
    check (approved_by is null or approved_by <> calculated_by)
);

create index if not exists idx_yes_period
  on public.bud_year_end_settlements(settlement_period_id);
create index if not exists idx_yes_employee_year
  on public.bud_year_end_settlements(employee_id, fiscal_year);
create index if not exists idx_yes_status
  on public.bud_year_end_settlements(status)
  where deleted_at is null;

comment on table public.bud_year_end_settlements is
  'Phase D-06 年末調整精算記録（1 月給与精算ベース、2026-04-26 改訂）。fiscal_year × employee_id UNIQUE。';

comment on column public.bud_year_end_settlements.settlement_amount is
  '+ 追徴 / - 還付。1 月給与に加算（refund はマイナス → 給与プラス、additional はプラス → 給与マイナス）。';

-- ------------------------------------------------------------
-- 2. root_employees_pii（マイナンバー等の機微情報、暗号化保管）
-- ------------------------------------------------------------
-- spec §6.1 反映。super_admin のみアクセス可、復号は Server Action 経由のみ。
-- 暗号化キー: Vercel 環境変数 PII_ENCRYPTION_KEY（32 バイト base64）。
-- 鍵 ID: encryption_key_id で世代管理（年 1 回ローテーション想定）。
create table if not exists public.root_employees_pii (
  employee_id text primary key references public.root_employees(employee_id),

  -- マイナンバー（pgp_sym_encrypt で AES-256 相当の暗号化）
  my_number_encrypted bytea,                         -- NULL 許容（未登録）
  encryption_key_id text,                            -- 鍵世代 ID（'2026-default' 等）

  -- 扶養家族マイナンバー（JSONB 内の各 number_encrypted は別途 helper で復号）
  -- 例: [{"name": "山田太郎", "relation": "spouse", "encrypted": "\\x..."}]
  -- 本 spec では構造のみ定義、Phase C-05（年末調整 UI）で書込フロー実装。
  dependents_pii_encrypted jsonb,

  -- メタ
  encrypted_at timestamptz,
  encrypted_by text references public.root_employees(employee_id),

  -- アクセス監査（spec §6.4）
  last_accessed_at timestamptz,
  access_count int not null default 0
    check (access_count >= 0),

  -- 退職時 7 年経過で物理削除（spec 判 3、Cross Ops #05 連動）
  retention_until date,                              -- 退職日 + 7 年

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_root_employees_pii_retention
  on public.root_employees_pii(retention_until)
  where retention_until is not null;

comment on table public.root_employees_pii is
  'Phase D-06 マイナンバー暗号化保管（super_admin only）。pgp_sym_encrypt で AES-256 相当。';

comment on column public.root_employees_pii.dependents_pii_encrypted is
  '扶養家族マイナンバーの JSONB 配列。各 entry に encrypted フィールド（bytea を base64 化して保管）。';

-- ------------------------------------------------------------
-- 3. bud_pii_access_log（PII 復号アクセス監査、spec §6.4）
-- ------------------------------------------------------------
-- マイナンバー復号のたびに INSERT。改ざん検知のため UPDATE / DELETE 不可。
create table if not exists public.bud_pii_access_log (
  id uuid primary key default gen_random_uuid(),
  accessed_by text not null references public.root_employees(employee_id),
  target_employee_id text not null references public.root_employees(employee_id),

  -- アクセス目的（マイナンバー法 第 25 条: 利用目的の限定）
  purpose text not null
    check (purpose in (
      'year_end_settlement',
      'gensen_choshu_hyo',
      'hotei_chosho',
      'shiharai_chosho',
      'audit_review',
      'admin_correction'
    )),

  -- 関連リソース（オプション、例: settlement_id, fiscal_year）
  context jsonb,

  accessed_at timestamptz not null default now(),
  client_ip inet,
  user_agent text
);

create index if not exists idx_pii_log_target
  on public.bud_pii_access_log(target_employee_id, accessed_at desc);
create index if not exists idx_pii_log_accessor
  on public.bud_pii_access_log(accessed_by, accessed_at desc);

comment on table public.bud_pii_access_log is
  'Phase D-06 PII 復号アクセス監査ログ（マイナンバー法 §27-29 準拠）。INSERT only。';

-- ------------------------------------------------------------
-- 4. PII helper 関数
-- ------------------------------------------------------------

-- 4.1 マイナンバー暗号化（admin / super_admin が登録時に呼ぶ）
-- key 引数は呼び出し元（Server Action）が PII_ENCRYPTION_KEY を渡す。
create or replace function public.bud_encrypt_my_number(
  p_employee_id text,
  p_my_number text,
  p_key text,
  p_key_id text default '2026-default'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- super_admin のみ実行可能
  if not public.bud_is_super_admin() then
    raise exception 'FORBIDDEN: only super_admin can encrypt my_number';
  end if;

  -- バリデーション: マイナンバーは 12 桁数字
  if p_my_number !~ '^[0-9]{12}$' then
    raise exception 'INVALID: my_number must be 12 digits';
  end if;

  insert into public.root_employees_pii (
    employee_id,
    my_number_encrypted,
    encryption_key_id,
    encrypted_at,
    encrypted_by,
    updated_at
  ) values (
    p_employee_id,
    pgp_sym_encrypt(p_my_number, p_key, 'cipher-algo=aes256'),
    p_key_id,
    now(),
    (select employee_id from public.root_employees where user_id = auth.uid()),
    now()
  )
  on conflict (employee_id) do update set
    my_number_encrypted = excluded.my_number_encrypted,
    encryption_key_id = excluded.encryption_key_id,
    encrypted_at = excluded.encrypted_at,
    encrypted_by = excluded.encrypted_by,
    updated_at = now();
end;
$$;

comment on function public.bud_encrypt_my_number(text, text, text, text) is
  'マイナンバー暗号化保管（super_admin only）。AES-256 等価の pgp_sym_encrypt 利用。';

-- 4.2 マイナンバー復号 + 監査ログ INSERT（年末調整 / 法定調書のみ）
create or replace function public.bud_decrypt_my_number(
  p_target_employee_id text,
  p_key text,
  p_purpose text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encrypted bytea;
  v_decrypted text;
  v_accessor_id text;
begin
  -- super_admin のみ復号可能
  if not public.bud_is_super_admin() then
    raise exception 'FORBIDDEN: only super_admin can decrypt my_number';
  end if;

  -- 利用目的のバリデーション（マイナンバー法 §25）
  if p_purpose not in (
    'year_end_settlement',
    'gensen_choshu_hyo',
    'hotei_chosho',
    'shiharai_chosho',
    'audit_review',
    'admin_correction'
  ) then
    raise exception 'INVALID_PURPOSE: %', p_purpose;
  end if;

  select my_number_encrypted into v_encrypted
  from public.root_employees_pii
  where employee_id = p_target_employee_id;

  if v_encrypted is null then
    return null;
  end if;

  v_decrypted := pgp_sym_decrypt(v_encrypted, p_key);

  -- 監査ログ書込
  v_accessor_id := (select employee_id from public.root_employees where user_id = auth.uid());
  insert into public.bud_pii_access_log (
    accessed_by,
    target_employee_id,
    purpose,
    context
  ) values (
    v_accessor_id,
    p_target_employee_id,
    p_purpose,
    jsonb_build_object('triggered_at', now())
  );

  -- アクセスカウンタ更新
  update public.root_employees_pii set
    last_accessed_at = now(),
    access_count = access_count + 1
  where employee_id = p_target_employee_id;

  return v_decrypted;
end;
$$;

comment on function public.bud_decrypt_my_number(text, text, text) is
  'マイナンバー復号 + 監査ログ INSERT。super_admin only、利用目的限定。';

-- ------------------------------------------------------------
-- 5. RLS: bud_year_end_settlements
-- ------------------------------------------------------------
alter table public.bud_year_end_settlements enable row level security;

-- 5.1 SELECT: 自分の精算は閲覧可
drop policy if exists yes_select_own on public.bud_year_end_settlements;
create policy yes_select_own on public.bud_year_end_settlements
  for select
  using (
    deleted_at is null
    and employee_id = (
      select employee_id from public.root_employees
      where user_id = auth.uid()
        and deleted_at is null
    )
  );

-- 5.2 SELECT: payroll_calculator / payroll_approver / payroll_auditor は全件
drop policy if exists yes_select_payroll_role on public.bud_year_end_settlements;
create policy yes_select_payroll_role on public.bud_year_end_settlements
  for select
  using (
    deleted_at is null
    and public.bud_has_payroll_role(array[
      'payroll_calculator',
      'payroll_approver',
      'payroll_auditor'
    ])
  );

-- 5.3 SELECT: admin / super_admin は全件
drop policy if exists yes_select_admin on public.bud_year_end_settlements;
create policy yes_select_admin on public.bud_year_end_settlements
  for select
  using (
    deleted_at is null
    and public.bud_is_admin_or_super_admin()
  );

-- 5.4 INSERT: payroll_calculator + admin
drop policy if exists yes_insert_calculator on public.bud_year_end_settlements;
create policy yes_insert_calculator on public.bud_year_end_settlements
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

-- 5.5 UPDATE: payroll_approver（承認のみ）+ admin
-- 自起票承認禁止は CHECK 制約 chk_yes_no_self_approval で強制。
drop policy if exists yes_update_approver on public.bud_year_end_settlements;
create policy yes_update_approver on public.bud_year_end_settlements
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  );

-- 5.6 DELETE: 物理削除禁止（deleted_at で論理削除のみ）
drop policy if exists yes_no_delete on public.bud_year_end_settlements;
create policy yes_no_delete on public.bud_year_end_settlements
  for delete
  using (false);

-- ------------------------------------------------------------
-- 6. RLS: root_employees_pii
-- ------------------------------------------------------------
alter table public.root_employees_pii enable row level security;

-- 6.1 SELECT: super_admin のみ（暗号化された値も含めて閲覧可は super_admin のみ）
drop policy if exists pii_select_super_admin on public.root_employees_pii;
create policy pii_select_super_admin on public.root_employees_pii
  for select
  using (public.bud_is_super_admin());

-- 6.2 INSERT / UPDATE: super_admin のみ
drop policy if exists pii_insert_super_admin on public.root_employees_pii;
create policy pii_insert_super_admin on public.root_employees_pii
  for insert
  with check (public.bud_is_super_admin());

drop policy if exists pii_update_super_admin on public.root_employees_pii;
create policy pii_update_super_admin on public.root_employees_pii
  for update
  using (public.bud_is_super_admin())
  with check (public.bud_is_super_admin());

-- 6.3 DELETE: 物理削除禁止（retention_until 経過時は別 Cron で対応、Cross Ops #05）
drop policy if exists pii_no_delete on public.root_employees_pii;
create policy pii_no_delete on public.root_employees_pii
  for delete
  using (false);

-- ------------------------------------------------------------
-- 7. RLS: bud_pii_access_log
-- ------------------------------------------------------------
alter table public.bud_pii_access_log enable row level security;

-- 7.1 SELECT: super_admin + admin（監査用、改ざん不可）
drop policy if exists pii_log_select_admin on public.bud_pii_access_log;
create policy pii_log_select_admin on public.bud_pii_access_log
  for select
  using (public.bud_is_admin_or_super_admin());

-- 7.2 INSERT: helper 関数経由のみ（service_role / SECURITY DEFINER）
-- Server Action から直接 INSERT も super_admin のみ許可。
drop policy if exists pii_log_insert_super_admin on public.bud_pii_access_log;
create policy pii_log_insert_super_admin on public.bud_pii_access_log
  for insert
  with check (public.bud_is_super_admin());

-- 7.3 UPDATE / DELETE: 改ざん検知のため不可
drop policy if exists pii_log_no_update on public.bud_pii_access_log;
create policy pii_log_no_update on public.bud_pii_access_log
  for update
  using (false);

drop policy if exists pii_log_no_delete on public.bud_pii_access_log;
create policy pii_log_no_delete on public.bud_pii_access_log
  for delete
  using (false);

-- ============================================================
-- end of migration 20260508000004
-- ============================================================

-- ============================================================
-- migration: 20260511000010_bud_bank_accounts_balances.sql
-- ============================================================
-- ============================================================
-- Garden Bud — 03_Bank: 銀行口座 + 残高履歴 + 取引履歴
-- ============================================================
-- 対応 dispatch: main- No. 276 急務 Garden 化（D-2 Supabase テーブル設計）
-- 作成: 2026-05-11（a-bud-002、5/12 デモ前 alpha 版）
--
-- 目的:
--   東海林さんの「各銀行サイト目視 → Excel 集計 → 後道さん報告」業務を
--   Garden で自動化。MF API エラー期間中の手作業削減 + Forest 既実装 CSV
--   パーサー連動 + 手入力残高 UI を支える DB スキーマ。
--
-- スコープ（本 migration で対応）:
--   1. bud_bank_accounts（法人 × 銀行 × 口座 マスタ）
--   2. bud_bank_balances（残高履歴、時系列）
--   3. bud_bank_transactions（取引履歴、CSV 取込分）
--   4. RLS: 全員 SELECT、書込は payroll_auditor 以上、論理削除のみ
--
-- 含めない:
--   - CSV パーサー実装 → 別 lib（Forest 既実装 import 予定）
--   - Chatwork 通知 → Server Action 別実装
--   - 手入力残高 UI → src/app/bud/bank/_components/
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_bank_accounts（法人 × 銀行 × 口座 マスタ）
-- ------------------------------------------------------------
create table if not exists public.bud_bank_accounts (
  id uuid primary key default gen_random_uuid(),

  -- 法人識別（将来 fruit_companies に FK、本 migration では text で先行起票）
  corp_code text not null
    check (corp_code in (
      'hyuaran',
      'centerrise',
      'linksupport',
      'arata',
      'taiyou',
      'ichi'
    )),

  -- 銀行識別
  bank_code text not null
    check (bank_code in (
      'mizuho',       -- みずほ銀行
      'rakuten',      -- 楽天銀行
      'paypay',       -- PayPay 銀行
      'kyoto'         -- 京都銀行
    )),
  bank_name text not null,

  -- 口座情報
  branch_name text,
  branch_code text
    check (branch_code is null or branch_code ~ '^[0-9]{3}$'),
  account_type text not null
    check (account_type in ('普通', '当座', '貯蓄')),
  account_number text
    check (account_number is null or account_number ~ '^[0-9]+$'),

  -- 状態
  is_active boolean not null default true,
  has_csv_export boolean not null default true,
    -- false: みずほ等 CSV に残高列なし → 手入力で残高補完
  needs_manual_balance boolean not null default false,
    -- true: PayPay 障害等で CSV 取込不能 → 残高のみ手入力

  -- メタ
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  unique (corp_code, bank_code, account_number)
);

create index if not exists idx_bba_corp on public.bud_bank_accounts(corp_code) where deleted_at is null;
create index if not exists idx_bba_bank on public.bud_bank_accounts(bank_code) where deleted_at is null;

comment on table public.bud_bank_accounts is
  'Bud 03_Bank 口座マスタ。法人 × 銀行 × 口座、main- No. 276 急務 Garden 化、5/11 6 法人 × 4 銀行 対応';

-- ------------------------------------------------------------
-- 2. bud_bank_balances（残高履歴、時系列）
-- ------------------------------------------------------------
create table if not exists public.bud_bank_balances (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bud_bank_accounts(id),

  -- 残高
  balance_date date not null,
  balance_amount numeric(14, 0) not null,

  -- ソース区分
  source text not null
    check (source in (
      'csv_auto',       -- CSV 取込自動
      'manual_input',   -- 通帳ベース手入力（みずほ・PayPay 障害時等）
      'api_sync'        -- 将来: MF API 復旧後の自動同期
    )),

  -- 入力者（manual_input 時必須）
  input_user_id text references public.root_employees(employee_id),
  source_csv_path text,  -- csv_auto 時のパス記録

  -- メタ
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  -- 1 口座 1 日 1 残高（重複防止）
  unique (bank_account_id, balance_date, source)
);

create index if not exists idx_bbb_account_date
  on public.bud_bank_balances(bank_account_id, balance_date desc);

create index if not exists idx_bbb_date
  on public.bud_bank_balances(balance_date desc);

comment on table public.bud_bank_balances is
  'Bud 03_Bank 残高履歴。csv_auto / manual_input / api_sync 区分。手入力時は input_user_id 必須';

-- ------------------------------------------------------------
-- 3. bud_bank_transactions（取引履歴、CSV 取込分）
-- ------------------------------------------------------------
create table if not exists public.bud_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bud_bank_accounts(id),

  -- 取引
  transaction_date date not null,
  amount numeric(14, 0) not null,
  description text,
  balance_after numeric(14, 0),

  -- ソース
  source_csv_path text not null,
  raw_row jsonb not null,  -- 元 CSV 行の完全保持（監査用）

  -- メタ
  imported_at timestamptz not null default now(),
  imported_by text references public.root_employees(employee_id),

  -- 監査用、UPDATE / DELETE 禁止
  notes text
);

create index if not exists idx_bbt_account_date
  on public.bud_bank_transactions(bank_account_id, transaction_date desc);

comment on table public.bud_bank_transactions is
  'Bud 03_Bank 取引履歴。CSV 取込分、raw_row で原文保持、INSERT only';

-- ------------------------------------------------------------
-- 4. RLS: 全員 SELECT、書込は payroll_auditor 以上、論理削除のみ
-- ------------------------------------------------------------

-- 4.1 bud_bank_accounts
alter table public.bud_bank_accounts enable row level security;

drop policy if exists bba_select_all on public.bud_bank_accounts;
create policy bba_select_all on public.bud_bank_accounts
  for select using (deleted_at is null);

drop policy if exists bba_insert_auditor on public.bud_bank_accounts;
create policy bba_insert_auditor on public.bud_bank_accounts
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bba_update_auditor on public.bud_bank_accounts;
create policy bba_update_auditor on public.bud_bank_accounts
  for update using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bba_no_delete on public.bud_bank_accounts;
create policy bba_no_delete on public.bud_bank_accounts
  for delete using (false);

-- 4.2 bud_bank_balances
alter table public.bud_bank_balances enable row level security;

drop policy if exists bbb_select_all on public.bud_bank_balances;
create policy bbb_select_all on public.bud_bank_balances
  for select using (true);

drop policy if exists bbb_insert_auditor on public.bud_bank_balances;
create policy bbb_insert_auditor on public.bud_bank_balances
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bbb_update_auditor on public.bud_bank_balances;
create policy bbb_update_auditor on public.bud_bank_balances
  for update using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bbb_no_delete on public.bud_bank_balances;
create policy bbb_no_delete on public.bud_bank_balances
  for delete using (false);

-- 4.3 bud_bank_transactions（INSERT only、UPDATE / DELETE 禁止）
alter table public.bud_bank_transactions enable row level security;

drop policy if exists bbt_select_all on public.bud_bank_transactions;
create policy bbt_select_all on public.bud_bank_transactions
  for select using (true);

drop policy if exists bbt_insert_auditor on public.bud_bank_transactions;
create policy bbt_insert_auditor on public.bud_bank_transactions
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bbt_no_update on public.bud_bank_transactions;
create policy bbt_no_update on public.bud_bank_transactions
  for update using (false);

drop policy if exists bbt_no_delete on public.bud_bank_transactions;
create policy bbt_no_delete on public.bud_bank_transactions
  for delete using (false);

-- ============================================================
-- end of migration 20260511000010
-- ============================================================

-- ============================================================
-- migration: 20260511000011_bud_journal_entries.sql
-- ============================================================
-- ============================================================
-- Garden Bud — 07_Shiwakechou: 仕訳帳 + 勘定科目マスタ + 弥生 export 履歴
-- ============================================================
-- 対応 dispatch: main- No. 277（決算急務 Garden 化、# 276 Bank の上位仕訳化レイヤー）
-- 作成: 2026-05-11（a-bud-002、5/12 後段 alpha 版）
--
-- 目的:
--   Forest 配置だった仕訳帳機能を本来配置の Bud へ移管。
--   # 276 Bank の bud_bank_transactions を上位ロジックで仕訳化、
--   弥生会計形式 CSV export までを Garden 内で完結。
--
-- スコープ（本 migration で対応）:
--   1. bud_journal_accounts（勘定科目マスタ、弥生体系準拠）
--   2. bud_journal_entries（仕訳帳本体、bud_bank_transactions FK）
--   3. bud_journal_export_logs（弥生 export 履歴）
--   4. RLS: 全員 SELECT、書込 payroll_auditor+、論理削除のみ
--
-- 含めない:
--   - 弥生 CSV エンコーダー → src/app/bud/shiwakechou/_lib/
--   - 勘定科目自動判定ルールエンジン → 後続段階
--   - Forest 既存 CSV パーサー → shared lib 化（# 276 と統合）
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_journal_accounts（勘定科目マスタ、弥生体系準拠）
-- ------------------------------------------------------------
create table if not exists public.bud_journal_accounts (
  id uuid primary key default gen_random_uuid(),

  -- 弥生形式
  account_code text not null,                          -- 例: '111' 普通預金
  account_name text not null,                          -- 例: '普通預金'

  -- 分類
  account_category text not null
    check (account_category in (
      'asset',           -- 資産
      'liability',       -- 負債
      'equity',          -- 純資産
      'revenue',         -- 収益
      'expense',         -- 費用
      'other'
    )),

  -- 表示順 / 状態
  display_order int not null default 999,
  is_active boolean not null default true,
  notes text,

  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  unique (account_code)
);

create index if not exists idx_bja_code
  on public.bud_journal_accounts(account_code) where deleted_at is null;
create index if not exists idx_bja_category
  on public.bud_journal_accounts(account_category) where deleted_at is null;

comment on table public.bud_journal_accounts is
  'Bud 07_Shiwakechou 勘定科目マスタ。弥生会計体系準拠、main- No. 277';

-- ------------------------------------------------------------
-- 2. bud_journal_entries（仕訳帳本体）
-- ------------------------------------------------------------
create table if not exists public.bud_journal_entries (
  id uuid primary key default gen_random_uuid(),

  -- 仕訳日付
  entry_date date not null,

  -- 借方 / 貸方
  debit_account_code text not null,
  credit_account_code text not null,
  amount numeric(14, 0) not null
    check (amount > 0),

  -- 摘要 / 補助情報
  description text,
  memo text,

  -- ソース区分
  source text not null
    check (source in (
      'csv_auto',           -- 銀行取引履歴から自動生成
      'manual_input',       -- 手動入力
      'expense_claim',      -- 経費精算連動
      'payroll',            -- 給与計算連動
      'other'
    )),

  -- # 276 Bank との連動（銀行取引履歴 → 仕訳化）
  source_bank_transaction_id uuid references public.bud_bank_transactions(id),

  -- ライフサイクル
  status text not null default 'pending'
    check (status in (
      'pending',            -- 自動生成、確認待ち
      'confirmed',          -- 確認済（東海林さん承認）
      'exported',           -- 弥生 export 済
      'cancelled'           -- 取消
    )),

  -- 確認 / export メタ
  confirmed_at timestamptz,
  confirmed_by text references public.root_employees(employee_id),
  exported_at timestamptz,
  export_log_id uuid,                                  -- bud_journal_export_logs FK（後で追加）

  cancelled_at timestamptz,
  cancelled_by text references public.root_employees(employee_id),
  cancelled_reason text,

  -- メタ
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  -- 借方 ≠ 貸方
  constraint chk_bje_debit_credit_different
    check (debit_account_code <> credit_account_code)
);

create index if not exists idx_bje_entry_date
  on public.bud_journal_entries(entry_date desc) where deleted_at is null;
create index if not exists idx_bje_status
  on public.bud_journal_entries(status) where deleted_at is null;
create index if not exists idx_bje_source_bank
  on public.bud_journal_entries(source_bank_transaction_id)
  where source_bank_transaction_id is not null;
create index if not exists idx_bje_debit_acc
  on public.bud_journal_entries(debit_account_code) where deleted_at is null;
create index if not exists idx_bje_credit_acc
  on public.bud_journal_entries(credit_account_code) where deleted_at is null;

comment on table public.bud_journal_entries is
  'Bud 07_Shiwakechou 仕訳帳本体。# 276 Bank の bud_bank_transactions から仕訳化、弥生 export 対象';

-- ------------------------------------------------------------
-- 3. bud_journal_export_logs（弥生 export 履歴）
-- ------------------------------------------------------------
create table if not exists public.bud_journal_export_logs (
  id uuid primary key default gen_random_uuid(),

  -- export 対象範囲
  date_from date not null,
  date_to date not null,
  entry_count int not null check (entry_count >= 0),
  total_debit numeric(14, 0) not null,
  total_credit numeric(14, 0) not null,

  -- export 物
  format text not null
    check (format in ('yayoi_csv', 'yayoi_csv_v2', 'freee_csv')),
  file_name text not null,
  file_sha256 text,                                    -- 改ざん検知
  file_size_bytes int,

  -- ストレージパス（Supabase Storage or Vercel Blob）
  storage_path text,

  -- export 実行者
  exported_at timestamptz not null default now(),
  exported_by text references public.root_employees(employee_id),

  -- メモ
  notes text,

  constraint chk_bjel_date_range
    check (date_to >= date_from),
  constraint chk_bjel_debit_credit_balanced
    check (total_debit = total_credit)
);

create index if not exists idx_bjel_exported_at
  on public.bud_journal_export_logs(exported_at desc);

comment on table public.bud_journal_export_logs is
  'Bud 07_Shiwakechou 弥生 export 履歴。INSERT only、SHA256 改ざん検知、借方=貸方 CHECK';

-- export_log_id FK 追加（循環参照回避のため後付け）
alter table public.bud_journal_entries
  add constraint fk_bje_export_log
  foreign key (export_log_id) references public.bud_journal_export_logs(id);

-- ------------------------------------------------------------
-- 4. RLS: 全員 SELECT、書込 payroll_auditor+、論理削除のみ
-- ------------------------------------------------------------

-- 4.1 bud_journal_accounts
alter table public.bud_journal_accounts enable row level security;

drop policy if exists bja_select_all on public.bud_journal_accounts;
create policy bja_select_all on public.bud_journal_accounts
  for select using (deleted_at is null);

drop policy if exists bja_insert_admin on public.bud_journal_accounts;
create policy bja_insert_admin on public.bud_journal_accounts
  for insert with check (
    public.bud_is_admin_or_super_admin()
  );

drop policy if exists bja_update_admin on public.bud_journal_accounts;
create policy bja_update_admin on public.bud_journal_accounts
  for update using (public.bud_is_admin_or_super_admin())
    with check (public.bud_is_admin_or_super_admin());

drop policy if exists bja_no_delete on public.bud_journal_accounts;
create policy bja_no_delete on public.bud_journal_accounts
  for delete using (false);

-- 4.2 bud_journal_entries
alter table public.bud_journal_entries enable row level security;

drop policy if exists bje_select_all on public.bud_journal_entries;
create policy bje_select_all on public.bud_journal_entries
  for select using (deleted_at is null);

drop policy if exists bje_insert_auditor on public.bud_journal_entries;
create policy bje_insert_auditor on public.bud_journal_entries
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bje_update_auditor on public.bud_journal_entries;
create policy bje_update_auditor on public.bud_journal_entries
  for update using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bje_no_delete on public.bud_journal_entries;
create policy bje_no_delete on public.bud_journal_entries
  for delete using (false);

-- 4.3 bud_journal_export_logs（INSERT only）
alter table public.bud_journal_export_logs enable row level security;

drop policy if exists bjel_select_all on public.bud_journal_export_logs;
create policy bjel_select_all on public.bud_journal_export_logs
  for select using (true);

drop policy if exists bjel_insert_auditor on public.bud_journal_export_logs;
create policy bjel_insert_auditor on public.bud_journal_export_logs
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bjel_no_update on public.bud_journal_export_logs;
create policy bjel_no_update on public.bud_journal_export_logs
  for update using (false);

drop policy if exists bjel_no_delete on public.bud_journal_export_logs;
create policy bjel_no_delete on public.bud_journal_export_logs
  for delete using (false);

-- ============================================================
-- end of migration 20260511000011
-- ============================================================

