-- =====================================================================
-- Garden-Forest HANKANHI (販管費内訳) migration
-- 判1：A案（別テーブル forest_hankanhi）採用
-- v9 HTML の HANKANHI 定数（L1299-1320）を Supabase へ移行する
--
-- 作成: 2026-04-24（a-auto / Phase A 先行 batch1 #P08）
-- 前提: Garden-Forest 既存スキーマ（companies / fiscal_periods / shinkouki）
-- 参考: docs/forest-v9-to-tsx-migration-plan.md §3.5
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Forest 認証ヘルパー関数（未作成なら作成）
--    ※ 2026-04-25 追加: 当初は既存前提だったが未作成だったため本 migration で定義
--    他の Forest spec（T-F4/T-F11 等）でも使用されるため、ここで定義することで共有
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION forest_is_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM forest_users WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION forest_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM forest_users
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------
-- 1. テーブル定義
-- ---------------------------------------------------------------------
CREATE TABLE forest_hankanhi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text NOT NULL,            -- Forest の companies.id（'hyuaran' 等）を FK
  fiscal_period_id integer,                 -- fiscal_periods.id（integer）。進行期は null
                                            -- ※ 2026-04-25 訂正: 当初 uuid で書いていたが既存 fiscal_periods.id は integer
  ki              int NOT NULL,             -- 第何期（period がまだ無い進行期にも対応）
  yakuin          bigint,                   -- 役員報酬（円）
  kyuyo           bigint,                   -- 給与手当
  settai          bigint,                   -- 接待交際費
  kaigi           bigint,                   -- 会議費
  ryohi           bigint,                   -- 旅費交通費
  hanbai          bigint,                   -- 販売促進費
  chidai          bigint,                   -- 地代家賃
  shiharai        bigint,                   -- 支払報酬料
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','pdf','csv')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id),

  -- 外部キー
  CONSTRAINT fk_hankanhi_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE,
  CONSTRAINT fk_hankanhi_fiscal_period
    FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id) ON UPDATE CASCADE ON DELETE SET NULL,

  -- 同一法人×期は 1 行のみ
  CONSTRAINT uq_hankanhi_company_ki UNIQUE (company_id, ki)
);

COMMENT ON TABLE forest_hankanhi IS
  'Forest 販管費内訳（役員報酬〜支払報酬料の 8 科目）。
   fiscal_periods と 1:1 だが、進行期（period が未作成）を扱うため別テーブル化。
   v9 HANKANHI 定数の移行先。';

-- ---------------------------------------------------------------------
-- 2. インデックス（複合）
-- ---------------------------------------------------------------------
CREATE INDEX forest_hankanhi_company_ki_idx
  ON forest_hankanhi (company_id, ki DESC);

CREATE INDEX forest_hankanhi_period_idx
  ON forest_hankanhi (fiscal_period_id)
  WHERE fiscal_period_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. updated_at 自動更新トリガ
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION forest_hankanhi_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER forest_hankanhi_touch_updated_at_trg
  BEFORE UPDATE ON forest_hankanhi
  FOR EACH ROW
  EXECUTE FUNCTION forest_hankanhi_touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS ポリシー
-- 方針:
--   - SELECT: forest_users に登録済（＝ 既存 Forest と同じ制約）
--   - INSERT/UPDATE/DELETE: admin / super_admin のみ
--   - 他モジュール（Bud/Bloom 等）からの直接参照は**不可**（Forest 経由に統一）
-- ---------------------------------------------------------------------
ALTER TABLE forest_hankanhi ENABLE ROW LEVEL SECURITY;

-- Forest 既存のヘルパー関数を想定（無ければ同等の定義を使う）
-- forest_is_user()   : forest_users に登録済かつ is_active
-- forest_is_admin()  : 上記かつ role IN ('admin','super_admin')

CREATE POLICY fhk_select ON forest_hankanhi
  FOR SELECT
  USING (forest_is_user());

CREATE POLICY fhk_insert ON forest_hankanhi
  FOR INSERT
  WITH CHECK (forest_is_admin());

