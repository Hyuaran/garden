# T-F6-03: /api/forest/download-zip Edge Function 実装指示書

- 対象: Garden-Forest F6 Download Section の ZIP 生成バックエンド
- 見積: **1.5d**（約 12 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch2 #T-F6-03）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.6
- **判4 = B 案採用**（Edge Function + Supabase Storage）

---

## 1. スコープ

### 作る
- `POST /api/forest/download-zip` Route Handler（**Node ランタイム**、Edge 不可 — 後述）
- 入力: `{ companyIds: string[], kiCount: 1|2|3 }`
- 処理:
  1. 入力検証（ロール・会社 id・kiCount 範囲）
  2. 対象 `fiscal_periods` 抽出（各法人の直近 N 期）
  3. Supabase Storage `forest-docs/` から PDF 取得
  4. JSZip でストリーミング ZIP 生成
  5. Storage `forest-downloads/` に一時ファイル保存（5 分有効）
  6. signedURL を返却
- エラー時は JSON で詳細返却
- UI 側（フロント）の実装は**範囲外**（別 spec T-F6-04）

### 作らない
- フロント UI（セレクタ / ラジオ / progress bar）
- Drive API 直叩き（判3 B 案で Storage ミラー前提、移行バッチは別）
- ダウンロード履歴ログ（別 spec）
- 署名付き URL の **永続化**（都度生成）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **判3 B 案適用済** | `fiscal_periods.doc_url` の PDF 本体が Storage `forest-docs/` にミラー済（別バッチで実行） |
| **判4 B 案適用** | Edge Function + Storage での ZIP 生成 |
| Supabase | Storage bucket `forest-docs/`（private、admin+ write）/ `forest-downloads/`（private、短寿命）|
| 認証 | Supabase Auth の JWT、Route Handler 内で検証 |
| JSZip | npm `jszip` 導入必要（事前承認必要） |

---

## 3. ファイル構成

### 新規
- `src/app/api/forest/download-zip/route.ts` — Route Handler
- `src/app/api/forest/download-zip/_lib/build-zip.ts` — ZIP 生成ロジック
- `src/app/api/forest/download-zip/_lib/auth-check.ts` — JWT 検証 + forest_users 確認
- `src/app/api/forest/download-zip/_lib/resolve-targets.ts` — kiCount から対象 fiscal_periods 抽出
- `src/app/api/forest/download-zip/_lib/filename.ts` — ZIP ファイル名生成（単一/複数法人で分岐）
- `src/app/api/forest/download-zip/__tests__/build-zip.test.ts` — ユニットテスト

### 変更
- `package.json` — `jszip` 追加（**事前承認が必要**）
- `supabase/migrations/20260424_create_download_buckets.sql` — Storage bucket 作成 SQL（別 migration）

---

## 4. 型定義

```typescript
// src/app/api/forest/download-zip/_lib/types.ts
export type DownloadZipRequest = {
  companyIds: string[];           // 'hyuaran' 等、1〜6 個
  kiCount: 1 | 2 | 3;             // 直近 1/2/3 期
};

export type DownloadZipResponse =
  | { success: true; signedUrl: string; fileName: string; expiresAt: string }
  | { success: false; error: string; code: ErrorCode };

export type ErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT'
  | 'NO_DOCS' | 'STORAGE_ERROR' | 'ZIP_BUILD_FAILED';

export type ResolvedTarget = {
  companyId: string;
  companyShort: string;
  periods: { ki: number; doc_url: string | null; storage_path: string | null }[];
};
```

---

## 5. 実装ステップ

### Step 1: npm install（事前承認）
親 CLAUDE.md の「新パッケージ追加は事前相談」準拠。本 spec 着手前に東海林さんに `jszip` 導入承認を得る。

### Step 2: Storage bucket 作成 migration
```sql
-- supabase/migrations/20260424_create_download_buckets.sql
INSERT INTO storage.buckets (id, name, public) VALUES
  ('forest-docs', 'forest-docs', false),
  ('forest-downloads', 'forest-downloads', false)
ON CONFLICT DO NOTHING;

-- forest-docs: admin+ write, forest_users read
CREATE POLICY "fd_read_forest_user" ON storage.objects FOR SELECT
  USING (bucket_id = 'forest-docs' AND forest_is_user());
CREATE POLICY "fd_write_admin"     ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'forest-docs' AND forest_is_admin());

-- forest-downloads: 生成者のみ read（service_role_key 経由の INSERT）
CREATE POLICY "fdl_read_self" ON storage.objects FOR SELECT
  USING (bucket_id = 'forest-downloads' AND owner = auth.uid());
```

