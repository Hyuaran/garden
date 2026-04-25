# Garden-Leaf 関電業務委託 A-1c: 添付ファイル機能 設計書

- 優先度: 🔴 高（Phase A 必須、Leaf 関電業務委託の中核機能）
- 見積: **6.0d**（D 共通基盤 2.5d + A Backoffice 2.0d + B Input 1.5d）※ 2026-04-25 改訂で +2.0d（ロール分岐前倒し / 事業スコープ / 画像 DL パスワード / 削除バッジ追加）
- 実装順: **D → A → B**（Q2 採択で確定）
- 作成: 2026-04-23 起草 / 2026-04-25 初版確定 / **2026-04-25 v2 改訂**（a-main 指示でスコープ拡大）
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

### 1.2 スコープ（A-1c 改訂版）
- 閲覧（サムネ一覧 + 1500px 拡大ライトボックス）
- アップロード（選択/撮影 → Canvas 圧縮 → Supabase Storage 直接 PUT）
- 圧縮（1500px JPEG85% 本体 + 300px JPEG70% サムネ）
- サムネ生成（同時生成、事前保存）
- 論理削除 + UNDO snackbar 5 秒
- **物理削除 UI + 復元機能**（admin / super_admin 限定、**新規追加**）
- **削除済バッジ**（論理削除済データを一覧に可視化、誤削除認識用）
- HEIC → JPEG 変換（iPhone 撮影対応、文言は A+C 合成版）
- **ロール分岐 RLS（8 段階 `garden_role` enum）**（**新規追加**、Root A-3-g 依存）
- **事業スコープ制御**（`leaf_businesses` / `leaf_user_businesses` / `leaf_user_in_business()`、**新規追加**）
- **画像 DL パスワード（スマホのみ）**（Lightbox + DownloadButton、**新規追加**）
- **契約終了日による外注営業の自動アクセス遮断**（`is_user_active()` 経由、**新規追加**）

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

### 1.5 ロール × 操作マトリクス（v2 改訂の核心）

8 段階 `garden_role` enum（Root A-3-g 定義）:
`toss` / `closer` / `cs` / `staff` / `outsource` / `manager` / `admin` / `super_admin`

| 操作 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 閲覧（サムネ + Lightbox）| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| Upload | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| Metadata 編集（カテゴリ変更等）| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| **論理削除** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅※ | ✅ | ✅ |
| **UNDO（論理削除の取消）**| ❌ | ❌ | ❌ | ❌ | ❌ | ✅※ | ✅ | ✅ |
| **物理削除 + 復元（削除済バッジ UI）**| ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **画像ダウンロード（PC）**| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |
| **画像ダウンロード（スマホ、要 Garden パスワード）**| ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅※ | ✅ | ✅ |

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

-- UPDATE: メタ編集は事業所属者全員、論理削除（deleted_at 更新）は manager+
-- 実装上 UPDATE ポリシーでは列単位制御は複雑なので、論理削除は Client 側で
-- ロールガード + 本ポリシーは事業所属のみ許可の 2 段構えとする
CREATE POLICY leaf_attachments_update ON leaf_kanden_attachments
  FOR UPDATE USING (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  ) WITH CHECK (
    leaf_user_in_business('kanden')
    OR garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );

-- DELETE（物理削除）: admin / super_admin のみ
CREATE POLICY leaf_attachments_delete ON leaf_kanden_attachments
  FOR DELETE USING (
    garden_role_of(auth.uid()) IN ('admin', 'super_admin')
  );
```

**論理削除のロール制御**（UPDATE の列単位制御が RLS で困難なため 2 段構え）:
1. **RLS** は事業所属チェックのみ（SELECT / INSERT / UPDATE / DELETE）
2. **Client 側** （`softDeleteAttachment()` / 削除ボタン表示）で `garden_role_of()` を事前に取得し、manager 未満には削除 UI 自体を表示しない
3. 悪意ある直接 UPDATE で `deleted_at` を操作する余地はあるが、社内専用ツール前提で運用規律 + 監査ログ（Phase B cross-audit-log）で検出する

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

#### 2.6.3 インデックス

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

#### 2.6.4 TypeScript 型（`src/app/leaf/_lib/types.ts` 追加）

既存 `KandenAttachment` 型に以下追加:
- `deleted_at: string | null`（v1 から継続）
- `deleted_by: string | null`（v2 新規、RLS 監査用）

新規型:
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
```

