# a-review dispatch - Tree D-01 (#109) + D-02 (#110) priority 1 レビュー依頼 - 2026-04-27

> 起草: a-main-009
> 用途: a-tree が D-01 + D-02 セット PR を発行（#109 + #110）に伴う、a-review への priority 1 レビュー依頼
> 前提: memory `project_tree_d2_release_strategy.md`（D-1 + D-2 セットリリース戦略）+ §17 Tree 特例

## 投下短文（東海林さんが a-review にコピペ）

【a-main-009 から a-review へ】Tree D-01 (#109) + D-02 (#110) priority 1 セットレビュー依頼

▼ 経緯
- 4/27 a-tree が Phase D-02 全 10 Step 完走（9 commits、727 PASS、TS/ESLint clean）
- D-01 (schema migration) + D-02 (オペレーター UI) を 2 本の独立 PR で発行（セットリリース戦略）
- FileMaker 代替の中核機能、§17 Tree 特例（α 版 1 人 → 2-3 人 → 半数 → 全員）の前段

▼ 対象 PR

| PR | URL | 内容 | サイズ |
|---|---|---|---|
| D-01 #109 | https://github.com/Hyuaran/garden/pull/109 | tree_calling_sessions + tree_call_records schema migration | 677 + 135 行、Trigger 6 種 / RLS / VIEW |
| D-02 #110 | https://github.com/Hyuaran/garden/pull/110 | オペレーター UI 全 10 Step | 9 commits、Server Actions 3 / Hooks 4 / Components 2 / Lib 3 / Page 1 |

▼ 推奨マージ順序

#109 (D-01) → #110 (D-02) の順。D-02 単体 merge は schema 不在で起動失敗のため厳禁。両 PR body に相互参照記載済。

▼ priority

**priority 1（最重要）**。理由:
- FileMaker 代替の中核（コールセンター業務の心臓部、年内切替目標）
- §16 Tree 厳格度: 🔴 最厳格、§17 段階展開（1 人 → 2-3 人 → 半数 → 全員）の前提
- 既知課題 4 件あり、α 版開始判断材料として重要

▼ 既知課題（PR body に明記済）

| # | 内容 | 対応時期 |
|---|---|---|
| 1 | Breeze 画面 役割齟齬（既存実装はチャット画面、spec §3.4 は呼吸連続架電）| D-04 着手前 確認 |
| 2 | ng_timeout CHECK 制約拡張（spec §3.6 の ng_timeout が D-01 12 種に含まれない）| D-2 で決定 |
| 3 | D-01 migration 投入確認（garden-dev 反映）| 東海林さん側 |
| 4 | 既存 ESLint 11 errors（タイマー系コンポーネント）| D-06 品質向上で対処 |

▼ 検証結果（PR body より）

- ✅ Vitest: 727 PASS / 0 FAIL（30 test files）
- ✅ TypeScript: 0 errors
- ✅ ESLint 本ブランチ追加分: 0 errors
- ✅ 既存 /tree/call / _lib/queries.ts insertCall / _constants/callButtons.ts 不変（干渉回避遵守）

▼ 期待アクション

- D-01 + D-02 セットレビュー（priority 1）
- 5/3 GW 中盤までに APPROVE 期待
- APPROVE 後、東海林さん側で D-01 migration を garden-dev に適用 → α 版開始判断（§17）

▼ 注意点

- Tree は §16 で🔴最厳格扱い、コールセンター業務停止リスクあり
- 既知課題 4 件のうち #1 Breeze 役割齟齬は D-04 着手前判断、merge 自体には影響しない
- conflict 状態は現時点なし（D-01/D-02 ともに最新 develop ベース）

▼ 報告先

レビュー結果（APPROVE / CONDITIONAL / REQUEST CHANGES）を a-main-009 に共有してください。
（a-main 側で APPROVE なら東海林さんに merge 進行指示、CHANGE REQUEST なら a-tree に修正 dispatch）

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-review に上記短文投下 | 東海林さん |
| 2 | a-review が #109 → #110 順にレビュー | a-review |
| 3 | レビュー結果を a-main に共有 | a-review → a-main-009 |
| 4 | APPROVE → 東海林さん側で migration 適用 → merge | 東海林さん / a-main-009 |
| 5 | α 版開始判断（§17 段階展開） | 東海林さん |

## 改訂履歴

- 2026-04-27 初版（a-main-009、Tree D-01 + D-02 セット priority 1 レビュー依頼）
