~~~
🟡 main- No. 224
【a-main-020 から a-review への dispatch】
発信日時: 2026-05-11(月) 10:40

# 件名
tab-3 cashflow（forest-html-11）視覚評価依頼

# 1. 経緯

claude.ai が main- No. 221 受領 → tab-3 cashflow HTML 起草完了（forest-html-11、2026-05-11 10:42 発信）。a-main-020 が `_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html` に配置完了（2026-05-11 10:40、ls 物理確認済）。

# 2. 評価対象

## 2-1. 配置済ファイル
- HTML: `_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html`
- mock 画像: `_chat_workspace/_reference/garden-forest/ui-mocks/tab-3-cashflow.png`（2.1MB）

## 2-2. 起草内容サマリ（forest-html-11）
- 構造: header(topbar) + 左 sidebar-dual + 右 activity-panel + main(cashflow 4 セクション)
- 4 セクション: 銀行残高一覧 / 月次キャッシュフロー詳細 / 売掛買掛サマリ / 入出金予定スケジュール
- プレフィックス: gf-* + gf-cf-*
- Chart.js: 4.4.0 CDN
- ウサギ削除済

# 3. 評価観点（共通 7 + tab-3 独自 4 = 11 項目）

## 3-1. 共通観点（tab-2 review-11 と同等）

| # | 観点 | 確認事項 |
|---|---|---|
| 1 | mock v1 との忠実性 | 4 セクション全て mock 通り、独自追加なし |
| 2 | レンダリング正常性 | preview tool / Chrome MCP load OK、外部 CSS / 画像 / Chart.js 参照先確認 |
| 3 | 6 法人カラー厳守 | ヒュアラン / センターライズ / リンクサポート / ARATA / たいよう / 壱 全 CSS 変数経由 |
| 4 | サイドバー構造 | 左 sidebar.sidebar-dual（nav-apps 12 + nav-pages 8）+ 右 activity-panel、tab-1 / tab-2 修正版と完全統一 |
| 5 | nav-pages active = cashflow | tab-3 が active 表示 |
| 6 | 既存 tab-1 / tab-2 との一貫性 | gf-* CSS 変数 / Forest 緑系 5 階調 / bg-forest-light + dark / レスポンシブ @1280px |
| 7 | self-prep（前期教訓） | preview tool / Chrome MCP load + 接続テスト先行 |

## 3-2. tab-3 独自観点（4 項目）

| # | 観点 | 確認事項 |
|---|---|---|
| 8 | 4 セクション忠実性 | 銀行残高一覧（6 法人 × 口座 2 件 × 月次推移 sparkline + 構成比 bar）/ 月次 CF 詳細（流入緑棒 + 流出青棒 + 累積残高黄折れ線）/ 売掛買掛サマリ（6 法人 × 売掛/買掛/滞留度 30/60/90 日）/ 入出金予定スケジュール（30 日間） |
| 9 | Chart.js 4 種類 chart 動作 | spark line 6 件（balance）/ combo (bar stack + line)（monthly CF）/ Chart.js CDN 4.4.0 ロード正常 |
| 10 | データ整合性 | 銀行残高合計 ¥437,930,000 = 6 法人合計と一致 / 売掛買掛合計 ¥215,730,000 + ¥106,820,000 = 6 法人合計 / 期間合計 +¥53,450,000 / -¥39,630,000 = 10 件合計 |
| 11 | 滞留度 pill 色分け | good (≤80%) / warn (60-30%) / danger (≤10%) / severe (>10%) の閾値妥当性 |

# 4. 報告フォーマット（review-12）

冒頭 3 行（🟢 review-12 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
tab-3 cashflow（forest-html-11）視覚評価結果

### 評価結果サマリ
| 観点 | 判定（採用 / 要修正 / 軽微 NG / 重大 NG）| 詳細 |
|---|---|---|

### 観点ごとの詳細（共通 7 + tab-3 独自 4）

### 採否総合
- 採用推奨 / 要修正 / 重大 NG 件数

### claude.ai 修正依頼候補（あれば）
- 修正論点 + 推奨度

### tab-4 / tab-5 / tab-6 / tab-7 / tab-8 起草移行可否
- 本評価で tab-3 採用 OK なら tab-4 business-kpi 起草移行 GO

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 11 観点全件評価実施
- [x] self-prep（preview tool / Chrome MCP）先行確認

# 5. 緊急度

🟡 中（Forest UI シフト第 2 弾の動作確認、tab-4-7 起草移行の前提）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 配置済ファイル パス明示（ls 物理確認済）
- [x] 評価観点 11 項目（共通 7 + tab-3 独自 4）明示
- [x] 報告フォーマット (review-12) 雛形提示
- [x] 番号 = main- No. 224（counter 継続）
~~~
