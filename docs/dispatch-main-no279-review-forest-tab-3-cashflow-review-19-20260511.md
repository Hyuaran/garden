# dispatch main- No. 279 — a-review へ forest-html-20 (tab-3 cashflow) 配置完了 + review-19 依頼（tab-2 review-18 と並列、Bloom 横断 10 観点）

> 起草: a-main-022
> 用途: forest-html-20 (tab-3 キャッシュフロー Bloom 真祖先準拠修正版) 配置完了 + a-review review-19 で Bloom 横断 10 観点評価 + パターン B + 4 セクション + Root ミラーコメント維持確認
> 番号: main- No. 279
> 起草時刻: 2026-05-11(月) 16:25

---

## 投下用短文（東海林さんがコピー → a-review にペースト）

~~~
🟡 main- No. 279
【a-main-022 から a-review への dispatch（forest-html-20 配置完了 + review-19 tab-3 cashflow 依頼、tab-2 review-18 と並列）】
発信日時: 2026-05-11(月) 16:25

# 件名
forest-html-20 (tab-3 キャッシュフロー Bloom 真祖先準拠修正版) **配置完了** + a-review **review-19** で Bloom 横断 10 観点 実描画評価 + パターン B + 4 セクション + Root → Forest ミラーコメント維持確認 + tab-2 review-18 で発見済 3 bug が tab-3 にも該当するか横展開チェック

# A. forest-html-20 配置完了

| 項目 | 内容 |
|---|---|
| 配置パス | G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\chat-ui-forest-tab-3-cashflow-v1-20260511.html |
| ファイルサイズ | 約 35K |
| 配置時刻 | 2026-05-11(月) 16:25 |
| 修正キーワード | gf-summary-card / activity-toggle / page-favorite-btn / Today's Activity / Root → Forest ミラー 全件 含む |
| forest-html-19 (tab-2) | 別途配置済（review-18 # 275 で依頼中、並列評価可）|

# B. 4 セクション確認（forest-html-16 内側コンテンツ完全踏襲）

| # | セクション | 内容 |
|---|---|---|
| 1 | 銀行残高一覧 | 6 法人 × 口座 × 月次推移 sparkline + 構成比 bar + 全法人合計 ¥437,930,000 |
| 2 | 月次キャッシュフロー詳細 | 流入緑 / 流出青 積み棒 + 累積残高 黄折れ線 + 直近12か月/24か月 トグル |
| 3 | 売掛買掛サマリ | 6 法人 × 売掛/買掛/滞留度 3 区分（30/60/90 日）+ 合計、good/warn/danger/severe pill |
| 4 | 入出金予定スケジュール | 30 日間 + 期間合計 +¥53,450,000 / -¥39,630,000 |

→ パターン B（リンクサポート + たいよう cell 口座 2 削除）+ Root → Forest ミラー HTML コメント維持。

# C. Bloom 横断 10 観点（review-19 標準、tab-2 review-18 と同一）

| # | 観点 | 評価内容 |
|---|---|---|
| 1 | topbar（page-favorite-btn 含む）Bloom 06_CEOStatus 準拠 | bug-3 横展開チェック |
| 2 | sidebar-dual（nav-apps + nav-pages）Bloom 共通 | active=tab-3 確認 |
| 3 | activity-toggle（外側 + JS）Bloom 03_Workboard 完全踏襲 | bug-1 横展開チェック |
| 4 | activity-panel（Today's Activity / 画像 icon / 絶対時刻 / 動詞表現）Bloom 仕様 | bug-2 横展開チェック |
| 5 | gf-summary-card 一括 rename + 派生 class gf-cf-* 維持 | 5 keyword 全件確認 |
| 6 | 内側コンテンツ完全踏襲（4 セクション）| forest-html-16 ベース |
| 7 | 6 法人 PNG + 6 法人カラー | bug-2 関連 |
| 8 | Forest 緑系 CSS + 背景画像（bg-forest-light/dark.png） | PR #151 連動 |
| 9 | レスポンシブ @max 1280px | bottom-row → 1fr 切替 |
| 10 | Chart.js 4.4.0 動作（sparkline 6 + monthly CF bar/line）| 数値スケール v1 維持 |

