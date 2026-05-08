# Garden-Leaf 光回線業務委託 (002_hikari): 最小 skeleton 設計書

- 優先度: 🟡 中（Garden 全体 §18 Phase B、A-1c v3.2 完成後の本格実装）
- スコープ: **最小 skeleton（テーブル + 案件一覧 VIEW + RLS の枠組み + spec のみ）**
- 見積: **1.5d**（テーブル設計 0.4d + VIEW 設計 0.3d + RLS 0.3d + spec 0.4d + 整合確認 0.1d）
- 作成: 2026-05-08 起草（a-leaf-002、a-main-014 main- No. 105 / No. 133 dispatch）
- 関連 spec:
  - A-1c v3.2 添付ファイル機能（PR #130、business_id = 'kanden' の先行実装）
  - 将来拡張 設計指針（PR #131、business_id パターンの Leaf 全体展開指針）
  - TimeTree 移行（PR #133、Phase B-2、関電のみ先行）
  - OCR 自動化（PR #134、Phase C、Google Vision API）
- 前提:
  - A-1c v3.2 共通基盤（attachments / RLS / 8 ロール / business_id）が確立済（PR #138〜#145）
  - 親 CLAUDE.md §11〜§23

---

## 1. Executive Summary

### 1.1 目的

Garden-Leaf 002_光回線業務委託 の **最小 skeleton** を起草。Kintone で運用中の光回線案件管理を Garden に移管するための **テーブル + VIEW + RLS の枠組み** を先行設計し、A-1c v3.2 完成後に本格実装着手するための前提資料を整える。

### 1.2 スコープ（最小 skeleton）

| 項目 | 含む / 含まない |
|---|---|
| ✅ 含む | `leaf_hikari_cases` テーブル設計（基本フィールド + status enum + 拡張余地） |
| ✅ 含む | 添付テーブル設計（business_id = 'hikari' の踏襲） |
| ✅ 含む | 案件一覧横断 VIEW `v_leaf_cases` の hikari 行追加方針 |
| ✅ 含む | 8 ロール × `leaf_user_in_business('hikari')` RLS の枠組み |
| ✅ 含む | spec / migration SQL skeleton（実行可能、最小構成） |
| ❌ 含まない | 詳細な業務フロー定義（Phase B-1 で確定） |
| ❌ 含まない | UI 実装（Phase B-1 以降） |
| ❌ 含まない | API / クエリ実装 |
| ❌ 含まない | テスト実装 |
| ❌ 含まない | OCR / 移行設計（光回線の OCR / 移行は別 spec） |

### 1.3 スコープ外（次フェーズ以降）

- Phase B-1: 業務フロー詳細確定（解約防止期間 / プラン / 開通日制御）
- Phase B-2: 案件登録 UI / 一覧 UI / 詳細 UI
- Phase C-1: 添付画像機能（A-1c v3.2 のロジック層を `business_id = 'hikari'` で再利用）
- Phase C-2: TimeTree 移行（hikari 用、A-1c B-2 の半自動方式踏襲）
- Phase D-1: OCR 自動化（hikari 用、A-1c C の Google Vision API 踏襲）
- 他商材横展開（クレカ等は別 spec）

### 1.4 主な設計判断

| # | 論点 | 採択 | 理由 |
|---|---|---|---|
| 1 | 命名規則 | `leaf_hikari_*` prefix（A-1c の `leaf_kanden_*` と並列） | 関電と同じ「事業 prefix + 機能名」パターン、将来横断化時も識別容易 |
| 2 | business_id 値 | `'hikari'`（leaf_businesses 行追加） | 将来拡張 spec §2.2 の例示と整合 |
| 3 | RLS パターン | A-1c の `leaf_user_in_business(biz_id)` 関数を再利用 | 関数を変更せず、`leaf_user_businesses` に行追加で対応可能 |
| 4 | 添付テーブル | `leaf_hikari_attachments`（A-1c の `leaf_kanden_attachments` と並列）| 業務上必要な画像（契約書 / 工事写真 / 設置確認書）を独立管理 |
| 5 | 案件一覧 VIEW | `v_leaf_cases` に UNION ALL で行追加 | 将来拡張 spec の cross-business unified view 指針に従う |
| 6 | スコープ範囲 | 最小 skeleton のみ（実装は Phase B 以降）| dispatch 指示「最小 skeleton ~1.5d」遵守、A-1c 完成前の parallel 進行 |

