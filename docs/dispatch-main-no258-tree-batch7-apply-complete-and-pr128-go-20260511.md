~~~
🔴 main- No. 258
【a-main-021 から a-tree-002 への dispatch】
発信日時: 2026-05-11(月) 14:05

# 件名
Batch 7 関数 apply 完了 ✅（Supabase 動作確認 2 件 OK）+ merge 順序 Step 1-5 完走 + **Step 6 着手 GO**（PR #128 SQL 本体修正、別 PR 推奨）+ Phase D §0 着手前提条件 残 1 件

# A. Batch 7 関数 apply 完了

| Step | 内容 | 状態 |
|---|---|---|
| Supabase 動作確認 SQL 実行 | `SELECT proname FROM pg_proc WHERE proname IN ('auth_employee_number', 'has_role_at_least')` | ✅ 2 行返却 |
| 関数 1: `auth_employee_number()` | SECURITY DEFINER + STABLE、employee_number 取得 | ✅ 作成済 |
| 関数 2: `has_role_at_least(role_min text)` | 8 段階階層判定（toss/closer/cs/staff/outsource/manager/admin/super_admin）| ✅ 作成済 |
| 適用環境 | garden（dev/prod 兼用 1 プロジェクト、Hyuaran org）| ✅ |
| 実行手段 | Chrome MCP + 東海林さん最終 Run（案 B 採用、本番 DB なので最終安全弁）| ✅ |

→ a-tree-002 spec §4 で使用する Batch 7 関数 2 件 完備、Phase D §0 着手前提条件の Batch 7 関数 apply ✅ 完了。

# B. merge 順序 Step 1-5 完走サマリ

| Step | 内容 | 状態 |
|---|---|---|
| 1 | PR #154 (Batch 7 cross-rls-helpers) merge | ✅ 13:02 JST |
| 2-3 | garden apply（dev/prod 兼用） | ✅ 14:00 JST |
| 4 | PR #155 spec §12 trace 追記 push（tree-002- No. 24）| ✅ |
| 5 | PR #155 merge | ✅ 13:02 JST |
| **6** | **PR #128 SQL 本体修正 別 PR push** | ⏳ **本 dispatch で着手 GO** |
| 7 | 別 PR merge → Tree Phase D §0 着手 | ⏳ Step 6 完了後 |

# C. Step 6 着手 GO（PR #128 SQL 本体修正、別 PR 推奨）

main- No. 244 §C で確定済の方針:
- PR #128 (Tree D-01 schema SQL migration、commit 45decb4) の SQL ファイル本体 `is_same_department(...)` 使用箇所を **`employee_id = auth_employee_number()` 縮退**に修正
- **別 PR 起票推奨**（main- No. 244 §C 確定、レビュー単位分離の方針一貫）

実施手順:

| 順 | アクション |
|---|---|
| 1 | feature/tree-phase-d-01-reissue-20260507 ブランチに切替（commit 45decb4 起源、PR #128 起源）|
| 2 | SQL ファイル本体（migration scripts）内の `is_same_department(...)` 使用箇所を grep |
| 3 | `USING (has_role_at_least('manager') AND is_same_department(employee_id))` → `USING (has_role_at_least('manager') AND employee_id = auth_employee_number())` に修正 |
| 4 | 旧版データ保持原則踏襲（既存 SQL を rename / delete せず追加 / 修正のみ、memory `feedback_no_delete_keep_legacy` 準拠） |
| 5 | git add + commit + push（メッセージ例: `fix(tree): D-01 SQL §4 RLS - is_same_department 縮退対応（PR #155 spec 改訂と整合）`）|
| 6 | **別 PR 起票**（feature/tree-phase-d-01-rls-sql-self-only-20260511 等、新ブランチ推奨）|
| 7 | PR title 例: `fix(tree): D-01 SQL §4 RLS - is_same_department 縮退対応（PR #155 spec 改訂 SQL 本体反映）` |
| 8 | a-main-021 経由で東海林さんへ完了報告（tree-002- No. NN）|

別 PR の理由:
- レビュー単位分離（PR #128 = schema migration / 新 PR = RLS 修正、関心事独立）
- PR #128 既 review コメント維持
- 失敗時のロールバック容易

# D. Phase D §0 Pre-flight Task 0 着手前提条件 trace（更新）

| 前提 | 状態 |
|---|---|
| Phase D plan v3.1 (PR #153) | 🟡 open、review 待ち |
| 急務 3 件判断保留 | ✅ §6.1 確定 |
| worktree 環境 B 案 | ✅ 復帰完了 |
| PR #31 (Phase D 6 spec) develop merge | ✅ 既 merge (a4c932f) |
| **Batch 7 関数 apply** | ✅ **完了**（本 dispatch §A）|
| **Tree D-01 spec §4 改訂 (PR #155)** | ✅ **merge 完了**（13:02 JST、軽微改善 # 1 trace 反映済）|
| **PR #128 SQL 本体修正** | ⏳ **本 dispatch §C で着手 GO** |

→ 残 2 件（PR #153 review 待ち + PR #128 SQL 修正完了）で Phase D §0 着手可能。

# E. 次アクション（a-tree-002）

| 順 | アクション | トリガー |
|---|---|---|
| 1 | **PR #128 SQL 本体修正 別 PR push**（本 dispatch §C 手順 1-8）| 本 dispatch 受領で即着手 |
| 2 | tree-002- No. 25 で完了報告 | Step 6 push 完了後 |
| 3 | 新 PR a-bloom-006 review 待ち | review 自動依頼（既 PR 同様）|
| 4 | 新 PR merge → Phase D §0 Pre-flight Task 0 着手準備 | review + merge 完了後 |

ガンガンモード継続、PR #128 SQL 修正 別 PR 起票 即対応、a-bloom-006 review コメント検出時は即対応。

# F. 緊急度

🔴 高（Phase D §0 着手前提条件解消の最終ステップ、後道さんデモ前 critical path に直結）

# 報告フォーマット（tree-002- No. 25 以降）

冒頭 3 行（🟢 tree-002- No. 25 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: Batch 7 関数 apply 完了確認（動作確認 2 件 OK）
- [x] B: merge 順序 Step 1-5 完走サマリ
- [x] C: Step 6 着手 GO（PR #128 SQL 修正、別 PR 推奨、8 step 実施手順）
- [x] D: Phase D §0 前提条件 trace 更新（残 2 件）
- [x] E: 次アクション 4 件
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 258（counter 継続）
~~~
