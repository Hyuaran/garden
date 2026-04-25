-- ============================================================
-- Garden Root — Phase A-3-g: employees 外注拡張（Dashboard 実行用コピー）
-- ============================================================
-- 本ファイルは supabase/migrations/20260425000002_root_employees_outsource_extension.sql
-- と同一内容。Supabase Dashboard > SQL Editor から手動実行する際の便宜コピー。
--
-- 適用手順:
--   1. Supabase Dashboard > garden-dev > SQL Editor を開く
--   2. 本ファイルの内容を全コピーして貼付
--   3. Run
--   4. 末尾の確認クエリで適用結果をチェック
--
-- 注意:
--   - 本 DB は PostgreSQL ENUM 型ではなく CHECK 制約で値を制限しているため、
--     a-main spec 文面の `ALTER TYPE ... ADD VALUE` は使わず、CHECK 制約の
--     DROP + 再 CREATE で値追加を実現する。
--   - spec 文面の `retired_on` は現 DB では `termination_date` 列。関数内で吸収。
-- ============================================================

-- ------------------------------------------------------------
-- 1. contract_end_on 列（外注契約終了日、nullable）
-- ------------------------------------------------------------
alter table public.root_employees
  add column if not exists contract_end_on date;

comment on column public.root_employees.contract_end_on is
  '外注（employment_type=outsource）の契約終了日。null なら継続中。'
  ' is_user_active() がこの値 > current_date を満たすかで活性判定する。';

-- ------------------------------------------------------------
-- 2. employment_type CHECK 制約（正社員 / アルバイト / outsource）
-- ------------------------------------------------------------
alter table public.root_employees
  drop constraint if exists root_employees_employment_type_check;

alter table public.root_employees
  add constraint root_employees_employment_type_check
  check (employment_type in ('正社員', 'アルバイト', 'outsource'));

-- ------------------------------------------------------------
-- 3. garden_role CHECK 制約を 8 段階版へ置換（outsource を staff と manager の間に）
-- ------------------------------------------------------------
alter table public.root_employees
  drop constraint if exists root_employees_garden_role_check;

alter table public.root_employees
  add constraint root_employees_garden_role_check
  check (garden_role in (
    'toss', 'closer', 'cs', 'staff',
    'outsource',
    'manager', 'admin', 'super_admin'
  ));

-- ------------------------------------------------------------
-- 4. is_user_active() — ログインユーザーが活動中か
-- ------------------------------------------------------------
create or replace function public.is_user_active()
  returns boolean
  language sql
  security definer
  stable
as $$
  select exists (
    select 1
    from public.root_employees e
    where e.user_id = auth.uid()
      and e.is_active = true
      and (e.termination_date is null or e.termination_date > current_date)
      and (
        e.employment_type <> 'outsource'
        or e.contract_end_on is null
        or e.contract_end_on > current_date
      )
  );
$$;

comment on function public.is_user_active() is
  'Phase A-3-g: ログイン中ユーザーがアクティブか判定（退職 / 外注契約終了をチェック）。';

-- ------------------------------------------------------------
-- 5. garden_role_of(uid) — 指定 user_id の garden_role を返す
-- ------------------------------------------------------------
create or replace function public.garden_role_of(uid uuid)
  returns text
  language sql
  security definer
  stable
as $$
  select garden_role
    from public.root_employees
    where user_id = uid
      and is_active = true
    limit 1;
$$;

comment on function public.garden_role_of(uuid) is
  'Phase A-3-g: 指定 user_id の garden_role を返す。未登録 / 無効化時は null。';

-- ------------------------------------------------------------
-- 適用確認クエリ（手動実行）
-- ------------------------------------------------------------
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.root_employees'::regclass
--     AND conname IN ('root_employees_garden_role_check', 'root_employees_employment_type_check');
--
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'root_employees' AND column_name = 'contract_end_on';
--
-- SELECT proname FROM pg_proc WHERE proname in ('is_user_active', 'garden_role_of');
--
-- SELECT public.is_user_active();
-- SELECT public.garden_role_of(auth.uid());
