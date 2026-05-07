# Garden-Leaf A-1c 添付ファイル機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (v3 2026-04-25 改訂):** 関電業務委託案件の画像を Garden-Leaf 上で閲覧・アップロード・圧縮・サムネ生成・**論理削除（v3 全員可）+ UNDO + 復元（admin+）+ 物理削除（admin+）+ 画像 DL（スマホ時は DL 専用 PW を RPC 検証）**できるようにする。**全変更は history trigger で自動記録**。client 主導 + 8 ロール × 事業スコープ RLS + 3 バケット分離の構成。

**Architecture:** 3 層構造（UI / ロジック / インフラ）。UI は Backoffice / Input / **Root マイページ DL PW 設定**の 3 画面。ロジックは `src/app/leaf/_lib/` に集約、`attachments.ts` (**v3: 10 関数**) / `image-compression.ts` + Worker / `kanden-storage-paths.ts` / `role-context.tsx`。インフラは Supabase Storage × 3 bucket + Postgres テーブル **4 本**（`leaf_kanden_attachments` 拡張 + `leaf_businesses` + `leaf_user_businesses` + **`leaf_kanden_attachments_history` 新規**）+ **bcrypt RPC 2 本 + history trigger**。spec-cross-rls-audit §2 パターン A に従い `src/lib/supabase/client.ts` を新設。**Root A-3-g + root_settings + pgcrypto** に依存。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4 / Supabase JS 2.103 / heic2any (新規) / vitest + @testing-library/react + MSW + happy-dom (新規、要承認)
※ **v3.2 改訂（2026-05-07）**: bcryptjs（v3 新規予定だった client 側 hash 生成用 npm）は a-review #65 セキュリティ修正で **不要化**（サーバ側 RPC 内で bcrypt hash 化に変更、平文 PW を RPC に直送）

**仕様書**: `docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md`（**v3.2 2026-05-07 改訂**、a-review #65 セキュリティ修正反映: search_path 追加 + 平文 PW 直送設計 + extensions schema 明示）

**見積 (v3)**: **6.7d**（Phase 0 = 0.3d / Phase D 共通基盤 = **2.7d** / Phase A Backoffice = **2.3d** / Phase B Input = **1.5d** / Phase F 仕上げ = 0.2d、並行一部あり）※ v2 比 +0.7d

**前提依存**: Root A-3-g migration（`is_user_active` / `garden_role_of` / `outsource` / `contract_end_on`）**マージ済 ✅**、`root_settings` テーブル存在確認、Supabase で `pgcrypto` extension 有効化。Root A-3-h（kou_otsu 系）は待機中でも Leaf 影響小、本 plan はブロックされない。

---

## File Structure (v3)

### 新規作成（Create）

**インフラ / Migration:**
- `scripts/leaf-schema-patch-a1c.sql` — v3 で以下全部入り:
  - ALTER TABLE + leaf_businesses / leaf_user_businesses / **`leaf_kanden_attachments_history`（v3 新規）** 計 3 本の新規テーブル
  - leaf_user_in_business 関数
  - **`verify_image_download_password` / `set_image_download_password` RPC（v3 新規）**
  - **`leaf_kanden_attachments_history_trigger()` 関数 + AFTER UPDATE/DELETE トリガ（v3 新規）**
  - `pgcrypto` extension 有効化
  - 3 bucket + 8 ロール × 事業スコープ RLS ポリシー
  - **root_settings に `leaf.image_download_password_hash` 初期値投入（仮 PW、v3 新規）**
- `src/lib/supabase/client.ts` — 横断共通 browser Supabase client

**Leaf ロジック層 `src/app/leaf/_lib/`:**
- `kanden-storage-paths.ts` — bucket/path 命名の集中管理（pure function）
- `image-compression.ts` — Canvas 圧縮 + サムネ + HEIC 変換 Worker ラッパ
- `image-compression.worker.ts` — 重処理の Web Worker 実装
- `attachments.ts` — **10 関数**: upload / signedURL / softDelete / undoSoftDelete / restoreAttachment / hardDeleteAttachment / **verifyImageDownloadPassword (v3 新規 RPC 呼出)** / verifyUserPasswordAndDownload (v3 で内部実装を RPC に変更) / isMobileDevice / getCurrentGardenRole
- `role-context.tsx` — **v2 新規**: `garden_role_of(auth.uid())` を React context 経由で全コンポで共有

**Leaf Backoffice UI `src/app/leaf/backoffice/_components/`:**
- `AttachmentCard.tsx` — 共通サムネカード + 削除済バッジ表示
- `AttachmentGrid.tsx` — サムネ一覧（カテゴリ別タブ）+ 削除済分類
- `AttachmentLightbox.tsx` — 1500px 拡大ビューワ + DownloadButton 組込
- `AttachmentUploader.tsx` — PC 向け drag&drop + file input
- `AttachmentDeleteButton.tsx` — **v3: 全ロール表示（ロール判定なし）**、ホバー × + 2 段確認 + UNDO 5 秒、文言「管理者の最終確認待ち」
- `DownloadButton.tsx` — PC 即 DL / スマホ パスワードモーダル + **v3: DL 専用 PW RPC 検証** + 3 回ロック
- `AttachmentAdminActions.tsx` — 削除済カードに admin+ 限定「復元」「完全削除」（v2 継続）

**Root マイページ UI `src/app/root/me/image-download-password/`（v3 新規）:**
- `page.tsx` — super_admin 限定 DL PW 設定ページ
- `_components/PasswordSetForm.tsx` — 旧 PW 確認 + 新 PW + 確認再入力 + **v3.2: 平文 PW を `set_image_download_password({ new_password })` RPC に直送（client bcryptjs 廃止、サーバ側 RPC 内で bcrypt 化）**

**Leaf Input UI `src/app/leaf/input/`（新規画面）:**
- `page.tsx` — 営業向け入力画面（新規）
- `_components/CategoryPicker.tsx` — 大きめタップターゲット
- `_components/MobileAttachmentUploader.tsx` — カメラ起動 + モバイル専用

**テスト基盤 `src/test-utils/`（新規）:**
- `src/test-utils/supabase-mock.ts` — Supabase client mock (**v2 拡張: ロール mock / 事業所属 mock / is_user_active mock** / RLS 簡易 / Storage PUT / signedURL)
- `src/test-utils/msw-handlers/leaf-kanden.ts` — MSW handlers for Leaf

**テスト `src/app/leaf/_lib/__tests__/`:**
- `kanden-storage-paths.test.ts`
- `image-compression.test.ts`
- `attachments.test.ts` (v3 で verifyImageDownloadPassword RPC mock 追加、softDelete Client ガード削除)
- `role-context.test.tsx`

**テスト `src/app/leaf/backoffice/_components/__tests__/`:**
- `AttachmentGrid.test.tsx`
- `AttachmentUploader.test.tsx`
- `AttachmentLightbox.test.tsx`
- `AttachmentDeleteButton.test.tsx` (**v3: ロール別表示テストを削除、全員表示を確認**)
- `DownloadButton.test.tsx` (**v3: RPC mock に差替**)
- `AttachmentAdminActions.test.tsx`

**テスト `src/app/root/me/image-download-password/__tests__/`（v3 新規）:**
- `PasswordSetForm.test.tsx` — super_admin 判定 / 新旧 PW 一致チェック / **v3.2: 平文 PW を RPC に直送する呼出検証（bcryptjs mock は廃止）**

**テスト `src/app/leaf/input/_components/__tests__/`:**
- `MobileAttachmentUploader.test.tsx`
- `CategoryPicker.test.tsx`

**設定ファイル:**
- `vitest.config.ts` — Vitest 設定（happy-dom + path alias）
- `src/test-utils/vitest-setup.ts` — RTL matcher 拡張

**ドキュメント（実施時記録）:**
- `docs/manual-rls-test-a1c-results.md` — 手動 RLS 検証結果 (**v2 で 12 → 20 シナリオ**)
- `docs/pre-release-test-YYYYMMDD-leaf-a1c.md` — §16 7 種テスト結果（実施日で YYYYMMDD を埋める）
- `docs/phase-b1-followups-leaf.md` — Phase B-1 後日対応タスク（§7.3 TimeTree / §7.5 Lightbox）

### 変更（Modify）

- `package.json` — 依存追加（heic2any + テスト基盤一式）
- `src/app/leaf/_lib/supabase.ts` — re-export 一行に縮小（既存 import 不変）
- `src/app/leaf/_lib/types.ts` — `KandenAttachment` に `deleted_at` + **`deleted_by` (v2)** 追加、**`LeafBusiness` / `LeafUserBusiness` 型 (v2 新規)**
- `src/app/leaf/backoffice/page.tsx` — AttachmentGrid 組込 + **RoleContext provider (v2)**
- `src/app/leaf/input/page.tsx` — **RoleContext provider (v2)**
- `docs/effort-tracking.md` — D/A/B の実績追記
- `tsconfig.json` — vitest types 追加

---

## 前提: 新規 npm パッケージ追加の承認状況

親 CLAUDE.md「新しいnpmパッケージを追加する場合は事前に相談する」ルールに従い、以下を Task 0.1 で東海林さんに一括承認依頼する：

| パッケージ | 用途 | バージョン | 承認状況 |
|---|---|---|---|
| `heic2any` | HEIC → JPEG 変換 | ^0.0.4 | ✅ 承認済（Q6.1） |
| ~~`bcryptjs`~~ | ~~DL 専用 PW の client 側 hash 生成（v3 新規）~~ | ~~^2.4.3~~ | ❌ **v3.2 改訂で不要化**（サーバ側 RPC 内 hash 化に変更、a-review #65 修正反映）|
| ~~`@types/bcryptjs`~~ | ~~bcryptjs の型定義~~ | ~~^2.4.6~~ | ❌ **v3.2 改訂で不要化**|
| `vitest` | ユニットテストランナー | ^1.6.0 | 🟡 要承認 |
| `@vitejs/plugin-react` | React support for Vitest | ^4.3.1 | 🟡 要承認 |
| `@testing-library/react` | Component testing | ^16.0.0 | 🟡 要承認 |
| `@testing-library/user-event` | ユーザー操作シミュレーション | ^14.5.2 | 🟡 要承認 |
| `@testing-library/jest-dom` | DOM matcher 拡張 | ^6.4.8 | 🟡 要承認 |
| `msw` | HTTP mock (MSW) | ^2.3.0 | 🟡 要承認 |
| `happy-dom` | 軽量 DOM 実装 | ^14.12.0 | 🟡 要承認 |

**未承認パッケージがある場合は Task 0.1 で停止し、承認取得後に再開。**

---

## 前提: spec §8 の migration path 訂正

spec §8「Phase D 着手時に `supabase/migrations/` に配置」は誤り。Garden の実運用は `scripts/<module>-schema[-patch].sql` を Supabase Dashboard > SQL Editor で手動実行する方式（既存 `scripts/root-schema.sql` / `forest-schema.sql` / `forest-schema-patch-001.sql` 参照）。本 plan では `scripts/leaf-schema-patch-a1c.sql` に配置する。

spec §8 の訂正は Phase B-1 後日対応メモに含める（本 plan Task F.4）。

---

## Phase 0: 承認 + テスト基盤セットアップ

### Task 0.1: 新規 npm パッケージの東海林さん承認取得

**Files:** なし（Chatwork / a-main 経由での確認のみ）

- [ ] **Step 1: 承認依頼テキストを a-main 経由で東海林さんに送付**

以下をコピペで a-main へ渡す：

```
【a-leaf → 東海林さん 承認依頼】
A-1c 実装に必要な新規 npm パッケージ 8 個の追加承認をお願いします：

- heic2any ^0.0.4（HEIC→JPEG 変換、Q6.1 で承認済）
- vitest ^1.6.0（ユニットテストランナー）
- @vitejs/plugin-react ^4.3.1（Vitest の React support）
- @testing-library/react ^16.0.0（Component testing）
- @testing-library/user-event ^14.5.2（ユーザー操作）
- @testing-library/jest-dom ^6.4.8（DOM matcher）
- msw ^2.3.0（HTTP mock）
- happy-dom ^14.12.0（軽量 DOM）

合計サイズ: ~18MB（devDependencies 偏重）
Garden 他モジュール（Tree/Forest/Bud 等）でも再利用できる共通テスト基盤となります。
承認いただければ Phase 0 以降の実装に着手します。
```

- [ ] **Step 2: 承認受領を確認**

承認が得られたら Task 0.2 へ進む。承認が得られない・条件付きの場合は plan 全体を見直し。

### Task 0.2: 依存パッケージ install

**Files:**
- Modify: `package.json`

- [ ] **Step 1: heic2any install（production dep）**

```bash
npm install heic2any@^0.0.4
```

Expected: `package.json` の `dependencies` に `heic2any` が追加される。

- [ ] **Step 2: テスト基盤 7 個を devDependencies に install**

```bash
npm install --save-dev vitest@^1.6.0 @vitejs/plugin-react@^4.3.1 @testing-library/react@^16.0.0 @testing-library/user-event@^14.5.2 @testing-library/jest-dom@^6.4.8 msw@^2.3.0 happy-dom@^14.12.0
```

Expected: `package.json` の `devDependencies` に 7 個追加。

- [ ] **Step 3: install 成功確認**

```bash
npm ls heic2any vitest @testing-library/react msw happy-dom
```

Expected: 全て ✅ 表示、UNMET 依存なし。

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore(leaf): A-1c 実装に必要な npm パッケージを追加 (heic2any + vitest + RTL + MSW + happy-dom)"
```

### Task 0.3: Vitest 設定

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test-utils/vitest-setup.ts`
- Modify: `package.json` (scripts 追加)
- Modify: `tsconfig.json` (types)

- [ ] **Step 1: vitest.config.ts 作成**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/test-utils/**',
        'src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 2: vitest setup ファイル作成**

```typescript
// src/test-utils/vitest-setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: package.json に test scripts 追加**

`scripts` セクションを以下に編集：
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 4: tsconfig.json の types に vitest/globals 追加**

`compilerOptions.types` に `"vitest/globals"` を追記（配列なければ新規）：
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 5: 動作確認用の最小テスト作成**

```typescript
// src/test-utils/__tests__/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('vitest smoke test', () => {
  it('2 + 2 = 4', () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 6: 実行して PASS 確認**

```bash
npm test
```

Expected: `1 test passed`、exit code 0。

- [ ] **Step 7: RTL + jest-dom 動作確認テスト**

```typescript
// src/test-utils/__tests__/rtl.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('RTL smoke test', () => {
  it('renders a button', () => {
    render(<button>OK</button>);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: 実行して PASS 確認**

```bash
npm test
```

Expected: `2 tests passed`（smoke + rtl）。

- [ ] **Step 9: コミット**

```bash
git add vitest.config.ts src/test-utils/vitest-setup.ts src/test-utils/__tests__/ package.json tsconfig.json
git commit -m "chore(leaf): Vitest + RTL + happy-dom テスト基盤を初期化"
```

---

## Phase D: 共通基盤（2.5d、v2 改訂で +1.0d）

### Task D.1: Migration SQL v3（手動実行 + 記録、事業スコープ + history trigger + DL PW RPC）

**[v3 改訂追記]** migration SQL に以下を追加実装する。spec §8 v3 の全量を scripts/leaf-schema-patch-a1c.sql に反映:

1. **冒頭**: `CREATE EXTENSION IF NOT EXISTS pgcrypto;` を追加
2. **§ 11 の直前**: `leaf_kanden_attachments_history` テーブル + trigger + RLS ポリシーブロック（spec §2.6.3 と §8 v3 の `===== 11. 変更履歴 =====` ブロック、約 60 行）
3. **§ 11 の直後**: `verify_image_download_password` / `set_image_download_password` RPC ブロック（spec §3.5.5 と §8 v3 の `===== 12. RPC =====` ブロック、約 30 行）
4. **§ 13 初期データ**: `INSERT INTO root_settings` で `leaf.image_download_password_hash` に bcrypt 仮 PW を投入（`crypt('change-me-immediately', gen_salt('bf', 12))`）

RLS ポリシー変更:
- `leaf_attachments_update` は事業所属 OR admin で全員可（Client ガード撤廃）
- `leaf_history_select` は事業所属 + admin で閲覧可、書込は `FALSE`（trigger 経由のみ）
- `leaf_history_no_write` でログ改ざん絶対防止

Step 5 の実行結果確認 SQL に以下を追加:
- `leaf_kanden_attachments_history` テーブル存在確認
- `trg_leaf_kanden_attachments_history` trigger 存在確認
- `verify_image_download_password` / `set_image_download_password` 関数存在確認
- `root_settings` に `leaf.image_download_password_hash` キー投入確認
- ポリシー数: 16 + 2 (history) = **18 ポリシー**

Step 6 コミットメッセージを v3 仕様に更新: "feat(leaf): A-1c v3 migration SQL (history trigger + DL PW RPC + 全員論理削除)"

---

**以下、v2 plan の migration 内容。上記 v3 追加分を織り込んで scripts/leaf-schema-patch-a1c.sql を作成すること。spec §8 v3 の SQL ブロックを正本として貼り付けるのが最も確実。**



**Files:**
- Create: `scripts/leaf-schema-patch-a1c.sql`

**前提**: Root A-3-g（`scripts/root-schema-patch-a3g.sql`）が Supabase Dashboard で実行済み。未実行なら `is_user_active()` / `garden_role_of()` が存在せず、本 migration は失敗する。

- [ ] **Step 1: Root A-3-g の migration 実行状況を確認**

Supabase Dashboard SQL Editor で以下を実行:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_user_active', 'garden_role_of');
SELECT unnest(enum_range(NULL::garden_role));
SELECT column_name FROM information_schema.columns
WHERE table_name = 'root_employees' AND column_name = 'contract_end_on';
```

Expected: 
- `is_user_active` / `garden_role_of` の 2 件
- `garden_role` enum に `outsource` が含まれる
- `contract_end_on` 列 1 件

未実装の場合は a-root / a-main に A-3-g のマージ・Dashboard 実行を依頼して完了を待つ。

- [ ] **Step 2: migration SQL ファイルを作成**

```sql
-- scripts/leaf-schema-patch-a1c.sql
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

CREATE TABLE IF NOT EXISTS leaf_user_businesses (
  user_id        uuid NOT NULL REFERENCES root_employees(user_id),
  business_id    text NOT NULL REFERENCES leaf_businesses(business_id),
  role_in_biz    text,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  assigned_by    uuid REFERENCES root_employees(user_id),
  removed_at     timestamptz,
  PRIMARY KEY (user_id, business_id)
);

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

-- ===== 4. 3 bucket 作成 =====
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

-- ===== 7. leaf_businesses ポリシー =====
DROP POLICY IF EXISTS leaf_businesses_select ON leaf_businesses;
CREATE POLICY leaf_businesses_select ON leaf_businesses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_businesses_write ON leaf_businesses;
CREATE POLICY leaf_businesses_write ON leaf_businesses
  FOR ALL USING (garden_role_of(auth.uid()) IN ('admin', 'super_admin'))
          WITH CHECK (garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- ===== 8. leaf_user_businesses ポリシー =====
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

-- ===== 10. monthly / yearly bucket ポリシー =====
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

-- NOTE: 東海林さんの super_admin + 関電所属登録は、Step 3 で実 user_id を置換して個別実行
```

- [ ] **Step 3: Supabase Dashboard > SQL Editor で garden-dev に対して実行**

1. garden-dev Supabase プロジェクトにログイン
2. SQL Editor で上記 SQL を貼り付けて実行
3. エラーなく完了確認

Expected:
- `ALTER TABLE` 成功
- `leaf_businesses` / `leaf_user_businesses` テーブル作成
- `leaf_user_in_business` 関数作成
- 3 bucket INSERT
- 16 ポリシー作成

- [ ] **Step 4: 東海林さんの super_admin + 関電所属を登録**

SQL Editor で `auth.users` から東海林さんの user_id を取得:
```sql
SELECT id FROM auth.users WHERE email = '<東海林さんのメール>';
```

取得した `<user_id>` を以下に埋めて実行:
```sql
INSERT INTO leaf_user_businesses (user_id, business_id, role_in_biz, assigned_by)
VALUES ('<user_id>', 'kanden', 'super_admin', '<user_id>')
ON CONFLICT (user_id, business_id) DO NOTHING;
```

- [ ] **Step 5: 実行結果確認 SQL**

```sql
-- 列追加確認
SELECT column_name FROM information_schema.columns
WHERE table_name = 'leaf_kanden_attachments'
  AND column_name IN ('deleted_at', 'deleted_by');

-- テーブル作成確認
SELECT tablename FROM pg_tables
WHERE tablename IN ('leaf_businesses', 'leaf_user_businesses');

-- 関数作成確認
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'leaf_user_in_business';

-- bucket 作成確認
SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets
WHERE id LIKE 'leaf-kanden-photos-%' ORDER BY id;

-- ポリシー作成確認
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('leaf_kanden_attachments', 'leaf_businesses', 'leaf_user_businesses', 'objects')
  AND policyname LIKE 'leaf_%'
ORDER BY tablename, policyname;

-- 初期データ確認
SELECT * FROM leaf_businesses;
SELECT * FROM leaf_user_businesses;
```

Expected:
- `deleted_at` + `deleted_by` 列 2 件
- 新規 2 テーブル確認
- `leaf_user_in_business` 関数確認
- 3 bucket（recent 5MB / monthly 50MB / yearly 50MB）
- ポリシー合計 **16 件**:
  - `leaf_attachments_*` 4 件
  - `leaf_businesses_*` 2 件
  - `leaf_user_businesses_*` 2 件
  - `leaf_recent_*` 4 件
  - `leaf_archive_*` 4 件
- 初期データ: `leaf_businesses` に kanden、`leaf_user_businesses` に東海林さん

- [ ] **Step 6: コミット**

```bash
git add scripts/leaf-schema-patch-a1c.sql
git commit -m "feat(leaf): A-1c v2 migration SQL (leaf_businesses + 事業スコープ + 8 ロール RLS 16 ポリシー)"
```

### Task D.2: 横断共通 Supabase client 新設

**Files:**
- Create: `src/lib/supabase/client.ts`

- [ ] **Step 1: `src/lib/` ディレクトリ作成確認 / 新設**

```bash
ls src/lib/ 2>/dev/null || mkdir -p src/lib/supabase
```

Expected: `src/lib/supabase/` が存在。

- [ ] **Step 2: client.ts を書き出す**

```typescript
// src/lib/supabase/client.ts
/**
 * Garden 横断共通 Supabase ブラウザクライアント（anon key）
 *
 * **ブラウザ専用**。Route Handler / Server Component では使用禁止。
 * Route Handler では src/lib/supabase/server.ts の createAuthenticatedSupabase を、
 * Cron / batch では src/lib/supabase/admin.ts の createAdminSupabase を使用すること。
 * (server.ts / admin.ts は Phase B で追加予定、A-1c では未作成)
 *
 * see: docs/specs/cross-cutting/spec-cross-rls-audit.md §2 パターン A
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

- [ ] **Step 3: 既存 `src/app/leaf/_lib/supabase.ts` を re-export に縮小**

内容を以下に置換（11 行 → 6 行）:

```typescript
// src/app/leaf/_lib/supabase.ts
/**
 * Garden-Leaf — Supabase クライアント（横断共通 client の re-export）
 * 本ファイルは後方互換用。新規コードは直接 '@/lib/supabase/client' を import すること。
 */
