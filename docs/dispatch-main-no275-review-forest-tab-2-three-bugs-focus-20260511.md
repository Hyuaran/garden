# dispatch main- No. 275 — a-review へ forest-html-19 (tab-2) 配置完了 + 東海林さん視覚発見 3 bug 焦点込み review-18 依頼

> 起草: a-main-022
> 用途: forest-html-19 (tab-2) Bloom 真祖先準拠修正版 配置完了 + 東海林さん視覚発見 3 bug を焦点に Bloom 横断 10 観点で review-18 評価
> 番号: main- No. 275
> 起草時刻: 2026-05-11(月) 16:10

---

## 投下用短文（東海林さんがコピー → a-review にペースト）

~~~
🔴 main- No. 275
【a-main-022 から a-review への dispatch（forest-html-19 配置完了 + 東海林さん視覚発見 3 bug 焦点込み review-18 依頼）】
発信日時: 2026-05-11(月) 16:10

# 件名
forest-html-19 (tab-2 財務サマリー Bloom 真祖先準拠修正版) **配置完了** + **東海林さん視覚発見 3 bug を焦点として** Bloom 横断 10 観点 実描画評価 + Chrome MCP 比較 + 原因特定 + 修正案提示

# A. forest-html-19 配置完了

| 項目 | 内容 |
|---|---|
| 配置パス | G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-2-financial-summary.html |
| ファイルサイズ | 約 38K |
| 配置時刻 | 2026-05-11(月) 16:00 |
| Bloom 4 項目修正キーワード grep | 28 件ヒット（gf-summary-card / activity-toggle / page-favorite-btn / Today's Activity 全件確認）|
| preview panel | Launch preview panel に表示中（東海林さん視覚確認可能）|
| forest-html-20 (tab-3) | 別途連続送信中（受領後 別 dispatch で配置 + review 依頼予定）|

# B. 東海林さん視覚発見 3 bug（最優先焦点）

forest-html-19 配置後、東海林さん視覚で以下 3 bug を発見:

## B-1. 🐛 bug-1: 右サイドバー閉じれない

- 観察: activity-toggle ボタン押しても activity-panel が閉じない
- 想定原因: 
  - (a) activity-toggle JS イベントハンドラー動作不良
  - (b) CSS `body.activity-collapsed .activity-panel { display: none }` 等の rule 不在 or 上書きされている
  - (c) Bloom 共通 CSS（06_CEOStatus/css/style.css）の `body.activity-collapsed` rule 未定義
  - (d) localStorage `garden_activity_collapsed` の値設定 + DOM class toggle ロジック不整合
- review 観点: JS イベント発火確認 + CSS rule 確認 + Bloom 共通 CSS との整合性確認

## B-2. 🐛 bug-2: Today's Activity カードカラー（6 法人色になっていない）

- 観察: Today's Activity リストのカラー / アイコンが 6 法人カラー（ヒュアラン pink / ARATA orange 等）ではない
- 想定原因:
  - (a) Bloom 03_Workboard / 06_CEOStatus precedent では activity-icon = bloom_xxx.png（monthlydigest / ceostatus / workboard / dailyreport）= Bloom テーマ色（緑系）が正
  - (b) 東海林さん期待値 = 「6 法人カラーで活動内容を表示すべき」（仕様解釈の違い）
  - (c) または、forest-html-19 で bloom_xxx.png アイコンを参照しているが、Bloom テーマ色 ≠ Forest テーマ色 / 6 法人色 となり統一感欠如
- review 観点: 
  - 仕様解釈確認（Bloom precedent = bloom_xxx.png か、Forest tab-2 = 6 法人色か）
  - 仕様逸脱 = bug、仕様準拠 = 仕様変更提案候補
  - 後者なら東海林さん最終決裁要請

## B-3. 🐛 bug-3: お気に入りボタン「壱」アイコンおかしい

- 観察: お気に入りボタン（topbar 右側、help-btn と user-area の間）の表示 or 機能で「壱」関連の不整合
- 想定原因:
  - (a) page-favorite-btn の icon 表示で壱（6 法人の 1 つ、配色 #C0392B）が反映されていない
  - (b) お気に入りボタン自体は法人別 icon を持たない想定（Bloom 06_CEOStatus precedent）→ 東海林さん期待値と仕様の乖離
  - (c) localStorage `garden_page_favorites` の値で「壱」固有 page key が表示崩れ
- review 観点: 
  - お気に入りボタンの仕様（Bloom precedent）と現実装の差分
  - 壱（ichi）固有の表示崩れ箇所特定（Chrome MCP screenshot）
  - 東海林さん発言 = 「お気に入りボタンの壱もおかしい」→ 「壱」が key 要素であることを確認

# C. Bloom 横断 10 観点（review-18 標準）

3 bug 焦点に加え、Bloom 横断 10 観点で実描画評価:

