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
    and generated_by <> public.auth_employee_number()
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
    employee_id = public.auth_employee_number()
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