---

## 2. テーブル設計

### 2.1 leaf_hikari_cases（光回線 案件本体）

```sql
CREATE TABLE IF NOT EXISTS leaf_hikari_cases (
  -- 基本識別子
  case_id            text PRIMARY KEY,                     -- 'H-YYYYMMDD-NNN'（K-* との衝突回避）
  business_id        text NOT NULL DEFAULT 'hikari'
                     REFERENCES leaf_businesses(business_id),
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'contracted', 'construction_scheduled',
                                       'construction_completed', 'opened', 'cancelled', 'lost')),

  -- 顧客情報（最小、Phase B-1 で詳細化）
  customer_name      text NOT NULL,
  customer_kana      text,
  customer_phone     text,
  customer_address   text,

  -- 契約情報（最小）
  plan_name          text,                                  -- 例: 'フレッツ光ファミリー' / 'ホームタイプ' 等
  monthly_fee        numeric(10,2),
  contract_term      smallint,                              -- 契約期間 (月単位、24 等)
  cancellation_fee   numeric(10,2),                         -- 解約金（プラン依存）

  -- 工事 / 開通
  construction_date  date,                                  -- 工事日（予定 / 実績）
  opening_date       date,                                  -- 開通日

  -- 業務委託情報（営業）
  sales_user_id      uuid REFERENCES auth.users(id),
  sales_company_id   uuid REFERENCES root_companies(company_id),
  apo_code           text,                                  -- アポコード（営業案件 ID）

  -- 共通メタ
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz DEFAULT NULL,
  deleted_by         uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE leaf_hikari_cases IS
  '光回線業務委託 案件本体。business_id = hikari 固定。Phase B-1 で詳細フィールド追加';

CREATE INDEX idx_leaf_hikari_status ON leaf_hikari_cases (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leaf_hikari_sales_user ON leaf_hikari_cases (sales_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leaf_hikari_construction_date ON leaf_hikari_cases (construction_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_leaf_hikari_deleted ON leaf_hikari_cases (deleted_at) WHERE deleted_at IS NOT NULL;
```

#### 拡張余地（Phase B-1 で確定）

- 物件種別（戸建て / 集合住宅 / 法人）
- 建物オーナー連絡先（集合住宅時）
- NTT / KDDI 等のキャリア識別子
- 既存回線情報（乗換時）
- キャンペーン適用情報
- お客様番号（光コラボ別）

### 2.2 leaf_hikari_attachments（光回線 添付ファイル）

A-1c v3.2 の `leaf_kanden_attachments` と並列構造で設計。フィールド構成は同等、business_id 値が `'hikari'` である点のみ異なる。

```sql
CREATE TABLE IF NOT EXISTS leaf_hikari_attachments (
  attachment_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            text NOT NULL REFERENCES leaf_hikari_cases(case_id) ON DELETE CASCADE,
  business_id        text NOT NULL DEFAULT 'hikari'
                     REFERENCES leaf_businesses(business_id),
  category           text NOT NULL
                     CHECK (category IN ('contract', 'construction_photo',
                                          'installation_confirm', 'misc')),
  storage_url        text NOT NULL,
  thumbnail_url      text,
  mime_type          text,
  file_size          bigint,
  is_guide_capture   boolean NOT NULL DEFAULT FALSE,
  is_post_added      boolean NOT NULL DEFAULT FALSE,
  ocr_processed      boolean NOT NULL DEFAULT FALSE,         -- 将来 OCR 用予約列
  archived_tier      text DEFAULT 'recent'
                     CHECK (archived_tier IN ('recent', 'monthly', 'yearly')),
  archived_at        timestamptz DEFAULT NULL,
  uploaded_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz DEFAULT NULL,
  deleted_by         uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE leaf_hikari_attachments IS
  '光回線業務委託 添付ファイル。A-1c v3.2 の kanden 構造と並列、business_id = hikari';

CREATE INDEX idx_leaf_hikari_attachments_case ON leaf_hikari_attachments (case_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leaf_hikari_attachments_category ON leaf_hikari_attachments (category) WHERE deleted_at IS NULL;
```

