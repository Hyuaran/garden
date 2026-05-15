-- ============================================================
-- Garden Soil — RLS（Row Level Security）ポリシー
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-04-25-soil-06-rls-design.md（#06 RLS 設計）
-- 作成: 2026-05-07（Batch 16 基盤実装、a-soil）
--
-- 目的:
--   soil_lists / soil_call_history への RLS を Garden 8 段階ロール
--   （super_admin / admin / manager / staff / cs / closer / toss + outsource）
--   ベースで設定する。
--
-- 設計の核心:
--   - super_admin / admin: 全件参照・編集可
--   - manager: 全件参照可、書込は自部門のみ
--   - staff / cs / closer / toss: 担当案件 + 自分の架電のみ
--   - outsource: 商材別アクセスマトリックス（B-06 §17 で詳細、本 migration では基本のみ）
--   - 物理 DELETE は完全禁止（論理削除のみ）
--
-- 性能最適化:
--   - current_garden_role() SECURITY DEFINER STABLE 関数で role 評価をキャッシュ
--   - soil_lists_assignments Materialized View で複数 Leaf JOIN を回避
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod 適用は東海林さん別途承認後（CLAUDE.md ルール）。
--
-- 前提:
--   - 20260507000001_soil_lists.sql 適用済
--   - 20260507000002_soil_call_history.sql 適用済
--   - root_employees(user_id, garden_role, department_id) 存在（既存）
--   - leaf_kanden_cases(soil_list_id, assigned_to) 存在（後続 migration で列追加予定）
-- ============================================================

-- ------------------------------------------------------------
-- 1. ヘルパー関数 current_garden_role()（性能最適化、spec §6.2.1）
-- ------------------------------------------------------------
-- SECURITY DEFINER + STABLE で同一クエリ内キャッシュ。
-- RLS 内の (SELECT garden_role FROM root_employees ...) を本関数に置換。
create or replace function public.current_garden_role()
returns text
language sql
security definer
stable
as $$
  select garden_role from public.root_employees where user_id = auth.uid()
$$;

comment on function public.current_garden_role() is
  '現在の認証ユーザーの garden_role を返す。RLS の高頻度評価を避けるため STABLE。';

-- 補助: 自部門 ID 取得
create or replace function public.current_department_id()
returns uuid
language sql
security definer
stable
as $$
  select department_id from public.root_employees where user_id = auth.uid()
$$;

comment on function public.current_department_id() is
  '現在の認証ユーザーの department_id を返す。manager の自部門判定で使用。';

-- ------------------------------------------------------------
-- 2. soil_lists_assignments Materialized View（spec §5.2）
-- ------------------------------------------------------------
-- 複数 Leaf の assignment を UNION して、staff- 以下の RLS を高速化。
-- 商材追加時はこの MV の UNION ALL に追記する必要あり。
-- ※ leaf_kanden_cases に soil_list_id 列が無ければ MV 作成失敗 → 後続 migration で
--   leaf_kanden_cases に soil_list_id 追加後に initial REFRESH 実行。
create materialized view if not exists public.soil_lists_assignments as
select soil_list_id, assigned_to, 'leaf_kanden'::text as module
  from public.leaf_kanden_cases
  where assigned_to is not null and soil_list_id is not null
-- 他商材は ALTER MATERIALIZED VIEW で UNION 追加
-- 例: union all
--     select soil_list_id, assigned_to, 'leaf_hikari'::text as module
--       from public.leaf_hikari_cases
--       where assigned_to is not null and soil_list_id is not null
;

create unique index if not exists idx_soil_lists_assignments_unique
  on public.soil_lists_assignments (soil_list_id, assigned_to, module);

create index if not exists idx_soil_lists_assignments_user
  on public.soil_lists_assignments (assigned_to);

comment on materialized view public.soil_lists_assignments is
  '担当案件高速判定用 MV。Leaf 各商材の assignment を UNION。1 時間に 1 回 REFRESH CONCURRENTLY 推奨（B-04 で cron 設定）。';