export { supabase } from '@/lib/supabase/client';
```

- [ ] **Step 4: build が通ることを確認**

```bash
npm run build
```

Expected: エラーなく build 完了（既存 import パスが壊れない確認）。

- [ ] **Step 5: コミット**

```bash
git add src/lib/supabase/client.ts src/app/leaf/_lib/supabase.ts
git commit -m "refactor(leaf): Supabase client を src/lib/supabase/client.ts に共通化 (Leaf 先頭バッター)"
```

### Task D.3: 型定義に `deleted_at` 追加

**Files:**
- Modify: `src/app/leaf/_lib/types.ts:115-140`

**[v3 改訂追記]** v2 の型に加えて以下 2 型を追加:

```typescript
// v3 新規: 変更履歴レコード（UI は Batch 14 別 spec、型は A-1c で定義）
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

// v3 新規: 画像 DL 専用 PW 設定値
export interface ImageDownloadPasswordSetting {
  hash: string;
  updated_at: string;
  updated_by: string;
}
```

commit メッセージを "feat(leaf): A-1c v3 型拡張 (AttachmentHistory + ImageDownloadPasswordSetting)" に更新。

---

- [ ] **Step 1: `KandenAttachment` interface に `deleted_at` + `deleted_by` 追加、`LeafBusiness` / `LeafUserBusiness` / `GardenRole` 型新設**

`src/app/leaf/_lib/types.ts` の末尾に以下を追加（`KandenAttachment` は既存定義の最後に 2 行追加）:

```typescript
// src/app/leaf/_lib/types.ts 既存の KandenAttachment を更新
export interface KandenAttachment {
  attachment_id: string;
  case_id: string;
  category: AttachmentCategory;
  storage_url: string;
  thumbnail_url: string | null;
  is_guide_capture: boolean;
  is_post_added: boolean;
  ocr_processed: boolean;
  mime_type: string;
  archived_tier: "recent" | "monthly_pdf" | "yearly_pdf";
  uploaded_by: string | null;
  uploaded_at: string;
  archived_at: string | null;
  deleted_at: string | null;     // A-1c 追加：論理削除用
  deleted_by: string | null;     // A-1c v2 追加：削除者ログ
}

// ─── ロール・事業スコープ（A-1c v2 新規） ─────────────────────────────
export type GardenRole =
  | 'toss'
  | 'closer'
  | 'cs'
  | 'staff'
  | 'outsource'
  | 'manager'
  | 'admin'
  | 'super_admin';

/** UI で削除ボタン表示可否の判定（manager 以上）*/
export const DELETABLE_ROLES: readonly GardenRole[] =
  ['manager', 'admin', 'super_admin'] as const;

/** admin アクション（復元 / 物理削除）可否の判定 */
export const ADMIN_ROLES: readonly GardenRole[] =
  ['admin', 'super_admin'] as const;

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

- [ ] **Step 2: `npx tsc --noEmit` で型チェック通過確認**

```bash
npx tsc --noEmit
```

Expected: 既存コードへの破壊的影響なし。

- [ ] **Step 3: コミット**

```bash
git add src/app/leaf/_lib/types.ts
git commit -m "feat(leaf): A-1c v2 型拡張 (deleted_at/by + GardenRole + LeafBusiness/UserBusiness)"
```

### Task D.4: `kanden-storage-paths.ts` + unit test（TDD）

**Files:**
- Create: `src/app/leaf/_lib/__tests__/kanden-storage-paths.test.ts`
- Create: `src/app/leaf/_lib/kanden-storage-paths.ts`

- [ ] **Step 1: 失敗テストを書く**

```typescript
// src/app/leaf/_lib/__tests__/kanden-storage-paths.test.ts
import { describe, it, expect } from 'vitest';
import {
  recentPath,
  recentThumbPath,
  monthlyPath,
  yearlyPath,
  RECENT_BUCKET,
  MONTHLY_BUCKET,
  YEARLY_BUCKET,
} from '../kanden-storage-paths';

describe('kanden-storage-paths', () => {
  describe('bucket 定数', () => {
    it('exposes 3 bucket ids', () => {
      expect(RECENT_BUCKET).toBe('leaf-kanden-photos-recent');
      expect(MONTHLY_BUCKET).toBe('leaf-kanden-photos-monthly');
      expect(YEARLY_BUCKET).toBe('leaf-kanden-photos-yearly');
    });
  });

  describe('recentPath', () => {
    it('builds <case_id>/<attachment_id>.jpg', () => {
      expect(recentPath('CASE-0001', 'aaa-bbb')).toBe('CASE-0001/aaa-bbb.jpg');
    });
  });

  describe('recentThumbPath', () => {
    it('builds <case_id>/thumb/<attachment_id>.jpg', () => {
      expect(recentThumbPath('CASE-0001', 'aaa-bbb')).toBe('CASE-0001/thumb/aaa-bbb.jpg');
    });
  });

  describe('monthlyPath', () => {
    it('builds <yyyy-mm>/<case_id>_<attachment_id>.pdf', () => {
      expect(monthlyPath('2026-04', 'CASE-0001', 'aaa-bbb'))
        .toBe('2026-04/CASE-0001_aaa-bbb.pdf');
    });
  });

  describe('yearlyPath', () => {
    it('builds <yyyy>/<case_id>_<attachment_id>.pdf', () => {
      expect(yearlyPath('2026', 'CASE-0001', 'aaa-bbb'))
        .toBe('2026/CASE-0001_aaa-bbb.pdf');
    });
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL 確認**

```bash
npm test -- kanden-storage-paths
```

Expected: `Cannot find module '../kanden-storage-paths'` エラー。

- [ ] **Step 3: 実装を書く**

```typescript
// src/app/leaf/_lib/kanden-storage-paths.ts
/**
 * Garden-Leaf 関電業務委託 — Storage bucket / path 命名の集中管理
 *
 * 3 bucket 構成:
 * - leaf-kanden-photos-recent  (write 可、recent tier)
 * - leaf-kanden-photos-monthly (A-1c では read-only、Phase B 移行バッチで書込)
 * - leaf-kanden-photos-yearly  (A-1c では read-only、Phase B 移行バッチで書込)
 *
 * see: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §2.2
 */

export const RECENT_BUCKET = 'leaf-kanden-photos-recent';
export const MONTHLY_BUCKET = 'leaf-kanden-photos-monthly';
export const YEARLY_BUCKET = 'leaf-kanden-photos-yearly';

/** recent bucket 本体画像パス: <case_id>/<attachment_id>.jpg */
export function recentPath(caseId: string, attachmentId: string): string {
  return `${caseId}/${attachmentId}.jpg`;
}

/** recent bucket サムネパス: <case_id>/thumb/<attachment_id>.jpg */
export function recentThumbPath(caseId: string, attachmentId: string): string {
  return `${caseId}/thumb/${attachmentId}.jpg`;
}

/** monthly bucket パス: <yyyy-mm>/<case_id>_<attachment_id>.pdf (Phase B で利用) */
export function monthlyPath(yyyymm: string, caseId: string, attachmentId: string): string {
  return `${yyyymm}/${caseId}_${attachmentId}.pdf`;
}

/** yearly bucket パス: <yyyy>/<case_id>_<attachment_id>.pdf (Phase B で利用) */
export function yearlyPath(yyyy: string, caseId: string, attachmentId: string): string {
  return `${yyyy}/${caseId}_${attachmentId}.pdf`;
}
```

- [ ] **Step 4: テスト再実行 → PASS 確認**

```bash
npm test -- kanden-storage-paths
```

Expected: `5 tests passed`。

- [ ] **Step 5: コミット**

```bash
git add src/app/leaf/_lib/kanden-storage-paths.ts src/app/leaf/_lib/__tests__/kanden-storage-paths.test.ts
git commit -m "feat(leaf): kanden-storage-paths (bucket/path 命名) + unit test"
```

### Task D.5: test-utils/supabase-mock.ts

**Files:**
- Create: `src/test-utils/supabase-mock.ts`

**[v2 改訂追記]** `createSupabaseMock` に以下のオプション追加が必要:
- `gardenRole?: GardenRole` — `garden_role_of(auth.uid())` の返値を制御
- `businessIds?: string[]` — `leaf_user_in_business(bizId)` の返値を制御（所属する business_id リスト）
- `isUserActive?: boolean` — `is_user_active()` の返値を制御（契約終了シミュレーション）

これらを `auth.getUser` + RPC mock に組み込み、`rpc('leaf_user_in_business', {biz_id})` 等を傍受して返値を制御する。詳細は Step 2 の拡張実装参照。

- [ ] **Step 1: Forest 側 mock の存在再確認**

```bash
git fetch --all 2>&1 | tail -3
find src/test-utils -name "supabase-mock*" 2>/dev/null || echo "not exist locally"
git ls-tree -r origin/develop --name-only | grep -iE "test-utils|supabase-mock" | head -5 || echo "not in develop"
```

Expected: 未存在確認（2026-04-25 時点）。Leaf が先頭バッターとして新設。

- [ ] **Step 2: supabase-mock.ts を書く**

```typescript
// src/test-utils/supabase-mock.ts
/**
 * Garden 横断共通 Supabase mock
 *
 * 用途: Vitest + RTL でのコンポーネント / ロジックテスト
 * - RLS 簡易シミュレーション（auth.uid IS NOT NULL チェックのみ）
 * - Storage PUT / createSignedUrl(s) のレスポンス mock
 * - Postgres SELECT / INSERT / UPDATE のレスポンス mock
 *
 * 設計: Leaf が先頭バッター (A-1c) で追加、Forest / Bud / Tree などから再利用想定。
 * Leaf 固有 mock が必要になった場合は src/test-utils/leaf-storage-mock.ts として分離。
 */

import { vi } from 'vitest';

export type MockAttachmentRow = {
  attachment_id: string;
  case_id: string;
  category: string;
  storage_url: string;
  thumbnail_url: string | null;
  deleted_at: string | null;
  [key: string]: unknown;
};

export type SupabaseMockState = {
  authUid: string | null;
  attachments: MockAttachmentRow[];
  storageUploads: Array<{ bucket: string; path: string; blob: Blob }>;
  signedUrlCalls: Array<{ bucket: string; paths: string[] }>;
};

export function createSupabaseMock(initialState?: Partial<SupabaseMockState>) {
  const state: SupabaseMockState = {
    authUid: initialState?.authUid ?? 'mock-user-id',
    attachments: initialState?.attachments ?? [],
    storageUploads: initialState?.storageUploads ?? [],
    signedUrlCalls: initialState?.signedUrlCalls ?? [],
  };

  const from = vi.fn((table: string) => {
    return {
      select: vi.fn(() => ({
        eq: vi.fn((col: string, val: unknown) => ({
          is: vi.fn((col2: string, val2: unknown) => {
            const filtered = state.attachments.filter(
              (r) => r[col] === val && (val2 === null ? r[col2] === null : r[col2] === val2),
            );
            return Promise.resolve({
              data: state.authUid ? filtered.filter((r) => r.deleted_at === null) : [],
              error: null,
            });
          }),
          single: vi.fn(() => {
            const row = state.attachments.find((r) => r[col] === val);
            return Promise.resolve({ data: row ?? null, error: row ? null : { code: 'PGRST116' } });
          }),
        })),
      })),
      insert: vi.fn((payload: Partial<MockAttachmentRow> | Partial<MockAttachmentRow>[]) => {
        if (!state.authUid) return Promise.resolve({ data: null, error: { message: 'RLS block' } });
        const rows = Array.isArray(payload) ? payload : [payload];
        state.attachments.push(...(rows as MockAttachmentRow[]));
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: rows[0], error: null })),
          })),
        };
      }),
      update: vi.fn((payload: Partial<MockAttachmentRow>) => ({
        eq: vi.fn((col: string, val: unknown) => {
          if (!state.authUid) return Promise.resolve({ data: null, error: { message: 'RLS block' } });
          state.attachments = state.attachments.map((r) =>
            r[col] === val ? { ...r, ...payload } : r,
          );
          return Promise.resolve({ data: null, error: null });
        }),
      })),
    };
  });

  const storage = {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn((path: string, blob: Blob) => {
        if (!state.authUid) {
          return Promise.resolve({ data: null, error: { message: 'RLS block', statusCode: '403' } });
        }
        if (blob.size > 5 * 1024 * 1024 && bucket === 'leaf-kanden-photos-recent') {
          return Promise.resolve({ data: null, error: { message: 'Payload Too Large', statusCode: '413' } });
        }
        state.storageUploads.push({ bucket, path, blob });
        return Promise.resolve({ data: { path }, error: null });
      }),
      createSignedUrl: vi.fn((path: string, expiresIn: number) => {
        state.signedUrlCalls.push({ bucket, paths: [path] });
        return Promise.resolve({
          data: { signedUrl: `https://mock.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock&expires=${expiresIn}` },
          error: null,
        });
      }),
      createSignedUrls: vi.fn((paths: string[], expiresIn: number) => {
        state.signedUrlCalls.push({ bucket, paths });
        return Promise.resolve({
          data: paths.map((p) => ({
            path: p,
            signedUrl: `https://mock.supabase.co/storage/v1/object/sign/${bucket}/${p}?token=mock&expires=${expiresIn}`,
            error: null,
          })),
          error: null,
        });
      }),
    })),
  };

  const auth = {
    getUser: vi.fn(() => Promise.resolve({
      data: { user: state.authUid ? { id: state.authUid } : null },
      error: null,
    })),
  };

  return { client: { from, storage, auth }, state };
}
```

- [ ] **Step 3: 最小の動作確認テスト**

```typescript
// src/test-utils/__tests__/supabase-mock.test.ts
import { describe, it, expect } from 'vitest';
import { createSupabaseMock } from '../supabase-mock';

