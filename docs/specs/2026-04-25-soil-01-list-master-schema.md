# Soil #01: リスト本体（顧客マスタ）スキーマ設計

- 対象: Garden-Soil の中核テーブル `soil_lists`（253 万件級の営業リスト本体）
- 優先度: **🔴 最高**（Soil 全体の出発点、Tree / Leaf / Bloom が参照）
- 見積: **0.5d**
- 担当セッション: a-soil（実装）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #01）
- 前提:
  - 親 CLAUDE.md（モジュール構成）
  - `docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md`
  - `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md`
  - 既存 `soil_kanden_cases`（Leaf 関電で稼働中、命名規則の先例）

---

## 1. 目的とスコープ

### 1.1 目的

Garden-Soil の中核となる**営業リスト本体テーブル `soil_lists`** を定義する。Tree（架電）・Leaf（案件化後の各商材）・Bloom（KPI 集計）から参照される、**253 万件級の顧客マスタ**。

### 1.2 含めるもの

- `soil_lists` のフィールド定義（業種・商流別のマスタ部分）
- リスト元（importer / 元 CSV / 元 Kintone アプリ）の追跡
- リスト状態（active / 案件化済 / 離脱 / 重複統合）
- リスト本体の基本インデックス（詳細は #05）
- 命名規則（既存 `soil_kanden_cases` との整合）

### 1.3 含めないもの

- コール履歴 → #02
- 関電固有のリスト構造（既に Leaf 側に `leaf_kanden_cases`）→ #03 で Soil との関係整理
- インポート手順 → #04
- インデックス詳細 / パフォーマンス → #05
- RLS → #06
- 削除運用 → #07

---

## 2. 設計方針

### 2.1 「全商材横断のリスト」を Soil に置く理由

- Tree が架電する**営業リスト**は **商材を問わず横断**（光・電気・クレカ等を同じリストから架電）
- 各 Leaf 商材（`leaf_kanden_cases` / `leaf_hikari_cases` 等）は**案件化された顧客のみ**を保持
- Soil = 顧客マスタ（253 万件） / Leaf = 案件マスタ（数千〜数万件）の**役割分離**を堅持

### 2.2 マスタとしての永続性

- リストは**削除しない**（離脱・契約終了でも `status` 変更で残す）
- 重複は**統合**（旧 ID は `merged_into_id` で前方参照、検索時は最新を取得）
- 物理削除は法令保持期間経過後のみ（→ Cross Ops #05 準拠）

### 2.3 Kintone 列との対応原則

- Kintone の素朴な「漢字 / カナ / 住所 1 / 住所 2 / 電話 1 / 電話 2 / 重複」のような
  カラム命名は**英語スネークケース**に正規化
- 商材固有列は Leaf 側（`leaf_*_cases`）に隔離、Soil には載せない

---

## 3. テーブル定義

### 3.1 メインテーブル `soil_lists`

