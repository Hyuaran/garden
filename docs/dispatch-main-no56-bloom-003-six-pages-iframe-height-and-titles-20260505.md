# main- No. 56 dispatch - a-bloom-003 Bloom 6 画面 iframe 高さ + title 個別化 + workboard 確認 - 2026-05-05

> 起草: a-main-012
> 用途: 5/8 デモ向け Bloom 6 画面 Chrome MCP 巡回チェック検出 課題 3 件 修正
> 番号: main- No. 56
> 起草時刻: 2026-05-05(火) 19:13
> 緊急度: 🟡 5/8 デモ向け（# 1 は 🔴、# 2 # 3 は 🟡）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🟡 main- No. 56
【a-main-012 から a-bloom-003 への dispatch（Bloom 6 画面 iframe 高さ + title 個別化 + workboard 確認）】
発信日時: 2026-05-05(火) 19:13

a-main-012 が Chrome MCP で Bloom 全 6 画面（bloom Top / workboard / daily-report / monthly-digest / ceo-status / progress）を巡回チェックし、5/8 デモ向け課題 3 件を検出。修正依頼します。

【検出した課題】

# 1: /bloom/progress の iframe 高さ問題（🔴 最優先）

a-main-012 検証結果（DOM 数値）:
- viewport height: 675px
- iframe height: 675px（100vh）
- topbar height: 76px
- → topbar 76px 分が iframe 上部に被さり、**v29 HTML の上部 76px が見えない**
- iframe 内 scrollHeight: 1333px（内部 scroll で全部見えるが、初見で v29 のヘッダーが切れる）

修正:
```tsx
// src/app/bloom/progress/page.tsx
style={{
  width: "100%",
  height: "calc(100vh - 76px)",  // topbar 分を差し引く
  border: "none",
}}
```

または、topbar 高さを CSS 変数で参照可能なら:
```tsx
height: "calc(100vh - var(--bloom-topbar-height, 76px))",
```

→ topbar の実高さは BloomShell の Topbar コンポーネントから抽出（76px は本検証時の実測値）。

# 2: 全 6 画面で `<title>` が "Garden Bloom — Workboard" で重複（🟡 タブ区別不能）

| URL | 現状 title |
|---|---|
| /bloom | "Garden Bloom — Workboard" ❌ |
| /bloom/workboard | "Garden Bloom — Workboard" ✅（実体と一致）|
| /bloom/daily-report | "Garden Bloom — Workboard" ❌ |
| /bloom/monthly-digest | "Garden Bloom — Workboard" ❌ |
| /bloom/ceo-status | "Garden Bloom — Workboard" ❌ |
| /bloom/progress | "Garden Bloom — Workboard" ❌ |

→ 全画面で同じ title、ブラウザタブで区別不能。

修正案: 各 page.tsx で `metadata.title` を export

```tsx
// src/app/bloom/page.tsx (Bloom Top)
export const metadata = { title: 'Bloom — 花咲く業務の庭 | Garden' };

// src/app/bloom/workboard/page.tsx
export const metadata = { title: 'ワークボード — Garden Bloom' };

// src/app/bloom/daily-report/page.tsx
export const metadata = { title: '日報 — Garden Bloom' };

// src/app/bloom/monthly-digest/page.tsx
export const metadata = { title: '月次ダイジェスト — Garden Bloom' };

// src/app/bloom/ceo-status/page.tsx
export const metadata = { title: '経営状況 — Garden Bloom' };

// src/app/bloom/progress/page.tsx
export const metadata = { title: '開発進捗 — Garden Bloom' };
```

または BloomShell 共通 layout で動的 title 生成（pathname ベース）も可。実装方式は a-bloom-003 で判断。

# 3: /bloom/workboard の headers 構造（🟡 確認のみ）

a-main-012 検証結果:
- bodyLen: 10095 文字（内容はある）
- h1/h2/h3: **"🌸 Garden Bloom" のみ**（他のサブナビは日本語タイトル h2 + サブセクション h3 を持つ）

質問:
- workboard の表示内容は何が描画されている？（プレースホルダー / 既存実装 / ComingSoonPage / 別構造）
- 他のサブナビ（daily-report 等）と同様に h2「ワークボード」+ サブセクションを追加するべきか
- それとも現状で意図通りか

→ 現状の表示内容を確認の上、必要なら headers 構造を他サブナビと整合性のあるものに揃える。意図通りなら現状維持で OK（report に「現状維持で OK」記載）。

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. /bloom/progress iframe 高さ = `calc(100vh - 76px)` 実値、topbar 下隠れ解消
2. 各画面の document.title が個別化されていることを確認（6 種異なる title）
3. /bloom/workboard の headers 構造（修正した場合）

【削除禁止ルール】

- 既存ファイル編集時 legacy 保持:
  - src/app/bloom/progress/page.legacy-iframe-height-fix-20260505.tsx
  - 各 page.tsx の metadata 追加時は新規追加のみ → legacy 不要（既存 export 上書きの場合のみ legacy 必要）
  - workboard 修正時 legacy（修正する場合のみ）

【完了報告フォーマット】

bloom-003- No. 32 で:
- commit hash + push 状態
- # 1 iframe 高さ修正（before/after）
- # 2 各 page.tsx の title 個別化（6 件 before/after）
- # 3 workboard の現状内容 + 修正方針（修正する場合 before/after、しない場合「現状維持」）
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 58
a-bloom-003: bloom-003- No. 32 で完了報告予定

工数見込み: 30〜45 分（iframe 高さ + title 6 件 + workboard 確認・修正）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 19:13 初版（a-main-012、Bloom 6 画面 Chrome MCP 巡回チェック検出 3 件）