CREATE POLICY fhk_update ON forest_hankanhi
  FOR UPDATE
  USING (forest_is_admin())
  WITH CHECK (forest_is_admin());

CREATE POLICY fhk_delete ON forest_hankanhi
  FOR DELETE
  USING (forest_is_admin());

-- ---------------------------------------------------------------------
-- 5. 監査ログ連携（forest_audit_log があれば）
-- ---------------------------------------------------------------------
-- INSERT / UPDATE / DELETE のたびに forest_audit_log へ記録するトリガは
-- 既存の audit.ts パターンに合わせて Node 側から writeAuditLog を呼ぶ運用とし、
-- ここでは DB トリガは置かない（既存 shinkouki 更新パターンと整合）

COMMIT;

-- =====================================================================
-- 6. サンプルデータ投入（v9 HANKANHI 定数から抽出）
--    v9: hyuaran (ki 7-9) / centerrise (5-6) / linksupport (4) / arata (4-5) / taiyou (3-4)
--    null 値は v9 そのまま（データなし）
-- =====================================================================

-- 補助: fiscal_periods から id を参照してから INSERT するため CTE を使う
BEGIN;

WITH fp AS (
  SELECT id, company_id, ki FROM fiscal_periods
)
INSERT INTO forest_hankanhi
  (company_id, fiscal_period_id, ki,
   yakuin, kyuyo, settai, kaigi, ryohi, hanbai, chidai, shiharai,
   source)
VALUES
  -- ヒュアラン
  ('hyuaran',    (SELECT id FROM fp WHERE company_id='hyuaran'    AND ki=7), 7,
     6000000, 3335358, 4042193, 1128464, 5170944,  101738, 6714996, 1318868, 'csv'),
  ('hyuaran',    (SELECT id FROM fp WHERE company_id='hyuaran'    AND ki=8), 8,
     6000000, 5040700, 3323219, 1669130, 7459990,  138000, 4437875,  919754, 'csv'),
  ('hyuaran',    (SELECT id FROM fp WHERE company_id='hyuaran'    AND ki=9), 9,
     6000000, 3010600, 4878823, 2031912, 8324136, 1761168, 4455601, 1583407, 'csv'),

  -- センターライズ
  ('centerrise', (SELECT id FROM fp WHERE company_id='centerrise' AND ki=5), 5,
     NULL,    7860301,  186319,    NULL,  618892,    5500,    NULL,  981837, 'csv'),
  ('centerrise', (SELECT id FROM fp WHERE company_id='centerrise' AND ki=6), 6,
     NULL,   23663194,    NULL,    NULL, 1341204,    NULL,    NULL,  984885, 'csv'),

  -- リンクサポート
  ('linksupport', (SELECT id FROM fp WHERE company_id='linksupport' AND ki=4), 4,
     NULL,   32378042, 1138066,  849101, 4877724, 1279878,    NULL, 2030061, 'csv'),

  -- ARATA
  ('arata',      (SELECT id FROM fp WHERE company_id='arata'      AND ki=4), 4,
     NULL,       NULL,    NULL,    NULL,    1500,    NULL,    NULL,  627000, 'csv'),
  ('arata',      (SELECT id FROM fp WHERE company_id='arata'      AND ki=5), 5,
     NULL,       NULL, 4253453, 2457635, 2091561,    NULL,    NULL,  893200, 'csv'),

  -- たいよう
  ('taiyou',     (SELECT id FROM fp WHERE company_id='taiyou'     AND ki=3), 3,
     NULL,       NULL,    NULL,    NULL,    NULL,    NULL,    NULL,    NULL, 'csv'),
  ('taiyou',     (SELECT id FROM fp WHERE company_id='taiyou'     AND ki=4), 4,
     NULL,       NULL,  691669,  438188,  620893,    NULL,    NULL,  193600, 'csv')
ON CONFLICT (company_id, ki) DO UPDATE SET
  yakuin   = EXCLUDED.yakuin,
  kyuyo    = EXCLUDED.kyuyo,
  settai   = EXCLUDED.settai,
  kaigi    = EXCLUDED.kaigi,
  ryohi    = EXCLUDED.ryohi,
  hanbai   = EXCLUDED.hanbai,
  chidai   = EXCLUDED.chidai,
  shiharai = EXCLUDED.shiharai,
  source   = EXCLUDED.source,
  updated_at = now();

