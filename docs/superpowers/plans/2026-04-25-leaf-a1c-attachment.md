# Garden-Leaf A-1c 添付ファイル機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 関電業務委託案件の画像（電灯/動力/ガス/諸元/受領書）を Garden-Leaf 上で閲覧・アップロード・圧縮・サムネ生成・論理削除できるようにする。client 主導 + Pattern-1 簡略版 RLS + 3 バケット分離の構成。

**Architecture:** 3 層構造（UI / ロジック / インフラ）。UI は Backoffice（PC 事務用）と Input（モバイル営業用）の 2 画面。ロジックは `src/app/leaf/_lib/` に集約、`attachments.ts` / `image-compression.ts` + Worker / `kanden-storage-paths.ts` の 3 本。インフラは Supabase Storage × 3 bucket + Postgres テーブル 1 本拡張。spec-cross-rls-audit §2 パターン A に従い `src/lib/supabase/client.ts` を新設して Leaf を先頭バッターとする。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4 / Supabase JS 2.103 / heic2any (新規) / vitest + @testing-library/react + MSW + happy-dom (新規、要承認)

**仕様書**: `docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md`（商号承認済み、a-bloom 技術 §2🟢/§4🟢/§7🟡/§8🟢、東海林さん業務レビュー待ち）

**見積**: 4.0d（Phase 0 = 0.3d / Phase D 共通基盤 = 1.5d / Phase A Backoffice = 1.5d / Phase B Input = 1.0d / Phase F 仕上げ = 0.2d、並行一部あり）

---

## File Structure

### 新規作成（Create）

**インフラ / Migration:**
- `scripts/leaf-schema-patch-a1c.sql` — ALTER TABLE + 3 bucket 作成 + RLS ポリシー
- `src/lib/supabase/client.ts` — 横断共通 browser Supabase client

**Leaf ロジック層 `src/app/leaf/_lib/`:**
- `kanden-storage-paths.ts` — bucket/path 命名の集中管理（pure function）
- `image-compression.ts` — Canvas 圧縮 + サムネ + HEIC 変換 Worker ラッパ
- `image-compression.worker.ts` — 重処理の Web Worker 実装
- `attachments.ts` — upload / signedURL / softDelete / CRUD

**Leaf Backoffice UI `src/app/leaf/backoffice/_components/`:**
- `AttachmentCard.tsx` — 共通サムネカード
- `AttachmentGrid.tsx` — サムネ一覧（カテゴリ別タブ）
- `AttachmentLightbox.tsx` — 1500px 拡大ビューワ
- `AttachmentUploader.tsx` — PC 向け drag&drop + file input
- `AttachmentDeleteButton.tsx` — ホバー × + 2 段確認 + UNDO

**Leaf Input UI `src/app/leaf/input/`（新規画面）:**
- `page.tsx` — 営業向け入力画面（新規）
- `_components/CategoryPicker.tsx` — 大きめタップターゲット
- `_components/MobileAttachmentUploader.tsx` — カメラ起動 + モバイル専用

**テスト基盤 `src/test-utils/`（新規）:**
- `src/test-utils/supabase-mock.ts` — Supabase client mock (RLS 簡易 / Storage PUT / signedURL)
- `src/test-utils/msw-handlers/leaf-kanden.ts` — MSW handlers for Leaf

**テスト `src/app/leaf/_lib/__tests__/`:**
- `kanden-storage-paths.test.ts`
- `image-compression.test.ts`
- `attachments.test.ts`

**テスト `src/app/leaf/backoffice/_components/__tests__/`:**
- `AttachmentGrid.test.tsx`
- `AttachmentUploader.test.tsx`
- `AttachmentLightbox.test.tsx`
- `AttachmentDeleteButton.test.tsx`

**テスト `src/app/leaf/input/_components/__tests__/`:**
- `MobileAttachmentUploader.test.tsx`
- `CategoryPicker.test.tsx`

**設定ファイル:**
- `vitest.config.ts` — Vitest 設定（happy-dom + path alias）
- `src/test-utils/vitest-setup.ts` — RTL matcher 拡張

