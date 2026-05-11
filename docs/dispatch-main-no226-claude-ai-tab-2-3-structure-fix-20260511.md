~~~
🔴 main- No. 226
【a-main-020 から claude.ai chat（Garden UI 021）への dispatch（緊急構造修正）】
発信日時: 2026-05-11(月) 10:53

# 件名
緊急構造修正: tab-2 修正版 + tab-3 起草版 HTML 構造が tab-1 共通 CSS と不整合（ヘッダー + 左右サイドバー崩壊）= 共通テンプレート 3 ファイル参照で再起草必須

# 1. 緊急発見

東海林さんが tab-2 + tab-3 を実描画確認したところ、ヘッダー + 左右サイドバーが崩壊。tab-1 既稼働は正常表示。

| 観点 | tab-1（正常） | tab-2 修正版 / tab-3（崩壊）|
|---|---|---|
| topbar 内側構造 | `.topbar-brand` + `.search-box` + `.topbar-info` | `.topbar-left` + `.topbar-right`（独自）|
| nav-app-item | `<span class="nav-app-icon"><img></span><span class="nav-app-name">Bloom</span>` | `<img>` のみ |
| nav-page-item | `<span class="nav-page-icon">絵文字</span><span class="nav-page-label">名</span>` | 絵文字 + テキスト直書き |
| activity-panel 内 | `.activity-header` + `.activity-list`（`<ul>` + `<li class="activity-item">`）| `.activity-panel-head`（独自） |

→ tab-2 / tab-3 の HTML 構造は共通 CSS（`06_CEOStatus/css/style.css`）と不整合 = CSS が効かず崩壊。tab-1 既稼働の構造を厳格踏襲する必要あり。

# 2. 修正対象（2 件）

## 2-1. tab-2 修正版（forest-html-10 既存）
- 配置: `_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html`（既存、構造不整合あり）
- 修正方針: 既存 tab-2 mock 内容（KPI 行 / ワンビュー + レーダー横並び / 売上利益詳細）保持、外側構造（topbar / sidebar-dual / activity-panel）を tab-1 既稼働ベースに完全置換

## 2-2. tab-3 起草版（forest-html-11 起草済）
- 配置: `_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html`（main 配置、構造不整合あり）
- 修正方針: cashflow 4 セクション（銀行残高 / 月次 CF / 売掛買掛 / 入出金予定）保持、外側構造を tab-1 既稼働ベースに完全置換

# 3. 厳格踏襲対象（必須）

