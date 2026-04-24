# Garden-Leaf 関電業務委託 A-1c: 添付ファイル機能 設計書

- 優先度: 🔴 高（Phase A 必須、Leaf 関電業務委託の中核機能）
- 見積: **4.0d**（D 共通基盤 1.5d + A Backoffice 1.5d + B Input 1.0d）
- 実装順: **D → A → B**（Q2 採択で確定）
- 作成: 2026-04-23 起草 / 2026-04-25 確定（a-leaf ブレスト完走）
- 前提:
  - 親 CLAUDE.md §11〜§18（横断調整・工数蓄積・現場 FB 運用ルール）
  - 横断 spec PR #25（`docs/specs/cross-cutting/` 配下 6 件）
  - handoff-20260423（4/22-23 の a-leaf/b-main ブレスト継続）
  - Phase A-FMK1（FileMaker 風キーボードショートカット、PR #1 本ブランチ既実装）

---

## 1. Executive Summary

### 1.1 目的
関電業務委託案件の業務上必要な画像（電灯/動力/ガス/諸元/受領書）を Garden-Leaf 上で**閲覧・アップロード・圧縮・サムネ生成・論理削除**できるようにする。現状これらの画像は TimeTree（カレンダーアプリ）に蓄積されており、Garden 化により一元管理・検索性向上・将来の OCR 自動化の土台を整える。

### 1.2 スコープ（A-1c）
- 閲覧（サムネ一覧 + 1500px 拡大ライトボックス）
- アップロード（選択/撮影 → Canvas 圧縮 → Supabase Storage 直接 PUT）
- 圧縮（1500px JPEG85% 本体 + 300px JPEG70% サムネ）
- サムネ生成（同時生成、事前保存）
- 論理削除（2 段確認 + UNDO snackbar 5 秒）
- HEIC → JPEG 変換（iPhone 撮影対応）

### 1.3 スコープ外（明示的に Phase B 以降へ委譲）
- 3 階層移行バッチ（recent → monthly → yearly PDF 集約）
- TimeTree から Garden への既存画像移行（TimeTree API 制約のため手動/半自動運用を Phase B で再設計）
- OCR 処理（`KandenAttachment.ocr_processed` 列は予約済のまま）
- ロール分岐（`garden_role`、`leaf_is_admin()` 等は Phase B-1 で導入）
- 物理削除（Phase B の cleanup job で対応）
- Lightbox 機能拡張（原本 DL / エクスポート / 画像回転など）
- Playwright E2E（spec-cross-test-strategy の Leaf 🟡 通常厳格度、A-1c では Vitest + RTL+MSW のみ）

### 1.4 主な設計判断（Q3〜Q8 着地サマリ）
| Q | 論点 | 採択 |
|---|---|---|
| Q2 | バケット構造 | 3 バケット分離（recent / monthly / yearly） |
| Q3 | A-1c のスコープ | C 案（閲覧 + upload + 圧縮 + サムネ、移行バッチは Phase B） |
| Q4 | RLS 粒度 | A 案（ロール分岐なし、Pattern-1 簡略版、論理削除対応） |
| Q5 | Upload 処理 | A 案（client 主導、Route Handler 不使用） |
| Q6 | 圧縮タイミング | A 案 + C 案の並列 upload 要素（選択直後に圧縮、並列 PUT） |
| Q6.1 | HEIC 対応 | heic2any 追加承認、client で JPEG 変換してから Canvas 圧縮 |
| Q8 | API 層 | A 案（全面 SDK 直呼び、`src/lib/supabase/client.ts` 共通化を Leaf が先頭バッター） |

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

### 2.3 RLS 方針（Pattern-1 簡略版、ロール分岐なし、論理削除対応）

#### `leaf_kanden_attachments` テーブル