**ドキュメント（実施時記録）:**
- `docs/manual-rls-test-a1c-results.md` — 手動 RLS 検証結果
- `docs/pre-release-test-YYYYMMDD-leaf-a1c.md` — §16 7 種テスト結果（実施日で YYYYMMDD を埋める）
- `docs/phase-b1-followups-leaf.md` — Phase B-1 後日対応タスク（§7.3 TimeTree / §7.5 Lightbox）

### 変更（Modify）

- `package.json` — 依存追加（heic2any + テスト基盤一式）
- `src/app/leaf/_lib/supabase.ts` — re-export 一行に縮小（既存 import 不変）
- `src/app/leaf/_lib/types.ts:115-140` — `KandenAttachment` に `deleted_at: string | null` 追加
- `src/app/leaf/backoffice/page.tsx` — AttachmentGrid 組込
- `docs/effort-tracking.md` — D/A/B の実績追記
- `tsconfig.json` — vitest types 追加

---

## 前提: 新規 npm パッケージ追加の承認状況

親 CLAUDE.md「新しいnpmパッケージを追加する場合は事前に相談する」ルールに従い、以下を Task 0.1 で東海林さんに一括承認依頼する：

| パッケージ | 用途 | バージョン | 承認状況 |
|---|---|---|---|
| `heic2any` | HEIC → JPEG 変換 | ^0.0.4 | ✅ 承認済（Q6.1） |
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

## Phase D: 共通基盤（1.5d）

### Task D.1: Migration SQL（手動実行 + 記録）

**Files:**
- Create: `scripts/leaf-schema-patch-a1c.sql`

- [ ] **Step 1: migration SQL ファイルを作成**

```sql
-- scripts/leaf-schema-patch-a1c.sql
-- ============================================================
-- Garden-Leaf A-1c 添付ファイル機能 migration
-- Run this in Supabase Dashboard > SQL Editor
-- Spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §8
-- ============================================================

-- 1. 既存 leaf_kanden_attachments に deleted_at 追加
ALTER TABLE leaf_kanden_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_leaf_kanden_attachments_case_id_active
  ON leaf_kanden_attachments (case_id)
  WHERE deleted_at IS NULL;

-- 2. 3 bucket 作成
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

-- TODO (Phase B-1): ロール分岐導入後、"owner or admin のみ" へ強化
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
  USING (bucket_id IN ('leaf-kanden-photos-monthly','leaf-kanden-photos-yearly')
         AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS leaf_archive_insert ON storage.objects;
CREATE POLICY leaf_archive_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('leaf-kanden-photos-monthly','leaf-kanden-photos-yearly')
              AND FALSE);

DROP POLICY IF EXISTS leaf_archive_update ON storage.objects;
CREATE POLICY leaf_archive_update ON storage.objects FOR UPDATE
  USING (bucket_id IN ('leaf-kanden-photos-monthly','leaf-kanden-photos-yearly')
         AND FALSE);

DROP POLICY IF EXISTS leaf_archive_delete ON storage.objects;
CREATE POLICY leaf_archive_delete ON storage.objects FOR DELETE
  USING (bucket_id IN ('leaf-kanden-photos-monthly','leaf-kanden-photos-yearly')
         AND FALSE);
```

- [ ] **Step 2: Supabase Dashboard > SQL Editor で garden-dev に対して実行**

手順:
1. garden-dev Supabase プロジェクトにログイン
2. SQL Editor を開く
3. `scripts/leaf-schema-patch-a1c.sql` の内容を貼り付けて実行
4. エラーなく完了することを確認

Expected:
- `ALTER TABLE` 成功
- 3 bucket が `storage.buckets` に INSERT される
- 12 ポリシーが作成される

- [ ] **Step 3: 実行結果確認 SQL**

