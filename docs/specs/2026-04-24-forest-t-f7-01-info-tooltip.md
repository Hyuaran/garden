# T-F7-01: InfoTooltip 共通コンポーネント 実装指示書

- 対象: Garden-Forest F7 Info Tooltip
- 見積: **0.25d**（約 2 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch2 #T-F7-01）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.7

---

## 1. スコープ

### 作る
- ホバー / フォーカスで展開する **共通 `InfoTooltip` コンポーネント**
- 主な用途: **T-F6-03 Download Section** の使い方説明
- a11y 対応（role="tooltip", ARIA 関連属性、キーボード操作）

### 作らない
- リッチコンテンツ（画像・動画埋込）
- tooltip 内インタラクション（ボタンクリック等）
- 多段 tooltip（ネスト）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| Forest 既存 | `_constants/colors.ts` / `_constants/theme.ts`（グリーン系トーン継承） |
| Tailwind | 既に Bud モジュールで導入済、Forest 側でも利用可能と想定 |
| v9 参照 | L434-478 の `.info-wrap` / `.info-icon` / `.info-tooltip` 相当 |

---

## 3. ファイル構成

### 新規
- `src/app/forest/_components/InfoTooltip.tsx`
- `src/app/forest/_components/__tests__/InfoTooltip.test.tsx`（Vitest or Jest 想定、CI 未整備なら手動確認）

### 変更なし
- 他コンポーネントからの利用は T-F6-03（Download Section）で初登場

---

## 4. 型定義

```typescript
// InfoTooltip.tsx 内（export 不要の内部型）
type InfoTooltipProps = {
  /** i アイコン位置の aria-label */
  label?: string;                            // default: '詳細情報'

  /** tooltip ヘッダー（太字、v9 の `strong` 相当）*/
  title?: string;

  /** 本文 — string[] で複数段落 or ReactNode で柔軟に */
  children: React.ReactNode;

  /** 配置（i アイコンからの相対）*/
  placement?: 'top' | 'bottom' | 'left' | 'right';   // default: 'top'

  /** 表示幅（固定 / max 幅）*/
  maxWidth?: number;                          // default: 520（v9 準拠）

  /** 表示タイミング（将来用）*/
  trigger?: 'hover' | 'focus' | 'both';       // default: 'both'
};
```

---

## 5. 実装ステップ

### Step 1: 基本レンダリング
```typescript
// src/app/forest/_components/InfoTooltip.tsx
'use client';

import { useId, useState, type ReactNode } from 'react';

type InfoTooltipProps = {
  label?: string;
  title?: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
  trigger?: 'hover' | 'focus' | 'both';
};

export function InfoTooltip({
  label = '詳細情報',
  title,
  children,
  placement = 'top',
  maxWidth = 520,
  trigger = 'both',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  const hoverHandlers = trigger === 'hover' || trigger === 'both'
    ? { onMouseEnter: () => setIsOpen(true), onMouseLeave: () => setIsOpen(false) }
    : {};
  const focusHandlers = trigger === 'focus' || trigger === 'both'
    ? { onFocus: () => setIsOpen(true), onBlur: () => setIsOpen(false) }
    : {};

  const placementClasses = {
    top:    'bottom-7 left-0',
    bottom: 'top-7 left-0',
    left:   'right-7 top-0',
    right:  'left-7 top-0',
  }[placement];

  return (
    <span className="relative inline-flex items-center" {...hoverHandlers}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        className="w-[18px] h-[18px] rounded-full bg-emerald-900/10 text-emerald-700 text-[10px] font-bold flex items-center justify-center cursor-help italic font-serif hover:bg-emerald-900/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        {...focusHandlers}
      >
        i
      </button>
      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 bg-white border border-emerald-100 rounded-[10px] px-5 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.12)] text-xs text-gray-800 leading-relaxed font-normal ${placementClasses}`}
          style={{ width: maxWidth }}
        >
          {title && <strong className="font-semibold text-emerald-900 block mb-1">{title}</strong>}
          {children}
        </div>
      )}
    </span>
  );
}
```

### Step 2: v9 互換の利用例（Download Section 想定）
```tsx
<h2 className="section-title flex items-center gap-2.5">
  <svg>...</svg>
  決算書ダウンロード
  <InfoTooltip title="使い方" placement="top">
    <ul className="list-disc pl-4 my-1 space-y-0.5">
      <li>法人を選択（複数可）</li>
      <li>直近何期分かを選択</li>
      <li>「ダウンロードする」をクリック</li>
    </ul>
    <strong className="font-semibold text-emerald-900 block mt-2">ZIPファイルについて</strong>
    <ul className="list-disc pl-4 my-1 space-y-0.5">
      <li>選択した決算書がZIPにまとめてダウンロードされます</li>
      <li>ファイルが大きい場合、作成に少し時間がかかります</li>
    </ul>
  </InfoTooltip>