```sql
CREATE TABLE public.soil_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 識別系
  list_no text UNIQUE,                    -- 人間可読の管理番号（旧 Kintone 管理番号 1）
  source_system text NOT NULL,            -- 'kintone-app-55' | 'filemaker-list2024' | 'csv-import-20260415' 等
  source_record_id text,                  -- 元システムのレコード ID（追跡用）

  -- 顧客（個人 or 法人）
  customer_type text NOT NULL,            -- 'individual' | 'corporate'
  name_kanji text,                        -- 姓名（個人）or 法人名（漢字）
  name_kana text,                         -- 同（カナ）
  representative_name_kanji text,         -- 法人代表者（個人 NULL）
  representative_name_kana text,

  -- 連絡先（複数番号は JSONB で持つ、検索用に primary を別カラム）
  phone_primary text,                     -- 検索 / RLS の主軸
  phone_alternates jsonb,                 -- [{ "number": "...", "type": "fax" | "mobile" | ... }, ...]
  email_primary text,
  email_alternates jsonb,

  -- 住所（請求 / 使用場所 を別途 JSONB で）
  postal_code text,
  prefecture text,
  city text,
  address_line text,                      -- 番地・建物名
  addresses_jsonb jsonb,                  -- { "billing": {...}, "usage": {...}, "delivery": {...} }

  -- 商材適性（どの商材ターゲットにヒットするか）
  industry_type text,                     -- 工場照明 / 飲食 / 商店 / 寮 / 学校 / 事務所 / 医院 等
  business_size text,                     -- 'micro' | 'small' | 'medium' | 'large'

  -- リスト状態
  status text NOT NULL DEFAULT 'active',  -- 'active' | 'casecreated' | 'churned' | 'donotcall' | 'merged'
  status_changed_at timestamptz,
  status_changed_by uuid,
  donotcall_reason text,                  -- 'request' | 'duplicate' | 'cooling' 等

  -- 重複統合
  merged_into_id uuid REFERENCES public.soil_lists(id), -- 統合先（自分が「古い」側のとき）

  -- 案件化トラッキング（最初に案件化された Leaf レコードへ）
  primary_case_module text,               -- 'leaf_kanden' | 'leaf_hikari' | ...
  primary_case_id uuid,                   -- 該当 Leaf テーブルの id
  case_count int NOT NULL DEFAULT 0,      -- 関連案件数（複数商材で案件化）

  -- メタ
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,

  -- 削除（横断統一規格、#07）
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_reason text
);
```

### 3.2 補助テーブル `soil_list_imports`（インポートバッチの追跡）

```sql
CREATE TABLE public.soil_list_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,             -- 'kintone-app-55' 等
  source_label text,                       -- 「2026-04 関電 春季リスト」等の人間可読名
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid,
  total_records int NOT NULL,
  inserted_count int NOT NULL,
  updated_count int NOT NULL,
  skipped_duplicate_count int NOT NULL,
  failed_count int NOT NULL,
  error_summary jsonb,                     -- 失敗レコードの抜粋（最大 100 件）
  notes text
);
```

詳細は #04（インポート戦略）参照。

### 3.3 補助テーブル `soil_list_tags`（タグ付け）

```sql
CREATE TABLE public.soil_list_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.soil_lists(id) ON DELETE CASCADE,
  tag text NOT NULL,                       -- 'priority-high' | 'kanden-target' | 'do-not-trust' 等
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid,
  UNIQUE (list_id, tag)
);

CREATE INDEX idx_soil_list_tags_tag ON public.soil_list_tags (tag);
```

タグは Tree 側のセグメント化（「今日はこのタグから架電」等）で利用。

---

## 4. カラム設計の詳細

### 4.1 `customer_type` 区分

| 値 | 意味 | 必須カラム |
|---|---|---|
| `individual` | 個人 | `name_kanji` |
| `corporate` | 法人 | `name_kanji`（法人名）+ 任意 `representative_name_*` |

非対称さを許容、UI 側で出し分け。

### 4.2 `status` の遷移

```
active ─────→ casecreated ──→ churned
   │                              │
   ├─→ donotcall                  │
   │                              │
   └─→ merged ←───────────────────┘
```

| ステータス | 意味 | 主に書き込む側 |
|---|---|---|
| `active` | 通常リスト、架電可 | Soil（既定）|
| `casecreated` | 1 件以上の Leaf 案件あり | Leaf（案件作成時） |
| `churned` | 全 Leaf 案件が離脱・終了 | Leaf（最後の終了時） |
| `donotcall` | 架電拒否 / クーリング | Tree or Soil（手動）|
| `merged` | 重複統合済（旧側）| Soil 管理操作 |

### 4.3 `phone_primary` と `phone_alternates`

- 重複検出のキーとして `phone_primary` を主軸
- ハイフン除去 + 国際表記正規化（`+81-` 等）して保存（インポート時に正規化）
- 補助番号は JSONB で持つが、**検索インデックスは primary のみ**（253 万件で alternates まで GIN は重い）

### 4.4 `addresses_jsonb` の構造