```sql
-- SELECT: 論理削除除外
CREATE POLICY leaf_attachments_select ON leaf_kanden_attachments
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND deleted_at IS NULL
  );

-- INSERT: 認証済みなら可
CREATE POLICY leaf_attachments_insert ON leaf_kanden_attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 論理削除 + 復元 + メタ編集を許容
-- TODO (Phase B-1): ロール分岐導入後に "owner or admin のみ" へ強化する
CREATE POLICY leaf_attachments_update ON leaf_kanden_attachments
  FOR UPDATE USING (auth.uid() IS NOT NULL)
             WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: 物理削除禁止（Phase B で admin に開放）
CREATE POLICY leaf_attachments_delete ON leaf_kanden_attachments
  FOR DELETE USING (FALSE);
```

#### `leaf-kanden-photos-recent` bucket

```sql
CREATE POLICY recent_select ON storage.objects FOR SELECT
  USING (bucket_id = 'leaf-kanden-photos-recent' AND auth.uid() IS NOT NULL);

CREATE POLICY recent_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'leaf-kanden-photos-recent' AND auth.uid() IS NOT NULL);

-- UPDATE / DELETE 禁止（A-1c スコープ内）
CREATE POLICY recent_update ON storage.objects FOR UPDATE USING (FALSE);
CREATE POLICY recent_delete ON storage.objects FOR DELETE USING (FALSE);
```

#### `leaf-kanden-photos-monthly` / `yearly` bucket

```sql
CREATE POLICY monthly_select ON storage.objects FOR SELECT
  USING (bucket_id IN ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-yearly')
         AND auth.uid() IS NOT NULL);

-- INSERT / UPDATE / DELETE 禁止（A-1c では read-only、Phase B の service_role 移行バッチで書込）
CREATE POLICY monthly_insert ON storage.objects FOR INSERT WITH CHECK (FALSE);
CREATE POLICY monthly_update ON storage.objects FOR UPDATE USING (FALSE);
CREATE POLICY monthly_delete ON storage.objects FOR DELETE USING (FALSE);
```

**Phase B-1 強化予定コメント**（本 spec § 2.3、§5.4 の TODO と整合）：
Q4 A 案採択の意図通り、本 spec は「認証済み = 全員同権」で運用する。ロール分岐は Bud 給与・Root マスタ完成時の Phase B-1 で導入し、UPDATE を「owner or admin のみ」に強化する予定。

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

### 2.6 データモデル拡張（migration）

`leaf_kanden_attachments` テーブルに以下を追加：

```sql
ALTER TABLE leaf_kanden_attachments
  ADD COLUMN deleted_at timestamptz DEFAULT NULL;

CREATE INDEX idx_leaf_kanden_attachments_case_id_active
  ON leaf_kanden_attachments (case_id)
  WHERE deleted_at IS NULL;
```

その他は既存 `KandenAttachment` 型（`src/app/leaf/_lib/types.ts:115-140`）で全要件をカバー済：
- 5 カテゴリ `AttachmentCategory`（denki / douryoku / gas / shogen / ryosho）
- 3 階層 `archived_tier`（recent / monthly_pdf / yearly_pdf）
- サムネ URL / OCR 済フラグ / is_guide_capture / is_post_added / uploaded_by / uploaded_at / archived_at

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
1. query leaf_kanden_attachments
   WHERE case_id = X AND deleted_at IS NULL
   ← RLS SELECT ポリシーで deleted_at IS NULL フィルタが自動適用

2. 取得した全画像の thumbnail_url (storage path) を抽出

3. supabase.storage
    .from('leaf-kanden-photos-recent')
    .createSignedUrls(paths, 600)   // TTL 10 分、1 API で全サムネ一括

4. grid state に { attachment_id → signedURL, expiresAt } 保持

5. render サムネグリッド

[10 分以内の再描画]
- state に保持した signedURL を再利用（再発行なし）

[10 分経過後]
- mount 時に expiresAt 判定 → 期限切れなら再発行

[Lightbox クリック時]
- 該当 attachment の storage_url（本体 path）で
  createSignedUrl(path, 600) を単発発行
