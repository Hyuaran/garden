~~~
🟡 main- No. 245
【a-main-021 から a-bloom-006 への dispatch】
発信日時: 2026-05-11(月) 12:18

# 件名
bloom-006- No. 6 受領（PR #154 採用推奨）+ PR #154 merge GO + 軽微改善 2 件 別 PR 一括対応方針 + PR #155 review 依頼

# A. bloom-006- No. 6 受領

PR #154（Batch 7 cross-rls-helpers）7 観点 review 完走 + 採用推奨 + 軽微改善 2 件、ありがとうございます。

7 観点全件 ✅ + spec §6.1 v2 / §9 改訂評価 + Tree Phase D §0 着手前提条件解消への寄与確認、trace 完璧です。

# B. PR #154 merge GO

採用 GO、PR #154 merge 進行 OK。

軽微改善 2 件への方針:

| # | 改善 | 方針 |
|---|---|---|
| 1 | SECURITY DEFINER 関数の `SET search_path = ''` 明示 | ✅ **別 PR 一括対応**（PR #154 merge 阻害なし、A-1c v3.2 known-pitfalls # 9 系を別 PR で一括対応） |
| 2 | apply 後動作確認 SQL の runbook 化 | ✅ **任意、別途検討**（PR #154 merge 阻害なし、runbook 化の必要性は apply 結果次第） |

→ 軽微改善 2 件は merge 後 別途タスク化、PR #154 merge は即進行可。

merge 後フロー:
1. garden-dev apply → 動作確認
2. garden-prod apply
3. a-tree-002 Tree D-01 spec §4 適用（PR #155 + PR #128 SQL 修正）

# C. PR #155 review 依頼（新規）

a-tree-002 が main- No. 238 受領 → tree-002- No. 22 で Tree D-01 spec §4 改訂 + 別 PR #155 起票完了。

レビュー対象:

| 項目 | 内容 |
|---|---|
| PR 番号 | **PR #155** |
| URL | https://github.com/Hyuaran/garden/pull/155 |
| base | develop |
| head | feature/tree-spec-d01-rls-self-only-20260511 |
| title | docs(tree): spec D-01 §4 RLS 改訂 — is_same_department 縮退対応（main- No. 238）|
| 差分 | +32 -7（1 ファイル）|

レビュー観点（spec 改訂のみ、SQL なし、軽量）:

| # | 観点 | 内容 |
|---|---|---|
| 1 | §4.1 改訂 trace | is_same_department 削除 → auth_employee_number() 縮退、Batch 7 PR #154 整合性 |
| 2 | §4.2 / §4.3 v3.1 縮退注記 | 「manager+ も同様、縮退中」明示の妥当性 |
| 3 | §12 改訂履歴 | v1.0 → v1.1 改訂理由（main- No. 238 起源）明示の妥当性 |
| 4 | 将来再導入条件 3 点 | department_id 列 + マスタ + 運用ルール確定 の網羅性 |
| 5 | PR #128 SQL 本体との整合性 | SQL ファイル本体修正（別 PR 予定）との対応関係明示の妥当性 |

期待粒度: spec 改訂のみのため軽量、5-10 分程度を想定。

# D. PR #154 merge 後の連動（a-bloom-006 内）

| Step | 内容 |
|---|---|
| 1 | PR #154 merge | 東海林さん最終判断後 |
| 2 | PR #150 / #147 / #152 merge | 東海林さん最終判断後（並行） |
| 3 | PR #148 / #149 review 継続 | 既着手、bloom-006- No. 7 候補 |
| 4 | PR #155 review | 本 dispatch C 依頼分 |
| 5 | unrelated 14 test 別 issue 起票 | 任意、優先度低 |

# E. 進捗共有（参考）

bloom-006 受領 dispatch 履歴（直近）:
- bloom-006- No. 4: main- No. 214 → PR #127 review（先行検出 + 既対応）
- bloom-006- No. 5: main- No. 218 → PR # 番号訂正受領
- bloom-006- No. 6: main- No. 241 → PR #154 採用推奨（本受領）
- bloom-006- No. 7: main- No. 245（本 dispatch） → PR #155 review

# 緊急度

🟡 中（PR #154 merge GO + PR #155 新規 review、Tree Phase D §0 着手前提条件解消の流れ継続）

# 報告フォーマット（bloom-006- No. 7 以降）

冒頭 3 行（🟢 bloom-006- No. 7 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A セクション（# 6 受領 + 採用推奨確認）
- [x] B セクション（PR #154 merge GO + 軽微改善 2 件方針）
- [x] C セクション（PR #155 新規 review 依頼）
- [x] D セクション（merge 後連動 5 step）
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 245（counter 継続）
~~~
