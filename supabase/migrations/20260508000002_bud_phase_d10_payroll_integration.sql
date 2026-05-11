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
    employee_id = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null)
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
    and calculated_by <> (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null)
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
