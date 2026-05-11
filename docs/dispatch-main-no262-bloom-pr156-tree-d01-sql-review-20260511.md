~~~
🔴 main- No. 262
【a-main-021 から a-bloom-006 への dispatch】
発信日時: 2026-05-11(月) 14:20

# 件名
PR #156 (Tree D-01 SQL §7 RLS is_same_department 縮退対応) 起票完了 → **review 依頼**（累計 7 件目、Phase D §0 着手前提条件 残 1 件解消の最終 review）

# A. 経緯

a-tree-002 が main- No. 258 受領 → Step 6 完走（tree-002- No. 26、2026-05-11 13:58）で PR #128 SQL 本体修正 別 PR #156 起票完了:

| 項目 | 値 |
|---|---|
| PR 番号 | **PR #156** |
| URL | https://github.com/Hyuaran/garden/pull/156 |
| branch | feature/tree-d01-rls-sql-self-only-20260511（派生元 feature/tree-phase-d-01-reissue-20260507、commit 45decb4）|
| base | develop |
| title | fix(tree): D-01 SQL §7 RLS — is_same_department 縮退対応（PR #155 spec 改訂 SQL 本体反映）|
| 差分 | 1 ファイル / +30 -13（`supabase/migrations/20260427000001_tree_phase_d_01.sql`）|
| 状態 | open、Vercel preview 自動 deploy 中 |

# B. 変更内容サマリ

| § | テーブル | 変更内容 |
|---|---|---|
| §7.1 | tree_calling_sessions | `tcs_select_manager`: `is_same_department(employee_id)` → `employee_id = auth_employee_number()` 縮退 |
| §7.2 | tree_call_records | `tcr_select_manager`: 同様の縮退対応 |
| §7.3 | tree_agent_assignments | `taa_select_manager / taa_insert_manager / taa_update_manager`: 3 ポリシー同様の縮退対応 |

冒頭コメント更新:
- §0 前提条件から is_same_department 削除、Batch 7 (PR #154) 準拠と注記
- 縮退理由 + 将来再導入条件 を明記

# C. レビュー観点（共通 4 + PR #156 独自 3 = 7 観点）

## C-1. 共通観点（PR #154/#155 と同等）

| # | 観点 | 内容 |
|---|---|---|
| 1 | 外部キー整合 | tree_* テーブルの employee_id ↔ root_employees の参照整合 |
| 2 | 認証ロール 8 段階階層 | has_role_at_least('manager') 使用の妥当性 |
| 3 | Bloom 衝突 | Bloom 既存 RLS との衝突なし、Tree D-01 RLS の独立性確認 |
| 4 | 旧版データ保持 | DROP POLICY IF EXISTS パターン維持、再 apply 安全性 |

## C-2. PR #156 独自観点

| # | 観点 | 内容 |
|---|---|---|
| 5 | is_same_department 縮退の妥当性 | 「自分担当 only」縮退 = manager が他人のレコード見れなくなる = 既存業務影響なし確認（manager 役割は自部署オペレーター監督が主、本縮退で機能制限なし）|
| 6 | Batch 7 関数（auth_employee_number / has_role_at_least）整合 | 本 PR で使う関数は **既 apply 済**（main- No. 258 §A 確認、garden 14:00 JST apply）、本 PR merge + apply で即動作 |
| 7 | PR #128 と本 PR の関係 | PR #128（D-01 schema migration、commit 45decb4）の同 SQL ファイル `20260427000001_tree_phase_d_01.sql` を本 PR で修正、レビュー単位分離（schema migration vs RLS 修正） |

# D. spec ↔ SQL 対応関係 trace

PR #155（spec 改訂、merged）+ PR #156（SQL 本体修正）= **spec ↔ SQL の整合 trace**:

| 改訂対象 | PR | 状態 |
|---|---|---|
| spec D-01 §4 RLS 改訂（is_same_department 縮退 + Batch 7 整合）| PR #155 | ✅ merged |
| spec §12 改訂履歴 v1.1 trace（PR #128 後続 PR で SQL 修正予定）| PR #155 | ✅ merged |
| SQL §7 RLS 縮退対応 | **PR #156** | 🟡 open（本 review）|

→ PR #156 採用 + merge で **spec ↔ SQL 完全整合**達成。

# E. Tree Phase D §0 着手前提条件 残 1 件

| 前提 | 状態 |
|---|---|
| Phase D plan v3.1 (PR #153) | 🟡 review 待ち（必須前提ではない、plan 起票で並行 review）|
| 急務 3 件判断保留 | ✅ §6.1 確定 |
| worktree 環境 B 案 | ✅ 復帰完了 |
| PR #31 develop merge | ✅ 既 merge (a4c932f) |
| Batch 7 関数 apply | ✅ 完了 |
| Tree D-01 spec §4 改訂 (PR #155) | ✅ merge 完了 |
| **PR #128 SQL 本体修正 (PR #156)** | 🔴 **本 review** → merge 完了で Phase D §0 着手可 |

→ **PR #156 review + merge** = Phase D §0 着手前提条件の **最後の鍵**。後道さんデモ前 critical path 直結。

# F. 報告フォーマット（bloom-006- No. 12 以降）

冒頭 3 行（🟢 bloom-006- No. 12 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

報告期待内容:
- 7 観点（共通 4 + 独自 3）完走
- 採用推奨 / 要修正 / 軽微改善判定
- PR #156 mergeStateStatus / Vercel Preview 状態
- spec ↔ SQL 整合性確認

# G. 緊急度

🔴 高（Phase D §0 着手前提条件解消の最終 review、後道さんデモ前 critical path 直結）

# H. 並行進捗状況（参考）

| PR | 状態 |
|---|---|
| #154 (Batch 7) | ✅ merged + applied |
| #155 (Tree D-01 §4 spec) | ✅ merged |
| **#156 (Tree D-01 SQL §7 RLS)** | 🔴 **本 review 対象** |
| #147 / #148 / #149 / #150 / #152 / #153 | ⏳ merge 待ち（東海林さん判断 + a-bud-002 base sync 完了）|

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: PR #156 起票完了経緯
- [x] B: 変更内容サマリ（§7.1/7.2/7.3 + コメント）
- [x] C: 7 観点（共通 4 + 独自 3）明示
- [x] D: spec ↔ SQL 対応関係 trace
- [x] E: Tree Phase D §0 残 1 件明示
- [x] F: 報告フォーマット
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 262（counter 継続）
~~~
