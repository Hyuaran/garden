# T-F5-03: Tax Files 管理者アップロード UI 実装指示書（判5 B 案準拠）

- 対象: Garden-Forest F5 Tax Files の admin 向け代理入力 UI
- 見積: **0.5d**（約 4 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch3 #T-F5-03）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.5, `docs/specs/2026-04-24-forest-t-f5-01-tax-files-infrastructure.md`
- **判5 = B 案採用**（社内担当者が代理入力、税理士は直接書込しない）

---

## 1. スコープ

### 作る
- `TaxFileUploadModal.tsx` — admin+ のみ表示、ファイル選択 + メタ入力 + Storage アップロード
- TaxFilesList に「+ 追加」ボタン（admin+ のみ表示）
- Mutations: `uploadTaxFile(params)`, `updateTaxFileStatus(id, status)`, `deleteTaxFile(id)`
- Storage への実体アップロード + `forest_tax_files` INSERT を**単一アクション**で実行（atomically）

### 作らない
- 税理士側からの直接アップロード（判5 で却下）
- OCR / メタ自動抽出（Phase B 以降）
- 一括アップロード / ZIP 展開
- 削除時の Storage 側ガベージコレクション自動化（手動削除 for now）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **T-F5-01 完了** | `forest_tax_files` + `forest-tax/` bucket + RLS |
| **T-F5-02 完了** | `TaxFilesList` / `TaxFilesGroup` が配置済 |
| 権限判定 | `isForestAdmin(forestUser)`（既存 `permissions.ts` 関数）|
| Forest State | `taxFiles` キャッシュ、`refreshData` 関数 |

---

## 3. ファイル構成

### 新規
- `src/app/forest/_components/TaxFileUploadModal.tsx` — アップロードモーダル
- `src/app/forest/_lib/tax-file-mutations.ts` — mutation 関数群

### 変更
- `src/app/forest/_components/TaxFilesList.tsx` — 「+ 追加」ボタン条件表示
- `src/app/forest/_components/TaxFilesGroup.tsx` — 各行に「編集」「削除」ボタン（admin のみ）

---

## 4. 型定義

```typescript
// src/app/forest/_lib/tax-file-mutations.ts（新規）
import type { TaxFile, TaxFileStatus } from './types';

export type UploadTaxFileInput = {
  companyId: string;
  docName: string;
  status: TaxFileStatus;
  docDate: string | null;           // YYYY-MM-DD
  note: string | null;
  file: File;                       // ブラウザ File オブジェクト
};

export type UploadTaxFileResult = {
  success: boolean;
  taxFile?: TaxFile;
  error?: string;
  code?: 'FILE_TOO_LARGE' | 'INVALID_MIME' | 'STORAGE_ERROR' | 'DB_ERROR' | 'PERMISSION_DENIED';
};
```

---

## 5. 実装ステップ