既存 `KandenAttachment` の他フィールドはそのまま（5 カテゴリ / 3 階層 / サムネ / OCR 予約 / uploaded_by/at / archived_at）。

#### 2.6.5 初期データ投入（migration 直後に Supabase Dashboard 手動実行）

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

### 3.4 削除フロー（ロール別表示 + バッジ + 物理削除、2026-04-25 v2 改訂）

#### 3.4.1 ロール別削除 UI 表示

| ロール | × ボタン表示 | 論理削除 | UNDO | 物理削除 | 復元 |
|---|:---:|:---:|:---:|:---:|:---:|
| toss / closer / cs / staff / outsource | ❌ 非表示 | ❌ | — | ❌ | ❌ |
| manager | ✅ ホバー/長押し表示 | ✅ | ✅ | ❌ | ❌ |
| admin / super_admin | ✅ 常時表示 | ✅ | ✅ | ✅ | ✅ |

**Client 側のロール判定**:
- Grid マウント時に `garden_role_of(auth.uid())` で現在ロールを取得（React context に保持）
- 各 AttachmentCard は role に応じて削除ボタンの表示/非表示を決定
- 悪意ある直接 UPDATE は RLS が「事業所属 OR admin」で防ぐ（§ 2.3 の補足）

#### 3.4.2 削除済バッジ（v2 新規、全員可視）

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

#### 3.4.3 manager+ の論理削除フロー

```
1. × クリック（manager 以上のみ表示）
   ↓
2. 確認ダイアログ
   ┌─────────────────────────────────┐
   │ この画像を削除しますか？          │
   │ （削除済一覧に残り、管理者が復元可能）│
   │                                 │
   │      [キャンセル]  [削除する]    │
   └─────────────────────────────────┘
   ↓ [削除する]
3. 楽観的更新: UI で対象カードを「削除済バッジ」表示へ切替
   ↓
4. UPDATE leaf_kanden_attachments
   SET deleted_at = now(), deleted_by = auth.uid()
   WHERE attachment_id = ?
   ↓
5. UNDO snackbar (5 秒、固定)
   ┌─────────────────────────────────┐
   │ 画像を削除しました  [元に戻す]   │
   └─────────────────────────────────┘
   ↓ [元に戻す] クリック (5 秒以内、自分が削除したものに限る)
6. UPDATE deleted_at = NULL, deleted_by = NULL → grid 通常表示に復帰
```

**UNDO 秒数**: 5 秒固定、β版 UX 試験で変更可（§ 7.6）。
**UNDO 権限**: 自分が削除した直後（同セッション内）のみ有効、5 秒経過 or 画面離脱で失効。

#### 3.4.4 admin の物理削除 + 復元 UI（v2 新規）

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

**物理削除フロー**:
1. [完全削除] クリック → 強い確認ダイアログ「**完全に削除します。この操作は取り消せません。** 本当に削除しますか？」→ [完全削除する]
2. `DELETE FROM leaf_kanden_attachments WHERE attachment_id = ?`
3. Storage からも `supabase.storage.from('leaf-kanden-photos-recent').remove([path, thumbPath])`
4. 失敗時: トースト表示、DB と Storage のズレは Phase B cleanup job（§ 7.1）で補正

**API**（`attachments.ts` に追加）:
- `softDeleteAttachment(id)` / `undoSoftDelete(id)` — manager+
- `restoreAttachment(id)` — admin+（論理削除取消、UNDO snackbar 期限後）
- `hardDeleteAttachment(id)` — admin+（DB + Storage 物理削除）

### 3.5 Lightbox 仕様 + 画像ダウンロード（スマホは要パスワード、2026-04-25 v2 改訂）

#### 3.5.1 基本表示（v1 から継続）

- `<img src={signedURL}>` + CSS（backdrop + 中央配置）、Canvas 不要
- ESC / 背景クリックで close
- ← → キーで前後画像遷移（同 case の attachment 一覧内）
- Tab キーで UI 操作可能（A-FMK1 キーボード操作 UX 準拠）

#### 3.5.2 ダウンロードボタン（v2 新規）

Lightbox に `DownloadButton` を追加。デバイス判定でフロー分岐:

```
[PC 判定 = !isMobileUA]
  クリック → signedURL から直接 DL（即座、パスワード不要）

[Mobile 判定 = isMobileUA]
  クリック → パスワードモーダル
    「画像をダウンロードします。Garden パスワードを入力してください。」
    [入力欄 type=password]
    [キャンセル] [ダウンロードする]
      ↓ [ダウンロードする]
  1. supabase.auth.signInWithPassword({ email: 現ユーザーのメール, password: 入力値 })
     ← セッション更新（RLS 影響なし、本人確認のみ）
  2. 成功 → signedURL から DL
  3. 失敗 → 「パスワードが一致しません」トースト、3 回失敗で画面ロック 5 分
```

