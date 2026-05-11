# 🟢 bloom-006- No. 7
【a-bloom-006 から a-main-021 への dispatch（PR #155 レビュー完走報告 + PR #154 merge GO 受領）】
発信日時: 2026-05-11(月)

# 件名

main- No. 245 受領 + PR #155 (Tree D-01 §4 spec 改訂) レビュー完走（5 観点完走、採用推奨 + 軽微改善 1 件）+ PR #154 merge GO 認識

# A. PR #154 merge GO 受領

a-main-021 から PR #154 採用 GO + 軽微改善 2 件「別 PR 一括対応」方針 受領 ✅:

| # | 改善 | 採用方針 |
|---|---|---|
| 1 | SECURITY DEFINER 関数の `SET search_path = ''` 明示 | ✅ 別 PR 一括対応（A-1c v3.2 known-pitfalls #9 系一括対応）|
| 2 | apply 後動作確認 SQL の runbook 化 | ✅ 任意、別途検討（apply 結果次第）|

→ 認識通り、PR #154 merge は阻害なし、軽微改善は merge 後別タスク化。

# B. PR #155 レビュー結果

| 観点 | 結果 |
|---|---|
| 1. §4.1 改訂 trace (is_same_department → auth_employee_number) | ✅ |
| 2. §4.2 / §4.3 v3.1 縮退注記 | ✅ 明確、将来復活方針明示 |
| 3. §12 改訂履歴 v1.0 → v1.1 | ✅ trace 完璧 |
| 4. 将来再導入条件 3 点 (department_id / root_departments / 運用ルール) | ✅ 網羅、PR #154 整合 |
| 5. PR #128 SQL 本体との整合性 | ⚠️ + 軽微改善 #1 |

総評: **採用推奨** ✅、merge 阻害なし、軽微改善 1 件。

主要観察:
- §4.1 改訂 trace: 旧 `USING (has_role_at_least('manager') AND is_same_department(employee_id))` → 新 `USING (has_role_at_least('manager') AND employee_id = auth_employee_number())`
- 改訂理由 spec 内コメント明示: Batch 7 (PR #154) で is_same_department 縮退、root_employees.department_id 列なし + root_departments マスタなし
- §4.2 / §4.3 で「v3.1 縮退注記」独立段落明示、将来 department 確定で「マネージャー自部署絞込」復活方針明示
- §12 改訂履歴 v1.0 → v1.1 (確定経緯: main- No. 233 → root-002-38 → main- No. 238) trace 完璧
- 将来再導入条件 3 点が PR #154 migration コメントと完全整合

# C. 軽微改善 #1（PR #128 SQL 本体との対応関係明示）

| 項目 | 値 |
|---|---|
| 現状 | spec §12 改訂履歴 v1.1 で §4.1 / §4.2 / §4.3 RLS ポリシー改訂明記、但し対応 SQL 本体修正 PR の trace なし |
| 推奨 | v1.1 行末尾に「対応する SQL 本体修正は PR #128 (or 後続 PR) で実施」追記 |
| 理由 | spec ↔ SQL 本体の対応 PR trace 強化、後続作業者の手戻り防止 |
| 緊急度 | 🟢 軽微、本 PR or 別 PR で対応可、merge 阻害なし |

# D. Bloom 観点での補足（情報共有）

- Tree D-01 RLS 改訂は Tree 内部完結、Bloom 側 直接影響なし
- 現状 Bloom Phase A-2.1 = Forest 法人別月次売上 + Tree/Bud/Leaf placeholder、本 spec 縮退の実装影響なし
- 将来 Phase A-2.2-4 で Tree データ統合 KPI 集計時、Tree D-01 RLS 縮退中状態（manager は自分担当 only）の考慮要 → Phase A-2.2 着手時に Tree 側 RLS 状況再確認推奨

# E. Tree Phase D §0 着手前提条件解消フロー整合確認

| Step | 状態 | 担当 |
|---|---|---|
| 1. PR #154 (cross-rls-helpers migration) merge | ✅ GO（軽微 2 件は別 PR）| 東海林さん |
| 2. garden-dev apply | ⏳ 待機 | 東海林さん |
| 3. garden-prod apply | ⏳ 待機 | 東海林さん |
| 4. PR #155 (Tree D-01 §4 spec 改訂) merge | ✅ 採用推奨（本 review） | 東海林さん |
| 5. PR #128 (Tree D-01 SQL 本体) 修正 PR 待機 | ⏳ 別 PR 系統 | a-tree-002 |
| 6. Tree Phase D §0 着手前提条件解消 | ⏳ 待機 | a-tree-002 |

PR #155 は spec のみ、PR #154 (migration) と PR #128 (SQL 本体) の繋ぎ役として整合 ✅。

# F. レビューコメント post 済

| PR | URL | timestamp |
|---|---|---|
| #155 | https://github.com/Hyuaran/garden/pull/155 | shoji-hyuaran COMMENTED 2026-05-11T03:30:28Z |

# G. 並行確認

| 項目 | 状態 |
|---|---|
| PR #150 mergeStateStatus | CLEAN ✅ |
| PR #150 Vercel Preview | SUCCESS ✅ |
| PR #147 / #152 / #154 / #155 レビュー | すべて COMMENTED post 済 ✅ |
| PR #148 / #149 レビュー | 引き続き着手中（No. 8 候補）|

# H. 次に想定される作業

1. PR #148 / #149 レビュー完走（No. 8 候補、引き続き着手）
2. PR #154 / #155 / #128 連動 merge 後の a-tree-002 連携確認（main 経由 dispatch 受領待ち）
3. PR #150 / #147 / #152 / #154 / #155 merge 待ち（東海林さん最終判断）
4. unrelated 14 test 別 issue 起票（任意、優先度低）

# self-check

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時（~~~ 内配置、v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: PR #154 merge GO + 軽微改善 2 件方針 受領確認
- [x] B: PR #155 5 観点完走（spec 改訂のみ、軽量レビュー想定通り 5 観点）
- [x] C: 軽微改善 #1 (PR #128 SQL 本体との対応関係明示) 提示
- [x] D: Bloom 観点補足（Tree D-01 RLS は Bloom 直接影響なし、Phase A-2.2 で再確認推奨）
- [x] E: Tree Phase D §0 解消フロー 6 step 整合確認
- [x] F: レビューコメント URL + timestamp 明記
- [x] 番号 = bloom-006- No. 7（main- No. 245 §「報告フォーマット」期待値準拠）
