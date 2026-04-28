# Tree D-01 / D-02 セット merge 計画 + α 版開始判断 - 2026-04-27

> 起草: a-main-009
> 用途: a-tree が発行した PR #109 (D-01) + #110 (D-02) のセット merge 順序、α 版開始判断材料、§17 Tree 特例 5 段階展開
> 前提: a-review priority 1 レビュー依頼投下済（[a-review-dispatch-tree-d01-d02-priority1-20260427.md](a-review-dispatch-tree-d01-d02-priority1-20260427.md)）、結果待ち

## セット merge 戦略（memory `project_tree_d2_release_strategy.md` 準拠）

| 順 | PR | 内容 | merge 順序 必須 |
|---|---|---|---|
| 1 | **#109 D-01 schema migration** | tree_calling_sessions + tree_call_records + 7 migration + 2 VIEW + 6 Trigger + RLS | ✅ **先 merge** |
| 2 | **#110 D-02 オペレーター UI** | 全 10 Step、Server Actions 3 / Hooks 4 / Components 2 / Lib 3 / Page 1 | ✅ **D-01 merge 後** |

⚠️ **D-02 単体 merge 禁止**: schema 不在で起動失敗、tree_calling_sessions 等が存在しないため Server Action が即エラー。

## a-review APPROVE 後の merge 手順

### Step 1: D-01 (#109) merge

- a-review APPROVE 確認
- Vercel build SUCCESS 確認（spec 含むのみだが migration 等 SQL 改変ありで build 影響あり得る）
- 東海林さんが GitHub UI で「Merge pull request」（Create a merge commit 推奨）

### Step 2: garden-dev に migration 適用（東海林さん作業）

```sql
-- Supabase SQL Editor で実行（順序遵守）
-- migrations/20260425_tree_phase_d01_*.sql の内容
```

各 migration の冪等性確認:
- IF NOT EXISTS / OR REPLACE で 54 箇所済（a-tree 報告通り）
- garden-dev で動作確認 → garden-prod は α 版完了後

### Step 3: D-02 (#110) merge

- D-01 migration 適用後、5 分以上空けて merge
- a-review APPROVE 確認
- 東海林さんが GitHub UI で「Merge pull request」

### Step 4: develop → main reflect（5/5 デモ前）

5/5 デモは localhost で実施だが、GitHub も整合させる:

```
gh pr create --base main --head develop --title "release: 5/5 デモ前 develop → main reflect"
```

→ Vercel production deploy（東海林さん本人 GitHub UI 操作 or C 垢稼働後）

## α 版開始判断（§17 Tree 特例 5 段階展開）

| 段階 | 期間 | 対象 | 内容 |
|---|---|---|---|
| **α 版** | 1 週間 | **東海林さん 1 人** | 100 件実コール + spot-check 5 件 + §16 7 種テスト全 ✅ |
| β 1 版 | 1 週間 | **コールセンタースタッフ 1 名（信頼できる人）** | FileMaker 並行運用、新旧 ±10% 以内 |
| β 2-3 版 | 1 週間 | **2-3 人** | UX フィードバック ≤5 件 |
| half | 1-2 週間 | **半数（5-10 人）** | ±3% 以内、0 critical |
| full release | - | **全員** | FileMaker 30 日並行参照後切替 |

### α 版開始前の解消必須事項（a-tree handoff より）

| # | 課題 | 解消方法 |
|---|---|---|
| 1 | Breeze 画面 役割齟齬（既存実装 vs spec §3.4）| D-04 着手前 東海林さん確認 |
| 2 | ng_timeout CHECK 制約拡張 | D-2 で ng_other 集約 or 制約拡張 決定 |
| 3 | D-01 migration 投入確認（garden-dev）| 東海林さん本人 |
| 4 | 既存 ESLint 11 errors（タイマー系）| D-06 品質向上 |

→ #1 / #2 は **5/5 デモ前判断不要**（α 版開始前で OK）。
→ #3 は migration 適用と同時に解消。
→ #4 は post-α で OK。

## 5/5 デモへの影響

| 項目 | 状態 |
|---|---|
| 5/5 デモ自体 | localhost で実施、Tree D-01/D-02 必須ではない |
| Tree モジュール表示 | dispatch v7 V7-E で /tree route 既存（a-tree 旧実装）、Coming Soon 不要 |
| α 版開始 | 5/5 デモ後（後道さん採用判定後）に判断 |

→ Tree D-01/D-02 merge は **5/5 後でも OK**、急がない。

## post-5/5 のスケジュール（α 版開始想定）

| 週 | 内容 |
|---|---|
| 5/5 後 1 週目 | Tree D-01/D-02 merge + 既知課題 4 件解消 |
| 5/12 〜 | α 版（東海林さん 1 人、1 週間） |
| 5/19 〜 | β 1 版（コールセンタースタッフ 1 名、1 週間） |
| 5/26 〜 | β 2-3 版（1 週間） |
| 6/2 〜 | half リリース（1-2 週間） |
| 6/16 〜 | full release + FileMaker 30 日並行参照 |

→ **6 月末〜 7 月初旬で FileMaker 完全切替**目標。

## 改訂履歴

- 2026-04-27 初版（a-main-009、Tree D-01/D-02 セット merge + α 版 5 段階展開計画）