</h2>
```

### Step 3: キーボード操作検証
- Tab で `<button>` にフォーカス → tooltip が表示される
- Shift+Tab でフォーカスアウト → 閉じる
- Esc キーで閉じる（Step 4 で追加）

### Step 4: Esc キーで閉じる
```typescript
useEffect(() => {
  if (!isOpen) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false);
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [isOpen]);
```

### Step 5: テスト（3 観点）
1. tooltip がホバーで表示される
2. フォーカスで表示される
3. Esc で閉じる

---

## 6. データソース

なし（純粋な UI コンポーネント、props で内容を受ける）

---

## 7. UI 仕様

### コンポーネント構造
```
<span.relative>   (コンテナ)
  <button>i</button>  (trigger)
  {isOpen && <div role="tooltip">...</div>}  (popup)
</span>
```

### Tailwind スタイル（v9 CSS L434-478 相当）
- i アイコン: 18×18px, `bg-emerald-900/10`, hover で `/20`, `italic font-serif` で v9 の Georgia 風 i
- tooltip: `bg-white`, `border-emerald-100`, `rounded-[10px]`, `shadow-[...]`, `px-5 py-2.5`
- 文字: `text-xs` (0.7rem 相当), `leading-relaxed` (1.5)

### placement ロジック
- `top`: trigger の上方に表示（既定、v9 準拠）
- 画面端で切れる場合は将来 Popper.js 等で自動反転。**Phase A では静的指定で可**

### 幅
- 既定 520px（v9 準拠）。`maxWidth` prop で上書き可

---

## 8. エラーハンドリング

| # | 想定 | 対応 |
|---|---|---|
| E1 | `children` が undefined | React は空要素として描画、tooltip は開かない |
| E2 | `maxWidth` に巨大値 | CSS で自動的に clamp（overflow は内側スクロール）|
| E3 | SSR 時に `useId` 不整合 | `'use client'` 指定で回避 |

---

## 9. 権限・RLS

なし（UI コンポーネント、DB アクセスなし）

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | hover / focus / Esc すべてで動作 |
| 2 | エッジケース | 空 children / 巨大 maxWidth / 日本語長文 |
| 6 | Console | 警告なし（特に React の key / ref 警告） |
| 7 | **a11y** | `role="tooltip"` / `aria-describedby` / Tab フォーカス / Esc 閉じる |

---

## 11. 関連参照

- v9 HTML CSS L434-478（`.info-wrap` / `.info-icon` / `.info-tooltip`）
- v9 HTML L1019-1040（Download Section の info tooltip 利用例）
- [P07 v9 vs TSX §4.7](2026-04-24-forest-v9-vs-tsx-comparison.md)
- Forest 既存 `_constants/colors.ts`（グリーン系カラー）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | Popper.js 等で画面端の自動反転対応をするか | **Phase A では静的指定のみ**、将来 a-forest が共通ライブラリ化時に検討 |
| 判2 | tooltip をクリックで固定表示する機能 | **未対応**（今回はシンプル維持）|
| 判3 | モバイルでホバー動作が効かない問題 | タップで開閉可の focus 系 handler で既に対応済 |
| 判4 | 他モジュール（Bud/Bloom）への切り出し | **Phase A 完了後**に `src/components/shared/` へ昇格検討 |

— end of T-F7-01 spec —
