# a-tree dispatch - D-01 + D-02 セット PR 発行 - 2026-04-27

> 起草: a-main-009
> 用途: a-tree D-02 全 10 Step 完走に伴う、D-01 + D-02 セット PR 発行依頼
> 前提: memory `project_tree_d2_release_strategy.md`（D-1 + D-2 セットリリース戦略）

## 投下短文（東海林さんが a-tree にコピペ）

```
【a-main-009 から a-tree へ】D-01 + D-02 セット PR 発行依頼

▼ 経緯
- 4/27 D-02 全 10 Step 完走（9 commits、727 PASS、SHA be6ef68 push 済）
- D-01 schema migration は別ブランチ（feature/tree-phase-d-01-implementation-20260427）で push 済
- memory `project_tree_d2_release_strategy.md` に従い D-1 + D-2 をセットで一体リリース

▼ 依頼内容

D-01 と D-02 を **2 本の独立 PR で発行**（base = develop）し、PR body 内で相互参照する。

| PR | branch | 内容 |
|---|---|---|
| D-01 | feature/tree-phase-d-01-implementation-20260427 | tree_calling_sessions / tree_call_records schema migration（677 + 135 行）|
| D-02 | feature/tree-phase-d-02-implementation-20260427 | オペレーター UI 全 10 Step（9 commits、SHA be6ef68）|

各 PR body に「セットリリース」明記（D-01 merge 後に D-02 merge 推奨、D-02 単体で merge すると schema 不在で起動失敗）。

▼ PR body に含める内容（D-02 側）

1. **Summary**: D-02 全 10 Step 完走、FileMaker 代替の中核機能 α 版稼働可能水準到達
2. **commit 履歴**: 
   - bc3bcfa Step 1+2 / 60fbc7d Step 3 / be6ef68 中間 handoff / 58cc003 Step 4 / 10a04c0 Step 5+6 / 69e345b Step 7 / c616772 Step 8 / 60e422d Step 9 / 7dfee13 Step 10
3. **テスト結果**: 727 PASS / 0 FAIL / TypeScript 0 errors / ESLint 追加分 0 errors
4. **既知課題（α 版開始前 要確認）**:
   - Breeze 画面 役割齟齬（D-04 着手前 確認）
   - ng_timeout CHECK 制約（D-2 で決定）
   - D-01 migration 投入確認（東海林さん）
   - 既存 ESLint 11 errors（タイマー系、D-06 で対処）
5. **干渉回避**: 既存 /tree/call / _lib/queries.ts insertCall / _constants/callButtons.ts 不変
6. **レビュー依頼**: a-review（priority 1: D-1 + D-2 セット最重要）

▼ レビュー期限希望

- 5/3 GW 中盤までに APPROVE 期待（α 版開始は §17 Tree 特例 1 人 → 2-3 人 → 半数 → 全員 段階展開）
- a-review への priority 1-2 扱い（FileMaker 代替の中核）

▼ PR 発行手順（参考）

```bash
# D-01 PR
gh pr create --repo Hyuaran/garden \
  --base develop \
  --head feature/tree-phase-d-01-implementation-20260427 \
  --title "feat(tree): Phase D-01 schema migration（tree_calling_sessions + tree_call_records）" \
  --body "<上記内容 + D-02 PR への相互参照>"

# D-02 PR（D-01 PR 番号確定後）
gh pr create --repo Hyuaran/garden \
  --base develop \
  --head feature/tree-phase-d-02-implementation-20260427 \
  --title "feat(tree): Phase D-02 オペレーター UI 全 10 Step（FileMaker 代替中核）" \
  --body "<上記内容 + D-01 PR 番号 への相互参照>"
```

▼ 完了後の連絡

PR 番号 2 件を a-main-009 に共有してください。
（a-main 側で a-review に priority 1 扱いの再依頼短文を起草します）

▼ 注意点

- B 垢 ShojiMikoto-B での push（gh auth setup-git 済前提）
- Vercel build 失敗の可能性: D-01 migration が garden-dev 投入前なら一部失敗の可能性 → PR body に known-issue 明記
- 5 分間隔遵守（旧 ShojiMikoto suspended 教訓、memory `feedback_main_session_lessons_005.md` §4.1）
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-tree に上記短文投下 | 東海林さん |
| 2 | a-tree が D-01 + D-02 PR 2 本発行 | a-tree |
| 3 | PR 番号 a-main に報告 | a-tree → a-main-009 |
| 4 | a-main が a-review に priority 1 扱い再依頼短文起草 | a-main-009 |
| 5 | a-review が D-01 + D-02 セット レビュー → APPROVE → merge | a-review / 東海林さん |

## 改訂履歴

- 2026-04-27 初版（a-main-009、D-02 全 10 Step 完走を受けた D-01 + D-02 セット PR 発行依頼）