### Step 3: auth-check.ts
```typescript
// src/app/api/forest/download-zip/_lib/auth-check.ts
import { createClient } from '@supabase/supabase-js';

export async function verifyAuthAndPermission(request: Request): Promise<{
  userId: string; error?: string; code?: 'UNAUTHORIZED' | 'FORBIDDEN';
}> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return { userId: '', error: 'No auth token', code: 'UNAUTHORIZED' };

  // Supabase Auth で JWT 検証
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { userId: '', error: 'Invalid token', code: 'UNAUTHORIZED' };

  // forest_users に登録済か確認
  const { data: fu } = await supabase.from('forest_users')
    .select('user_id').eq('user_id', user.id).maybeSingle();
  if (!fu) return { userId: user.id, error: 'Not a forest user', code: 'FORBIDDEN' };

  return { userId: user.id };
}
```

### Step 4: resolve-targets.ts
```typescript
// src/app/api/forest/download-zip/_lib/resolve-targets.ts
import { createClient } from '@supabase/supabase-js';
import type { ResolvedTarget } from './types';

const COMPANY_ORDER = ['hyuaran','centerrise','linksupport','arata','taiyou','ichi'];

export async function resolveTargets(
  companyIds: string[], kiCount: 1|2|3, userToken: string,
): Promise<ResolvedTarget[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${userToken}` } } }
  );

  const ordered = COMPANY_ORDER.filter(id => companyIds.includes(id));

  const results: ResolvedTarget[] = [];
  for (const cid of ordered) {
    const { data: company, error: cErr } = await supabase
      .from('companies').select('id, short').eq('id', cid).maybeSingle();
    if (cErr || !company) continue;

    const { data: fps, error: fErr } = await supabase
      .from('fiscal_periods')
      .select('ki, doc_url, storage_path')
      .eq('company_id', cid)
      .not('doc_url', 'is', null)       // doc が登録されている期のみ
      .order('ki', { ascending: false })
      .limit(kiCount);
    if (fErr) throw new Error(`resolveTargets.fps: ${fErr.message}`);

    results.push({
      companyId: cid,
      companyShort: company.short,
      periods: (fps ?? []).reverse(),    // 古い ki → 新しい ki の順
    });
  }
  return results;
}
```

### Step 5: build-zip.ts
```typescript
// src/app/api/forest/download-zip/_lib/build-zip.ts
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import type { ResolvedTarget } from './types';

export async function buildZip(
  targets: ResolvedTarget[], userId: string, zipFileName: string,
): Promise<{ signedUrl: string; fileName: string; expiresAt: string }> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,     // Storage 署名生成に必要
  );

  const zip = new JSZip();

  let orderNum = 1;
  for (const t of targets) {
    if (!t.periods.length) continue;
    const kiMin = t.periods[0].ki;
    const kiMax = t.periods[t.periods.length - 1].ki;
    const kiLabel = kiMin === kiMax ? `第${kiMin}期` : `第${kiMin}期-第${kiMax}期`;
    const folder = zip.folder(`${String(orderNum).padStart(2, '0')}_${t.companyShort}_${kiLabel}`);
    if (!folder) continue;

    for (const p of t.periods) {
      if (!p.storage_path) continue;
      const { data, error } = await admin.storage.from('forest-docs').download(p.storage_path);
      if (error || !data) {
        console.error('[download-zip] fetch PDF failed', p.storage_path, error);
        continue;   // 個別失敗は continue（全体は継続）
      }
      const buf = Buffer.from(await data.arrayBuffer());
      folder.file(`${t.companyShort}_第${p.ki}期.pdf`, buf);
    }
    orderNum++;
  }

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  // Storage に一時保存
  const storageKey = `${userId}/${Date.now()}_${zipFileName}`;
  const { error: upErr } = await admin.storage.from('forest-downloads').upload(
    storageKey, zipBuf,
    { contentType: 'application/zip', upsert: true,
      metadata: { userId, generatedAt: new Date().toISOString() } }
  );
  if (upErr) throw new Error(`upload ZIP: ${upErr.message}`);

  // 5 分有効の signed URL
  const { data, error: sErr } = await admin.storage.from('forest-downloads').createSignedUrl(storageKey, 300);
  if (sErr) throw new Error(`sign URL: ${sErr.message}`);

  return {
    signedUrl: data.signedUrl,
    fileName: zipFileName,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
}
```

### Step 6: filename.ts
```typescript
// src/app/api/forest/download-zip/_lib/filename.ts
import type { ResolvedTarget } from './types';