- <img src={signedURL}> で 1500px 表示
```

**論理削除後の signedURL バグ検出**:
- 削除フラグ立ち画像は RLS SELECT で取得されない → signedURL 発行対象外（構造的保証）
- § 4.3 手動 RLS 検証シナリオ #10 で明示的に検証

### 3.4 論理削除 2 段確認 UI

**UI 隔離方式**（判断保留 #5）:

```
[通常]              [ホバー desktop / 長押し 500ms touch]
┌────────────┐      ┌────────────┐
│            │      │         ×  │
│   [img]    │      │   [img]    │
│            │      │            │
└────────────┘      └────────────┘
```

**2 段確認フロー**:

```
1. × クリック
   ↓
2. 確認ダイアログ (1 段目)
   ┌─────────────────────────────────┐
   │ この画像を削除しますか？          │
   │ (管理者操作で復元可能)           │
   │                                 │
   │      [キャンセル]  [削除する]    │
   └─────────────────────────────────┘
   ↓ [削除する] クリック
3. 楽観的更新: UI grid から即消去
   ↓
4. UPDATE leaf_kanden_attachments
   SET deleted_at = now()
   WHERE attachment_id = ?
   ↓
5. UNDO snackbar (2 段目、5 秒間表示)
   ┌─────────────────────────────────┐
   │ 画像を削除しました  [元に戻す]   │
   └─────────────────────────────────┘
   ↓ [元に戻す] クリック (5 秒以内)