-- ------------------------------------------------------------
-- 3. soil_lists の RLS
-- ------------------------------------------------------------
alter table public.soil_lists enable row level security;

-- 既存ポリシー削除（冪等性のため）
drop policy if exists soil_lists_select_high_priv on public.soil_lists;
drop policy if exists soil_lists_select_assigned on public.soil_lists;
drop policy if exists soil_lists_select_deleted_admin on public.soil_lists;
drop policy if exists soil_lists_insert_manager on public.soil_lists;
drop policy if exists soil_lists_update_manager on public.soil_lists;
drop policy if exists soil_lists_no_delete on public.soil_lists;

-- 3.1 SELECT: super_admin / admin / manager は全件参照（未削除のみ）
create policy soil_lists_select_high_priv
  on public.soil_lists for select
  to authenticated
  using (
    public.current_garden_role() in ('manager', 'admin', 'super_admin')
    and deleted_at is null
  );

-- 3.2 SELECT: staff- 以下は担当案件に紐づくリストのみ
create policy soil_lists_select_assigned
  on public.soil_lists for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.soil_lists_assignments
      where soil_list_id = soil_lists.id and assigned_to = auth.uid()
    )
  );

-- 3.3 SELECT: 削除済を見られるのは admin+ のみ
create policy soil_lists_select_deleted_admin
  on public.soil_lists for select
  to authenticated
  using (
    deleted_at is not null
    and public.current_garden_role() in ('admin', 'super_admin')
  );

-- 3.4 INSERT: manager+ のみ（service_role は RLS バイパス）
create policy soil_lists_insert_manager
  on public.soil_lists for insert
  to authenticated
  with check (
    public.current_garden_role() in ('manager', 'admin', 'super_admin')
  );

-- 3.5 UPDATE: manager+ のみ
create policy soil_lists_update_manager
  on public.soil_lists for update
  to authenticated
  using (
    public.current_garden_role() in ('manager', 'admin', 'super_admin')
  )
  with check (
    public.current_garden_role() in ('manager', 'admin', 'super_admin')
  );

-- 3.6 DELETE: 物理 DELETE 完全禁止（論理削除は UPDATE deleted_at 経由）
create policy soil_lists_no_delete
  on public.soil_lists for delete
  to authenticated
  using (false);

-- ------------------------------------------------------------
-- 4. soil_list_imports の RLS（admin+ のみ）
-- ------------------------------------------------------------
alter table public.soil_list_imports enable row level security;

drop policy if exists soil_list_imports_admin_all on public.soil_list_imports;

create policy soil_list_imports_admin_all
  on public.soil_list_imports for all
  to authenticated
  using (
    public.current_garden_role() in ('admin', 'super_admin', 'manager')
  )
  with check (
    public.current_garden_role() in ('admin', 'super_admin', 'manager')
  );

-- ------------------------------------------------------------
-- 5. soil_list_tags の RLS
-- ------------------------------------------------------------
alter table public.soil_list_tags enable row level security;

drop policy if exists soil_list_tags_select on public.soil_list_tags;
drop policy if exists soil_list_tags_insert_assigned on public.soil_list_tags;
drop policy if exists soil_list_tags_no_delete on public.soil_list_tags;

-- SELECT: 親 soil_lists が見える人は見える（同じ範囲）
create policy soil_list_tags_select
  on public.soil_list_tags for select
  to authenticated
  using (
    exists (select 1 from public.soil_lists where id = list_id)
  );

-- INSERT: 親 soil_lists の閲覧権限がある人は追加可（自分のタグ管理用）
create policy soil_list_tags_insert_assigned
  on public.soil_list_tags for insert
  to authenticated
  with check (
    exists (select 1 from public.soil_lists where id = list_id)
  );

-- DELETE: admin+ のみ（誤タグ削除）
create policy soil_list_tags_no_delete
  on public.soil_list_tags for delete
  to authenticated
  using (
    public.current_garden_role() in ('admin', 'super_admin')
  );

-- ------------------------------------------------------------
-- 6. soil_lists_merge_proposals の RLS（admin+ のみ）
-- ------------------------------------------------------------
alter table public.soil_lists_merge_proposals enable row level security;

