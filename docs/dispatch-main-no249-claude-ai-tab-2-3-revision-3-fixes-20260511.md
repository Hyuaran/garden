~~~
🔴 main- No. 249 (v2、Bloom 仕様統一書換)
【a-main-021 から claude.ai（Garden UI 021 chat）への dispatch】
発信日時: 2026-05-11(月) 13:30
改訂: v1 (5/11 12:50) → v2 (5/11 13:30、Bloom 真祖先 baseline 確定 + 修正対象 tab-1 含む 3 件全件)

# 件名
forest-html-15/16 配置済 → 東海林さん視覚チェックで 4 件問題検出（活動パネル収納 / カード色味 / お気に入り欠落 / Bloom 仕様乖離）→ **tab-1 + tab-2 + tab-3 全 3 件修正版起草指示**（forest-html-17 + 18 + 19、Bloom 真祖先 baseline 準拠）

# A. 経緯（v2 改訂）

v1 (5/11 12:50) では tab-2/3 のみ 3 件修正指示。v2 改訂 (5/11 13:30) で 4 件目「Bloom 真祖先からの乖離」発見 → 修正対象拡張:

| 件 | 内容 | 真因 |
|---|---|---|
| 1 | 右サイドバー収納不可 | activity-toggle ボタン + JS が **Bloom 03_Workboard line 285-288 + JS line 16/34** で標準実装、Forest tab-1/2/3 で完全欠落 |
| 2 | カード色味変化 | gf-card（純白 + 緑枠）vs gf-summary-card（クリーム白 + 金茶枠）= 別 class、tab-1 = gf-summary-card で逸脱例外 |
| 3 | お気に入り仕様欠落 | page-favorite-btn が **Bloom 06_CEOStatus line 255-258 + JS line 1510** で標準実装、Forest tab-1/2/3 で完全欠落 |
| 4 | **Bloom 真祖先からの乖離（新規）**| activity-title「Today's Activity」英語完全統一（Bloom 5 + Bud 10 = 15 画面 baseline）/ activity-icon 画像 `<img>` 完全統一 / activity-time 絶対時刻 |

→ Forest tab-1/2/3 = **3 画面が Bloom 真祖先からの単独例外**、a-main-020 期共通テンプレ抽出時の根本起源確認不足。

# B. Bloom 真祖先 baseline（5 画面で完全統一）

| Bloom 画面 | パス（Drive G:）|
|---|---|
| 02_BloomTop | `015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html` |
| 03_Workboard | `015_Gardenシリーズ/000_GardenUI_bloom/03_Workboard/index.html`（**主参照**: activity-panel + activity-toggle + topbar + sidebar の全構造 line 248-345）|
| 04_DailyReport | `015_Gardenシリーズ/000_GardenUI_bloom/04_DailyReport/index.html` |
| 05_MonthlyDigest | `015_Gardenシリーズ/000_GardenUI_bloom/05_MonthlyDigest/index.html` |
| 06_CEOStatus | `015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/index.html`（副参照: page-favorite-btn line 255-258 + JS line 1510 / CSS 参照元）|

claude.ai chat 内で Google Drive コネクタで **Bloom 03_Workboard を主参照、06_CEOStatus を副参照**で直接 Read → activity-panel + activity-toggle + topbar + sidebar + page-favorite 構造を完全踏襲。

# C. 修正指示（tab-1 + tab-2 + tab-3 全 3 件共通）

## C-1. activity-toggle ボタン + JS 追加（Bloom 03_Workboard line 285-288 + JS line 16/34 準拠）

| 要素 | 配置位置 | 参照 line |
|---|---|---|
| `<button class="activity-toggle" id="activityToggle" type="button" title="Activity Panel 収納/展開" aria-expanded="true"><span class="activity-toggle-arrow" aria-hidden="true">‹</span></button>` | **activity-panel 直前**（外側、independent placement、Bloom コメント「panel外に独立配置(親の transform/opacity の影響を受けないように)」踏襲）| Bloom 03_Workboard line 285-288 |
| JS: `localStorage.getItem('garden_activity_collapsed') === '1'` 連動 | script section に追加 | Bloom 03_Workboard line 16 / 34 |
| click handler: collapsed class toggle + localStorage update | 同上 | Bloom 標準実装 |

## C-2. activity-panel 全面 Bloom 仕様化

| 要素 | 旧（Forest tab-1/2/3）| 新（Bloom 仕様準拠）|
|---|---|---|
| activity-title | 「今日の経営アクティビティ」（日本語）| **「Today's Activity」**（英語、Bloom 5 + Bud 10 = 15 画面統一）|
| activity-icon | 絵文字 + inline style 直書き（`<span style="background:...;">💧</span>`）| **画像 `<img>` 化**（`<span class="activity-icon"><img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/icons_bloom/bloom_xxx.png" alt=""></span>` 形式、bloom_workboard / bloom_ceostatus / bloom_dailyreport / bloom_monthlydigest 等のアイコンパック使用）|
| activity-time | 相対時刻「15分前」「本日」 | **絶対時刻「11:30」「10:45」**（Bloom 5 画面準拠）|
| activity-icon-check | 同形式 ✓ | 維持（Bloom と整合）|
| notify-btn | 「⚙ 通知設定をカスタマイズ」 | 維持（Bloom と整合）|
| 内容トーン | 経営指標系（モジュール固有）| Bloom 仕様: 操作ログ系 + モジュール固有混在 OK（時刻 + 動詞「○○しました」標準）、Forest 文脈の経営指標も組込可（「全法人合計残高 ¥... を更新しました」等の動詞形式）|

## C-3. page-favorite-btn 追加（Bloom 06_CEOStatus line 255-258 + 1510 準拠）