export function generateZipFileName(targets: ResolvedTarget[], kiCount: number): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

  const withDocs = targets.filter(t => t.periods.length > 0);
  const isMulti = withDocs.length > 1;

  if (isMulti) {
    return `ヒュアラングループ_直近${kiCount}期決算書_${dateStr}時点.zip`;
  }
  const single = withDocs[0];
  if (!single) return `Garden_決算書_${dateStr}.zip`;   // フォールバック
  const kiMin = single.periods[0].ki;
  const kiMax = single.periods[single.periods.length - 1].ki;
  const kiLabel = kiMin === kiMax ? `第${kiMin}期` : `第${kiMin}期-第${kiMax}期`;
  return `${single.companyShort}_直近${kiCount}期決算書_${kiLabel}_${dateStr}時点.zip`;
}
```

### Step 7: Route Handler 本体
```typescript
// src/app/api/forest/download-zip/route.ts
export const runtime = 'nodejs';       // Edge ではなく Node（JSZip が Edge 非対応、日本語ファイル名処理）
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndPermission } from './_lib/auth-check';
import { resolveTargets } from './_lib/resolve-targets';
import { buildZip } from './_lib/build-zip';
import { generateZipFileName } from './_lib/filename';
import type { DownloadZipRequest, DownloadZipResponse } from './_lib/types';

