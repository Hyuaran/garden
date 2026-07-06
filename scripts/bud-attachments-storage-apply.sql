-- ============================================================
-- Garden Bud — 振込パート用 Storage バケット bud-attachments 作成
-- 用途: 画面アップロード添付（Phase1）＋複合機取込の未処理トレイ（Phase2）
-- 公開バケット（現行コードが公開URLで表示・リンクする作りのため。
--   パスに Drive のランダムID/タイムスタンプを含み URL は事実上推測不可）
-- Supabase SQL Editor で実行。冪等（何度実行しても安全）。
-- ============================================================

-- 公開バケット作成（既にあれば public=true に揃えるだけ）
INSERT INTO storage.buckets (id, name, public)
VALUES ('bud-attachments', 'bud-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- storage.objects ポリシー（このバケットに限定・認証ユーザー）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='bud_attachments_insert') THEN
    CREATE POLICY bud_attachments_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'bud-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='bud_attachments_select') THEN
    CREATE POLICY bud_attachments_select ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'bud-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='bud_attachments_delete') THEN
    CREATE POLICY bud_attachments_delete ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'bud-attachments');
  END IF;
END $$;

-- 確認用: 実行後にこれを流すと bucket が見える
-- SELECT id, public FROM storage.buckets WHERE id = 'bud-attachments';
