# dispatch main- No. 286 — a-analysis-001 へ事故分析依頼（Tree D-01 真因二層構造 + PR merge ≠ apply 完了 運用課題）

> 起草: a-main-023
> 用途: a-main-022 期で発生した複数事故・違反を a-analysis-001 で構造分析、再発防止策の起案依頼
> 番号: main- No. 286
> 起草時刻: 2026-05-11(月) 16:55

---

## 投下用短文（東海林さんがコピー → a-analysis-001 にペースト）

~~~
🔴 main- No. 286
【a-main-023 から a-analysis-001 への dispatch（Tree D-01 事故 + a-main-022 期 違反 6 件 + a-analysis 報告漏れ自体 の 3 軸 構造分析依頼）】
発信日時: 2026-05-11(月) 16:55

# 件名
🔴 a-main-022 期で発生した複数事故・違反を構造分析し、再発防止策を起案してください。3 軸：A) Tree D-01 真因二層構造（PR merge ≠ apply 完了）/ B) a-main-022 期 違反 6 件 / C) a-analysis-001 自体への報告漏れ（ガンガン本質 全モジュール並列稼働違反）

# A. 分析対象 1: Tree D-01 真因二層構造

## A-1. 事象
- 5/11 14:30 Tree D-01 (`supabase/migrations/20260427000001_tree_phase_d_01.sql`) を garden-dev に apply → 42830 invalid_foreign_key エラー
- a-main-022 が仮説 1: 「root_employees.employee_number に UNIQUE 制約なし」→ PR #157 起票 + GitHub merge
- a-main-022 が再 apply 試行 → 同 42830 再発
- a-main-022 が仮説 2: 「soil_call_lists 未存在」→ dispatch # 285 で a-soil-002 に Phase B-01 先行 apply 依頼
- 5/11 16:24 a-soil-002 (soil-62) で Tree D-01 spec mismatch 発覚（soil_call_lists 存在せず、real soil_lists / uuid PK）
- 5/11 16:40 a-main-023 が REST 直接検証 → root_employees.employee_number UNIQUE が実 DB に未適用（重複 INSERT 成功で立証）

## A-2. 真因の二層構造
| 層 | 障害 | 解消手段 |
|---|---|---|
| 直接真因（即解消可）| inline FK が UNIQUE 未存在で 42830 | migration `20260511000002` を garden-dev に apply |
| 潜在問題（後日解消）| Tree D-01 spec が参照する soil_call_lists が real soil migration に存在しない | Tree D-01 spec + SQL を soil_lists / soil_call_history / uuid に整合修正（a-tree-002）|

## A-3. 分析依頼内容
- 仮説検証プロセスの欠陥分析（仮説 1 → 2 の飛躍、検証なしで投下、PR merge を apply 完了と誤認）
- PR merge ≠ Supabase apply の運用ギャップ評価
- 真因二層構造の検出手順テンプレ化（次回同様事象でも段階的に切り分け可能にする）
- 再発防止策の起案（運用 ruleset / チェックリスト / 自動検証スクリプト等）

# B. 分析対象 2: a-main-022 期 違反 6 件（handoff §5）

| # | 違反 | 該当 memory |
|---|---|---|
| 1 | worktree 作成「東海林さん作業として案内」（dispatch # 272 + 操作 # 1） | feedback_session_worktree_auto_setup |
| 2 | dispatch # 151 merge ボタン白の説明違反（専門用語まみれ） | feedback_explanation_style |
| 3 | dispatch # 280 で「1,429 行 plan」誤情報 | feedback_verify_before_self_critique |
| 4 | 5/18 着地見通し保守的すぎ（ガンガン本質違反） | feedback_gangan_mode_default |
| 5 | 判断仰ぎ過多 | feedback_proposal_count_limit / feedback_gangan_mode_default |
| 6 | a-root-003 のコピペ形式違反検出時、即訂正 dispatch # 280 起草遅れ | feedback_reply_as_main_dispatch |

## B-1. 分析依頼内容
- 6 件の違反パターン分類（規律 skip / 状態認識 / 説明スタイル / 検証不足 / 判断仰ぎ閾値）
- 同日 2 回連続違反（# 1）の構造原因分析
- 既存 memory が機能しなかった理由（明文化されているのに違反が起きた根本原因）
- memory 強化提案（a-memory 経由で改訂すべき memory の特定）

# C. 分析対象 3: a-analysis-001 自体への報告漏れ（最重要）

## C-1. 事象
- a-main-022 期で 18 dispatch 起草（# 268-285）
- うち a-analysis-001 / a-audit-001 への投下 = **0 件**
- 両セッションが完全待機状態のまま a-main-022 が 5h 枠を消費
- ガンガン本質「全モジュール並列稼働」が崩壊

## C-2. 分析依頼内容
- a-analysis-001 / a-audit-001 が待機状態のまま放置される構造原因
- 30 分巡回チェック（memory feedback_module_round_robin_check）が機能しなかった理由
- analysis / audit への報告タイミング自動検知の仕組み提案
- 5/11 以降の analysis / audit セッション活用ペース目標

# D. 期待する成果物（a-analysis-001 → main 報告フォーマット）

冒頭 3 行（🟢 / 🟡 / 🔴 analysis-001- No. NN / 元→宛先 / 発信日時）+ ~~~ ラップ + 表形式 + 以下章立て：
1. A 軸（Tree D-01 真因二層）構造分析 + 再発防止策
2. B 軸（違反 6 件）パターン分類 + memory 強化提案
3. C 軸（報告漏れ）構造原因 + 巡回チェック改良案
4. 横断統合（3 軸共通する根本原因 / 優先度マトリクス）
5. 即実行可能な行動 5 件（main / 各モジュール / 東海林さん向け）

# E. 緊急度

🔴 最緊急（5/18 1 週間 critical path 進行中、再発で各モジュール作業停止リスク）

# F. 工数想定

a-analysis-001 想定: 2-3h（subagent 並列起票推奨、A/B/C 軸を並列分析）

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A / B / C 3 軸の事象 + 分析依頼内容明示
- [x] D 期待する成果物フォーマット明示
- [x] E 緊急度 🔴
- [x] F 工数想定 + 並列起票推奨
- [x] 番号 = main- No. 286（counter 285 → 286）
~~~

---

## 詳細（参考、投下対象外）

### 1. 投下後の流れ

1. a-analysis-001 受領 → 3 軸並列分析（subagent 推奨）
2. analysis-001- No. NN で main 報告
3. main が結果を governance 改訂 / memory 強化 / 巡回ペース調整に反映

### 2. 関連 dispatch

- dispatch # 287（a-audit-001 監査依頼、本件と連動）
- dispatch # 288（a-soil-002 へ # 285 撤回）
- dispatch # 289（a-root-003 # 44 GO 通知）
