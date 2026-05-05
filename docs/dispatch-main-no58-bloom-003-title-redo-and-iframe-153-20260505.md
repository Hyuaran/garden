# main- No. 58 dispatch - a-bloom-003 title 個別化 再修正 + iframe 高さ 153px 微調整 - 2026-05-05

> 起草: a-main-012
> 用途: main- No. 56 検証で title 動作不発、iframe 下 77px はみ出し検出 → 再修正
> 番号: main- No. 58
> 起草時刻: 2026-05-05(火) 19:21
> 緊急度: 🔴 5/8 デモ向け（# 1 が🔴、# 2 が🟡）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🔴 main- No. 58
【a-main-012 から a-bloom-003 への dispatch（title 個別化 再修正 + iframe 高さ 153px 微調整）】
発信日時: 2026-05-05(火) 19:21

bloom-003- No. 32（main- No. 56 完了報告）受領 → Chrome MCP 検証で 2 件問題検出。

【検出した問題】

# 1: title 個別化が動作していない（🔴）

bloom-003- No. 32 で「BloomLayoutClient + useEffect で動的設定」と報告いただいたが、a-main-012 検証で全 4 画面 title が "Garden Bloom — Workboard" のまま:

| URL | 期待 title | 実 title |
|---|---|---|
| /bloom | "Bloom — 花咲く業務の庭 \| Garden" | "Garden Bloom — Workboard" ❌ |
| /bloom/workboard | "ワークボード — Garden Bloom" | "Garden Bloom — Workboard" ❌ |
| /bloom/daily-report | "日報 — Garden Bloom" | "Garden Bloom — Workboard" ❌ |
| /bloom/progress | "開発進捗 — Garden Bloom" | "Garden Bloom — Workboard" ❌ |

検証時 wait 時間: 5〜8 秒（hydration 完了に十分）

推測される原因:
- (a) BLOOM_TITLES map のキーと pathname のミスマッチ（trailing slash / case 等）
- (b) useEffect 内で document.title 設定後、別 component が即座に上書き
- (c) layout.tsx の static metadata.title が遅延上書き
- (d) BloomLayoutClient が他のコンポーネントの内側にあって render されていない

確認 + 修正お願いします:
1. BloomLayoutClient.tsx の useEffect 内 console.log で pathname + 設定中 title をログ出力 → 動作確認
2. もし useEffect 動作している → 別 component の上書きを探す
3. もし動作していない → BloomLayoutClient の配置位置 / "use client" / pathname 取得方法を再確認

代替実装案（より確実）:
- Next.js App Router では layout.tsx で `generateMetadata` 関数を使うと **動的 title が SSR から有効**
- "use client" 制約は page.tsx 単位、layout.tsx は server component のままで OK
- 各 page.tsx の `<head>` 内で `<title>` JSX 直接記述（ただし React 19 / Next 15 でない場合非推奨）

実装方式は a-bloom-003 で判断、ただし **動作する形まで持っていく** ことが目的。

# 2: iframe 高さ 153px 問題（🟡）

a-main-012 検証結果:
- iframeTop = 153px（topbar 76 + サブヘッダー 77 が存在）
- iframeH = 824px（calc(100vh - 76px) 適用済）
- viewportH = 900px
- → iframe 下 77px が viewport 外にはみ出し

修正案:
```tsx
// src/app/bloom/progress/page.tsx
style={{
  width: "100%",
  height: "calc(100vh - 153px)",  // topbar + サブヘッダー = 153px
  border: "none",
}}
```

または topbar + サブヘッダーを CSS 変数化して保守性向上。

実害は軽微（iframe 内に独自 scroll あるためコンテンツ全体に到達可能）だが、デモで「下まで見えない」と気付かれる可能性あり。

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. /bloom, /bloom/workboard, /bloom/daily-report, /bloom/monthly-digest, /bloom/ceo-status, /bloom/progress の document.title が個別化（6 種異なる）
2. /bloom/progress iframe.top + iframe.height が viewport 内に収まる（iframeBottom <= viewportH）

【削除禁止ルール】

新規 legacy:
- BloomLayoutClient.legacy-title-redo-20260505.tsx
- progress/page.legacy-iframe-153-fix-20260505.tsx

（main- No. 41/42/44/45/48/50/56 で作成済 legacy 16 件も継続保持）

【完了報告フォーマット】

bloom-003- No. 33 で:
- commit hash + push 状態
- # 1 title 動作しなかった原因 + 採用した修正方式 + 6 件 title before/after
- # 2 iframe 高さ 153px 反映 before/after
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 59
a-bloom-003: bloom-003- No. 33 で完了報告予定

工数見込み: 30〜45 分（title 動作原因調査 + 修正 + iframe 微調整 + 検証）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 19:21 初版（a-main-012、main- No. 56 検証で title 不発 + iframe 153 検出）
