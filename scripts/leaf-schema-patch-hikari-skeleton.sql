-- ============================================================
-- Garden-Leaf 002_光回線業務委託 最小 skeleton migration
-- Run this in Supabase Dashboard > SQL Editor
-- Spec: docs/superpowers/specs/2026-05-08-leaf-hikari-skeleton-design.md
-- 作成: 2026-05-08（a-leaf-002）
--
-- 前提:
--   1. A-1c v3.2 共通基盤（scripts/leaf-schema-patch-a1c.sql）が先行実行済み
--      - leaf_businesses / leaf_user_businesses テーブル存在
--      - leaf_user_in_business(biz_id) / garden_role_of(uid) / is_user_active() 関数存在
--   2. Root A-3-g（is_user_active / garden_role_of / outsource）develop merge 済
--   3. soil_kanden_cases テーブル存在（v_leaf_cases UNION ALL 用）
-- ============================================================

-- ===== 1. leaf_businesses に 'hikari' 行を追加 =====
INSERT INTO public.leaf_businesses (business_id, display_name, created_at, updated_at)
VALUES ('hikari', '光回線業務委託', now(), now())
ON CONFLICT (business_id) DO NOTHING;

-- ===== 2. leaf_hikari_cases テーブル =====
CREATE TABLE IF NOT EXISTS public.leaf_hikari_cases (
  -- 基本識別子
  case_id            text PRIMARY KEY,
  business_id        text NOT NULL DEFAULT 'hikari'
                     REFERENCES public.leaf_businesses(business_id),
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'contracted', 'construction_scheduled',
                                       'construction_completed', 'opened', 'cancelled', 'lost')),

  -- 顧客情報（最小、Phase B-1 で詳細化）
  customer_name      text NOT NULL,
  customer_kana      text,
  customer_phone     text,
  customer_address   text,

  -- 契約情報（最小）
  plan_name          text,
  monthly_fee        numeric(10,2),
  contract_term      smallint,
  cancellation_fee   numeric(10,2),

  -- 工事 / 開通
  construction_date  date,
  opening_date       date,

  -- 業務委託情報
  sales_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sales_company_id   uuid,
  apo_code           text,

  -- 共通メタ
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz DEFAULT NULL,
  deleted_by         uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.leaf_hikari_cases IS
  '光回線業務委託 案件本体。business_id = hikari 固定。Phase B-1 で詳細フィールド追加';

