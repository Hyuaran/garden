~~~
🔴 main- No. 264
【a-main-021 から claude.ai（Garden UI 021 chat）への dispatch】
発信日時: 2026-05-11(月) 14:30

# 件名
forest-html-Bloom-baseline-review 受領 + **東海林さん 3 点全部 OK + 起草着手 GO** + 判断保留 3 件回答（共通 CSS 提供前提 OK / 動詞形式 OK / 連続送信推奨）+ forest-html-18/19/20 連続送信開始指示

# A. 東海林さん最終確認 3 点 全部 OK

| 確認 | 東海林さん判定 |
|---|---|
| 1. 活動パネル収納ボタン「‹」追加（tab-1/2/3 全部）| ✅ **OK** |
| 2. 活動パネル中身 Bloom 化（英語タイトル / 画像 icon / 絶対時刻 / 動詞表現、Forest 経営指標テーマ維持）| ✅ **OK** |
| 3. お気に入りボタン「☆」追加（tab-1/2/3 全部）| ✅ **OK** |

→ 3 点とも GO、即起草着手お願いします。

# B. 判断保留 3 件 回答

## Q1: CSS 動作 共通 CSS 提供前提 OK か

✅ **OK**、共通 CSS（`015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css`）が Bloom 既稼働で機能している前提で **追加 CSS 重複定義しない方針**で進めてください。Forest 固有の `gf-*` プレフィックス CSS のみ inline 定義 OK。

## Q2: Forest Activity 6 件の動詞形式書き換え方針 OK か

✅ **OK**、forest-html-15/16 と同じテーマ（残高更新 / 法人別動向 / 売掛買掛 / 入出金予定 等）を維持しつつ、Bloom 動詞形式（「○○しました」「○○を更新しました」「○○を検出しました」等）に書き換えてください。

例:
- 旧: 「全法人合計残高 ¥437,930,000」（名詞）
- 新: **「全法人合計残高 ¥437,930,000 を更新しました」**（動詞、Bloom 整合）

## Q3: 3 ターン連続送信 or 1 件ずつ GO 待ちか

✅ **連続送信推奨**:
- forest-html-18（tab-1 修正版）→ 19（tab-2 修正版）→ 20（tab-3 修正版）を **3 ターン連続**送信
- main 側（私）でまとめて配置 + ls 物理確認 + a-review review-18 依頼
- 各 dispatch ごとに「次」「GO」合図不要、claude.ai は連続送信で OK
- ガンガン本質「東海林さん作業最小化」per、連続送信が運用効率最大

# C. 起草着手指示（forest-html-18 から 3 ターン連続）

## Step 1: forest-html-18（tab-1 修正版）

| 項目 | 内容 |
|---|---|
| 対象ファイル | `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`（既稼働、修正版で上書き）|
| ベース | tab-1 既稼働構造（forest-html-14 メモリ）+ Bloom 真祖先 03_Workboard 仕様 |
| 修正内容 | C-1 activity-toggle 追加 / C-2 activity-panel Bloom 化 / C-3 page-favorite-btn 追加 / C-4 gf-summary-card 既存維持（rename 不要、tab-1 は既使用）|

## Step 2: forest-html-19（tab-2 修正版）

| 項目 | 内容 |
|---|---|
| 対象ファイル | `_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html`（forest-html-15、修正版で上書き）|
| ベース | forest-html-15 構造 + Bloom 03_Workboard 仕様 |
| 修正内容 | C-1/C-2/C-3/C-4（gf-card → gf-summary-card rename + CSS 値差し替え）|

## Step 3: forest-html-20（tab-3 修正版）

| 項目 | 内容 |
|---|---|
| 対象ファイル | `_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html`（forest-html-16、修正版で上書き）|
| ベース | forest-html-16 構造（パターン B 反映済 + 4 セクション）+ Bloom 03_Workboard 仕様 |
| 修正内容 | C-1/C-2/C-3/C-4 + パターン B データ修正保持 + 4 セクション完全保持 + Root ミラー HTML コメント保持 |

# D. 必須遵守事項（main- No. 249 v2 §F 10 件、再確認）

| # | 項目 |
|---|---|
| 1 | activity-toggle ボタン追加（class + id + aria-expanded + 初期化 JS + click handler + localStorage 連動、Bloom 03_Workboard 完全踏襲）|
| 2 | activity-title「Today's Activity」**英語化**（Bloom 5 + Bud 10 = 15 画面統一）|
| 3 | activity-icon **画像 `<img>` 化**（bloom_xxx.png アイコンパック使用、bloom_ceostatus.png 主軸 + bloom_workboard.png / bloom_dailyreport.png / bloom_monthlydigest.png / bloom_bloomtop.png テーマ別混在）|
| 4 | activity-time **絶対時刻化**（「11:30」形式）+ activity 内容を **動詞形式**（「○○しました」、Forest 経営指標テーマ維持）|
| 5 | page-favorite-btn 追加（topbar 右側、help-btn と user-area の間 or 同等位置、Bloom 06_CEOStatus 完全踏襲、toast / localStorage 連動）|
| 6 | gf-card → gf-summary-card 一括 rename + CSS 定義値 tab-1 準拠（tab-2/3 のみ、tab-1 は既使用）|
| 7 | tab-1 既稼働構造（topbar / sidebar-dual / activity-panel）+ 各種既存要素（forest-html-15/16 維持）|
| 8 | 6 法人カラー / Forest 緑系 / レスポンシブ @max 1280px 維持 |
| 9 | Root → Forest ミラー HTML コメント保持（tab-3 `<main>` 直前）|
| 10 | tab-3 パターン B データ修正保持（リンクサポート / たいよう cell 口座 2 削除、合計 ¥437,930,000 / 構成比 6 法人分維持）+ 4 セクション完全保持 |

# E. 報告フォーマット（各 forest-html-18/19/20）

冒頭 3 行（🟢 forest-html-XX / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック以外不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）+ HTML 全文を ` ```html ~ ``` ` ブロック内 + 必須遵守 10 件チェックリスト + self-check + 状態冒頭明示（[稼働中、ガンガンモード継続]、~~~ 外）+ Bloom 03_Workboard 参照済明示。

# F. 緊急度

🔴 高（後道さんデモ前 critical path、5/12 デモ前完成必須、forest-html-18/19/20 完了 → review-18 → tab-4-7 + 6 モジュール起草へドミノ式展開）

# G. 期待される連動

forest-html-18/19/20 全完了 → main 側で配置 + ls 確認 → a-review に review-18 依頼（Bloom 横断 10 観点 実描画評価）→ 採用 GO → tab-4-7 + tab-8 + 「準備中」6 モジュール（Fruit / Seed / Sprout / Calendar / Rill / Leaf）の HTML 起草指示（main- No. 後続、6 件並行起草想定）。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 3 点全部 OK 明示（東海林さん最終決裁）
- [x] B: 判断保留 3 件回答（Q1 共通 CSS / Q2 動詞形式 / Q3 連続送信）
- [x] C: forest-html-18/19/20 起草着手指示（3 step）
- [x] D: 必須遵守 10 件再確認
- [x] E: 報告フォーマット
- [x] F: 緊急度 🔴 明示
- [x] G: 連動（review-18 → tab-4-7 + 6 モジュール）
- [x] 番号 = main- No. 264（counter 継続）
~~~
