# a-auto-004 への PR self-review + merge order 整理 dispatch - 2026-04-27

> 起草: a-main 008
> 用途: a-auto-004 (autonomous モード) に PR レビュー支援を委ねる、a-review の負担軽減 + 効率最大化
> 前提: 50+ PR が本日中に open、a-review 単独レビューは時間的厳しい

## 投下短文（東海林さんが a-auto-004 にコピペ）

```
【a-main-008 から a-auto-004 へ】PR self-review + merge order 整理 task 投下

▼ 背景
本日 4/27 中に Phase 1 (5 docs) + Phase 2 (5 critical) + Phase 3 (35 feature) = **50+ PR** が一括 open。
a-review が個別レビューする前段階として、a-auto-004 (autonomous モード) で **self-review + merge order 整理**を行い、a-review の作業を効率化する。

▼ Task: PR self-review + merge order 整理

各 open PR について以下を整理し、`_shared/decisions/pr-merge-order-self-review-20260427.md` に出力：

1. **PR self-review** (各 PR ごと):
   - PR title + branch + 関連 module
   - 主な変更内容（commit log + diff から読み取る）
   - 推定リスク（Low / Medium / High）
   - 推奨 merge timing（即 merge OK / a-review 確認後 / 保留）

2. **PR 間依存関係マッピング**:
   - base ブランチ依存（例: PR A の base が PR B のブランチ場合）
   - batch10 派生 PR の merge 順序（PR #7 / #9 / #10 は batch10 merge 後）
   - root-pending-decisions (#30) は root-permissions-and-help-specs (#27) merge 後

3. **推奨 merge 順序（全 50+ PR）**:
   - 第 1 波: docs PR 5 件（即 merge OK、影響なし）
   - 第 2 波: 重大指摘 5 件（セキュリティ最優先）
   - 第 3 波: a-bloom-002 大規模 PR（5/5 デモ UI、最重要）
   - 第 4 波: a-tree D-01 + D-02（FileMaker 代替中核）
   - 第 5 波: a-root Phase B（権限管理）
   - 第 6 波: その他 feature（並行可）
   - 第 7 波: a-auto 系 spec / docs（batch10 順序考慮）

4. **既知の issue リスト**:
   - feature/bloom-login-and-returnto-fix の Vercel failure（develop 全体課題、範囲外）
   - cross-history-delete-specs-batch14-auto-v2 の develop conflict（merge 時解消必要）
   - その他観察された issue

5. **a-review への提案**:
   - 各 PR の優先順 + 理由
   - 効率化のためのレビュー分担案

▼ 制約（厳守）

- ✅ **read-only 操作のみ**（git log + spec ファイル read + gh pr view 等）
- ❌ 新 commit / push 禁止
- ❌ 新 branch 作成禁止
- ❌ PR への comment 投稿は禁止（a-auto は read-only、judgement は a-review 担当）
- ✅ `_shared/decisions/` への新規ファイル作成のみ可（git 追跡外）
- ✅ 既存 PR body の解析・要約 OK

▼ 規模見込み

50+ PR × 平均 30 行 = 約 1500-2000 行、想定 0.4d

▼ 詰まり時

即停止 → a-main 経由で東海林さんに相談
特に PR 間依存関係の判断は微妙な場合あり、判断保留があれば即停止

▼ 完了報告

完了次第 a-main 経由で報告。a-review は本ファイルを参照して効率的にレビュー進行可能になる。

▼ 並走推奨

a-auto-004 が PR self-review 整理中、a-review は **第 1 波（docs 5 件）+ 第 2 波（重大指摘 5 件）から先行レビュー**可能。両者並行で全 50+ PR を本日〜明日中に処理する。

▼ 報酬

これで a-review の負担が大幅軽減、Garden 全 50+ PR の merge が効率化される。
品質最優先で進めてください。
```

## 完了後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | a-auto-004 が PR self-review + merge order を整理 | a-auto-004 |
| 2 | 出力ファイル: `_shared/decisions/pr-merge-order-self-review-20260427.md` | a-auto-004 |
| 3 | 完了報告 | a-auto-004 → a-main |
| 4 | a-review が本ファイル参照で効率レビュー | a-review |
| 5 | a-review レビュー完了 → 各 PR approve / change request / 保留 | a-review |
| 6 | merge 実行（順序通り）| 東海林さん or a-main |

## 改訂履歴

- 2026-04-27 初版（a-main 008、Phase 3 起動中、a-review 効率化のための a-auto-004 並走 task）