export async function POST(request: NextRequest): Promise<NextResponse<DownloadZipResponse>> {
  try {
    // Auth
    const { userId, error, code } = await verifyAuthAndPermission(request);
    if (error || !userId) return NextResponse.json({ success: false, error: error!, code: code! }, { status: code === 'UNAUTHORIZED' ? 401 : 403 });

    // Input validation
    const body = (await request.json()) as DownloadZipRequest;
    if (!Array.isArray(body.companyIds) || body.companyIds.length === 0 || body.companyIds.length > 6) {
      return NextResponse.json({ success: false, error: '会社を1〜6社選択してください', code: 'INVALID_INPUT' }, { status: 400 });
    }
    if (![1, 2, 3].includes(body.kiCount)) {
      return NextResponse.json({ success: false, error: 'kiCount は 1/2/3 のいずれか', code: 'INVALID_INPUT' }, { status: 400 });
    }

    // Resolve
    const token = request.headers.get('authorization')!.replace(/^Bearer\s+/i, '');
    const targets = await resolveTargets(body.companyIds, body.kiCount, token);
    const totalDocs = targets.reduce((sum, t) => sum + t.periods.length, 0);
    if (totalDocs === 0) {
      return NextResponse.json({ success: false, error: '対象の決算書が見つかりません', code: 'NO_DOCS' }, { status: 404 });
    }

    // Build + upload
    const zipFileName = generateZipFileName(targets, body.kiCount);
    const result = await buildZip(targets, userId, zipFileName);

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const err = e as Error;
    console.error('[POST /api/forest/download-zip]', err);
    return NextResponse.json({
      success: false,
      error: err.message,
      code: err.message.includes('upload') || err.message.includes('sign') ? 'STORAGE_ERROR' : 'ZIP_BUILD_FAILED',
    }, { status: 500 });
  }
}
```

### Step 8: ユニットテスト
`build-zip.test.ts` で以下をモック検証:
1. 1 社 × 1 期 → ZIP 内に 1 フォルダ / 1 PDF
2. 3 社 × 2 期 → 3 フォルダ、計 6 PDF、フォルダ名 `01_〜` 〜 `03_〜`
3. PDF fetch 失敗 1 件 → 該当スキップ、他は成功
4. `filename.ts` の単一/複数分岐（4 テスト）

### Step 9: Storage 一時ファイルの掃除 Cron（任意）
```typescript
// 別タスクで実装: Vercel Cron daily で forest-downloads/ の 1 日超ファイル削除
// 本 spec では「署名付き URL が 5 分で失効すれば実害なし」として Phase A では省略
```

---

## 6. データソース

| 種類 | 情報源 | 操作 |
|---|---|---|
| Supabase | `fiscal_periods` | SELECT by company_id, kiCount 件 |
| Supabase | `companies` | SELECT by id（`short` 取得用）|
| Supabase | `forest_users` | SELECT by user_id（権限確認）|
| Storage | `forest-docs/` | download（PDF 本体）|
| Storage | `forest-downloads/` | upload + createSignedUrl（一時 ZIP）|

---

## 7. UI 仕様

本 spec は**バックエンドのみ**。UI（セレクタ・ラジオ・progress）は別 spec T-F6-04（本 Batch 2 対象外）。

ただしフロント側から呼び出す際の**契約例**:
```typescript
const response = await fetch('/api/forest/download-zip', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ companyIds: ['hyuaran','centerrise'], kiCount: 3 }),
});
const json: DownloadZipResponse = await response.json();
if (json.success) window.open(json.signedUrl, '_blank');
else alert(`エラー: ${json.error}`);
```

---

## 8. エラーハンドリング

| # | エラー | HTTP | code | 対応 |
|---|---|---|---|---|
| E1 | JWT 無し or 期限切れ | 401 | UNAUTHORIZED | ログイン画面へ誘導 |
| E2 | forest_users 未登録 | 403 | FORBIDDEN | アクセス拒否表示 |
| E3 | 入力不正（空 / 7 社以上 / kiCount 範囲外）| 400 | INVALID_INPUT | メッセージ表示 |
| E4 | 対象期 0 件（doc_url null のみ）| 404 | NO_DOCS | 「登録されていません」表示 |
| E5 | Storage download / upload 失敗 | 500 | STORAGE_ERROR | 再試行を促す |
| E6 | JSZip 生成失敗（稀）| 500 | ZIP_BUILD_FAILED | 再試行 or ログ確認 |
| E7 | 個別 PDF fetch 失敗 | 200 (部分成功) | — | ZIP に含めずに続行、警告 log |

**ロギング**: すべてのエラーは `console.error` で Vercel Function ログへ。将来 `forest_audit_log` に記録検討。

---

## 9. 権限・RLS

| 操作 | 許可ロール |
|---|---|
| `/api/forest/download-zip` POST | forest_users 登録済（= toss 以上）|
| Storage `forest-docs/` read | forest_users |
| Storage `forest-downloads/` read | 生成者本人のみ（owner=auth.uid()）|
| Storage `forest-downloads/` upload | Route Handler から **service_role_key** 経由（クライアント直接不可）|

RLS 詳細は Step 2 の migration 参照。

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 1/2/3 期 × 1/2/3/6 社の 12 組合せ（代表 4 組）|
| 2 | エッジケース | 0 社 / 7 社入力 / 存在しない company_id / 巨大 PDF（50MB）|
| 3 | 権限 | 非 forest_user で 403、未ログインで 401 |
| 4 | データ境界 | doc_url null のみの法人、kiCount=3 だが該当 2 期しかない等 |
| 5 | パフォーマンス | 6 社 × 3 期 = 18 PDF、ZIP 生成 30 秒以内 |
| 6 | Console | エラーは E7（部分失敗）のみ許容 |
| 7 | a11y | API のため不要、フロント側（T-F6-04）で対応 |

---

## 11. 関連参照

- **v9 HTML L1786-1944**: `downloadDocs()` 関数、ZIP 生成ロジック（GAS 版）
- **v9 HTML L1870-1881**: ZIP ファイル名生成ロジック（`isMulti` 分岐）
- **P07 §4.6**: F6 Download Section 差分
- **P07 §6**: 実装順序（判3・判4 の B 案採用）
- **親 CLAUDE.md §4**: `SUPABASE_SERVICE_ROLE_KEY` の扱い
- **既知ハマり**: [docs/known-pitfalls.md §6.1](../known-pitfalls.md) Service Role Key の境界管理

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | Edge ランタイム採用 | **Node 固定**（JSZip 互換性・日本語ファイル名・Buffer 依存）|
| 判2 | 署名付き URL の有効期限 | **5 分**（ユーザーが即押下する前提、長くすると漏洩リスク）|
| 判3 | `forest-downloads/` の掃除 Cron | **Phase A 内は省略**（signedURL 失効で実害なし）、Phase B で導入 |
| 判4 | PDF 本体の Drive→Storage 移行バッチ | **別 spec**（本 spec 着手前に完了想定）。未完了時は代替として `doc_url` からの fetch（CORS 注意）|
| 判5 | 大量 PDF 時のストリーミング応答 | **Phase A では一括生成**（〜50MB 想定で足る）、50MB 超なら分割 API 設計 |
| 判6 | ダウンロード履歴ログ | **別 spec**。`forest_audit_log` に記録 |

— end of T-F6-03 spec —
