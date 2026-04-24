# T-F6-02: Drive PDF → Supabase Storage ミラーリングバッチ 実装指示書

- 対象: Garden-Forest F6 の前提データ整備（既存 `fiscal_periods.doc_url` の PDF 本体を Storage へ移送）
- 見積: **0.5d**（約 4 時間、投入と動作確認含む）
- 担当セッション: a-forest（+ 東海林さんの Google Drive 権限調整）
- 作成: 2026-04-24（a-auto / Phase A 先行 batch3 #T-F6-02）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.6, `docs/specs/2026-04-24-forest-t-f6-03-download-zip-edge.md` §2 判4 / 判6
- **判3 = B 案採用**（PDF を Supabase Storage にミラー）

---

## 1. スコープ

### 作る
- **1 回実行のデータ移送バッチ**（Node.js スクリプト、`scripts/migrate-forest-pdfs.mjs`）
- 既存 `fiscal_periods.doc_url`（Google Drive URL）の PDF を `forest-docs/` bucket へアップロード
- `fiscal_periods.storage_path` カラムを新設し、Storage 上のパスを格納
- **冪等性保証**（再実行しても重複アップロードしない）
- 動作確認手順書（全法人 × 全期の移送数の検証）

### 作らない
- Drive API の新規連携（既存の Drive 公開 URL を `fetch` で取得）
- Storage → Drive の逆方向同期
- 定期実行 Cron（1 回きりのバッチ）
- TSX コード変更（`storage_path` の利用は T-F6-03 が既に前提としている）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **T-F6-01 完了** | `forest-docs` bucket 作成済、RLS 適用済 |
| 既存 `fiscal_periods.doc_url` | Google Drive の公開 URL（`/d/{fileId}/view?usp=sharing` 形式）|
| Drive 共有設定 | 公開 URL 経由で取得可能（リンクを知っている全員が閲覧可）|
| Node.js | 18+ 推奨（ESM, fetch, Buffer サポート）|
| 環境変数 | `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` あり |
| 既存 Python スクリプト | `scripts/update_shinkouki_supabase.py` が類似実装あり、参考可 |

**想定件数**: 5 法人 × 最大 9 期 = 約 35 PDF（v9 HTML 準拠）

---

## 3. ファイル構成

### 新規
- `scripts/migrate-forest-pdfs.mjs` — バッチスクリプト本体
- `supabase/migrations/20260424_04_fiscal_periods_storage_path.sql` — カラム追加
- `scripts/README-migrate-pdfs.md` — 実行手順書

### 変更
- `fiscal_periods` テーブル — `storage_path TEXT NULL` カラム追加
- `scripts/requirements.txt` は不要（Python 不使用、Node.js で実装）

---

## 4. 型定義

スクリプト内部の型（TypeScript 省略、JSDoc で記述）:

```javascript
/**
 * @typedef {Object} FiscalPeriod
 * @property {string} id
 * @property {string} company_id
 * @property {number} ki
 * @property {string|null} doc_url
 * @property {string|null} storage_path
 */

/**
 * @typedef {Object} MigrationResult
 * @property {string} periodId
 * @property {string} companyId
 * @property {number} ki
 * @property {'success'|'skipped'|'failed'} status
 * @property {string} [storagePath]
 * @property {string} [error]
 */
```

---

## 5. 実装ステップ

### Step 1: DB カラム追加
```sql
-- supabase/migrations/20260424_04_fiscal_periods_storage_path.sql
BEGIN;

ALTER TABLE fiscal_periods
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD CONSTRAINT uq_fiscal_periods_storage_path UNIQUE (storage_path)
    DEFERRABLE INITIALLY DEFERRED;

COMMENT ON COLUMN fiscal_periods.storage_path IS
  'Supabase Storage forest-docs/ 内のパス。doc_url と併存（移行期の二重管理）';

CREATE INDEX IF NOT EXISTS fiscal_periods_storage_path_idx
  ON fiscal_periods (storage_path)
  WHERE storage_path IS NOT NULL;

COMMIT;
```

### Step 2: Drive URL → fileId 抽出関数
```javascript
// scripts/migrate-forest-pdfs.mjs
function extractDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
}

function buildDriveDownloadUrl(fileId) {
  // Drive 公開 URL から直接ダウンロードする形式
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
```

### Step 3: ファイル名規則
```javascript
/**
 * Storage path 生成規則
 * パターン: {company_id}/ki{ki}_{fileId8桁}.pdf
 * 例: hyuaran/ki7_1I9UqEno.pdf
 *
 * メリット:
 * - company_id でフォルダ階層が自然にできる
 * - ki でソート可能
 * - fileId 短縮版で重複回避
 */
function buildStoragePath(companyId, ki, fileId) {
  const shortId = (fileId ?? '').slice(0, 8);
  return `${companyId}/ki${ki}_${shortId}.pdf`;
}
```

