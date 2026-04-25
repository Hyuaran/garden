# T-F5-02: TaxFilesList / Group / Icon UI 実装指示書（法人ごと collapsible）

- 対象: Garden-Forest F5 Tax Files 閲覧 UI
- 見積: **0.75d**（約 6 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch3 #T-F5-02）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.5, `docs/specs/2026-04-24-forest-t-f5-01-tax-files-infrastructure.md`

---

## 1. スコープ

### 作る
- `TaxFilesList.tsx` — 税理士連携ファイル一覧セクション（法人ごと collapsible）
- `TaxFilesGroup.tsx` — 法人 1 社分のアコーディオン（開閉、ファイル 0 件時は「（データなし）」表示）
- `TaxFileIcon.tsx` — 拡張子別アイコン（PDF / xlsx / その他）
- `TaxFileStatusBadge.tsx` — 暫定 / 確定バッジ
- v9 L1682-1757 の挙動を TSX で再現

### 作らない
- アップロード UI（T-F5-03 で別 spec）
- ファイル削除・編集 UI（T-F5-03 で admin のみ）
- 全文検索・フィルタ（Phase B 以降）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **T-F5-01 完了** | `forest_tax_files` テーブル + `forest-tax/` bucket + RLS 適用済 |
| 既存 `companies` テーブル | 法人順・色・短縮名 |
| 既存 Forest State | `ForestStateContext` にデータキャッシュ機構あり |
| `fetchTaxFiles()` / `createTaxFileSignedUrl()` | T-F5-01 Step 3 で追加済 |

---

## 3. ファイル構成

### 新規
- `src/app/forest/_components/TaxFilesList.tsx`
- `src/app/forest/_components/TaxFilesGroup.tsx`
- `src/app/forest/_components/TaxFileIcon.tsx`
- `src/app/forest/_components/TaxFileStatusBadge.tsx`

### 変更
- `src/app/forest/_state/ForestStateContext.tsx` — `taxFiles` state 追加、`refreshData` に組込
- `src/app/forest/dashboard/page.tsx` — `<TaxFilesList>` を配置（Summary Cards 直後 or Tax Calendar の前）

---

## 4. 型定義

T-F5-01 で定義済の `TaxFile` / `TaxFileStatus` を再利用。本 spec では UI ラベル関連のみ追加：

```typescript
// src/app/forest/_constants/tax-files.ts（新規 or companies.ts に追記）
export const TAX_FILE_STATUS_LABELS: Record<TaxFileStatus, {
  label: string;
  className: string;   // Tailwind クラス
}> = {
  zanntei: { label: '暫定', className: 'text-gray-500' },   // v9 では `<` 暫定 `>` 装飾
  kakutei: { label: '確定', className: 'text-emerald-700 font-medium' },
};

export const TAX_FILE_ICON_CONFIG: Record<string, {
  className: string;       // Tailwind カラー
  label: string;           // アイコン中の文字
}> = {
  pdf:  { className: 'bg-gray-500',    label: 'PDF' },
  xlsx: { className: 'bg-emerald-700', label: 'XLSX' },
  xls:  { className: 'bg-emerald-700', label: 'XLS'  },
  csv:  { className: 'bg-gray-500',    label: 'CSV'  },
  jpg:  { className: 'bg-[#7a9a7a]',   label: 'JPG'  },
  png:  { className: 'bg-[#7a9a7a]',   label: 'PNG'  },
  // other は fallback で '[#e07a7a]' 赤系
};

// 法人表示順（v9 L1704 準拠）
export const TAX_FILE_COMPANY_ORDER: string[] = [
  'hyuaran', 'centerrise', 'linksupport', 'arata', 'taiyou', 'ichi'
];
```

---

## 5. 実装ステップ

