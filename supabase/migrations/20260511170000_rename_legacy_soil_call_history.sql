-- ============================================================
-- Garden Soil — 既存 soil_call_history (Tree 残骸) を退避 rename
-- ============================================================
-- 対応 dispatch:
--   - main- No. 294（a-main-023、2026-05-11）= silent NO-OP 罠 # 2 解消
--   - audit-001- No. 15（a-audit-001、2026-05-11 17:15）= silent NO-OP 罠 発見
--
-- 作成: 2026-05-11（a-soil-002、Phase B-01 apply prep）
--
-- 目的:
--   garden-dev に既存する旧 Tree D-01 残骸の soil_call_history（非 PARTITIONED、
--   EMP-1324 等の実データ入り）を soil_call_history_legacy_tree_20260511 に rename し、
--   Soil 仕様の soil_call_history（月次 PARTITIONED）を CREATE できる状態にする。
--
-- silent NO-OP 罠の正体:
--   supabase/migrations/20260507000002_soil_call_history.sql は
--   `CREATE TABLE IF NOT EXISTS public.soil_call_history (...) PARTITION BY RANGE (call_datetime);`
--   既存テーブルがあると IF NOT EXISTS が「同名テーブルあり」と判定して silent skip し、
--   PARTITION 親への置換が起こらない。後続 INDEX / RLS migration が「Soil 仕様列」を
--   参照すると column does not exist で破綻する。
--
-- 本 migration の動作:
--   1. 既存 soil_call_history が PARTITIONED テーブルなら = Soil 仕様 apply 済 → skip
--   2. 既存 soil_call_history が 非 PARTITIONED なら = Tree 残骸 → rename
--   3. そもそも soil_call_history が存在しない → skip
--   4. すでに soil_call_history_legacy_tree_20260511 が存在 → skip（再実行安全性）
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイル内容を貼付し Run。
--   apply 順序: 本 migration → 20260507000001 → 20260507000002 → ... → 20260509000001
--   詳細は docs/runbooks/soil-phase-b01-apply-20260511.md §2 参照。
--
-- 冪等性:
--   IF / EXISTS 判定で再実行可能。すでに rename 済なら NO-OP。
--
-- 不可逆性:
--   テーブル rename は ALTER TABLE のため可逆（rename back 可能）。
--   FK 制約・index は table OID 参照のため rename 後も自動的に追従。
--   Tree 側で legacy table を参照しているコード（FK 含む）は引き続き動作する。
--   ただし Tree D-01 spec 修正（# 290 で a-tree-002 担当）で
--   参照先を soil_call_history（Soil 仕様）に切り替える計画。
--
-- 想定リスクと対応:
--   - inbound FK（他テーブルから legacy への参照）: FK constraint は table OID 参照のため自動追従、ALTER で破綻しない
--   - 列同名衝突: 同じ列名（id / list_id 等）が legacy と Soil 仕様に存在しても
--     別物テーブルなので衝突しない（rename で完全分離）
--   - データ消失: rename は data preserve、データ消失なし
-- ============================================================

-- ------------------------------------------------------------
-- 1. 状態判定 + 条件付き rename
-- ------------------------------------------------------------

do $$
declare
  v_exists_legacy_name   boolean;
  v_exists_target_name   boolean;
  v_is_partitioned       boolean;
  v_row_count            bigint;