**デバイス判定**（`image-compression.ts` の `getUploadConcurrency()` と同じ手法）:
```typescript
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
```

**なぜスマホだけパスワード**:
- 社内 PC は入退室管理 + 画面ロックで物理的に保護される
- スマホは紛失・一時貸与時の漏洩リスクが高い → 画像 DL のような「持出」操作には本人確認を追加
- 閲覧（Lightbox 表示）はパスワード不要、**DL（保存）** のみパスワード要求

**API**（新設）:
- `attachments.ts`: `verifyUserPasswordAndDownload(attachmentId, password): Promise<void>`
  - 内部で `signInWithPassword` + `createSignedUrl` + `fetch` でダウンロード
  - ロック状態（3 回失敗）は sessionStorage でカウント、5 分経過で自動解除

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

#### `attachments.ts`

| 関数 | 検証内容 |
|---|---|
| `generateAttachmentId()` | UUID v4 形式 |
| `softDeleteAttachment(id)` | UPDATE deleted_at=now() + deleted_by=auth.uid()（manager+ Client ガード付き）|
| `undoSoftDelete(id)` | UPDATE deleted_at=NULL + deleted_by=NULL |
| `restoreAttachment(id)` | admin+ 復元（UNDO 期限後）|
| `hardDeleteAttachment(id)` | admin+ 物理削除（DB + Storage の両方）|
| `verifyUserPasswordAndDownload(id, password)` | スマホ時パスワード認証 → DL、3 回失敗 → ロック |
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

### 4.2 RTL + MSW 範囲（UI 検証、v2 改訂で追加コンポーネント含む）

- **`AttachmentGrid.tsx`**: case_id クエリ / 削除済バッジ表示（deleted_at IS NOT NULL）/ カテゴリ別タブ / signedURL 一括発行 + TTL 切れ再発行 / loading・error・empty / ロール別削除 UI 表示（toss〜staff は × 非表示、manager+ は表示）
- **`AttachmentUploader.tsx`**: File drop + input 両対応 / カテゴリ必須 / HEIC 変換 / Canvas 圧縮（Happy DOM + Canvas mock）/ 並列進捗 / beforeunload 登録解除
- **`AttachmentLightbox.tsx`**: モーダル表示 + 1500px signedURL 発行 / ESC・背景クリック close / ← → 遷移 / Tab フォーカス / **DownloadButton の表示**
- **`DownloadButton.tsx`**（**v2 新規**）: PC 判定で即 DL、スマホ判定でパスワードモーダル / 3 回失敗ロック / 成功時 DL
- **`AttachmentDeleteButton.tsx`**: ロール判定で × 表示 / 確認ダイアログ / 楽観的更新 + UNDO snackbar 5 秒 / UNDO クリックで復帰 / 5 秒経過で完全消失
- **`AttachmentAdminActions.tsx`**（**v2 新規**）: 削除済カード上に admin+ 限定「復元」「完全削除」ボタン、強い確認ダイアログ、物理削除後の Storage remove 連動
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
| 5 | **manager** で UPDATE deleted_at=now() | 200 OK、ただし自分の事業所属分のみ |
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
| 20 | **スマホ DL パスワード**: manager が Lightbox から DL、正しい PW で 200 / 誤 PW 3 回で 5 分ロック | UI 手動検証（API + sessionStorage）|

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

## 5. 実装ステップ（D → A → B 順、合計 6.0d、2026-04-25 v2 改訂）

**前提**: Root A-3-g（`is_user_active()` / `garden_role_of(uid)` / `outsource` ロール / `contract_end_on` 列）が develop にマージ済みであること。未マージならブロック。

### 5.1 Phase D: 共通基盤（2.5d、v1 比 +1.0d）

1. **Migration**:
   - `leaf_kanden_attachments.deleted_at` + `deleted_by` 追加 + 2 種インデックス
   - 新規 `leaf_businesses` + `leaf_user_businesses` テーブル
   - `leaf_user_in_business(biz_id)` 関数
   - 3 bucket 作成（recent / monthly / yearly）+ size / MIME 設定
   - RLS ポリシー（§ 2.3 準拠、8 ロール × 事業スコープ版）
   - 初期データ投入: `leaf_businesses('kanden')` + 東海林さん super_admin 所属
