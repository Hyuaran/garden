-- ============================================================
-- Garden-Leaf Phase A-1c v3 添付ファイル機能 migration（Supabase CLI 用）
-- ============================================================
-- 本ファイルは scripts/leaf-schema-patch-a1c.sql と同一内容。
-- Supabase CLI (`supabase db push` 等) で適用される際の正本。
-- Dashboard 経由で手動実行する場合は scripts/ 配下の SQL を使用。
-- ============================================================

-- ===== 0. 拡張機能 =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== 1. 既存 leaf_kanden_attachments 拡張 =====
ALTER TABLE leaf_kanden_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES root_employees(user_id);

CREATE INDEX IF NOT EXISTS idx_leaf_kanden_attachments_case_id_active
  ON leaf_kanden_attachments (case_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leaf_kanden_attachments_case_id_deleted
  ON leaf_kanden_attachments (case_id)
  WHERE deleted_at IS NOT NULL;

-- ===== 2. 事業マスタ + ユーザー所属テーブル =====
CREATE TABLE IF NOT EXISTS leaf_businesses (
  business_id    text PRIMARY KEY,
  display_name   text NOT NULL,
  product_type   text,
  flow_type      text,
  start_date     date,
  end_date       date,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE leaf_businesses IS 'Leaf 配下事業マスタ（関電/CC/ブレーカー等、事業単位アクセス制御）';

CREATE TABLE IF NOT EXISTS leaf_user_businesses (
  user_id        uuid NOT NULL REFERENCES root_employees(user_id),
  business_id    text NOT NULL REFERENCES leaf_businesses(business_id),
  role_in_biz    text,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  assigned_by    uuid REFERENCES root_employees(user_id),
  removed_at     timestamptz,
  PRIMARY KEY (user_id, business_id)
);

COMMENT ON TABLE leaf_user_businesses IS 'ユーザー × 事業 所属（removed_at で有効性判定）';

CREATE INDEX IF NOT EXISTS idx_leaf_user_businesses_user_active
  ON leaf_user_businesses (user_id)
  WHERE removed_at IS NULL;

-- ===== 3. root_settings テーブル =====
CREATE TABLE IF NOT EXISTS root_settings (
  key             text PRIMARY KEY,
  value           jsonb NOT NULL,
  description     text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES root_employees(user_id)
);

COMMENT ON TABLE root_settings IS
  'Garden 横断の汎用 KV ストア（Leaf/Tree が共有）。key 規約: <module>.<setting_name>';

-- ===== 4. 事業所属判定関数 =====
-- a-review #65 重大指摘修正: SECURITY DEFINER 関数に SET search_path = '' を追加
CREATE OR REPLACE FUNCTION public.leaf_user_in_business(biz_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leaf_user_businesses
    WHERE user_id = (SELECT auth.uid())
      AND business_id = biz_id
      AND (removed_at IS NULL OR removed_at > now())
  ) AND public.is_user_active();
$$;

COMMENT ON FUNCTION public.leaf_user_in_business(text) IS
  'auth.uid() が指定事業に有効所属し、かつ is_user_active() が TRUE を返すかを判定';

-- ===== 5. 3 bucket 作成 =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('leaf-kanden-photos-recent',  'leaf-kanden-photos-recent',  false,  5242880, ARRAY['image/jpeg','image/png','image/heic']),
  ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-monthly', false, 52428800, ARRAY['application/pdf']),
  ('leaf-kanden-photos-yearly',  'leaf-kanden-photos-yearly',  false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ===== 6. RLS 有効化 =====
ALTER TABLE leaf_kanden_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaf_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaf_user_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_settings ENABLE ROW LEVEL SECURITY;

-- ===== 7. leaf_kanden_attachments ポリシー =====
DROP POLICY IF EXISTS leaf_attachments_select ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_select ON leaf_kanden_attachments
  FOR SELECT USING (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_attachments_insert ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_insert ON leaf_kanden_attachments
  FOR INSERT WITH CHECK (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_attachments_update ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_update ON leaf_kanden_attachments
  FOR UPDATE USING (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  ) WITH CHECK (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_attachments_delete ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_delete ON leaf_kanden_attachments
  FOR DELETE USING (
    garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- ===== 8. leaf_businesses ポリシー =====
DROP POLICY IF EXISTS leaf_businesses_select ON leaf_businesses;
CREATE POLICY leaf_businesses_select ON leaf_businesses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_businesses_write ON leaf_businesses;
CREATE POLICY leaf_businesses_write ON leaf_businesses
  FOR ALL USING (garden_role_of(auth.uid()) IN ('admin', 'super_admin'))
          WITH CHECK (garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- ===== 9. leaf_user_businesses ポリシー =====
DROP POLICY IF EXISTS leaf_user_businesses_select ON leaf_user_businesses;
CREATE POLICY leaf_user_businesses_select ON leaf_user_businesses
  FOR SELECT USING (
    user_id = auth.uid()
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_user_businesses_write ON leaf_user_businesses;
CREATE POLICY leaf_user_businesses_write ON leaf_user_businesses
  FOR ALL USING (garden_role_of(auth.uid()) IN ('admin', 'super_admin'))
          WITH CHECK (garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- ===== 10. root_settings ポリシー =====
DROP POLICY IF EXISTS root_settings_select_leaf ON root_settings;
CREATE POLICY root_settings_select_leaf ON root_settings
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND key LIKE 'leaf.%'
  );

DROP POLICY IF EXISTS root_settings_write_leaf ON root_settings;
CREATE POLICY root_settings_write_leaf ON root_settings
  FOR ALL USING (
    key LIKE 'leaf.%'
    AND garden_role_of(auth.uid()) = 'super_admin'
  ) WITH CHECK (
    key LIKE 'leaf.%'
    AND garden_role_of(auth.uid()) = 'super_admin'
  );

-- ===== 11. recent bucket ポリシー =====
DROP POLICY IF EXISTS leaf_recent_select ON storage.objects;
CREATE POLICY leaf_recent_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'leaf-kanden-photos-recent' AND (
      leaf_user_in_business('kanden')
      OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS leaf_recent_insert ON storage.objects;
CREATE POLICY leaf_recent_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'leaf-kanden-photos-recent' AND (
      leaf_user_in_business('kanden')
      OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS leaf_recent_update ON storage.objects;
CREATE POLICY leaf_recent_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'leaf-kanden-photos-recent' AND FALSE);

DROP POLICY IF EXISTS leaf_recent_delete ON storage.objects;
CREATE POLICY leaf_recent_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'leaf-kanden-photos-recent'
    AND garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- ===== 12. monthly / yearly bucket ポリシー =====
DROP POLICY IF EXISTS leaf_archive_select ON storage.objects;
CREATE POLICY leaf_archive_select ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-yearly')
    AND (
      leaf_user_in_business('kanden')
      OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS leaf_archive_insert ON storage.objects;
CREATE POLICY leaf_archive_insert ON storage.objects FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS leaf_archive_update ON storage.objects;
CREATE POLICY leaf_archive_update ON storage.objects FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS leaf_archive_delete ON storage.objects;
CREATE POLICY leaf_archive_delete ON storage.objects FOR DELETE USING (FALSE);

-- ===== 13. 変更履歴テーブル + trigger =====
CREATE TABLE IF NOT EXISTS leaf_kanden_attachments_history (
  history_id       bigserial PRIMARY KEY,
  attachment_id    uuid NOT NULL,
  operation        text NOT NULL,
  changed_field    text,
  old_value        text,
  new_value        text,
  changed_by       uuid REFERENCES root_employees(user_id),
  changed_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE leaf_kanden_attachments_history IS
  'Attachment 変更履歴 (v3)。UPDATE/DELETE 自動記録、UI は Batch 14 横断履歴 spec で別途実装';

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_history_attachment
  ON leaf_kanden_attachments_history (attachment_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_history_changed_by
  ON leaf_kanden_attachments_history (changed_by, changed_at DESC);

-- a-review #65 重大指摘修正: SECURITY DEFINER 関数に SET search_path = '' 追加
CREATE OR REPLACE FUNCTION public.leaf_kanden_attachments_history_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  col_name text;
  tracked_cols text[] := ARRAY[
    'category', 'storage_url', 'thumbnail_url',
    'is_guide_capture', 'is_post_added', 'ocr_processed',
    'mime_type', 'archived_tier', 'archived_at',
    'deleted_at', 'deleted_by'
  ];
  old_val text;
  new_val text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.leaf_kanden_attachments_history
      (attachment_id, operation, changed_field, old_value, new_value, changed_by)
    VALUES (OLD.attachment_id, 'DELETE', NULL,
            to_jsonb(OLD)::text, NULL, (SELECT auth.uid()));
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH col_name IN ARRAY tracked_cols LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col_name, col_name)
        USING OLD, NEW INTO old_val, new_val;
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO public.leaf_kanden_attachments_history
          (attachment_id, operation, changed_field, old_value, new_value, changed_by)
        VALUES (NEW.attachment_id, 'UPDATE', col_name, old_val, new_val, (SELECT auth.uid()));
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_leaf_kanden_attachments_history ON public.leaf_kanden_attachments;
CREATE TRIGGER trg_leaf_kanden_attachments_history
  AFTER UPDATE OR DELETE ON public.leaf_kanden_attachments
  FOR EACH ROW EXECUTE FUNCTION public.leaf_kanden_attachments_history_trigger();

ALTER TABLE leaf_kanden_attachments_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leaf_history_select ON leaf_kanden_attachments_history;
CREATE POLICY leaf_history_select ON leaf_kanden_attachments_history
  FOR SELECT USING (
    garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM leaf_kanden_attachments a
      WHERE a.attachment_id = leaf_kanden_attachments_history.attachment_id
        AND leaf_user_in_business('kanden')
    )
  );

DROP POLICY IF EXISTS leaf_history_no_write ON leaf_kanden_attachments_history;
CREATE POLICY leaf_history_no_write ON leaf_kanden_attachments_history
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- ===== 14. 画像 DL 専用パスワード RPC =====
-- a-review #65 重大指摘修正:
--   1. SECURITY DEFINER 関数に SET search_path = '' を追加 (schema poisoning 対策)
--   2. set_image_download_password はクライアントから平文 PW を受取り、サーバ側で bcrypt 化
--   3. pgcrypto の crypt / gen_salt は extensions schema を明示
CREATE OR REPLACE FUNCTION public.verify_image_download_password(input_password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT value->>'hash' INTO stored_hash
  FROM public.root_settings
  WHERE key = 'leaf.image_download_password_hash';
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN stored_hash = extensions.crypt(input_password, stored_hash);
END;
$$;

COMMENT ON FUNCTION public.verify_image_download_password(text) IS
  '画像 DL 専用 PW を bcrypt 比較。クライアントから平文 PW を受取り、サーバ側で hash 化済み値と比較。一致で TRUE';

-- 引数変更: new_hash → new_password (a-review #65 重大指摘 2)
CREATE OR REPLACE FUNCTION public.set_image_download_password(new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  hashed_pw text;
BEGIN
  IF public.garden_role_of((SELECT auth.uid())) != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: super_admin only';
  END IF;
  hashed_pw := extensions.crypt(new_password, extensions.gen_salt('bf', 12));
  INSERT INTO public.root_settings (key, value, updated_at, updated_by)
  VALUES (
    'leaf.image_download_password_hash',
    jsonb_build_object('hash', hashed_pw),
    now(),
    (SELECT auth.uid())
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;
END;
$$;

COMMENT ON FUNCTION public.set_image_download_password(text) IS
  'super_admin が画像 DL 専用 PW を設定/変更。クライアントから平文 PW を受取り、サーバ内で bcrypt 化保存（任意 hash 送信不可）';

-- ===== 15. 初期データ投入 =====
INSERT INTO leaf_businesses (business_id, display_name, product_type, flow_type, start_date)
VALUES ('kanden', '関電業務委託', '電気', '委託', '2020-01-01')
ON CONFLICT (business_id) DO NOTHING;

-- a-review #65 修正: pgcrypto の crypt / gen_salt は extensions schema を明示
INSERT INTO public.root_settings (key, value, description)
VALUES (
  'leaf.image_download_password_hash',
  jsonb_build_object('hash', extensions.crypt('change-me-immediately', extensions.gen_salt('bf', 12))),
  '画像 DL 専用 PW (bcrypt hash)。super_admin が Root マイページから変更する。仮 PW は即変更必要。'
)
ON CONFLICT (key) DO NOTHING;