CREATE INDEX IF NOT EXISTS idx_leaf_hikari_status
  ON public.leaf_hikari_cases (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaf_hikari_sales_user
  ON public.leaf_hikari_cases (sales_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaf_hikari_construction_date
  ON public.leaf_hikari_cases (construction_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaf_hikari_deleted
  ON public.leaf_hikari_cases (deleted_at) WHERE deleted_at IS NOT NULL;

-- ===== 3. leaf_hikari_attachments テーブル =====
CREATE TABLE IF NOT EXISTS public.leaf_hikari_attachments (
  attachment_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            text NOT NULL REFERENCES public.leaf_hikari_cases(case_id) ON DELETE CASCADE,
  business_id        text NOT NULL DEFAULT 'hikari'
                     REFERENCES public.leaf_businesses(business_id),
  category           text NOT NULL
                     CHECK (category IN ('contract', 'construction_photo',
                                          'installation_confirm', 'misc')),
  storage_url        text NOT NULL,
  thumbnail_url      text,
  mime_type          text,
  file_size          bigint,
  is_guide_capture   boolean NOT NULL DEFAULT FALSE,
  is_post_added      boolean NOT NULL DEFAULT FALSE,
  ocr_processed      boolean NOT NULL DEFAULT FALSE,
  archived_tier      text DEFAULT 'recent'
                     CHECK (archived_tier IN ('recent', 'monthly', 'yearly')),
  archived_at        timestamptz DEFAULT NULL,
  uploaded_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz DEFAULT NULL,
  deleted_by         uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.leaf_hikari_attachments IS
  '光回線業務委託 添付ファイル。A-1c v3.2 の kanden 構造と並列、business_id = hikari';

CREATE INDEX IF NOT EXISTS idx_leaf_hikari_attachments_case
  ON public.leaf_hikari_attachments (case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaf_hikari_attachments_category
  ON public.leaf_hikari_attachments (category) WHERE deleted_at IS NULL;

-- ===== 4. RLS for leaf_hikari_cases =====
ALTER TABLE public.leaf_hikari_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leaf_hikari_cases_select ON public.leaf_hikari_cases;
CREATE POLICY leaf_hikari_cases_select ON public.leaf_hikari_cases
  FOR SELECT USING (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_hikari_cases_insert ON public.leaf_hikari_cases;
CREATE POLICY leaf_hikari_cases_insert ON public.leaf_hikari_cases
  FOR INSERT WITH CHECK (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_hikari_cases_update ON public.leaf_hikari_cases;
CREATE POLICY leaf_hikari_cases_update ON public.leaf_hikari_cases
  FOR UPDATE USING (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  ) WITH CHECK (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_hikari_cases_delete ON public.leaf_hikari_cases;
CREATE POLICY leaf_hikari_cases_delete ON public.leaf_hikari_cases
  FOR DELETE USING (
    public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

-- ===== 5. RLS for leaf_hikari_attachments =====
ALTER TABLE public.leaf_hikari_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leaf_hikari_attachments_select ON public.leaf_hikari_attachments;
CREATE POLICY leaf_hikari_attachments_select ON public.leaf_hikari_attachments
  FOR SELECT USING (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_hikari_attachments_insert ON public.leaf_hikari_attachments;
CREATE POLICY leaf_hikari_attachments_insert ON public.leaf_hikari_attachments
  FOR INSERT WITH CHECK (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_hikari_attachments_update ON public.leaf_hikari_attachments;
CREATE POLICY leaf_hikari_attachments_update ON public.leaf_hikari_attachments
  FOR UPDATE USING (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  ) WITH CHECK (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS leaf_hikari_attachments_delete ON public.leaf_hikari_attachments;
CREATE POLICY leaf_hikari_attachments_delete ON public.leaf_hikari_attachments
  FOR DELETE USING (
    public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

-- ===== 6. v_leaf_cases VIEW（cross-business unified view、新事業追加で UNION ALL）=====
-- 既存に soil_kanden_cases ベースの VIEW がある場合は CREATE OR REPLACE で上書き
CREATE OR REPLACE VIEW public.v_leaf_cases AS
SELECT
  case_id,
  'kanden'::text AS business_id,
  status,
  customer_name,
  customer_phone,
  sales_user_id,
  sales_company_id,
  apo_code,
  created_at,
  updated_at,
  deleted_at
FROM public.soil_kanden_cases
WHERE deleted_at IS NULL

UNION ALL

SELECT
  case_id,
  'hikari'::text AS business_id,
  status,
  customer_name,
  customer_phone,
  sales_user_id,
  sales_company_id,
  apo_code,
  created_at,
  updated_at,
  deleted_at
FROM public.leaf_hikari_cases
WHERE deleted_at IS NULL;

COMMENT ON VIEW public.v_leaf_cases IS
  'Leaf 配下の全事業の案件を横断 SELECT する unified view。新事業追加時は UNION ALL で行追加';

-- ===== 7. 検証クエリ（実行後の確認用、コメントアウト推奨）=====
-- SELECT * FROM public.leaf_businesses WHERE business_id = 'hikari';
-- SELECT * FROM information_schema.tables WHERE table_name LIKE 'leaf_hikari%';
-- SELECT * FROM information_schema.views WHERE table_name = 'v_leaf_cases';
-- SELECT count(*) FROM public.v_leaf_cases;

-- ============================================================
-- Migration 完了
-- 次工程: Phase B-1 業務フロー詳細 spec の起草（東海林さんヒアリング後）
-- ============================================================
