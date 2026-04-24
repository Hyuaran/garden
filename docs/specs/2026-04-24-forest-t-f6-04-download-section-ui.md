# T-F6-04: Download Section UI 実装指示書（法人セレクタ + 期数ラジオ + Progress）

- 対象: Garden-Forest F6 Download Section のフロント UI
- 見積: **0.5d**（約 4 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch3 #T-F6-04）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.6, `docs/specs/2026-04-24-forest-t-f6-03-download-zip-edge.md`

---

## 1. スコープ

### 作る
- `DownloadSection.tsx` — セクション本体（v9 L1014-1077 相当）
- `DownloadCompanySelector.tsx` — 全社 + 6 法人のチェックボックス群（連動）
- `DownloadKiRadio.tsx` — 直近 1/2/3 期のラジオ
- `DownloadProgress.tsx` — 進捗バー + 経過秒カウント（v9 の CSS アニメ流用）
- `DownloadResultLink.tsx` — 完了時の「完成した ZIP を開く」リンク
- T-F7-01 `InfoTooltip` を利用した使い方説明

### 作らない
- バックエンド API 実装（T-F6-03 で済み）
- Drive URL 直リンクのローカルフォールバック（v9 のローカルモード、判3 B 案で廃止）
- DL 履歴ログ（Phase A 範囲外）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **T-F6-01 完了** | `forest-docs` / `forest-downloads` bucket 稼働中 |
| **T-F6-02 完了** | PDF 本体が Storage に移送済 |
| **T-F6-03 完了** | `POST /api/forest/download-zip` 実装済、JWT 認証・レスポンス仕様確定 |
| **T-F7-01 完了** | `InfoTooltip` 共通コンポーネント |
| 既存 Forest State | `companies` データキャッシュ |

---

## 3. ファイル構成

### 新規
- `src/app/forest/_components/DownloadSection.tsx`
- `src/app/forest/_components/DownloadCompanySelector.tsx`
- `src/app/forest/_components/DownloadKiRadio.tsx`
- `src/app/forest/_components/DownloadProgress.tsx`
- `src/app/forest/_components/DownloadResultLink.tsx`

### 変更
- `src/app/forest/dashboard/page.tsx` — `<DownloadSection>` を Macro Chart の前に配置

---

## 4. 型定義

```typescript
// src/app/forest/_components/DownloadSection.tsx 内
type DownloadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; startedAt: number }
  | { kind: 'success'; signedUrl: string; fileName: string; expiresAt: string }
  | { kind: 'error'; message: string; code?: string };

// T-F6-03 で定義済の DownloadZipRequest / DownloadZipResponse を import
```

---

## 5. 実装ステップ

### Step 1: DownloadCompanySelector
```typescript
// src/app/forest/_components/DownloadCompanySelector.tsx
'use client';
import type { Company } from '../_lib/types';

type Props = {
  companies: Company[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  disabled?: boolean;
};

export function DownloadCompanySelector({ companies, selectedIds, onChange, disabled }: Props) {
  const allChecked = companies.length > 0 && companies.every(c => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allChecked) onChange(new Set());
    else onChange(new Set(companies.map(c => c.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[0.78rem] font-semibold text-[#5a7a5a] min-w-[40px]">法人</span>
      <div className="flex gap-2.5 flex-wrap">
        <label className="flex items-center gap-1 text-[0.78rem] text-[#2c3e2c] cursor-pointer">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            disabled={disabled}
            className="accent-emerald-700 cursor-pointer"
          />
          <span>全社</span>
        </label>
        {companies.map(c => (
          <label key={c.id} className="flex items-center gap-1 text-[0.78rem] text-[#2c3e2c] cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.has(c.id)}
              onChange={() => toggleOne(c.id)}
              disabled={disabled}
              className="accent-emerald-700 cursor-pointer"
            />
            <span>{c.short}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

### Step 2: DownloadKiRadio
```typescript
// src/app/forest/_components/DownloadKiRadio.tsx
'use client';