### 2.3 category 値の差異

| 関電 (`leaf_kanden_attachments.category`) | 光回線 (`leaf_hikari_attachments.category`) |
|---|---|
| denki / douryoku / gas / shogen | contract / construction_photo / installation_confirm |
| juryo（受領書） | misc（その他） |

→ 業務上の添付画像種別が異なるため別 enum。RLS / 操作ロジックは A-1c 共通基盤を再利用可能。

---

## 3. 案件一覧 VIEW（cross-business unified view）

将来拡張 spec §2.3 の指針に従い、Leaf 配下の全事業の案件を横断 SELECT する VIEW を提供。

```sql
CREATE OR REPLACE VIEW v_leaf_cases AS
SELECT
  case_id,
  'kanden' AS business_id,
  status,
  customer_name,
  customer_phone,
  sales_user_id,
  sales_company_id,
  apo_code,
  created_at,
  updated_at,
  deleted_at
FROM soil_kanden_cases  -- Soil 配下の関電案件本体（A-1c の前提）
WHERE deleted_at IS NULL

UNION ALL

SELECT
  case_id,
  'hikari' AS business_id,
  status,
  customer_name,
  customer_phone,
  sales_user_id,
  sales_company_id,
  apo_code,
  created_at,
  updated_at,
  deleted_at
FROM leaf_hikari_cases
WHERE deleted_at IS NULL;

COMMENT ON VIEW v_leaf_cases IS
  'Leaf 配下の全事業の案件を横断 SELECT する unified view。新事業追加時は UNION ALL で行追加';
```

### 3.1 拡張ルール

- 新事業（クレカ / その他）追加時 → `UNION ALL` で SELECT 文を追加
- VIEW 内のフィールドは「業務横断的に必要な最小列」のみ
- 詳細フィールドは各事業テーブル（`leaf_kanden_*` / `leaf_hikari_*` / 等）で個別管理
- VIEW は SELECT のみ、INSERT / UPDATE / DELETE は各テーブルへ直接

---

## 4. RLS 方針（A-1c 共通基盤継承）

### 4.1 leaf_businesses 行追加

```sql
INSERT INTO leaf_businesses (business_id, display_name, created_at, updated_at)
VALUES ('hikari', '光回線業務委託', now(), now())
ON CONFLICT (business_id) DO NOTHING;
```

### 4.2 leaf_user_in_business('hikari') の使用

A-1c v3.2 で定義済の関数をそのまま再利用:

```sql
-- A-1c で定義済（PR #138）
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
```

光回線では `biz_id = 'hikari'` で判定。`leaf_user_businesses` テーブルにユーザー別の所属行を追加するだけで動作。

### 4.3 leaf_hikari_cases RLS

```sql
ALTER TABLE leaf_hikari_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY leaf_hikari_cases_select ON leaf_hikari_cases
  FOR SELECT USING (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

CREATE POLICY leaf_hikari_cases_insert ON leaf_hikari_cases
  FOR INSERT WITH CHECK (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

CREATE POLICY leaf_hikari_cases_update ON leaf_hikari_cases
  FOR UPDATE USING (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  ) WITH CHECK (
    public.leaf_user_in_business('hikari')
    OR public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

-- 物理削除は admin+ のみ（A-1c v3.2 と同じ）
CREATE POLICY leaf_hikari_cases_delete ON leaf_hikari_cases
  FOR DELETE USING (
    public.garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );
```

### 4.4 leaf_hikari_attachments RLS

A-1c v3.2 の `leaf_kanden_attachments` と同等の 4 ポリシー（SELECT / INSERT / UPDATE / DELETE）を `leaf_user_in_business('hikari')` で適用。詳細は migration SQL skeleton 参照。

### 4.5 ロール × 操作マトリクス（A-1c v3.2 と同等）

8 段階 `garden_role` enum を継承:

