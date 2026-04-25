# Garden-Leaf 関電業務委託 A-1c: 添付ファイル機能 設計書

- 優先度: 🔴 高（Phase A 必須、Leaf 関電業務委託の中核機能）
- 見積: **6.7d**（D 共通基盤 2.7d + A Backoffice 2.3d + B Input 1.5d）※ v3 改訂で +0.7d（論理削除全員化 -0.2d / 画像 DL 専用 PW +0.6d / 履歴 trigger +0.3d）
- 実装順: **D → A → B**（Q2 採択で確定）
- 作成: 2026-04-23 起草 / 2026-04-25 初版確定 / 2026-04-25 v2 改訂 / **2026-04-25 v3 改訂**（東海林さん業務レビュー回答で確定）
- 前提:
  - 親 CLAUDE.md §11〜§18（横断調整・工数蓄積・現場 FB 運用ルール）
  - 横断 spec PR #25（`docs/specs/cross-cutting/` 配下 6 件）
  - **Root A-3-g（`feature/root-phase-a3-g-employees-outsource-extension`）** — `is_user_active()` / `garden_role_of(uid)` / `outsource` ロール / `contract_end_on` 列を Root 側で先行実装。本 spec はこれに依存。A-3-g マージ後に本 spec の migration を実行する
  - handoff-20260423（4/22-23 の a-leaf/b-main ブレスト継続）
  - Phase A-FMK1（FileMaker 風キーボードショートカット、PR #1 本ブランチ既実装）

---

## 1. Executive Summary

### 1.1 目的
関電業務委託案件の業務上必要な画像（電灯/動力/ガス/諸元/受領書）を Garden-Leaf 上で**閲覧・アップロード・圧縮・サムネ生成・論理削除**できるようにする。現状これらの画像は TimeTree（カレンダーアプリ）に蓄積されており、Garden 化により一元管理・検索性向上・将来の OCR 自動化の土台を整える。

### 1.2 スコープ（A-1c v3 改訂版）
- 閲覧（サムネ一覧 + 1500px 拡大ライトボックス）
- アップロード（選択/撮影 → Canvas 圧縮 → Supabase Storage 直接 PUT）
- 圧縮（1500px JPEG85% 本体 + 300px JPEG70% サムネ）
- サムネ生成（同時生成、事前保存）
- **論理削除 + UNDO snackbar 5 秒**（**v3 で全員可能化**、manager+ 制限撤廃。Garden 全モジュール共通パターン採択、Kintone 運用で admin に削除依頼集中する問題を解消）
- 物理削除 UI + 復元機能（admin / super_admin 限定、v2 継続）
- 削除済バッジ（全員可視、誤削除認識用、v2 継続）
- HEIC → JPEG 変換（iPhone 撮影対応、文言は A+C 合成版）
- ロール分岐 RLS（8 段階 `garden_role` enum、Root A-3-g 依存、v2 継続）
- 事業スコープ制御（`leaf_businesses` / `leaf_user_businesses` / `leaf_user_in_business()`、v2 継続）
- **画像 DL 専用パスワード（スマホのみ）**（**v3 で方式変更**：Garden ログイン PW ではなく `root_settings.image_download_password_hash` を bcrypt 比較。全ユーザー共通 1 本、super_admin が設定・変更）
- **専用 PW 設定 UI**（**v3 新規**、Root マイページの専用タブ、super_admin 限定、bcrypt でハッシュ化保存）
- 契約終了日による外注営業の自動アクセス遮断（`is_user_active()` 経由、v2 継続）
- **変更履歴記録の準備（v3 新規）**：`leaf_kanden_attachments_history` テーブル + BEFORE UPDATE trigger で who/when/field/old/new を自動ログ。metadata 変更・論理削除・復元・物理削除をすべて記録。UI（Kintone 風右側収納パネル）は別 spec（Batch 14 横断履歴 UI）で実装、A-1c ではデータ層のみ用意

### 1.3 スコープ外（Phase B 以降へ委譲）
- 3 階層移行バッチ（recent → monthly → yearly PDF 集約）
- TimeTree から Garden への既存画像移行（TimeTree API 制約のため手動/半自動運用を Phase B で再設計）
- OCR 処理（`KandenAttachment.ocr_processed` 列は予約済のまま）
- 事業マスタ UI（`leaf_businesses` / `leaf_user_businesses` CRUD 画面、Phase B-1）
- Lightbox 機能拡張（画像回転 / 他形式エクスポート など）
- Playwright E2E（spec-cross-test-strategy の Leaf 🟡 通常厳格度、A-1c では Vitest + RTL+MSW のみ）
- **Storage の orphan cleanup job** は依然として Phase B（§ 7.1）

### 1.4 主な設計判断（Q3〜Q8 着地サマリ、2026-04-25 v2 改訂）
| Q | 論点 | 採択 |
|---|---|---|
| Q2 | バケット構造 | 3 バケット分離（recent / monthly / yearly） |
| Q3 | A-1c のスコープ | C 案（閲覧 + upload + 圧縮 + サムネ、移行バッチは Phase B） |
| **Q4** | **RLS 粒度** | **B+ 案（8 段階ロール × 事業スコープ、~~A 案ロール分岐なし~~ を差替）** |
| Q5 | Upload 処理 | A 案（client 主導、Route Handler 不使用） |
| Q6 | 圧縮タイミング | A 案 + C 案の並列 upload 要素（選択直後に圧縮、並列 PUT） |
| Q6.1 | HEIC 対応 | heic2any 追加承認、client で JPEG 変換してから Canvas 圧縮 |
| Q8 | API 層 | A 案（全面 SDK 直呼び、`src/lib/supabase/client.ts` 共通化を Leaf が先頭バッター） |

### 1.5 ロール × 操作マトリクス（v3 改訂: 論理削除を全員可能化）

8 段階 `garden_role` enum（Root A-3-g 定義）:
`toss` / `closer` / `cs` / `staff` / `outsource` / `manager` / `admin` / `super_admin`

| 操作 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 閲覧（サムネ + Lightbox）| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| Upload | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| Metadata 編集（カテゴリ変更等）| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| **論理削除（v3 で全員可）** | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| **UNDO（論理削除の取消、v3 で全員可）**| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| **物理削除 + 復元（削除済バッジ UI）**| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **画像ダウンロード（PC、パスワード不要）**| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| **画像ダウンロード（スマホ、要 DL 専用 PW）**| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| **DL 専用 PW 設定・変更（v3 新規）**| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

※ = `leaf_user_in_business('kanden')` が TRUE（= 関電事業に所属 + `is_user_active()`）の場合のみ。admin / super_admin は事業横断で無条件。

---

## 2. アーキテクチャ

### 2.1 3 層構造

```
┌────────────────────────────────────────────────────────────────┐
│ UI 層  src/app/leaf/{backoffice,input}/_components/            │
│  ├─ AttachmentGrid.tsx     … サムネ一覧 (5 カテゴリ別表示)      │
│  ├─ AttachmentUploader.tsx … 選択/撮影 → 圧縮進捗 → 並列 upload │
│  ├─ AttachmentLightbox.tsx … 1500px 拡大ビューワ               │
│  └─ AttachmentDeleteButton.tsx … 論理削除 + 2 段確認            │
└────────────────────────────────────────────────────────────────┘
                               ↕
┌────────────────────────────────────────────────────────────────┐
│ ロジック層  src/app/leaf/_lib/                                  │
│  ├─ attachments.ts         … upload / signedURL / 論理削除 / CRUD │
│  ├─ image-compression.ts   … Canvas 圧縮 + サムネ + HEIC ラッパ  │
│  ├─ image-compression.worker.ts … 重処理を main thread と分離  │
│  └─ kanden-storage-paths.ts … bucket/path 命名の集中管理        │
└────────────────────────────────────────────────────────────────┘
                               ↕
┌────────────────────────────────────────────────────────────────┐
│ インフラ層                                                       │
│  ├─ src/lib/supabase/client.ts (新設) … 横断共通 browser client│
│  ├─ Supabase Storage × 3 bucket                                │
│  │   ├─ leaf-kanden-photos-recent  (write 可)                  │
│  │   ├─ leaf-kanden-photos-monthly (A-1c では read-only)       │
│  │   └─ leaf-kanden-photos-yearly  (A-1c では read-only)       │
│  └─ Supabase Postgres                                          │
│      └─ leaf_kanden_attachments テーブル（+ deleted_at 追加）   │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Storage パス規則（`kanden-storage-paths.ts` が正本）

```
leaf-kanden-photos-recent/
  <case_id>/<attachment_id>.jpg          … 1500px 本体
  <case_id>/thumb/<attachment_id>.jpg    … 300px サムネ

leaf-kanden-photos-monthly/             ← A-1c では read のみ
  <yyyy-mm>/<case_id>_<attachment_id>.pdf

leaf-kanden-photos-yearly/              ← A-1c では read のみ
  <yyyy>/<case_id>_<attachment_id>.pdf
```

### 2.3 RLS 方針（8 ロール × 事業スコープ、2026-04-25 v2 改訂）

#### 前提関数（Root A-3-g 定義、本 spec 依存）

```sql
-- is_user_active(): retired_on / contract_end_on チェック
-- garden_role_of(uid uuid): ロール取得
-- （いずれも Root A-3-g で定義、SECURITY DEFINER）
```

#### 追加関数（本 spec で定義）

```sql
-- leaf_user_in_business(biz_id text): 事業所属 + 有効判定
CREATE OR REPLACE FUNCTION leaf_user_in_business(biz_id text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM leaf_user_businesses
    WHERE user_id = auth.uid()
      AND business_id = biz_id
      AND (removed_at IS NULL OR removed_at > now())
  ) AND is_user_active();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

#### `leaf_kanden_attachments` テーブル