### Step 4: メインループ
```javascript
// scripts/migrate-forest-pdfs.mjs（抜粋）
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const LOG = [];

async function migratePeriod(period) {
  const { id, company_id, ki, doc_url, storage_path } = period;

  // 冪等性チェック: 既に storage_path が設定されていればスキップ
  if (storage_path) {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'skipped', reason: 'already migrated' });
    return;
  }

  if (!doc_url) {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'skipped', reason: 'no doc_url' });
    return;
  }

  const fileId = extractDriveFileId(doc_url);
  if (!fileId) {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'failed', error: 'invalid doc_url' });
    return;
  }

  const path = buildStoragePath(company_id, ki, fileId);

  if (DRY_RUN) {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'success', storagePath: path, dryRun: true });
    return;
  }

  // 1. Drive から PDF 取得
  const driveUrl = buildDriveDownloadUrl(fileId);
  const response = await fetch(driveUrl);
  if (!response.ok) {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'failed', error: `Drive fetch ${response.status}` });
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  // PDF ファイルかどうか最低限のチェック（先頭 4 バイトが %PDF）
  if (buffer.slice(0, 4).toString() !== '%PDF') {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'failed', error: 'not a valid PDF (may be Drive login page)' });
    return;
  }

  // 2. Storage へアップロード
  const { error: upErr } = await supabase.storage.from('forest-docs').upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (upErr) {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'failed', error: `Storage upload: ${upErr.message}` });
    return;
  }

  // 3. DB に storage_path を保存
  const { error: updateErr } = await supabase
    .from('fiscal_periods')
    .update({ storage_path: path })
    .eq('id', id);
  if (updateErr) {
    LOG.push({ periodId: id, companyId: company_id, ki, status: 'failed', error: `DB update: ${updateErr.message}` });
    return;
  }

  LOG.push({ periodId: id, companyId: company_id, ki, status: 'success', storagePath: path });
}

async function main() {
  console.log(`[migrate-forest-pdfs] DRY_RUN=${DRY_RUN}`);

  const { data: periods, error } = await supabase
    .from('fiscal_periods')
    .select('id, company_id, ki, doc_url, storage_path')
    .order('company_id').order('ki');
  if (error) { console.error('fetch periods:', error); process.exit(1); }

  console.log(`[migrate-forest-pdfs] ${periods.length} periods to process`);

  for (const p of periods) {
    try {
      await migratePeriod(p);
      // Drive レート制限対策：1 秒スリープ
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      LOG.push({ periodId: p.id, companyId: p.company_id, ki: p.ki, status: 'failed', error: e.message });
    }
  }

  // サマリ
  const succeeded = LOG.filter(l => l.status === 'success').length;
  const skipped   = LOG.filter(l => l.status === 'skipped').length;
  const failed    = LOG.filter(l => l.status === 'failed').length;
  console.log(`\n[migrate-forest-pdfs] success=${succeeded} skipped=${skipped} failed=${failed}`);

  // ログ出力
  const logPath = `scripts/migrate-forest-pdfs-log-${Date.now()}.json`;
  writeFileSync(logPath, JSON.stringify(LOG, null, 2), 'utf-8');
  console.log(`[migrate-forest-pdfs] log saved: ${logPath}`);

  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
```

### Step 5: 実行手順
```bash
# 1. DB カラム追加（SQL migration 投入）
#    → Supabase SQL Editor で 20260424_04_fiscal_periods_storage_path.sql 実行

# 2. dry-run で事前確認
node scripts/migrate-forest-pdfs.mjs --dry-run
# → 件数確認 / storage_path 生成パターン確認

# 3. 本番実行（dev 環境で先に試す）
node scripts/migrate-forest-pdfs.mjs

# 4. ログ確認
cat scripts/migrate-forest-pdfs-log-*.json | jq '.[] | select(.status == "failed")'
# → failed 件数 0 を目標、残っていたら個別対応

# 5. Supabase Studio で Storage 確認
#    forest-docs/hyuaran/ki1_1I9UqEno.pdf など、期数分あるか目視
```

### Step 6: 失敗時のリトライ戦略
- `failed` ログを抽出し、原因別に分類（Drive 認証 / Storage / DB）
- 個別のレコードについて `fiscal_periods.storage_path = NULL` にリセットしてから再実行
- 冪等性により `success` / `skipped` のレコードは影響なし

