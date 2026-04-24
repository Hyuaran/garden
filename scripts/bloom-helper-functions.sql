-- ============================================================
-- Garden Bloom — Helper Functions
-- RLS ポリシーから再利用する権限判定関数
--
-- 依存: root_employees.user_id / root_employees.garden_role
-- 関連: scripts/root-schema.sql（Garden-Root 側で先に適用されていること）
--
-- Run in: Supabase Dashboard > SQL Editor（初回のみ / schema 適用前）
-- ============================================================

-- role 階層をランク化（garden 標準 7 段階）
-- 1: toss < 2: closer < 3: cs < 4: staff < 5: manager < 6: admin < 7: super_admin
CREATE OR REPLACE FUNCTION bloom_role_rank(role_value text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE role_value
    WHEN 'toss'        THEN 1
    WHEN 'closer'      THEN 2
    WHEN 'cs'          THEN 3
    WHEN 'staff'       THEN 4
    WHEN 'manager'     THEN 5
    WHEN 'admin'       THEN 6
    WHEN 'super_admin' THEN 7
    ELSE 0
  END
$$;

-- 現在の auth ユーザーの garden_role を取得（未登録時は NULL）
CREATE OR REPLACE FUNCTION bloom_current_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT re.garden_role FROM root_employees re
  WHERE re.user_id = auth.uid()
  LIMIT 1
$$;

-- 指定ロール以上の権限を持つか判定（RLS USING / WITH CHECK で使用）
-- 例: bloom_has_access('admin') → admin / super_admin のみ true
CREATE OR REPLACE FUNCTION bloom_has_access(role_min text)
RETURNS bool LANGUAGE sql STABLE AS $$
  SELECT COALESCE(bloom_role_rank(bloom_current_role()), 0) >= bloom_role_rank(role_min)
$$;