```sql
-- SELECT: 関電事業所属者 + 削除済も可視（バッジ表示のため）、または admin/super_admin は横断可
CREATE POLICY leaf_attachments_select ON leaf_kanden_attachments
  FOR SELECT USING (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- INSERT: 関電事業所属者 (toss/closer/cs/staff/outsource/manager/admin/super_admin 全員)
CREATE POLICY leaf_attachments_insert ON leaf_kanden_attachments
  FOR INSERT WITH CHECK (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- UPDATE: メタ編集・論理削除ともに事業所属者全員に許可（v3 で簡略化）
-- v3 変更: manager+ の Client ガードは不要になった。Garden 全モジュール共通パターンとして
-- 論理削除は全員可能、物理削除 + 復元のみ admin/super_admin に制限する。
CREATE POLICY leaf_attachments_update ON leaf_kanden_attachments
  FOR UPDATE USING (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  ) WITH CHECK (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- DELETE（物理削除）: admin / super_admin のみ（v2 から変更なし）
CREATE POLICY leaf_attachments_delete ON leaf_kanden_attachments
  FOR DELETE USING (
    garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );
```

**v3 で簡略化された UPDATE ロール制御**:
- 旧 v2: RLS は事業所属のみ + Client ガードで manager+ 限定 → 列単位制御困難で 2 段構え
- 新 v3: **RLS + Client 共に「事業所属者 or admin なら可」で統一**。論理削除は全員可能
- 業務根拠: Kintone 運用で「削除依頼が admin に集中」問題を解消。営業が自分で論理削除（= 削除依頼と同義）、admin は休日明けにまとめて物理削除 or 復元のバッチ処理
- 監査は §3.6（v3 新規）の `leaf_kanden_attachments_history` trigger と Phase B の cross-audit-log に集約

#### `leaf-kanden-photos-recent` bucket

```sql
CREATE POLICY leaf_recent_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'leaf-kanden-photos-recent' AND (
      leaf_user_in_business('kanden')
      OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    )
  );

CREATE POLICY leaf_recent_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'leaf-kanden-photos-recent' AND (
      leaf_user_in_business('kanden')
      OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    )
  );

-- UPDATE 禁止（A-1c スコープ内、オブジェクト上書きなし）
CREATE POLICY leaf_recent_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'leaf-kanden-photos-recent' AND FALSE);

-- DELETE: admin / super_admin のみ（物理削除 UI 用）
CREATE POLICY leaf_recent_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'leaf-kanden-photos-recent'
    AND garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );
```

#### `leaf-kanden-photos-monthly` / `yearly` bucket

```sql
-- SELECT: 関電事業所属 or admin
CREATE POLICY leaf_archive_select ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-yearly')
    AND (
      leaf_user_in_business('kanden')
      OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    )
  );

-- INSERT / UPDATE / DELETE 禁止（A-1c では read-only、Phase B の service_role 移行バッチで書込）
CREATE POLICY leaf_archive_insert ON storage.objects FOR INSERT WITH CHECK (FALSE);
CREATE POLICY leaf_archive_update ON storage.objects FOR UPDATE USING (FALSE);
CREATE POLICY leaf_archive_delete ON storage.objects FOR DELETE USING (FALSE);
```

**v1 (2026-04-25 初版) → v2 (2026-04-25 改訂) の変更**:
- 旧 Q4 A 案「ロール分岐なし、Pattern-1 簡略版」→ 新 Q4 B+ 案「8 ロール × 事業スコープ」
- `auth.uid() IS NOT NULL` → `leaf_user_in_business('kanden') OR garden_role_of(...) IN (admin,super_admin)`
- DELETE FALSE → admin / super_admin のみ物理削除可能
- SELECT で deleted_at IS NULL フィルタを外し、削除済バッジ表示のため全件取得可能に（削除済判定は UI 側で）

### 2.4 Size / MIME 制限（Storage レベル）

spec-cross-storage §4.1 / §5.1 準拠。

| bucket | size | allowed MIME |
|---|---|---|
| `leaf-kanden-photos-recent` | **5 MB/枚** | `image/jpeg`, `image/png`, `image/heic` |
| `leaf-kanden-photos-monthly` | 50 MB/枚 | `application/pdf` |
| `leaf-kanden-photos-yearly` | 50 MB/枚 | `application/pdf` |

5 MB は圧縮後（1500px JPEG85%）で十分余裕、原本 upload の誤操作を Storage 側で弾く役割も兼ねる。

### 2.5 Supabase client 共通化

spec-cross-rls-audit §2 パターン A / §8 W1 の Leaf 先頭バッター実装。

- `src/lib/supabase/client.ts` **新設** … 横断共通 browser client、JSDoc で「ブラウザ専用」明示
- `src/app/leaf/_lib/supabase.ts` … `export { supabase } from '@/lib/supabase/client'` に縮小（既存 import 不変）
- `src/lib/supabase/server.ts` / `admin.ts` は A-1c では作らない（YAGNI、Route Handler 不使用、Phase B で追加）
- Forest / Bud / Root は後続で本実装を参考に移行

