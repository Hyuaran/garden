-- ============================================================
-- Garden Root — 従業員マスタ 外注契約対応拡張（Phase A-3-g）
-- ============================================================
-- 対応 Issue / spec: a-main 2026-04-24 Leaf A-1c 連携
-- 作成: 2026-04-25
--
-- 目的:
--   Leaf の業務委託系 UI（A-1c）で必要な 3 点を同時導入：
--     (1) employment_type に 'outsource' を正式値として追加
--     (2) 契約終了日 contract_end_on 列の新設
--     (3) garden_role に 'outsource' を staff と manager の間へ追加（8 段階へ）
--   さらにモジュール横断で使える `is_user_active()` SQL 関数を提供し、
--   Leaf / Bud / Forest が RLS 判定に統一的に参照できるようにする。
--
-- 既存スキーマとの整合:
--   - `root_employees.employment_type` は CHECK 制約が無い text（'正社員' / 'アルバイト' を運用値）。
--     本 migration で `'正社員' | 'アルバイト' | 'outsource'` の 3 値 CHECK を新設する。
--     日本語と英語の混在はスコープ外で段階的に整理予定（将来 migration で正社員→fulltime 等）。
--   - `garden_role` は既に CHECK 済。DROP → 新しい 8 値版を CREATE で置換する。
--   - 既存の `termination_date` 列は退職日として現役。spec 文面の `retired_on` は概念名で、
--     本 DB では `termination_date` を参照する（is_user_active 関数内で吸収）。
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は Phase A-3 全完了後にまとめて実施。
--
-- 冪等性:
--   add column if not exists / drop constraint if exists / CREATE OR REPLACE で
--   何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- 1. contract_end_on 列を追加（nullable、外注契約の終了日）
-- ------------------------------------------------------------
alter table public.root_employees
  add column if not exists contract_end_on date;

comment on column public.root_employees.contract_end_on is
  '外注（employment_type=outsource）の契約終了日。null なら継続中。'
  ' is_user_active() はこの値が過去になった外注を不活性とみなす。'
  ' 正社員・アルバイトでは通常 null。';

-- ------------------------------------------------------------
-- 2. employment_type CHECK 制約（正社員 / アルバイト / outsource の 3 値）
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
    'toss',         -- トス（アポインター）
    'closer',       -- クローザー
    'cs',           -- CS
    'staff',        -- 一般社員
    'outsource',    -- 外注（業務委託） ★Phase A-3-g 新設、staff と manager の間
    'manager',      -- 責任者
    'admin',        -- 管理者
    'super_admin'   -- 全権管理者
  ));

-- ------------------------------------------------------------
-- 4. 共通判定関数: is_user_active()
--   - 現ログインユーザーが「活動中」か否かを真偽で返す
--   - 退職していない（termination_date が null または未来日）
--   - 外注の場合は契約終了日 contract_end_on が null または未来日
--   - SECURITY DEFINER: RLS ポリシー内から呼んでも再帰ループしない
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
  'Phase A-3-g: ログイン中ユーザーがアクティブか判定。'
  ' 退職済（termination_date 過去）または外注契約終了（contract_end_on 過去）は false。'
  ' RLS ポリシーから security definer で安全に呼び出せる。'
  ' Leaf / Bud / Forest から横断的に参照可能。';

-- ------------------------------------------------------------
-- 5. 共通 helper: garden_role_of(uid)
--   指定 user_id に対応する garden_role を返す（is_active のみ対象）。
--   RLS 内で `garden_role_of(auth.uid()) in (...)` の形で使うことを想定。
--   未登録・無効化時は null を返す。
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
  'Phase A-3-g: 指定 user_id の garden_role を返す。未登録 / 無効化時は null。'
  ' Leaf / Bud / Forest の RLS ポリシーで横断的に利用。';

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- -- 制約確認
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.root_employees'::regclass
--     AND conname LIKE 'root_employees_%_check'
--   ORDER BY conname;
--
-- -- 列確認
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'root_employees' AND column_name = 'contract_end_on';
--
-- -- 関数確認
-- SELECT proname FROM pg_proc
--   WHERE proname in ('is_user_active', 'garden_role_of');
--
-- -- 動作確認（admin でログインした状態で実行）
-- SELECT public.is_user_active();
-- SELECT public.garden_role_of(auth.uid());
