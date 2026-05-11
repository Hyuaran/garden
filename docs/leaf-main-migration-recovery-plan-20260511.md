# Leaf 本体 migration 不在 - 致命発見 + 修復計画

> 起草: a-leaf-002
> 起草日時: 2026-05-11(月) 17:50
> 元 dispatch: a-main-023 main- No. 296
> 関連 audit: audit-001- No. 15 致命 # 4

---

## 1. 致命発見サマリ（dispatch B / C 結果）

### 1.1 supabase/migrations/ 内の Leaf 関連 migration

**Leaf 関連 migration: 0 件**（全 5 ファイル中、すべて root_* / forest_*）

| # | ファイル名 | モジュール |
|---|---|---|
| 1 | 20260425000001_root_kot_sync_log.sql | Root |
| 2 | 20260425000002_root_employees_outsource_extension.sql | Root |
| 3 | 20260425000003_root_attendance_daily.sql | Root |
| 4 | 20260425000004_root_employees_payroll_extension.sql | Root |
| 5 | 20260425000005_forest_fiscal_periods_shinkouki_updated_at.sql | Forest |

→ **dispatch §A で言及された `20260507000004_leaf_kanden_soil_link.sql` も存在しない**

### 1.2 scripts/ 内の Leaf 関連 SQL

| ファイル | 状態 | 内容 |
|---|---|---|
| scripts/leaf-schema-patch-a1c.sql | ❌ **不在**（PR #138 feature branch 内のみ）| A-1c attachments ALTER + 4 関数 + 3 新規テーブル（leaf_businesses 等）|
| scripts/leaf-schema-patch-hikari-skeleton.sql | ✅ 存在（私が起票、PR #147）| 光回線 skeleton CREATE |
| **scripts/leaf-schema.sql（本体）** | ❌ **不在**（致命）| 関電案件本体テーブルの CREATE 文がどこにもない |

### 1.3 PR #138 (D.1 migration) の中身検証

`git show origin/feature/leaf-a1c-task-d1-pr:scripts/leaf-schema-patch-a1c.sql` 結果:

```
ALTER TABLE leaf_kanden_attachments         ← 既存前提（CREATE なし）
CREATE TABLE IF NOT EXISTS leaf_businesses
CREATE TABLE IF NOT EXISTS leaf_user_businesses
CREATE TABLE IF NOT EXISTS root_settings
ALTER TABLE leaf_kanden_attachments ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS leaf_kanden_attachments_history
ALTER TABLE leaf_kanden_attachments_history ENABLE ROW LEVEL SECURITY;
```

→ `leaf_kanden_attachments` を **既存前提で ALTER**、CREATE 文なし
→ A-1c v3 spec §2.6.1「既存 leaf_kanden_attachments 拡張」と整合（spec 通り）

### 1.4 実機 DB 状態（REST API curl 結果）

```
URL=$NEXT_PUBLIC_SUPABASE_URL
KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
for tbl in [10 tables]; do
  curl -s -o /dev/null -w "%{http_code}" "$URL/rest/v1/$tbl?limit=0" -H "apikey: $KEY"
done
```

| テーブル | HTTP | 判定 | 備考 |
|---|---|---|---|
| leaf_kanden_cases | **404** | ❌ **不在（親不在 - 致命）** | 案件本体マスタ |
| leaf_kanden_cases_audit | 404 | ❌ 不在 | 監査履歴 |
| leaf_kanden_visit | 404 | ❌ 不在 | 訪問記録 |
| leaf_kanden_status_master | 404 | ❌ 不在 | ステータスマスタ |
| leaf_kanden_reason_master | 404 | ❌ 不在 | 理由マスタ |
| **leaf_kanden_attachments** | **200** | ✅ **存在（migration 化なし、Dashboard 手動 CREATE 推定）** | 添付ファイル |
| leaf_kanden_attachments_history | 404 | ❌ 不在 | v3 新規（PR #138 で CREATE） |
| leaf_kanden_soil_link | 404 | ❌ 不在 | Soil 連携テーブル |
| leaf_businesses | 404 | ❌ 不在 | v3 新規（PR #138 で CREATE） |
| leaf_user_businesses | 404 | ❌ 不在 | v3 新規（PR #138 で CREATE） |

### 1.5 致命の本質

**「親不在」というより「Leaf 本体スキーマが migration 化されていない」状況**