6. UPDATE deleted_at = NULL → grid 復帰
```

**UNDO 秒数**: A-1c で 5 秒固定実装、β版 UX 試験で 7 秒/10 秒等に調整可能（§ 7.6）。

**API**:
- `attachments.ts`: `softDeleteAttachment(id)` / `undoSoftDelete(id)`
- 失敗時ロールバック（grid に画像戻す + トースト）

**TODO コメント（Phase B-1 強化予定）**:
```typescript
// TODO (Phase B-1): ロール分岐導入後、softDeleteAttachment / undoSoftDelete の
// RLS を "owner or admin のみ" に強化する。
// 現状は auth.uid() IS NOT NULL で誰でも論理削除・復元可能
// (Q4 A 案採択の意図通り、ロール分岐なし)。
```

### 3.5 Lightbox 仕様

**A-1c スコープ**: 1500px 拡大表示のみ（原本 DL / エクスポートは Phase B 以降）。

**実装**:
- `<img src={signedURL}>` + CSS（backdrop + 中央配置）、Canvas 不要
- ESC / 背景クリックで close
- ← → キーで前後画像遷移（同 case の attachment 一覧内）
- Tab キーで UI 操作可能（A-FMK1 キーボード操作 UX 準拠）

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
| `softDeleteAttachment(id)` | UPDATE クエリ組立（Supabase client mock） |
| `undoSoftDelete(id)` | UPDATE deleted_at=NULL |
| `uploadAttachments(files, caseId, category, opts)` | 成功/失敗の分離集計 / リトライ 3 回 / 並列数制御 |

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

### 4.2 RTL + MSW 範囲（UI 検証）

- **`AttachmentGrid.tsx`**: case_id クエリ / deleted_at IS NULL フィルタ / カテゴリ別タブ / signedURL 一括発行 + TTL 切れ再発行 / loading・error・empty
- **`AttachmentUploader.tsx`**: File drop + input 両対応 / カテゴリ必須バリデーション / HEIC 変換進行 / Canvas 圧縮（Happy DOM + Canvas mock）/ 並列進捗 / beforeunload 登録解除
- **`AttachmentLightbox.tsx`**: モーダル表示 + 1500px signedURL 発行 / ESC・背景クリック close / ← → 遷移 / Tab フォーカス
- **`AttachmentDeleteButton.tsx`**: ホバー/長押しで × 表示 / 確認ダイアログ / 楽観的更新 + UNDO snackbar 5 秒 / UNDO クリックで復帰 / 5 秒経過で完全消失

**カバレッジ目標**: UI コンポーネント全体で **70%+**

### 4.3 手動 RLS 検証シナリオ

Supabase ローカル（`supabase start`）+ staging（garden-dev）の 2 段で手動検証し、結果を `docs/manual-rls-test-a1c-results.md` に記録。

| # | シナリオ | 期待 |
|---|---|---|
| 1 | 認証済 GET `leaf_kanden_attachments` | 200 OK、deleted_at IS NULL のみ |
| 2 | anon GET 同 | 401 or 0 件（RLS block）|
| 3 | 手動 SQL で `deleted_at=now()` 設定 → grid 再 query | 該当行取得なし |
| 4 | 認証済 DELETE `leaf_kanden_attachments` | 403 or 0 rows（物理削除禁止）|
| 5 | 認証済 `storage.upload(recent, ...)` | 200 |
| 6 | anon `storage.upload(recent, ...)` | 403 |
| 7 | 認証済 `storage.remove([recent path])` | 403（UPDATE/DELETE 禁止）|
| 8 | 認証済 `storage.upload(monthly, ...)` | 403（read-only）|
| 9 | 認証済 `storage.createSignedUrl(monthly, ...)` | 200 |
| 10 | **論理削除後の signedURL 発行試行**（§ 3.3 補強）| RLS SELECT で取得されず、発行対象に含まれない |
| 11 | 6MB ファイルを recent に upload | 413 Payload Too Large |
| 12 | .txt ファイルを recent に upload | 400（MIME 拒否）|

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
| 1 | 機能網羅 | ✅ | 全ボタン・入力・カテゴリ選択・upload/閲覧/削除/UNDO の全線 |
| 2 | **エッジケース** | ✅✅ **優先** | 0 枚 upload / 16 枚（並列越え）/ 同時複数カテゴリ / 10MB 原本（size 制限弾き）/ HEIC 変換不可ファイル / network timeout 中離脱 / 5MB 境界 / ファイル名マルチバイト / category 未選択 |
| 3 | 権限 | △ | Pattern-1 前提（認証済 = 同権）のため認証有/無 2 段のみ。ロール分岐は Phase B-1 |
| 4 | データ境界 | ✅ | category 不正文字列 / 極大ファイル名 / マルチバイト / deleted_at 境界 / 論理削除→復元→再削除 |
| 5 | パフォーマンス | ✅ | 15 枚並列 upload の時間 / Grid 100 件のレンダリング / signedURL 一括発行の API 時間 |
| 6 | コンソール監視 | ✅ | upload・Lightbox 遷移・論理削除フローで Error/Warning なし |
| 7 | アクセシビリティ | △ | axe-core で A-FMK1 同等。Lighthouse は Phase C |

A-1c 完了後、β版投入前に `docs/pre-release-test-YYYYMMDD-leaf-a1c.md` を起票して全 7 種結果を記録。

---

## 5. 実装ステップ（D → A → B 順、合計 4.0d）

### 5.1 Phase D: 共通基盤（1.5d）

1. **Migration**:
   - `leaf_kanden_attachments.deleted_at` 追加 + インデックス
   - 3 bucket 作成（recent / monthly / yearly）+ size / MIME 設定
   - RLS ポリシー（§ 2.3 準拠）
2. **Supabase client 共通化**:
   - `src/lib/supabase/client.ts` 新設（§ 2.5 JSDoc 含む）
   - `src/app/leaf/_lib/supabase.ts` を re-export に縮小
3. **ロジック層 3 ファイル新設**:
   - `src/app/leaf/_lib/attachments.ts`
   - `src/app/leaf/_lib/image-compression.ts` + `image-compression.worker.ts`
   - `src/app/leaf/_lib/kanden-storage-paths.ts`
4. **heic2any** npm 追加（Q6.1 承認済）
5. **test-utils**: § 4.4 の実在確認 → 再利用 or 新設
6. **Vitest ユニットテスト** § 4.1 全件実装

### 5.2 Phase A: Backoffice 閲覧 + upload UI（1.5d）

1. `AttachmentGrid.tsx`（カテゴリ別タブ、signedURL 一括発行キャッシュ）
2. `AttachmentLightbox.tsx`（1500px 拡大、キーボードナビ）
3. `AttachmentUploader.tsx`（PC 向け、drag&drop + file input、並列 3）
4. `AttachmentDeleteButton.tsx`（ホバー × + 2 段確認 + UNDO）
5. `src/app/leaf/backoffice/page.tsx` 組込（既存 A-FMK1 と整合）
6. **RTL + MSW テスト** § 4.2 全件実装

### 5.3 Phase B: Input 撮影 UI（1.0d）

1. `src/app/leaf/input/page.tsx` 新設（現時点未実装、A-1c で初期構築）
2. 営業向け upload UI（`<input type="file" accept="image/*" capture="environment">` でカメラ起動）
3. 並列 2（モバイル固定）
4. カテゴリ選択 UI（大きめタップターゲット、親指操作前提）
5. 既存 Backoffice UI コンポーネントの再利用（`AttachmentGrid` / `AttachmentLightbox`）
6. モバイル実機試験（iPhone Safari / Android Chrome）

### 5.4 仕上げ（上記 3 Phase 内で並行実施）

- 手動 RLS 検証（§ 4.3）実施 + `docs/manual-rls-test-a1c-results.md` 起票
- §16 7 種テスト実施 + `docs/pre-release-test-YYYYMMDD-leaf-a1c.md` 起票
- `docs/effort-tracking.md` に D/A/B の実績追記

---

## 6. 判断保留事項（採択版一覧）

| # | 論点 | 採択 |
|---|---|---|
| 1 | 圧縮失敗トースト文言 | 「画像の処理に失敗しました。別の画像で再試行してください。」 |
| 2 | HEIC 変換失敗トースト文言 | 「iPhone の写真形式変換に失敗しました。iPhone の設定→カメラ→フォーマット→互換性優先 に変更後、再度お試しください」 |
| 3 | サムネ保存先 | 同一 bucket の `/thumb/<attachment_id>.jpg` prefix（別 bucket にしない、RLS 設計シンプル化）|
| 4 | beforeunload 文言 | ブラウザ既定（`event.preventDefault()` のみ） |
| 5 | 論理削除 UI 隔離 | ホバー/長押しで × 表示、2 段確認 + UNDO snackbar |
| 6 | 並列 upload 数 | モバイル 2 / PC 3、判定不能は PC 扱い（並列 3） |
| 7 | Web Worker 実装 | Next.js 標準 `new Worker(new URL(..., import.meta.url))` |
| 8 | 複数カテゴリ対応 | 1 upload = 1 カテゴリ、複数カテゴリは分けて upload |
| 9 | 5 カテゴリに合わない画像 | エラーでカテゴリ追加を促す（「その他」カテゴリを作らない）|
| 10 | UNDO snackbar 秒数 | 5 秒固定、β版 FB で調整 |
| 11 | `navigator.connection` fallback | 判定不能は PC 扱い（並列 3） |

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

### 7.2 ロール分岐強化（Phase B-1）

- `root_employees.garden_role` 列追加
- `leaf_is_admin()` / `leaf_is_user()` SQL ヘルパー関数
- `leaf_kanden_attachments` の UPDATE ポリシーを「owner or admin のみ」に強化
- `softDeleteAttachment` / `undoSoftDelete` の RLS 強化
- recent bucket の UPDATE/DELETE を admin に開放（誤削除復旧用）

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

## 8. Migration SQL スケルトン

Phase D 着手時に `supabase/migrations/` に配置。

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_leaf_a1c_attachments.sql

-- 1. 既存テーブルに deleted_at 追加
ALTER TABLE leaf_kanden_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_leaf_kanden_attachments_case_id_active
  ON leaf_kanden_attachments (case_id)
  WHERE deleted_at IS NULL;

-- 2. 3 bucket 作成（idempotent）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('leaf-kanden-photos-recent',  'leaf-kanden-photos-recent',  false,  5242880, ARRAY['image/jpeg','image/png','image/heic']),
  ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-monthly', false, 52428800, ARRAY['application/pdf']),
  ('leaf-kanden-photos-yearly',  'leaf-kanden-photos-yearly',  false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. RLS 有効化
ALTER TABLE leaf_kanden_attachments ENABLE ROW LEVEL SECURITY;

-- 4. leaf_kanden_attachments ポリシー
DROP POLICY IF EXISTS leaf_attachments_select ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_select ON leaf_kanden_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS leaf_attachments_insert ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_insert ON leaf_kanden_attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_attachments_update ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_update ON leaf_kanden_attachments
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_attachments_delete ON leaf_kanden_attachments;
CREATE POLICY leaf_attachments_delete ON leaf_kanden_attachments
  FOR DELETE USING (FALSE);

-- 5. recent bucket ポリシー
DROP POLICY IF EXISTS leaf_recent_select ON storage.objects;
CREATE POLICY leaf_recent_select ON storage.objects FOR SELECT
  USING (bucket_id = 'leaf-kanden-photos-recent' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_recent_insert ON storage.objects;
CREATE POLICY leaf_recent_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'leaf-kanden-photos-recent' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_recent_update ON storage.objects;
CREATE POLICY leaf_recent_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'leaf-kanden-photos-recent' AND FALSE);

DROP POLICY IF EXISTS leaf_recent_delete ON storage.objects;
CREATE POLICY leaf_recent_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'leaf-kanden-photos-recent' AND FALSE);

-- 6. monthly / yearly bucket ポリシー
DROP POLICY IF EXISTS leaf_archive_select ON storage.objects;
CREATE POLICY leaf_archive_select ON storage.objects FOR SELECT
  USING (bucket_id IN ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-yearly')
         AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_archive_insert ON storage.objects;
CREATE POLICY leaf_archive_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-yearly')
              AND FALSE);

DROP POLICY IF EXISTS leaf_archive_update ON storage.objects;
CREATE POLICY leaf_archive_update ON storage.objects FOR UPDATE
  USING (bucket_id IN ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-yearly')
         AND FALSE);

DROP POLICY IF EXISTS leaf_archive_delete ON storage.objects;
CREATE POLICY leaf_archive_delete ON storage.objects FOR DELETE
  USING (bucket_id IN ('leaf-kanden-photos-monthly', 'leaf-kanden-photos-yearly')
         AND FALSE);
```

