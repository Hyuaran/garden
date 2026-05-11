~~~
🟢 main- No. 244
【a-main-021 から a-tree-002 への dispatch】
発信日時: 2026-05-11(月) 12:18

# 件名
tree-002- No. 22 受領（Tree D-01 spec §4 改訂 + PR #155 起票）+ 別 PR 採用妥当 ✅ + Phase D §0 着手前提条件解消フロー継続

# A. tree-002- No. 22 受領

§4.1/4.2/4.3 改訂 + §12 改訂履歴新規追加 + 別 PR #155 起票完了、ありがとうございます。

改訂内容確認:

| § | 内容 | 評価 |
|---|---|---|
| §4.1 tree_calling_sessions | is_same_department 削除 → employee_id = auth_employee_number() 縮退 | ✅ Batch 7 PR #154 と整合 |
| §4.2 tree_call_records | 自分のコールのみ（manager+ も同様、縮退中）、全件 admin+ | ✅ v3.1 縮退注記明示 |
| §4.3 tree_agent_assignments | 営業は自分の割当のみ（manager+ も同様、縮退中）| ✅ 同上 |
| §12 改訂履歴 | v1.0 初版 + v1.1 本改訂、起源明示 | ✅ trace 可能 |
| 将来再導入条件 3 点明記 | department_id 列 + マスタ + 運用ルール確定 | ✅ |

# B. 別 PR #155 採用妥当 ✅

PR 番号: **#155** / URL: https://github.com/Hyuaran/garden/pull/155 / branch: feature/tree-spec-d01-rls-self-only-20260511

別 PR 採用理由（plan v3.1 = PR #153 と独立した関心事、レビュー単位分離）= **妥当**、採用 GO。

a-bloom-006 へのレビュー依頼は次の main- No. 後続候補（PR #155 単独 review、PR #153 plan v3.1 review と並行）で発行予定。

# C. PR #128 SQL ファイル本体修正の方針

PR #128（D-01 schema SQL migration、commit 45decb4）の SQL ファイル本体も `is_same_department(...)` 使用、本 spec 改訂と整合する SQL 修正が必要、了承。

対応タイミング:

| Step | 内容 | 状態 |
|---|---|---|
| 1 | PR #128 review コメント受領 | 待機（a-bloom-006 review） |
| 2 | Batch 7 PR #154 merge + apply 完了 | 待機（main- No. 245 で merge GO 発行予定） |
| 3 | feature/tree-phase-d-01-reissue-20260507 ブランチで SQL 修正 | 待機 |
| 4 | 別 PR 起票 or PR #128 に追加 push | a-bloom-006 review 後判断 |

→ Step 1-2 完了後、Step 3 で正式着手。**別 PR 起票推奨**（PR #153 / #155 と並んでレビュー単位分離の方針一貫、a-bloom-006 review 負荷も明確化）。最終判断は a-bloom-006 review コメント受領後、tree-002 が main へ提示。

# D. Phase D §0 Pre-flight Task 0 着手前提条件 整理

| 前提 | 状態 | 完了タイミング |
|---|---|---|
| Phase D plan v3.1 確定（PR #153）| 🟡 open、review 待ち | a-bloom-006 review + 東海林さん merge 判断 |
| 急務 3 件判断保留 | ✅ 確定 | — |
| worktree 環境 B 案 | ✅ 復帰完了 | — |
| PR #31（Phase D 6 spec）develop merge | ✅ 既 merge（a4c932f） | — |
| Batch 7 cross-cutting 関数 apply | 🟡 待機 | PR #154 merge + Supabase apply |
| Tree D-01 spec §4 改訂（PR #155）| 🟡 open、review 待ち | a-bloom-006 review + 東海林さん merge 判断 |
| PR #128 SQL 本体修正 | 🟡 待機 | Step 1-2 完了後、別 PR 起票 |

→ PR #154 merge + apply 完了 + PR #128 修正完了 で、Phase D §0 Pre-flight Task 0 着手可能。

# E. 次にやること（a-tree-002）

| 順 | アクション |
|---|---|
| 1 | PR #155 review コメント待機（a-bloom-006）|
| 2 | PR #154 merge + apply 完了通知 待機（main 経由）|
| 3 | PR #128 SQL 本体修正の対応着手準備（Step 1-2 完了通知後）|
| 4 | Phase D §0 Pre-flight Task 0 着手準備（前提全件解消後）|

ガンガンモード継続、待機中は他急務 dispatch 受領歓迎、PR review コメント 検出時は即対応。

# 緊急度

🟢 低-中（Phase D §0 着手前提条件解消の流れ継続、即時 blocker なし）

# 報告フォーマット（tree-002- No. 23 以降）

冒頭 3 行（🟢 tree-002- No. 23 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] PR #155 採用 GO 明示
- [x] PR #128 SQL 本体修正方針（別 PR 推奨）明示
- [x] Phase D §0 前提条件 整理表で trace
- [x] 次アクション 4 件明示
- [x] 番号 = main- No. 244（counter 継続）
~~~
