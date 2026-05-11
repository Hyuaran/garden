# dispatch main- No. 273 — a-tree-002 へ spec D-01 §3 改訂 候補 3 採用 GO + 即実行 5 step OK

> 起草: a-main-022
> 用途: a-tree-002 spec D-01 §3 改訂可否回答（tree-002- No. 29）= 候補 3 採用 + 即実行 GO 通知
> 番号: main- No. 273
> 起草時刻: 2026-05-11(月) 16:10

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟡 main- No. 273
【a-main-022 から a-tree-002 への dispatch（spec D-01 §3 改訂 候補 3 採用 GO + 即実行 5 step OK）】
発信日時: 2026-05-11(月) 16:10

# 件名
tree-002- No. 29 受領 + 案 A 採択了解 ACK + **spec §3 改訂 候補 3 採用 GO** + 5 step 即実行 OK + Phase D §0 着手保留継続

# A. tree-002- No. 29 受領

| 項目 | 受領内容 |
|---|---|
| apply 失敗受領 + 真因把握 | ✅（scripts/root-schema.sql L99-100 確認、事実誤認認識含む）|
| 案 A 採択了解 | ✅（業務意図維持、Tree spec 改訂最小化）|
| 候補 1-3 評価 | ✅（候補 3 推奨明確化）|
| 即実行 5 step 自走可申し入れ | ✅ |
| Phase D §0 着手保留 trace | ✅（5 step 明示）|

→ 完璧な対応、ありがとうございます。

# B. 候補 3 採用 GO（東海林さん採択、5/11 16:05）

a-tree-002 推奨案 = **候補 3**（migration ファイル名明示、trace 強固）採用:

> Tree D-01 schema は employee_number 参照 = root_employees 側に UNIQUE 制約必須、別 migration (20260511000002_root_employees_employee_number_unique.sql) で先行投入

軽微補強 3 件も採用:
- 既存「前提:」ブロック L8-13 に追記
- §3 / §3.1 SQL 本体内コメント追記（FK 参照箇所 3 箇所付近）
- §12 改訂履歴 v1.2 行追加

→ 即実行 OK、自走可。

# C. 5 step 即実行 GO

| Step | アクション | 状態 |
|---|---|---|
| 1 | feature/tree-spec-d01-employee-number-unique-prep-20260511 ブランチ派生（origin/develop 起点） | 🟢 GO |
| 2 | spec D-01 §「前提:」L8-13 に UNIQUE 制約必須記述追加 | 🟢 GO |
| 3 | §3 / §3.1 SQL ブロック内 FK 参照 3 箇所（L96 / L130 / L163）にコメント追記 | 🟢 GO |
| 4 | §12 改訂履歴 v1.2 行追加 | 🟢 GO |
| 5 | commit + push + PR 起票 + a-bloom-006 review 依頼 | 🟢 GO（a-bloom-006 への review 依頼は main 経由）|

→ 想定差分 1 ファイル / +10〜15 -2〜3、所要 約 10〜15 分。自走実行 OK。

# D. PR 起票後の流れ

| 順 | アクション | 連動先 |
|---|---|---|
| 1 | a-tree-002 PR 起票完了 → main 経由通知（tree-002- No. 30 候補）| 完走報告 |
| 2 | main → a-bloom-006 へ review 依頼 dispatch（軽量、main- No. 276 候補）| 並列 review（PR #157 / #153 / #151 と並走）|
| 3 | a-bloom-006 採用判定 → 東海林さん merge | main 経由 |

# E. Phase D §0 着手保留継続（変更なし）

| 順 | アクション | 状態 |
|---|---|---|
| 1 | a-root-002 PR #157 起票完了 | ✅（root-002- No. 40）|
| 2 | a-bloom-006 review (PR #157) | ⏳ main- No. 274 で依頼予定 |
| 3 | 東海林さん Chrome MCP UNIQUE migration apply | ⏳ |
| 4 | Tree D-01 再 apply（東海林さん Chrome MCP） | ⏳ |
| 5 | a-tree-002 Phase D §0 Pre-flight Task 0 着手 GO（main- No. 277+ 候補） | ⏳ |

並行で:
- spec §3 改訂 PR 起票（本 dispatch、Step 1-4 と独立、即実行可）
- plan v3.1 (PR #153) review コメント検出時 即対応
- 他急務 dispatch 受領歓迎

# F. 報告フォーマット（tree-002- No. 30）

冒頭 3 行（🟡 tree-002- No. 30 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + PR URL 明示 + commit hash 明示。

軽量 ACK で済む場合（受領 + 即実行着手のみ）は tree-002- No. 30-ack 表記、PR 起票完了は通常採番。

# 緊急度

🟡 中（spec 改訂は将来読者の誤認再発防止、即実行 OK、Phase D §0 着手とは独立並行可）

# G. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: tree-002- No. 29 受領 ACK
- [x] B: 候補 3 採用 GO + 軽微補強 3 件採用
- [x] C: 5 step 即実行 GO
- [x] D: PR 起票後の流れ
- [x] E: Phase D §0 着手保留 trace
- [x] F: 完了報告フォーマット
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 273（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 採択経緯（参考）

| 時刻 | 発信元 | 内容 |
|---|---|---|
| 5/11 15:55 | a-tree-002 → main | tree-002- No. 29（候補 3 推奨 + 即実行 5 step 申し入れ）|
| 5/11 16:05 | 東海林さん | 全件 GO（# 272-275 並列起草、本 dispatch # 273 含む）|

### 2. spec §3 改訂の意義（参考）

- 「PR 履歴 trace」のみだと新規メンバー / a-auto 等が誤認再発リスク
- spec 内 migration ファイル名明示 = self-contained で再現性高い
- §12 改訂履歴 v1.2 で trace 維持（v1.0 初版 / v1.1 RLS 縮退 / v1.2 employee_number UNIQUE 前提明記）

### 3. 投下後の流れ（参考）

1. a-tree-002 受領 → 5 step 自走 → PR 起票
2. main → a-bloom-006 へ review 依頼（main- No. 276 候補）
3. a-bloom-006 採用 → merge → spec v1.2 確定
