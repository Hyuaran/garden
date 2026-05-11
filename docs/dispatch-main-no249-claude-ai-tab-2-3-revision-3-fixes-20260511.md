~~~
🔴 main- No. 249
【a-main-021 から claude.ai（Garden UI 021 chat）への dispatch】
発信日時: 2026-05-11(月) 12:50

# 件名
forest-html-15/16 配置済 → 東海林さん視覚チェックで 3 件問題検出 → tab-2 + tab-3 修正版起草指示（forest-html-17 + 18 統合、3 件全件修正）

# A. 経緯

tab-2（forest-html-15）+ tab-3（forest-html-16）配置完了後、東海林さんが Chrome 実描画チェック → 3 件問題指摘:

| # | 指摘 | 真因（main 側 grep + CSS 比較で確定）|
|---|---|---|
| 1 | 右サイドバー収納不可 | activity-toggle ボタン + JS が tab-1 line 1417-1418 + line 831 にあって tab-2/3 で完全欠落、共通テンプレ未記載 |
| 2 | カード色味変化 | tab-1 `.gf-summary-card`（クリーム白 rgba(255,253,246,0.55) + 金茶枠 rgba(180,165,130,0.2)）vs tab-2/3 `.gf-card`（純白 rgba(255,255,255,0.78) + 緑枠 rgba(149,213,178,0.5)）= 別 class |
| 3 | お気に入り仕様欠落 | tab-1 line 930-933 `page-favorite-btn` + line 1510 JS が topbar 右側にあって tab-2/3 で完全欠落、共通テンプレ未記載 |

→ a-main-020 期共通テンプレ 3 件（topbar / sidebar-dual / activity-panel）抽出時の漏れ、違反 10 系の再発候補。

# B. 修正指示（tab-2 + tab-3 両ファイル共通）

## B-1. activity-toggle ボタン + JS 追加

tab-1 既稼働 line 1417-1418 + line 831 を参照して反映:

| 要素 | 配置位置 | tab-1 参照 line |
|---|---|---|
| `<button class="activity-toggle" id="activityToggle" type="button" title="Activity Panel 収納/展開" aria-expanded="true"><span class="activity-toggle-arrow" aria-hidden="true">‹</span></button>` | activity-panel 直前 or 同階層（tab-1 と同位置） | tab-1 line 1417-1418 |
| 初期化 JS: `if (localStorage.getItem('garden_activity_collapsed') === '1') document.body.classList.add('activity-collapsed');` | script 先頭 | tab-1 line 831 |
| click handler: activity-toggle click → localStorage 更新 + body class toggle | script 末尾追加 | tab-1 該当部参照 |

## B-2. gf-card → gf-summary-card 統一

旧（tab-2/3 内）:
- `.gf-card { background: rgba(255,255,255,0.78); border: 1px solid rgba(149,213,178,0.5); ... }`

新（tab-1 既稼働準拠）:
- `.gf-summary-card { background: rgba(255, 253, 246, 0.55); border: 1px solid rgba(180, 165, 130, 0.2); ... }`

実施手順:
1. CSS 内 `.gf-card { ... }` を `.gf-summary-card { ... }` に rename + 定義値を tab-1 準拠に差し替え
2. HTML 内全 `class="gf-card"` → `class="gf-summary-card"` 一括 rename
3. tab-3 派生 class（`.gf-cf-balance-card` 等）が `.gf-card` を継承していた場合、`gf-summary-card` ベースで再構成（背景 / 枠は親 class から継承想定なので OK）
4. tab-1 と並べた時に **色温度 + 透明度 + 枠色が完全一致** することを起草中目視確認

## B-3. page-favorite-btn 追加

tab-1 既稼働 line 930-933 + line 1510 を参照して反映:

| 要素 | 配置位置 | tab-1 参照 line |
|---|---|---|
| `<button class="page-favorite-btn" id="pageFavoriteBtn" type="button" title="このページをお気に入りに追加" aria-pressed="false"><img src=".../D-01a_favorite_outline.png" ...><img src=".../D-01_favorite_simple.png" ...><span class="page-favorite-toast" id="pageFavoriteToast" aria-live="polite"></span></button>` | topbar 右側（tab-1 と同位置、user-area 周辺） | tab-1 line 930-933 |
| 関連 JS: `.page-favorite-btn` forEach click handler（press toggle + toast）| script 末尾追加 | tab-1 line 1510 |
| アイコンパス | outline / simple 2 種（D-01a / D-01）| `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/` |

# C. 添付・参照（claude.ai 側で直接参照）

claude.ai chat 内で以下 3 ファイルを Google Drive コネクタで直接 Read → 該当 block を tab-2/3 に統合反映:

| ファイル | 用途 |
|---|---|
| `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html` | 参照 baseline（既稼働、必読）|
| `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html` | 修正対象 1（forest-html-17 で上書き）|
| `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html` | 修正対象 2（forest-html-18 で上書き）|

# D. 起草成果物

| # | ファイル名 | 配置先（main 側で上書き）|
|---|---|---|
| 1 | forest-html-17（tab-2 修正版）| `tab-2-financial-summary.html` |
| 2 | forest-html-18（tab-3 修正版）| `chat-ui-forest-tab-3-cashflow-v1-20260511.html` |

各々 ~~~ ラップ + HTML 全文転送（` ```html` から ` ``` ` まで）。

# E. 必須遵守事項（8 件）

| # | 項目 |
|---|---|
| 1 | activity-toggle ボタン追加（class + id + aria-expanded + 初期化 JS + click handler + localStorage 連動）|
| 2 | gf-card → gf-summary-card 一括 rename + CSS 定義値 tab-1 準拠 + 派生 class 整合確認 |
| 3 | page-favorite-btn 追加（class + id + img 2 種 + toast span + JS）|
| 4 | tab-1 既稼働構造完全踏襲（topbar / sidebar-dual / activity-panel、forest-html-15/16 維持）|
| 5 | 6 法人カラー / Forest 緑系 / レスポンシブ @max 1280px 維持 |
| 6 | Root → Forest ミラー HTML コメント保持（tab-3 `<main>` 直前）|
| 7 | パターン B データ修正保持（tab-3 リンクサポート / たいよう cell 口座 2 削除、ratio amount / 合計 ¥437,930,000 / 構成比 6 法人分維持）|
| 8 | 4 セクション完全保持（tab-3 銀行残高 / 月次CF / 売掛買掛 / 入出金予定）|

# F. 緊急度

🔴 高（後道さんデモ前 critical path、5/12 デモ前完成必須、forest-html-15/16 配置済の品質補完）

# G. 報告フォーマット（forest-html-17 / forest-html-18）

各 forest-html- 報告で:
- 冒頭 3 行 = 番号 + 元→宛先 + 発信日時、~~~ 内配置（v5.2 準拠）
- ~~~ ラップ + ネスト不使用 + コードブロック以外不使用
- HTML 全文を ` ```html ~ ``` ` ブロック内
- 修正反映確認 8 件チェックリスト + self-check
- 状態冒頭明示（[稼働中、ガンガンモード継続]、~~~ 外）

# self-check（本 dispatch として）
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 経緯（3 件指摘 + 真因確定 + main 側 grep 検証）
- [x] B-1/B-2/B-3 修正指示 + tab-1 参照 line 明示
- [x] C 添付・参照 3 ファイル明示
- [x] D 起草成果物 2 件（forest-html-17/18）
- [x] E 必須遵守事項 8 件
- [x] 緊急度 🔴 + 後道さんデモ前 critical path 明示
- [x] 番号 = main- No. 249（counter 継続）
~~~