| 観点 | 状態 |
|---|---|
| 親テーブル leaf_kanden_cases | ❌ DB 不在 + ❌ CREATE 文 source 不在 |
| 子テーブル leaf_kanden_attachments | ✅ DB 存在（手動 CREATE） + ❌ CREATE 文 source 不在 |
| A-1c v3 共通基盤 4 テーブル | ❌ DB 不在 + ✅ migration source 存在（PR #138、ALTER 含む）|
| Leaf-Soil 連携 | ❌ DB 不在 + ❌ migration source 不在（dispatch で言及されたが repo にない） |

---

## 2. 影響範囲評価

### 2.1 Phase D 完成への影響（dispatch §G）

| 観点 | 現状 | 本体 apply 後 |
|---|---|---|
| Unit test | mock/fixture で動く可能性あり | 62 / 62（期待） |
| Integration test | ❌ leaf_kanden_cases 参照で 404 | N / N（期待） |
| D.14 カバレッジ目標 | 未測定 | 80%+ 期待 |
| **Phase D 完成宣言可否** | ❌ **不可** | ✅ 本体 apply 後可 |

→ A-1c v3.2 Phase D 13/14 task 実装（PR #138〜#145）は親不在のため **実機検証不能**。代わりに、修復計画 apply 後に Integration / E2E test 走らせる前提でないと完成宣言できない。

### 2.2 他商材（光回線・クレカ等）への影響（dispatch §H）

| 商材 | 状態 | 影響度 |
|---|---|---|
| Leaf 002 光回線（PR #147）| skeleton のみ、実装未着手 | 🟡 軽微（migration 起票済だが本体未 apply）|
| Leaf 他商材（クレカ等）| skeleton のみ | 🟢 低 |

→ skeleton 段階のため修復ブロッカーにはならないが、本体 apply 後でないと光回線 Phase B 着手不可。

---

## 3. 修復計画 3 案（dispatch §D、東海林さん判断仰ぎ）

### 3.1 A 案: 親 CREATE migration を新規起草 + 既存 D.1 を後続適用

**手順**:
1. a-leaf-002 が `scripts/leaf-schema-patch-cases-create.sql` 新規起草
   - 既存 `leaf_kanden_attachments` の現状 schema を Dashboard で `\d leaf_kanden_attachments` で吸い取り、IF NOT EXISTS で記述
   - 親 `leaf_kanden_cases` の CREATE 文を spec / docs から逆引きして起草（業務フィールド 10 〜 20）
   - 関連マスタ `leaf_kanden_status_master` / `leaf_kanden_reason_master` の CREATE 文起草
   - 関連子 `leaf_kanden_cases_audit` / `leaf_kanden_visit` の CREATE 文起草
2. 東海林さん業務ヒアリング → スキーマ確定（業務フィールド / 列名 / 型）
3. Supabase Dashboard で順次 apply（dev → 本番）
4. その後、既存 PR #138 (D.1 ALTER + leaf_businesses 等) を apply
5. 検証 SQL 走らせる

**工数**: 0.5d（業務ヒアリング後の起草）+ 0.2d（apply + 検証）= **0.7d**

**メリット**:
- 親 → 子の正しい順序で apply
- 親 CREATE が migration 化される（コード管理）
- 既存 PR #138 はそのまま使える

**デメリット**:
- 業務ヒアリング必須（東海林さん時間確保）
- 既存 leaf_kanden_attachments の schema を Dashboard 経由で吸い取る必要あり

### 3.2 B 案: PR #138 修正で leaf_kanden_attachments CREATE 文を追加（親は別 spec で起草）

**手順**:
1. PR #138 の `scripts/leaf-schema-patch-a1c.sql` を修正
   - 冒頭に `CREATE TABLE IF NOT EXISTS leaf_kanden_attachments (...)` を追加
   - 既存 schema は Dashboard `\d` 出力から構築
2. 親 `leaf_kanden_cases` 等は **本 PR スコープ外**、別 spec / 別 PR で起草
3. PR #138 を a-bloom レビュー → develop merge
4. 本番 apply（Dashboard or supabase db push）

**工数**: 0.3d（PR #138 修正）+ 別 0.5d（親 spec 起草、Phase B-1 で実施）= **0.8d**

**メリット**:
- A-1c attachment 機能は完全 migration 化される
- 子テーブル apply は PR #138 で完結

**デメリット**:
- 親不在状態が残る（leaf_kanden_cases は別 PR で対応）
- A-1c の整合性は完全には取れない（attachments.case_id FK が orphan）

### 3.3 C 案: 修正後再起草（A 案 + B 案統合、Phase D 完全リセット）