begin
  -- 1-1. 既存テーブル存在判定
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'soil_call_history'
  ) into v_exists_legacy_name;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'soil_call_history_legacy_tree_20260511'
  ) into v_exists_target_name;

  -- 1-2. 既存テーブル不存在 → 新規環境想定、何もしない
  if not v_exists_legacy_name then
    raise notice '[rename-legacy] soil_call_history が存在しません。新規環境想定、何もしません。';
    return;
  end if;

  -- 1-3. すでに rename 済（target name 存在）→ 二重 rename を防ぐため何もしない
  if v_exists_target_name then
    raise notice '[rename-legacy] soil_call_history_legacy_tree_20260511 がすでに存在。二重 rename を防ぐため何もしません。';
    return;
  end if;

  -- 1-4. 既存 soil_call_history が PARTITIONED か判定
  --   Soil 仕様 = PARTITION BY RANGE (call_datetime)
  --   Tree 残骸 = 非 PARTITIONED
  select exists (
    select 1
    from pg_partitioned_table pt
    join pg_class c on c.oid = pt.partrelid
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'soil_call_history' and n.nspname = 'public'
  ) into v_is_partitioned;

  if v_is_partitioned then
    raise notice '[rename-legacy] soil_call_history は PARTITIONED（Soil 仕様適用済の可能性）。rename をスキップします。';
    raise notice '[rename-legacy] もし誤判定であれば、手動で psql から構造確認後に対処してください。';
    return;
  end if;

  -- 1-5. 行数記録（rename 前後の整合性検証用、log に出力）
  execute 'select count(*) from public.soil_call_history' into v_row_count;
  raise notice '[rename-legacy] 既存 soil_call_history（非 PARTITIONED）の行数: %', v_row_count;

  -- 1-6. rename 実行
  alter table public.soil_call_history rename to soil_call_history_legacy_tree_20260511;
  raise notice '[rename-legacy] ✅ ALTER TABLE soil_call_history RENAME TO soil_call_history_legacy_tree_20260511 完了';

  -- 1-7. rename 後の検証
  execute 'select count(*) from public.soil_call_history_legacy_tree_20260511' into v_row_count;
  raise notice '[rename-legacy] rename 後 soil_call_history_legacy_tree_20260511 の行数: %（rename 前と一致を確認）', v_row_count;

  -- 1-8. 旧テーブル名が空きスロットになったか確認
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'soil_call_history'
  ) into v_exists_legacy_name;

  if v_exists_legacy_name then
    raise exception '[rename-legacy] ERROR: rename 後も soil_call_history が存在。想定外の状態です。';
  end if;

  raise notice '[rename-legacy] ✅ soil_call_history 名が空きスロットになりました。次の migration（20260507000002_soil_call_history.sql）を apply してください。';
end $$;

-- ------------------------------------------------------------
-- 2. テーブル comment 付与（出自記録）
-- ------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'soil_call_history_legacy_tree_20260511'
  ) then
    execute $cmt$
      comment on table public.soil_call_history_legacy_tree_20260511 is
        '【legacy】Tree D-01 旧設計時代に作成された soil_call_history 残骸。'
        '2026-05-11 に Soil 仕様 soil_call_history（月次 PARTITIONED）作成のため rename 退避。'
        'Tree 側で参照中。a-tree-002 の Tree D-01 spec 修正（# 290）でデータ移行 + 廃止予定。'
        'dispatch: main- No. 294 / audit-001- No. 15。'
    $cmt$;
    raise notice '[rename-legacy] テーブル comment 付与完了';
  end if;
end $$;

-- ============================================================
-- 注意事項（東海林さん向け、apply 後）
-- ============================================================
--
-- 1. 本 migration apply 後に Supabase Dashboard で以下を確認:
--    select tablename, rowsecurity from pg_tables
--    where tablename in ('soil_call_history', 'soil_call_history_legacy_tree_20260511')
--    and schemaname = 'public';
--
--    期待:
--    - soil_call_history → 行なし（次の migration で再作成）
--    - soil_call_history_legacy_tree_20260511 → 行あり（rename 済）
--
-- 2. 続いて scripts/soil-phase-b01-preflight.sql を Run して
--    legacy table の列構造・行数・inbound FK を記録（Tree 側修復計画の入力）。
--
-- 3. その後、apply 順序に従い 20260507000001 〜 20260509000001 を順次 Run。
--    詳細は docs/runbooks/soil-phase-b01-apply-20260511.md §2 参照。
--
-- 4. Tree 側参照修復（# 290 で a-tree-002 担当）完了後、
--    legacy table のデータ移行 + 廃止を別 migration で実施予定。
--    その際は本 migration をロールバック（rename back）するわけではなく、
--    legacy table を別途 truncate or drop する。
-- ============================================================