| 操作 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 案件閲覧 | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| 案件登録 | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| 案件編集 | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| 論理削除 | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| 物理削除 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

※ = `leaf_user_in_business('hikari')` が TRUE の場合のみ。

---

## 5. Migration SQL（最小 skeleton、実行可能版）

詳細は別ファイル: `scripts/leaf-schema-patch-hikari-skeleton.sql`

実行順序:
1. A-1c v3.2 共通基盤（`scripts/leaf-schema-patch-a1c.sql`）が先行実行済みであること
2. `leaf_businesses` に `'hikari'` 行を INSERT
3. `leaf_hikari_cases` テーブル作成 + RLS + index
4. `leaf_hikari_attachments` テーブル作成 + RLS + index
5. `v_leaf_cases` VIEW 作成（既存ある場合は CREATE OR REPLACE）

---

## 6. Phase 配置（Garden 全体）

| Phase | 内容 | タイミング |
|---|---|---|
| Phase B-1（hikari）| 業務フロー詳細 + UI 設計 spec | A-1c v3.2 完成後 |
| Phase B-2（hikari）| 案件登録 / 一覧 / 詳細 UI 実装 | Phase B-1 後 |
| Phase C-1（hikari）| 添付画像機能（A-1c のロジック層を再利用）| Phase B-2 後 |
| Phase C-2（hikari）| TimeTree 移行 | A-1c B-2 完成 + Phase C-1 後（必要時）|
| Phase D-1（hikari）| OCR 自動化 | A-1c C 完成後（必要時）|

光回線は関電業務委託より複雑度低（機微データなし、業務フロー単純）のため、A-1c の知見を活かして並列実装可能。

---

## 7. 関連 spec との整合

| spec | 関係 |
|---|---|
| A-1c v3.2 添付ファイル機能（PR #130）| 本 spec の先行実装例。本 spec は A-1c の構造を `business_id = 'hikari'` で踏襲 |
| 将来拡張 設計指針（PR #131）| 本 spec の上位指針。`business_id` 列 + `leaf_user_in_business` パターンを採用 |
| TimeTree 移行（PR #133、Phase B-2）| 本 spec とは独立。光回線 TimeTree 移行は別 spec で起草（必要時）|
| OCR 自動化（PR #134、Phase C）| 本 spec とは独立。光回線 OCR は別 spec で起草（必要時）|
| Phase A 着手前 準備ガイド（PR #132）| 関電 Phase A 用、本 spec は Phase B-1 で起草する hikari 専用ガイドの前提 |

---

## 8. 残課題 / 次フェーズ検討事項

- **業務フロー詳細**: 解約防止期間（24 ヶ月想定）、プラン分類、開通日制御等は Phase B-1 で確定
- **キャリア識別**: NTT / KDDI / OPTAGE 等の対応有無、Phase B-1 で確定
- **既存 Kintone データの移管方法**: 直接 import / 段階移行、Phase B-1 で確定
- **canclellation 防止 / 解約金計算**: 業務ロジックとして spec 化が必要
- **物件種別（戸建て / 集合住宅 / 法人）**: フィールド追加または別テーブルか、Phase B-1 で判断
- **添付画像のカテゴリ細分化**: contract / construction_photo / installation_confirm / misc で十分か、Phase B-1 で確認

---

## 9. 着手判断ポイント

光回線 Phase B-1 着手の前提条件:

1. ✅ A-1c v3.2 共通基盤（PR #138）develop merge 済
2. ✅ A-1c Phase A Backoffice UI 完成（東海林さんの 1 商材完成体験）
3. 🟡 業務フロー詳細の東海林さんヒアリング完了
4. 🟡 既存 Kintone データの移行方針確定
5. 🟡 解約金計算ロジックの仕様確定

→ 1, 2 は技術的前提、3-5 は東海林さんとの対話で確定。

---

## 10. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-08 | v1.0 | 初版起草、a-main-014 main- No. 105 / No. 133 dispatch 対応、A-1c v3.2 + 将来拡張 spec を base に光回線 最小 skeleton として起草（テーブル + VIEW + RLS、業務フロー詳細は Phase B-1 で確定）| a-leaf-002 |

— end of spec —