## 3-1. tab-1 既稼働 HTML
- 配置: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`（1561 行、既稼働）
- claude.ai は本ファイルを直接 Read で参照、構造ベースとして使用

## 3-2. 共通テンプレート 3 ファイル（main 抽出済、Drive 配置済）
- `_chat_workspace/_reference/garden-templates/garden-ui-topbar-template.md`（45 行 + 説明、4.5K）
- `_chat_workspace/_reference/garden-templates/garden-ui-sidebar-dual-template.md`（28 行 + nav-pages カスタマイズガイド、6.7K）
- `_chat_workspace/_reference/garden-templates/garden-ui-activity-panel-template.md`（64 行 + 6 法人カラー / 状態系アイコン表、3.7K）

→ Drive 経由で claude.ai が直接 Read 可能。

これら 3 ファイルは tab-1 既稼働 line 845-889 / 892-919 / 1421-1484 から抽出済、構造完全踏襲ベース。

# 4. 起草要件

## 4-1. 外側構造（必須完全踏襲、独自構造禁止）

| 構造 | 実装 |
|---|---|
| topbar | `<header class="topbar">` 内に `.topbar-brand` + `.search-box` + `.topbar-info`（`.info-item` x3 + `.header-tool-btn.theme-toggle` + `.header-tool-btn.header-notify-btn` + `.header-tool-btn.help-btn` + `.user-area`）|
| sidebar-dual | `<aside class="sidebar sidebar-dual" id="sidebarDual">` 内に `<nav class="nav-apps">`（12 モジュール `<a class="nav-app-item" data-app="..." data-status="..."><span class="nav-app-icon"><img></span><span class="nav-app-name">名</span></a>`）+ `<nav class="nav-pages">`（`.nav-pages-header` + `.nav-pages-divider` + 各 `.nav-page-item`（`<span class="nav-page-icon">絵文字</span><span class="nav-page-label">名</span>`）|
| sidebar-dual 直後 | `<button class="nav-pages-toggle" id="navPagesToggle">` |
| main | `<main class="main">` |
| activity-panel | `<aside class="activity-panel" id="activityPanel">` 内に `.activity-header`（`.activity-title` + `.activity-all`）+ `<ul class="activity-list">`（各 `<li class="activity-item">` 内に `.activity-time` + `.activity-icon` + `.activity-body`）+ `<button class="notify-btn">` |

## 4-2. 内側コンテンツ（モジュール固有、保持）

- tab-2: KPI 行 + ワンビュー + レーダー横並び + 6 法人 PNG + 売上利益詳細グラフ + Activity 6 件（mock v1 通り）
- tab-3: 4 セクション（銀行残高 / 月次 CF / 売掛買掛 / 入出金予定）+ Activity 6 件（cashflow 関連）

## 4-3. 必須遵守事項（8 件、tab-3 v1 と同様）

| # | 項目 |
|---|---|
| 1 | mock 忠実再現（独自セクション追加禁止）|
| 2 | 6 法人カラー厳守（CSS 変数経由）|
| 3 | Forest 緑系 5 階調（gf-deep/mid/bright/light/pale/mist/cream）|
| 4 | bg-forest-light.png / bg-forest-dark.png + dark theme サポート |
| 5 | プレフィックス: tab-2 は `gf-*` + `gf-summary-*` / tab-3 は `gf-cf-*` |
| 6 | レスポンシブ @max 1280px |
| 7 | Chart.js CDN 4.4.0 |
| 8 | ウサギ削除 |

## 4-4. 必須参照（必読、独自構造起草禁止）

| # | 対象 | Read 必須箇所 |
|---|---|---|
| 1 | tab-1-dashboard.html | line 845-889（topbar）/ line 892-925（sidebar-dual + toggle button）/ line 1421-1484（activity-panel）|
| 2 | garden-ui-topbar-template.md | 全文 |
| 3 | garden-ui-sidebar-dual-template.md | 全文 |
| 4 | garden-ui-activity-panel-template.md | 全文 |

# 5. 報告フォーマット（forest-html-12 + forest-html-13）

冒頭 3 行（🟢 forest-html-12 or 13 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

各 tab で独立 dispatch（forest-html-12 = tab-2 修正、forest-html-13 = tab-3 修正）or 1 dispatch にまとめても可。

### 件名
tab-2 / tab-3 構造修正版 HTML 完成

### 修正内容サマリ
- 修正前: 独自外側構造（topbar-left / topbar-right、nav-app-item に img のみ等）→ 共通 CSS と不整合で崩壊
- 修正後: tab-1 既稼働構造完全踏襲（topbar-brand / search-box / topbar-info、nav-app-item に span 入り構造等）→ 共通 CSS 適用で正常表示

### 構造踏襲確認（4 項目）
- tab-1 line 845-889 topbar 構造踏襲 ✅
- tab-1 line 892-925 sidebar-dual + toggle button 構造踏襲 ✅
- tab-1 line 1421-1484 activity-panel 構造踏襲 ✅
- 共通テンプレート 3 ファイル参照 ✅

### 内側コンテンツ保持確認
- tab-2: KPI / ワンビュー / レーダー横並び / 6 法人 PNG / 売上利益詳細
- tab-3: 銀行残高 / 月次 CF / 売掛買掛 / 入出金予定

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] tab-1 構造完全踏襲（独自構造禁止徹底）
- [x] 必須遵守事項 8 件全件チェック
- [x] HTTP server 起動で実描画確認推奨

# 6. 緊急度

🔴 高（Forest UI シフト根幹、tab-4-7 起草移行の前提、tab-3 視覚評価 main- No. 224 も本修正後に再評価必要）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 真因分析（共通 CSS と HTML 構造不整合）明示
- [x] 修正対象 2 件（tab-2 + tab-3）明示
- [x] 厳格踏襲対象 4 ファイル明示（tab-1 + テンプレ 3）
- [x] 起草要件 4-1 〜 4-4 明示
- [x] 報告フォーマット雛形提示
- [x] 番号 = main- No. 226（counter 継続）

# 東海林さんへ - コピーテキスト外

このテキストを claude.ai chat（Garden UI 021）に投下する際、以下の参考ファイル群すべて Drive 経由で claude.ai が Read 可能（添付指示不要、claude.ai に「下記 6 件を Read してから起草」と本 dispatch 内で指示済）。ただし、claude.ai が Drive 検索で見つけにくい場合、東海林さんが chat に直接アップロード添付する案も可:
- `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`（1561 行、tab-1 既稼働、構造ベース）
- `_chat_workspace/_reference/garden-templates/garden-ui-topbar-template.md`
- `_chat_workspace/_reference/garden-templates/garden-ui-sidebar-dual-template.md`
- `_chat_workspace/_reference/garden-templates/garden-ui-activity-panel-template.md`
- `_chat_workspace/_reference/garden-forest/ui-mocks/tab-2-financial-summary.png`（tab-2 mock）
- `_chat_workspace/_reference/garden-forest/ui-mocks/tab-3-cashflow.png`（tab-3 mock）
~~~
