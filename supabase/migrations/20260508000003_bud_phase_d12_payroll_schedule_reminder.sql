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
