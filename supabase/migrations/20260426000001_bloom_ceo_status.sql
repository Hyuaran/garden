-- migration: 20260426000001_bloom_ceo_status
-- purpose: Bloom CEO Status table for ShojiStatusWidget MVP
-- created: 2026-04-26 (a-auto / Task E)

-- ====================================================================
-- 1. CREATE TABLE bloom_ceo_status
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.bloom_ceo_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('available', 'busy', 'focused', 'away')),
  summary text CHECK (char_length(summary) <= 200),  -- 最大 200 字
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bloom_ceo_status
  IS 'CEO（東海林さん）のステータス管理テーブル。ShojiStatusWidget が参照。';
COMMENT ON COLUMN public.bloom_ceo_status.status
  IS 'available=対応可 / busy=作業中 / focused=集中作業 / away=不在';
COMMENT ON COLUMN public.bloom_ceo_status.summary IS '一言ステータス、最大 200 字';

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION public.bloom_ceo_status_set_updated_at()
RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bloom_ceo_status_updated_at
  BEFORE UPDATE ON public.bloom_ceo_status
  FOR EACH ROW EXECUTE FUNCTION public.bloom_ceo_status_set_updated_at();

-- ====================================================================
-- 2. RLS（行レベルセキュリティ）
-- ====================================================================

ALTER TABLE public.bloom_ceo_status ENABLE ROW LEVEL SECURITY;

-- 全 authenticated は SELECT 可（社員全員がステータス参照）
CREATE POLICY ceo_status_select_all
  ON public.bloom_ceo_status
  FOR SELECT
  TO authenticated
  USING (true);

-- super_admin のみ UPDATE 可（東海林さんのみ自分のステータス更新）
CREATE POLICY ceo_status_update_super_admin
  ON public.bloom_ceo_status
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.root_employees
      WHERE user_id = auth.uid()
        AND garden_role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.root_employees
      WHERE user_id = auth.uid()
        AND garden_role = 'super_admin'
    )
  );

-- INSERT は service_role 経由のみ（migration 内 seed + 例外的初期化のみ）
-- DELETE は禁止（status 切替で運用、レコード削除しない）

-- ====================================================================
-- 3. 初期 seed
-- ====================================================================

-- super_admin が見つかった場合のみ初期レコードを作成
INSERT INTO public.bloom_ceo_status (status, summary, updated_by)
SELECT 'available', '初期化', user_id
FROM public.root_employees
WHERE garden_role = 'super_admin'
LIMIT 1
ON CONFLICT DO NOTHING;