---

## 6. データソース

| 種類 | 情報源 | 操作 |
|---|---|---|
| Source | Google Drive（公開 URL）| HTTP fetch で PDF 取得 |
| Target | Supabase Storage `forest-docs/` | upload（upsert=true）|
| DB | `fiscal_periods` | `storage_path` 列更新 |

**Drive 取得 URL パターン**:
- `https://drive.google.com/uc?export=download&id={fileId}`
- 大容量ファイル（>100MB）は確認ページが挟まる可能性 → 本バッチでは 50MB 上限前提で許容

---

## 7. UI 仕様

本 spec はバッチスクリプトのため UI なし。進捗は Console ログ + JSON log ファイルで確認。

---

## 8. エラーハンドリング

| # | エラー | 原因 | 対応 |
|---|---|---|---|
| E1 | Drive fetch 403 | ファイルが非公開になっている | 東海林さんに共有設定を確認依頼、該当ファイルはスキップ |
| E2 | Drive fetch が HTML 返却（PDF 以外）| Drive 認証 / 容量超過時の確認ページ | 先頭 4 バイトチェックで検出、log に記録 |
| E3 | Storage upload 413 | file_size_limit 超過 | T-F6-01 の設定（50MB）を確認、必要なら引上げ |
| E4 | Storage upload 409 | ファイル既存（upsert false の場合）| `upsert: true` 明示、衝突時は上書き |
| E5 | DB update エラー | RLS / FK / 型不整合 | service_role_key で RLS バイパス、型は varchar |
| E6 | Drive レート制限 (429) | 連続取得 | 1 秒スリープ挿入、429 時は 30 秒待機で再試行（Step 4 には未実装、将来強化）|
| E7 | Node.js fetch タイムアウト | 大容量ファイル | `AbortController` で 60 秒タイムアウト設定（Step 4 に未実装、将来強化）|

**リトライ方針**:
- バッチは冪等。失敗分を特定して再実行できる
- 5 回連続失敗で全体停止（将来実装）

---

## 9. 権限・RLS

### DB
- `fiscal_periods` の UPDATE は service_role_key でバイパス（本バッチは Admin 操作）
- Phase A 完了後、アプリからは `storage_path` への直接書込不可（RLS で admin のみ）

### Storage
- バッチは service_role_key で RLS バイパス
- 通常運用時は T-F6-01 のポリシー通り

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 5 法人 × 全期（約 35 件）の移送成功数確認 |
| 2 | エッジケース | doc_url NULL / 壊れた URL / 既に storage_path ありの再実行（冪等）|
| 3 | 権限 | service_role_key なしで実行 → RLS 拒否 |
| 4 | データ境界 | 最大サイズ PDF（30MB 相当）/ 同一 fileId の別期 |
| 5 | パフォーマンス | 35 件 × （1 秒 sleep + fetch + upload + db）= 約 5〜10 分を想定 |
| 6 | Console / Log | 全エラーが JSON log に記録される |

---

## 11. 関連参照

- **T-F6-01** [forest-t-f6-01-storage-buckets.md](2026-04-24-forest-t-f6-01-storage-buckets.md): bucket 前提
- **T-F6-03** [forest-t-f6-03-download-zip-edge.md](2026-04-24-forest-t-f6-03-download-zip-edge.md) §2 判4: 本 spec が前提データ整備
- **P07 §4.6**: 判3 B 案（Storage ミラー）、判4 B 案（Edge + Storage）
- **scripts/update_shinkouki_supabase.py**: 類似パターンの既存 Python 実装、参考
- **v9 HTML L1342-1345** `extractFileId()` — Drive URL からの fileId 抽出関数（同一ロジックを JS で移植）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | Node.js vs Python | **Node.js 採用**（T-F6-03 との技術統一）|
| 判2 | Drive API（Service Account）vs 公開 URL fetch | **公開 URL fetch**（シンプル、既存 PDF は公開設定前提）|
| 判3 | 移送後の Drive URL 扱い | **`doc_url` カラムは残置**（将来 T-F6-03 のフォールバック用、Phase A 末に削除判断）|
| 判4 | 大容量 PDF（>50MB）の対応 | **現状なし**（v9 の PDF は全て 30MB 以下想定）、超過時はアラート |
| 判5 | 本番環境への適用時期 | dev 環境で動作確認後、**T-F6-03 / T-F6-04 着手前**に本番実行 |
| 判6 | 日本語ファイル名 | storage_path には ASCII のみ使用（`ki{N}_{shortId}.pdf` 形式）。元ファイル名は doc_url で参照可能 |

— end of T-F6-02 spec —
