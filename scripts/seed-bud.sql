-- ============================================================
-- Garden Bud — 初期ユーザーシード
-- ============================================================
-- 作成: 2026-04-22
--
-- 目的:
--   Bud の初期利用者を bud_users に登録する。
--   現時点では東海林美琴（社員番号 0008 / garden_role: super_admin）を admin として登録。
--
-- 依存:
--   - root_employees に東海林（社員番号 '0008'）が登録済みであること
--     （Tree Phase A の scripts/seed-tree-accounts.ts で既に登録済み）
--   - bud_users テーブル（scripts/bud-schema.sql）が適用済みであること
--
-- 冪等性:
--   ON CONFLICT (employee_id) DO NOTHING で2回目以降はスキップ。
--
-- 備考:
--   super_admin は `bud_has_access()` で自動許可されるため、
--   このシードレコードは必須ではない。ただし、明示的に bud_role='admin' を
--   持たせておくことで UI 上「Bud 管理者」として表示される。
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
-- ============================================================

INSERT INTO bud_users (employee_id, user_id, bud_role, is_active, assigned_by, assigned_at)
SELECT
  e.employee_id,
  e.user_id,
  'admin',
  true,
  e.user_id,            -- 自分で自分を登録（初期セットアップのため）
  now()
FROM root_employees e
WHERE e.employee_number = '0008'
  AND e.user_id IS NOT NULL
ON CONFLICT (employee_id) DO NOTHING;

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT b.bud_role, b.is_active, e.employee_number, e.name, e.garden_role
--   FROM bud_users b
--   JOIN root_employees e ON e.employee_id = b.employee_id
--   ORDER BY e.employee_number;