SQL Editor で以下を実行：
```sql
-- 列追加確認
SELECT column_name FROM information_schema.columns
WHERE table_name = 'leaf_kanden_attachments' AND column_name = 'deleted_at';

-- bucket 作成確認
SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets
WHERE id LIKE 'leaf-kanden-photos-%' ORDER BY id;

-- ポリシー作成確認
SELECT policyname FROM pg_policies WHERE tablename = 'leaf_kanden_attachments';
SELECT policyname FROM pg_policies WHERE tablename = 'objects'
  AND policyname LIKE 'leaf_%';
```

Expected: 
- deleted_at 列 1 件
- bucket 3 件（recent 5MB / monthly 50MB / yearly 50MB）
- leaf_attachments_* ポリシー 4 件
- leaf_recent_* + leaf_archive_* ポリシー 8 件

- [ ] **Step 4: コミット**

```bash
git add scripts/leaf-schema-patch-a1c.sql
git commit -m "feat(leaf): A-1c migration SQL (ALTER + 3 bucket + RLS 12 ポリシー)"
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

- [ ] **Step 1: `KandenAttachment` interface に `deleted_at` 追加**

`src/app/leaf/_lib/types.ts` の `KandenAttachment` 定義部分を以下に更新（最終 `archived_at: string | null;` の後、`}` の前に追加）:

```typescript
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
  deleted_at: string | null;  // A-1c 追加：論理削除用
}
```

- [ ] **Step 2: `npx tsc --noEmit` で型チェック通過確認**

```bash
npx tsc --noEmit
```

Expected: 既存コードがこの型を使っていても既定値 NULL があるのでエラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/app/leaf/_lib/types.ts
git commit -m "feat(leaf): KandenAttachment 型に deleted_at を追加 (A-1c 論理削除用)"
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

/** 論理削除（deleted_at = now()） */
export async function softDeleteAttachment(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('leaf_kanden_attachments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('attachment_id', attachmentId);
  if (error) throw new Error(`softDeleteAttachment failed: ${error.message}`);
}

/** 論理削除の取消（deleted_at = NULL、UNDO snackbar から呼ばれる） */
export async function undoSoftDelete(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('leaf_kanden_attachments')
    .update({ deleted_at: null })
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

### Task D.12: Phase D 仕上げ — カバレッジ確認

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

## Phase A: Backoffice UI（1.5d）

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

### Task A.3: `AttachmentDeleteButton.tsx` + RTL test（2 段確認 + UNDO）

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
git commit -m "feat(leaf): AttachmentDeleteButton (ホバー × + 2 段確認) (TDD)"
```

### Task A.4: `AttachmentGrid.tsx` + RTL test（UNDO snackbar 含む）

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

### Task A.6: Backoffice `page.tsx` 組込

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

---

## Phase B: Input UI（1.0d）

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

### Task B.3: Input `page.tsx` 新設

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

### Task F.1: 手動 RLS 検証 12 シナリオ

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

## Self-Review（後述の spec 全要件との突合せ）

### 1. Spec 要件カバレッジ

