-- =====================================================================
-- Garden-Forest Tax Files Storage bucket migration (T-F5-01)
-- 税理士連携ファイル本体を保管する forest-tax bucket の作成と RLS。
--
-- 注意: bucket は Supabase Dashboard で先に物理作成しておくのが推奨。
--       本 SQL は file_size_limit / allowed_mime_types の更新と
--       Storage RLS ポリシーの設定。
--
-- 作成: 2026-04-25 (a-forest, T-F5 閲覧着手分)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Bucket メタ（存在しない場合は作成、存在する場合は設定上書き）
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('forest-tax', 'forest-tax', false, 52428800,             -- 50 MB
   ARRAY[
     'application/pdf',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'text/csv',
     'image/jpeg',
     'image/png'
   ])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. Storage RLS ポリシー
-- 方針:
--   SELECT          : forest_is_user()
--   INSERT/UPDATE/DELETE : forest_is_admin()
-- ---------------------------------------------------------------------
CREATE POLICY ft_read_forest_user
  ON storage.objects FOR SELECT
  USING (bucket_id = 'forest-tax' AND forest_is_user());

CREATE POLICY ft_insert_admin
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'forest-tax' AND forest_is_admin());

CREATE POLICY ft_update_admin
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'forest-tax' AND forest_is_admin())
  WITH CHECK (bucket_id = 'forest-tax' AND forest_is_admin());

CREATE POLICY ft_delete_admin
  ON storage.objects FOR DELETE
  USING (bucket_id = 'forest-tax' AND forest_is_admin());

COMMIT;

-- =====================================================================
-- 検証クエリ（投入後の確認用）
-- =====================================================================
-- SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'forest-tax';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'ft%';

-- =====================================================================
-- ROLLBACK SQL（不具合時のクリーンアップ）
-- 本番環境では必ず pg_dump でバックアップ取得後に実行。
-- =====================================================================
/*
BEGIN;
DROP POLICY IF EXISTS ft_read_forest_user ON storage.objects;
DROP POLICY IF EXISTS ft_insert_admin     ON storage.objects;
DROP POLICY IF EXISTS ft_update_admin     ON storage.objects;
DROP POLICY IF EXISTS ft_delete_admin     ON storage.objects;
-- bucket 自体の削除は中身を空にしてから手動 (Dashboard) 推奨
COMMIT;
*/