# D. tab-2 で発見済 3 bug の横展開チェック（最重要）

review-18 で a-review が評価中の 3 bug は **tab-3 でも同様に発生** が想定:

## bug-1: 右サイドバー閉じれない
- tab-2 / tab-3 共通の activity-toggle JS / CSS rule 不在問題
- tab-3 でも同症状確認 = **横展開バグ確定**、修正は共通 CSS / JS 1 箇所で全タブ解決

## bug-2: Today's Activity カードカラー（6 法人色になっていない）
- tab-3 でも activity-icon = bloom_xxx.png（Bloom テーマ色）
- 仕様確認: tab-3 でも同じ 6 件 activity（bloom_ceostatus x3 / bloom_monthlydigest / bloom_workboard / bloom_dailyreport）
- 東海林さん期待値 = 6 法人色なら仕様変更（全タブ横断影響）

## bug-3: お気に入りボタン「壱」
- tab-3 でも同じ page-favorite-btn 実装
- 壱固有 or 全法人ボタン仕様問題 → tab-3 でも同症状確認

# E. review-19 実施手順

| Step | アクション |
|---|---|
| 1 | Chrome MCP で forest-html-20 (tab-3) 開く |
| 2 | 4 セクション内側コンテンツ確認（残高一覧 / 月次 CF / 売掛買掛 / 入出金予定）|
| 3 | tab-2 review-18 で発見済 3 bug の横展開チェック |
| 4 | Bloom precedent（06_CEOStatus index.html）と Chrome MCP で並列比較 |
| 5 | 10 観点で評価（◯ / △ / × + 詳細）|
| 6 | tab-3 固有 bug があれば原因特定 + 修正案提示 |
| 7 | review-19 報告（main 経由、~~~ ラップ）|

# F. tab-2 review-18 との関係

| 項目 | 内容 |
|---|---|
| 並列 / 直列 | 並列推奨（a-review 余力次第） |
| 共通 bug 修正 | 1 箇所修正で tab-1/2/3/4-7/8/6 モジュール HTML 全て解決 |
| 横展開報告 | review-19 で「tab-2 と同症状 = 共通 CSS/JS 修正で解決」明示 |

# G. 報告フォーマット（review-19）

冒頭 3 行（🟡 review-19 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 10 観点表 + 3 bug 横展開判定 + tab-3 固有 bug あれば原因特定 + 修正案コード行レベル明示。

軽量 ACK で済む場合（受領 + 着手宣言）は review-19-ack 表記、評価完了は通常採番。

# H. 緊急度

🟡 中（tab-3 評価、tab-2 と共通修正で効率化、5/12 デモ前 critical path 連動）

# I. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: forest-html-20 配置完了（パス + サイズ + 修正キーワード）
- [x] B: 4 セクション確認
- [x] C: Bloom 横断 10 観点
- [x] D: tab-2 review-18 3 bug の横展開チェック
- [x] E: review-19 実施手順
- [x] F: tab-2 review-18 との関係（並列推奨）
- [x] G: 完了報告フォーマット
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 279（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. tab-2 / tab-3 共通修正の効率化

- bug-1 / bug-2 / bug-3 が tab-3 でも該当する場合、修正は 1 箇所（共通 CSS / JS）で全タブ解決
- a-review review-18 / review-19 で「共通 bug 確認 → 1 修正で全タブ反映」推奨案出れば最効率

### 2. tab-3 固有の評価ポイント

- パターン B（リンクサポート + たいよう cell 口座 2 削除）が正しく反映されているか
- Root → Forest ミラー HTML コメントが `<main>` 直前に配置されているか
- 6 法人合計 ¥437,930,000 / 構成比 6 法人分が tab-3 でも一致しているか

### 3. 投下後の流れ

1. a-review review-19 着手（review-18 と並列）
2. 10 観点 + 3 bug 横展開 + tab-3 固有 bug 報告
3. 共通修正 → main 経由 claude.ai に修正版 (forest-html-21 候補) 依頼
4. tab-4-7 + 6 モジュール HTML 起草指示（修正反映後）