2. **Supabase client 共通化**:
   - `src/lib/supabase/client.ts` 新設（§ 2.5 JSDoc 含む）
   - `src/app/leaf/_lib/supabase.ts` を re-export に縮小
3. **ロジック層ファイル新設**:
   - `src/app/leaf/_lib/attachments.ts`（論理削除 / UNDO / 復元 / 物理削除 / パスワード DL 全 9 関数）
   - `src/app/leaf/_lib/image-compression.ts` + `image-compression.worker.ts`
   - `src/app/leaf/_lib/kanden-storage-paths.ts`
   - `src/app/leaf/_lib/role-context.tsx`（**v2 新規**、`garden_role_of` を全コンポで共有）
4. **heic2any** npm 追加（Q6.1 承認済）+ test 基盤（Task 0.x）
5. **test-utils**: § 4.4 の実在確認 → 再利用 or 新設（ロール mock + 事業所属 mock 含む）
6. **Vitest ユニットテスト** § 4.1 全件実装

### 5.2 Phase A: Backoffice 閲覧 + upload + 管理 UI（2.0d、v1 比 +0.5d）

1. `RoleContext` provider を backoffice layout に配置
2. `AttachmentGrid.tsx`（カテゴリ別タブ、signedURL 一括発行、削除済バッジ表示、ロール別削除 UI）
3. `AttachmentLightbox.tsx`（1500px 拡大、キーボードナビ、DownloadButton 組込）
4. `DownloadButton.tsx`（**v2 新規**、PC 即 DL / スマホ PW モーダル / 3 回失敗ロック）
5. `AttachmentUploader.tsx`（PC 向け drag&drop + file input、並列 3）
6. `AttachmentDeleteButton.tsx`（ロール判定で表示制御、2 段確認 + UNDO 5 秒）
7. `AttachmentAdminActions.tsx`（**v2 新規**、admin+ 限定 復元/物理削除）
8. `src/app/leaf/backoffice/page.tsx` 組込（既存 A-FMK1 と整合）
9. **RTL + MSW テスト** § 4.2 全件実装（ロール別 UI テスト含む）

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

## 6. 判断保留事項（採択版一覧、v2 改訂）

| # | 論点 | 採択 |
|---|---|---|
| 1 | 圧縮失敗トースト文言 | 「画像の処理に失敗しました。別の画像で再試行してください。」 |
| 2 | **HEIC 変換失敗トースト文言（v2 A+C 合成版）** | 「画像の形式変換に失敗しました。別の画像で再度お試しください。iPhone をお使いの方は iPhone の設定 → カメラ → フォーマット → 互換性優先 をご確認ください。」 |
| 3 | サムネ保存先 | 同一 bucket の `/thumb/<attachment_id>.jpg` prefix |
| 4 | beforeunload 文言 | ブラウザ既定（`event.preventDefault()` のみ） |
| 5 | 論理削除 UI 隔離 | manager+ のみ × 表示（ホバー/常時）、2 段確認 + UNDO snackbar |
| 6 | 並列 upload 数 | モバイル 2 / PC 3、判定不能は PC 扱い（並列 3） |
| 7 | Web Worker 実装 | Next.js 標準 `new Worker(new URL(..., import.meta.url))` |
| 8 | 複数カテゴリ対応 | 1 upload = 1 カテゴリ、複数カテゴリは分けて upload |
| 9 | 5 カテゴリに合わない画像 | エラーでカテゴリ追加を促す（「その他」カテゴリを作らない）|
| 10 | **UNDO snackbar 秒数** | **5 秒固定**（v2 確定、β版 FB で調整可） |
| 11 | `navigator.connection` fallback | 判定不能は PC 扱い（並列 3） |
| 12 | **スマホ DL パスワード確認ポリシー（v2 新規）** | 本人の Garden ログインパスワード、`signInWithPassword` で検証、3 回失敗で 5 分ロック（sessionStorage カウント） |
| 13 | **削除済バッジ可視範囲（v2 新規）** | 全ロール可視（誤削除認識用）、Lightbox open は block、admin のみ「復元」「物理削除」ボタン表示 |
| 14 | **UNDO と admin 復元の使い分け（v2 新規）** | UNDO = 自分が削除直後の 5 秒以内（manager+）／復元 = 任意時刻の論理削除取消（admin+） |
| 15 | **manager の削除権限事業越境（v2 新規）** | manager は **自分の所属事業内のみ** 削除可能、admin / super_admin のみ事業横断 |

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