**JSDoc 例**:
```typescript
// src/lib/supabase/client.ts
/**
 * Garden 横断共通 Supabase ブラウザクライアント（anon key）
 *
 * **ブラウザ専用**。Route Handler / Server Component では使用禁止。
 * Route Handler では src/lib/supabase/server.ts の createAuthenticatedSupabase を、
 * Cron / batch では src/lib/supabase/admin.ts の createAdminSupabase を使用すること。
 *
 * see: docs/specs/cross-cutting/spec-cross-rls-audit.md §2 パターン A
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

### 2.6 データモデル拡張（migration、2026-04-25 v2 改訂）

#### 2.6.1 既存 `leaf_kanden_attachments` 拡張

```sql
ALTER TABLE leaf_kanden_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES root_employees(user_id);
```

**インデックス**: § 2.6.3 に集約

#### 2.6.2 新規テーブル 2 本（事業スコープ、v2 追加）

```sql
-- 事業マスタ（関電委託 / コールセンター / ブレーカー 等、Leaf 配下の事業を一元管理）
CREATE TABLE IF NOT EXISTS leaf_businesses (
  business_id    text PRIMARY KEY,        -- 'kanden' / 'callcenter' / 'breaker' 等
  display_name   text NOT NULL,           -- 表示名（例: 「関電業務委託」）
  product_type   text,                    -- 商材種別（電気 / 通信 等、任意）
  flow_type      text,                    -- 商流種別（委託 / 自社 等、任意）
  start_date     date,                    -- 事業開始日
  end_date       date,                    -- 事業終了日（NULL = 継続中）
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE leaf_businesses IS 'Leaf 配下事業マスタ（関電/CC/ブレーカー等、事業単位アクセス制御）';

-- ユーザー × 事業 所属
CREATE TABLE IF NOT EXISTS leaf_user_businesses (
  user_id        uuid NOT NULL REFERENCES root_employees(user_id),
  business_id    text NOT NULL REFERENCES leaf_businesses(business_id),
  role_in_biz    text,                    -- 事業内役割（例: 'sales_lead' 等、任意）
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  assigned_by    uuid REFERENCES root_employees(user_id),
  removed_at     timestamptz,             -- 所属解除日時（NULL = 所属中）
  PRIMARY KEY (user_id, business_id)
);

COMMENT ON TABLE leaf_user_businesses IS 'ユーザー × 事業 所属（レコード有効性は removed_at で判定）';
```

#### 2.6.3 変更履歴テーブル + trigger（v3 新規）

```sql
-- 変更履歴（audit log）: BEFORE UPDATE / DELETE trigger で自動記録
CREATE TABLE IF NOT EXISTS leaf_kanden_attachments_history (
  history_id       bigserial PRIMARY KEY,
  attachment_id    uuid NOT NULL,
  operation        text NOT NULL,           -- 'UPDATE' | 'DELETE' (INSERT 未記録、必要時 Phase B で拡張)
  changed_field    text,                    -- 'category' / 'deleted_at' / 'is_guide_capture' 等。DELETE 時は NULL
  old_value        text,                    -- 変更前値（JSON 文字列化、NULL 許容）
  new_value        text,                    -- 変更後値（JSON 文字列化、NULL 許容）
  changed_by       uuid REFERENCES root_employees(user_id),
  changed_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE leaf_kanden_attachments_history IS
  'Attachment 変更履歴 (v3)。UPDATE/DELETE 自動記録、UI は Batch 14 横断履歴 spec で別途実装';

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_history_attachment
  ON leaf_kanden_attachments_history (attachment_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_history_changed_by
  ON leaf_kanden_attachments_history (changed_by, changed_at DESC);

-- trigger 関数: UPDATE の変更列を行単位で検出して history に転記
CREATE OR REPLACE FUNCTION leaf_kanden_attachments_history_trigger()
RETURNS trigger AS $$
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
    INSERT INTO leaf_kanden_attachments_history
      (attachment_id, operation, changed_field, old_value, new_value, changed_by)
    VALUES (OLD.attachment_id, 'DELETE', NULL,
            to_jsonb(OLD)::text, NULL, auth.uid());
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH col_name IN ARRAY tracked_cols LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col_name, col_name)
        USING OLD, NEW INTO old_val, new_val;
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO leaf_kanden_attachments_history
          (attachment_id, operation, changed_field, old_value, new_value, changed_by)
        VALUES (NEW.attachment_id, 'UPDATE', col_name, old_val, new_val, auth.uid());
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_leaf_kanden_attachments_history ON leaf_kanden_attachments;
CREATE TRIGGER trg_leaf_kanden_attachments_history
  AFTER UPDATE OR DELETE ON leaf_kanden_attachments
  FOR EACH ROW EXECUTE FUNCTION leaf_kanden_attachments_history_trigger();
```

**履歴 RLS**:
```sql
ALTER TABLE leaf_kanden_attachments_history ENABLE ROW LEVEL SECURITY;

-- SELECT: 事業所属者は自事業の履歴、admin は全件
CREATE POLICY leaf_history_select ON leaf_kanden_attachments_history
  FOR SELECT USING (
    garden_role_of(auth.uid()) IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM leaf_kanden_attachments a
      WHERE a.attachment_id = leaf_kanden_attachments_history.attachment_id
        AND leaf_user_in_business('kanden')
    )
  );

-- INSERT / UPDATE / DELETE: trigger 経由のみ（SECURITY DEFINER で昇格）、直接書込禁止
CREATE POLICY leaf_history_no_write ON leaf_kanden_attachments_history
  FOR ALL USING (FALSE) WITH CHECK (FALSE);
```

**UI は別 spec**（Batch 14 横断履歴 UI spec）。A-1c ではデータ層（テーブル + trigger + RLS）のみ用意、UI 実装は次 Batch。

#### 2.6.4 画像 DL 専用パスワード格納（v3 新規、`root_settings` 活用）

Root モジュールの `root_settings` テーブル（既存 or Root が用意する汎用 KV store）に以下キーを投入:

```sql
-- root_settings (key text PK, value jsonb) を前提。未実装なら Root 側で先行作成依頼。
INSERT INTO root_settings (key, value)
VALUES (
  'leaf.image_download_password_hash',
  jsonb_build_object(
    'hash', '$2b$12$<bcrypt hash>',    -- super_admin が初期投入、bcrypt rounds=12
    'updated_at', now(),
    'updated_by', '<super_admin user_id>'
  )
)
ON CONFLICT (key) DO NOTHING;
```

**運用方針**:
- 全 Leaf ユーザー共通の **1 本** のパスワード
- `super_admin` のみ設定・変更可能（Root マイページに専用タブ、v3 新規 UI）
- bcrypt（rounds=12）でハッシュ化、平文は保存しない
- 定期変更想定（月次・四半期等）、変更時は東海林さんが Chatwork 等で全員通知
- 失敗時動作: 3 回失敗で画面ロック 5 分（v2 から変更なし）

**RLS（`root_settings`）**:
- SELECT: 認証済みユーザー（`key LIKE 'leaf.%'` を許可、他モジュールキーは別ポリシー）
- UPDATE / INSERT / DELETE: `super_admin` のみ
- 詳細は Root 側 spec（A-3-g/h 系）で別途定義、本 spec は依存として明示

#### 2.6.5 インデックス（既存 + v3 追加）

```sql
CREATE INDEX IF NOT EXISTS idx_leaf_kanden_attachments_case_id_active
  ON leaf_kanden_attachments (case_id)
  WHERE deleted_at IS NULL;

-- 削除済データの高速フィルタ（admin 削除済バッジ表示用）
CREATE INDEX IF NOT EXISTS idx_leaf_kanden_attachments_case_id_deleted
  ON leaf_kanden_attachments (case_id)
  WHERE deleted_at IS NOT NULL;

-- leaf_user_businesses の所属検索高速化
CREATE INDEX IF NOT EXISTS idx_leaf_user_businesses_user_active
  ON leaf_user_businesses (user_id)
  WHERE removed_at IS NULL;
```

#### 2.6.6 TypeScript 型（`src/app/leaf/_lib/types.ts` 追加、v3 更新）

既存 `KandenAttachment` 型に以下追加:
- `deleted_at: string | null`（v1 から継続）
- `deleted_by: string | null`（v2 新規、RLS 監査用）

新規型（v2 継続 + v3 追加）:
```typescript
export interface LeafBusiness {
  business_id: string;
  display_name: string;
  product_type: string | null;
  flow_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeafUserBusiness {
  user_id: string;
  business_id: string;
  role_in_biz: string | null;
  assigned_at: string;
  assigned_by: string | null;
  removed_at: string | null;
}

// v3 新規: 変更履歴レコード（UI 実装は Batch 14 別 spec だが型は A-1c で定義）
export interface AttachmentHistory {
  history_id: number;
  attachment_id: string;
  operation: 'UPDATE' | 'DELETE';
  changed_field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

// v3 新規: DL 専用 PW 設定値
export interface ImageDownloadPasswordSetting {
  hash: string;          // bcrypt hash
  updated_at: string;
  updated_by: string;    // super_admin user_id
}
```

既存 `KandenAttachment` の他フィールドはそのまま（5 カテゴリ / 3 階層 / サムネ / OCR 予約 / uploaded_by/at / archived_at）。

#### 2.6.7 初期データ投入（migration 直後に Supabase Dashboard 手動実行）

```sql
-- 関電事業を初期登録
INSERT INTO leaf_businesses (business_id, display_name, product_type, flow_type, start_date)
VALUES ('kanden', '関電業務委託', '電気', '委託', '2020-01-01')
ON CONFLICT (business_id) DO NOTHING;

-- 東海林さんを super_admin + 関電所属で登録（実 user_id に置換）
-- INSERT INTO leaf_user_businesses (user_id, business_id, role_in_biz, assigned_by)
-- VALUES ('<東海林さんの user_id>', 'kanden', 'super_admin', '<東海林さんの user_id>')
-- ON CONFLICT (user_id, business_id) DO NOTHING;
```

**運用**: 将来の事業マスタ UI は Phase B-1 で構築、A-1c では Supabase Dashboard 手動投入。

---

## 3. データフロー

### 3.1 Upload フロー（時系列）

```
[UI 層]                       [ロジック層]                     [インフラ層]

1. File 選択/撮影
   input[type=file] / camera capture API

2. カテゴリ選択必須
   (denki/douryoku/gas/shogen/ryosho)
   ※ 1 upload = 1 カテゴリ
   ※ 複数カテゴリは分けて upload

3. HEIC 判定 ──────────→ image-compression.ts
                         ├─ MIME == "image/heic" →
                         │  Web Worker で heic2any → JPEG Blob
                         └─ else そのまま通過

4. Canvas 圧縮 ─────────→ Web Worker
                         ├─ 1500px JPEG85% (本体)
                         └─  300px JPEG70% (サムネ)

5. プレビュー表示
   ObjectURL(圧縮済画像) でカード表示

6. [upload] ボタン ─────→ attachments.ts
                         ├─ kanden-storage-paths.ts で path 生成
                         │  recent/<case_id>/<uuid>.jpg
                         │  recent/<case_id>/thumb/<uuid>.jpg
                         │
                         └─ 並列 PUT (mobile 2 / PC 3) ──→ Storage:recent

7. 全成功 ─────────────→ INSERT leaf_kanden_attachments ──→ Postgres
                         (attachment_id / case_id / category /
                          storage_url / thumbnail_url / mime_type /
                          uploaded_by / uploaded_at /
                          archived_tier="recent" / deleted_at=NULL)

8. UI 更新 → grid 再 query
```

**並列数制御**（判断保留 #6、依存 npm 追加なし）:

```typescript
function getUploadConcurrency(): number {
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const effectiveType = (navigator as { connection?: { effectiveType?: string } })
    .connection?.effectiveType;
  if (isMobileUA) return 2;                              // UA でモバイル判定できれば確定
  if (effectiveType && /^(2g|3g|4g)$/.test(effectiveType)) return 2;
  return 3;                                               // PC or 判定不能（iOS Safari 含む）
}
```

- 実装は `Promise.allSettled` を N 枚ずつ chunk して順次実行（シンプルなキュー、p-queue 等の依存追加なし）

**beforeunload 警告**（判断保留 #4）:
- upload 進行中に `window.addEventListener('beforeunload', e => e.preventDefault())` を登録
- ブラウザ既定文言で表示（Chrome 等は独自文言不可）
- 全 upload 完了 or コンポーネントアンマウント時に listener 解除

### 3.2 失敗時のリカバリ

**原則**: 1 枚失敗 → 他は継続、該当 1 枚のみ 3 回自動リトライ。

| 失敗箇所 | 挙動 |
|---|---|
| HEIC 変換失敗 | try-catch → トースト「iPhone の写真形式変換に失敗しました。iPhone の設定→カメラ→フォーマット→互換性優先 に変更後、再度お試しください」。該当ファイル除外、他継続 |
| Canvas 圧縮失敗 | try-catch → トースト「画像の処理に失敗しました。別の画像で再試行してください。」該当ファイル除外、他継続 |
| Storage PUT 失敗 | 指数バックオフ自動リトライ（1s → 3s → 9s、最大 3 回） |
| Storage PUT 3 回失敗 | トースト「N 枚中 M 枚のアップロードに失敗しました」、失敗リスト UI に「再試行」ボタン |
| Network timeout (30s) | リトライ扱い（上記 3 回に合算） |
| metadata insert 失敗 | Storage PUT 成功 + insert 失敗 = **orphan ファイル発生**。トースト「保存に失敗しました、再試行してください」+ 再試行ボタン（insert のみ再送）。orphan の物理削除は Phase B cleanup job に統合（§ 7.1） |

**API 粒度**:
- `attachments.ts` の `uploadAttachments(files, caseId, category, opts)`
- 返値: `{ succeeded: KandenAttachment[]; failed: { file: File; reason: string }[] }`
- UI 層は結果を受けてトースト + 再試行 UI を表示

### 3.3 signedURL 発行タイミング（ハイブリッド方式）

**採択理由**:
- A 全一括: grid 表示だけで 15 枚分 × TTL 10 分の漏洩面積が大きい
- B 都度発行: 15 回 API 呼出で重い、UX 遅延
- **C ハイブリッド（採択）**: サムネ = grid 表示時に一括、本体（1500px）= Lightbox 開く時のみ都度

```
[Grid マウント時]
1. query leaf_kanden_attachments WHERE case_id = X
   ※ v2 改訂: SELECT ポリシーで deleted_at フィルタしない（削除済バッジ表示のため）
   ※ v2 改訂: RLS は leaf_user_in_business('kanden') + admin で絞込

2. 結果を deleted_at IS NULL と deleted_at IS NOT NULL で UI 側で分類
   - 通常カード: deleted_at IS NULL
   - 削除済カード: deleted_at IS NOT NULL（「削除済」バッジ + admin のみ復元ボタン）

3. 全画像（削除済含む）の thumbnail_url (storage path) を抽出
   ※ 削除済画像もサムネ表示するので signedURL 発行対象に含める

4. supabase.storage
    .from('leaf-kanden-photos-recent')
    .createSignedUrls(paths, 600)   // TTL 10 分、1 API で全サムネ一括

5. grid state に { attachment_id → signedURL, expiresAt } 保持

6. render サムネグリッド（削除済カードはグレースケール + バッジで区別）

[10 分以内の再描画]
- state に保持した signedURL を再利用（再発行なし）

[10 分経過後]
- mount 時に expiresAt 判定 → 期限切れなら再発行

[Lightbox クリック時]
- 該当 attachment の storage_url（本体 path）で
  createSignedUrl(path, 600) を単発発行
- <img src={signedURL}> で 1500px 表示
- § 3.5 の DownloadButton はスマホ時にパスワード認証を挟む
```

**削除済画像の取扱（v2 改訂）**:
- RLS SELECT は事業所属で判定、deleted_at フィルタなし
- UI 側で `deleted_at IS NOT NULL` を判定して「削除済」バッジ表示、グレースケール化、Lightbox open は block
- 誤削除の早期発見（「あの画像どこ行った？→ 削除済バッジで見える」）を狙う
- § 4.3 手動 RLS 検証シナリオ #10 は「削除済画像が全員に見える」「Lightbox は block」を検証

### 3.4 削除フロー（v3 全員論理削除 + admin 物理削除 + 削除済バッジ）

#### 3.4.1 ロール別削除 UI 表示（v3 簡略化）

| ロール | × ボタン表示 | 論理削除 | UNDO | 物理削除 | 復元 |
|---|:---:|:---:|:---:|:---:|:---:|
| toss / closer / cs / staff / outsource / manager | **✅ ホバー/長押し表示** | **✅** | **✅** | ❌ | ❌ |
| admin / super_admin | ✅ 常時表示 | ✅ | ✅ | ✅ | ✅ |

**v3 変更**: manager+ 限定の削除ボタン制御を廃止。事業所属者全員が論理削除可能（Kintone 運用の admin 削除依頼集中を解消）。物理削除 + 復元は admin+ 継続。

**Client 側のロール判定（v3 簡略化）**:
- Grid マウント時に `garden_role_of(auth.uid())` を取得（React context）
- AttachmentCard は削除ボタン常時 or ホバー表示（全員）、`AttachmentAdminActions` のみ admin+ 判定
- 事業所属は RLS で担保（非所属ユーザーは SELECT で見えないので UI も出ない）

#### 3.4.2 削除済バッジ（v2 継続、全員可視）

```
[通常]                       [削除済]（deleted_at IS NOT NULL）
┌────────────┐               ┌────────────┐
│            │               │ ╱削除済╱   │  ← バッジ左上
│  [img]     │               │  [img]     │  ← グレースケール
│            │               │            │
│      [電灯]│               │      [電灯]│
└────────────┘               └────────────┘
```

- 全ロール可視
- クリック/タップで Lightbox open を block（カーソル not-allowed）
- admin / super_admin のみ「復元」「完全削除（物理）」ボタンを表示

#### 3.4.3 論理削除フロー（v3 全員可能）

```
1. × クリック（全員表示、ホバー/長押し時）
   ↓
2. 確認ダイアログ（v3 文言更新）
   ┌─────────────────────────────────┐
   │ この画像を削除しますか？          │
   │ （削除済一覧に残り、管理者の最終確認│
   │   を経て完全削除 or 復元されます） │
   │                                 │
   │      [キャンセル]  [削除する]    │
   └─────────────────────────────────┘
   ↓ [削除する]
3. 楽観的更新: UI で対象カードを「削除済バッジ」表示へ切替
   ↓
4. UPDATE leaf_kanden_attachments
   SET deleted_at = now(), deleted_by = auth.uid()
   WHERE attachment_id = ?
   ↓ (BEFORE UPDATE trigger が leaf_kanden_attachments_history に記録)
5. UNDO snackbar (5 秒、固定)
   ┌─────────────────────────────────┐
   │ 画像を削除しました  [元に戻す]   │
   └─────────────────────────────────┘
   ↓ [元に戻す] クリック (5 秒以内、自分が削除したものに限る)
6. UPDATE deleted_at = NULL, deleted_by = NULL → grid 通常表示に復帰
   （trigger が再度 history に記録）
```

**UNDO 秒数**: 5 秒固定（判断保留 #10、v3 で確定化）、β版 UX 試験で変更可（§ 7.6）。
**UNDO 権限**: 自分が削除した直後（同セッション内）のみ有効、5 秒経過 or 画面離脱で失効。

**運用イメージ（v3 採択根拠）**:
- 営業が現場で誤画像 upload → 自分で論理削除（＝ 削除依頼と同義）
- admin は休日明けに「削除済一覧」を確認、妥当なら一括物理削除、誤削除なら復元
- 従来 Kintone では admin への削除依頼がボトルネック → 解消

#### 3.4.4 admin の物理削除 + 復元 UI（v2 継続）

削除済カード上でのみ表示:

```
[削除済カード hover 時]
┌──────────────────────────┐
│ ╱削除済╱                 │
│                          │
│  [img]                   │
│                          │
│ [復元] [完全削除]        │  ← admin / super_admin のみ
└──────────────────────────┘
```

**復元フロー**:
1. [復元] クリック → 確認ダイアログ「この画像を復元しますか？」→ [復元する]
2. `UPDATE leaf_kanden_attachments SET deleted_at = NULL, deleted_by = NULL`
3. trigger が history に記録（復元者 = admin user_id）

**物理削除フロー**:
1. [完全削除] クリック → 強い確認ダイアログ「**完全に削除します。この操作は取り消せません。** 本当に削除しますか？」→ [完全削除する]
2. `DELETE FROM leaf_kanden_attachments WHERE attachment_id = ?`
3. trigger が history に DELETE 記録（削除前行スナップショットを old_value に JSON 格納）
4. Storage からも `supabase.storage.from('leaf-kanden-photos-recent').remove([path, thumbPath])`
5. 失敗時: トースト表示、DB と Storage のズレは Phase B cleanup job（§ 7.1）で補正

**API**（`attachments.ts`、v3 更新）:
- `softDeleteAttachment(id)` / `undoSoftDelete(id)` — **全員可**（Client ガード撤廃）
- `restoreAttachment(id)` — admin+（UNDO snackbar 期限後の復元、Client ガード）
- `hardDeleteAttachment(id)` — admin+（DB + Storage 物理削除、Client ガード）

### 3.5 Lightbox 仕様 + 画像ダウンロード（v3 専用 DL パスワード方式に変更）

#### 3.5.1 基本表示（v1 から継続）

- `<img src={signedURL}>` + CSS（backdrop + 中央配置）、Canvas 不要
- ESC / 背景クリックで close
- ← → キーで前後画像遷移（同 case の attachment 一覧内）
- Tab キーで UI 操作可能（A-FMK1 キーボード操作 UX 準拠）

#### 3.5.2 ダウンロードボタン（v3 DL 専用パスワード方式）

Lightbox に `DownloadButton` を配置。デバイス判定でフロー分岐:

```
[PC 判定 = !isMobileDevice]
  クリック → signedURL から直接 DL（即座、パスワード不要、v2 から変更なし）

[Mobile 判定 = isMobileDevice]
  クリック → パスワードモーダル
    「画像をダウンロードします。画像ダウンロード専用パスワードを入力してください。」
    「※ 通常のログインパスワードとは異なります。管理者にお問い合わせください。」
    [入力欄 type=password]
    [キャンセル] [ダウンロードする]
      ↓ [ダウンロードする]
  1. supabase.rpc('verify_image_download_password', { input_password: <入力値> })
     ← サーバサイドで bcrypt compare、結果 boolean を返す
  2. 成功 → signedURL から DL 起動
  3. 失敗 → 「パスワードが一致しません」トースト + sessionStorage で失敗カウント増
  4. 3 回失敗 → 画面ロック 5 分（sessionStorage にロック時刻記録、解除後カウントリセット）
```

**v3 での変更（Garden ログイン PW → DL 専用 PW）**:
- v2 では `supabase.auth.signInWithPassword` でログイン PW を検証 → セッション再発行の副作用、PW 管理が個人別、変更容易でない
- v3 は `root_settings.leaf.image_download_password_hash` を bcrypt 比較 → **全員共通 1 本 / super_admin が変更 / 副作用なし**
- 業務運用: super_admin が定期（月次 or 四半期）ローテ、変更時は東海林さんが Chatwork 等で全員通知

**デバイス判定**（v2 から変更なし）:
```typescript
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
```

**なぜスマホだけパスワード**:
- 社内 PC は入退室管理 + 画面ロックで物理的に保護される
- スマホは紛失・一時貸与時の漏洩リスクが高い → 画像 DL のような「持出」操作には認証を追加
- 閲覧（Lightbox 表示）はパスワード不要、**DL（保存）** のみ要求

#### 3.5.3 DL 専用パスワード設定 UI（v3 新規、Root マイページ内）

- 配置: `src/app/root/me/image-download-password/page.tsx`（Root マイページの専用タブ）
- 表示条件: `garden_role_of(auth.uid()) = 'super_admin'` のみ
- 機能:
  - 現在の hash の `updated_at` / `updated_by` を表示（値は非表示）
  - 「新しいパスワード」「確認用再入力」の 2 欄
  - 最低 8 文字、英数字混在の軽い validation
  - [設定する] クリック → bcrypt.hashSync(new_password, 12) を client で実行（bcryptjs npm 追加）→ `supabase.rpc('set_image_download_password', { new_hash })` で root_settings UPDATE
  - 成功後、「次回の変更は ◯月◯日目安」（定期ローテ運用を示唆）トースト
- バリデーション失敗: トースト表示（「確認用と一致しません」等）

#### 3.5.4 API（`attachments.ts` v3 更新）

- `verifyImageDownloadPassword(password: string): Promise<boolean>` — サーバサイド RPC（`verify_image_download_password`）を呼ぶだけ
- `verifyUserPasswordAndDownload(attachmentId: string, password: string): Promise<void>` — v3 で**内部処理を変更**（Garden auth signIn → DL 専用 PW RPC）、外部シグネチャは維持
- ロック状態（3 回失敗）は sessionStorage でカウント、5 分経過で自動解除（v2 から変更なし）

#### 3.5.5 Supabase 側 RPC 関数（migration で定義、§8 参照）

```sql
-- パスワード検証 RPC（bcrypt compare）
CREATE OR REPLACE FUNCTION verify_image_download_password(input_password text)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT value->>'hash' INTO stored_hash
  FROM root_settings
  WHERE key = 'leaf.image_download_password_hash';
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  -- pgcrypto の crypt() で bcrypt 互換比較
  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- パスワード設定 RPC（super_admin のみ）
CREATE OR REPLACE FUNCTION set_image_download_password(new_hash text)
RETURNS void AS $$
BEGIN
  IF garden_role_of(auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: super_admin only';
  END IF;
  INSERT INTO root_settings (key, value)
  VALUES (
    'leaf.image_download_password_hash',
    jsonb_build_object(
      'hash', new_hash,
      'updated_at', to_jsonb(now()),
      'updated_by', to_jsonb(auth.uid())
    )
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**前提**: Supabase では `pgcrypto` extension が有効（bcrypt の `crypt()`/`gen_salt('bf', 12)` を使用）。Dashboard で `CREATE EXTENSION IF NOT EXISTS pgcrypto;` を事前実行。
**代替**: client で bcryptjs（npm）を使って hash を生成し、検証は RPC で `crypt()` 比較する設計を採択。これにより平文が Supabase のログに残らない。

### 3.6 変更履歴記録（v3 新規、UI は別 spec）

#### 3.6.1 自動記録の仕組み

- §2.6.3 で定義した `leaf_kanden_attachments_history` テーブルに、`BEFORE UPDATE` / `BEFORE DELETE` trigger で自動記録
- 記録対象: `category` / `storage_url` / `thumbnail_url` / `is_guide_capture` / `is_post_added` / `ocr_processed` / `mime_type` / `archived_tier` / `archived_at` / `deleted_at` / `deleted_by`
- 物理 DELETE 時は `operation='DELETE'` / `old_value = OLD 行全体の JSON` / `changed_field = NULL` を記録（監査用）
- 現ユーザーは `auth.uid()` を `changed_by` に格納、SECURITY DEFINER で関数実行
- INSERT は現時点では記録対象外（A-1c では必要なし、Phase B の cross-audit-log 側で統合検討）

#### 3.6.2 RLS

- SELECT: 事業所属者（自事業の history のみ）+ admin / super_admin（全件横断可）
- INSERT / UPDATE / DELETE: FALSE（trigger 経由のみ、SECURITY DEFINER で昇格して INSERT）
- ログ改ざんの絶対防止（spec-cross-audit-log §2「UPDATE/DELETE 禁止」と整合）

#### 3.6.3 UI は A-1c スコープ外

- Kintone 風の「右側収納パネル」で画像ごとの変更履歴をタイムライン表示する UI は、**別 spec（Batch 14 横断履歴 UI）**で設計・実装
- A-1c では **データ層（テーブル + trigger + RLS）のみ** 用意
- 型（`AttachmentHistory`）は §2.6.6 で定義済、Batch 14 実装時にそのまま利用可能

#### 3.6.4 パフォーマンス配慮

- `idx_leaf_attachments_history_attachment (attachment_id, changed_at DESC)` で attachment_id ベースの履歴取得を O(log n)
- `idx_leaf_attachments_history_changed_by (changed_by, changed_at DESC)` で「誰が何をしたか」の人別履歴を高速化
- 1 UPDATE あたり最大 11 列を評価、変更なしなら INSERT しない（`IS DISTINCT FROM` 判定）
- 履歴テーブルの肥大化対策: Phase B で 2 年超の履歴を月次バッチで別テーブル（冷蔵層）へ退避する計画（本 spec スコープ外、§7 に Phase B 引継ぎとして記載）

---

## 4. テスト戦略

spec-cross-test-strategy §Leaf 🟡 通常厳格度との接続:
- 🟡 Leaf: Vitest + RTL+MSW（Playwright は Phase C）
- A-1c は **Vitest（§ 4.1）+ RTL+MSW（§ 4.2）+ 手動 RLS 検証（§ 4.3）** を実施
- Playwright E2E は A-1c スコープ外

### 4.1 Vitest ユニットテスト対象

#### `image-compression.ts`

| 関数 | 検証内容 |
|---|---|
| `compressImage(file, { maxWidth: 1500, quality: 0.85 })` | 長辺 1500px / 縦横比維持 / Blob size < 5MB / MIME image/jpeg |
| `generateThumbnail(file, { maxWidth: 300, quality: 0.70 })` | 長辺 300px / Blob size < 500KB |
| `convertHeicToJpeg(file)` | HEIC のみ変換 / 非 HEIC はそのまま通過 / 変換失敗で Error throw |
| `isHeicFile(file)` | MIME `image/heic` or 拡張子 .heic/.heif で true |

#### `attachments.ts`（v3 更新）

| 関数 | 検証内容 |
|---|---|
| `generateAttachmentId()` | UUID v4 形式 |
| `softDeleteAttachment(id)` | UPDATE deleted_at=now() + deleted_by=auth.uid()（**v3: Client ガードなし、全員可能**）|
| `undoSoftDelete(id)` | UPDATE deleted_at=NULL + deleted_by=NULL |
| `restoreAttachment(id)` | admin+ 復元（UNDO 期限後、Client ガード）|
| `hardDeleteAttachment(id)` | admin+ 物理削除（DB + Storage の両方、Client ガード）|
| `verifyUserPasswordAndDownload(id, password)` | **v3: DL 専用 PW を `verify_image_download_password` RPC で検証** → DL、3 回失敗 → 5 分ロック |
| `verifyImageDownloadPassword(password)` | **v3 新規**: RPC 呼出し、boolean 返す |
| `isMobileDevice()` | UA で iPhone/iPad/Android 判定 |
| `uploadAttachments(files, caseId, category, opts)` | 成功/失敗の分離集計 / リトライ 3 回 / 並列数制御 |
| `getCurrentGardenRole()` | `garden_role_of(auth.uid())` ラッパ、React context へ流す |

#### `kanden-storage-paths.ts`（全 pure function、mock 不要）

| 関数 | 検証内容 |
|---|---|
| `recentPath(caseId, attachmentId)` | `<case_id>/<attachment_id>.jpg` |
| `recentThumbPath(caseId, attachmentId)` | `<case_id>/thumb/<attachment_id>.jpg` |
| `monthlyPath(yyyymm, caseId, attachmentId)` | 型とパス規則は A-1c で確定、Phase B で利用 |
| `yearlyPath(yyyy, caseId, attachmentId)` | 同上 |

**カバレッジ目標**（spec-cross-test-strategy 準拠）:
- `image-compression`: **85%+**
- `attachments`: **75%+**
- `kanden-storage-paths`: **95%+**

### 4.2 RTL + MSW 範囲（UI 検証、v3 更新）

- **`AttachmentGrid.tsx`**: case_id クエリ / 削除済バッジ表示 / カテゴリ別タブ / signedURL 一括発行 + TTL 切れ再発行 / loading・error・empty / **v3: 全ロールで × 表示 + `AttachmentAdminActions` は admin+ のみ表示**
- **`AttachmentUploader.tsx`**: File drop + input 両対応 / カテゴリ必須 / HEIC 変換 / Canvas 圧縮 / 並列進捗 / beforeunload 登録解除
- **`AttachmentLightbox.tsx`**: モーダル表示 + 1500px signedURL 発行 / ESC・背景クリック close / ← → 遷移 / Tab フォーカス / DownloadButton の表示
- **`DownloadButton.tsx`**: PC 判定で即 DL、スマホ判定でパスワードモーダル / **v3: DL 専用 PW を RPC 検証** / 3 回失敗ロック / 成功時 DL
- **`AttachmentDeleteButton.tsx`**: **v3: ロール判定なし（全員表示）** / 確認ダイアログ文言更新（「管理者の最終確認を経て...」）/ 楽観的更新 + UNDO snackbar 5 秒 / UNDO クリックで復帰 / 5 秒経過で完全消失
- **`AttachmentAdminActions.tsx`**: 削除済カード上に admin+ 限定「復元」「完全削除」ボタン、強い確認ダイアログ、物理削除後の Storage remove 連動
- **`ImageDownloadPasswordPage.tsx`**（**v3 新規**、Root マイページ配下）: super_admin のみ表示、新旧 PW 比較入力 / 最低 8 文字 + 英数字混在 / bcryptjs で client hash → `set_image_download_password` RPC 呼出 / 成功トースト
- **`RoleContext.tsx`**（**v2 新規**）: `garden_role_of(auth.uid())` 結果を React context で全コンポーネント共有

**カバレッジ目標**: UI コンポーネント全体で **70%+**

### 4.3 手動 RLS 検証シナリオ（v2 改訂で拡張）

Supabase ローカル（`supabase start`）+ staging（garden-dev）の 2 段で手動検証し、結果を `docs/manual-rls-test-a1c-results.md` に記録。事前準備: テストユーザー 3 名（toss 役 / manager 役 / admin 役）を関電事業所属で作成。

| # | シナリオ | 期待 |
|---|---|---|
| 1 | **toss ユーザー**で関電案件 SELECT | 200 OK、削除済含む全件取得 |
| 2 | **関電非所属ユーザー**で関電案件 SELECT | 0 件（RLS block）|
| 3 | anon GET | 401 / 0 件 |
| 4 | **toss** で UPDATE deleted_at=now() 試行 | RLS はパスするが Client ガードでそもそも UI にボタンなし（直接 API 叩いた場合は成功してしまう → § 2.3 監査ログで検出、Phase B） |
| 5 | **toss** で UPDATE deleted_at=now() | **v3: 200 OK（全員可能化）** |
| 5b | **manager** で UPDATE deleted_at=now() | 200 OK（v3 も可能、v2 から変更なし）|
| 6 | **admin** で DELETE `leaf_kanden_attachments` | 200 OK（物理削除成功）|
| 7 | **manager** で DELETE | 403（admin+ のみ物理削除可能）|
| 8 | **契約終了済 outsource**（`contract_end_on` < today）で SELECT | 0 件（`is_user_active()` FALSE）|
| 9 | **toss** で `storage.upload(recent, ...)` | 200 |
| 10 | anon で `storage.upload(recent, ...)` | 403 |
| 11 | **toss** で `storage.remove([recent path])` | 403（admin+ のみ DELETE 可能）|
| 12 | **admin** で `storage.remove([recent path])` | 200 |
| 13 | **toss** で `storage.upload(monthly, ...)` | 403（read-only）|
| 14 | **toss** で `storage.createSignedUrl(monthly, ...)` | 200 |
| 15 | **削除済バッジ** が全ロールで可視 | 各ロールで grid 表示時に「削除済」バッジ確認 |
| 16 | 6MB ファイルを recent に upload | 413 Payload Too Large |
| 17 | .txt ファイルを recent に upload | 400（MIME 拒否）|
| 18 | **事業スコープ越境**: callcenter 所属ユーザーが kanden SELECT | 0 件（RLS block）|
| 19 | **admin の事業横断**: callcenter 所属 admin が kanden SELECT | 200 OK（`admin OR super_admin` が事業縛りを上書き）|
| 20 | **スマホ DL 専用 PW（v3）**: toss が Lightbox から DL、正しい PW で 200 / 誤 PW 3 回で 5 分ロック | UI 手動検証（RPC + sessionStorage）|
| 21 | **super_admin の DL PW 変更（v3 新規）**: Root マイページで旧 PW → 新 PW → 設定成功 → 新 PW で DL 成功 | RPC `set_image_download_password` + `verify_image_download_password` の連動 |
| 22 | **非 super_admin の DL PW 変更試行（v3 新規）**: admin が `set_image_download_password` RPC 呼出 | `Forbidden: super_admin only` Exception |
| 23 | **history trigger 動作（v3 新規）**: UPDATE deleted_at / UPDATE category で `leaf_kanden_attachments_history` に行が追加される | 変更列のみ記録、`changed_by = auth.uid()` |
| 24 | **history RLS（v3 新規）**: 事業所属外ユーザーで history SELECT | 0 件（RLS block）|
| 25 | **history 書込禁止（v3 新規）**: admin で直接 `INSERT INTO leaf_kanden_attachments_history` 試行 | RLS で拒否（trigger 経由のみ）|

### 4.4 test-utils / MSW handler の配置

a-main 念押し（Section 3 追加）反映:

- **事前確認**: Forest 側 `src/test-utils/supabase-mock.ts` の実在を確認。2026-04-25 時点で本ブランチ（feature/leaf-kanden-supabase-connect）および origin/develop, origin/feature/forest-phase-a, origin/feature/forest-v9-migration-plan-auto のいずれにも未存在。
- **A-1c での扱い**（2 分岐）:
  - 🟢 **実装開始時に Forest 側 mock が merge 済なら再利用**、不足機能（RLS 挙動 / storage PUT / `createSignedUrls` batch）は拡張
  - 🟡 **未実装のまま進む場合は Leaf が先頭バッターとして新設**:
    - `src/test-utils/supabase-mock.ts` … 横断共通 mock（RLS 簡易シミュレーション / Storage PUT mock / `createSignedUrl(s)` mock）
    - `src/test-utils/msw-handlers/` … MSW handler 集約ディレクトリ（Leaf / Forest / 他モジュールが共有可能な配置）
- **Leaf 固有 mock が必要になった場合**: `src/test-utils/leaf-storage-mock.ts` として分離、JSDoc で分離理由を明記

### 4.5 §16 7 種テストの該当項目

親 CLAUDE.md §16 の 7 種テストを A-1c に適用。

| # | テスト種 | A-1c 適用 | 具体内容 |
|---|---|---|---|
| 1 | 機能網羅 | ✅ | 全ボタン・入力・カテゴリ選択・upload/閲覧/削除/UNDO/復元/物理削除/DL の全線 |
| 2 | **エッジケース** | ✅✅ **優先** | 0 枚 upload / 16 枚（並列越え）/ 同時複数カテゴリ / 10MB 原本 / HEIC 変換不可 / network timeout 離脱 / 5MB 境界 / マルチバイトファイル名 / category 未選択 / **パスワード 3 回連続失敗 → 5 分ロック** |
| 3 | **権限** | ✅✅ **v2 で必須化** | 8 ロール × 事業所属/非所属/契約終了 3 状態 = 最低 10 シナリオ。§4.3 の 20 手動 RLS テスト + RTL ロール別 UI テストで網羅 |
| 4 | データ境界 | ✅ | category 不正 / 極大ファイル名 / マルチバイト / deleted_at 境界 / 論理削除→UNDO→再削除 / 物理削除→復元不可確認 |
| 5 | パフォーマンス | ✅ | 15 枚並列 upload / Grid 100 件 / signedURL 一括 / **`leaf_user_in_business` SECURITY DEFINER の呼出コスト** |
| 6 | コンソール監視 | ✅ | upload / Lightbox / 論理削除 / 物理削除 / DL 全フローで Error / Warning なし |
| 7 | アクセシビリティ | △ | axe-core で A-FMK1 同等。Lighthouse は Phase C |

A-1c 完了後、β版投入前に `docs/pre-release-test-YYYYMMDD-leaf-a1c.md` を起票して全 7 種結果を記録。

---

## 5. 実装ステップ（D → A → B 順、合計 6.7d、2026-04-25 v3 改訂）

**前提**: Root A-3-g（`is_user_active()` / `garden_role_of(uid)` / `outsource` / `contract_end_on`）は develop マージ済 ✅。Root A-3-h（kou_otsu 系、Leaf 影響小）は待機中でも本 spec の migration はブロックされない。

### 5.1 Phase D: 共通基盤（2.7d、v2 比 +0.2d = history trigger +0.3d / RLS 簡略化 -0.1d）

1. **Migration**:
   - `leaf_kanden_attachments.deleted_at` + `deleted_by` 追加 + 2 種インデックス
   - 新規 `leaf_businesses` + `leaf_user_businesses` テーブル
   - `leaf_user_in_business(biz_id)` 関数
   - **v3 新規**: `leaf_kanden_attachments_history` テーブル + `leaf_kanden_attachments_history_trigger()` 関数 + AFTER UPDATE/DELETE トリガ
   - **v3 新規**: `pgcrypto` extension 有効化 + `verify_image_download_password` / `set_image_download_password` RPC
   - **v3 新規**: `root_settings` に `leaf.image_download_password_hash` 初期投入（仮 hash）
   - 3 bucket 作成（recent / monthly / yearly）+ size / MIME 設定
   - RLS ポリシー（§ 2.3 v3 準拠、UPDATE 事業所属全員 / DELETE admin+ / history 書込禁止）
   - 初期データ投入: `leaf_businesses('kanden')` + 東海林さん super_admin 所属
2. **Supabase client 共通化**:
   - `src/lib/supabase/client.ts` 新設（§ 2.5 JSDoc 含む）
   - `src/app/leaf/_lib/supabase.ts` を re-export に縮小
3. **ロジック層ファイル新設**:
   - `src/app/leaf/_lib/attachments.ts`（upload / 論理削除 / UNDO / 復元 / 物理削除 / **v3: DL 専用 PW RPC 呼出** 全 10 関数）
   - `src/app/leaf/_lib/image-compression.ts` + `image-compression.worker.ts`
   - `src/app/leaf/_lib/kanden-storage-paths.ts`
   - `src/app/leaf/_lib/role-context.tsx`（v2、`garden_role_of` を全コンポで共有）
4. **heic2any** + **bcryptjs**（v3 追加、client 側 hash 生成用）npm 追加 + test 基盤（Task 0.x）
5. **test-utils**: § 4.4 の実在確認 → 再利用 or 新設（ロール / 事業所属 / **DL PW RPC** / **history trigger** mock）
6. **Vitest ユニットテスト** § 4.1 全件実装

### 5.2 Phase A: Backoffice 閲覧 + upload + 管理 UI（2.3d、v2 比 +0.3d = Root DL PW 設定 UI）

1. `RoleContext` provider を backoffice layout に配置
2. `AttachmentGrid.tsx`（カテゴリ別タブ、signedURL 一括発行、削除済バッジ表示、**v3: 全ロール × 表示**）
3. `AttachmentLightbox.tsx`（1500px 拡大、キーボードナビ、DownloadButton 組込）
4. `DownloadButton.tsx`（PC 即 DL / スマホ PW モーダル / **v3: DL 専用 PW RPC 検証** / 3 回失敗ロック）
5. `AttachmentUploader.tsx`（PC 向け drag&drop + file input、並列 3）
6. `AttachmentDeleteButton.tsx`（**v3: ロール判定なし（全員表示）** / 2 段確認 + UNDO 5 秒 / 文言「管理者の最終確認待ち」）
7. `AttachmentAdminActions.tsx`（admin+ 限定 復元/物理削除、v2 継続）
8. **v3 新規**: `src/app/root/me/image-download-password/page.tsx`（super_admin 限定 DL PW 設定 UI、Root マイページ配下、新旧 PW 入力 → bcryptjs hash → `set_image_download_password` RPC）
9. `src/app/leaf/backoffice/page.tsx` 組込（既存 A-FMK1 と整合）
10. **RTL + MSW テスト** § 4.2 全件実装（ロール別 UI テスト + **DL PW 設定 UI テスト** 含む）

### 5.3 Phase B: Input 撮影 UI（1.5d、v1 比 +0.5d）

1. `RoleContext` provider を input layout に配置
2. `src/app/leaf/input/page.tsx` 新設（A-1c で初期構築）
3. 営業向け upload UI（`<input type="file" accept="image/*" capture="environment">` でカメラ起動）
4. `MobileAttachmentUploader.tsx`（モバイル専用、並列 2）
5. `CategoryPicker.tsx`（大型タップターゲット、親指操作）
6. 既存 Backoffice コンポーネント再利用（`AttachmentGrid` / `AttachmentLightbox` / `DownloadButton`）
7. **スマホ DL パスワードの実機確認**（iPhone Safari / Android Chrome）
8. モバイル実機試験（撮影 → 圧縮 → upload → 削除 → DL 全線）

### 5.4 仕上げ（上記 3 Phase 内で並行実施）

- 手動 RLS 検証（§ 4.3）実施 + `docs/manual-rls-test-a1c-results.md` 起票
- §16 7 種テスト実施 + `docs/pre-release-test-YYYYMMDD-leaf-a1c.md` 起票
- `docs/effort-tracking.md` に D/A/B の実績追記

---

## 6. 判断保留事項（採択版一覧、v3 改訂）

| # | 論点 | 採択 |
|---|---|---|
| 1 | 圧縮失敗トースト文言 | 「画像の処理に失敗しました。別の画像で再試行してください。」 |
| 2 | HEIC 変換失敗トースト文言（A+C 合成版） | 「画像の形式変換に失敗しました。別の画像で再度お試しください。iPhone をお使いの方は iPhone の設定 → カメラ → フォーマット → 互換性優先 をご確認ください。」 |
| 3 | サムネ保存先 | 同一 bucket の `/thumb/<attachment_id>.jpg` prefix |
| 4 | beforeunload 文言 | ブラウザ既定（`event.preventDefault()` のみ） |
| 5 | 論理削除 UI 隔離 | **v3: 全ロール × 表示**（ホバー/長押し）、2 段確認 + UNDO snackbar、文言「管理者の最終確認待ち」 |
| 6 | 並列 upload 数 | モバイル 2 / PC 3、判定不能は PC 扱い（並列 3） |
| 7 | Web Worker 実装 | Next.js 標準 `new Worker(new URL(..., import.meta.url))` |
| 8 | 複数カテゴリ対応 | 1 upload = 1 カテゴリ、複数カテゴリは分けて upload |
| 9 | 5 カテゴリに合わない画像 | エラーでカテゴリ追加を促す（「その他」カテゴリを作らない）|
| 10 | UNDO snackbar 秒数 | 5 秒固定（β版 FB で調整可） |
| 11 | `navigator.connection` fallback | 判定不能は PC 扱い（並列 3） |
| 12 | **スマホ DL パスワード（v3 で方式確定）** | `root_settings.leaf.image_download_password_hash` を bcrypt 比較（RPC）、全員共通 1 本、super_admin が管理、3 回失敗で 5 分ロック（sessionStorage カウント） |
| 13 | 削除済バッジ可視範囲 | 全ロール可視（誤削除認識用）、Lightbox open は block、admin のみ「復元」「物理削除」ボタン表示 |
| 14 | **UNDO と admin 復元の使い分け（v3 更新）** | UNDO = 自分が削除直後の 5 秒以内（全員）／復元 = 任意時刻の論理削除取消（admin+ 限定） |
| 15 | **論理削除権限（v3 確定化）** | **全員可能化**（事業所属者かつ `is_user_active()`）。Garden 全モジュール共通パターン、Kintone 運用の admin 削除依頼集中を解消 |
| 16 | **画像 DL PW 方式（v3 新規）** | 専用 PW（`root_settings` + bcrypt）、super_admin 設定、定期ローテ（月次 or 四半期、Chatwork 通知） |
| 17 | **history trigger の INSERT 記録（v3 新規）** | A-1c では未記録（UPDATE/DELETE のみ）。INSERT 記録は Phase B の cross-audit-log で統合対応 |
| 18 | **history テーブル肥大化対策（v3 新規）** | A-1c ではインデックスのみ（`attachment_id,changed_at DESC` + `changed_by,changed_at DESC`）。2 年超の冷蔵層退避は Phase B バッチで対応 |

---

## 7. Phase B への引継ぎ事項

### 7.1 Orphan ファイル cleanup（a-main 念押し反映）

**検出クエリ**:
```sql
SELECT o.name, o.created_at
FROM storage.objects o
WHERE o.bucket_id = 'leaf-kanden-photos-recent'
  AND o.created_at < now() - interval '10 minutes'   -- upload race 対策
  AND NOT EXISTS (
    SELECT 1 FROM leaf_kanden_attachments a
    WHERE a.storage_url = o.name OR a.thumbnail_url = o.name
  );
```

**検出タイミング**: 週次 or 月次 Cron（spec-cross-storage §10.1 の storage-cleanup と統合可）
**誤削除防止**: upload から 10 分以内の path は orphan 扱いしない
**同時処理**: `deleted_at NOT NULL AND deleted_at < now() - interval '30 days'` 行の物理削除と同バッチで実行

### 7.2 事業マスタ UI（Phase B-1）

- `leaf_businesses` / `leaf_user_businesses` の CRUD 画面（admin / super_admin 限定）
- 事業追加（コールセンター / ブレーカー 等、関電以外の Leaf 事業）
- ユーザー × 事業 の所属管理 UI
- 所属解除（`removed_at` 設定）時の UI 通知
- 現状（A-1c）は Supabase Dashboard 手動投入

### 7.2b 変更履歴 UI（Batch 14 横断履歴 UI spec、Leaf A-1c 後）

- Kintone 風の右側収納パネル（画像クリック時にスライドイン）
- タイムライン形式で `leaf_kanden_attachments_history` の行を表示
- 「誰が・いつ・何を」変更したか、old → new の差分表示
- 横断 spec として Bud / Forest / Tree 等も同型で対応
- A-1c ではデータ層のみ用意、UI は別 spec で
- 別途 a-auto で Batch 14 spec を起草予定（Leaf A-1c 実装完了後）

### 7.2c DL 専用パスワードの運用ローテ（v3 新規）

- super_admin が月次 or 四半期で変更推奨
- 変更時は東海林さんから Chatwork / 社内メールで全員通知
- `root_settings` の `leaf.image_download_password_hash` は平文を持たない（bcrypt hash のみ）
- 変更履歴は `value->>'updated_at'` / `value->>'updated_by'` で追跡
- Phase B-1 で PW 自動期限切れ（例: 90 日経過で super_admin に変更促すバナー）を検討

### 7.3 3 階層移行バッチ（TimeTree 運用との整合）

- recent → monthly PDF 集約（3 ヶ月超）
- monthly → yearly PDF 集約（12 ヶ月超）
- **TimeTree からの既存画像移行**: TimeTree API 制約のため自動移行困難
  - 案 1: 事務担当が TimeTree から手動 DL → Garden へ upload
  - 案 2: 新規案件は Garden のみ、過去案件は TimeTree 閲覧継続
  - Phase B 着手時に a-main 経由で東海林さんと再相談

### 7.4 OCR 処理

- `KandenAttachment.ocr_processed` 予約項目を活用
- Edge Function 経由で Vision API 等を呼び出し、諸元抽出結果を `soil_kanden_cases.ocr_*` に格納
- A-1c の client 主導アーキとは独立した Edge 層で実装

### 7.5 Lightbox 機能拡張

- 原本ダウンロード / 他形式エクスポート / 画像回転 / 輝度調整
- β版 FB に基づいて追加要否判断

### 7.6 UNDO snackbar 秒数調整

- A-1c で 5 秒固定、β版 UX 試験で 7 秒 / 10 秒等に調整可能

### 7.7 物理削除バッチ

- 論理削除から 30 日経過した row の物理削除
- 対応する Storage オブジェクトも物理削除
- § 7.1 Orphan cleanup と同じバッチで実行

---

## 8. Migration SQL スケルトン（2026-04-25 v3 改訂）

**配置先**: `scripts/leaf-schema-patch-a1c.sql`（Garden 慣習、Supabase Dashboard > SQL Editor で手動実行）

**前提**: Root A-3-g migration（`scripts/root-schema-patch-a3g.sql`）が先行実行済みで、以下が利用可能:
- `is_user_active()` / `garden_role_of(uid uuid)` 関数
- `garden_role` enum に `outsource` 追加済
- `root_employees.contract_end_on` 列追加済
- `root_settings (key text PK, value jsonb)` テーブル（未存在なら Root 側で先行作成依頼）
- `pgcrypto` extension 有効化済 or 本 migration 冒頭で `CREATE EXTENSION IF NOT EXISTS pgcrypto`

```sql
-- File: scripts/leaf-schema-patch-a1c.sql
-- ============================================================
-- Garden-Leaf A-1c 添付ファイル機能 v3 migration
-- Run this in Supabase Dashboard > SQL Editor
-- Spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §8 (v3)
-- Depends on: Root A-3-g (is_user_active, garden_role_of), root_settings テーブル
-- ============================================================

-- ===== 0. 拡張機能 (v3 新規: bcrypt 互換の pgcrypto) =====
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

-- ===== 3. 事業所属判定関数 =====
CREATE OR REPLACE FUNCTION leaf_user_in_business(biz_id text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM leaf_user_businesses
    WHERE user_id = auth.uid()
      AND business_id = biz_id
      AND (removed_at IS NULL OR removed_at > now())
  ) AND is_user_active();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION leaf_user_in_business(text) IS
  'auth.uid() が指定事業に有効所属し、かつ is_user_active() が TRUE を返すかを判定';

-- ===== 4. 3 bucket 作成（idempotent）=====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('leaf-kanden-photos-recent',  'leaf-kanden-photos-recent',  false,  5242880, ARRAY['image/jpeg','image/png','image/heic']),
  ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-monthly', false, 52428800, ARRAY['application/pdf']),
  ('leaf-kanden-photos-yearly',  'leaf-kanden-photos-yearly',  false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ===== 5. RLS 有効化 =====
ALTER TABLE leaf_kanden_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaf_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaf_user_businesses ENABLE ROW LEVEL SECURITY;

-- ===== 6. leaf_kanden_attachments ポリシー（8 ロール × 事業スコープ）=====
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

-- v3 簡略化: UPDATE は事業所属者全員可能。論理削除も Client ガードなしで全員が実行可能。
-- 監査は leaf_kanden_attachments_history trigger（§ 2.6.3）で自動記録。
DROP POLICY IF EXISTS leaf_attachments_update ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_update ON leaf_kanden_attachments
  FOR UPDATE USING (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  ) WITH CHECK (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- 物理 DELETE: admin / super_admin のみ
DROP POLICY IF EXISTS leaf_attachments_delete ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_delete ON leaf_kanden_attachments
  FOR DELETE USING (
    garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- ===== 7. leaf_businesses ポリシー（SELECT 全員、CUD は admin+）=====
DROP POLICY IF EXISTS leaf_businesses_select ON leaf_businesses;
CREATE POLICY leaf_businesses_select ON leaf_businesses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_businesses_write ON leaf_businesses;
CREATE POLICY leaf_businesses_write ON leaf_businesses
  FOR ALL USING (garden_role_of(auth.uid()) IN ('admin', 'super_admin'))
          WITH CHECK (garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- ===== 8. leaf_user_businesses ポリシー（SELECT 自分+admin、CUD は admin+）=====
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

-- ===== 9. recent bucket ポリシー =====
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

-- ===== 10. monthly / yearly bucket ポリシー（A-1c では read-only）=====
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

-- ===== 11. 変更履歴テーブル + trigger（v3 新規、§ 2.6.3）=====
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
  'Attachment 変更履歴 (v3)。UPDATE/DELETE 自動記録、UI は Batch 14 横断履歴 spec';

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_history_attachment
  ON leaf_kanden_attachments_history (attachment_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_history_changed_by
  ON leaf_kanden_attachments_history (changed_by, changed_at DESC);

CREATE OR REPLACE FUNCTION leaf_kanden_attachments_history_trigger()
RETURNS trigger AS $$
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
    INSERT INTO leaf_kanden_attachments_history
      (attachment_id, operation, changed_field, old_value, new_value, changed_by)
    VALUES (OLD.attachment_id, 'DELETE', NULL,
            to_jsonb(OLD)::text, NULL, auth.uid());
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH col_name IN ARRAY tracked_cols LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col_name, col_name)
        USING OLD, NEW INTO old_val, new_val;
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO leaf_kanden_attachments_history
          (attachment_id, operation, changed_field, old_value, new_value, changed_by)
        VALUES (NEW.attachment_id, 'UPDATE', col_name, old_val, new_val, auth.uid());
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_leaf_kanden_attachments_history ON leaf_kanden_attachments;
CREATE TRIGGER trg_leaf_kanden_attachments_history
  AFTER UPDATE OR DELETE ON leaf_kanden_attachments
  FOR EACH ROW EXECUTE FUNCTION leaf_kanden_attachments_history_trigger();

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

-- 書込禁止（trigger の SECURITY DEFINER で昇格して INSERT される）
DROP POLICY IF EXISTS leaf_history_no_write ON leaf_kanden_attachments_history;
CREATE POLICY leaf_history_no_write ON leaf_kanden_attachments_history
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- ===== 12. 画像 DL 専用パスワード RPC（v3 新規、§ 2.6.4 / § 3.5.5）=====
CREATE OR REPLACE FUNCTION verify_image_download_password(input_password text)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT value->>'hash' INTO stored_hash
  FROM root_settings
  WHERE key = 'leaf.image_download_password_hash';
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_image_download_password(new_hash text)
RETURNS void AS $$
BEGIN
  IF garden_role_of(auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: super_admin only';
  END IF;
  INSERT INTO root_settings (key, value)
  VALUES (
    'leaf.image_download_password_hash',
    jsonb_build_object(
      'hash', new_hash,
      'updated_at', to_jsonb(now()),
      'updated_by', to_jsonb(auth.uid())
    )
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== 13. 初期データ投入 =====
INSERT INTO leaf_businesses (business_id, display_name, product_type, flow_type, start_date)
VALUES ('kanden', '関電業務委託', '電気', '委託', '2020-01-01')
ON CONFLICT (business_id) DO NOTHING;

-- v3 新規: 画像 DL 専用パスワード初期値（仮 PW、super_admin が Dashboard or UI で即変更）
-- 平文 "change-me-immediately" を bcrypt (rounds=12) でハッシュ化
INSERT INTO root_settings (key, value)
VALUES (
  'leaf.image_download_password_hash',
  jsonb_build_object(
    'hash', crypt('change-me-immediately', gen_salt('bf', 12)),
    'updated_at', to_jsonb(now()),
    'updated_by', NULL
  )
)
ON CONFLICT (key) DO NOTHING;

-- NOTE: 東海林さんの super_admin + 関電所属登録は、実 user_id を置換して個別実行：
-- INSERT INTO leaf_user_businesses (user_id, business_id, role_in_biz, assigned_by)
-- VALUES ('<東海林さんの user_id>', 'kanden', 'super_admin', '<東海林さんの user_id>')
-- ON CONFLICT (user_id, business_id) DO NOTHING;
--
-- super_admin ログイン後、すぐに Root マイページの「画像ダウンロード専用パスワード」
-- タブから本番 PW を設定する（仮 PW は即変更必要）。
```

---

## 9. 参考資料

### 9.1 横断 spec（PR #25、`docs/specs/cross-cutting/`）

- spec-cross-rls-audit.md … § 2 パターン A 準拠、§ 8 W1 「client.ts 新設」を Leaf 先行
- spec-cross-storage.md … § 2 命名規則、§ 4.1 size、§ 5.1 MIME、§ 6.1 Pattern-1、§ 7.1 TTL、§ 8 bucket 一覧
- spec-cross-test-strategy.md … § Leaf 🟡 通常厳格度
- spec-cross-chatwork.md … 案 D（署名 URL 不流通、Garden ログイン経由）

### 9.2 依存 spec（Root 側）

- **Root A-3-g**（`feature/root-phase-a3-g-employees-outsource-extension`）… `is_user_active()` / `garden_role_of(uid)` / `outsource` ロール / `contract_end_on` 列。本 spec v2 の実装は A-3-g マージ後に着手。

### 9.3 既存 Leaf 実装

- `src/app/leaf/_lib/types.ts:115-140` … `KandenAttachment` / `AttachmentCategory` 既定義
- `src/app/leaf/_lib/supabase.ts` … § 2.5 で re-export に縮小
- `src/app/leaf/_lib/auth.ts` … Leaf ログイン（社員番号 + PW 合成メール、5 分ロック）
- `src/app/leaf/backoffice/page.tsx` … A-FMK1 キーボードショートカット既実装

### 9.4 参照資料（G ドライブ）

- `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\04_Garden-Leaf\001_関西電力業務委託\`
  - `garden-leaf-kanden-backoffice-v8_20260421120000.html`（事務 PoC）
  - `garden-leaf-kanden-input-v10_20260420160000.html`（営業 PoC）
  - `DB設計_取引マスタ_v2_20260420.md`
  - `supabase_migration_v1_20260420.sql`
  - `supabase_dev_policies_20260422.sql`

### 9.5 MEMORY.md エントリ

- `project_kanden_workflow` … 8 段階ステータス / 5 カテゴリ添付 / 諸元後付けフロー
- `project_kanden_photo_storage` … 3 階層保管 / 1500px/JPEG85% / スマホ検索
- `project_garden_filemaker_ux` … Ctrl+F 等
- `feedback_no_multiple_choice` … AskUserQuestion 禁止
- `feedback_garden_execution_style` … subagent-driven-development 優先

---

## 10. 変更履歴

| 日付 | 変更 | 実施者 |
|---|---|---|
| 2026-04-22 | A-1c ブレスト起案（a-leaf → b-main 引継ぎ） | a-leaf / b-main |
| 2026-04-23 | Q1-Q2 提示、Q2 で中断 | a-leaf |
| 2026-04-25 (初版) | Q2 採択（3 バケット）、Q3-Q8 完走、Section 1-3 承認、spec 起票 | a-leaf |
| 2026-04-25 (v2 改訂) | a-main 指示で大改訂: 8 ロール分岐前倒し / 事業スコープ / 画像 DL パスワード（スマホ限定）/ 削除ロール別表示 + 削除済バッジ / 物理削除 UI / HEIC 文言 A+C 合成。Root A-3-g 依存。見積 4.0d → 6.0d | a-leaf |
| **2026-04-25 (v3 改訂)** | **東海林さん業務レビュー回答で確定化: 論理削除を全員可能化（Garden 共通パターン、Kintone 運用改善）/ DL 専用 PW 方式（root_settings + bcrypt、super_admin 管理、定期ローテ）/ 変更履歴 trigger 準備（UI は Batch 14 別 spec）/ ロール × 操作マトリクス簡略化。見積 6.0d → 6.7d** | **a-leaf** |

---

## 11. 差分サマリ（レビューア向け早見表）

### 11.1 v1 → v2 → v3 比較

| 項目 | v1 (初版) | v2 (改訂) | v3 (改訂) |
|---|---|---|---|
| **スコープ** | 認証済み = 全員同権（Q4 A 案）| 8 ロール × 事業スコープ（Q4 B+ 案）| v2 継続 |
| **論理削除権限** | 全員可 | **manager+ のみ** | **全員可（Garden 共通パターン）** |
| **物理削除権限** | なし（Phase B 送り） | admin / super_admin | admin / super_admin（v2 継続） |
| **テーブル数** | 1 本拡張 | +2 本（leaf_businesses / leaf_user_businesses） | **+1 本（leaf_kanden_attachments_history、計 +3 本）** |
| **RLS UPDATE** | `auth.uid() IS NOT NULL` | 事業所属 OR admin + Client で manager+ ガード | **事業所属 OR admin（Client ガード撤廃、全員可）** |
| **削除済表示** | UI から消す | 「削除済」バッジで全員可視 | v2 継続 |
| **画像 DL** | signedURL で誰でも DL | **Garden ログイン PW 検証** | **DL 専用 PW（root_settings + bcrypt）** |
| **DL PW 管理** | — | 個人別 | **super_admin 一元管理 + 定期ローテ** |
| **変更履歴記録** | なし | なし | **history テーブル + trigger（UI は Batch 14 別 spec）** |
| **HEIC 文言** | iPhone 前提 | A+C 合成版 | v2 継続 |
| **外注契約管理** | なし | `is_user_active()` 経由 | v2 継続 |
| **見積** | 4.0d | 6.0d (+2.0d) | **6.7d (+0.7d)** |
| **migration path** | `supabase/migrations/` （誤）| `scripts/leaf-schema-patch-a1c.sql` | v2 継続 |
| **依存** | なし | Root A-3-g | **Root A-3-g（済）+ root_settings + pgcrypto** |
| **判断保留** | 11 件 | 15 件 | **18 件（#15-18 確定化/新規）** |
| **Phase B 引継** | ロール強化 / 移行バッチ / Lightbox 拡張 | 事業マスタ UI / 移行バッチ / Lightbox 拡張 / UNDO 秒数 | v2 継続 + **変更履歴 UI（Batch 14）/ DL PW 自動期限切れ** |

### 11.2 v3 で追加された主要変更点

**1. 論理削除の全員可能化（業務根拠）**
- Kintone 運用: 営業が admin に削除依頼 → admin の負担集中、対応遅延 → 現場フラストレーション
- Garden v3: 営業が自分で論理削除（= 削除依頼と同義） → admin は休日明けにまとめて物理削除 or 復元
- 結果: admin のリアクティブ負荷を削減、営業の UX 改善

**2. 画像 DL 専用 PW（セキュリティ + 運用）**
- Garden ログイン PW を DL 認証に流用すると、PW 変更が個人の勝手になり管理不能
- v3: 共通 1 本を super_admin が管理、bcrypt で保存、定期ローテ（社内通知運用）
- 結果: PW 漏洩リスク時に 1 本変えれば全員影響、運用負荷が中央化

**3. 変更履歴 trigger（監査 + Kintone 風 UI 準備）**
- BEFORE UPDATE / DELETE trigger で `who/when/field/old/new` を自動記録
- UI は別 spec（Batch 14 横断履歴 UI）で Kintone 風右側パネル実装
- 結果: 「誰が削除したか」の追跡、監査ログ、将来の復元判断の根拠に利用可能