### Step 1: mutation 関数（atomicity 重視）
```typescript
// src/app/forest/_lib/tax-file-mutations.ts
import { supabase } from './supabase';
import type { UploadTaxFileInput, UploadTaxFileResult, TaxFile, TaxFileStatus } from './types';

const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50MB（bucket 設定と一致）

const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
];

/**
 * Storage パス生成
 *   {companyId}/{timestamp}_{safeFileName}
 *   safeFileName: 英数字・ハイフン・アンダースコア以外は _ 置換
 */
function buildStoragePath(companyId: string, fileName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);   // YYYYMMDDTHHMMSS
  const ext = fileName.split('.').pop() ?? 'bin';
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^\w\-]/g, '_').slice(0, 60);
  return `${companyId}/${ts}_${base}.${ext}`;
}

export async function uploadTaxFile(input: UploadTaxFileInput): Promise<UploadTaxFileResult> {
  // クライアントサイド事前検証
  if (input.file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'ファイルサイズが 50MB を超えています', code: 'FILE_TOO_LARGE' };
  }
  if (!ALLOWED_MIME.includes(input.file.type)) {
    return { success: false, error: `このファイル形式は許可されていません（${input.file.type}）`, code: 'INVALID_MIME' };
  }

  const storagePath = buildStoragePath(input.companyId, input.file.name);

  // 1. Storage へアップロード
  const { error: upErr } = await supabase.storage.from('forest-tax').upload(storagePath, input.file, {
    contentType: input.file.type,
    upsert: false,   // 上書き禁止（同 timestamp 衝突時は再試行）
  });
  if (upErr) {
    const code = upErr.message.includes('permission') ? 'PERMISSION_DENIED' : 'STORAGE_ERROR';
    return { success: false, error: `Storage: ${upErr.message}`, code };
  }

  // 2. DB へメタデータ INSERT
  const { data: user } = await supabase.auth.getUser();
  const { data, error: dbErr } = await supabase
    .from('forest_tax_files')
    .insert({
      company_id: input.companyId,
      doc_name: input.docName,
      file_name: input.file.name,
      storage_path: storagePath,
      status: input.status,
      doc_date: input.docDate,
      note: input.note,
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
      uploaded_by: user.user?.id ?? null,
    })
    .select('*')
    .single();

  if (dbErr) {
    // rollback: Storage からも削除
    await supabase.storage.from('forest-tax').remove([storagePath]).catch(e => console.error('rollback failed', e));
    const code = dbErr.message.includes('permission') ? 'PERMISSION_DENIED' : 'DB_ERROR';
    return { success: false, error: `DB: ${dbErr.message}`, code };
  }

  return { success: true, taxFile: data as TaxFile };
}

export async function updateTaxFileStatus(id: string, status: TaxFileStatus): Promise<void> {
  const { error } = await supabase
    .from('forest_tax_files')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(`updateTaxFileStatus: ${error.message}`);
}

export async function deleteTaxFile(id: string): Promise<void> {
  // Storage path を取得してから DB 削除
  const { data, error: fErr } = await supabase
    .from('forest_tax_files')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (fErr || !data) throw new Error(`deleteTaxFile fetch: ${fErr?.message ?? 'not found'}`);

  // Storage 先行削除（失敗時も DB 削除を継続、残骸は掃除バッチで）
  await supabase.storage.from('forest-tax').remove([data.storage_path])
    .catch(e => console.warn('[deleteTaxFile] storage removal failed, DB proceeds', e));

  const { error: dErr } = await supabase.from('forest_tax_files').delete().eq('id', id);
  if (dErr) throw new Error(`deleteTaxFile db: ${dErr.message}`);
}
```

### Step 2: TaxFileUploadModal
```typescript
// src/app/forest/_components/TaxFileUploadModal.tsx
'use client';
import { useState } from 'react';
import type { Company, TaxFileStatus } from '../_lib/types';
import { uploadTaxFile } from '../_lib/tax-file-mutations';

type Props = {
  companies: Company[];
  defaultCompanyId?: string;
  onClose: () => void;
  onUploaded: () => void;       // 成功時に refreshData を呼ぶ
};

export function TaxFileUploadModal({ companies, defaultCompanyId, onClose, onUploaded }: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? companies[0]?.id ?? '');
  const [docName, setDocName] = useState('');
  const [status, setStatus] = useState<TaxFileStatus>('zantei');
  const [docDate, setDocDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !docName || !companyId) return;

    setIsUploading(true);
    setError(null);

    const result = await uploadTaxFile({
      companyId, docName, status,
      docDate: docDate || null,
      note: note || null,
      file,
    });

    setIsUploading(false);

    if (result.success) {
      onUploaded();
      onClose();
    } else {
      setError(result.error ?? 'アップロードに失敗しました');
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center" role="dialog" aria-modal="true">
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-8 w-[90%] max-w-md shadow-[0_12px_48px_rgba(0,0,0,0.2)]"
      >
        <h3 className="text-lg font-bold text-emerald-900 mb-4">税理士ファイル追加</h3>

        <div className="space-y-3">
          {/* 法人 */}
          <Field label="法人">
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          {/* ドキュメント名 */}
          <Field label="ドキュメント名">
            <input
              type="text"
              value={docName}
              onChange={e => setDocName(e.target.value)}
              placeholder="例: 2024年度 確定申告書"
              required
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>

          {/* ステータス */}
          <Field label="ステータス">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={status === 'zantei'} onChange={() => setStatus('zantei')} />
                暫定
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={status === 'kakutei'} onChange={() => setStatus('kakutei')} />
                確定
              </label>
            </div>
          </Field>

          {/* 書類基準日 */}
          <Field label="書類基準日（任意）">
            <input
              type="date"
              value={docDate}
              onChange={e => setDocDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>

          {/* ファイル */}
          <Field label="ファイル">
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.jpg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              required
              className="text-sm"
            />
            {file && (
              <div className="text-[0.7rem] text-gray-500 mt-1">
                {file.name}（{(file.size / 1024 / 1024).toFixed(2)} MB）
              </div>
            )}
          </Field>

          {/* 備考 */}
          <Field label="備考（任意）">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="例: 訂正版あり"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </Field>
        </div>

        {error && (
          <div role="alert" className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
            {error}
          </div>
        )}

        {/* アクション */}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!file || !docName || isUploading}
            className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isUploading ? 'アップロード中...' : '追加'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
```