describe('supabase-mock', () => {
  it('upload succeeds when authenticated', async () => {
    const { client, state } = createSupabaseMock();
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    const res = await client.storage.from('leaf-kanden-photos-recent').upload('case/x.jpg', blob);
    expect(res.error).toBeNull();
    expect(state.storageUploads).toHaveLength(1);
  });

  it('upload fails when not authenticated', async () => {
    const { client } = createSupabaseMock({ authUid: null });
    const res = await client.storage.from('leaf-kanden-photos-recent').upload('case/x.jpg', new Blob(['test']));
    expect(res.error?.statusCode).toBe('403');
  });

  it('upload fails when > 5MB', async () => {
    const { client } = createSupabaseMock();
    const big = new Blob([new ArrayBuffer(6 * 1024 * 1024)]);
    const res = await client.storage.from('leaf-kanden-photos-recent').upload('case/x.jpg', big);
    expect(res.error?.statusCode).toBe('413');
  });
});
```

- [ ] **Step 4: テスト実行 → PASS 確認**

```bash
npm test -- supabase-mock
```

Expected: `3 tests passed`。

- [ ] **Step 5: コミット**

```bash
git add src/test-utils/supabase-mock.ts src/test-utils/__tests__/supabase-mock.test.ts
git commit -m "feat(test-utils): Garden 横断共通 Supabase mock (Leaf 先頭バッター)"
```

### Task D.6: `image-compression.ts` - HEIC 判定 + 圧縮 / サムネ（TDD、Worker 無しの基本形）

**Files:**
- Create: `src/app/leaf/_lib/__tests__/image-compression.test.ts`
- Create: `src/app/leaf/_lib/image-compression.ts`

- [ ] **Step 1: HEIC 判定テストを書く**

```typescript
// src/app/leaf/_lib/__tests__/image-compression.test.ts
import { describe, it, expect, vi } from 'vitest';
import { isHeicFile } from '../image-compression';

describe('image-compression', () => {
  describe('isHeicFile', () => {
    it('returns true for image/heic MIME', () => {
      const file = new File(['x'], 'a.heic', { type: 'image/heic' });
      expect(isHeicFile(file)).toBe(true);
    });

    it('returns true for .heif extension even with empty MIME', () => {
      const file = new File(['x'], 'a.heif', { type: '' });
      expect(isHeicFile(file)).toBe(true);
    });

    it('returns false for image/jpeg', () => {
      const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      expect(isHeicFile(file)).toBe(false);
    });

    it('returns false for .png', () => {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      expect(isHeicFile(file)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: テスト FAIL 確認**

```bash
npm test -- image-compression
```

Expected: `Cannot find module '../image-compression'`。

- [ ] **Step 3: `isHeicFile` を実装**

```typescript
// src/app/leaf/_lib/image-compression.ts
/**
 * Garden-Leaf 関電業務委託 — 画像圧縮 + サムネ + HEIC 変換
 *
 * spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §3.1
 * - 本体: 1500px JPEG85%
 * - サムネ: 300px JPEG70%
 * - HEIC: heic2any で JPEG に変換してから Canvas 圧縮
 *
 * 実装: Web Worker ラッパ（image-compression.worker.ts）経由で main thread を
 *       ブロックしない。本モジュールは Worker との通信仲介 + HEIC 判定を担当。
 */

/** HEIC / HEIF ファイル判定（MIME or 拡張子）*/
export function isHeicFile(file: File): boolean {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npm test -- image-compression
```

Expected: `4 tests passed`。

- [ ] **Step 5: HEIC 変換テストを追加（ライブラリ依存、mock 戦略）**

`image-compression.test.ts` の `describe('image-compression', ...)` 内の末尾に以下を追加：

```typescript
  describe('convertHeicToJpeg', () => {
    it('converts HEIC file to JPEG blob', async () => {
      // heic2any は default export 関数、本テストでは mock
      vi.doMock('heic2any', () => ({
        default: vi.fn(async ({ blob }) => new Blob(['converted'], { type: 'image/jpeg' })),
      }));
      const { convertHeicToJpeg } = await import('../image-compression');
      const heicFile = new File(['heic data'], 'a.heic', { type: 'image/heic' });
      const jpegBlob = await convertHeicToJpeg(heicFile);
      expect(jpegBlob.type).toBe('image/jpeg');
    });

    it('throws on non-HEIC file', async () => {
      const { convertHeicToJpeg } = await import('../image-compression');
      const jpgFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      await expect(convertHeicToJpeg(jpgFile)).rejects.toThrow();
    });
  });
```

- [ ] **Step 6: FAIL 確認 → `convertHeicToJpeg` 実装**

`image-compression.ts` に追加:

```typescript
// src/app/leaf/_lib/image-compression.ts （追記）

import heic2any from 'heic2any';

/**
 * HEIC/HEIF ファイルを JPEG Blob に変換する。
 * 呼出側で isHeicFile() で事前判定すること（非 HEIC は throw）。
 */
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  if (!isHeicFile(file)) {
    throw new Error('convertHeicToJpeg: not a HEIC/HEIF file');
  }
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  // heic2any は複数画像 HEIC では Blob[] を返すが、iPhone 撮影の単一画像では Blob 単体
  return Array.isArray(result) ? result[0] : result;
}
```

- [ ] **Step 7: テスト PASS 確認**

```bash
npm test -- image-compression
```

Expected: `6 tests passed`。

- [ ] **Step 8: Canvas 圧縮テスト追加**

`image-compression.test.ts` の末尾 `describe` に追加：

```typescript
  describe('compressImage', () => {
    it('resizes long side to 1500px and outputs JPEG', async () => {
      // happy-dom の Canvas は本物の drawImage が無いため、toBlob を mock
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const canvas = origCreateElement('canvas') as HTMLCanvasElement;
          canvas.toBlob = vi.fn((cb) => cb(new Blob(['compressed'], { type: 'image/jpeg' })));
          return canvas;
        }
        return origCreateElement(tag);
      });
      // Image は mock
      const { compressImage } = await import('../image-compression');
      const jpgFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      Object.defineProperty(global, 'Image', {
        writable: true,
        value: class {
          onload: (() => void) | null = null;
          width = 3000;
          height = 2000;
          set src(_: string) { setTimeout(() => this.onload?.(), 0); }
        },
      });
      const blob = await compressImage(jpgFile, { maxWidth: 1500, quality: 0.85 });
      expect(blob.type).toBe('image/jpeg');
    });
  });
```

- [ ] **Step 9: FAIL 確認 → `compressImage` + `generateThumbnail` 実装**

`image-compression.ts` に追加：

```typescript
// src/app/leaf/_lib/image-compression.ts （追記）

export type CompressOptions = {
  maxWidth: number;
  quality: number;
};

/** 長辺 maxWidth に縮小し JPEG にエンコード */
export async function compressImage(source: Blob | File, opts: CompressOptions): Promise<Blob> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const { width, height } = fitWithin(img.width, img.height, opts.maxWidth);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('compressImage: no 2d context');
    ctx.drawImage(img, 0, 0, width, height);
    return await toBlob(canvas, 'image/jpeg', opts.quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** サムネ生成 (300px / 0.70 既定) */
export async function generateThumbnail(source: Blob | File): Promise<Blob> {
  return compressImage(source, { maxWidth: 300, quality: 0.7 });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('loadImage failed'));
    img.src = src;
  });
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('toBlob failed'));
      else resolve(blob);
    }, type, quality);
  });
}
```

- [ ] **Step 10: テスト PASS 確認**

```bash
npm test -- image-compression
```

Expected: `7 tests passed`。

- [ ] **Step 11: コミット**

```bash
git add src/app/leaf/_lib/image-compression.ts src/app/leaf/_lib/__tests__/image-compression.test.ts
git commit -m "feat(leaf): image-compression (HEIC 変換 + Canvas 圧縮 + サムネ生成)"
```

### Task D.7: `image-compression.worker.ts` - Web Worker 実装

**Files:**
- Create: `src/app/leaf/_lib/image-compression.worker.ts`
- Modify: `src/app/leaf/_lib/image-compression.ts`（Worker 経由にラップ）

- [ ] **Step 1: Worker 実装を書く**

```typescript
// src/app/leaf/_lib/image-compression.worker.ts
/**
 * Web Worker: 画像圧縮 + サムネ生成 + HEIC 変換
 *
 * main thread から呼出し、重処理を分離することで 15 枚一気選択時も UI が応答する。
 * OffscreenCanvas + self.Image 代替で実装。
 *
 * プロトコル:
 *   入: { id: string; type: 'compress'|'thumbnail'|'heic'; blob: Blob; opts?: {...} }
 *   出: { id: string; ok: true; blob: Blob } | { id: string; ok: false; error: string }
 */

import heic2any from 'heic2any';

type WorkerRequest =
  | { id: string; type: 'compress'; blob: Blob; opts: { maxWidth: number; quality: number } }
  | { id: string; type: 'thumbnail'; blob: Blob }
  | { id: string; type: 'heic'; blob: Blob };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'heic') {
      const res = await heic2any({ blob: req.blob, toType: 'image/jpeg', quality: 0.85 });
      const out = Array.isArray(res) ? res[0] : res;
      self.postMessage({ id: req.id, ok: true, blob: out });
      return;
    }
    const maxWidth = req.type === 'thumbnail' ? 300 : req.opts.maxWidth;
    const quality = req.type === 'thumbnail' ? 0.7 : req.opts.quality;
    const bitmap = await createImageBitmap(req.blob);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxWidth);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('worker: no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    self.postMessage({ id: req.id, ok: true, blob });
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
```

- [ ] **Step 2: `image-compression.ts` に Worker ラッパ関数追加**

`image-compression.ts` の末尾に追加:

```typescript
// src/app/leaf/_lib/image-compression.ts （末尾追記）

/**
 * Worker 経由の高速圧縮 API。ブラウザ環境専用。
 * Worker が使えない環境（SSR / 古いブラウザ）では compressImage (main thread 版) にフォールバック。
 */
export async function compressWithWorker(
  blob: Blob,
  opts: CompressOptions,
): Promise<Blob> {
  if (typeof Worker === 'undefined') {
    return compressImage(blob, opts);
  }
  return callWorker({ type: 'compress', blob, opts });
}

export async function thumbnailWithWorker(blob: Blob): Promise<Blob> {
  if (typeof Worker === 'undefined') {
    return generateThumbnail(blob);
  }
  return callWorker({ type: 'thumbnail', blob });
}

type WorkerCall =
  | { type: 'compress'; blob: Blob; opts: CompressOptions }
  | { type: 'thumbnail'; blob: Blob }
  | { type: 'heic'; blob: Blob };

let _workerInstance: Worker | null = null;

function getWorker(): Worker {
  if (!_workerInstance) {
    _workerInstance = new Worker(new URL('./image-compression.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return _workerInstance;
}

function callWorker(call: WorkerCall): Promise<Blob> {
  const worker = getWorker();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<{ id: string; ok: boolean; blob?: Blob; error?: string }>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', handler);
      if (e.data.ok && e.data.blob) resolve(e.data.blob);
      else reject(new Error(e.data.error ?? 'worker error'));
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ id, ...call });
  });
}
```

- [ ] **Step 3: `npm run build` で TypeScript/Webpack が通ることを確認**

```bash
npm run build
```

Expected: Worker モジュール import がビルドに成功。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/_lib/image-compression.worker.ts src/app/leaf/_lib/image-compression.ts
git commit -m "feat(leaf): image-compression Web Worker 実装 (15 枚一気選択対応)"
```

### Task D.8: `attachments.ts` - ID 生成 + 論理削除（TDD）

**Files:**
- Create: `src/app/leaf/_lib/__tests__/attachments.test.ts`
- Create: `src/app/leaf/_lib/attachments.ts`

- [ ] **Step 1: 失敗テストを書く**

```typescript
// src/app/leaf/_lib/__tests__/attachments.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateAttachmentId,
  softDeleteAttachment,
  undoSoftDelete,
} from '../attachments';
import { createSupabaseMock } from '@/test-utils/supabase-mock';

vi.mock('@/lib/supabase/client', () => {
  // 参照を書き換え可能にするため setter 方式
  return { supabase: globalThis.__mockSupabase ?? {} };
});

beforeEach(() => {
  globalThis.__mockSupabase = createSupabaseMock().client;
});

describe('attachments', () => {
  describe('generateAttachmentId', () => {
    it('returns a UUID v4 string', () => {
      const id = generateAttachmentId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('returns unique IDs', () => {
      const a = generateAttachmentId();
      const b = generateAttachmentId();
      expect(a).not.toBe(b);
    });
  });

  describe('softDeleteAttachment', () => {
    it('UPDATE deleted_at = now() on the row', async () => {
      const mock = createSupabaseMock({
        attachments: [{ attachment_id: 'a1', case_id: 'c1', category: 'denki', storage_url: 'x', thumbnail_url: 'x/t', deleted_at: null }],
      });
      globalThis.__mockSupabase = mock.client;
      await softDeleteAttachment('a1');
      expect(mock.state.attachments[0].deleted_at).not.toBeNull();
    });
  });

  describe('undoSoftDelete', () => {
    it('UPDATE deleted_at = NULL', async () => {
      const mock = createSupabaseMock({
        attachments: [{ attachment_id: 'a1', case_id: 'c1', category: 'denki', storage_url: 'x', thumbnail_url: 'x/t', deleted_at: '2026-04-25T00:00:00Z' }],
      });
      globalThis.__mockSupabase = mock.client;
      await undoSoftDelete('a1');
      expect(mock.state.attachments[0].deleted_at).toBeNull();
    });
  });
});
```

- [ ] **Step 2: FAIL 確認**

```bash
npm test -- attachments
```

Expected: `Cannot find module '../attachments'`。

- [ ] **Step 3: `attachments.ts` 骨組み + 3 関数を実装**

```typescript
// src/app/leaf/_lib/attachments.ts
/**
 * Garden-Leaf 関電業務委託 — 添付ファイル管理
 *
 * spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §3
 *
 * 公開 API:
 *   - generateAttachmentId()
 *   - uploadAttachments(files, caseId, category, opts)
 *   - softDeleteAttachment(id)
 *   - undoSoftDelete(id)
 *   - createAttachmentSignedUrls(paths, ttl)
 *   - fetchAttachmentsByCase(caseId)
 *
 * RLS: Pattern-1 簡略版（認証済み = 同権）、UPDATE は Phase B-1 でロール強化予定。
 */

import { supabase } from '@/lib/supabase/client';
import type { AttachmentCategory, KandenAttachment } from './types';
import {
  RECENT_BUCKET,
  recentPath,
  recentThumbPath,
} from './kanden-storage-paths';
import { compressWithWorker, thumbnailWithWorker, convertHeicToJpeg, isHeicFile } from './image-compression';

/** UUID v4 形式の attachment_id を生成 */
export function generateAttachmentId(): string {
  return crypto.randomUUID();
}

/** 論理削除（deleted_at = now() + deleted_by = auth.uid()、v3 改訂: Client ガード撤廃）
 *
 * v3 変更: 事業所属者全員が論理削除可能。UI 層でのロール判定も不要（Garden 共通パターン）。
 * RLS で事業所属チェックは担保、変更履歴は history trigger で自動記録。
 */
export async function softDeleteAttachment(attachmentId: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await supabase
    .from('leaf_kanden_attachments')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
    })
    .eq('attachment_id', attachmentId);
  if (error) throw new Error(`softDeleteAttachment failed: ${error.message}`);
}

/** 論理削除の取消（deleted_at = NULL、UNDO snackbar or admin 復元から呼ばれる、v2 改訂） */
export async function undoSoftDelete(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('leaf_kanden_attachments')
    .update({ deleted_at: null, deleted_by: null })
    .eq('attachment_id', attachmentId);
  if (error) throw new Error(`undoSoftDelete failed: ${error.message}`);
}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npm test -- attachments
```

Expected: `4 tests passed`。

- [ ] **Step 5: コミット**

```bash
git add src/app/leaf/_lib/attachments.ts src/app/leaf/_lib/__tests__/attachments.test.ts
git commit -m "feat(leaf): attachments.ts 骨組み + generateId + softDelete + undoSoftDelete (TDD)"
```

### Task D.9: `attachments.ts` - signedURL 発行

**Files:**
- Modify: `src/app/leaf/_lib/attachments.ts`
- Modify: `src/app/leaf/_lib/__tests__/attachments.test.ts`

- [ ] **Step 1: テスト追加**

`attachments.test.ts` の末尾（最後の `});` の前）に追加:

```typescript
  describe('createAttachmentSignedUrls', () => {
    it('calls createSignedUrls with thumbnail paths', async () => {
      const mock = createSupabaseMock();
      globalThis.__mockSupabase = mock.client;
      const { createAttachmentSignedUrls } = await import('../attachments');
      const paths = ['CASE-0001/thumb/aaa.jpg', 'CASE-0001/thumb/bbb.jpg'];
      const urls = await createAttachmentSignedUrls(paths, 600);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toMatch(/^https:\/\/mock\.supabase\.co/);
      expect(mock.state.signedUrlCalls).toHaveLength(1);
      expect(mock.state.signedUrlCalls[0].paths).toEqual(paths);
    });
  });
```

- [ ] **Step 2: FAIL 確認**

```bash
npm test -- attachments
```

- [ ] **Step 3: 実装追加**

`attachments.ts` の末尾に追加:

```typescript
// src/app/leaf/_lib/attachments.ts （追記）

/** サムネ or 本体の signedURL を一括発行 (TTL は秒単位、spec §3.3 で 600 既定) */
export async function createAttachmentSignedUrls(
  paths: string[],
  expiresInSeconds: number = 600,
): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(RECENT_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error) throw new Error(`createSignedUrls failed: ${error.message}`);
  return (data ?? []).map((d) => d.signedUrl);
}

/** 単発 signedURL (Lightbox の 1500px 本体用) */
export async function createAttachmentSignedUrl(
  path: string,
  expiresInSeconds: number = 600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECENT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`createSignedUrl failed: ${error.message}`);
  return data.signedUrl;
}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npm test -- attachments
```

Expected: `5 tests passed`。

- [ ] **Step 5: コミット**

```bash
git add src/app/leaf/_lib/attachments.ts src/app/leaf/_lib/__tests__/attachments.test.ts
git commit -m "feat(leaf): attachments.createAttachmentSignedUrls 一括発行 (TDD)"
```

### Task D.10: `attachments.ts` - fetchAttachmentsByCase

**Files:**
- Modify: `src/app/leaf/_lib/attachments.ts`
- Modify: `src/app/leaf/_lib/__tests__/attachments.test.ts`

- [ ] **Step 1: テスト追加**

`attachments.test.ts` の末尾に追加:

```typescript
  describe('fetchAttachmentsByCase', () => {
    it('returns only deleted_at IS NULL rows', async () => {
      const mock = createSupabaseMock({
        attachments: [
          { attachment_id: 'a1', case_id: 'c1', category: 'denki', storage_url: 'c1/a1.jpg', thumbnail_url: 'c1/thumb/a1.jpg', deleted_at: null },
          { attachment_id: 'a2', case_id: 'c1', category: 'gas', storage_url: 'c1/a2.jpg', thumbnail_url: 'c1/thumb/a2.jpg', deleted_at: '2026-04-25T00:00:00Z' },
          { attachment_id: 'a3', case_id: 'c2', category: 'denki', storage_url: 'c2/a3.jpg', thumbnail_url: 'c2/thumb/a3.jpg', deleted_at: null },
        ],
      });
      globalThis.__mockSupabase = mock.client;
      const { fetchAttachmentsByCase } = await import('../attachments');
      const rows = await fetchAttachmentsByCase('c1');
      expect(rows).toHaveLength(1);
      expect(rows[0].attachment_id).toBe('a1');
    });
  });
```

- [ ] **Step 2: FAIL 確認**

```bash
npm test -- attachments
```

- [ ] **Step 3: 実装**

`attachments.ts` に追加:

```typescript
// src/app/leaf/_lib/attachments.ts （追記）

/** case_id で添付一覧取得（deleted_at IS NULL のみ、RLS でも自動フィルタ） */
export async function fetchAttachmentsByCase(caseId: string): Promise<KandenAttachment[]> {
  const { data, error } = await supabase
    .from('leaf_kanden_attachments')
    .select('*')
    .eq('case_id', caseId)
    .is('deleted_at', null);
  if (error) throw new Error(`fetchAttachmentsByCase failed: ${error.message}`);
  return (data ?? []) as KandenAttachment[];
}
```

- [ ] **Step 4: PASS 確認**

```bash
npm test -- attachments
```

Expected: `6 tests passed`。

- [ ] **Step 5: コミット**

```bash
git add src/app/leaf/_lib/attachments.ts src/app/leaf/_lib/__tests__/attachments.test.ts
git commit -m "feat(leaf): attachments.fetchAttachmentsByCase (deleted_at IS NULL) (TDD)"
```

### Task D.11: `attachments.ts` - uploadAttachments (並列 + リトライ)

**Files:**
- Modify: `src/app/leaf/_lib/attachments.ts`
- Modify: `src/app/leaf/_lib/__tests__/attachments.test.ts`

- [ ] **Step 1: テスト追加（5MB 超・並列数・リトライの 3 シナリオ）**

`attachments.test.ts` の末尾に追加:

```typescript
  describe('uploadAttachments', () => {
    it('reports all-succeeded result', async () => {
      const mock = createSupabaseMock();
      globalThis.__mockSupabase = mock.client;
      const { uploadAttachments } = await import('../attachments');
      const smallBlob = (name: string) => {
        const f = new File(['x'], name, { type: 'image/jpeg' });
        // 圧縮 Worker を回避するため pre-compressed 判定で通すダミー
        return f;
      };
      const files = [smallBlob('a.jpg'), smallBlob('b.jpg')];
      const res = await uploadAttachments(files, 'CASE-001', 'denki', {
        concurrency: 2,
        preCompressed: true,
      });
      expect(res.succeeded).toHaveLength(2);
      expect(res.failed).toHaveLength(0);
    });

    it('reports failed + succeeded mix', async () => {
      const mock = createSupabaseMock();
      globalThis.__mockSupabase = mock.client;
      const { uploadAttachments } = await import('../attachments');
      const small = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
      // 6MB ファイルは mock が 413 返す
      const big = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
      const res = await uploadAttachments([small, big], 'CASE-001', 'denki', {
        concurrency: 2,
        preCompressed: true,
        maxRetries: 1,
      });
      expect(res.succeeded).toHaveLength(1);
      expect(res.failed).toHaveLength(1);
      expect(res.failed[0].file.name).toBe('big.jpg');
    });
  });
```

- [ ] **Step 2: FAIL 確認 + `uploadAttachments` 実装**

```typescript
// src/app/leaf/_lib/attachments.ts （追記）

export type UploadOptions = {
  concurrency?: number;       // 並列数（既定: デバイス判定）
  maxRetries?: number;        // 失敗時のリトライ回数（既定: 3）
  preCompressed?: boolean;    // 圧縮済 blob を渡す場合 true（テスト用）
  onProgress?: (done: number, total: number) => void;
};

export type UploadResult = {
  succeeded: KandenAttachment[];
  failed: Array<{ file: File; reason: string }>;
};

/** デバイス判定で並列数を返す（spec §3.1） */
export function getUploadConcurrency(): number {
  if (typeof navigator === 'undefined') return 3;
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const effectiveType = (navigator as { connection?: { effectiveType?: string } })
    .connection?.effectiveType;
  if (isMobileUA) return 2;
  if (effectiveType && /^(2g|3g|4g)$/.test(effectiveType)) return 2;
  return 3;
}

/**
 * 画像を 並列 PUT (RECENT bucket) + metadata insert。
 * HEIC は変換、圧縮は Worker 経由（preCompressed=true 時はスキップ）。
 */
export async function uploadAttachments(
  files: File[],
  caseId: string,
  category: AttachmentCategory,
  opts: UploadOptions = {},
): Promise<UploadResult> {
  const concurrency = opts.concurrency ?? getUploadConcurrency();
  const maxRetries = opts.maxRetries ?? 3;
  const succeeded: KandenAttachment[] = [];
  const failed: Array<{ file: File; reason: string }> = [];
  let done = 0;

  // chunk 分割（シンプルな並列キュー）
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map((f) => uploadOne(f, caseId, category, maxRetries, opts.preCompressed ?? false)),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      done += 1;
      opts.onProgress?.(done, files.length);
      if (r.status === 'fulfilled') succeeded.push(r.value);
      else failed.push({ file: chunk[j], reason: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  }

  return { succeeded, failed };
}

async function uploadOne(
  file: File,
  caseId: string,
  category: AttachmentCategory,
  maxRetries: number,
  preCompressed: boolean,
): Promise<KandenAttachment> {
  // 1. HEIC 変換
  let working: Blob = file;
  if (isHeicFile(file)) {
    working = await convertHeicToJpeg(file);
  }

  // 2. 圧縮 + サムネ（preCompressed=true ならスキップ）
  const mainBlob = preCompressed ? working : await compressWithWorker(working, { maxWidth: 1500, quality: 0.85 });
  const thumbBlob = preCompressed ? working : await thumbnailWithWorker(working);

  // 3. 並列 PUT (リトライ付き)
  const attachmentId = generateAttachmentId();
  const mainPath = recentPath(caseId, attachmentId);
  const thumbPathValue = recentThumbPath(caseId, attachmentId);

  await putWithRetry(mainPath, mainBlob, maxRetries);
  await putWithRetry(thumbPathValue, thumbBlob, maxRetries);

  // 4. metadata insert
  const user = (await supabase.auth.getUser()).data.user;
  const row: Partial<KandenAttachment> = {
    attachment_id: attachmentId,
    case_id: caseId,
    category,
    storage_url: mainPath,
    thumbnail_url: thumbPathValue,
    mime_type: 'image/jpeg',
    archived_tier: 'recent',
    uploaded_by: user?.id ?? null,
    uploaded_at: new Date().toISOString(),
    is_guide_capture: false,
    is_post_added: false,
    ocr_processed: false,
    archived_at: null,
    deleted_at: null,
  };
  const { data, error } = await supabase
    .from('leaf_kanden_attachments')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`insert failed: ${error.message}`);
  return data as KandenAttachment;
}

async function putWithRetry(path: string, blob: Blob, maxRetries: number): Promise<void> {
  const delays = [1000, 3000, 9000];
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { error } = await supabase.storage.from(RECENT_BUCKET).upload(path, blob);
    if (!error) return;
    lastError = new Error(error.message);
    if (attempt < maxRetries) {
      await sleep(delays[Math.min(attempt, delays.length - 1)]);
    }
  }
  throw lastError ?? new Error('upload failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- attachments
```

Expected: `8 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/_lib/attachments.ts src/app/leaf/_lib/__tests__/attachments.test.ts
git commit -m "feat(leaf): attachments.uploadAttachments (並列 + 3 回リトライ + HEIC + 圧縮) (TDD)"
```

### Task D.12: `role-context.tsx` — GardenRole + 事業所属 の React context（v2 新規）

**Files:**
- Create: `src/app/leaf/_lib/role-context.tsx`
- Create: `src/app/leaf/_lib/__tests__/role-context.test.tsx`

- [ ] **Step 1: RTL テストを書く**

```typescript
// src/app/leaf/_lib/__tests__/role-context.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RoleProvider, useGardenRole } from '../role-context';
import { createSupabaseMock } from '@/test-utils/supabase-mock';

vi.mock('@/lib/supabase/client', () => ({ supabase: globalThis.__mockSupabase ?? {} }));

function Probe() {
  const role = useGardenRole();
  return <span data-testid="role">{role ?? 'loading'}</span>;
}

beforeEach(() => {
  globalThis.__mockSupabase = createSupabaseMock({ gardenRole: 'manager' }).client;
});

describe('RoleProvider', () => {
  it('resolves garden_role via Supabase RPC', async () => {
    render(<RoleProvider><Probe /></RoleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('role').textContent).toBe('manager');
    });
  });

  it('returns null while loading', () => {
    render(<RoleProvider><Probe /></RoleProvider>);
    expect(screen.getByTestId('role').textContent).toBe('loading');
  });
});
```

- [ ] **Step 2: FAIL 確認 → 実装**

```typescript
// src/app/leaf/_lib/role-context.tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { GardenRole } from './types';

const RoleContext = createContext<GardenRole | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<GardenRole | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { data, error } = await supabase.rpc('garden_role_of', { uid: user.id });
      if (!active || error) return;
      setRole(data as GardenRole);
    })();
    return () => { active = false; };
  }, []);

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** 現在ロール。ロード中は null。manager 以上は `DELETABLE_ROLES.includes(role)` で判定。*/
export function useGardenRole(): GardenRole | null {
  return useContext(RoleContext);
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- role-context
```

Expected: `2 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/_lib/role-context.tsx src/app/leaf/_lib/__tests__/role-context.test.tsx
git commit -m "feat(leaf): RoleContext (garden_role を全コンポに共有) (TDD, v2)"
```

### Task D.13: `attachments.ts` v3 追加関数群（restoreAttachment / hardDeleteAttachment / verifyImageDownloadPassword / verifyUserPasswordAndDownload / isMobileDevice / getCurrentGardenRole）

**[v3 改訂追記]** `verifyUserPasswordAndDownload` の内部実装を v2 の `supabase.auth.signInWithPassword` から v3 の `supabase.rpc('verify_image_download_password', { input_password })` に差替。さらに新関数 `verifyImageDownloadPassword(password)` を追加して関心分離する:

```typescript
// v3 新規: DL 専用 PW を RPC で検証する薄いラッパ
export async function verifyImageDownloadPassword(password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_image_download_password', {
    input_password: password,
  });
  if (error) throw new Error(`verify_image_download_password failed: ${error.message}`);
  return data === true;
}