### Step 1: ForestStateContext に taxFiles 追加
```typescript
// src/app/forest/_state/ForestStateContext.tsx（抜粋）
const [taxFiles, setTaxFiles] = useState<TaxFile[]>([]);

const refreshData = useCallback(async () => {
  try {
    const [c, p, s, tf] = await Promise.all([
      fetchCompanies(),
      fetchFiscalPeriods(),
      fetchShinkouki(),
      fetchTaxFiles(),                 // 追加
    ]);
    setCompanies(c);
    setPeriods(p);
    setShinkoukiData(s);
    setTaxFiles(tf);                   // 追加
  } catch (err) { ... }
}, []);

// value に追加
taxFiles,
```

### Step 2: TaxFileIcon コンポーネント
```typescript
// src/app/forest/_components/TaxFileIcon.tsx
'use client';
import { TAX_FILE_ICON_CONFIG } from '../_constants/tax-files';

export function TaxFileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const config = TAX_FILE_ICON_CONFIG[ext] ?? { className: 'bg-[#e07a7a]', label: ext.toUpperCase() };

  return (
    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-[0.7rem] font-bold text-white flex-shrink-0 ${config.className}`}>
      {config.label}
    </div>
  );
}
```

### Step 3: TaxFileStatusBadge
```typescript
// src/app/forest/_components/TaxFileStatusBadge.tsx
'use client';
import type { TaxFileStatus } from '../_lib/types';
import { TAX_FILE_STATUS_LABELS } from '../_constants/tax-files';

export function TaxFileStatusBadge({ status }: { status: TaxFileStatus }) {
  const config = TAX_FILE_STATUS_LABELS[status];
  return (
    <span className={`text-[0.72rem] inline-flex items-center ${config.className}`}>
      ＜ {config.label} ＞
    </span>
  );
}
```

### Step 4: TaxFilesGroup（アコーディオン）
```typescript
// src/app/forest/_components/TaxFilesGroup.tsx
'use client';
import { useState } from 'react';
import type { TaxFile } from '../_lib/types';
import { createTaxFileSignedUrl } from '../_lib/queries';
import { TaxFileIcon } from './TaxFileIcon';
import { TaxFileStatusBadge } from './TaxFileStatusBadge';

type Props = {
  companyLabel: string;           // 日本語 '株式会社ヒュアラン' 等
  files: TaxFile[];
  defaultOpen?: boolean;          // データあり= true / なし= false
};

