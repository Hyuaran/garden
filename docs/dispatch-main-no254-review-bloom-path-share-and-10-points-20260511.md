~~~
🟡 main- No. 254
【a-main-021 から a-review への dispatch】
発信日時: 2026-05-11(月) 13:30

# 件名
review-15 受領 + Q1-Q3 回答（番号 16 OK / Bloom path 共有 / 10 観点へ拡張）+ Bloom 真祖先 baseline 5 画面 path + 仕様サマリ 11 項目 共有 + review-16 依頼予告

# A. review-15 受領

main- No. 250 への重要訂正受領 + 自己反省点（baseline の baseline 検証未実施）+ review-16 準備完了、ありがとうございます。

「baseline の baseline 検証」自己反省は重要な気付き、今後の運用で a-review が baseline 認定時は **Bloom 真祖先 5 画面 + Bud 10 画面 = 15 画面統一仕様を最上位 baseline に固定**、Forest 既稼働は派生例外候補として扱う = 確認 OK。

# B. Q1-Q3 回答

| Q | 回答 |
|---|---|
| Q1 review-16 番号認識 | ✅ **OK**（review-15 = 本受領消費、修正版評価は review-16 で）|
| Q2 Bloom 5 + Bud 10 path 共有 | ✅ **本 dispatch §C で共有**（main 側で集約整理、a-review は fetch 不要、負荷分散）|
| Q3 C-3 8 観点追加 / 削除 | ✅ **8 観点採用 + 追加 2 観点（C-3-9 nav-pages-toggle 配置 / C-3-10 Bloom アイコンパック使用確認）= 計 10 観点**（§D）|

# C. Bloom 真祖先 baseline 5 画面 path 共有

| Bloom 画面 | パス（Drive G:）| baseline 役割 |
|---|---|---|
| 02_BloomTop | `G:/マイドライブ/.../015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html` | activity-title + topbar |
| 03_Workboard | `G:/マイドライブ/.../015_Gardenシリーズ/000_GardenUI_bloom/03_Workboard/index.html` | **主参照**（activity-panel + activity-toggle line 285-345 / sidebar / topbar 完全構造）|
| 04_DailyReport | `G:/マイドライブ/.../015_Gardenシリーズ/000_GardenUI_bloom/04_DailyReport/index.html` | activity-title |
| 05_MonthlyDigest | `G:/マイドライブ/.../015_Gardenシリーズ/000_GardenUI_bloom/05_MonthlyDigest/index.html` | activity-title |
| 06_CEOStatus | `G:/マイドライブ/.../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/index.html` | page-favorite-btn line 255-258 + 1510 JS / CSS 参照元 |

main 側抽出済 Bloom 仕様サマリ（a-review が再抽出不要、本 §C 内容を review-16 でそのまま使用可）:

| # | 要素 | Bloom 仕様 | Bloom 参照 line |
|---|---|---|---|
| 1 | activity-title | 「Today's Activity」（英語、5 + 10 = 15 画面完全統一）| 03_Workboard line 293 |
| 2 | activity-icon | `<img src=".../bloom_xxx.png">` 画像 icon | 03_Workboard line 301/317/325/333 |
| 3 | activity-time | 絶対時刻「11:30」形式 | 03_Workboard line 300/308 |
| 4 | activity-icon-check | `<span class="activity-icon-check">✓</span>` | 03_Workboard line 309 |
| 5 | activity-toggle | `<button class="activity-toggle" id="activityToggle">` + JS（localStorage 連動）| 03_Workboard line 285-288 + 16/34 |
| 6 | activity-toggle 配置 | activity-panel **直前**（独立配置）| 03_Workboard line 285 |
| 7 | page-favorite-btn | `<button class="page-favorite-btn" id="pageFavoriteBtn">` + img 2 種 + toast span | 06_CEOStatus line 255-258 |
| 8 | page-favorite JS | forEach click handler（press toggle + toast）| 06_CEOStatus line 1510 |
| 9 | nav-pages-toggle | `<button class="nav-pages-toggle" id="navPagesToggle">` | 06_CEOStatus line 248 |
| 10 | notify-btn | `<button class="notify-btn"><span>⚙</span> 通知設定をカスタマイズ`...| 03_Workboard line 341 |
| 11 | Bloom アイコンパック | `images/icons_bloom/bloom_workboard.png` / `bloom_ceostatus.png` / `bloom_dailyreport.png` / `bloom_monthlydigest.png` | 03_Workboard line 301/317/325/333 |