### Step 3: TaxFilesList に「+ 追加」ボタン
```tsx
// TaxFilesList.tsx の h2 タイトル行に追加
const { forestUser } = useForestState();
const isAdmin = isForestAdmin(forestUser);
const [isUploading, setIsUploading] = useState(false);

<h2 className="... flex items-center justify-between">
  <span className="flex items-center gap-2.5">税理士連携データ</span>
  {isAdmin && (
    <button
      type="button"
      onClick={() => setIsUploading(true)}
      className="text-sm px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium"
    >
      + 追加
    </button>
  )}
</h2>

{isUploading && (
  <TaxFileUploadModal
    companies={companies}
    onClose={() => setIsUploading(false)}
    onUploaded={refreshData}
  />
)}
```

### Step 4: TaxFilesGroup に編集・削除ボタン（admin のみ）
```tsx
// FileRow コンポーネント内、外部リンクアイコンの右側に追加
{isAdmin && (
  <div className="flex-shrink-0 flex gap-1 ml-2">
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onEditStatus(file); }}
      className="text-xs px-2 py-0.5 text-gray-600 hover:text-emerald-700 border border-gray-300 rounded"
    >
      {file.status === 'zantei' ? '確定化' : '暫定化'}
    </button>
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        if (confirm(`${file.doc_name} を削除しますか？（取り消せません）`)) onDelete(file);
      }}
      className="text-xs px-2 py-0.5 text-red-600 hover:text-red-800 border border-red-300 rounded"
    >
      削除
    </button>
  </div>
)}
```

### Step 5: 手動テスト
1. admin で「+ 追加」→ ヒュアラン × 2024 年度 PDF → アップロード成功 → 一覧に即座反映
2. staff でログイン → 「+ 追加」ボタン非表示
3. 50MB 超 PDF → クライアント側で拒否
4. 不正 MIME（.exe）→ クライアント側で拒否
5. 確定化 / 暫定化ボタン → ステータス切替
6. 削除 → Storage + DB から消える
7. アップロード中にキャンセル → Modal 閉じる、途中中断

---

## 6. データソース

| 種類 | 操作 |
|---|---|
| Storage `forest-tax/` | upload / remove |
| `forest_tax_files` | INSERT / UPDATE (status) / DELETE |
| `auth.users` | `auth.getUser()` で uploaded_by 取得 |

---

## 7. UI 仕様

### 配置
- `TaxFilesList` の右上に「+ 追加」ボタン（admin+ のみ）
- 各 `FileRow` の右端に「確定化/暫定化」と「削除」ボタン（admin+ のみ）
- モーダル: 中央、90% 幅 max-w-md（小さめ、1 画面完結）

