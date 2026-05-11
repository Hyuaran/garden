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
    employee_id = public.auth_employee_number()
    -- または admin+ （main- No. 327 縮退）
    or public.has_role_at_least('admin')
  );

drop policy if exists repr_insert_admin on public.root_employee_payroll_roles;
create policy repr_insert_admin on public.root_employee_payroll_roles
  for insert
  with check (public.has_role_at_least('admin'));

drop policy if exists repr_update_admin on public.root_employee_payroll_roles;
create policy repr_update_admin on public.root_employee_payroll_roles
  for update
  using (public.has_role_at_least('admin'))
  with check (public.has_role_at_least('admin'));

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
  -- main- No. 327 縮退: root_employees.user_id / deleted_at 不在、
  -- auth_employee_number() helper で employee_id 解決
  select exists (
    select 1
    from public.root_employee_payroll_roles epr
    where epr.employee_id = public.auth_employee_number()
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
  -- main- No. 327 縮退: has_role_at_least('admin') wrapper（Tree D-01 同パターン）
  select public.has_role_at_least('admin');
$$;

create or replace function public.bud_is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  -- main- No. 327 縮退: has_role_at_least('super_admin') wrapper
  select public.has_role_at_least('super_admin');
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
    employee_id = public.auth_employee_number()
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