| # | 観点 | 評価内容 |
|---|---|---|
| 1 | topbar（page-favorite-btn 含む）Bloom 06_CEOStatus 準拠 | bug-3 関連、最重要 |
| 2 | sidebar-dual（nav-apps + nav-pages）Bloom 共通 | active=tab-2 確認 |
| 3 | activity-toggle（外側 + JS）Bloom 03_Workboard 完全踏襲 | bug-1 関連、最重要 |
| 4 | activity-panel（Today's Activity / 画像 icon / 絶対時刻 / 動詞表現）Bloom 仕様 | bug-2 関連、最重要 |
| 5 | gf-summary-card 一括 rename + CSS 値 tab-1 準拠 | 28 grep ヒット確認済 |
| 6 | 内側コンテンツ完全踏襲（KPI 3 + ワンビュー + レーダー + 詳細チャート）| forest-html-15 ベース |
| 7 | 6 法人 PNG（emoji 廃止）+ 6 法人カラー | bug-2 関連 |
| 8 | Forest 緑系 CSS + 背景画像（bg-forest-light/dark.png） | PR #151 連動 |
| 9 | レスポンシブ @max 1280px | grid → 1fr 切替 |
| 10 | Chart.js 4.4.0 動作（radar / spark / detail）| 数値スケール v1 維持 |

# D. review-18 実施手順

| Step | アクション |
|---|---|
| 1 | Chrome MCP で forest-html-19 (tab-2) 開く（パス: G:\マイドライブ\...\tab-2-financial-summary.html）|
| 2 | 3 bug 焦点で実描画確認（bug-1: サイドバー閉じ操作 / bug-2: Today's Activity 配色 / bug-3: お気に入りボタン壱）|
| 3 | Bloom precedent（06_CEOStatus index.html）と Chrome MCP で並列比較 |
| 4 | 10 観点で評価（◯ / △ / × + 詳細）|
| 5 | 3 bug 原因特定 + 修正案提示（コード行レベル）|
| 6 | review-18 報告（main 経由、~~~ ラップ）|

# E. tab-3 (forest-html-20) との関係

| 項目 | 状態 |
|---|---|
| forest-html-20 (tab-3) | 連続送信中（# 271 で催促済、受領待ち）|
| 配置 + review 依頼 | 受領後 別 dispatch（main- No. 277+ 候補）|
| 本 review-18 のスコープ | **tab-2 のみ** 先行評価、tab-3 は別 review-19 で実施 |

# F. 完了報告フォーマット（review-18）

冒頭 3 行（🔴 review-18 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 10 観点表 + 3 bug 原因特定 + 修正案コード行レベル明示。

軽量 ACK で済む場合（受領 + 着手宣言のみ）は review-18-ack 表記、評価完了は通常採番。

# 緊急度

🔴 高（東海林さん視覚発見 3 bug = tab-3/4/5/6/7/8 + 6 モジュール準備中 HTML 起草の前に修正方針確定必須、5/12 デモ前 critical path）

# G. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: forest-html-19 配置完了（パス + サイズ + grep 検証）
- [x] B: 3 bug 焦点 詳細（観察 + 想定原因 + review 観点）
- [x] C: Bloom 横断 10 観点
- [x] D: review-18 実施手順 6 step
- [x] E: tab-3 との関係（review-19 で別実施）
- [x] F: 完了報告フォーマット
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 275（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 3 bug の優先度判定（参考）

| bug | 影響範囲 | 緊急度 |
|---|---|---|
| bug-1 (サイドバー閉じれない) | tab-2/3/4/5/6/7/8 全タブ共通 | 🔴 最緊急（横断影響）|
| bug-2 (Today's Activity 配色) | tab-2/3/4/5/6/7/8 全タブ共通（仕様確認後）| 🟡 中（仕様 vs bug 切り分け先決）|
| bug-3 (お気に入り「壱」) | 全タブ共通（topbar 内）| 🟡 中（壱固有 or 全法人）|

→ bug-1 が最緊急、a-review が修正案提示 → claude.ai forest-html-21+ で適用 or main 経由直接修正。

### 2. 東海林さん発見の評価（参考）

memory `feedback_self_visual_check_with_chrome_mcp` 準拠で、a-review review-18 で客観評価する設計だったが、東海林さんが先に発見 = 視覚評価の貴重情報。a-review はこれを 「現物 = ground truth」として活用可能。

### 3. 投下後の流れ（参考）

1. a-review review-18 着手（Chrome MCP 開く + 3 bug 焦点評価）
2. review-18 報告（10 観点 + 3 bug 原因特定 + 修正案）
3. main → 修正方針確定（東海林さん採択）
4. claude.ai forest-html-21+ で適用 or main で直接 patch
5. 修正反映 → review-19（tab-3 同時 or 単独）

### 4. 注意点

- forest-html-19 は東海林さんが Launch preview panel で見ているので、a-review は Chrome MCP で再現可能（同一ファイル）
- preview panel ≠ 本番ブラウザ表示の可能性（preview tool の制約）→ Chrome MCP で再現が望ましい
