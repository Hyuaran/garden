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
      where re.user_id = auth.uid()
        and re.garden_role in ('manager', 'admin', 'super_admin')
        and re.deleted_at is null
    )
    or
    -- 作成者本人
    created_by = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null)
  );

-- INSERT: admin+ のみ（period 作成は管理者業務）
drop policy if exists bpp_insert on public.bud_payroll_periods;
create policy bpp_insert on public.bud_payroll_periods
  for insert
  with check (
    exists (
      select 1 from public.root_employees re
      where re.user_id = auth.uid()
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
      where re.user_id = auth.uid()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.root_employees re
      where re.user_id = auth.uid()
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
    employee_id = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null)
  );

drop policy if exists bps_select_manager_dept on public.bud_payroll_attendance_snapshots;
create policy bps_select_manager_dept on public.bud_payroll_attendance_snapshots
  for select
  using (
    exists (
      select 1 from public.root_employees viewer
      join public.root_employees target on target.id = bud_payroll_attendance_snapshots.employee_id
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
      where re.user_id = auth.uid()
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
      where re.user_id = auth.uid()
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
      where re.user_id = auth.uid()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.root_employees re
      where re.user_id = auth.uid()
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
      where re.user_id = auth.uid()
        and re.garden_role in ('manager', 'admin', 'super_admin')
        and re.deleted_at is null
    )
    or
    approved_by = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null)
  );

-- INSERT: admin+ のみ（reason 5 文字以上は CHECK 制約で強制）
drop policy if exists bpo_insert_admin on public.bud_payroll_attendance_overrides;
create policy bpo_insert_admin on public.bud_payroll_attendance_overrides
  for insert
  with check (
    exists (
      select 1 from public.root_employees re
      where re.user_id = auth.uid()
        and re.garden_role in ('admin', 'super_admin')
        and re.deleted_at is null
    )
    and approved_by = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null)
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
