~~~
🟡 main- No. 223
【a-main-020 から a-tree-002 への dispatch】
発信日時: 2026-05-11(月) 10:34

# 件名
急務 3 件判断保留 全件採用 GO + Phase D 着手前提条件クリア + worktree 増設 or 継続判断仰ぎ

# 1. ガンガンモード再開通知

東海林さん明示 GO（2026-05-11 09:50 受領）でガンガンモード解除、Garden 開発再開。a-tree-002 が 14d 停滞（4/25 plan v3 起草後）= ガンガン本質「30 分巡回」基準で 🔴 即時別タスク対象、本 dispatch で着手前提整備。

# 2. 経緯（a-main-020 巡回 + Agent Explore 調査）

| 確認項目 | 結果 |
|---|---|
| a-tree-002 直近 commit | 5c30a23（4/25、fix(bud): PR #85 a-review #55 経理事故 4 件改修）|
| branch 状態 | **develop** に居る、`feature/tree-phase-d-plan-v3` には未 checkout |
| develop 遅れ | origin/develop から 105 commits 遅れ |
| handoff | `docs/handoff-tree-202604252100-phase-d-plan.md`（4/25 21:00、Phase D plan v3 起草完了 + 判断保留 38 件） |
| plan | `docs/superpowers/plans/2026-04-25-tree-phase-d-implementation.md`（1,832 行、70 タスク、6.5d 実装純工数） |
| 急務 3 件 | D-02-判2 / D-04-判4 / D-06-判6（α テスト着手前確定推奨）|

# 3. 急務 3 件 全件採用 GO（東海林さん決裁済 2026-05-11 10:32）

plan v3 内の **仮スタンス全件採用**:

| 判 | 論点 | 仮スタンス → 確定 |
|---|---|---|
| D-02-判2 | オフラインキュー上限 | **500 件で確定**、超過 = 業務停止扱い（Toast 警告）。現場運用後に調整可。 |
| D-04-判4 | 同意確認の全商材必須化 | **全商材必須で確定**（景表法・特商法準拠、安全側）。 |
| D-06-判6 | L3 承認者（Tree テーブル DROP + FM 再 sync）| **東海林さん + admin 2 名の dual 承認で確定**。 |

→ plan v3 の §6「判断保留」セクションを §6.1「確定判断（3 件、5/11 GO）」+ §6.2「残り 35 件判断保留」に分割推奨。実装着手時は §6.1 の 3 件 = 確定済として進行可。

# 4. 残り 35 件判断保留

残り 35 件（D-01:3 / D-02:6 / D-03:7 / D-04:6 / D-05:8 / D-06:5）は本 dispatch では決裁せず。実装着手中に追加発見 / 各 §着手前に main- No. 後続候補で順次 4 列テーブル提示 → 東海林さん決裁の流れ。

実装着手をブロックしない範囲で進行可（plan §0 Pre-flight + §1 D-01 Schema migrations 等は急務 3 件と独立）。

# 5. worktree 判断仰ぎ（main 推奨明示）

## 5-1. 現状の課題

a-tree-002 worktree が:
- branch = develop（feature/tree-phase-d-plan-v3 に居ない、Phase D 作業 worktree として不適切）
- develop が origin/develop から 105 commits 遅れ
- 4/25 以降 working tree 放置（14d 停滞、ただし正常停滞 = 判断保留待ち）

## 5-2. 選択肢 A / B

| 案 | 内容 | 推奨度 |
|---|---|---|
| A | a-tree-003 worktree 新設（origin/develop ベースで完全リセット、feature/tree-phase-d-plan-v3 を checkout）| 🟢 推奨（develop 105 commits 遅れ解消 + clean な作業環境）|
| B | a-tree-002 で `git fetch origin && git checkout feature/tree-phase-d-plan-v3 && git pull` で復帰（worktree 増設なし、既存環境継続） | 🟡（develop 遅れは branch checkout 時に解消、ただし worktree 内に 14d 前の untracked / cache 残存リスク）|

## 5-3. main 推奨理由

A 推奨。Agent Explore 報告通り「develop 105 commits 遅れで完全リセットが効率的」+ Tree = 最慎重モジュール（§17 Tree 特例、§18 Phase D）なので clean 環境が望ましい。

ただし、東海林さん最終判断（A / B どちらでも進行可、a-tree-002 自身の判断材料も含めて）。

# 6. Phase D 着手前提条件クリア

急務 3 件確定 → 以下が整う:

| 前提条件 | 状態 |
|---|---|
| Phase D plan v3 確定 | ✅（4/25 起草完了、70 task / 6.5d）|
| 急務 3 件判断保留 | ✅ 確定（本 dispatch）|
| 残り 35 件判断保留 | 🟡 実装着手と並行で順次解消（main- No. 後続） |
| worktree 環境 | 🟡 A 案 a-tree-003 新設 or B 案 現 worktree 復帰、東海林さん判断 |
| PR #31（Phase D 6 spec）develop merge | 🟡 a-main 担当、未 merge の場合は別途処理（handoff §「次のアクション」#3）|
| Batch 7 cross-cutting 関数 Supabase apply 確認 | 🟡 同 #4、`auth_employee_number()` / `has_role_at_least()` / `is_same_department()` |

→ worktree 判断 + PR #31 merge 状況確認後、Phase D §0 Pre-flight Task 0 から着手可能。

# 7. 報告フォーマット（tree-002- No. NN）

冒頭 3 行（🟢 tree-002- No. NN / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
急務 3 件確定受領 + worktree 判断 + Phase D 着手準備状況

### 急務 3 件確定受領
- D-02-判2 / D-04-判4 / D-06-判6 = plan §6 から §6.1 に移動済 / plan v3.1 起草必要

### worktree 判断（A / B）
- 採択案: A（a-tree-003 新設）or B（現 worktree 復帰）
- 採用理由
- 移行 / 復帰実施状況

### PR #31 + Batch 7 cross-cutting 関数 確認
- PR #31 merge 状況（既 merge / 未 merge の場合は a-main へ依頼）
- Batch 7 関数 Supabase apply 状況（既 apply / 未 apply の場合は東海林さんに依頼）

### Phase D §0 Pre-flight 着手可否
- Task 0 着手準備 OK / 未

### 残り 35 件判断保留 整理
- §6 → §6.1（確定 3 件）+ §6.2（残り 35 件）分割反映状況
- v3.1 push 状況

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 急務 3 件確定受領
- [x] worktree 判断明示
- [x] Phase D 着手準備状況明示

# 8. 緊急度

🟡 中（Tree Phase D 着手前提整備、Phase D 自体は §18 で Phase A 完走後想定だが、着手前提条件のクリアは前倒し可）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 急務 3 件確定 GO（仮スタンス採用）明示
- [x] 残り 35 件は実装着手と並行で順次解消の方針明示
- [x] worktree 判断 A / B 選択肢 + main 推奨明示
- [x] Phase D 着手前提条件クリア状況一覧
- [x] 報告フォーマット (tree-002- No. NN) 雛形提示（v5.1 完全準拠）
- [x] 番号 = main- No. 223（counter 継続）
~~~