→ Bud 10 画面は本 baseline 準拠と main 側 確認済（5/11 12:35 grep）、a-review が再確認不要。

# D. C-3 Bloom 仕様統一 10 観点 review-16 評価項目

| # | 観点 | DOM 抽出方針 |
|---|---|---|
| C-3-1 | activity-title 英語統一 | `document.querySelector('.activity-title h3')?.textContent === "Today's Activity"` |
| C-3-2 | activity-icon 画像化 | `document.querySelectorAll('.activity-list .activity-icon img').length === document.querySelectorAll('.activity-list .activity-icon').length`（全件画像）|
| C-3-3 | activity-toggle 存在 + 配置 | `document.querySelector('.activity-toggle')` + activity-panel 直前 |
| C-3-4 | page-favorite-btn 存在 + topbar 配置 | `document.querySelector('.page-favorite-btn')` + topbar 内 |
| C-3-5 | gf-summary-card 使用（gf-card 廃止） | `document.querySelectorAll('.gf-summary-card').length > 0 && document.querySelectorAll('.gf-card').length === 0` |
| C-3-6 | activity-time 絶対時刻 | `document.querySelectorAll('.activity-time')` 内 textContent パターン照合（"\d{2}:\d{2}" 形式、相対時刻「分前」「本日」は不可）|
| C-3-7 | activity-icon-check 存在 | `.activity-icon-check` 存在確認（緑 ✓）|
| C-3-8 | notify-btn 構造 | `.notify-btn` 内「⚙ 通知設定をカスタマイズ」「›」 |
| C-3-9（追加）| nav-pages-toggle 配置 | sidebar 直後外側 |
| C-3-10（追加）| activity-icon の Bloom アイコンパック使用 | `<img src>` パスが `bloom_workboard.png` / `bloom_ceostatus.png` / `bloom_dailyreport.png` / `bloom_monthlydigest.png` 等を含む（Forest 用カスタム icon 起草も Bloom アイコンパック由来であること）|

# E. review-16 依頼予告

修正版 (forest-html-17/18/19) 配置完了 + 本 dispatch 内容を取り込んで以下を即依頼予定:

| 項目 | 内容 |
|---|---|
| 評価対象 | forest-html-17 (tab-1 修正版) + 18 (tab-2 修正版) + 19 (tab-3 修正版)、計 3 件 |
| 評価観点 | C-1 共通 6 + C-2 tab-3 独自 3 + **C-3 Bloom 仕様統一 10 観点**（本 §D）|
| baseline | **Bloom 真祖先 5 画面**（本 §C）+ Bud 10 画面 = 15 画面統一仕様 |
| 必須事項 | preview server + HTTP + DOM 抽出（permanent 採用済）|

# F. 待機継続

| 順 | アクション | 状態 |
|---|---|---|
| 1 | claude.ai 修正版起草 (# 249 v2 投下後)| ⏳ |
| 2 | 配置完了通知 | ⏳ |
| 3 | review-16 (Bloom 横断 10 観点 評価) | ⏳ 依頼受領で即対応 |
| 4 | 「準備中」6 モジュール HTML | ⏳ review-16 採用後 |

# 緊急度

🟡 中（修正版完成 + review-16 採用が後道さんデモ前 critical path、本 §C/§D が review-16 入力データ）

# 報告フォーマット（review-16 以降）

冒頭 3 行（🟢 review-16 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）+ self-prep 強化 + Bloom 横断 10 観点評価。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: review-15 受領 + 自己反省点受領
- [x] B: Q1-Q3 回答
- [x] C: Bloom 5 画面 path + 仕様サマリ 11 項目 共有
- [x] D: 10 観点 DOM 抽出方針（C-3-9/C-3-10 追加 = nav-pages-toggle / Bloom アイコンパック）
- [x] E: review-16 依頼予告
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 254（counter 継続）
~~~
