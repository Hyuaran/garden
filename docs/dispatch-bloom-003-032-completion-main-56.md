~~~
🟢 bloom-003- No. 32
発信元: a-bloom-003
発信日時: 2026-05-05(火) 19:18
件名: main- No. 56 完了報告（Bloom 6 画面 iframe 高さ + title 個別化 + workboard 確認）

## commit / push
- commit: `ee06e51` fix(bloom): iframe 高さ + 6 画面 title 個別化 [dispatch main- No.56]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（e05bb27..ee06e51）

## # 1 解決方針: iframe 高さ topbar 分差し引き

修正対象: `src/app/bloom/progress/page.tsx`

| 箇所 | before | after |
|---|---|---|
| iframe height | `100vh` | `calc(100vh - 76px)` |

→ BloomShell topbar 76px（a-main-012 実測値）を差し引き、v29 ヘッダー隠れ解消。

## # 2 解決方針: BloomLayoutClient に動的 title 設定（"use client" 制約回避）

### 制約
全 6 page.tsx が `"use client"` ディレクティブ付きのため、Next.js の制約で `metadata.title` を export 不可（"You are attempting to export 'metadata'..." エラー）。

### 採用案
BloomLayoutClient.tsx 1 ファイルに `useEffect + pathname → document.title` 設定を追加。BLOOM_TITLES マップで 6 画面分網羅。trailing slash 正規化込み。

修正対象: `src/app/bloom/_components/BloomLayoutClient.tsx`

| URL | before（layout.tsx 静的） | after（document.title 動的） |
|---|---|---|
| /bloom | "Garden Bloom — Workboard" | **"Bloom — 花咲く業務の庭 \| Garden"** |
| /bloom/workboard | "Garden Bloom — Workboard" | **"ワークボード — Garden Bloom"** |
| /bloom/daily-report | "Garden Bloom — Workboard" | **"日報 — Garden Bloom"** |
| /bloom/monthly-digest | "Garden Bloom — Workboard" | **"月次ダイジェスト — Garden Bloom"** |
| /bloom/ceo-status | "Garden Bloom — Workboard" | **"経営状況 — Garden Bloom"** |
| /bloom/progress | "Garden Bloom — Workboard" | **"開発進捗 — Garden Bloom"** |

実装抜粋:
```tsx
const BLOOM_TITLES: Record<string, string> = { ... };

useEffect(() => {
  const normalized = pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;
  const title = BLOOM_TITLES[normalized] ?? "Garden Bloom";
  document.title = title;
}, [pathname]);
```

注意: SSR の HTML 初期 `<title>` は layout.tsx の static metadata（"Garden Bloom — Workboard"）のまま。hydration 後に useEffect で動的更新。ブラウザタブ表示は数 ms 後に正しい個別 title に切替。デモ用途として実害なし。

## # 3 /bloom/workboard 確認結果: **現状維持**

a-main-012 検証で `h1/h2/h3: "🌸 Garden Bloom" のみ` だった原因を調査:

実際は workboard/page.tsx line 117-119 に既に h2 `🧭 Workboard` あり。検出されなかった理由は **`if (!userId)` 早期 return（line 106-112）で「ユーザー情報を取得しています...」が表示**されていたため。

```tsx
if (!userId) {
  return (
    <div style={{ padding: 24, color: "#6b8e75" }}>
      ユーザー情報を取得しています...
    </div>
  );
}
// ↑ ここで早期 return、以降の h2 が DOM に出ない
```

つまり実装済みの h2/h3 は **userId 取得後に正常表示**される。a-main-012 のスナップショットは BloomGate dev バイパス時に bloomUser 未設定状態だったため loading view が表示されていた可能性。

判定: **現状維持で OK**（既存実装は他サブナビと整合性あり、ロジック保護のため未編集）。

ただし dev バイパス時に bloomUser が未設定で loading 状態が長引く問題は別途存在。post-デモで BloomState の dev mock 整備を検討推奨。本 dispatch スコープ外。

## 検証 HTTP code（本セッション curl）

| URL | HTTP code |
|---|---|
| /bloom | **200** ✅ |
| /bloom/workboard | **200** ✅ |
| /bloom/daily-report | **200** ✅ |
| /bloom/monthly-digest | **200** ✅ |
| /bloom/ceo-status | **200** ✅ |
| /bloom/progress | **200** ✅ |

## legacy 保持ファイル一覧（削除禁止）
- src/app/bloom/progress/page.legacy-iframe-height-fix-20260505.tsx （新規）
- src/app/bloom/_components/BloomLayoutClient.legacy-dynamic-title-20260505.tsx （新規）

（main- No. 41/42/44/45/48/50 で作成済 legacy 14 件も継続保持）

## 完了時刻
2026-05-05(火) 19:18（着手 19:13 → 完了 19:18、所要 5 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. /bloom/progress iframe 高さ = `calc(100vh - 76px)` 実値、topbar 下隠れ解消（v29 ヘッダー全表示）
2. 各画面の document.title が個別化されている（6 種異なる title）
3. /bloom/workboard は現状維持判断、dispatch # 3 仕様通り

a-bloom-003 待機中（次 bloom-003- No. 33、main- No. 58 待ち）
~~~