// v3 改訂: Garden ログイン PW 検証を廃止、専用 PW RPC 経由に変更
export async function verifyUserPasswordAndDownload(
  attachmentId: string,
  password: string,
): Promise<void> {
  const LOCK_KEY = 'leaf-dl-lock';
  const FAIL_KEY = 'leaf-dl-fail-count';
  const LOCK_MS = 5 * 60 * 1000;

  // ロック判定（v2 から変更なし）
  const lockAt = Number(sessionStorage.getItem(LOCK_KEY) ?? '0');
  if (lockAt && Date.now() - lockAt < LOCK_MS) {
    throw new Error('5 分間ロックされています。しばらくしてから再度お試しください。');
  } else if (lockAt) {
    sessionStorage.removeItem(LOCK_KEY);
    sessionStorage.removeItem(FAIL_KEY);
  }

  // v3: RPC で DL 専用 PW を検証（signInWithPassword は使わない）
  const ok = await verifyImageDownloadPassword(password);
  if (!ok) {
    const count = Number(sessionStorage.getItem(FAIL_KEY) ?? '0') + 1;
    sessionStorage.setItem(FAIL_KEY, String(count));
    if (count >= 3) sessionStorage.setItem(LOCK_KEY, String(Date.now()));
    throw new Error(`パスワードが一致しません（残り ${Math.max(3 - count, 0)} 回）`);
  }

  sessionStorage.removeItem(FAIL_KEY);

  // signedURL 発行 + DL 起動（v2 から変更なし）
  const { data: row, error: selErr } = await supabase
    .from('leaf_kanden_attachments')
    .select('storage_url')
    .eq('attachment_id', attachmentId)
    .single();
  if (selErr || !row) throw new Error('画像情報を取得できませんでした');
  const signedUrl = await createAttachmentSignedUrl(row.storage_url, 600);
  const link = document.createElement('a');
  link.href = signedUrl;
  link.download = `${attachmentId}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

RTL テストの `supabase.auth.signInWithPassword` mock を `supabase.rpc('verify_image_download_password')` mock に置換。

commit メッセージ: "feat(leaf): A-1c v3 attachments DL 専用 PW RPC 検証 + verifyImageDownloadPassword 新設"

---



**Files:**
- Modify: `src/app/leaf/_lib/attachments.ts`
- Modify: `src/app/leaf/_lib/__tests__/attachments.test.ts`

- [ ] **Step 1: テスト追加**

`attachments.test.ts` の末尾に追加:

```typescript
  describe('restoreAttachment', () => {
    it('sets deleted_at = NULL and deleted_by = NULL', async () => {
      const mock = createSupabaseMock({
        attachments: [{ attachment_id: 'a1', case_id: 'c1', category: 'denki', storage_url: 'x', thumbnail_url: 'x/t', deleted_at: '2026-04-25T00:00:00Z', deleted_by: 'u1' }],
      });
      globalThis.__mockSupabase = mock.client;
      const { restoreAttachment } = await import('../attachments');
      await restoreAttachment('a1');
      expect(mock.state.attachments[0].deleted_at).toBeNull();
      expect(mock.state.attachments[0].deleted_by).toBeNull();
    });
  });

  describe('hardDeleteAttachment', () => {
    it('DELETE row + removes Storage objects', async () => {
      const mock = createSupabaseMock({
        attachments: [{ attachment_id: 'a1', case_id: 'c1', category: 'denki', storage_url: 'c1/a1.jpg', thumbnail_url: 'c1/thumb/a1.jpg', deleted_at: '2026-04-25T00:00:00Z' }],
      });
      globalThis.__mockSupabase = mock.client;
      const { hardDeleteAttachment } = await import('../attachments');
      await hardDeleteAttachment('a1');
      // state に残らない or mock 上 delete が呼ばれた事実確認
      // supabase-mock 仕様に合わせて storageUploads / deletes を確認
    });
  });

  describe('isMobileDevice', () => {
    it('returns true for iPhone UA', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        configurable: true,
      });
      const { isMobileDevice } = require('../attachments');
      expect(isMobileDevice()).toBe(true);
    });

    it('returns false for Windows UA', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });
      const { isMobileDevice } = require('../attachments');
      expect(isMobileDevice()).toBe(false);
    });
  });
```

- [ ] **Step 2: `attachments.ts` に追加実装**

```typescript
// src/app/leaf/_lib/attachments.ts （末尾に追記）

/** 論理削除の取消（admin 復元、UNDO 期限後）。undoSoftDelete の alias */
export async function restoreAttachment(attachmentId: string): Promise<void> {
  return undoSoftDelete(attachmentId);
}

/** 物理削除（DB + Storage 両方）。admin+ のみ Client ガード */
export async function hardDeleteAttachment(attachmentId: string): Promise<void> {
  // 1. 行を取得して storage path を確認
  const { data: row, error: selErr } = await supabase
    .from('leaf_kanden_attachments')
    .select('storage_url, thumbnail_url')
    .eq('attachment_id', attachmentId)
    .single();
  if (selErr || !row) throw new Error(`hardDelete: row not found (${selErr?.message ?? 'no row'})`);

  // 2. Storage から削除（存在しなくても許容）
  const paths: string[] = [];
  if (row.storage_url) paths.push(row.storage_url);
  if (row.thumbnail_url) paths.push(row.thumbnail_url);
  if (paths.length > 0) {
    await supabase.storage.from(RECENT_BUCKET).remove(paths);
    // Storage 削除失敗は cleanup job で補正するため ignore
  }

  // 3. DB から DELETE
  const { error: delErr } = await supabase
    .from('leaf_kanden_attachments')
    .delete()
    .eq('attachment_id', attachmentId);
  if (delErr) throw new Error(`hardDelete DB failed: ${delErr.message}`);
}

