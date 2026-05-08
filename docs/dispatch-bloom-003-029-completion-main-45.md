~~~
🟢 bloom-003- No. 29
発信元: a-bloom-003
発信日時: 2026-05-05(火) 17:24
件名: main- No. 45 完了報告（garden-home orb 11 + spin bubble 11 dead-link 整理）

## commit / push
- commit: `6adeb3b` fix(_proto): garden-home orb 11 + spin bubble 11 を React URL に統一 [dispatch main- No.45]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（04086e5..6adeb3b）

## # 3 解決方針: garden-home orb 11 箇所（data-name 単位 Edit）

修正対象: `public/_proto/garden-home/index.html`

| line | data-name | before | after |
|---|---|---|---|
| 285 | Fruit | `href="#"` | `href="/fruit"` |
| 296 | Seed | `href="#"` | `href="/seed"` |
| 307 | Forest | `href="#"` | `href="/forest"` |
| 319 | Bud | `href="#"` | `href="/bud"` |
| 330 | Leaf | `href="#"` | `href="/leaf"` |
| 341 | Tree | `href="#"` | `href="/tree"` |
| 352 | Sprout | `href="#"` | `href="/sprout"` |
| 364 | Soil | `href="#"` | `href="/soil"` |
| 375 | Root | `href="#"` | `href="/root"` |
| 386 | Rill | `href="#"` | `href="/rill"` |
| 397 | Calendar | `href="#"` | `href="/calendar"` |

既存 Bloom orb（line 274、`href="/bloom"`）は変更なし。

## # 4 解決方針: garden-home-spin bubble 11 箇所

修正対象: `public/_proto/garden-home-spin/index.html`

| line | data-mod | before | after |
|---|---|---|---|
| 609 | bud | `./bud.html` | `/bud` |
| 617 | calendar | `./calendar.html` | `/calendar` |
| 625 | fruit | `./fruit.html` | `/fruit` |
| 633 | leaf | `./leaf.html` | `/leaf` |
| 641 | rill | `./rill.html` | `/rill` |
| 649 | seed | `./seed.html` | `/seed` |
| 657 | soil | `./soil.html` | `/soil` |
| 665 | sprout | `./sprout.html` | `/sprout` |
| 673 | tree | `./tree.html` | `/tree` |
| 681 | forest | `./forest.html` | `/forest` |
| 689 | root | `./root.html` | `/root` |

既存 Bloom bubble（line 601、`href="/bloom"`）は変更なし。

## 検証（本セッション grep）

| 確認内容 | 結果 |
|---|---|
| garden-home の orb-card 内 `href="#"` | **0 件** ✅（残る 3 件は user-dropdown / activity-all） |
| garden-home-spin の `href="./[a-z]+\.html"` | **0 件** ✅ |
| garden-home-spin の bubble 12 件 | 全て `/{module}` 統一確認 |

## legacy 保持ファイル一覧（削除禁止）
- public/_proto/garden-home/index.legacy-orb-react-url-20260505.html （新規）
- public/_proto/garden-home-spin/index.legacy-bubble-react-url-20260505.html （新規）

（main- No. 41/42/44 で作成済 legacy 9 件も継続保持）

## 補足: 対象外の項目
- garden-home の `href="#"` 残 3 件（user-dropdown のマイページ・ユーザー設定 + activity-all）はオービット対象外、本 dispatch 対象外
- garden-home-spin の brand-link `./garden-home.html`（line 573）は dispatch 仕様の bubble 11 件に含まれず、現状維持（spin → garden-home 戻り遷移、5/8 デモ後の検討対象）

## 完了時刻
2026-05-05(火) 17:24（着手 17:20 → 完了 17:24、所要 4 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. /_proto/garden-home/ の orb 12 個 全 href が `/<module>` 形式（# = 0）
2. /_proto/garden-home-spin/ の bubble 12 個 全 href が `/<module>` 形式（./xxx.html = 0）
3. 任意で 1〜2 リンク実クリック → React 本番遷移確認

a-bloom-003 待機中（次 bloom-003- No. 30、main- No. 46 待ち）
~~~