drop policy if exists soil_merge_proposals_admin_all on public.soil_lists_merge_proposals;

create policy soil_merge_proposals_admin_all
  on public.soil_lists_merge_proposals for all
  to authenticated
  using (
    public.current_garden_role() in ('admin', 'super_admin')
  )
  with check (
    public.current_garden_role() in ('admin', 'super_admin')
  );

-- ------------------------------------------------------------
-- 7. soil_call_history の RLS
-- ------------------------------------------------------------
alter table public.soil_call_history enable row level security;

drop policy if exists soil_call_history_select_own on public.soil_call_history;
drop policy if exists soil_call_history_select_manager_dept on public.soil_call_history;
drop policy if exists soil_call_history_select_admin on public.soil_call_history;
drop policy if exists soil_call_history_select_case_assigned on public.soil_call_history;
drop policy if exists soil_call_history_insert_own on public.soil_call_history;
drop policy if exists soil_call_history_update_own_recent on public.soil_call_history;
drop policy if exists soil_call_history_update_admin on public.soil_call_history;
drop policy if exists soil_call_history_no_delete on public.soil_call_history;

-- 7.1 SELECT: 自分の架電は誰でも閲覧可
create policy soil_call_history_select_own
  on public.soil_call_history for select
  to authenticated
  using (user_id = auth.uid());

-- 7.2 SELECT: manager は自部門の架電を閲覧可
create policy soil_call_history_select_manager_dept
  on public.soil_call_history for select
  to authenticated
  using (
    public.current_garden_role() = 'manager'
    and user_id in (
      select user_id from public.root_employees
      where department_id = public.current_department_id()
    )
  );

-- 7.3 SELECT: admin+ は全件参照可
create policy soil_call_history_select_admin
  on public.soil_call_history for select
  to authenticated
  using (
    public.current_garden_role() in ('admin', 'super_admin')
  );

-- 7.4 SELECT: 担当案件の全履歴（他人の架電も含む）
create policy soil_call_history_select_case_assigned
  on public.soil_call_history for select
  to authenticated
  using (
    case_id is not null
    and exists (
      select 1 from public.leaf_kanden_cases
      where id = soil_call_history.case_id and assigned_to = auth.uid()
    )
    -- 他 Leaf 商材は商材追加時に or 句で追加
  );

-- 7.5 INSERT: 自分の架電のみ（user_id = auth.uid() 必須）
create policy soil_call_history_insert_own
  on public.soil_call_history for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_garden_role() in
        ('toss', 'closer', 'cs', 'staff', 'manager', 'admin', 'super_admin')
  );

-- 7.6 UPDATE: 自分の架電を 24 時間以内のみ修正可（誤入力訂正）
create policy soil_call_history_update_own_recent
  on public.soil_call_history for update
  to authenticated
  using (
    user_id = auth.uid()
    and created_at > now() - interval '24 hours'
  )
  with check (
    user_id = auth.uid()
  );

-- 7.7 UPDATE: admin+ はいつでも修正可（業務監査による訂正）
create policy soil_call_history_update_admin
  on public.soil_call_history for update
  to authenticated
  using (
    public.current_garden_role() in ('admin', 'super_admin')
  )
  with check (
    public.current_garden_role() in ('admin', 'super_admin')
  );

-- 7.8 DELETE: 完全禁止（戦略書 判 2、コール履歴は永続）
create policy soil_call_history_no_delete
  on public.soil_call_history for delete
  to authenticated
  using (false);

-- ------------------------------------------------------------
-- 8. MV REFRESH ヘルパー関数（B-04 cron で利用予定）
-- ------------------------------------------------------------
create or replace function public.refresh_soil_lists_assignments()
returns void
language sql
security definer
as $$
  refresh materialized view concurrently public.soil_lists_assignments;
$$;

comment on function public.refresh_soil_lists_assignments() is
  'soil_lists_assignments MV を CONCURRENTLY REFRESH。1 時間 1 回 cron で呼出予定（B-04 §7）。';

-- ============================================================
-- end of migration
-- ============================================================