---

## 9. 参考資料

### 9.1 横断 spec（PR #25、`docs/specs/cross-cutting/`）

- spec-cross-rls-audit.md … § 2 パターン A 準拠、§ 8 W1 「client.ts 新設」を Leaf 先行
- spec-cross-storage.md … § 2 命名規則、§ 4.1 size、§ 5.1 MIME、§ 6.1 Pattern-1、§ 7.1 TTL、§ 8 bucket 一覧
- spec-cross-test-strategy.md … § Leaf 🟡 通常厳格度
- spec-cross-chatwork.md … 案 D（署名 URL 不流通、Garden ログイン経由）

### 9.2 既存 Leaf 実装

- `src/app/leaf/_lib/types.ts:115-140` … `KandenAttachment` / `AttachmentCategory` 既定義
- `src/app/leaf/_lib/supabase.ts` … § 2.5 で re-export に縮小
- `src/app/leaf/_lib/auth.ts` … Leaf ログイン（社員番号 + PW 合成メール、5 分ロック）
- `src/app/leaf/backoffice/page.tsx` … A-FMK1 キーボードショートカット既実装

### 9.3 参照資料（G ドライブ）

- `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\04_Garden-Leaf\001_関西電力業務委託\`
  - `garden-leaf-kanden-backoffice-v8_20260421120000.html`（事務 PoC）
  - `garden-leaf-kanden-input-v10_20260420160000.html`（営業 PoC）
  - `DB設計_取引マスタ_v2_20260420.md`
  - `supabase_migration_v1_20260420.sql`
  - `supabase_dev_policies_20260422.sql`

### 9.4 MEMORY.md エントリ

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
| 2026-04-25 | Q2 採択（3 バケット）、Q3-Q8 完走、Section 1-3 承認、spec 起票 | a-leaf |
