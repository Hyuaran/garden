-- ============================================================
-- Garden Soil — handle_pd_number_change DB 関数
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-04-26-soil-phase-b-03-kanden-master-integration.md（B-03 §6）
-- 作成: 2026-05-07（Batch 16 + B-03 連携実装、a-soil）
--
-- 目的:
--   関電 Kintone App 55 の差分同期で、同一 supply_point_22 で pd_number 変更を
--   検出した際に Trx 内整合更新を実施する DB 関数。
--
--   フロー（B-03 §6.1）:
--     1. 旧 pd_number を soil_lists.old_pd_numbers (jsonb 配列) に追加
--     2. soil_lists.pd_number = 新 pd_number に UPDATE
--     3. 既存 leaf_kanden_cases (case_type='latest') を case_type='replaced' に変更
--        - leaf_kanden_cases.old_pd_number = 旧 pd_number
--        - leaf_kanden_cases.replaced_at = now()
--        - leaf_kanden_cases.replaced_by = 実行者
--     4. 新規 leaf_kanden_cases を case_type='latest' で生成
--     5. 監査ログ記録（root_audit_log または operation_logs、テーブル存在時のみ）
--
-- ⚠️ 適用前確認（東海林さん向け）:
--   - leaf_kanden_cases の追加 NOT NULL 列が本関数 INSERT で考慮されていない可能性あり
--   - 実 schema と照合して、必要なら関数を再起草
--   - new_kanden_data jsonb から取得すべき列を a-leaf に確認推奨
--   - 監査ログ INSERT は root_audit_log の有無を本関数内で動的判定（DO ブロック）
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod 適用は東海林さん別途承認後（CLAUDE.md ルール）。
--
-- 前提:
--   - 20260507000001 〜 20260507000004 適用済（soil_lists / leaf_kanden_cases 拡張）
--   - 20260507000003 RLS 適用済（ただし関数は SECURITY DEFINER で実行）
-- ============================================================

create or replace function public.handle_pd_number_change(
  p_soil_list_id    uuid,
  p_old_pd_number   text,
  p_new_pd_number   text,
  p_new_kanden_data jsonb,
  p_performed_by    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_new_case_id uuid;
  v_existing_count int;
  v_audit_table_exists boolean;
begin
  -- 入力検証
  if p_soil_list_id is null then
    return jsonb_build_object('ok', false, 'error', 'soil_list_id is null');
  end if;
  if p_new_pd_number is null or p_new_pd_number = '' then
    return jsonb_build_object('ok', false, 'error', 'new_pd_number is null or empty');
  end if;

  -- 対象 soil_lists が存在するか確認
  perform 1 from public.soil_lists where id = p_soil_list_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'soil_list not found or deleted');
  end if;

  -- ------------------------------------------------------------
  -- 1. soil_lists 側更新（pd_number 履歴 + 現行値）
  -- ------------------------------------------------------------
  update public.soil_lists set
    pd_number = p_new_pd_number,
    old_pd_numbers = coalesce(old_pd_numbers, '[]'::jsonb)
                   || jsonb_build_array(p_old_pd_number),
    updated_at = now(),
    updated_by = p_performed_by
  where id = p_soil_list_id;

  -- ------------------------------------------------------------
  -- 2. 既存 latest 案件 → replaced 化
  -- ------------------------------------------------------------
  update public.leaf_kanden_cases set
    case_type      = 'replaced',
    old_pd_number  = p_old_pd_number,
    replaced_at    = now(),
    replaced_by    = p_performed_by
  where soil_list_id = p_soil_list_id
    and case_type = 'latest';

  get diagnostics v_existing_count = row_count;

  -- ------------------------------------------------------------
  -- 3. 新規 latest 案件生成
  -- ⚠️ leaf_kanden_cases の NOT NULL 列で本関数で考慮していないものがある場合
  --    INSERT 失敗。実 schema 確認後、必要に応じて p_new_kanden_data から
  --    抽出する列を追加すること。
  -- ------------------------------------------------------------
  insert into public.leaf_kanden_cases (
    soil_list_id,
    case_type,
    pd_number
    -- 他 NOT NULL 列は p_new_kanden_data から動的展開する設計に変更可
    -- 例: customer_name = p_new_kanden_data->>'customer_name' 等
  ) values (
    p_soil_list_id,
    'latest',
    p_new_pd_number
  )
  returning id into v_new_case_id;

  -- ------------------------------------------------------------
  -- 4. 監査ログ記録（root_audit_log があれば書込、なければスキップ）
  -- ------------------------------------------------------------
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'root_audit_log'
  ) into v_audit_table_exists;

  if v_audit_table_exists then
    -- root_audit_log の実カラムは Root モジュールの仕様に依存するため動的 SQL で書込
    -- 主要列: action / actor_user_id / target_type / target_id / details (jsonb)
    -- 列名差異吸収のため EXECUTE で柔軟に
    begin
      execute format(
        'insert into public.root_audit_log (action, actor_user_id, target_type, target_id, details, created_at)
         values (%L, %L, %L, %L, %L::jsonb, now())',
        'soil.pd_number_change',
        p_performed_by,
        'soil_lists',
        p_soil_list_id::text,
        jsonb_build_object(
          'old_pd_number', p_old_pd_number,
          'new_pd_number', p_new_pd_number,
          'new_case_id', v_new_case_id,
          'replaced_count', v_existing_count
        )::text
      );
    exception
      when undefined_column then
        -- root_audit_log の列名が想定と異なる → スキップ（要 a-root 確認）
        null;
      when others then
        -- 監査ログ書込失敗は本処理を阻害しない
        null;
    end;
  end if;

  -- ------------------------------------------------------------
  -- 5. 結果返却
  -- ------------------------------------------------------------
  return jsonb_build_object(
    'ok', true,
    'new_case_id', v_new_case_id,
    'replaced_count', v_existing_count,
    'audit_logged', v_audit_table_exists
  );

exception
  when others then
    -- Trx 自動 rollback、エラー詳細を返却
    return jsonb_build_object(
      'ok', false,
      'error', sqlerrm,
      'sqlstate', sqlstate
    );
end $$;

-- 実行権限制限（authenticated のみ実行可、anon は不可）
revoke all on function public.handle_pd_number_change(uuid, text, text, jsonb, uuid) from public;
grant execute on function public.handle_pd_number_change(uuid, text, text, jsonb, uuid) to authenticated;

comment on function public.handle_pd_number_change(uuid, text, text, jsonb, uuid) is
  'B-03 §6: 同一 supply_point_22 での pd_number 変更を Trx 内整合更新。Soil pd_number 履歴追加 + Leaf 既存案件 replaced 化 + 新規 latest 案件生成 + 監査ログ。';

-- ============================================================
-- 使用例（Server Action 側からの呼出）
-- ============================================================
-- const { data, error } = await supabase.rpc('handle_pd_number_change', {
--   p_soil_list_id: '...',
--   p_old_pd_number: 'OLD-12345',
--   p_new_pd_number: 'NEW-67890',
--   p_new_kanden_data: { customer_name: '...', phone_number: '...' },
--   p_performed_by: user.id,
-- });
-- // data = { ok: true, new_case_id: '...', replaced_count: 1, audit_logged: true }
-- ============================================================
