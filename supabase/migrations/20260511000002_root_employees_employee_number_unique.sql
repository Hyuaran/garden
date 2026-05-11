-- ============================================================
-- Garden Root — root_employees.employee_number UNIQUE 制約追加
-- ============================================================
-- 対応 dispatch: 2026-05-11(月) 15:50 a-main-022 main- No. 268
-- 採択方針: 案 A（root_employees.employee_number UNIQUE 化、Tree spec 改訂不要）
-- 関連: 2026-05-11 14:30 Tree D-01 apply 失敗（42830 invalid_foreign_key）対応
--
-- 真因（a-main-022 確定）:
--   - scripts/root-schema.sql L99-100 で employee_number に UNIQUE 制約なし
--   - Tree D-01 schema が FK 参照先を employee_number にしているため、
--     PostgreSQL の「FK 参照先は UNIQUE/PK が必須」ルールで 42830 エラー
--
-- 解消方針（Garden 全体方針）:
--   - employee_number を「社内管理番号」として横断 FK 参照可能化
--   - 業務意図（社内管理番号で参照）を維持、Tree spec 改訂不要
--   - 他モジュール（Bud / Leaf 等）の将来 FK も employee_number 参照可
--
-- 冪等性:
--   DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT で何度実行しても同じ結果。
--   ただし既存データに employee_number 重複があると ADD CONSTRAINT が失敗する。
--   → apply 前に下記「事前確認 SQL」で重複の有無を検証してください。
--
-- 適用方法:
--   1. 下記「事前確認 SQL D-1」を Supabase SQL Editor で実行し、重複 0 件を確認
--   2. 重複 0 件 → 本ファイル全体を Run（UNIQUE 制約追加）
--   3. 重複あり → root-002 へ dispatch、重複データ手当て後に再 apply
--
-- 関連:
--   - Tree D-01 schema: supabase/migrations/20260427000001_tree_phase_d_01.sql
--   - Tree D-01 失敗時 rollback 確認: 下記「事前確認 SQL D-3」
-- ============================================================

-- ------------------------------------------------------------
-- 事前確認 SQL D-1: 既存データ重複検証
-- ------------------------------------------------------------
-- 本 migration 適用前に下記を実行し、重複 0 件であることを確認してください。
-- 重複あり = ADD CONSTRAINT 失敗 → root-002 経由で手当て判断。
--
--   SELECT employee_number, COUNT(*) AS dup_count
--     FROM public.root_employees
--    GROUP BY employee_number
--   HAVING COUNT(*) > 1
--    ORDER BY dup_count DESC, employee_number;
--
-- 期待結果: 0 行（重複なし）

-- ------------------------------------------------------------
-- 事前確認 SQL D-3: Tree D-01 apply 失敗時の rollback 状態確認
-- ------------------------------------------------------------
-- 5/11 14:30 頃の Tree D-01 apply Run 失敗時、PostgreSQL が
-- transaction 単位の自動 rollback を実施したかを確認。
-- 痕跡あり = DROP TABLE 必要（root-002 判断 + dispatch 経由報告）。
--
--   SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public'
--      AND (tablename LIKE 'tree_calling%'
--           OR tablename = 'tree_call_records'
--           OR tablename LIKE 'tree_agent%')
--    ORDER BY tablename;
--
-- 期待結果: 0 行（完全 rollback、Tree D-01 再 apply 可能）

-- ============================================================
-- 本体: UNIQUE 制約追加
-- ============================================================

-- ------------------------------------------------------------
-- 既存制約があれば一旦 drop（冪等化）
-- ------------------------------------------------------------
ALTER TABLE public.root_employees
  DROP CONSTRAINT IF EXISTS root_employees_employee_number_unique;

-- ------------------------------------------------------------
-- UNIQUE 制約追加
-- ------------------------------------------------------------
-- ⚠️ 既存データに重複があると本ステートメントで失敗する。
--    事前確認 SQL D-1 で 0 件を確認してから実行してください。
-- ------------------------------------------------------------

ALTER TABLE public.root_employees
  ADD CONSTRAINT root_employees_employee_number_unique
  UNIQUE (employee_number);

-- ------------------------------------------------------------
-- COMMENT
-- ------------------------------------------------------------

COMMENT ON CONSTRAINT root_employees_employee_number_unique
  ON public.root_employees IS
  '社内管理番号は重複不可。Tree D-01 / 他モジュール横断 FK 参照のための前提（dispatch main- No. 268、案 A 採択 2026-05-11）。';

-- ============================================================
-- 確認クエリ（apply 後の手動実行用）
-- ============================================================

-- 制約定義確認:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.root_employees'::regclass
--      AND conname LIKE '%employee_number%';
--
-- 期待結果: 1 行
--   conname: root_employees_employee_number_unique
--   def:     UNIQUE (employee_number)

-- 制約有効性確認（重複 INSERT で失敗するか）:
--   -- 既存任意の employee_number を取得
--   SELECT employee_number FROM public.root_employees LIMIT 1;
--   -- それを使って重複 INSERT 試行（実行すると失敗する）
--   -- INSERT INTO public.root_employees (employee_id, employee_number, name, ...)
--   --   VALUES ('EMP-XXXX', '<上で取得した値>', ...);
--   -- 期待: ERROR: duplicate key value violates unique constraint

-- Tree D-01 再 apply 前提条件確認:
--   SELECT
--     EXISTS(SELECT 1 FROM pg_constraint
--             WHERE conname = 'root_employees_employee_number_unique')
--       AS employee_number_unique_ready;
-- 期待: t (true)

-- ============================================================
-- 次アクション（apply 後）
-- ============================================================
-- 1. 本 migration apply 完了
-- 2. a-tree-002 へ通知（main 経由）: Tree D-01 再 apply 可能
-- 3. Tree D-01 (supabase/migrations/20260427000001_tree_phase_d_01.sql) を再 Run
-- 4. Tree Phase D §0 Pre-flight Task 0 着手解放