**手順**:
1. Phase D 全体を「親 → 子」順序で再 spec
   - 親 CREATE → 共通基盤（businesses / user_businesses / history） → 添付（attachments + ALTER）
2. 既存 PR #138〜#145 すべてを close + 新規 PR で置換
3. 業務ヒアリング + 全 spec 起草 + 全 migration 起草 + 全実装移植

**工数**: 2.5d（spec 再起草 1.5d + 実装移植 1.0d）= **2.5d**

**メリット**:
- 完全に整合性のある実装
- migration 履歴がクリーン
- audit 再 audit で # 4 完全解消

**デメリット**:
- Phase D 92.9% 完成の **大幅後退**
- 既存 PR 8 件の作業が無駄になる
- 5/13-15 デモへの影響大

### 3.4 私の推奨: **A 案**

理由:
- Phase D 92.9% 完成を活かしつつ、親不在を解消
- 業務ヒアリング 1 回で確定 → 0.7d で修復完了
- PR #138〜#145 は再利用可能
- B 案は親不在が残るため audit # 4 完全解消にならない
- C 案は再起草コスト > 修復価値

---

## 4. apply 順序 SQL（A 案推奨、草案）

### Step 1: 親 CREATE migration（新規起草、業務ヒアリング後）

ファイル: `scripts/leaf-schema-patch-kanden-cases-create.sql`（仮称、新規）

```sql
-- Garden-Leaf 関電業務委託 本体テーブル CREATE migration
-- Run this in Supabase Dashboard > SQL Editor
-- 作成: 2026-05-12 想定（業務ヒアリング後）
-- 前提: Root A-3-g（is_user_active / garden_role_of / outsource / contract_end_on）develop merge 済

-- ===== 1. 親: leaf_kanden_cases（案件マスタ）=====
CREATE TABLE IF NOT EXISTS public.leaf_kanden_cases (
  case_id              text PRIMARY KEY,                  -- 'K-YYYYMMDD-NNN'
  business_id          text NOT NULL DEFAULT 'kanden',
  status               text NOT NULL DEFAULT 'pending',
  -- 顧客情報（業務ヒアリング後に確定）
  customer_name        text NOT NULL,
  customer_kana        text,
  customer_phone       text,
  customer_address     text,
  supply_point_id      text,                              -- 供給地点 22 桁
  -- 取引情報
  acquisition_type     text CHECK (acquisition_type IN ('reclaim', 'enclose')),
  pd_current           text,
  pd_previous          text,
  -- 営業
  sales_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sales_company_id     uuid,
  apo_code             text,
  -- フラグ
  urgent_sw            boolean NOT NULL DEFAULT FALSE,
  schema_co_submit     boolean NOT NULL DEFAULT FALSE,
  -- 共通メタ
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  deleted_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ===== 2. 既存 leaf_kanden_attachments の Migration 化（IF NOT EXISTS）=====
-- 既存 schema を Dashboard \d leaf_kanden_attachments で吸い取って完全な CREATE 文を作成
CREATE TABLE IF NOT EXISTS public.leaf_kanden_attachments (
  attachment_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              text NOT NULL REFERENCES public.leaf_kanden_cases(case_id) ON DELETE CASCADE,
  category             text NOT NULL CHECK (category IN ('denki', 'douryoku', 'gas', 'shogen', 'juryo')),
  storage_url          text NOT NULL,
  thumbnail_url        text,
  mime_type            text,
  file_size            bigint,
  is_guide_capture     boolean NOT NULL DEFAULT FALSE,
  is_post_added        boolean NOT NULL DEFAULT FALSE,
  ocr_processed        boolean NOT NULL DEFAULT FALSE,
  uploaded_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ===== 3. 子: leaf_kanden_cases_audit（変更履歴）=====
CREATE TABLE IF NOT EXISTS public.leaf_kanden_cases_audit (
  id               bigserial PRIMARY KEY,
  case_id          text NOT NULL REFERENCES public.leaf_kanden_cases(case_id) ON DELETE CASCADE,
  operation        text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_field    text,
  old_value        text,
  new_value        text,
  changed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at       timestamptz NOT NULL DEFAULT now()
);

-- ===== 4. 子: leaf_kanden_visit（訪問記録、業務ヒアリング後に詳細）=====
CREATE TABLE IF NOT EXISTS public.leaf_kanden_visit (
  visit_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          text NOT NULL REFERENCES public.leaf_kanden_cases(case_id) ON DELETE CASCADE,
  visit_date       date NOT NULL,
  visit_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result           text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ===== 5. マスタ: leaf_kanden_status_master =====
CREATE TABLE IF NOT EXISTS public.leaf_kanden_status_master (
  status_code      text PRIMARY KEY,
  display_name     text NOT NULL,
  sort_order       smallint,
  is_final         boolean NOT NULL DEFAULT FALSE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ===== 6. マスタ: leaf_kanden_reason_master =====
CREATE TABLE IF NOT EXISTS public.leaf_kanden_reason_master (
  reason_code      text PRIMARY KEY,
  display_name     text NOT NULL,
  category         text,
  sort_order       smallint,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ===== 7. INDEX =====
CREATE INDEX IF NOT EXISTS idx_leaf_kanden_cases_status ON public.leaf_kanden_cases (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaf_kanden_cases_sales_user ON public.leaf_kanden_cases (sales_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leaf_kanden_cases_supply_point ON public.leaf_kanden_cases (supply_point_id);
CREATE INDEX IF NOT EXISTS idx_leaf_kanden_attachments_case ON public.leaf_kanden_attachments (case_id);
CREATE INDEX IF NOT EXISTS idx_leaf_kanden_visit_case ON public.leaf_kanden_visit (case_id);

-- ===== 8. RLS（A-1c v3.2 パターン継承）=====
ALTER TABLE public.leaf_kanden_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaf_kanden_cases_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaf_kanden_visit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaf_kanden_attachments ENABLE ROW LEVEL SECURITY;

-- ※ RLS ポリシーは PR #138 (D.1 migration) で定義される leaf_user_in_business('kanden') 関数依存
-- ※ よって本 migration apply 後に PR #138 apply で完全な RLS が有効化
```

