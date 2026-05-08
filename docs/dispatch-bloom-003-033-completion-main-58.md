~~~
🟢 bloom-003- No. 33
発信元: a-bloom-003
発信日時: 2026-05-05(火) 19:25
件名: main- No. 58 完了報告（title 個別化 再修正 + iframe 高さ 153px 微調整）

## commit / push
- commit: `dc8bc78` fix(bloom): title 個別化を layout.tsx metadata に切替 + iframe 153px [dispatch main- No.58]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（ee06e51..dc8bc78）

## # 1 title 動作しなかった原因 + 採用した修正方式

### 原因（仮説 c が正解）
No.56 の useEffect 方式は **Next.js App Router の Metadata API と競合**:

1. SSR 時、`src/app/bloom/layout.tsx` の `metadata.title` "Garden Bloom — Workboard" が `<head><title>` に注入
2. Hydration 後、useEffect で `document.title` を BLOOM_TITLES から動的設定（一瞬切替）
3. **Next.js が navigation 完了時に再度 metadata を評価し直し → useEffect で設定した title を上書き**
4. 結果: 最終的にブラウザタブには layout.tsx の static title「Garden Bloom — Workboard」が残る

useEffect は dom mount 後に動くが、Next.js Metadata API の方が**より遅く実行**されるため負ける。

### 採用案: 各サブルートに layout.tsx 新規作成（Next.js 公式パターン）

App Router の階層的 metadata 仕様: 子 layout.tsx の metadata が親を上書きできる。layout.tsx は server component なので `"use client"` 制約とは無関係に metadata export 可能。

### 6 件 title before / after

| URL | before（layout.tsx 全画面共通） | after（各サブルート layout.tsx） |
|---|---|---|
| /bloom | "Garden Bloom — Workboard" ❌ | **"Bloom — 花咲く業務の庭 \| Garden"** ✅ |
| /bloom/workboard | "Garden Bloom — Workboard" ❌ | **"ワークボード — Garden Bloom"** ✅ |
| /bloom/daily-report | "Garden Bloom — Workboard" ❌ | **"日報 — Garden Bloom"** ✅ |
| /bloom/monthly-digest | "Garden Bloom — Workboard" ❌ | **"月次ダイジェスト — Garden Bloom"** ✅ |
| /bloom/ceo-status | "Garden Bloom — Workboard" ❌ | **"経営状況 — Garden Bloom"** ✅ |
| /bloom/progress | "Garden Bloom — Workboard" ❌ | **"開発進捗 — Garden Bloom"** ✅ |

新規 layout.tsx 5 件:
- src/app/bloom/workboard/layout.tsx
- src/app/bloom/daily-report/layout.tsx
- src/app/bloom/monthly-digest/layout.tsx
- src/app/bloom/ceo-status/layout.tsx
- src/app/bloom/progress/layout.tsx

各 layout.tsx の構造（透過 wrapper）:
```tsx
import type { ReactNode } from "react";
export const metadata = { title: "○○ — Garden Bloom" };
export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

src/app/bloom/layout.tsx の metadata.title 変更（/bloom Top 用に flat 化）:
- "Garden Bloom — Workboard" → "Bloom — 花咲く業務の庭 | Garden"

BloomLayoutClient.tsx の useEffect 撤去（競合源、不要に）。

### 検証 (本セッション SSR HTML curl + grep)

```
=== /bloom ===
<title>Bloom — 花咲く業務の庭 | Garden</title>
=== /bloom/workboard ===
<title>ワークボード — Garden Bloom</title>
=== /bloom/daily-report ===
<title>日報 — Garden Bloom</title>
=== /bloom/monthly-digest ===
<title>月次ダイジェスト — Garden Bloom</title>
=== /bloom/ceo-status ===
<title>経営状況 — Garden Bloom</title>
=== /bloom/progress ===
<title>開発進捗 — Garden Bloom</title>
```

→ SSR レベルで全 6 画面個別化済、navigation 後の上書きも発生しない。

## # 2 iframe 高さ 153px 反映 before / after

修正対象: `src/app/bloom/progress/page.tsx`

| 箇所 | before | after |
|---|---|---|
| iframe height | `calc(100vh - 76px)` | **`calc(100vh - 153px)`** |

→ topbar 76 + サブヘッダー 77 = 153px を差し引き、viewport 内に iframe 収まる構成。
→ a-main-012 検証想定: iframeBottom <= viewportH 達成。

## legacy 保持ファイル一覧（削除禁止）
- src/app/bloom/_components/BloomLayoutClient.legacy-title-redo-20260505.tsx （新規）
- src/app/bloom/progress/page.legacy-iframe-153-fix-20260505.tsx （新規）
- src/app/bloom/layout.legacy-title-redo-20260505.tsx （新規、metadata 変更前の親 layout）

（main- No. 41/42/44/45/48/50/56 で作成済 legacy 16 件も継続保持）

## 完了時刻
2026-05-05(火) 19:25（着手 19:21 → 完了 19:25、所要 4 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. 全 6 画面の `document.title` 個別化（SSR から正しい値、navigation 後も維持）
2. /bloom/progress iframe.bottom <= viewportH（topbar + サブヘッダー 153px 差し引き有効）

a-bloom-003 待機中（次 bloom-003- No. 34、main- No. 59 待ち）
~~~