## 8. Migration SQL スケルトン（2026-04-25 v2 改訂）

**配置先**: `scripts/leaf-schema-patch-a1c.sql`（Garden 慣習 — 既存 `scripts/root-schema.sql` / `forest-schema-patch-001.sql` と同パターン、Supabase Dashboard > SQL Editor で手動実行）

**前提**: Root A-3-g migration（`scripts/root-schema-patch-a3g.sql`）が先行実行済みで、以下が利用可能であること:
- `is_user_active()` 関数
- `garden_role_of(uid uuid)` 関数
- `garden_role` enum に `outsource` 追加済
- `root_employees.contract_end_on` 列追加済

未実行の場合、本 migration は `leaf_user_in_business()` 内の `is_user_active()` 参照で失敗する。

```sql
-- File: scripts/leaf-schema-patch-a1c.sql
-- ============================================================
-- Garden-Leaf A-1c 添付ファイル機能 v2 migration
-- Run this in Supabase Dashboard > SQL Editor
-- Spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §8 (v2)
-- Depends on: scripts/root-schema-patch-a3g.sql (is_user_active, garden_role_of)
-- ============================================================

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

-- NOTE: 論理削除の列単位制御は RLS で表現困難のため、Client 側で manager+ ガード。
-- 悪意ある直接 UPDATE は Phase B-1 の監査ログ (cross-audit-log) で検出する。
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

-- ===== 11. 初期データ投入 =====
INSERT INTO leaf_businesses (business_id, display_name, product_type, flow_type, start_date)
VALUES ('kanden', '関電業務委託', '電気', '委託', '2020-01-01')
ON CONFLICT (business_id) DO NOTHING;

-- NOTE: 東海林さんの super_admin + 関電所属登録は、実 user_id を置換して個別実行：
-- INSERT INTO leaf_user_businesses (user_id, business_id, role_in_biz, assigned_by)
-- VALUES ('<東海林さんの user_id>', 'kanden', 'super_admin', '<東海林さんの user_id>')
-- ON CONFLICT (user_id, business_id) DO NOTHING;
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
| **2026-04-25 (v2 改訂)** | **a-main 指示で大改訂: 8 ロール分岐前倒し / 事業スコープ（leaf_businesses, leaf_user_businesses）/ 画像 DL パスワード（スマホ限定）/ 削除ロール別表示 + 削除済バッジ / 物理削除 UI / HEIC 文言 A+C 合成。Root A-3-g 依存。見積 4.0d → 6.0d** | **a-leaf** |

---

## 11. v1 → v2 差分サマリ（レビューア向け早見表）

| 項目 | v1 (2026-04-25 初版) | v2 (2026-04-25 改訂) |
|---|---|---|
| **スコープ** | 認証済み = 全員同権（Q4 A 案）| 8 ロール × 事業スコープ（Q4 B+ 案）|
| **削除権限** | 認証済み全員が論理削除可 | toss/closer/cs/staff/outsource は削除不可 / manager+ が論理削除 / admin+ が物理削除 |
| **テーブル数** | leaf_kanden_attachments 拡張のみ | + leaf_businesses + leaf_user_businesses 新規 2 本 |
| **RLS 関数** | `auth.uid() IS NOT NULL` | `leaf_user_in_business('kanden') OR garden_role_of(...) IN (admin, super_admin)` |
| **削除済表示** | UI から消す | 「削除済」バッジで全員可視（誤削除認識）|
| **画像 DL** | signedURL で誰でも DL | PC は即 DL、スマホは Garden パスワード要求 + 3 回失敗ロック |
| **HEIC 文言** | iPhone 前提文言 | 「画像の形式変換に失敗...iPhone をお使いの方は...」（A+C 合成）|
| **外注契約管理** | なし | `is_user_active()` 経由で `contract_end_on` 過ぎたら自動アクセス遮断 |
| **見積** | 4.0d | **6.0d** (+2.0d) |
| **migration path** | `supabase/migrations/` （誤）| `scripts/leaf-schema-patch-a1c.sql` （Garden 慣習に訂正）|
| **依存** | なし | **Root A-3-g 必須**（`is_user_active` / `garden_role_of` / outsource / contract_end_on） |
| **判断保留** | 11 件 | 15 件（#12-15 新規追加）|
| **Phase B 引継** | ロール強化が含まれていた | ロール強化は A-1c で実装済、Phase B-1 は事業マスタ UI / 移行バッチ / Lightbox 拡張 / UNDO 秒数 |