| 要素 | 配置位置 | 参照 line |
|---|---|---|
| `<button class="page-favorite-btn" id="pageFavoriteBtn" type="button" title="このページをお気に入りに追加" aria-pressed="false"><img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/D-01a_favorite_outline.png" alt="" class="page-favorite-icon-off"><img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/D-01_favorite_simple.png" alt="" class="page-favorite-icon-on"><span class="page-favorite-toast" id="pageFavoriteToast" aria-live="polite"></span></button>` | **topbar 右側**（Bloom と同位置）| Bloom 06_CEOStatus line 255-258 |
| 関連 JS: `.page-favorite-btn` forEach click handler（press toggle + toast 表示）| script section に追加 | Bloom 06_CEOStatus line 1510 |

## C-4. gf-card → gf-summary-card 統一（tab-1 既稼働準拠）

旧 (tab-2/3):
- `.gf-card { background: rgba(255,255,255,0.78); border: 1px solid rgba(149,213,178,0.5); ... }`

新 (tab-1 既稼働準拠):
- `.gf-summary-card { background: rgba(255, 253, 246, 0.55); border: 1px solid rgba(180, 165, 130, 0.2); ... }`

実施手順:
1. CSS 内 `.gf-card { ... }` を `.gf-summary-card { ... }` に rename + 定義値を tab-1 準拠に差し替え
2. HTML 内全 `class="gf-card"` → `class="gf-summary-card"` 一括 rename
3. tab-3 派生 class（`.gf-cf-balance-card` 等）が `.gf-card` を継承していた場合、`gf-summary-card` ベースで再構成

# D. 添付・参照（claude.ai 側で直接参照）

claude.ai chat 内で以下を Google Drive コネクタで直接 Read → 該当 block を tab-1/2/3 に統合反映:

| ファイル | 用途 |
|---|---|
| `G:/マイドライブ/.../015_Gardenシリーズ/000_GardenUI_bloom/03_Workboard/index.html` | **主参照 baseline**（activity-panel + activity-toggle + topbar + sidebar）|
| `G:/マイドライブ/.../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/index.html` | 副参照 baseline（page-favorite-btn + JS、CSS 参照元）|
| `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html` | tab-1 既稼働（修正対象 1、gf-summary-card 既使用）|
| `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html` | 修正対象 2 |
| `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html` | 修正対象 3 |

# E. 起草成果物

| # | ファイル名 | 配置先（main 側で上書き）|
|---|---|---|
| 1 | forest-html-17（tab-1 修正版）| `tab-1-dashboard.html` |
| 2 | forest-html-18（tab-2 修正版）| `tab-2-financial-summary.html` |
| 3 | forest-html-19（tab-3 修正版）| `chat-ui-forest-tab-3-cashflow-v1-20260511.html` |

各々 ~~~ ラップ + HTML 全文転送（` ```html` から ` ``` ` まで）。

# F. 必須遵守事項（10 件、v1 8 → v2 10 に拡張）

| # | 項目 |
|---|---|
| 1 | activity-toggle ボタン追加（class + id + aria-expanded + 初期化 JS + click handler + localStorage 連動、Bloom 03_Workboard 完全踏襲）|
| 2 | activity-title「Today's Activity」**英語化**（Bloom 5 + Bud 10 = 15 画面統一）|
| 3 | activity-icon **画像 `<img>` 化**（絵文字 + inline style 廃止、bloom_xxx.png アイコンパック使用）|
| 4 | activity-time **絶対時刻化**（「11:30」形式、相対時刻廃止）|
| 5 | page-favorite-btn 追加（topbar 右側、Bloom 06_CEOStatus 完全踏襲）|
| 6 | gf-card → gf-summary-card 一括 rename + CSS 定義値 tab-1 準拠 |
| 7 | tab-1 既稼働構造（topbar / sidebar-dual / activity-panel）+ 各種既存要素（forest-html-15/16 維持）|
| 8 | 6 法人カラー / Forest 緑系 / レスポンシブ @max 1280px 維持 |
| 9 | Root → Forest ミラー HTML コメント保持（tab-3 `<main>` 直前）|
| 10 | tab-3 パターン B データ修正保持（リンクサポート / たいよう cell 口座 2 削除、合計 ¥437,930,000 / 構成比 6 法人分維持）+ 4 セクション完全保持 |

# G. 緊急度

🔴 高（後道さんデモ前 critical path、5/12 デモ前完成必須、Bloom 真祖先 baseline 準拠で Garden 横断統一達成）

# H. 報告フォーマット（forest-html-17 / 18 / 19）

各 forest-html- 報告で:
- 冒頭 3 行 = 番号 + 元→宛先 + 発信日時、~~~ 内配置（v5.2 準拠）
- ~~~ ラップ + ネスト不使用 + コードブロック以外不使用
- HTML 全文を ` ```html ~ ``` ` ブロック内
- 修正反映確認 10 件チェックリスト + self-check
- 状態冒頭明示（[稼働中、ガンガンモード継続]、~~~ 外）
- Bloom 03_Workboard 参照済明示（baseline 整合性）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 経緯（v1 → v2 改訂、4 件問題 + 真因確定）
- [x] B Bloom 真祖先 baseline 5 画面 path 明示
- [x] C-1/C-2/C-3/C-4 修正指示 + Bloom line 参照明示
- [x] D 添付・参照 5 ファイル明示
- [x] E 起草成果物 3 件（forest-html-17/18/19）
- [x] F 必須遵守事項 10 件（v1 8 → v2 10 拡張）
- [x] 緊急度 🔴 + 後道さんデモ前 critical path 明示
- [x] 番号 = main- No. 249（v2、counter 不変）
~~~