### Step 2: 既存 PR #138 (D.1) を apply

`scripts/leaf-schema-patch-a1c.sql`（PR #138 内）を Dashboard apply:
- leaf_businesses / leaf_user_businesses / leaf_kanden_attachments_history 作成
- leaf_user_in_business 関数 / verify_image_download_password 関数 / set_image_download_password 関数作成
- leaf_kanden_attachments への RLS ポリシー追加
- 8 ロール × 事業スコープ RLS 完成

### Step 3: 検証

dispatch §D-2 の検証 SQL 実行。

### Step 4: a-leaf-002 (or a-leaf-NNN) が Phase D の Integration test 実行

PR #138〜#145 の Integration test が走る → Phase D 完成判定 → D.14 カバレッジ確認 → Phase D merge

---

## 5. 検証 SQL（dispatch §D-2 準拠）

```sql
-- ===== 1. 全テーブル存在確認 =====
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'leaf_kanden_%'
ORDER BY table_name;
-- 期待出力: 6 件（cases / cases_audit / visit / status_master / reason_master / attachments / attachments_history）

-- ===== 2. 主要カラム数確認 =====
SELECT table_name, COUNT(*) AS col_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'leaf_kanden_%'
GROUP BY table_name ORDER BY table_name;
-- 期待出力: 各テーブルの想定列数と一致

-- ===== 3. FK 制約存在確認 =====
SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS ref_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name LIKE 'leaf_kanden_%';
-- 期待出力: cases_audit.case_id, visit.case_id, attachments.case_id → leaf_kanden_cases

-- ===== 4. RLS 有効性確認 =====
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'leaf_kanden_%';
-- 期待出力: 全テーブル rowsecurity = TRUE
```

---

## 6. ロールバック SQL（dispatch §D-3 準拠）

```sql
-- ⚠️ 緊急ロールバック: FK 制約 → テーブル の順で DROP（順序重要）

-- Step 1: PR #138 関連テーブル DROP（依存子テーブル含む）
DROP TABLE IF EXISTS public.leaf_kanden_attachments_history CASCADE;
DROP TABLE IF EXISTS public.leaf_user_businesses CASCADE;
DROP TABLE IF EXISTS public.leaf_businesses CASCADE;
DROP FUNCTION IF EXISTS public.leaf_user_in_business(text) CASCADE;
DROP FUNCTION IF EXISTS public.leaf_kanden_attachments_history_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.verify_image_download_password(text) CASCADE;
DROP FUNCTION IF EXISTS public.set_image_download_password(text) CASCADE;

-- Step 2: 親 + 子テーブル DROP（A 案で起票した new migration）
DROP TABLE IF EXISTS public.leaf_kanden_visit CASCADE;
DROP TABLE IF EXISTS public.leaf_kanden_cases_audit CASCADE;
DROP TABLE IF EXISTS public.leaf_kanden_reason_master CASCADE;
DROP TABLE IF EXISTS public.leaf_kanden_status_master CASCADE;

-- Step 3: 添付テーブル（手動 CREATE 由来、慎重判断）
-- 注意: 既存データがあるため、DROP は東海林さん最終承認後のみ
-- DROP TABLE IF EXISTS public.leaf_kanden_attachments CASCADE;

-- Step 4: 親 leaf_kanden_cases DROP（最終、依存子を全 DROP した後）
DROP TABLE IF EXISTS public.leaf_kanden_cases CASCADE;

-- ※ root_settings は別モジュール由来のため DROP しない
```