### フォーム
- 法人: select（6 法人）
- ドキュメント名: text（必須）
- ステータス: radio（暫定 / 確定）
- 書類基準日: date picker（任意）
- ファイル: file input（必須、50MB 以下、MIME 制限）
- 備考: text（任意）

### Tailwind
- emerald-700 系（Forest 統一）
- エラー: `role="alert"` + `bg-red-50 text-red-600`

---

## 8. エラーハンドリング

| # | code | 想定 | 対応 |
|---|---|---|---|
| E1 | FILE_TOO_LARGE | 50MB 超 | クライアント側で事前拒否 |
| E2 | INVALID_MIME | 許可外形式 | 事前拒否 |
| E3 | STORAGE_ERROR | 容量 / ネットワーク | エラー表示、再試行促す |
| E4 | DB_ERROR | 制約違反 / 型 | Storage にアップ済なら rollback（remove）|
| E5 | PERMISSION_DENIED | admin でない / RLS | ボタン非表示で回避、UI 到達時は alert |

**ロールバック順序**: DB INSERT 失敗時は Storage からも削除（`.remove()`）。ただし `.remove()` 自体失敗時は孤立オブジェクトとして残る → **掃除バッチで拾う**（別 spec、Phase A 末）。

---

## 9. 権限・RLS

| 操作 | ロール |
|---|---|
| `+ 追加` ボタン表示 | `isForestAdmin(forestUser) === true` |
| 編集・削除ボタン表示 | 同上 |
| Storage upload | `forest_is_admin()` ポリシー通過 |
| DB INSERT | `ftf_insert` ポリシー通過 |
| DB DELETE | `ftf_delete` ポリシー通過 |

二重防御：UI で admin のみボタン表示 + サーバ側 RLS で強制。

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 7 シナリオ（Step 5）|
| 2 | エッジケース | 日本語ファイル名 / 0 byte ファイル / 同じ doc_name を 2 回 |
| 3 | **権限** | admin / staff / 非ユーザーの 3 ロール |
| 4 | データ境界 | 50MB ちょうど / 50MB + 1byte / 拡張子なし |
| 5 | パフォーマンス | 30MB PDF アップロード 10 秒以内 |
| 6 | Console | upload → DB INSERT の例外が正しく表示 |
| 7 | a11y | modal role="dialog", form 各 input に label, Esc で close |

---

## 11. 関連参照

- **P07 §4.5**: 判5 B 案（社内代理入力）
- **T-F5-01** [forest-t-f5-01-tax-files-infrastructure.md](2026-04-24-forest-t-f5-01-tax-files-infrastructure.md): bucket + RLS
- **T-F5-02** [forest-t-f5-02-tax-files-list-ui.md](2026-04-24-forest-t-f5-02-tax-files-list-ui.md): 親 UI
- **既存 `permissions.ts` `isForestAdmin`**: 権限判定ヘルパー
- **既存 `PdfUploader.tsx`**: ファイルアップロード UX 参考（こちらはサーバ API 経由、本 spec は Storage 直接）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 削除時の Storage 側孤立オブジェクト掃除 | **Phase A 末の掃除バッチ**で対応（本 spec は DB 先行削除でも動作継続）|
| 判2 | 複数ファイル同時アップロード | **Phase A では単一のみ**、需要増で対応 |
| 判3 | アップロード時の ZIP 展開 | **Phase A では対応せず**、税理士が個別に送る前提 |
| 判4 | `upsert: false` 衝突時のリトライ | 現状は `timestamp` で実質衝突しないが、ミリ秒単位の重複時は ISO 全体を含める |
| 判5 | 書類基準日の必須化 | **任意**で開始、運用で入力率低ければ必須化検討 |
| 判6 | 確定化したファイルの再編集 | **ステータスのみ変更可**、ファイル本体の差し替えは削除＋再アップロード |

— end of T-F5-03 spec —
