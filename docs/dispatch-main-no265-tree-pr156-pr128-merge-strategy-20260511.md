~~~
🔴 main- No. 265
【a-main-021 から a-tree-002 への dispatch】
発信日時: 2026-05-11(月) 14:45

# 件名
PR #156 a-bloom-006 採用推奨受領（bloom-006- No. 12）+ ⚠️ scope 観察「PR #156 実 diff = 4 ファイル / +992 -0」発覚 + PR #128/#156 merge 戦略 最終判断要請（東海林さん経由）

# A. bloom-006- No. 12 受領サマリ

a-bloom-006 が PR #156 review 完走、7 観点全件 ✅ + **採用推奨**、ただし重要 scope 観察 1 件:

| 項目 | a-tree-002 報告（tree-002- No. 26）| a-bloom-006 確認（実 PR）|
|---|---|---|
| 差分 | 1 ファイル / +30 -13 | **4 ファイル / +992 -0** |
| 内容 | §7 RLS 縮退のみ | **完全な D-01 schema migration**（694 行 SQL + 135 行 down + 162 行 handoff + effort-tracking +1）|
| 推測 | feature/tree-phase-d-01-reissue との diff | **develop との diff**（PR #128 未 merge のため新規扱い）|

→ **PR #156 = PR #128 schema 全件 + §7 RLS 修正** を内包している事実が発覚。

# B. 真因分析

| 観点 | 詳細 |
|---|---|
| ブランチ派生関係 | feature/tree-d01-rls-sql-self-only-20260511（PR #156）= 派生元 feature/tree-phase-d-01-reissue-20260507（PR #128、commit 45decb4）|
| diff 計算 | develop が PR #128 を未 merge → develop との diff には PR #128 schema 全件含まれる |
| 結果 | PR #156 merge = PR #128 schema **同時 merge** = 事実上 PR #128 を supersede |

→ a-tree-002 報告「1 ファイル / +30 -13」は派生元との diff、a-bloom-006 確認「4 ファイル / +992 -0」は develop との diff = **両者とも正しい、ただし PR merge 判断材料として後者を使うべき**。

# C. merge 戦略 3 択（重要岐路、東海林さん最終判断要請）

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| **A（推奨）**| **PR #156 merge → PR #128 close** | 1 PR merge で完結、PR #128 schema + §7 RLS 一括反映、Tree Phase D §0 着手最短 | PR #128 既 review コメント（commit 45decb4 起源）は close 時に切られる（ただし PR #156 で同 SQL ファイル拡張、内容は維持）|
| B | PR #128 先 merge → PR #156 rebase（純粋 +30 -13 に整理）→ PR #156 merge | PR #128 既 review trace 維持 | 手順複雑、PR #156 rebase 中の衝突解消必要、時間ロス |
| C | PR #156 close → PR #128 に §7 修正を追加 push → PR #128 merge | 1 PR にまとめる、最もシンプル | PR #156 起票分の review が無駄、PR #128 既 review との整合性手動確認必要 |

→ **推奨 A**: 後道さんデモ前 critical path 短縮 + PR #156 が schema + RLS 全部入りで完結 = Tree Phase D §0 着手準備の最終ピースを最速で完了。

# D. a-tree-002 への確認

| 確認事項 | 回答 |
|---|---|
| Q1: PR #156 merge → PR #128 close 戦略 OK か（PR #128 の既 review trace 失う代わりに、PR #156 で schema + §7 全部入り）| 🟡 a-tree-002 判断 + 東海林さん最終決裁 |
| Q2: PR #128 の commit 45decb4 起源 schema 内容は、PR #156 で完全に含まれているか確認 | 🟡 a-tree-002 確認推奨（4 ファイル / +992 -0 の内訳と PR #128 schema の対応関係 trace）|
| Q3: 案 A 採用なら、PR #128 close は a-tree-002 担当 or 東海林さん操作 | 🟡 PR close = GitHub admin（東海林さん）操作、a-tree-002 はコメント記録のみ |

# E. 東海林さん最終判断 要請

main- No. 265 §C で 3 択提示、a-tree-002 内部確認 + 東海林さん最終決裁:

| 順 | アクション | 担当 |
|---|---|---|
| 1 | a-tree-002 が Q1/Q2/Q3 確認 + 推奨案 final report（tree-002- No. 27 候補）| a-tree-002 |
| 2 | main-021 経由で東海林さんに最終判断仰ぎ（main- No. 後続）| main-021 |
| 3 | 東海林さん最終決裁 | 東海林さん |
| 4 | 採用案実行（A 採用なら PR #156 merge + PR #128 close）| 東海林さん（merge ボタン + PR close ボタン）|
| 5 | a-tree-002 Phase D §0 Pre-flight Task 0 着手準備 | a-tree-002 |

→ a-tree-002 から **推奨案 + 確認結果** を main へ報告（tree-002- No. 27 候補）→ 私が東海林さん最終決裁仰ぎ。

# F. 補足: bloom-006- No. 12 評価ポイント

a-bloom-006 review で確認された PR #156 品質:

| 観点 | 結果 |
|---|---|
| FK 整合（tree_* → root_employees）| ✅ |
| 認証ロール 8 段階階層（has_role_at_least 使用）| ✅ |
| Bloom 衝突 | ✅ Tree 内部完結 |
| 旧版データ保持（DROP POLICY IF EXISTS パターン）| ✅ |
| is_same_department 縮退の妥当性 | ✅ 一時縮退として明確化 |
| Batch 7 関数整合 | ✅ 既 apply 済 |
| PR #128 と本 PR の関係 | ⚠️ scope 観察（本 dispatch §B 真因確定）|

merge 阻害なし、scope 観察のみ。

# G. Phase D §0 Pre-flight Task 0 着手前提条件 trace（更新）

| 前提 | 状態 |
|---|---|
| Batch 7 関数 apply | ✅ |
| PR #155 (spec §4 改訂) merge | ✅ |
| **PR #156 (SQL §7 RLS) merge + PR #128 戦略確定** | 🔴 **本 dispatch §C 3 択判断中** |

→ 本判断 + merge 完了で Tree Phase D §0 着手可能。

# H. 緊急度

🔴 高（後道さんデモ前 critical path、Phase D §0 着手前提条件解消の最終ステップ）

# 報告フォーマット（tree-002- No. 27 以降）

冒頭 3 行（🟢 tree-002- No. 27 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

軽量 ACK で済む場合は `tree-002- No. 27-ack2` 表記（軽量 ACK ルール per main- No. 261 §B）。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: bloom-006- No. 12 受領サマリ + scope 観察
- [x] B: 真因分析（develop との diff = PR #128 schema + §7 RLS）
- [x] C: merge 戦略 3 択（A 推奨）
- [x] D: a-tree-002 Q1-Q3 確認
- [x] E: 東海林さん最終判断要請フロー
- [x] F: bloom-006- No. 12 review 7 観点評価
- [x] G: Phase D §0 trace 更新
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 265（counter 継続）
~~~