---

## 7. 教訓の横展開（dispatch §H 提案）

### 7.1 schema-first / migration-first 規約（新規）

新規ドキュメント `docs/leaf-migration-checklist.md` の起票推奨:

```markdown
# Leaf 商材実装着手前 migration-first チェックリスト

## 1. 本体 CREATE migration を最初に作る
- 商材ごとに `scripts/leaf-schema-patch-<商材>-cases-create.sql` を最初に commit
- spec / plan 起票前でも、本体テーブル CREATE は migration ファイル化必須

## 2. 連携列追加 migration は本体 CREATE 後でないと作らない
- ALTER TABLE / FK 追加は別 migration ファイルとして起票
- ファイル名冒頭コメントに `-- depends on: <親 migration>` を明示

## 3. Supabase Dashboard 手動 CREATE は禁止
- Dashboard で実 schema 変更時は migration 化を同時実施
- 「いつか migration 化する」は禁止、即時 commit

## 4. 既存テーブルの逆方向 migration 化
- 既存 schema があるが migration 不在の場合、`\d <table>` 出力から CREATE IF NOT EXISTS で起票
- 既存データ保護のため CREATE IF NOT EXISTS 必須

## 5. audit 実施前の self-check
- 商材実装着手前に `supabase/migrations/` + `scripts/` 配下を grep して migration カバレッジ確認
```

### 7.2 横展開対象モジュール

- 光回線（PR #147）: 既に migration-first で起票済（scripts/leaf-schema-patch-hikari-skeleton.sql 内に親 CREATE 含む）→ ✅ 教訓適用済
- クレカ skeleton（未着手）: 上記チェックリスト適用必須
- 他商材（30 件）: 全 skeleton 起票前に上記適用

---

## 8. apply タイミング（dispatch §E 準拠）

| 日付 | 内容 | 担当 |
|---|---|---|
| 5/12（火）AM | 業務ヒアリング（東海林さん時間確保）→ Step 1 SQL 確定 | 東海林さん + a-leaf-002 |
| 5/12（火）AM | 既存 leaf_kanden_attachments の Dashboard `\d` 取得 | 東海林さん（Dashboard）|
| 5/12（火）PM | a-leaf-002 が Step 1 SQL 起票 + PR 発行 | a-leaf-002 |
| 5/12（火）PM | 東海林さん最終決裁（A 案 / B 案 / C 案）| 東海林さん |
| 5/13（水）AM | a-main-023 主導で Step 1 apply（garden-dev） | a-main-023 |
| 5/13（水）AM | a-leaf-002 が検証 SQL 実行 + Phase D Integration test 実施 | a-leaf-002 |
| 5/13（水）PM | 本番 apply（garden-prod） | 東海林さん（Dashboard） |
| 5/13（水）PM | a-audit-001 再 audit（致命 # 4 解消確認） | a-audit-001 |

---

## 9. 東海林さんへの判断仰ぎ事項

A 案 GO で進める場合、以下を東海林さんに確認:

| # | 確認項目 | 選択肢 |
|---|---|---|
| 1 | 業務フィールド確定 | leaf_kanden_cases の業務必要列を確定（§4 Step 1 の案件本体テーブル）|
| 2 | 既存 attachments の schema 取得方法 | A. Dashboard `\d` 手動 / B. pg_dump / C. supabase db pull |
| 3 | apply 環境 | A. garden-dev 先行 → 本番 / B. 本番直接 |
| 4 | Phase D 92.9% 完成の検証 | Step 1 apply 後の Integration test 実施 |
| 5 | Soil 連携 (leaf_kanden_soil_link) | 別 migration で後付け / 親 CREATE 同梱 |

---

## 10. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-11 | v1.0 | 初版起草、audit-001- No. 15 致命 # 4 対応、a-main-023 main- No. 296 dispatch、B/C/D 完了、A 案推奨 | a-leaf-002 |

— end of recovery plan —