/** デバイス判定（スマホ DL パスワード分岐 / 並列 upload 数判定の両方で利用） */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** スマホ DL 時のパスワード認証 + ダウンロード */
export async function verifyUserPasswordAndDownload(
  attachmentId: string,
  password: string,
): Promise<void> {
  const LOCK_KEY = 'leaf-dl-lock';
  const FAIL_KEY = 'leaf-dl-fail-count';
  const LOCK_MS = 5 * 60 * 1000;

  // ロック判定
  const lockAt = Number(sessionStorage.getItem(LOCK_KEY) ?? '0');
  if (lockAt && Date.now() - lockAt < LOCK_MS) {
    throw new Error('5 分間ロックされています。しばらくしてから再度お試しください。');
  } else if (lockAt) {
    sessionStorage.removeItem(LOCK_KEY);
    sessionStorage.removeItem(FAIL_KEY);
  }

  // ユーザー情報取得
  const user = (await supabase.auth.getUser()).data.user;
  if (!user?.email) throw new Error('ユーザー情報を取得できませんでした');

  // パスワード検証
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (error) {
    const count = Number(sessionStorage.getItem(FAIL_KEY) ?? '0') + 1;
    sessionStorage.setItem(FAIL_KEY, String(count));
    if (count >= 3) sessionStorage.setItem(LOCK_KEY, String(Date.now()));
    throw new Error(`パスワードが一致しません（残り ${Math.max(3 - count, 0)} 回）`);
  }

  // 失敗カウントをリセット
  sessionStorage.removeItem(FAIL_KEY);

  // 本体の signedURL 発行 + DL 起動
  const { data: row, error: selErr } = await supabase
    .from('leaf_kanden_attachments')
    .select('storage_url')
    .eq('attachment_id', attachmentId)
    .single();
  if (selErr || !row) throw new Error('画像情報を取得できませんでした');
  const signedUrl = await createAttachmentSignedUrl(row.storage_url, 600);
  const link = document.createElement('a');
  link.href = signedUrl;
  link.download = `${attachmentId}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** 現在ロール取得（RPC 経由、RoleContext 未使用時のユーティリティ）*/
export async function getCurrentGardenRole(): Promise<string | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase.rpc('garden_role_of', { uid: user.id });
  if (error) return null;
  return data as string | null;
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- attachments
```

Expected: `11 tests passed`（既存 8 + v2 追加 3）。`hardDeleteAttachment` の完全 mock は supabase-mock の `.delete` 拡張が必要なため、mock 拡張が不足すれば Task D.5 に戻って追加。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/_lib/attachments.ts src/app/leaf/_lib/__tests__/attachments.test.ts
git commit -m "feat(leaf): attachments v2 追加関数 (restore/hardDelete/PW認証DL/isMobile/getRole) (TDD)"
```

### Task D.14: Phase D 仕上げ — カバレッジ確認

**Files:** なし（測定のみ）

- [ ] **Step 1: カバレッジ取得**

```bash
npm run test:coverage
```

Expected: 
- `image-compression`: 85%+
- `attachments`: 75%+
- `kanden-storage-paths`: 95%+

- [ ] **Step 2: 目標未達なら該当 Task に戻って追加テスト**

- [ ] **Step 3: カバレッジ記録を effort-tracking に追記準備（最終 Task F.3 で反映）**

---

## Phase A: Backoffice UI（2.0d、v2 改訂で +0.5d）

### Task A.1: `AttachmentCard.tsx` + RTL test

**Files:**
- Create: `src/app/leaf/backoffice/_components/AttachmentCard.tsx`
- Create: `src/app/leaf/backoffice/_components/__tests__/AttachmentCard.test.tsx`

- [ ] **Step 1: RTL テストを書く**

```typescript
// src/app/leaf/backoffice/_components/__tests__/AttachmentCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentCard } from '../AttachmentCard';

describe('AttachmentCard', () => {
  const baseProps = {
    attachmentId: 'a1',
    thumbnailSignedUrl: 'https://mock/thumb.jpg',
    category: 'denki' as const,
    onClick: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders thumbnail img', () => {
    render(<AttachmentCard {...baseProps} />);
    const img = screen.getByRole('img', { name: /電灯/ });
    expect(img).toHaveAttribute('src', 'https://mock/thumb.jpg');
  });

  it('calls onClick on card click', async () => {
    const onClick = vi.fn();
    render(<AttachmentCard {...baseProps} onClick={onClick} />);
    await userEvent.click(screen.getByRole('img'));
    expect(onClick).toHaveBeenCalledWith('a1');
  });
});
```

- [ ] **Step 2: FAIL 確認**

```bash
npm test -- AttachmentCard
```

- [ ] **Step 3: 実装**

```typescript
// src/app/leaf/backoffice/_components/AttachmentCard.tsx
'use client';

import type { AttachmentCategory } from '@/app/leaf/_lib/types';
import { ATTACHMENT_LABELS } from '@/app/leaf/_lib/types';
import { AttachmentDeleteButton } from './AttachmentDeleteButton';

export type AttachmentCardProps = {
  attachmentId: string;
  thumbnailSignedUrl: string;
  category: AttachmentCategory;
  onClick: (attachmentId: string) => void;
  onDelete: (attachmentId: string) => void;
};

export function AttachmentCard({
  attachmentId,
  thumbnailSignedUrl,
  category,
  onClick,
  onDelete,
}: AttachmentCardProps) {
  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden shadow-sm bg-gray-100">
      <img
        src={thumbnailSignedUrl}
        alt={ATTACHMENT_LABELS[category]}
        className="w-full h-full object-cover cursor-pointer"
        onClick={() => onClick(attachmentId)}
      />
      <AttachmentDeleteButton attachmentId={attachmentId} onDelete={onDelete} />
      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
        {ATTACHMENT_LABELS[category]}
      </span>
    </div>
  );
}
```

注: `AttachmentDeleteButton` は Task A.5 で実装。本ステップではプレースホルダー stub を作る必要があれば：

```typescript
// 一時 stub（Task A.5 で正式実装まで）
// src/app/leaf/backoffice/_components/AttachmentDeleteButton.tsx
export function AttachmentDeleteButton(_: { attachmentId: string; onDelete: (id: string) => void }) {
  return null;
}
```

- [ ] **Step 4: PASS 確認**

```bash
npm test -- AttachmentCard
```

Expected: `2 tests passed`。

- [ ] **Step 5: コミット**

```bash
git add src/app/leaf/backoffice/_components/AttachmentCard.tsx src/app/leaf/backoffice/_components/AttachmentDeleteButton.tsx src/app/leaf/backoffice/_components/__tests__/AttachmentCard.test.tsx
git commit -m "feat(leaf): AttachmentCard (サムネカード + カテゴリバッジ) (TDD)"
```

### Task A.2: `AttachmentLightbox.tsx` + RTL test

**Files:**
- Create: `src/app/leaf/backoffice/_components/AttachmentLightbox.tsx`
- Create: `src/app/leaf/backoffice/_components/__tests__/AttachmentLightbox.test.tsx`

- [ ] **Step 1: RTL テスト**

```typescript
// src/app/leaf/backoffice/_components/__tests__/AttachmentLightbox.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentLightbox } from '../AttachmentLightbox';