```json
{
  "billing": {
    "postal_code": "5300047",
    "prefecture": "大阪府",
    "city": "大阪市北区",
    "address_line": "西天満4-3-25"
  },
  "usage": { /* 同形式 */ },
  "delivery": { /* 同形式、無い場合は省略 */ }
}
```

トップレベルの `postal_code` / `prefecture` / `city` / `address_line` は**請求住所のミラー**（検索高速化目的）。
インポート時 / 更新時に **DB トリガで同期**。

### 4.5 `industry_type` の標準化

Kintone の自由記入文字列を**enum 風に正規化**:

```
工場照明 / 理容・洗濯 / 街路灯その他 / 事務所・医院 / 飲食・娯楽 / 商店 / 寮 / 学校・官公庁 / その他
```

正規化辞書は `soil_lists_industry_dict` テーブル（マスタ）で管理、インポート時に lookup。

---

## 5. リレーション

### 5.1 Soil 内部

```
soil_lists (1) ─── (n) soil_list_tags
soil_lists (1) ─── (n) soil_call_history
soil_lists (1) ─── (n) soil_list_imports（imports は logical な親子、外部キーなし）
soil_lists (1, merged_into_id) ─── (1) soil_lists（自己参照）
```

### 5.2 他モジュールとの参照

```
soil_lists (1) ─── (0..n) leaf_kanden_cases.soil_list_id
soil_lists (1) ─── (0..n) leaf_hikari_cases.soil_list_id
soil_lists (1) ─── (0..n) leaf_*.soil_list_id
soil_lists (1) ─── (0..n) tree_call_records.soil_list_id（Tree 内部の架電履歴）
```

Leaf 各商材の `soil_list_id` は**任意**（飛び込み案件で list 不在ケース対応）。

---

## 6. 検索パターンと最適化

### 6.1 主要クエリ（253 万件で 1 秒以内目標）

| クエリ | パターン | 想定インデックス（詳細 #05） |
|---|---|---|
| Q1: 電話番号で重複検索 | `WHERE phone_primary = ?` | B-tree on `phone_primary` |
| Q2: 業種 × 地域でセグメント | `WHERE industry_type = ? AND prefecture = ? AND status = 'active'` | 複合 + 部分 |
| Q3: 案件化済を除く active | `WHERE status = 'active' AND NOT EXISTS (SELECT 1 FROM leaf_*_cases WHERE soil_list_id = ...)` | EXISTS Anti-Join |
| Q4: 全文検索（名前・住所）| `WHERE name_kana ILIKE '%xxx%'` | pg_trgm GIN |
| Q5: 架電可能な direct list | `WHERE status = 'active' AND id NOT IN (donotcall...)` | partial index |

### 6.2 重複検出ルール

| 種別 | 条件 | 扱い |
|---|---|---|
| 電話番号一致 | `phone_primary` 完全一致 | 既存にマージ提案（自動マージしない）|
| 名前 + 住所一致 | `name_kana` AND postal_code | 同上 |
| Kintone 元 ID 一致 | `source_record_id` 同じ | UPSERT（既存更新）|

詳細は #04 インポート戦略で。

---

## 7. RLS ポリシー（要点、詳細 #06）

```sql
ALTER TABLE soil_lists ENABLE ROW LEVEL SECURITY;

-- manager 以上は全件参照
CREATE POLICY soil_lists_select_manager
  ON soil_lists FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('manager', 'admin', 'super_admin')
  );

-- staff 以下は「担当案件に紐付くリストのみ」
CREATE POLICY soil_lists_select_assigned
  ON soil_lists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM (
        SELECT soil_list_id FROM leaf_kanden_cases WHERE assigned_to = auth.uid()
        UNION ALL
        SELECT soil_list_id FROM leaf_hikari_cases WHERE assigned_to = auth.uid()
        UNION ALL
        -- 他 Leaf も同様
      ) t WHERE t.soil_list_id = soil_lists.id
    )
  );

-- INSERT / UPDATE は manager 以上
-- DELETE は禁止（→ #07 削除パターン）
```

