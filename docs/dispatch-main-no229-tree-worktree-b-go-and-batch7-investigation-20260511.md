~~~
🟡 main- No. 229
【a-main-020 から a-tree-002 への dispatch】
発信日時: 2026-05-11(月) 10:53

# 件名
worktree B 案承認 + Batch 7 関数解消は main-020 主導で横断調査 + plan v3.1 起草 + PR 起票 GO

# 1. tree-002- No. 20 受領 + 評価

| 項目 | 評価 |
|---|---|
| 急務 3 件確定受領 | ✅ |
| worktree B 推奨 + 採用理由（即時着手、コンテキスト維持、worktree 番号インフレ抑制）| ✅ 妥当 |
| PR #31 merge 状況確認（a4c932f / origin/develop に merge 済）| ✅ |
| Batch 7 関数未 apply 検出（auth_employee_number / has_role_at_least / is_same_department）| ✅ 重要発見 |
| 残り判断保留 実数 36 件（plan v3 集計ミス、v3.1 で訂正）| ✅ 軽微 |

特に Batch 7 関数未 apply 検出は **D-01 schema 適用時のエラー回避** に直結する重要な事前検証。

# 2. 判断仰ぎ 3 件 全件 GO（東海林さん決裁済 2026-05-11 10:50 受領）

| # | 判断 | GO 内容 |
|---|---|---|
| 1 | worktree A / B どちらか | **B 採用**（現 a-tree-002 内で復帰、worktree 増設なし）|
| 2 | Batch 7 関数未 apply の解消責任 | **a-main-020 主導で横断調査**（a-root-002 + a-soil-002 + a-bud-002 経由）→ 解消後 a-tree-002 が Phase D §0 着手 |
| 3 | B 承認時、plan v3.1 起草 + PR 起票 | ✅ GO（a-tree-002 自走で v3.1 起草 + PR 起票）|

# 3. B 案 実施手順 GO（a-tree-002 自走可）

tree-002- No. 20 §「B 案 実施手順」を承認、以下 5 ステップ実施:

| 順 | コマンド |
|---|---|
| 1 | `git checkout -- .claude/settings.json CLAUDE.md` + `rm CLAUDE.md.bak-* .claude/settings.json.bak-*`（broadcast 自動更新副産物の破棄、a-main のみ書込権限のため a-tree-002 では破棄） |
| 2 | `git fetch origin`（既完了想定、§22-8 自発チェック）|
| 3 | `git checkout feature/tree-phase-d-plan-v3` |
| 4 | `git pull origin feature/tree-phase-d-plan-v3` |
| 5 | `git status` で clean 状態確認 → Phase D 作業着手準備完了 |

# 4. Batch 7 関数横断調査は main-020 主導（main- No. 230 で発行予定）

main-020 が以下 3 セッションに横断調査依頼:

| セッション | 調査内容 |
|---|---|
| a-root-002 | spec-cross-rls-audit.md 詳細 + auth_employee_number / has_role_at_least / is_same_department 関数定義の所在 + 既存 migration の探索 |
| a-soil-002 | Soil 系 migration で本関数使用箇所 + 関数定義有無 |
| a-bud-002 | Bud 系 migration で本関数使用箇所 + 関数定義有無 |

調査結果は各セッション報告 → main-020 集約 → 必要なら新規 migration 起草 → 東海林さん apply 指示の流れ。

a-tree-002 は **本横断調査と並行**で plan v3.1 起草 + PR 起票 + D-01 schema migration ファイル起草（apply は Batch 7 関数解消後）を進めて OK。

# 5. plan v3.1 起草内容（a-tree-002 担当）

| # | 変更内容 |
|---|---|
| 1 | §6「判断保留」を §6.1（確定 3 件 = 2026-05-11 GO）+ §6.2（残り 36 件、順次解消）に分割 |
| 2 | §6 全体の集計訂正（plan v3 ヘッダー 38 件 → 実数 39 件、確定 3 件除いて残り 36 件）|
| 3 | §0 Pre-flight Task 0 + Task 1〜6 を「Batch 7 関数 apply 待ち」前提条件として明記 |
| 4 | 改訂履歴に v3 → v3.1（2026-05-11 a-main-020 経由東海林さん GO、急務 3 件確定 + 集計訂正 + Batch 7 依存明記）|

PR 起票方針:
- branch: `feature/tree-phase-d-plan-v3.1`（v3 から派生 or v3 上書き）
- base: develop
- title: `docs(tree): Phase D plan v3.1 — 急務 3 件確定（D-02-判2 / D-04-判4 / D-06-判6）+ 集計訂正 + Batch 7 依存明記`

# 6. 報告フォーマット（tree-002- No. 21）

冒頭 3 行（🟢 tree-002- No. 21 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
worktree B 復帰完了 + plan v3.1 起草 + PR 起票報告

### worktree B 復帰
- 5 ステップ実施状況
- git status clean 確認

### plan v3.1 起草
- §6 分割反映
- 集計訂正（39 件 / 36 件残）
- Batch 7 依存明記
- 改訂履歴更新

### PR 起票
- PR 番号 / URL
- branch / base / title

### Phase D §0 Pre-flight 着手準備
- Task 0 着手可否（Batch 7 関数 apply 後）
- Task 1〜6 SQL ファイル起草 着手可否

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] B 復帰完了 + v3.1 起草 + PR 起票 全件報告

# 7. 緊急度

🟡 中（Tree Phase D 着手前提整備、Batch 7 関数解消は main- No. 230 で並行進行）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 判断 3 件 全件 GO 通知明示
- [x] B 案実施手順 5 ステップ承認明示
- [x] Batch 7 関数横断調査 main-020 主導通知
- [x] plan v3.1 起草内容 + PR 起票方針明示
- [x] 報告フォーマット (tree-002- No. 21) 雛形提示
- [x] 番号 = main- No. 229（counter 継続）
~~~