export function TaxFilesGroup({ companyLabel, files, defaultOpen = true }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasFiles = files.length > 0;

  const handleOpen = async (storagePath: string) => {
    try {
      const url = await createTaxFileSignedUrl(storagePath, 600);  // 10 分有効
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('[TaxFilesGroup] signedUrl error', e);
      alert('ファイルの取得に失敗しました');
    }
  };

  return (
    <div className={`${!hasFiles ? 'opacity-60' : ''}`}>
      {/* ヘッダー（法人名）*/}
      <button
        type="button"
        onClick={() => hasFiles && setIsOpen(o => !o)}
        aria-expanded={isOpen}
        className={`w-full text-left text-[0.82rem] font-semibold text-emerald-700 py-1.5 px-0 border-b border-emerald-900/10 flex items-center gap-1.5 select-none ${hasFiles ? 'cursor-pointer hover:bg-emerald-50/30' : 'cursor-default'}`}
      >
        <span className="inline-flex w-[18px] h-[18px] items-center justify-center text-sm text-[#7a9a7a] font-medium">
          {isOpen ? '−' : '+'}
        </span>
        {companyLabel}
      </button>

      {/* ボディ */}
      {isOpen && (
        <div className="mt-1.5">
          {!hasFiles ? (
            <div className="text-[0.78rem] text-gray-400 py-1.5 pl-6">（データなし）</div>
          ) : (
            <div className="flex flex-col gap-2">
              {files.map(f => (
                <FileRow key={f.id} file={f} onOpen={() => handleOpen(f.storage_path)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({ file, onOpen }: { file: TaxFile; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2.5 p-2.5 bg-white/70 rounded-lg hover:bg-white/95 transition-colors text-left w-full"
    >
      <TaxFileIcon fileName={file.file_name} />
      <div className="flex-1 min-w-0">
        <div className="text-[0.85rem] font-medium flex items-center gap-2 flex-wrap">
          <TaxFileStatusBadge status={file.status} />
          <span className="truncate">{file.doc_name}</span>
        </div>
        <div className="text-[0.72rem] text-[#7a9a7a] flex items-center gap-2 mt-0.5">
          {file.uploaded_at && <span>{fmtConnectDate(file.uploaded_at)} 連携</span>}
          {file.note && <span className="text-red-600">※{file.note}</span>}
        </div>
      </div>
      {/* 外部リンクアイコン */}
      <svg className="flex-shrink-0 w-[18px] h-[18px] fill-[#7a9a7a]" viewBox="0 0 24 24">
        <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
      </svg>
    </button>
  );
}

function fmtConnectDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
```

### Step 5: TaxFilesList（親コンポーネント）
```typescript
// src/app/forest/_components/TaxFilesList.tsx
'use client';
import { useMemo } from 'react';
import type { Company, TaxFile } from '../_lib/types';
import { TAX_FILE_COMPANY_ORDER } from '../_constants/tax-files';
import { TaxFilesGroup } from './TaxFilesGroup';

type Props = {
  companies: Company[];
  taxFiles: TaxFile[];
};

export function TaxFilesList({ companies, taxFiles }: Props) {
  // 法人 id → 日本語ラベルの map
  const labelMap = useMemo(() => {
    return Object.fromEntries(companies.map(c => [c.id, c.name]));
  }, [companies]);

  // 法人 id 別にグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, TaxFile[]>();
    for (const f of taxFiles) {
      const arr = map.get(f.company_id) ?? [];
      arr.push(f);
      map.set(f.company_id, arr);
    }
    return map;
  }, [taxFiles]);

  const isEmpty = taxFiles.length === 0;

  return (
    <section className="bg-white/60 backdrop-blur-sm rounded-[18px] p-7 mb-7 border border-emerald-900/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2.5 mb-5 pb-3 border-b-2 border-[#d8f3dc]">
        税理士連携データ
      </h2>

      {isEmpty ? (
        <div className="text-center text-[#7a9a7a] text-[0.85rem] py-6">
          まだファイルが連携されていません
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {TAX_FILE_COMPANY_ORDER.map(cid => {
            const files = grouped.get(cid) ?? [];
            const label = labelMap[cid] ?? cid;
            return (
              <TaxFilesGroup
                key={cid}
                companyLabel={label}
                files={files}
                defaultOpen={files.length > 0}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
```

### Step 6: dashboard/page.tsx に配置
```tsx
// 例: Summary Cards の直後に配置（v9 L1003-1012 準拠）
<SummaryCards ... />
<TaxCalendar ... />               {/* T-F4-02 */}
<TaxFilesList companies={companies} taxFiles={taxFiles} />      {/* 本 spec */}
<MacroChart ... />
<MicroGrid ... />
```

### Step 7: 手動テスト
1. データなし → 空メッセージ表示
2. 3 法人にファイルあり、残り 3 法人なし → 法人順に並ぶ、データなしは collapsed
3. ファイルクリック → signedURL で新タブ open
4. アコーディオン開閉
5. 暫定 / 確定バッジの色が区別できる
6. 日本語ファイル名の表示切れ（`truncate`）

---

## 6. データソース

| 種類 | 情報源 | 操作 |
|---|---|---|
| Supabase Table | `forest_tax_files` | SELECT（T-F5-01 の `fetchTaxFiles()`）|
| Storage | `forest-tax/` | createSignedUrl（10 分有効）|
| 既存 Table | `companies` | 法人ラベル map |

---

## 7. UI 仕様

### レイアウト
```
┌─ 税理士連携データ セクション ────────────┐
│                                         │
│ ヒュアラン                        [−]   │
│  [PDF] ＜確定＞ 2024年度申告書          │
│         2026/04/24 連携                 │
│  [PDF] ＜暫定＞ 2025年 中間申告書        │
│         2026/04/20 連携                 │
│ ────                                    │
│ センターライズ                    [+]   │
│                                         │
│ リンクサポート                    [−]   │
│  （データなし）                         │
│ ────                                    │
│ ...（全 6 法人）                        │
└─────────────────────────────────────────┘
```

### Tailwind 方針
- セクション全体は Forest の他と同じ `bg-white/60 backdrop-blur-sm rounded-[18px]`
- アコーディオンヘッダー: 法人色ドットは v9 にないので省略（シンプル）
- ファイル行: `bg-white/70 hover:bg-white/95`、PDF/xlsx アイコン 32×32px
- ステータスバッジ: 日本語 `＜ 確定 ＞` 形式（v9 準拠）

### レスポンシブ
- 狭幅時: ファイル名の `truncate`、バッジは折返し `flex-wrap`
- 768px 以下: padding を詰める（T-F4-02 と同じ）

### a11y
- アコーディオンボタン: `aria-expanded={isOpen}` 必須
- ファイル行: `<button>` で外部リンク動作、`aria-label` で full text

---

## 8. エラーハンドリング

| # | エラー | 対応 |
|---|---|---|
| E1 | `fetchTaxFiles` 失敗 | `taxFiles=[]` で空セクション表示、他 section は影響なし |
| E2 | signedURL 生成失敗 | alert で通知、ブラウザコンソールに詳細 |
| E3 | Storage から該当ファイル消失 | signedURL 取得は成功するが、404 リダイレクト → 注意喚起 |
| E4 | 拡張子取れない（`.` なし）| TaxFileIcon が fallback アイコン（赤系）で表示 |
| E5 | 日本語ファイル名の encoding 崩れ | React がデフォルトエスケープで安全、表示は正常 |

---

## 9. 権限・RLS

T-F5-01 準拠：
- **SELECT**: `forest_is_user()` — 全 forest_users 登録済ユーザーが閲覧可
- **Storage signedURL 生成**: bucket RLS の SELECT 通過後、Node/JS SDK 内で発行

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 7 シナリオ（Step 7）|
| 2 | エッジケース | 0 件 / 1 件 / 50 件 / 日本語長文 / 拡張子なし |
| 3 | 権限 | forest_user / 非ユーザー（3 件ロール）|
| 4 | データ境界 | 巨大 file_size、古い uploaded_at（3 年前）|
| 5 | パフォーマンス | 50 件表示で 200ms 以内レンダリング |
| 6 | Console | 警告なし（特に key 重複）|
| 7 | a11y | `aria-expanded` / `role="button"` / キーボード（Enter で開閉）|

---

## 11. 関連参照

- **P07 §4.5**: F5 Tax Files 差分
- **T-F5-01** [forest-t-f5-01-tax-files-infrastructure.md](2026-04-24-forest-t-f5-01-tax-files-infrastructure.md): テーブル + bucket
- **T-F5-03** [forest-t-f5-03-tax-files-upload-ui.md](2026-04-24-forest-t-f5-03-tax-files-upload-ui.md): admin の upload UI（同時リリース想定）
- **v9 HTML L1682-1757** `loadTaxFiles()` + `renderTaxFiles()`
- **v9 CSS L813-928**: tax-files-list / tax-file-row / tax-file-icon 等

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | アコーディオンのデフォルト開閉状態 | **データあり = open、データなし = collapsed**（v9 準拠）|
| 判2 | 表示件数制限 | **制限なし**（全件表示、50 件超える場合は仮想スクロール検討、Phase B）|
| 判3 | ファイル検索 / フィルタ UI | **Phase A では未実装**、Phase B 以降 |
| 判4 | signedURL 有効期限 | **10 分**（T-F11-01 は 1 時間だが、Tax Files は単発開き前提）|
| 判5 | ファイル順序 | **uploaded_at 降順**（最新上）|
| 判6 | カラーコード（法人色ドット）| v9 にはないため**省略**。将来需要あれば追加 |

— end of T-F5-02 spec —