---

## 8. 移行・初期投入（概要、詳細 #04）

| ソース | 件数概算 | 移行優先 |
|---|---|---|
| Kintone App 55（関電リスト）| 約 30 万件 | 1（Phase B-1 並行）|
| FileMaker LIST2024 | 約 200 万件 | 2（Phase C 前半）|
| CSV 雑多（過去配布）| 約 20 万件 | 3（Phase C 後半）|

合計 **約 250 万件**、最終 253 万件規模見込み。

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `soil_lists` migration（メインテーブル）| a-soil | 0.5h |
| 2 | `soil_list_imports` migration | a-soil | 0.25h |
| 3 | `soil_list_tags` migration | a-soil | 0.25h |
| 4 | `industry_type` 正規化辞書テーブル + 初期データ | a-soil | 0.5h |
| 5 | `addresses_jsonb` 同期トリガ | a-soil | 0.5h |
| 6 | 主要インデックス作成（#05 と連動）| a-soil | 0.5h |
| 7 | RLS ポリシー（#06 詳細）| a-soil | 1h |
| 8 | 単体テスト（INSERT / UPDATE / RLS）| a-soil | 1h |

合計: 約 4.5h ≈ 0.5d

---

## 10. 既知のリスクと対策

### 10.1 253 万件 INSERT の所要時間

- 単純 INSERT で 1〜2 時間（インデックス付きで）
- 対策: 移行時は**インデックスを後付け**（CSV → COPY → CREATE INDEX）

### 10.2 重複データの扱い

- Kintone / FileMaker / CSV で同じ顧客が別 ID で存在
- 対策: インポート前に**正規化済 phone_primary** で先に集約 → マージ提案 UI（#04）

### 10.3 法人 / 個人の判定が曖昧

- Kintone では「個人事業主」が個人扱いだったり法人扱いだったり
- 対策: `customer_type` はインポート時に**判定ヒューリスティック**（株式会社 / 有限会社 / 等の含み判定）+ 後で人手修正可能

### 10.4 全文検索の負荷

- 名前 + 住所 + メモで自由検索したい要望
- 対策: pg_trgm GIN は重いので、**Phase C 後期**に追加（最初は B-tree のみ）

### 10.5 案件化リストと未案件化リストの混在

- 同じ `soil_lists` に両方 → クエリで毎回フィルタ必要
- 対策: `status` で active のみフィルタ、Bloom 集計時は明示的に分岐

### 10.6 `merged_into_id` の循環参照

- 統合先がさらに統合 → 循環
- 対策: マージ時に**遷移先を最終解決**してから書き込み（DB トリガ）

---

## 11. 関連ドキュメント

- `docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md`
- `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md`
- `docs/specs/2026-04-25-soil-02-call-history-schema.md`
- `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`
- `docs/specs/2026-04-25-soil-04-import-strategy.md`
- `docs/specs/2026-04-25-soil-06-rls-design.md`
- `docs/specs/2026-04-25-soil-07-delete-pattern.md`
- `docs/specs/cross-cutting/spec-cross-rls-audit.md`
- 親 CLAUDE.md / Soil CLAUDE.md

---

## 12. 受入基準（Definition of Done）

- [ ] `soil_lists` migration が dev で適用済
- [ ] `soil_list_imports` / `soil_list_tags` 同上
- [ ] `industry_type` 辞書テーブル投入済
- [ ] `addresses_jsonb` 同期トリガが UPDATE / INSERT で動作
- [ ] 主要インデックスが #05 通りに作成済
- [ ] RLS（manager / staff）が #06 通りに動作（テスト pass）
- [ ] サンプルデータ 1,000 件投入 → Q1〜Q5 が 100ms 以内で返る
- [ ] 単体テスト（INSERT / UPDATE / RLS / merged 自己参照）pass
- [ ] Tree / Leaf / Bloom 側からの参照クエリが書ける（#08 API 契約）
- [ ] Soil CLAUDE.md にスキーマ概要を追記
