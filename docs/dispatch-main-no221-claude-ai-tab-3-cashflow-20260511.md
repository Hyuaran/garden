~~~
🟡 main- No. 221
【a-main-020 から claude.ai chat（Garden UI 021）への dispatch】
発信日時: 2026-05-11(月) 10:25

# 件名
tab-3 cashflow 起草 + 共通テンプレート抽出計画（mock 画像直接添付フロー、Forest UI シフト第 2 弾）

# 1. 背景

Garden Forest UI を既存デザイン（garden-forest_v9.html、login overlay 統合 + 独自スタイル）から現行の仕様（Bloom 統一認証 + 6 法人カラー + gf-* プレフィックス + topbar / sidebar.sidebar-dual / activity-panel 構造）にシフト中。

進捗:
- tab-1 dashboard: ✅ 既稼働
- tab-2 financial-summary: ✅ 修正版 forest-html-10 配置済、review-11 採用推奨
- tab-3 cashflow: ❌ 未起草（本 dispatch で起草着手）
- tab-4-7: 順次（tab-3 起草で確立した共通テンプレートを使い回し）

# 2. 起草対象 tab-3 cashflow

## 2-1. mock 画像（添付必須、東海林さんに別途明示）

ファイル: G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\ui-mocks\tab-3-cashflow.png（2.1MB）

claude.ai chat にこの画像を直接アップロード（memory feedback_chatgpt_mock_to_claude_ai_direct_attach 整合、Claude Code 経由のテキスト化禁止）。

## 2-2. 配置先

_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html

# 3. 共通テンプレート踏襲（tab-1 + tab-2 修正版から確立済の構造）

## 3-1. ヘッダー（topbar）= 全モジュール共通候補

- 構造: `.topbar` > `.topbar-logo` + `.topbar-breadcrumb` + `.topbar-btn` + `.topbar-user`
- Forest 用カスタマイズ:
  - logo: 🌳 Garden Forest
  - breadcrumb: 経営支援 / キャッシュフロー
  - btn: 🌓（theme toggle）+ 🔔（通知）
  - user: 東海林 美琴 CEO

## 3-2. 左サイドバー（sidebar.sidebar-dual）

### 3-2-1. 1 本目（nav-apps）= 全モジュール共通候補
12 モジュール orb（Bloom / Forest / Tree / Bud / Leaf / Root / Rill / Soil / Sprout / Calendar / Fruit / Seed）

### 3-2-2. 2 本目（nav-pages）= モジュール別
Forest 用 7 タブ（dashboard / financial-summary / **cashflow ←アクティブ** / business-kpi / budget-vs-actual / alerts-risks / reports-analysis）

## 3-3. 右サイドバー（activity-panel）= 全モジュール共通候補
- 構造: `.activity-panel`
- Forest 用カスタマイズ: Forest Activity 6 件（cashflow 関連の最新更新等、tab-3 mock 参照）

# 4. cashflow 独自セクション起草要件

mock 画像を直接見て忠実に HTML 化（独自セクション追加禁止、memory feedback_chatgpt_mock_to_claude_ai_direct_attach §1）:

- 上段 KPI 行（cash 関連の主要指標）
- 中段 chart 群（cashflow waterfall / forecast / 6 法人横並び等、mock に従う）
- 下段 詳細 table or 法人別内訳（mock に従う）

# 5. 必須遵守事項

| # | 項目 | 内容 |
|---|---|---|
| 1 | mock v1 忠実再現 | 独自セクション追加禁止、レイアウト / 色 / 構造 mock 通り |
| 2 | 6 法人カラー | ヒュアラン #F4A6BD / センターライズ #8E7CC3 / リンクサポート #4A6FA5 / ARATA #E8743C / たいよう #F9C846 / 壱 #C0392B |
| 3 | Forest 緑系 5 階調 | tab-1 + tab-2 修正版から継承（gf-* CSS 変数）|
| 4 | 背景画像 | bg-forest-light.png / bg-forest-dark.png（dark theme サポート、tab-1 同設計）|
| 5 | プレフィックス | gf-* + 機能別派生（gf-cashflow-* 推奨）|
| 6 | レスポンシブ | @media (max-width: 1280px) で grid 縦積み切替（tab-1 / tab-2 同 breakpoint）|
| 7 | Chart.js | CDN ロード（chart.js@4.4.0 以降、tab-2 修正版と同バージョン）|
| 8 | レンダリング検証 | python -m http.server 経由で file:// CORS 回避、claude.ai 起草時に動作確認推奨 |

# 6. 共通テンプレート抽出計画（tab-3 起草と並行、main 側で実施）

claude.ai が tab-3 起草中、main 側で tab-1 + tab-2 修正版から共通構造を抜き出して別 md ファイルに保存:

| 抽出対象 | 抽出元 | 保存先 |
|---|---|---|
| topbar 構造 | tab-1 + tab-2 修正版 | docs/templates/garden-ui-topbar-template.md |
| sidebar.sidebar-dual 構造 | 同上 | docs/templates/garden-ui-sidebar-dual-template.md |
| activity-panel 構造 | 同上 | docs/templates/garden-ui-activity-panel-template.md |

claude.ai 側は本 dispatch では抽出作業不要、tab-3 起草に専念。抽出後 a-analysis-001 経由で全モジュール共通テンプレート化提案 → 東海林さん最終決裁 → 他モジュール（Bloom / Tree / 等）に水平展開検討。

# 7. 報告フォーマット（forest-html-11 候補）

冒頭 3 行（🟢 forest-html-11 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
tab-3 cashflow HTML 起草完了 + 配置完了報告

### 起草内容
- ファイル: _chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html
- 行数: NN 行 / NN バイト
- 構造: header (topbar) + 左 sidebar (sidebar-dual) + 右 sidebar (activity-panel) + main (cashflow セクション)

### 共通構造踏襲確認
- topbar: tab-1 / tab-2 修正版から踏襲
- sidebar-dual: 同上、nav-pages の active を cashflow に
- activity-panel: 同上、Forest Activity 6 件カスタマイズ

### cashflow 独自セクション
- 上段 KPI / 中段 chart 群 / 下段 詳細（mock 忠実再現）

### 必須遵守事項チェック
- mock v1 忠実 / 6 法人カラー / Forest 緑系 / bg-forest-light + dark / gf-cashflow-* / レスポンシブ / Chart.js CDN / HTTP server 検証

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] mock 画像直接添付フロー（Claude Code 経由のテキスト化なし）
- [x] tab-1 / tab-2 修正版 共通構造踏襲
- [x] cashflow 独自セクション mock 忠実

# 8. 緊急度

🟡 中（tab-3 起草、tab-4-7 順次展開の起点）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] mock 画像フルパス明示（東海林さん別途添付指示）
- [x] 共通テンプレート踏襲 3 構造（topbar / sidebar-dual / activity-panel）明示
- [x] cashflow 独自セクション要件明示
- [x] 必須遵守事項 8 件明示
- [x] 共通テンプレート抽出計画（main 側並行作業）明示
- [x] 報告フォーマット (forest-html-11) 雛形提示
- [x] 番号 = main- No. 221（counter 継続）

# 東海林さんへ - コピーテキスト外

このテキストを claude.ai chat（Garden UI 021）に投下する際、以下のファイルを直接アップロード添付してください:
- G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\ui-mocks\tab-3-cashflow.png（2.1MB、tab-3 mock 画像）

参考（直接添付不要、claude.ai が必要なら別途要求）:
- tab-1 既稼働 HTML 配置先（既存）
- tab-2 修正版 HTML（forest-html-10、配置済）
~~~
