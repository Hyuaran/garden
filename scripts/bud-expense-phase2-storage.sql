-- ============================================================
-- Garden Bud — 経費精算 Phase 2: レシート画像の保存先 Storage バケット
-- 非公開バケット bud-receipts を作成し、認証ユーザーが読み書きできるようにする。
-- Supabase SQL Editor で実行。安全（IF NOT EXISTS / ポリシー未存在時のみ作成）。
-- ============================================================

-- 非公開バケット作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('bud-receipts', 'bud-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- storage.objects ポリシー（このバケットに限定）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='bud_receipts_insert') THEN
    CREATE POLICY bud_receipts_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'bud-receipts');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='bud_receipts_select') THEN
    CREATE POLICY bud_receipts_select ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'bud-receipts');
  END IF;
END $$;
