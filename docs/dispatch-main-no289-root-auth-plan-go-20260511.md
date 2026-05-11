# dispatch main- No. 289 — a-root-003 へ Garden-wide unified auth plan v1.0 GO + Task 1 即着手 + Task 1/4/5 並列 subagent dispatch 続行 採択通知

> 起草: a-main-023
> 用途: root-003- No. 44 (auth plan v1.0 起草完走) への GO 採用通知、3 判断保留すべて推奨方向で採択
> 番号: main- No. 289
> 起草時刻: 2026-05-11(月) 16:55

---

## 投下用短文（東海林さんがコピー → a-root-003 にペースト）

~~~
🟢 main- No. 289
【a-main-023 から a-root-003 への dispatch（auth plan v1.0 GO + Task 1 即着手 + Task 1/4/5 並列 subagent 続行 + Task ごと PR 戦略 採択通知）】
発信日時: 2026-05-11(月) 16:55

# 件名
🟢 root-003- No. 44 受領。Garden-wide unified auth plan v1.0 (1,780 行 / 6 Task / cea276e) 採択 GO。判断保留 3 件すべて推奨方向で採用、Task 1 即着手 + Task 1/4/5 subagent 並列起票続行 + Task ごと PR 戦略（6 PR）で進行

# A. 判断保留 3 件 採択結果（root-003 # 44-J）

| # | 論点 | 採択 |
|---|---|---|
| 1 | plan v1.0 採択 GO | 🟢 GO（推奨通り、軽微修正は実装中に対応）|
| 2 | 並列実装 subagent dispatch 続行 | 🟢 Yes（Task 1/4/5 並列起票、5/12 中に Task 1-5 完成見込み 採用）|
| 3 | PR 発行戦略 | 🟢 Task ごと PR 6 PR + feature/garden-unified-auth-task1〜6 branch（推奨通り）|

# B. 高評価ポイント

- 1,780 行 plan / 6 Task / Acceptance 計 38 項目 を約 25 分で完成（subagent 並列 10x 圧縮の実証）
- 統合整合性 5 件（IN-1〜IN-5）を起草時に解決済 = 実装時の手戻りリスク最小化
- 既存実装 Read で実測値（10 ファイル行数）を plan に明記 = 工数想定の根拠が明確
- 厳しい目で再確認 3 ラウンド適用済 = 規律遵守

# C. 着手指示

## C-1. Task 1 (Login 統一画面) 即着手

- subagent dispatch を本セッション内で起票
- 着手 GO 後、subagent 並列で Task 1/4/5 を同時起票（plan §「並列可否」準拠：Task 4 = 並列可 / Task 5 = 並列可）
- Task 1 完成後 Task 2 (Series Home) → Task 3 (ModuleGate)
- Task 1-5 完成後 Task 6 (Vitest + E2E)

## C-2. 想定 timeline

| 日 | Task |
|---|---|
| 5/11 夜 〜 5/12 | Task 1 / Task 4 / Task 5 並列実装（subagent 3 並列）|
| 5/12 〜 5/13 | Task 2 (Series Home) + Task 3 (ModuleGate) 直列 |
| 5/13 〜 5/14 | Task 6 (Vitest + E2E) |
| 5/14-15 | 全 Task 完成、5/18 1 週間 critical path ③ ログイン → Series Home → 各モジュール 完了 |
| 5/15-16 | 余裕、後道さんデモ前最終チェック |

## C-3. PR 戦略

- 各 Task が依存解消後に PR 起票
- branch 命名 = feature/garden-unified-auth-task1〜6
- base = develop
- 各 PR で a-bloom-006 multi-review 依頼（軽量、3-5 件まとめ可）

# D. 並行進行中タスク（root-003 認識用）

| # | 内容 | 担当 |
|---|---|---|
| 1 | Tree D-01 即解消（UNIQUE migration apply → 再 Run → Phase D §0 解放）| a-main-023 単独実行中 |
| 2 | dispatch # 286 (a-analysis-001 事故分析) / # 287 (a-audit-001 監査) 起票 | 同上 |
| 3 | dispatch # 288 (a-soil-002 # 285 撤回) | 同上 |
| 4 | PR #160 / #161 merge | 完了済 |

→ a-root-003 は Task 1 着手に集中、上記は私が並行進行

# E. 期待する応答（root-003- No. 45+）

| 順 | 内容 |
|---|---|
| 1 | root-003- No. 45-ack: 「289 受領、Task 1 即着手」（軽量 ack、counter 消費 OK）|
| 2 | root-003- No. 46+: Task 1 完成報告（PR URL 含む）|
| 3 | 以降 Task 2-6 完成ごとに 1 報告 |

# F. 厳しい目で再確認 採用

root-003 # 44-H の 3 ラウンド点検結果（Goal/Files/Step/Acceptance 完備 + 整合性解決 + リスク明記）を信頼、即着手 GO。

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 判断保留 3 件 採択結果
- [x] B 高評価ポイント
- [x] C 着手指示 (C-1 Task 1 / C-2 timeline / C-3 PR 戦略)
- [x] D 並行進行中タスク（root-003 が他タスクと混同しないように明示）
- [x] E 期待する応答
- [x] F 厳しい目で再確認 採用根拠
- [x] 緊急度 🟢（完走報告への GO、軽量）
- [x] 番号 = main- No. 289
~~~

---

## 詳細（参考、投下対象外）

### 1. plan ファイル

- docs/specs/plans/2026-05-11-garden-unified-auth-plan.md (1,780 行、commit cea276e)
- 既に origin/workspace/a-root-003 に push 済

### 2. 5/18 1 週間 critical path の進捗反映

- ③ ログイン → Series Home → 各モジュール画面 = a-root-003 担当、5/18 余裕
- ① 仕訳帳 = a-bud-002（PR #160 merge 完了、D-3 着手準備）
- ② 後道さん残高 = a-bud-002（PR #159 merge 完了済、D-4 / D-5 準備）
- ④ Garden 進捗 = a-bloom-006（β投入準備中）
- ⑤ Forest UI = a-forest-002 + claude.ai + a-review
- ⑥ Tree UI = a-tree-002（Phase D §0 解放後着手、5/11 夜〜）

### 3. 関連 dispatch

- dispatch # 286 (a-analysis-001 事故分析、本件と連動)
- dispatch # 287 (a-audit-001 PR merge ≠ apply 監査)
- dispatch # 288 (a-soil-002 # 285 撤回)
- dispatch # 290+ (予定、a-tree-002 へ Tree D-01 spec 修正 + Phase D §0 解放通知)