type Props = {
  value: 1 | 2 | 3;
  onChange: (v: 1 | 2 | 3) => void;
  disabled?: boolean;
};

export function DownloadKiRadio({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[0.78rem] font-semibold text-[#5a7a5a] min-w-[40px]">期数</span>
      <div className="flex gap-2.5 flex-wrap">
        {[1, 2, 3].map(n => (
          <label key={n} className="flex items-center gap-1 text-[0.78rem] cursor-pointer">
            <input
              type="radio"
              name="dlKi"
              checked={value === n}
              onChange={() => onChange(n as 1|2|3)}
              disabled={disabled}
              className="accent-emerald-700"
            />
            <span>直近{n}期</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

### Step 3: DownloadProgress
```typescript
// src/app/forest/_components/DownloadProgress.tsx
'use client';
import { useEffect, useState } from 'react';

export function DownloadProgress({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="w-60" role="status" aria-live="polite">
      {/* バー */}
      <div className="h-[5px] rounded bg-[#e8f0e0] overflow-hidden mb-1">
        <div className="h-full w-[35%] rounded bg-gradient-to-r from-transparent via-emerald-600 to-transparent animate-[dl-slide_2s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
      </div>
      {/* テキスト */}
      <div className="text-[0.65rem] text-[#5a7a5a] flex justify-between">
        <span>作成中...</span>
        <span className="tabular-nums">{elapsed}秒</span>
      </div>
    </div>
  );
}
```

Tailwind 設定（`tailwind.config.ts` or globals.css）にアニメーション追加が必要:
```css
/* globals.css に追加 */
@keyframes dl-slide {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
```

### Step 4: DownloadResultLink
```typescript
// src/app/forest/_components/DownloadResultLink.tsx
'use client';

type Props = { url: string; fileName: string };

export function DownloadResultLink({ url, fileName }: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="text-red-600 text-[0.82rem] font-semibold hover:underline"
    >
      完成したZIPファイルを開く（{fileName}）
    </a>
  );
}
```

### Step 5: DownloadSection（親コンポーネント、ロジック集約）
```typescript
// src/app/forest/_components/DownloadSection.tsx
'use client';
import { useState } from 'react';
import type { Company } from '../_lib/types';
import { supabase } from '../_lib/supabase';
import { DownloadCompanySelector } from './DownloadCompanySelector';
import { DownloadKiRadio } from './DownloadKiRadio';
import { DownloadProgress } from './DownloadProgress';
import { DownloadResultLink } from './DownloadResultLink';
import { InfoTooltip } from './InfoTooltip';

type DownloadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; startedAt: number }
  | { kind: 'success'; signedUrl: string; fileName: string; expiresAt: string }
  | { kind: 'error'; message: string; code?: string };

export function DownloadSection({ companies }: { companies: Company[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(companies.map(c => c.id)));
  const [kiCount, setKiCount] = useState<1|2|3>(3);
  const [state, setState] = useState<DownloadState>({ kind: 'idle' });

  const isBusy = state.kind === 'uploading';
  const canDownload = selectedIds.size > 0 && !isBusy;

  const handleDownload = async () => {
    if (!canDownload) return;
    setState({ kind: 'uploading', startedAt: Date.now() });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setState({ kind: 'error', message: 'セッションが切れています。再ログインしてください' }); return; }

      const res = await fetch('/api/forest/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyIds: Array.from(selectedIds), kiCount }),
      });
      const json = await res.json();

      if (json.success) {
        setState({ kind: 'success', signedUrl: json.signedUrl, fileName: json.fileName, expiresAt: json.expiresAt });
      } else {
        setState({ kind: 'error', message: json.error ?? 'エラーが発生しました', code: json.code });
      }
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  };

  return (
    <section className="bg-white/60 backdrop-blur-sm rounded-[18px] p-7 mb-7 border border-emerald-900/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2.5 mb-5 pb-3 border-b-2 border-[#d8f3dc]">
        決算書ダウンロード
        <InfoTooltip title="使い方" placement="top">
          <ul className="list-disc pl-4 my-1 space-y-0.5">
            <li>法人を選択（複数可）</li>
            <li>直近何期分かを選択</li>
            <li>「ダウンロードする」をクリック</li>
          </ul>
          <strong className="font-semibold text-emerald-900 block mt-2">ZIPファイルについて</strong>
          <ul className="list-disc pl-4 my-1 space-y-0.5">
            <li>選択した決算書が ZIP にまとめられます</li>
            <li>ファイルが大きい場合、作成に少し時間がかかります</li>
          </ul>
          <strong className="font-semibold text-emerald-900 block mt-2">エラーが出たら</strong>
          <ul className="list-disc pl-4 my-1 space-y-0.5">
            <li>「権限」エラー → 管理者に連絡</li>
            <li>「取得に失敗」→ 決算書ファイルが存在しない可能性</li>
            <li>「URL未登録」→ その期の決算書がまだ登録されていません</li>
          </ul>
        </InfoTooltip>
      </h2>

      <div className="flex flex-col gap-3">
        <DownloadCompanySelector companies={companies} selectedIds={selectedIds} onChange={setSelectedIds} disabled={isBusy} />
        <DownloadKiRadio value={kiCount} onChange={setKiCount} disabled={isBusy} />

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload}
            className="bg-gradient-to-br from-emerald-900 to-emerald-700 text-white rounded-lg px-6 py-2.5 text-[0.82rem] font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ダウンロードする
          </button>

          <div className="flex items-center flex-1 min-w-0">
            {state.kind === 'uploading' && <DownloadProgress startedAt={state.startedAt} />}
            {state.kind === 'success'   && <DownloadResultLink url={state.signedUrl} fileName={state.fileName} />}
            {state.kind === 'error'     && (
              <div role="alert" className="text-red-600 text-[0.75rem]">
                {state.message}
                {state.code && <span className="ml-2 opacity-70">({state.code})</span>}
              </div>
            )}
          </div>
        </div>

        {/* 無効時のヒント */}
        {selectedIds.size === 0 && state.kind === 'idle' && (
          <div className="text-[0.72rem] text-gray-400">法人を 1 社以上選択してください</div>
        )}
      </div>
    </section>
  );
}
```

### Step 6: dashboard/page.tsx に配置
```tsx
// Tax Files の後、Macro Chart の前（v9 L1014-1077 準拠）
<TaxFilesList ... />
<DownloadSection companies={companies} />
<MacroChart ... />
```

### Step 7: 手動テスト
1. 全社 × 3 期 ダウンロード → 進捗 → 成功リンク → 新タブで ZIP 取得
2. 1 社 × 1 期 → ファイル名が単一法人形式で生成される
3. 0 社選択 → ボタン非活性、ヒント表示
4. ネットワークエラー → エラーメッセージ + code 表示
5. 403（未登録ユーザー） → PERMISSION_DENIED 表示
6. 404（doc なし） → NO_DOCS 表示
7. 進捗表示が秒単位で増加する（10 秒時点で表示確認）
8. 成功後に別条件で再 DL → state リセット不要（上書き）

---

## 6. データソース

本 spec はフロント UI のみ。バックエンドは T-F6-03 が担当。

API 呼出:
- `POST /api/forest/download-zip` — JSON request, JSON response
- Supabase Auth `getSession()` — JWT 取得

---

## 7. UI 仕様

### 配置
- セクションヘッダー: タイトル + InfoTooltip
- row 1: 全社 + 6 法人チェックボックス
- row 2: 直近 1/2/3 期 ラジオ
- row 3: ダウンロードボタン + 進捗 or 結果リンク or エラー

### Tailwind
- ボタン: `bg-gradient-to-br from-emerald-900 to-emerald-700`（v9 準拠）
- チェックボックス・ラジオ: `accent-emerald-700`
- 進捗バー: v9 の CSS アニメ `@keyframes dl-slide` を globals.css に追加
- 結果リンク: `text-red-600` （v9 準拠、注目喚起のため）

### レスポンシブ
- 狭幅時: チェックボックス群が `flex-wrap` で折返し
- ボタン押下後の結果表示エリアも `flex-wrap` で対応

### a11y
- progress に `role="status" aria-live="polite"`
- エラーに `role="alert"`
- InfoTooltip は T-F7-01 準拠（`role="tooltip"` / `aria-describedby`）
- ボタン無効時は `disabled` + `cursor-not-allowed`

---

## 8. エラーハンドリング

| # | 状態 | 表示 |
|---|---|---|
| E1 | セッション切れ | 「セッションが切れています」+ 再ログイン促し |
| E2 | API 401 UNAUTHORIZED | 同上 |
| E3 | API 403 FORBIDDEN | 「アクセス権がありません。管理者に連絡してください」|
| E4 | API 400 INVALID_INPUT | 「入力内容を確認してください」（通常は UI 制約で到達しない）|
| E5 | API 404 NO_DOCS | 「対象の決算書が見つかりません」|
| E6 | API 500 STORAGE_ERROR / ZIP_BUILD_FAILED | 「サーバエラー。再試行してください」+ code |
| E7 | fetch タイムアウト | 「時間がかかりすぎました。ファイル数を減らして再試行」|
| E8 | 進捗中の画面離脱 | ブラウザ標準の確認不要（進捗は中断されるが ZIP は作成継続）|

---

## 9. 権限・RLS

UI 側は閲覧権限なし（全員ボタン見える）、**API 側で RLS 強制**：
- T-F6-03 の `verifyAuthAndPermission` で forest_users 登録済チェック
- storage の read policy で bucket 横断 access 防止

**注意**: 将来「管理者のみ DL 可」にする場合は本 spec の UI 側でも `isForestAdmin` 条件を追加。

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 全 8 シナリオ（Step 7）|
| 2 | エッジケース | 全社 + 1 期 / 1 社 + 3 期 / 連続押下（multi-click） |
| 3 | 権限 | forest_user / 非ユーザー / 期限切れ JWT |
| 4 | データ境界 | kiCount=1 だが該当期なし / 6 社選択 |
| 5 | パフォーマンス | 6社×3期 = 18 PDF の ZIP 作成 30 秒以内 |
| 6 | Console | API エラー時の詳細が console.error に残る |
| 7 | a11y | progress role="status", error role="alert", button disabled 状態の SR 読み上げ |

---

## 11. 関連参照

- **T-F6-03** [forest-t-f6-03-download-zip-edge.md](2026-04-24-forest-t-f6-03-download-zip-edge.md): Backend API
- **T-F6-01** [forest-t-f6-01-storage-buckets.md](2026-04-24-forest-t-f6-01-storage-buckets.md): bucket
- **T-F6-02** [forest-t-f6-02-drive-to-storage-migration.md](2026-04-24-forest-t-f6-02-drive-to-storage-migration.md): PDF 本体の移送
- **T-F7-01** [forest-t-f7-01-info-tooltip.md](2026-04-24-forest-t-f7-01-info-tooltip.md): InfoTooltip
- **v9 HTML L1014-1077** `dl-controls` / `dl-btn` / `dl-progress`
- **v9 CSS L340-432** dl-progress アニメーション

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 進捗表示の粒度 | **経過秒のみ**（API 側の進捗通知は未実装、ポーリングは過剰）|
| 判2 | 連続押下の抑止 | **ボタン disabled で十分**（誤タップ対策）|
| 判3 | DL 完了後の状態保持 | **state に残す**（別条件で再 DL 時は上書き）|
| 判4 | ダウンロード履歴の可視化 | **Phase A 外**、別 spec（`forest_download_history` テーブル + 画面）|
| 判5 | モバイル対応 | Tablet まで動作保証、スマホでは他端末誘導 |
| 判6 | 進捗 animation の軽量化 | CSS keyframe で十分、requestAnimationFrame 不要 |

— end of T-F6-04 spec —