COMMIT;

-- =====================================================================
-- 7. 検証クエリ（投入後の確認用）
-- =====================================================================

-- 全件確認
-- SELECT company_id, ki, yakuin, kyuyo, settai, kaigi, ryohi, hanbai, chidai, shiharai
--   FROM forest_hankanhi
--   ORDER BY company_id, ki;

-- 法人ごとの null 率（データ充足度）
-- SELECT company_id, ki,
--   CASE WHEN yakuin    IS NULL THEN 0 ELSE 1 END +
--   CASE WHEN kyuyo     IS NULL THEN 0 ELSE 1 END +
--   CASE WHEN settai    IS NULL THEN 0 ELSE 1 END +
--   CASE WHEN kaigi     IS NULL THEN 0 ELSE 1 END +
--   CASE WHEN ryohi     IS NULL THEN 0 ELSE 1 END +
--   CASE WHEN hanbai    IS NULL THEN 0 ELSE 1 END +
--   CASE WHEN chidai    IS NULL THEN 0 ELSE 1 END +
--   CASE WHEN shiharai  IS NULL THEN 0 ELSE 1 END AS filled_count
--   FROM forest_hankanhi
--   ORDER BY company_id, ki;

-- fiscal_period_id の結合確認
-- SELECT h.company_id, h.ki, h.fiscal_period_id, fp.from_date, fp.to_date
--   FROM forest_hankanhi h
--   LEFT JOIN fiscal_periods fp ON fp.id = h.fiscal_period_id
--   ORDER BY h.company_id, h.ki;

-- =====================================================================
-- 8. ROLLBACK SQL（不具合時のクリーンアップ）
-- =====================================================================
-- 以下を個別に実行するとテーブル・トリガ・サンプルデータを一括削除できる。
-- 本番環境では必ず pg_dump でバックアップ取得後に実行。

/*
BEGIN;
DROP TRIGGER IF EXISTS forest_hankanhi_touch_updated_at_trg ON forest_hankanhi;
DROP FUNCTION IF EXISTS forest_hankanhi_touch_updated_at();
DROP TABLE IF EXISTS forest_hankanhi CASCADE;
COMMIT;
*/

-- =====================================================================
-- 9. 実装時の注意事項
-- =====================================================================
-- A. DetailModal.tsx への組込
--    data.company.id + data.ki から forest_hankanhi を SELECT し、
--    8 項目いずれかが non-null の場合のみ「販管費内訳」セクションを表示
--    null 項目は「―」で fallback（v9 の fmtYenDetail 挙動に合わせる）
--
-- B. queries.ts への追加関数案
--    export async function fetchHankanhi(companyId: string, ki: number): Promise<Hankanhi | null>
--
-- C. 入力 UI（将来）
--    NumberUpdateForm を拡張し、HANKANHI 8 項目の個別入力にも対応
--    PDF 解析（pdfjs-dist）でも抽出可能なら /api/forest/parse-pdf の出力に追加
--
-- D. 進行期（fiscal_period が未作成）の扱い
--    ki のみで UNIQUE 制約、fiscal_period_id は null 許容
--    進行期が確定したら後から ALTER で fiscal_period_id を埋める
--
-- =====================================================================
-- 判断保留
-- =====================================================================
-- 判1: `source` に 'pdf' / 'csv' を許容しているが、Forest の parse-pdf API が HANKANHI も
--      抽出できるかは実装時に確認。現状は手動入力前提で運用開始可
-- 判2: 削除フラグ(is_deleted)を追加するか → 現状は DELETE で物理削除許容
-- 判3: 金額の単位 bigint（円）固定。税抜/税込の区別が必要なら future work
-- 判4: 旧期データの修正履歴保持は forest_audit_log に委譲（Node 側で writeAuditLog）
--
-- — end of forest_hankanhi migration v1 —