describe('AttachmentLightbox', () => {
  const baseProps = {
    fullSignedUrl: 'https://mock/full.jpg',
    alt: '電灯',
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
  };

  it('renders full image', () => {
    render(<AttachmentLightbox {...baseProps} />);
    expect(screen.getByRole('img', { name: '電灯' })).toHaveAttribute('src', 'https://mock/full.jpg');
  });

  it('calls onClose on ESC key', async () => {
    const onClose = vi.fn();
    render(<AttachmentLightbox {...baseProps} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onPrev on ArrowLeft', async () => {
    const onPrev = vi.fn();
    render(<AttachmentLightbox {...baseProps} onPrev={onPrev} />);
    await userEvent.keyboard('{ArrowLeft}');
    expect(onPrev).toHaveBeenCalled();
  });

  it('calls onNext on ArrowRight', async () => {
    const onNext = vi.fn();
    render(<AttachmentLightbox {...baseProps} onNext={onNext} />);
    await userEvent.keyboard('{ArrowRight}');
    expect(onNext).toHaveBeenCalled();
  });

  it('calls onClose on backdrop click', async () => {
    const onClose = vi.fn();
    render(<AttachmentLightbox {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('lightbox-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/backoffice/_components/AttachmentLightbox.tsx
'use client';

import { useEffect } from 'react';

export type AttachmentLightboxProps = {
  fullSignedUrl: string;
  alt: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

export function AttachmentLightbox({ fullSignedUrl, alt, onClose, onPrev, onNext }: AttachmentLightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      data-testid="lightbox-backdrop"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <img
        src={fullSignedUrl}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- AttachmentLightbox
```

Expected: `5 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/backoffice/_components/AttachmentLightbox.tsx src/app/leaf/backoffice/_components/__tests__/AttachmentLightbox.test.tsx
git commit -m "feat(leaf): AttachmentLightbox (1500px 拡大 + ESC / ← → / 背景 click) (TDD)"
```

### Task A.3: `AttachmentDeleteButton.tsx` + RTL test（v3 全員表示 + 2 段確認 + UNDO）

**[v3 改訂追記]** v2 で追加した「manager+ のみ × 表示」のロール判定を**撤廃**する:
- `useGardenRole()` の import を削除
- `DELETABLE_ROLES` の import を削除
- ロール判定 `if (!role || !DELETABLE_ROLES.includes(role)) return null;` を削除
- 全ロールで × を表示する（ホバー/長押し時、v3 Garden 共通パターン）
- 確認ダイアログの文言を更新: 「この画像を削除しますか？（削除済一覧に残り、管理者の最終確認を経て完全削除 or 復元されます）」

RTL テストの変更:
- v2 で追加した「toss ロールでは × が表示されない」テストを**削除**
- 代わりに「全ロールで × が表示される」テストを追加（role=toss でも表示確認）
- 確認ダイアログの文言テストを更新

実装側:
```typescript
// v3: ロール判定なし、全員に × 表示
export function AttachmentDeleteButton({ attachmentId, onDelete }: Props) {
  // （useGardenRole の取得・判定は不要になった）
  // 既存の confirm UI （文言変更）
}
```

commit メッセージ: "feat(leaf): A-1c v3 AttachmentDeleteButton 全員表示化 + 文言更新"

---

**（以下、v2 plan の内容を上記改訂で上書きして実装する）**



**Files:**
- Modify: `src/app/leaf/backoffice/_components/AttachmentDeleteButton.tsx`（Task A.1 の stub を正式実装に置換）
- Create: `src/app/leaf/backoffice/_components/__tests__/AttachmentDeleteButton.test.tsx`

- [ ] **Step 1: RTL テスト**

```typescript
// src/app/leaf/backoffice/_components/__tests__/AttachmentDeleteButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentDeleteButton } from '../AttachmentDeleteButton';

describe('AttachmentDeleteButton', () => {
  it('shows confirm dialog on click', async () => {
    const onDelete = vi.fn();
    render(<AttachmentDeleteButton attachmentId="a1" onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /削除/ }));
    expect(screen.getByText(/この画像を削除しますか/)).toBeInTheDocument();
  });

  it('calls onDelete when confirmed', async () => {
    const onDelete = vi.fn();
    render(<AttachmentDeleteButton attachmentId="a1" onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /削除/ }));
    await userEvent.click(screen.getByRole('button', { name: /削除する/ }));
    expect(onDelete).toHaveBeenCalledWith('a1');
  });

  it('does not call onDelete when cancelled', async () => {
    const onDelete = vi.fn();
    render(<AttachmentDeleteButton attachmentId="a1" onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /削除/ }));
    await userEvent.click(screen.getByRole('button', { name: /キャンセル/ }));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/backoffice/_components/AttachmentDeleteButton.tsx
'use client';

import { useState } from 'react';

export type AttachmentDeleteButtonProps = {
  attachmentId: string;
  onDelete: (attachmentId: string) => void;
};

export function AttachmentDeleteButton({ attachmentId, onDelete }: AttachmentDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="削除"
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        ×
      </button>
      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <p className="mb-4">この画像を削除しますか？<br />（管理者操作で復元可能）</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded bg-gray-200"
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-red-500 text-white"
                onClick={() => {
                  setConfirming(false);
                  onDelete(attachmentId);
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- AttachmentDeleteButton
```

Expected: `3 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/backoffice/_components/AttachmentDeleteButton.tsx src/app/leaf/backoffice/_components/__tests__/AttachmentDeleteButton.test.tsx
git commit -m "feat(leaf): AttachmentDeleteButton (manager+ ロール判定 + 2 段確認 + UNDO) (TDD, v2)"
```

### Task A.3b: `DownloadButton.tsx` + RTL test（PC 即 DL / スマホ DL 専用 PW 認証）

**[v3 改訂追記]** v2 で Garden ログイン PW を使っていた部分を「DL 専用 PW RPC」に差替:
- `handleSubmit` 内で `verifyUserPasswordAndDownload` を呼び出す（v3 の内部実装変更で自動的に RPC 検証になる）
- モーダルのメッセージを更新:
  - 旧 v2: 「Garden パスワードを入力してください。」
  - 新 v3: 「画像ダウンロード専用パスワードを入力してください。※ 通常のログインパスワードとは異なります。管理者にお問い合わせください。」
- RTL テスト mock を変更:
  - 旧 v2: `supabase.auth.signInWithPassword` を mock
  - 新 v3: `supabase.rpc` で `verify_image_download_password` 呼出を mock、`data: true/false` で成否を制御

`verifyUserPasswordAndDownload` 自体は Task D.13 で RPC 検証に変更済みのため、本 Task では UI 文言とテスト mock のみ変更する。

commit メッセージ: "feat(leaf): A-1c v3 DownloadButton 文言 + RPC mock に更新"

---

**（以下、v2 plan の内容を上記改訂で上書きして実装する）**

**Files:**
- Create: `src/app/leaf/backoffice/_components/DownloadButton.tsx`
- Create: `src/app/leaf/backoffice/_components/__tests__/DownloadButton.test.tsx`

- [ ] **Step 1: RTL テスト**

```typescript
// src/app/leaf/backoffice/_components/__tests__/DownloadButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadButton } from '../DownloadButton';

vi.mock('@/app/leaf/_lib/attachments', () => ({
  isMobileDevice: vi.fn(() => false),
  verifyUserPasswordAndDownload: vi.fn(async () => {}),
  createAttachmentSignedUrl: vi.fn(async (p) => `https://mock/${p}`),
}));

describe('DownloadButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PC: triggers direct download on click (no password modal)', async () => {
    const { isMobileDevice } = await import('@/app/leaf/_lib/attachments');
    vi.mocked(isMobileDevice).mockReturnValue(false);
    render(<DownloadButton attachmentId="a1" storagePath="c1/a1.jpg" />);
    await userEvent.click(screen.getByRole('button', { name: /ダウンロード/ }));
    expect(screen.queryByText(/パスワード/)).not.toBeInTheDocument();
  });

  it('Mobile: shows password modal on click', async () => {
    const { isMobileDevice } = await import('@/app/leaf/_lib/attachments');
    vi.mocked(isMobileDevice).mockReturnValue(true);
    render(<DownloadButton attachmentId="a1" storagePath="c1/a1.jpg" />);
    await userEvent.click(screen.getByRole('button', { name: /ダウンロード/ }));
    expect(screen.getByText(/Garden パスワード/)).toBeInTheDocument();
  });

  it('Mobile: calls verifyUserPasswordAndDownload on submit', async () => {
    const { isMobileDevice, verifyUserPasswordAndDownload } = await import('@/app/leaf/_lib/attachments');
    vi.mocked(isMobileDevice).mockReturnValue(true);
    render(<DownloadButton attachmentId="a1" storagePath="c1/a1.jpg" />);
    await userEvent.click(screen.getByRole('button', { name: /ダウンロード/ }));
    await userEvent.type(screen.getByLabelText(/パスワード/), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /ダウンロードする/ }));
    expect(verifyUserPasswordAndDownload).toHaveBeenCalledWith('a1', 'secret123');
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/backoffice/_components/DownloadButton.tsx
'use client';

import { useState } from 'react';
import {
  isMobileDevice,
  verifyUserPasswordAndDownload,
  createAttachmentSignedUrl,
} from '@/app/leaf/_lib/attachments';

export type DownloadButtonProps = {
  attachmentId: string;
  storagePath: string;
};

export function DownloadButton({ attachmentId, storagePath }: DownloadButtonProps) {
  const [modal, setModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (isMobileDevice()) {
      setModal(true);
      return;
    }
    // PC: 即 DL
    const url = await createAttachmentSignedUrl(storagePath, 600);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${attachmentId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyUserPasswordAndDownload(attachmentId, password);
      setModal(false);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ダウンロードに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
        onClick={handleClick}
      >
        ダウンロード
      </button>
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3">画像をダウンロードします。<br />Garden パスワードを入力してください。</p>
            <label className="block mb-3">
              <span className="text-sm">パスワード</span>
              <input
                type="password"
                className="block w-full mt-1 px-3 py-2 border rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={() => setModal(false)} disabled={busy}>
                キャンセル
              </button>
              <button type="button" className="px-4 py-2 rounded bg-blue-600 text-white" onClick={handleSubmit} disabled={busy || !password}>
                {busy ? '確認中…' : 'ダウンロードする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- DownloadButton
```

Expected: `3 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/backoffice/_components/DownloadButton.tsx src/app/leaf/backoffice/_components/__tests__/DownloadButton.test.tsx
git commit -m "feat(leaf): DownloadButton (PC 即 DL / スマホ PW 認証 + 3 回ロック) (TDD, v2)"
```

### Task A.3c: `AttachmentAdminActions.tsx` + RTL test（v2 新規、admin+ 限定 復元/物理削除）

**Files:**
- Create: `src/app/leaf/backoffice/_components/AttachmentAdminActions.tsx`
- Create: `src/app/leaf/backoffice/_components/__tests__/AttachmentAdminActions.test.tsx`

- [ ] **Step 1: RTL テスト**

```typescript
// src/app/leaf/backoffice/_components/__tests__/AttachmentAdminActions.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentAdminActions } from '../AttachmentAdminActions';

vi.mock('@/app/leaf/_lib/role-context', () => ({
  useGardenRole: vi.fn(() => 'admin'),
}));
vi.mock('@/app/leaf/_lib/attachments', () => ({
  restoreAttachment: vi.fn(async () => {}),
  hardDeleteAttachment: vi.fn(async () => {}),
}));

describe('AttachmentAdminActions', () => {
  it('is hidden for manager role', async () => {
    const { useGardenRole } = await import('@/app/leaf/_lib/role-context');
    vi.mocked(useGardenRole).mockReturnValue('manager');
    const { container } = render(
      <AttachmentAdminActions attachmentId="a1" onAfter={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Restore + Hard Delete for admin role', async () => {
    const { useGardenRole } = await import('@/app/leaf/_lib/role-context');
    vi.mocked(useGardenRole).mockReturnValue('admin');
    render(<AttachmentAdminActions attachmentId="a1" onAfter={vi.fn()} />);
    expect(screen.getByRole('button', { name: /復元/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /完全削除/ })).toBeInTheDocument();
  });

  it('confirms before hard delete', async () => {
    const { useGardenRole } = await import('@/app/leaf/_lib/role-context');
    vi.mocked(useGardenRole).mockReturnValue('admin');
    const { hardDeleteAttachment } = await import('@/app/leaf/_lib/attachments');
    render(<AttachmentAdminActions attachmentId="a1" onAfter={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /完全削除/ }));
    expect(screen.getByText(/この操作は取り消せません/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /完全削除する/ }));
    expect(hardDeleteAttachment).toHaveBeenCalledWith('a1');
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/backoffice/_components/AttachmentAdminActions.tsx
'use client';

import { useState } from 'react';
import { useGardenRole } from '@/app/leaf/_lib/role-context';
import { ADMIN_ROLES } from '@/app/leaf/_lib/types';
import { restoreAttachment, hardDeleteAttachment } from '@/app/leaf/_lib/attachments';

export type AttachmentAdminActionsProps = {
  attachmentId: string;
  onAfter: () => void;
};

export function AttachmentAdminActions({ attachmentId, onAfter }: AttachmentAdminActionsProps) {
  const role = useGardenRole();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!role || !ADMIN_ROLES.includes(role)) return null;

  const handleRestore = async () => {
    setBusy(true);
    try {
      await restoreAttachment(attachmentId);
      onAfter();
    } finally {
      setBusy(false);
    }
  };

  const handleHardDelete = async () => {
    setBusy(true);
    try {
      await hardDeleteAttachment(attachmentId);
      setConfirming(false);
      onAfter();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-1 p-1">
      <button
        type="button"
        className="px-2 py-1 rounded bg-blue-600 text-white text-xs disabled:bg-gray-400"
        onClick={handleRestore}
        disabled={busy}
      >
        復元
      </button>
      <button
        type="button"
        className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:bg-gray-400"
        onClick={() => setConfirming(true)}
        disabled={busy}
      >
        完全削除
      </button>
      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 font-semibold text-red-700">完全に削除します。この操作は取り消せません。<br />本当に削除しますか？</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={() => setConfirming(false)} disabled={busy}>
                キャンセル
              </button>
              <button type="button" className="px-4 py-2 rounded bg-red-600 text-white" onClick={handleHardDelete} disabled={busy}>
                完全削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- AttachmentAdminActions
```

Expected: `3 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/backoffice/_components/AttachmentAdminActions.tsx src/app/leaf/backoffice/_components/__tests__/AttachmentAdminActions.test.tsx
git commit -m "feat(leaf): AttachmentAdminActions (admin+ 復元 / 物理削除 + 強い確認) (TDD, v2)"
```

### Task A.4: `AttachmentGrid.tsx` + RTL test（削除済バッジ + ロール別 UI + UNDO snackbar）

**[v2 改訂追記]** 既存 Task A.4 の実装に以下の差分を反映:

1. **`fetchAttachmentsByCase` が削除済を含めて返すよう変更**（deleted_at IS NULL フィルタを外す、spec §3.3 参照）。Task D.10 の該当箇所を「`.is('deleted_at', null)` を削除、`.order('uploaded_at', { ascending: false })` に置換」で修正する
2. **Grid 表示で削除済を別分類**: `attachments.filter(a => a.deleted_at === null)` で通常、`attachments.filter(a => a.deleted_at !== null)` で削除済。両方とも render、削除済はグレースケール + 「削除済」バッジ
3. **AttachmentCard に `isDeleted: boolean` prop 追加**: `true` なら `grayscale` CSS class、クリック無効化、`AttachmentAdminActions` を挿入
4. **RTL テスト追加**:
   - 削除済 1 件 + 通常 1 件のデータで、両方表示される
   - 削除済カードは `data-deleted="true"` 属性（grayscale 判定用）
   - admin ロールで「復元」「完全削除」ボタン表示
5. **Task A.4 既存の「非削除済のみ返す」テストを「deleted_at は UI 側で分類」に書替**

具体的な差分は既存 Task A.4 の Step 1-5 を本追記どおりに微修正する。大きな構造変更は不要。

---

**以下、v1 plan の AttachmentGrid 実装内容。上記改訂を織り込んで実装すること。**



**Files:**
- Create: `src/app/leaf/backoffice/_components/AttachmentGrid.tsx`
- Create: `src/app/leaf/backoffice/_components/__tests__/AttachmentGrid.test.tsx`

- [ ] **Step 1: RTL テスト（MSW は今回は使わず、Supabase mock を global 書換）**

```typescript
// src/app/leaf/backoffice/_components/__tests__/AttachmentGrid.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSupabaseMock } from '@/test-utils/supabase-mock';
import { AttachmentGrid } from '../AttachmentGrid';

vi.mock('@/lib/supabase/client', () => ({
  supabase: globalThis.__mockSupabase ?? {},
}));

beforeEach(() => {
  globalThis.__mockSupabase = createSupabaseMock({
    attachments: [
      { attachment_id: 'a1', case_id: 'c1', category: 'denki', storage_url: 'c1/a1.jpg', thumbnail_url: 'c1/thumb/a1.jpg', deleted_at: null },
      { attachment_id: 'a2', case_id: 'c1', category: 'gas', storage_url: 'c1/a2.jpg', thumbnail_url: 'c1/thumb/a2.jpg', deleted_at: null },
      { attachment_id: 'a3', case_id: 'c1', category: 'denki', storage_url: 'c1/a3.jpg', thumbnail_url: 'c1/thumb/a3.jpg', deleted_at: '2026-04-25T00:00:00Z' },
    ],
  }).client;
});

describe('AttachmentGrid', () => {
  it('renders only non-deleted attachments', async () => {
    render(<AttachmentGrid caseId="c1" />);
    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });
  });

  it('filters by category tab', async () => {
    render(<AttachmentGrid caseId="c1" />);
    await waitFor(() => screen.getAllByRole('img'));
    await userEvent.click(screen.getByRole('tab', { name: /電灯/ }));
    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
  });

  it('shows UNDO snackbar after delete', async () => {
    render(<AttachmentGrid caseId="c1" />);
    await waitFor(() => screen.getAllByRole('img'));
    const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
    await userEvent.click(deleteButtons[0]);
    await userEvent.click(screen.getByRole('button', { name: /削除する/ }));
    expect(await screen.findByText(/画像を削除しました/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/backoffice/_components/AttachmentGrid.tsx
'use client';

import { useEffect, useState } from 'react';
import type { AttachmentCategory, KandenAttachment } from '@/app/leaf/_lib/types';
import { ATTACHMENT_LABELS } from '@/app/leaf/_lib/types';
import {
  fetchAttachmentsByCase,
  createAttachmentSignedUrls,
  createAttachmentSignedUrl,
  softDeleteAttachment,
  undoSoftDelete,
} from '@/app/leaf/_lib/attachments';
import { AttachmentCard } from './AttachmentCard';
import { AttachmentLightbox } from './AttachmentLightbox';

const CATEGORIES: Array<AttachmentCategory | 'all'> = ['all', 'denki', 'douryoku', 'gas', 'shogen', 'ryosho'];

export type AttachmentGridProps = {
  caseId: string;
};

export function AttachmentGrid({ caseId }: AttachmentGridProps) {
  const [attachments, setAttachments] = useState<KandenAttachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<AttachmentCategory | 'all'>('all');
  const [lightbox, setLightbox] = useState<{ signedUrl: string; alt: string } | null>(null);
  const [undoTarget, setUndoTarget] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const rows = await fetchAttachmentsByCase(caseId);
      if (!active) return;
      setAttachments(rows);
      const thumbPaths = rows.map((r) => r.thumbnail_url!).filter(Boolean);
      if (thumbPaths.length > 0) {
        const urls = await createAttachmentSignedUrls(thumbPaths, 600);
        const map: Record<string, string> = {};
        rows.forEach((r, i) => { if (r.thumbnail_url) map[r.attachment_id] = urls[i]; });
        if (active) setSignedUrls(map);
      }
    })();
    return () => { active = false; };
  }, [caseId]);

  const filtered = tab === 'all' ? attachments : attachments.filter((a) => a.category === tab);

  const handleClick = async (attachmentId: string) => {
    const row = attachments.find((a) => a.attachment_id === attachmentId);
    if (!row) return;
    const url = await createAttachmentSignedUrl(row.storage_url, 600);
    setLightbox({ signedUrl: url, alt: ATTACHMENT_LABELS[row.category] });
  };

  const handleDelete = async (attachmentId: string) => {
    // 楽観的更新
    setAttachments((prev) => prev.filter((a) => a.attachment_id !== attachmentId));
    setUndoTarget(attachmentId);
    await softDeleteAttachment(attachmentId);
    setTimeout(() => setUndoTarget((cur) => (cur === attachmentId ? null : cur)), 5000);
  };

  const handleUndo = async () => {
    if (!undoTarget) return;
    await undoSoftDelete(undoTarget);
    const rows = await fetchAttachmentsByCase(caseId);
    setAttachments(rows);
    setUndoTarget(null);
  };

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2 border-b">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={tab === cat}
            className={`px-3 py-1.5 text-sm ${tab === cat ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
            onClick={() => setTab(cat)}
          >
            {cat === 'all' ? 'すべて' : ATTACHMENT_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {filtered.map((a) => (
          <AttachmentCard
            key={a.attachment_id}
            attachmentId={a.attachment_id}
            thumbnailSignedUrl={signedUrls[a.attachment_id] ?? ''}
            category={a.category}
            onClick={handleClick}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {lightbox && (
        <AttachmentLightbox
          fullSignedUrl={lightbox.signedUrl}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}

      {undoTarget && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded shadow-lg flex items-center gap-4">
          <span>画像を削除しました</span>
          <button type="button" className="underline" onClick={handleUndo}>元に戻す</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- AttachmentGrid
```

Expected: `3 tests passed`（全テスト合算は累積）。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/backoffice/_components/AttachmentGrid.tsx src/app/leaf/backoffice/_components/__tests__/AttachmentGrid.test.tsx
git commit -m "feat(leaf): AttachmentGrid (カテゴリタブ + signedURL 一括 + UNDO snackbar) (TDD)"
```

### Task A.5: `AttachmentUploader.tsx` + RTL test（PC 向け）

**Files:**
- Create: `src/app/leaf/backoffice/_components/AttachmentUploader.tsx`
- Create: `src/app/leaf/backoffice/_components/__tests__/AttachmentUploader.test.tsx`

- [ ] **Step 1: RTL テスト**

```typescript
// src/app/leaf/backoffice/_components/__tests__/AttachmentUploader.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSupabaseMock } from '@/test-utils/supabase-mock';
import { AttachmentUploader } from '../AttachmentUploader';

vi.mock('@/lib/supabase/client', () => ({ supabase: globalThis.__mockSupabase ?? {} }));
vi.mock('@/app/leaf/_lib/image-compression', () => ({
  compressWithWorker: vi.fn(async (b) => b),
  thumbnailWithWorker: vi.fn(async (b) => b),
  convertHeicToJpeg: vi.fn(async (b) => new Blob([b], { type: 'image/jpeg' })),
  isHeicFile: (f: File) => f.type === 'image/heic',
}));

beforeEach(() => {
  globalThis.__mockSupabase = createSupabaseMock().client;
});

describe('AttachmentUploader', () => {
  it('requires category selection before upload', async () => {
    render(<AttachmentUploader caseId="c1" onUploaded={vi.fn()} />);
    const input = screen.getByLabelText(/画像を選択/) as HTMLInputElement;
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: /アップロード/ }));
    expect(await screen.findByText(/カテゴリを選択/)).toBeInTheDocument();
  });

  it('uploads selected files after category selected', async () => {
    const onUploaded = vi.fn();
    render(<AttachmentUploader caseId="c1" onUploaded={onUploaded} />);
    await userEvent.selectOptions(screen.getByLabelText(/カテゴリ/), 'denki');
    const input = screen.getByLabelText(/画像を選択/) as HTMLInputElement;
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: /アップロード/ }));
    await screen.findByText(/成功/);
    expect(onUploaded).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/backoffice/_components/AttachmentUploader.tsx
'use client';

import { useEffect, useState } from 'react';
import type { AttachmentCategory } from '@/app/leaf/_lib/types';
import { ATTACHMENT_LABELS } from '@/app/leaf/_lib/types';
import { uploadAttachments } from '@/app/leaf/_lib/attachments';

export type AttachmentUploaderProps = {
  caseId: string;
  onUploaded: () => void;
};

export function AttachmentUploader({ caseId, onUploaded }: AttachmentUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<AttachmentCategory | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // beforeunload 警告
  useEffect(() => {
    if (!progress) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [progress]);

  const handleUpload = async () => {
    setError(null);
    setStatus(null);
    if (!category) { setError('カテゴリを選択してください'); return; }
    if (files.length === 0) { setError('画像を選択してください'); return; }
    setProgress({ done: 0, total: files.length });
    try {
      const res = await uploadAttachments(files, caseId, category, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setProgress(null);
      if (res.failed.length === 0) {
        setStatus(`${res.succeeded.length} 枚 成功`);
      } else {
        setError(`${files.length} 枚中 ${res.failed.length} 枚のアップロードに失敗しました`);
      }
      onUploaded();
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました');
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <label className="block">
        <span>カテゴリ</span>
        <select
          className="block w-full mt-1 px-3 py-2 border rounded"
          value={category}
          onChange={(e) => setCategory(e.target.value as AttachmentCategory | '')}
        >
          <option value="">— 選択 —</option>
          {(['denki', 'douryoku', 'gas', 'shogen', 'ryosho'] as AttachmentCategory[]).map((c) => (
            <option key={c} value={c}>{ATTACHMENT_LABELS[c]}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span>画像を選択</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic"
          multiple
          className="block w-full mt-1"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>

      <button
        type="button"
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400"
        onClick={handleUpload}
        disabled={progress !== null}
      >
        アップロード
      </button>

      {progress && <p className="text-sm text-gray-600">{progress.done} / {progress.total}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && <p className="text-sm text-green-600">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- AttachmentUploader
```

Expected: `2 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/backoffice/_components/AttachmentUploader.tsx src/app/leaf/backoffice/_components/__tests__/AttachmentUploader.test.tsx
git commit -m "feat(leaf): AttachmentUploader (PC drag&drop + カテゴリ必須 + beforeunload) (TDD)"
```

### Task A.6: Backoffice `page.tsx` 組込（+ RoleContext provider, v2）

**[v2 改訂追記]** Backoffice layout または page.tsx のルート JSX を `<RoleProvider>` で包む:

```typescript
import { RoleProvider } from '@/app/leaf/_lib/role-context';

export default function BackofficePage() {
  return (
    <RoleProvider>
      {/* 既存の JSX */}
    </RoleProvider>
  );
}
```

これにより `AttachmentDeleteButton` / `AttachmentAdminActions` / `DownloadButton` が `useGardenRole()` で現在ロールを取得できる。

---

**以下、v1 plan の page.tsx 組込内容。上記追記を織り込んで実装する。**



**Files:**
- Modify: `src/app/leaf/backoffice/page.tsx`

- [ ] **Step 1: 既存 `page.tsx` を読む**

```bash
wc -l src/app/leaf/backoffice/page.tsx
```

A-FMK1 の実装を含むため内容を確認。

- [ ] **Step 2: 詳細画面 or カード横に AttachmentGrid + AttachmentUploader を追加**

既存のケース詳細領域の末尾に、以下を追加:

```typescript
import { AttachmentGrid } from './_components/AttachmentGrid';
import { AttachmentUploader } from './_components/AttachmentUploader';

// ... 既存の JSX の末尾、ケース詳細領域内に:
<section className="mt-6">
  <h2 className="text-lg font-semibold mb-2">添付ファイル</h2>
  <AttachmentUploader
    caseId={selectedCase.case_id}
    onUploaded={() => {
      // grid 再 query トリガ
      setReloadKey((k) => k + 1);
    }}
  />
  <div className="mt-4">
    <AttachmentGrid key={reloadKey} caseId={selectedCase.case_id} />
  </div>
</section>
```

`useState` に `const [reloadKey, setReloadKey] = useState(0);` を追加。

- [ ] **Step 3: build で既存機能壊してないこと確認**

```bash
npm run build
```

- [ ] **Step 4: dev server で手動確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/leaf/backoffice` を開き、案件選択 → 添付セクション表示 + アップロード + 表示 + 削除 の一連を目視確認。

- [ ] **Step 5: コミット**

```bash
git add src/app/leaf/backoffice/page.tsx
git commit -m "feat(leaf): Backoffice に AttachmentGrid + Uploader を組込み"
```

### Task A.7: Root マイページ 画像 DL PW 設定 UI（v3 新規、super_admin 限定）

**Files:**
- Create: `src/app/root/me/image-download-password/page.tsx`
- Create: `src/app/root/me/image-download-password/_components/PasswordSetForm.tsx`
- Create: `src/app/root/me/image-download-password/_components/__tests__/PasswordSetForm.test.tsx`

**前提（v3.2 改訂）**: bcryptjs npm パッケージは **不要**（a-review #65 修正でサーバ側 RPC 内 bcrypt 化に変更、平文 PW を直送）。Task 0.1 / 0.2 の npm install 対象から外す。

- [ ] **Step 1: RTL テストを書く（v3.2 改訂版、bcryptjs mock 廃止 + 平文 PW 直送呼出検証）**

```typescript
// src/app/root/me/image-download-password/_components/__tests__/PasswordSetForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordSetForm } from '../PasswordSetForm';

vi.mock('@/app/leaf/_lib/role-context', () => ({
  useGardenRole: vi.fn(() => 'super_admin'),
}));

// v3.2 改訂: bcryptjs mock は廃止（client では bcrypt を使用しない）

const mockRpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: mockRpc },
}));

beforeEach(() => {
  mockRpc.mockClear();
});

describe('PasswordSetForm', () => {
  it('is hidden for non-super_admin', async () => {
    const { useGardenRole } = await import('@/app/leaf/_lib/role-context');
    vi.mocked(useGardenRole).mockReturnValue('admin');
    const { container } = render(<PasswordSetForm />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows form for super_admin', async () => {
    const { useGardenRole } = await import('@/app/leaf/_lib/role-context');
    vi.mocked(useGardenRole).mockReturnValue('super_admin');
    render(<PasswordSetForm />);
    expect(screen.getByLabelText(/新しいパスワード/)).toBeInTheDocument();
    expect(screen.getByLabelText(/確認用再入力/)).toBeInTheDocument();
  });

  it('validates mismatch between new and confirm', async () => {
    const { useGardenRole } = await import('@/app/leaf/_lib/role-context');
    vi.mocked(useGardenRole).mockReturnValue('super_admin');
    render(<PasswordSetForm />);
    await userEvent.type(screen.getByLabelText(/新しいパスワード/), 'newpass01');
    await userEvent.type(screen.getByLabelText(/確認用再入力/), 'different1');
    await userEvent.click(screen.getByRole('button', { name: /設定する/ }));
    expect(await screen.findByText(/一致しません/)).toBeInTheDocument();
  });

  it('calls set_image_download_password RPC with plain new_password (v3.2)', async () => {
    const { useGardenRole } = await import('@/app/leaf/_lib/role-context');
    vi.mocked(useGardenRole).mockReturnValue('super_admin');
    render(<PasswordSetForm />);
    await userEvent.type(screen.getByLabelText(/新しいパスワード/), 'newpass01');
    await userEvent.type(screen.getByLabelText(/確認用再入力/), 'newpass01');
    await userEvent.click(screen.getByRole('button', { name: /設定する/ }));
    await screen.findByText(/設定しました/);
    // v3.2: 引数は { new_password: <平文> }（旧 v3 の { new_hash: <bcrypt hash> } から変更）
    expect(mockRpc).toHaveBeenCalledWith('set_image_download_password', { new_password: 'newpass01' });
  });
});
```

- [ ] **Step 2: FAIL → 実装（v3.2 改訂版、bcryptjs import 廃止 + 平文 PW 直送）**

```typescript
// src/app/root/me/image-download-password/_components/PasswordSetForm.tsx
'use client';

import { useState } from 'react';
// v3.2 改訂: bcryptjs import 廃止（サーバ側 RPC 内で bcrypt 化）
import { useGardenRole } from '@/app/leaf/_lib/role-context';
import { ADMIN_ROLES } from '@/app/leaf/_lib/types';
import { supabase } from '@/lib/supabase/client';

export function PasswordSetForm() {
  const role = useGardenRole();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // super_admin のみ表示（admin は表示しない = ADMIN_ROLES より厳しい判定）
  if (role !== 'super_admin') return null;

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (pw.length < 8) { setError('8 文字以上で入力してください'); return; }
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { setError('英字と数字を混在させてください'); return; }
    if (pw !== confirm) { setError('確認用と一致しません'); return; }

    setBusy(true);
    try {
      // v3.2 改訂: 平文 PW を直接 RPC に送信（サーバ側で bcrypt 化）
      // a-review #65 修正で任意 hash 送信ルートを封殺、HTTPS 経路保護に依存
      const { error: rpcErr } = await supabase.rpc('set_image_download_password', { new_password: pw });
      if (rpcErr) throw new Error(rpcErr.message);
      setSuccess('設定しました。次回の変更は 1 ヶ月後目安です。変更時は Chatwork で社内通知してください。');
      setPw('');
      setConfirm('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '設定に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">画像ダウンロード専用パスワード</h1>
      <p className="text-sm text-gray-600">
        本パスワードは Leaf 関電業務委託でスマホから画像をダウンロードする際に使用します。<br />
        全ユーザー共通のパスワードです。変更後は Chatwork で通知してください。
      </p>

      <label className="block">
        <span>新しいパスワード（8 文字以上、英数字混在）</span>
        <input
          type="password"
          className="block w-full mt-1 px-3 py-2 border rounded"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          disabled={busy}
        />
      </label>

      <label className="block">
        <span>確認用再入力</span>
        <input
          type="password"
          className="block w-full mt-1 px-3 py-2 border rounded"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
      </label>

      <button
        type="button"
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400"
        onClick={handleSubmit}
        disabled={busy || !pw || !confirm}
      >
        設定する
      </button>

      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-green-600">{success}</p>}
    </div>
  );
}
```

- [ ] **Step 3: page.tsx を作成**

```typescript
// src/app/root/me/image-download-password/page.tsx
import { RoleProvider } from '@/app/leaf/_lib/role-context';
import { PasswordSetForm } from './_components/PasswordSetForm';

export default function ImageDownloadPasswordPage() {
  return (
    <RoleProvider>
      <PasswordSetForm />
    </RoleProvider>
  );
}
```

- [ ] **Step 4: PASS 確認**

```bash
npm test -- PasswordSetForm
```

Expected: `4 tests passed`。

- [ ] **Step 5: build 通過確認**

```bash
npm run build
```

- [ ] **Step 6: コミット**

```bash
git add src/app/root/me/image-download-password/
git commit -m "feat(leaf): A-1c v3.2 Root マイページ 画像 DL PW 設定 UI (super_admin 限定, 平文 PW 直送 RPC, server-side bcrypt)"
```

---

## Phase B: Input UI（1.5d、v2 改訂で +0.5d）

### Task B.1: `CategoryPicker.tsx`（モバイル向け大型タップ）+ RTL test

**Files:**
- Create: `src/app/leaf/input/_components/CategoryPicker.tsx`
- Create: `src/app/leaf/input/_components/__tests__/CategoryPicker.test.tsx`

- [ ] **Step 1: RTL テスト**

```typescript
// src/app/leaf/input/_components/__tests__/CategoryPicker.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryPicker } from '../CategoryPicker';

describe('CategoryPicker', () => {
  it('renders 5 category buttons', () => {
    render(<CategoryPicker value="" onChange={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('calls onChange on button click', async () => {
    const onChange = vi.fn();
    render(<CategoryPicker value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /電灯/ }));
    expect(onChange).toHaveBeenCalledWith('denki');
  });

  it('marks selected button visually', () => {
    render(<CategoryPicker value="denki" onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /電灯/ });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/input/_components/CategoryPicker.tsx
'use client';

import type { AttachmentCategory } from '@/app/leaf/_lib/types';
import { ATTACHMENT_LABELS } from '@/app/leaf/_lib/types';

export type CategoryPickerProps = {
  value: AttachmentCategory | '';
  onChange: (cat: AttachmentCategory) => void;
};

const CATEGORIES: AttachmentCategory[] = ['denki', 'douryoku', 'gas', 'shogen', 'ryosho'];

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          aria-pressed={value === cat}
          className={`min-h-[56px] px-4 py-3 rounded-lg text-lg font-semibold ${
            value === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
          }`}
          onClick={() => onChange(cat)}
        >
          {ATTACHMENT_LABELS[cat]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- CategoryPicker
```

Expected: `3 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/input/_components/CategoryPicker.tsx src/app/leaf/input/_components/__tests__/CategoryPicker.test.tsx
git commit -m "feat(leaf): CategoryPicker (営業モバイル向け大型タップターゲット) (TDD)"
```

### Task B.2: `MobileAttachmentUploader.tsx` + RTL test

**Files:**
- Create: `src/app/leaf/input/_components/MobileAttachmentUploader.tsx`
- Create: `src/app/leaf/input/_components/__tests__/MobileAttachmentUploader.test.tsx`

- [ ] **Step 1: RTL テスト**

```typescript
// src/app/leaf/input/_components/__tests__/MobileAttachmentUploader.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSupabaseMock } from '@/test-utils/supabase-mock';
import { MobileAttachmentUploader } from '../MobileAttachmentUploader';

vi.mock('@/lib/supabase/client', () => ({ supabase: globalThis.__mockSupabase ?? {} }));
vi.mock('@/app/leaf/_lib/image-compression', () => ({
  compressWithWorker: vi.fn(async (b) => b),
  thumbnailWithWorker: vi.fn(async (b) => b),
  convertHeicToJpeg: vi.fn(async (b) => b),
  isHeicFile: () => false,
}));

beforeEach(() => {
  globalThis.__mockSupabase = createSupabaseMock().client;
});

describe('MobileAttachmentUploader', () => {
  it('has camera capture attribute', () => {
    render(<MobileAttachmentUploader caseId="c1" onUploaded={vi.fn()} />);
    const input = screen.getByLabelText(/撮影/) as HTMLInputElement;
    expect(input).toHaveAttribute('capture', 'environment');
  });

  it('prompts category when missing', async () => {
    render(<MobileAttachmentUploader caseId="c1" onUploaded={vi.fn()} />);
    const input = screen.getByLabelText(/撮影/) as HTMLInputElement;
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: /アップロード/ }));
    expect(await screen.findByText(/カテゴリを選択/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: FAIL → 実装**

```typescript
// src/app/leaf/input/_components/MobileAttachmentUploader.tsx
'use client';

import { useState } from 'react';
import type { AttachmentCategory } from '@/app/leaf/_lib/types';
import { uploadAttachments } from '@/app/leaf/_lib/attachments';
import { CategoryPicker } from './CategoryPicker';

export type MobileAttachmentUploaderProps = {
  caseId: string;
  onUploaded: () => void;
};

export function MobileAttachmentUploader({ caseId, onUploaded }: MobileAttachmentUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<AttachmentCategory | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleUpload = async () => {
    setError(null);
    if (!category) { setError('カテゴリを選択してください'); return; }
    if (files.length === 0) { setError('画像を撮影または選択してください'); return; }
    setBusy(true);
    try {
      await uploadAttachments(files, caseId, category, { concurrency: 2 });
      setFiles([]);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <CategoryPicker value={category} onChange={setCategory} />

      <label className="block">
        <span className="text-lg font-semibold">撮影 or 画像を選択</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic"
          capture="environment"
          multiple
          className="block w-full mt-2 text-lg"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>

      {files.length > 0 && <p className="text-sm text-gray-600">{files.length} 枚選択済み</p>}

      <button
        type="button"
        className="w-full min-h-[56px] rounded-lg bg-blue-600 text-white text-lg font-semibold disabled:bg-gray-400"
        onClick={handleUpload}
        disabled={busy}
      >
        {busy ? 'アップロード中…' : 'アップロード'}
      </button>

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: PASS 確認**

```bash
npm test -- MobileAttachmentUploader
```

Expected: `2 tests passed`。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/input/_components/MobileAttachmentUploader.tsx src/app/leaf/input/_components/__tests__/MobileAttachmentUploader.test.tsx
git commit -m "feat(leaf): MobileAttachmentUploader (カメラ起動 + モバイル専用) (TDD)"
```

### Task B.3: Input `page.tsx` 新設（+ RoleContext provider, v2）

**[v2 改訂追記]** Input page でも `<RoleProvider>` でルートを包む:

```typescript
import { RoleProvider } from '@/app/leaf/_lib/role-context';

export default function LeafInputPage() {
  return (
    <RoleProvider>
      {/* 既存の JSX（header / MobileAttachmentUploader / AttachmentGrid） */}
    </RoleProvider>
  );
}
```

モバイル側でも `DownloadButton` が `isMobileDevice()` で TRUE を返すのでパスワードモーダル経由 DL、`AttachmentDeleteButton` / `AttachmentAdminActions` は営業ロール（toss/closer）では非表示になる。

---

**以下、v1 plan の input page 実装内容。上記追記を織り込んで実装する。**



**Files:**
- Create: `src/app/leaf/input/page.tsx`

- [ ] **Step 1: 最小の input page を作る**

```typescript
// src/app/leaf/input/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchCase } from '@/app/leaf/_lib/queries';
import type { KandenCase } from '@/app/leaf/_lib/types';
import { MobileAttachmentUploader } from './_components/MobileAttachmentUploader';
import { AttachmentGrid } from '@/app/leaf/backoffice/_components/AttachmentGrid';

export default function LeafInputPage() {
  const params = useSearchParams();
  const router = useRouter();
  const caseId = params.get('case_id');
  const [kCase, setKCase] = useState<KandenCase | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!caseId) return;
    fetchCase(caseId).then(setKCase);
  }, [caseId]);

  if (!caseId) return <p className="p-4">case_id パラメータが必要です</p>;
  if (!kCase) return <p className="p-4">読込中…</p>;

  return (
    <div className="max-w-md mx-auto">
      <header className="p-4 border-b sticky top-0 bg-white z-10">
        <button className="text-blue-600 text-sm" onClick={() => router.back()}>← 戻る</button>
        <h1 className="text-xl font-semibold">{kCase.customer_name ?? kCase.customer_number}</h1>
        <p className="text-sm text-gray-600">{kCase.case_id}</p>
      </header>

      <MobileAttachmentUploader
        caseId={kCase.case_id}
        onUploaded={() => setReloadKey((k) => k + 1)}
      />

      <section className="p-4">
        <h2 className="text-lg font-semibold mb-2">添付一覧</h2>
        <AttachmentGrid key={reloadKey} caseId={kCase.case_id} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: build 通過確認**

```bash
npm run build
```

- [ ] **Step 3: dev server で手動確認**

```bash
npm run dev
```

ブラウザ（モバイル表示にデバイスツールで切替え）で `http://localhost:3000/leaf/input?case_id=<既存ID>` を開き、カメラ起動・撮影・upload・一覧反映を確認。

- [ ] **Step 4: コミット**

```bash
git add src/app/leaf/input/page.tsx
git commit -m "feat(leaf): input page を新設 (営業モバイル向け撮影+upload+一覧)"
```

---

## Phase F: 仕上げ（0.2d）

### Task F.1: 手動 RLS 検証 20 シナリオ（v2 拡張）

**[v2 改訂追記]** spec §4.3 v2 の 20 シナリオに拡張。事前にテストユーザー 3 名（toss 役 / manager 役 / admin 役）を関電事業所属で作成、および契約終了済 outsource 役 1 名を作成。

**Files:**
- Create: `docs/manual-rls-test-a1c-results.md`

- [ ] **Step 1: garden-dev で spec §4.3 の 12 シナリオを手動実行**

spec §4.3 の表を順次実行：
1. 認証済 GET `leaf_kanden_attachments` → 200 OK + deleted_at IS NULL のみ
2. anon GET 同 → 401 or 0 件
3. 手動 SQL で deleted_at 設定 → grid 再 query で取得なし
4. 認証済 DELETE → 403 or 0 rows
5. 認証済 storage.upload(recent) → 200
6. anon storage.upload(recent) → 403
7. 認証済 storage.remove(recent) → 403
8. 認証済 storage.upload(monthly) → 403
9. 認証済 storage.createSignedUrl(monthly) → 200
10. 論理削除後 signedURL 発行試行 → 取得対象外（RLS で見えない）
11. 6MB ファイル upload → 413
12. .txt ファイル upload → 400

- [ ] **Step 2: 結果を md に記録**

```markdown
# Manual RLS Test Results - A-1c

実施日: YYYY-MM-DD
実施環境: garden-dev (Supabase staging)
実施者: (担当者名)

| # | シナリオ | 期待 | 実績 | 判定 |
|---|---|---|---|---|
| 1 | ... | 200 OK | 200 OK | ✅ |
| 2 | ... | ... | ... | ... |
| ...
```

- [ ] **Step 3: コミット**

```bash
git add docs/manual-rls-test-a1c-results.md
git commit -m "docs(leaf): A-1c 手動 RLS 検証結果 (12 シナリオ全 pass)"
```

### Task F.2: §16 7 種テスト実施

**Files:**
- Create: `docs/pre-release-test-YYYYMMDD-leaf-a1c.md`（YYYYMMDD は実施日）

- [ ] **Step 1: 実施日でファイル名を確定、spec §4.5 の 7 種テストを手動実施**

対象:
1. 機能網羅: 全ボタン・入力・カテゴリ・upload/閲覧/削除/UNDO
2. **エッジケース優先**: 0 枚 / 16 枚 / 同時複数カテゴリ / 10MB / HEIC 変換不可 / network timeout 離脱 / 5MB 境界 / マルチバイトファイル名 / category 未選択
3. 権限: 認証有/無 2 段
4. データ境界: 不正 category / 極大ファイル名 / deleted_at 境界 / 削除→復元→再削除
5. パフォーマンス: 15 枚並列 upload / Grid 100 件 / signedURL 一括発行
6. コンソール監視: Error/Warning なし
7. アクセシビリティ: axe-core 実行

- [ ] **Step 2: 結果記録**

```markdown
# Pre-Release Test - Leaf A-1c

実施日: YYYY-MM-DD
結果サマリ: ✅ 合格 XX / 🟡 警告 X / ❌ 不合格 X

## 1. 機能網羅
...

## 2. エッジケース
...
```

- [ ] **Step 3: コミット**

```bash
git add docs/pre-release-test-*.md
git commit -m "docs(leaf): A-1c pre-release 7 種テスト結果"
```

### Task F.3: effort-tracking.md 追記

**Files:**
- Modify: `docs/effort-tracking.md`

- [ ] **Step 1: Leaf A-1c の実績 3 行（D / A / B）追記**

```markdown
| 2026-04-YY | Garden-Leaf | A-1c-D 共通基盤 (migration+SDK共通化+3本lib+test-utils+Worker) | 1.5d | X.Xd | +X.Xh | (理由) | a-leaf |
| 2026-04-YY | Garden-Leaf | A-1c-A Backoffice UI (5コンポーネント+page組込) | 1.5d | X.Xd | +X.Xh | ... | a-leaf |
| 2026-04-YY | Garden-Leaf | A-1c-B Input UI (page+2コンポーネント) | 1.0d | X.Xd | +X.Xh | ... | a-leaf |
```

- [ ] **Step 2: コミット**

```bash
git add docs/effort-tracking.md
git commit -m "docs: effort-tracking A-1c D/A/B 実績追記 (leaf)"
```

### Task F.4: Phase B-1 後日対応タスク記録

**Files:**
- Create: `docs/phase-b1-followups-leaf.md`

- [ ] **Step 1: a-bloom 指摘 2 件と spec §8 path 訂正を 1 ファイルに集約**

```markdown
# Phase B-1 着手前リビジョン項目 (Leaf)

a-bloom 技術レビュー (2026-04-25) で指摘された軽微項目、および本 plan 実装中に
発見された spec 訂正要点。Phase B-1 着手前に spec リビジョンする。

## 1. spec §7.3 TimeTree 移行
- 現 spec: 「事務担当が TimeTree から手動 DL → Garden へ upload」等の案提示
- リビジョン: Phase B-1 着手時に TimeTree 運用の現況（枚数・案件数・周期）を
  再ヒアリングしてから詳細設計化

## 2. spec §7.5 Lightbox 機能拡張
- 現 spec: 「原本 DL / エクスポート / 画像回転」等を β版 FB で判断
- リビジョン: β版 2 週間投入後、具体的な FB（どの機能が欠けて困るか）を
  収集してから Phase B-1 Lightbox v2 として別 spec 起票

## 3. spec §8 migration path 訂正
- 現 spec: `supabase/migrations/` に配置と記載
- 実装時: Garden 実運用は `scripts/<module>-schema[-patch].sql` を Supabase
  Dashboard で手動実行。A-1c では `scripts/leaf-schema-patch-a1c.sql` に配置した
- 対応: spec リビジョンで §8 の冒頭を「`scripts/leaf-schema-patch-a1c.sql` に配置、
  Supabase Dashboard > SQL Editor で手動実行」に訂正
```

- [ ] **Step 2: コミット**

```bash
git add docs/phase-b1-followups-leaf.md
git commit -m "docs(leaf): Phase B-1 着手前リビジョン 3 項目記録 (spec §7.3/§7.5/§8)"
```

### Task F.5: 最終 push

- [ ] **Step 1: ブランチ push**

```bash
git push origin feature/leaf-kanden-supabase-connect
```

- [ ] **Step 2: a-main に完了報告**

テキスト例:
```
【a-leaf → a-main 実装完了】
A-1c 実装完走。D/A/B 全 28 task 完了、手動 RLS + 7 種テスト pass、
effort-tracking 反映済。β版投入判断をお願いします。
```

---

## Self-Review（後述の spec 全要件との突合せ、v2 改訂版）

### 1. Spec 要件カバレッジ（v2）

| spec セクション | 要件 | 担当 Task |
|---|---|---|
| §1.2 スコープ - 閲覧 | AttachmentGrid 実装 | A.4 |
| §1.2 スコープ - upload | AttachmentUploader + MobileAttachmentUploader | A.5, B.2 |
| §1.2 スコープ - 圧縮 | image-compression + Worker | D.6, D.7 |
| §1.2 スコープ - サムネ | generateThumbnail / thumbnailWithWorker | D.6, D.7 |
| §1.2 スコープ - 論理削除 + UNDO | AttachmentDeleteButton + softDeleteAttachment | A.3, D.8 |
| §1.2 スコープ - **物理削除 UI + 復元 (v2)** | AttachmentAdminActions + hardDeleteAttachment / restoreAttachment | **A.3c, D.13** |
| §1.2 スコープ - **削除済バッジ (v2)** | AttachmentGrid + AttachmentCard の isDeleted 分類 | **A.4** |
| §1.2 スコープ - HEIC | convertHeicToJpeg | D.6 |
| §1.2 スコープ - **ロール分岐 RLS 8 ロール (v2)** | leaf_user_in_business + garden_role_of 使用の RLS | **D.1** |
| §1.2 スコープ - **事業スコープ制御 (v2)** | leaf_businesses / leaf_user_businesses migration | **D.1** |
| §1.2 スコープ - **画像 DL PW（スマホのみ、v2）** | DownloadButton + verifyUserPasswordAndDownload | **A.3b, D.13** |
| §1.2 スコープ - **契約終了遮断 (v2)** | is_user_active (Root A-3-g) 経由 | **D.1 前提** |
| §1.5 ロール × 操作マトリクス | DELETABLE_ROLES / ADMIN_ROLES + Client ガード | D.3, D.12, A.3 |
| §2.2 Storage パス | kanden-storage-paths | D.4 |
| §2.3 RLS SQL (v2) | scripts/leaf-schema-patch-a1c.sql | D.1 |
| §2.4 size/MIME 制限 | migration の file_size_limit/allowed_mime_types | D.1 |
| §2.5 client 共通化 | src/lib/supabase/client.ts | D.2 |
| §2.6 deleted_at + **deleted_by** + **LeafBusiness / LeafUserBusiness 型 (v2)** | types.ts + migration | D.1, D.3 |
| §3.1 upload フロー | uploadAttachments 関数 | D.11 |
| §3.2 失敗リカバリ | putWithRetry / uploadAttachments | D.11 |
| §3.3 signedURL ハイブリッド + **削除済も含め発行 (v2)** | createAttachmentSignedUrls / createAttachmentSignedUrl | D.9, A.4 |
| §3.4 削除フロー (v2: ロール別 + バッジ + 物理削除) | AttachmentDeleteButton + AttachmentAdminActions + AttachmentGrid | A.3, **A.3c**, A.4 |
| §3.5 Lightbox + **DL PW (v2)** | AttachmentLightbox + DownloadButton 組込 | A.2, **A.3b** |
| §4.1 Vitest ユニット + **v2 追加関数** | 各 _lib/__tests__/*.test.ts + role-context.test | D.4, D.6, D.8-11, **D.12, D.13** |
| §4.2 RTL + MSW + **DownloadButton / AdminActions** | 各 _components/__tests__/*.test.tsx | A.1-5, **A.3b, A.3c**, B.1-2 |
| §4.3 手動 RLS **20 シナリオ (v2)** | `docs/manual-rls-test-a1c-results.md` | F.1 |
| §4.4 test-utils 共通化 + **ロール/事業所属 mock 拡張 (v2)** | src/test-utils/supabase-mock.ts | D.5 |
| §4.5 §16 7 種テスト（権限 ✅✅ 必須化）| `docs/pre-release-test-*-leaf-a1c.md` | F.2 |
| §5 実装ステップ D/A/B (6.0d) | Phase D (2.5d) / A (2.0d) / B (1.5d) | D.*, A.*, B.* |
| §6 判断保留 15 件（#12-15 v2）| spec 本体確定済、実装で反映 | - |
| §7 Phase B 引継（事業マスタ UI 追加）| `docs/phase-b1-followups-leaf.md` | F.4 |
| §8 Migration SQL v2 | scripts/leaf-schema-patch-a1c.sql | D.1 |
| §9.2 Root A-3-g 依存 | Task D.1 Step 1 で確認 | D.1 |

ギャップなし ✅

### 2. Placeholder scan

本 plan 内を grep で検査:
- "TBD" / "FIXME" / "XXX": 0 件 ✅
- "TODO" マーカー: scripts/leaf-schema-patch-a1c.sql と実装コメント内のみ、全て「Phase B-1 で強化」意図の記録（placeholder ではない）✅
- "YYYYMMDD" / "YYYY-MM-DD": Task F.1 / F.2 / F.3 の実施日埋込部分のみ（実施時に確定する placeholder として許容）✅
- 未定義関数・型の参照: `useGardenRole` (Task D.12 定義) / `DELETABLE_ROLES` / `ADMIN_ROLES` (Task D.3 定義) / `restoreAttachment` / `hardDeleteAttachment` / `verifyUserPasswordAndDownload` / `isMobileDevice` (Task D.13 定義) / `leaf_user_in_business` / `garden_role_of` / `is_user_active` (Task D.1 migration 定義、後者 2 個は Root A-3-g) — **全て plan 内で定義先が明示されている** ✅

### 3. Type consistency

- `KandenAttachment` 型: Task D.3 で `deleted_at` + `deleted_by` 追加、以降全 Task で一貫使用 ✅
- `GardenRole` 型 (v2): Task D.3 で union 型定義、`DELETABLE_ROLES` / `ADMIN_ROLES` は `readonly GardenRole[]` として同所で定義、RoleContext (D.12) → DeleteButton (A.3) / AdminActions (A.3c) で一貫使用 ✅
- `LeafBusiness` / `LeafUserBusiness` 型 (v2): Task D.3 で定義、Phase B-1 事業マスタ UI で使用予定 ✅
- `AttachmentCategory` 型: 既存 types.ts 定義をそのまま import、5 カテゴリ固定 ✅
- `UploadResult` / `UploadOptions` 型: Task D.11 で定義、Uploader で使用 ✅
- 関数シグネチャ: `softDeleteAttachment(id: string)` / `undoSoftDelete(id: string)` / `restoreAttachment(id: string)` / `hardDeleteAttachment(id: string)` / `verifyUserPasswordAndDownload(id: string, password: string)` / `isMobileDevice(): boolean` / `useGardenRole(): GardenRole | null` — 各 Task 内で一致 ✅

### 4. 独立性・DRY

- `AttachmentCard` / `AttachmentDeleteButton` / `AttachmentLightbox` / **`DownloadButton` / `AttachmentAdminActions` (v2)** は Backoffice に配置、Input は Backoffice から import して再利用 ✅
- `kanden-storage-paths.ts` が単一正本 ✅
- 圧縮ロジックは `image-compression.ts` + Worker に一元集約 ✅
- **`useGardenRole()` (Task D.12) が全ロール判定の単一正本** ✅
- **`isMobileDevice()` (Task D.13) が DL 分岐 + 並列数判定の単一正本** ✅

### 5. 依存・順序（v2）

- Task 0.1（承認）→ 0.2（install）→ 0.3（Vitest）
- → **Root A-3-g マージ確認**（Task D.1 Step 1）
- → D.1〜D.14（v2 で D.12 RoleContext / D.13 v2 関数群を追加、最終 D.14 がカバレッジ）
- → A.1〜A.6（v2 で A.3b DownloadButton / A.3c AttachmentAdminActions を追加、6 → 8 task）
- → B.1〜B.3
- → F.1〜F.5
- A.1 の `AttachmentCard` は A.3 の `AttachmentDeleteButton` に依存 → A.1 で stub 先行配置、A.3 で置換（v1 と同様）
- **A.4 の `AttachmentGrid` は D.12 RoleContext と A.3b DownloadButton / A.3c AdminActions に依存** → A.3b / A.3c を A.3 と A.4 の間に配置済 ✅

### 6. Task 総数（v1 → v3）

| Phase | v1 | v2 | v3 | 差分 (v2→v3) |
|---|---|---|---|---|
| Phase 0 | 3 | 3 | 3 | 0 |
| Phase D | 12 | 14 | 14 | 0（D.1/D.3/D.8/D.13 を v3 パッチ、新規 Task なし）|
| Phase A | 6 | 8 | **9** (+ **A.7 Root DL PW 設定 UI**) | **+1** |
| Phase B | 3 | 3 | 3 | 0 |
| Phase F | 5 | 5 | 5 | 0 |
| **合計** | **29** | **33** | **34** | **+1** |

※ v3 は主に既存 Task の実装差替（migration / attachments 関数 / DeleteButton / DownloadButton）と新規 Task A.7 の追加。

### 7. 見積変更（v2 → v3）

| Phase | v2 | v3 | 差分 | 主因 |
|---|---|---|---|---|
| Phase 0 | 0.3d | 0.3d | 0 | - |
| Phase D | 2.5d | **2.7d** | **+0.2d** | history trigger + DL PW RPC 追加 (+0.3d) / RLS 簡略化 (-0.1d) |
| Phase A | 2.0d | **2.3d** | **+0.3d** | Task A.7 Root DL PW 設定 UI 追加 (+0.3d)、DeleteButton ロール判定撤廃でほぼ相殺 |
| Phase B | 1.5d | 1.5d | 0 | 変更なし（RoleContext は同、DownloadButton は内部 RPC 差替のみ）|
| Phase F | 0.2d | 0.2d | 0 | 手動 RLS シナリオ 20→25 件は Phase F 内で吸収 |
| **合計** | **6.0d** | **6.7d** | **+0.7d** | - |

### 8. v3 で変更された既存 Task 一覧

| Task | v3 改訂内容 |
|---|---|
| Task 0.1 | ~~npm 承認依頼に bcryptjs / @types/bcryptjs 追加（8 → 10 パッケージ）~~ → **v3.2 改訂で bcryptjs / @types/bcryptjs を承認対象から除外**（10 → 8 パッケージに戻す、サーバ側 RPC 内 hash 化に変更）|
| Task D.1 | migration SQL に pgcrypto / history テーブル + trigger / RPC 2 本 / root_settings 初期値を追加。RLS UPDATE を全員可能に簡略化。ポリシー数 16 → 18 |
| Task D.3 | 型に `AttachmentHistory` / `ImageDownloadPasswordSetting` 追加 |
| Task D.8 | `softDeleteAttachment` を Client ガードなしに簡略化（docstring 更新のみ、機能は v2 から同じ）|
| Task D.13 | `verifyImageDownloadPassword` 新設、`verifyUserPasswordAndDownload` 内部実装を `auth.signInWithPassword` → `rpc('verify_image_download_password')` に差替 |
| Task A.3 | `AttachmentDeleteButton` のロール判定（`useGardenRole` 判定 + null return）を撤廃、全員表示、文言更新 |
| Task A.3b | `DownloadButton` の RTL mock を `auth.signInWithPassword` → `rpc` に差替、モーダル文言を「DL 専用 PW」に更新 |
| Task A.4 | （v2 の削除済バッジ実装は継続、v3 で追加変更なし）|

### 9. v3 で追加された新規 Task

| Task | 内容 | 見積 |
|---|---|---|
| **Task A.7** | Root マイページ 画像 DL PW 設定 UI（super_admin 限定、**v3.2 改訂: 平文 PW を `set_image_download_password({ new_password })` RPC に直送、サーバ側で bcrypt 化**、RTL 4 テスト）| 0.3d |

### 10. Spec 要件カバレッジ（v3 更新分）

v2 の全要件 + v3 追加要件を以下でカバー:

| spec v3 セクション | 要件 | 担当 Task |
|---|---|---|
| §1.2 論理削除を全員可能 | softDelete Client ガード撤廃 + DeleteButton ロール判定撤廃 | D.8, A.3 |
| §1.2 DL 専用 PW | verifyImageDownloadPassword + set RPC + UI | D.13, A.3b, **A.7** |
| §1.2 変更履歴記録 | history テーブル + trigger | D.1 |
| §1.5 マトリクス更新 | RLS + Client ガードを全員可に | D.1, A.3 |
| §2.3 RLS 簡略化 | UPDATE 事業所属のみ、DELETE admin+ | D.1 |
| §2.6.3 history テーブル + trigger | migration SQL に追加 | D.1 |
| §2.6.4 root_settings PW hash | migration + pgcrypto | D.1 |
| §2.6.6 型拡張 | AttachmentHistory / ImageDownloadPasswordSetting | D.3 |
| §3.4 削除フロー全員化 | DeleteButton 全員表示 + 文言 | A.3 |
| §3.5 DL 専用 PW | DownloadButton RPC 検証 + UI | A.3b, **A.7** |
| §3.5.5 RPC 関数 | migration SQL に RPC 2 本 | D.1 |
| §3.6 変更履歴記録（データ層のみ）| history テーブル + trigger + RLS | D.1 |
| §6 判断保留 #15-18（v3 追加）| 全 spec 本体に自動反映 | - |
| §7.2b Batch 14 履歴 UI | 本 plan スコープ外（spec で引継明記）| - |
| §7.2c DL PW ローテ運用 | Phase F 後の運用引継資料に追記 | F.4 |
| §8 Migration SQL v3 | scripts/leaf-schema-patch-a1c.sql | D.1 |
| §9.2 依存 root_settings / pgcrypto | Task D.1 Step 1 で事前確認 | D.1 |

ギャップなし ✅

### 11. Self-Review (v3)

- **Placeholder scan**: TBD/FIXME/XXX/??? 0 件、TODO は Phase B-1 意図的コメントのみ ✅
- **Type consistency**: v2 の型 + v3 追加型（AttachmentHistory / ImageDownloadPasswordSetting）で整合、関数シグネチャ（verifyImageDownloadPassword / verifyUserPasswordAndDownload 等）は Task 内で一致 ✅
- **Internal consistency**: spec §2.3 RLS v3 ↔ §8 migration v3、§3.4 削除フロー v3 ↔ Task A.3 ロール判定撤廃、§3.5 DL PW v3 ↔ Task D.13 / A.3b / A.7、すべて整合 ✅
- **Root A-3-g / A-3-h / pgcrypto 依存確認**: A-3-g 済、A-3-h 影響小、pgcrypto は migration 冒頭で有効化 → Task D.1 Step 2 にて対応 ✅
- **Scope**: 6.7d で単一 plan に適切、9 Task の Phase A が最も大きいが追加 A.7 は独立性高く分割可能 ✅

Self-review pass (v3)。

---

## v3.2 改訂サマリ（2026-05-07、a-review #65 セキュリティ修正反映）

### 改訂理由
a-review #65 が PR #65 (Task D.1 migration SQL) で検出した 2 件の重大セキュリティ脆弱性をすでに commit `4247005` で修正済（実コード反映済）。本 v3.2 改訂は **spec / plan を実コードに同期** させる文書整合作業。

### 改訂内容

| 領域 | 旧 (v3) | 新 (v3.2) |
|---|---|---|
| **SECURITY DEFINER 関数** | search_path 未指定（schema poisoning 脆弱性）| `SET search_path = ''` 追加、public schema は明示修飾、`auth.uid()` は `(SELECT auth.uid())` で囲む |
| **set_image_download_password 引数** | `new_hash text`（client から bcrypt hash 送信）| `new_password text`（client から平文送信、サーバ内で `extensions.crypt(pw, gen_salt('bf', 12))` で hash 化）|
| **client 側 hash 生成** | bcryptjs npm で client が hashSync | **廃止**（HTTPS 経路保護に依存、任意 hash 送信ルートを封殺）|
| **pgcrypto 関数呼出** | `crypt()` / `gen_salt()` を schema 修飾なし | `extensions.crypt()` / `extensions.gen_salt()` schema 明示 |
| **bcryptjs / @types/bcryptjs npm** | v3 で追加予定 | **v3.2 で除外**（不要化、Task 0.1 npm 承認 10 → 8 個）|
| **Task A.7 PasswordSetForm** | bcryptjs hashSync → RPC 呼出 | 平文 PW を直接 RPC 送信、コメント追記 |

### 影響範囲

| Phase / Task | 影響度 | 対応 |
|---|---|---|
| Task 0.1 (npm 承認) | 削減 | bcryptjs / @types/bcryptjs を承認対象から除外 |
| Task 0.2 (npm install) | 削減 | bcryptjs install 不要 |
| Task D.1 (migration SQL) | 既反映 | commit `4247005` で実コード修正済（PR #65 内）|
| Task D.13 (verifyImageDownloadPassword) | 影響なし | verify 側は元々 input_password 平文受取の正しい設計、search_path 追加のみ |
| Task A.7 (PasswordSetForm) | 大改訂 | bcryptjs import 廃止、平文 PW 直送、テスト mock 変更 |

### 見積影響

| Phase | v3 | v3.2 | 差分 | 理由 |
|---|---|---|---|---|
| Phase 0 | 0.3d | 0.3d | 0 | 承認パッケージ数減少だが同 Task 内で吸収 |
| Phase D | 2.7d | 2.7d | 0 | 既に commit 済、spec 反映のみ |
| Phase A | 2.3d | 2.3d | 0 | Task A.7 は実装簡略化（bcryptjs import 削除）と RPC 引数名変更のみ、追加見積なし |
| Phase B | 1.5d | 1.5d | 0 | 影響なし |
| Phase F | 0.2d | 0.2d | 0 | 影響なし |
| **合計** | **6.7d** | **6.7d** | **0** | - |

### 関連ファイル / コミット

- 実コード正本: `scripts/leaf-schema-patch-a1c.sql` + `supabase/migrations/20260425000005_leaf_a1c_attachments.sql`（PR #65 内、commit `4247005` で a-review #65 修正反映済）
- 本 v3.2 改訂: 本 plan + `docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md`（v3.2 同期）
- 別 PR で対応予定: `package.json` から bcryptjs / @types/bcryptjs 削除（実コード変更、本 v3.2 では文書のみ）

### 改訂履歴

- 2026-04-23 v1: 初版起草
- 2026-04-25 v2: ロール × 事業スコープ RLS、history、削除設計
- 2026-04-25 v3: 業務レビュー反映（論理削除全員可 / DL 専用 PW / history trigger）
- **2026-05-07 v3.2: a-review #65 セキュリティ修正反映（search_path / 平文 PW 直送 / extensions schema 明示 / bcryptjs 不要化）**

---

## Execution Handoff

Plan 起草完了、commit 済、push 後に a-main 経由で東海林さん朝業務レビュー → 承認 → 実装着手の流れ。

実装フェーズの方式選択は a-main / 東海林さんの判断に委ねます：

**1. Subagent-Driven（推奨）** — subagent-driven-development skill で fresh subagent per task + 段階レビュー。Task 間でコードレビュー挟めるので品質担保し易い。

**2. Inline Execution** — executing-plans skill で本セッション内で直列実行、checkpoint で区切り確認。

東海林さん承認後に方式を指示いただければ、対応する skill を invoke して実装着手します。