| spec セクション | 要件 | 担当 Task |
|---|---|---|
| §1.2 スコープ - 閲覧 | AttachmentGrid 実装 | A.4 |
| §1.2 スコープ - upload | AttachmentUploader + MobileAttachmentUploader | A.5, B.2 |
| §1.2 スコープ - 圧縮 | image-compression + Worker | D.6, D.7 |
| §1.2 スコープ - サムネ | generateThumbnail / thumbnailWithWorker | D.6, D.7 |
| §1.2 スコープ - 論理削除 | AttachmentDeleteButton + softDeleteAttachment | A.3, D.8 |
| §1.2 スコープ - HEIC | convertHeicToJpeg | D.6 |
| §2.2 Storage パス | kanden-storage-paths | D.4 |
| §2.3 RLS SQL | scripts/leaf-schema-patch-a1c.sql | D.1 |
| §2.4 size/MIME 制限 | migration の file_size_limit/allowed_mime_types | D.1 |
| §2.5 client 共通化 | src/lib/supabase/client.ts | D.2 |
| §2.6 deleted_at 追加 | types.ts + migration | D.1, D.3 |
| §3.1 upload フロー | uploadAttachments 関数 | D.11 |
| §3.2 失敗リカバリ | putWithRetry / uploadAttachments | D.11 |
| §3.3 signedURL ハイブリッド | createAttachmentSignedUrls + Lightbox の個別発行 | D.9, A.4 |
| §3.4 論理削除 UI | AttachmentDeleteButton + UNDO snackbar | A.3, A.4 |
| §3.5 Lightbox 仕様 | AttachmentLightbox | A.2 |
| §4.1 Vitest ユニット | 各 _lib/__tests__/*.test.ts | D.4, D.6, D.8-11 |
| §4.2 RTL + MSW | 各 _components/__tests__/*.test.tsx | A.1-5, B.1-2 |
| §4.3 手動 RLS 12 シナリオ | `docs/manual-rls-test-a1c-results.md` | F.1 |
| §4.4 test-utils 共通化 | src/test-utils/supabase-mock.ts | D.5 |
| §4.5 §16 7 種テスト | `docs/pre-release-test-*-leaf-a1c.md` | F.2 |
| §5 実装ステップ D/A/B | Phase D / A / B 分割 | D.*, A.*, B.* |
| §6 判断保留 11 件 | spec 本体確定済、実装で自動反映 | - |
| §7 Phase B 引継 | `docs/phase-b1-followups-leaf.md` | F.4 |
| §8 Migration SQL | scripts/leaf-schema-patch-a1c.sql | D.1 |

ギャップなし ✅

### 2. Placeholder scan

本 plan 内を grep で検査:
- "TBD" / "FIXME" / "XXX": 0 件 ✅
- "TODO" マーカー: scripts/leaf-schema-patch-a1c.sql と実装コメント内のみ、全て「Phase B-1 で強化」意図の記録（placeholder ではない）✅
- "YYYYMMDD" / "YYYY-MM-DD": Task F.1 / F.2 / F.3 の実施日埋込部分のみ（実施時に確定する placeholder として許容）✅
- 未定義関数・型の参照: なし ✅

### 3. Type consistency

- `KandenAttachment` 型: Task D.3 で `deleted_at: string | null` 追加、以降全 Task で一貫使用 ✅
- `AttachmentCategory` 型: 既存 types.ts 定義をそのまま import、5 カテゴリ固定 ✅
- `UploadResult` / `UploadOptions` 型: Task D.11 で定義、Uploader で使用 ✅
- 関数シグネチャ: `softDeleteAttachment(id: string)` / `undoSoftDelete(id: string)` / `uploadAttachments(files, caseId, category, opts)` / `createAttachmentSignedUrls(paths, ttl)` — Task 内で一致 ✅

### 4. 独立性・DRY

- `AttachmentCard` / `AttachmentDeleteButton` / `AttachmentLightbox` は Backoffice に配置、Input は Backoffice から import して再利用（Task B.3 で `AttachmentGrid` を import）✅
- `kanden-storage-paths.ts` が単一正本 ✅
- 圧縮ロジックは `image-compression.ts` + Worker に一元集約 ✅

### 5. 依存・順序

- Task 0.1（承認）→ 0.2（install）→ 0.3（Vitest）→ D.1〜D.12 → A.1〜A.6 → B.1〜B.3 → F.1〜F.5
- A.1 の `AttachmentCard` は A.3 の `AttachmentDeleteButton` に依存 → Task A.1 で stub を先行配置、A.3 で置換（plan 内で明記済）✅

Self-review pass。

---

## Execution Handoff

Plan 起草完了、commit 済、push 後に a-main 経由で東海林さん朝業務レビュー → 承認 → 実装着手の流れ。

実装フェーズの方式選択は a-main / 東海林さんの判断に委ねます：

**1. Subagent-Driven（推奨）** — subagent-driven-development skill で fresh subagent per task + 段階レビュー。Task 間でコードレビュー挟めるので品質担保し易い。

**2. Inline Execution** — executing-plans skill で本セッション内で直列実行、checkpoint で区切り確認。

東海林さん承認後に方式を指示いただければ、対応する skill を invoke して実装着手します。
