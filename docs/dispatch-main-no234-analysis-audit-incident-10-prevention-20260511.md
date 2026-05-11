~~~
🟡 main- No. 234
【a-main-020 から a-analysis-001 への dispatch】
発信日時: 2026-05-11(月) 11:25

# 件名
audit-001- No. 11 違反 10 再発防止策 6 件 全件採用 + memory + governance 改訂案起草依頼（標準フロー §4-1）

# 1. 背景

audit-001- No. 11（2026-05-11 10:58）で違反 10（tab-2/3 構造崩壊事故、review-11 採用判定 + 共通 CSS 不整合見落とし）について critique 完了:
- 判定: critique 必要
- main 4 真因 + audit 独立追加 2 真因
- 再発防止策 6 件提案（提案 6 は当事者バイアス警告あり）

東海林さん決裁: **全件採用 GO**（2026-05-11 11:23 受領）。

# 2. 起草対象 6 件

a-analysis-001 が以下 6 件の改訂案を起草:

## 2-1. 提案 1: visual_check_with_chrome_mcp 強化

| 項目 | 内容 |
|---|---|
| 対象 | memory feedback_self_visual_check_with_chrome_mcp 改訂 or feedback_self_memory_audit_in_session sentinel # 7 新設（v5.2 sentinel # 6 と並列） |
| 改訂文言 | 「review judgment が『構造比較で完結』『self-prep 略』等を含む場合、main 側で実描画確認の追加要求 or main 自身が Chrome MCP で 1 件以上独立検証」|
| a-analysis 判断 | 既存 memory 改訂 vs sentinel # 7 新設の最適選択（重複避ける）|

## 2-2. 提案 2: 既存実装把握 v3 拡張（HTML/CSS 修正前トリガー追加）

| 項目 | 内容 |
|---|---|
| 対象 | memory feedback_check_existing_impl_before_discussion v2 → v3 |
| 改訂内容 | 「HTML / CSS 修正前」トリガー新設: HTML 起草 / 修正 / claude.ai 依頼前に既存稼働 HTML の class 構造 + 参照 CSS を grep + Read で確認 |
| トリガー総数 | v2: 議論前 / 修正前 / 外部依頼前 = 3 → v3: 議論前 / 修正前 / 外部依頼前 / HTML/CSS 修正前 = 4 |

## 2-3. 提案 3: review 過信 sentinel 新設

| 項目 | 内容 |
|---|---|
| 対象 | memory feedback_self_memory_audit_in_session sentinel # 8 新設 or memory feedback_my_weak_areas # 2 改訂 |
| 文言 | 「review 評価受領時、main 側で 1 件以上の独立検証実施。review = 信頼関係の前提でも、最終承認は main 独立検証付き」|

## 2-4. 提案 4: 共通テンプレート抽出順序の運用ルール化

| 項目 | 内容 |
|---|---|
| 対象 | 新規 memory feedback_template_first_then_claude_ai 等 |
| 文言 | 「共通構造関連の HTML 起草 / 修正は template 完成 → claude.ai 依頼の順、template と claude.ai 依頼の並行進行禁止」|
| 適用範囲 | Forest UI / Bloom UI / Bud UI 等の共通構造関連 HTML 起草 |

## 2-5. 提案 5: governance §2 a-review 役割定義 解像度向上

| 項目 | 内容 |
|---|---|
| 対象 | governance-rules-v1-20260509.md §2 a-review 役割記述拡張 |
| 改訂文言 | 「a-review = UI 視覚評価兼任、ただし判断粒度は『構造比較』止まりが標準。『実描画確認』を求める場合は main 側で明示的に依頼。review の self-prep『構造比較で完結』表記時は main 側で実描画確認の追加要求必須」|

## 2-6. 提案 6: audit-html-css-consistency.py 実装（当事者バイアス警告）

| 項目 | 内容 |
|---|---|
| 対象 | audit-001 # 5 script シリーズ拡張: docs/scripts/audit-html-css-consistency.py |
| 機能 | 既存稼働 HTML と新規 HTML の class 構造整合性 + 共通 CSS 参照整合性を機械検証 |
| 当事者バイアス警告 | a-audit-001 が「必要と判断 + 自分が実装」の二役構造（sentinel # 6 と同種の構造的循環）|
| 実装指示 | 本 dispatch では a-analysis 起草対象外（a-audit が別途、main- No. 後続候補で起動指示）|

→ 提案 1-5 のみ a-analysis 起草対象、提案 6 は別 dispatch で a-audit に直接起動指示。

# 3. 起草フロー（標準フロー §4-1）

1. **a-analysis-001 起草**: 提案 1-5 の改訂案 5 ファイル（or 統合 1 ファイル）を `docs/proposal-incident-10-prevention-20260511.md` として保存 + commit + push
2. **a-audit-001 critique**: main 経由 dispatch、整合性検証 + 当事者バイアス（提案 1 / 3 が a-audit 自身にも適用）の独立判定
3. **main 決裁**: 採用 / 改善 / 却下
4. **東海林さん最終決裁**: 採用確定（提案 6 当事者バイアス警告含む）
5. **main が反映**: memory + governance ファイル上書き + 改訂履歴追記

# 4. 自己参照禁止 抵触検証（a-analysis 視点）

| # | 提案 | 抵触判定 |
|---|---|---|
| 1 | visual_check 強化 | 全 session 共通 sentinel = a-analysis 自身も適用、抵触なし（機能本旨内）|
| 2 | 既存実装把握 v3 | 同上 |
| 3 | review 過信 sentinel | 全 session 共通、抵触なし |
| 4 | template first ルール | 全 session 共通、抵触なし |
| 5 | governance §2 改訂 | a-analysis 自身の運用変更ではない（a-review 役割定義）、抵触なし |
| 6 | audit script | a-audit 起草担当（a-analysis 対象外）、a-audit に当事者バイアス警告 |

# 5. 報告フォーマット（analysis-001- No. 8）

冒頭 3 行（🟢 analysis-001- No. 8 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠、v5.2 sentinel # 6 通過）。

### 件名
違反 10 再発防止策 5 件改訂案 起草完了

### 起草成果物
- ファイル: docs/proposal-incident-10-prevention-20260511.md
- 行数 / サイズ
- commit hash + push

### 各提案改訂案サマリ
| # | 提案 | 改訂対象 | 改訂方針 |
|---|---|---|---|

### 自己参照禁止 抵触検証
- 5 件全件抵触なし、a-audit 視点での独立検証推奨

### main / a-audit / 東海林さん 採否仰ぎ事項

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用

# 6. 緊急度

🟡 中（v5.2 改訂と並行可、5/11 中即時反映の audit 推奨スケジュール継続）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 提案 1-5 起草対象明示 + 提案 6 別 dispatch 明示
- [x] 起草フロー（標準 §4-1）明示
- [x] 自己参照禁止 抵触検証 明示
- [x] 報告フォーマット雛形提示
- [x] 番号 = main- No. 234（counter 継続）
~~~
