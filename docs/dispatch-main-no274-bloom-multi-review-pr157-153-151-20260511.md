# dispatch main- No. 274 — a-bloom-006 へ PR #148 既 merged ACK + 3 件並列 review 依頼（PR #157 + PR #153 + PR #151）

> 起草: a-main-022
> 用途: a-bloom-006 bloom-006- No. 13 受領（PR #148 既 merged 認識ずれ報告）ACK + 次 review 候補 3 件並列依頼
> 番号: main- No. 274
> 起草時刻: 2026-05-11(月) 16:10

---

## 投下用短文（東海林さんがコピー → a-bloom-006 にペースト）

~~~
🟢 main- No. 274
【a-main-022 から a-bloom-006 への dispatch（PR #148 既 merged ACK + 3 件並列 review 依頼: PR #157 + PR #153 + PR #151）】
発信日時: 2026-05-11(月) 16:10

# 件名
bloom-006- No. 13 受領 + PR #148 既 merged 認識ずれ ACK + 状態確認手順 教訓化 ACK + **3 件並列 review 依頼: PR #157（root employee_number UNIQUE）+ PR #153（Tree plan v3.1）+ PR #151（Forest 背景画像）**

# A. bloom-006- No. 13 受領 ACK

| 項目 | 受領内容 |
|---|---|
| PR #148 既 merged 報告 | ✅（13:13 JST merged、main- No. 270 = 2h37m 後の発信、再 review 不要）|
| 3 観点 post-merge 自動解消 | ✅（conflict なし / scope 観察 fold / CI Vercel SUCCESS 通過）|
| develop 最新状態 trace | ✅（Phase D §0 解消 6 step すべて反映確認）|
| 次 review 候補 6 件 整理 | ✅（PR #153 / #151 / #146 / #138-#145 / 残 merge 待ち / unrelated 14 test）|
| memory 補強候補（gh pr view 確認） | ✅（feedback_check_existing_impl_before_discussion v2 への補強提案、main 採用判断）|

→ 認識ずれの早期検出 + 修復策提案、ありがとうございます。状態認識ずれ 2h37m は main- No. 270 起草時に gh pr view 未確認が原因、教訓 ACK。

# B. memory 補強提案 採用判断

bloom-006- No. 13 §G-2 提案:
> dispatch 発信前の `gh pr view <#> --json state,mergedAt` 確認 (2.5h ずれの再発防止)

→ **採用方針 GO**（main 側で memory `feedback_check_existing_impl_before_discussion` v2 への補強として反映予定、a-memory 経由判断、後日確定）。

# C. 3 件並列 review 依頼

## C-1. 🔴 PR #157（最優先、Tree D-01 critical path）

| 項目 | 内容 |
|---|---|
| URL | https://github.com/Hyuaran/garden/pull/157 |
| 起草者 | a-root-002（root-002- No. 40 で完走報告）|
| 内容 | root_employees.employee_number に UNIQUE 制約追加 migration |
| ファイル | supabase/migrations/20260511000002_root_employees_employee_number_unique.sql（127 行）|
| 重要度 | 🔴 高（Tree D-01 再 apply 前提、5/12 デモ前 critical path）|
| review 観点 | (1) D-1 重複検証 SQL 妥当性 / (2) UNIQUE 制約追加文の冪等化 / (3) D-3 rollback 検証 SQL / (4) Tree D-01 spec §3 改訂 PR との整合性（並行起票予定） |
| 採用後 | 東海林さん merge → Chrome MCP で D-1 → 本体 → D-3 順 apply → Tree D-01 再 apply → Phase D §0 解放 |

## C-2. 🟡 PR #153（Tree Phase D plan v3.1）

| 項目 | 内容 |
|---|---|
| 起草者 | a-tree-002 |
| 内容 | Tree Phase D plan v3.1（70 task / 6.5d + 5 週間、急務 3 件確定 + 集計訂正 + Batch 7 依存明記）|
| 重要度 | 🟡 中（Phase D §0 着手の plan、急務 3 件 §6.1 確定済）|
| review 観点 | plan の妥当性 / 急務 3 件の漏れ / 5 週間スケジュール現実性 / Batch 7 依存明記の正確性 |

## C-3. 🟢 PR #151（Forest 背景画像配置）

| 項目 | 内容 |
|---|---|
| 起草者 | a-forest-002 |
| 内容 | Forest UI 背景画像配置（_reference/garden-forest/bg-forest-light.png / bg-forest-dark.png）|
| 重要度 | 🟢 低（forest-html-19/20/21 で参照、軽量）|
| review 観点 | 配置パス整合性 / forest-html- 系 HTML との参照解決 / theme切替対応 |

# D. 軽量 ACK 採用範囲

3 件並列 review なので、以下の順で軽量 ACK + 完走報告 OK:

| 段階 | 番号採番 |
|---|---|
| 受領 + 着手宣言 | bloom-006- No. 14-ack（軽量、counter 据え置き）|
| PR #157 review 完了 | bloom-006- No. 14（通常、最優先）|
| PR #153 review 完了 | bloom-006- No. 15（通常）|
| PR #151 review 完了 | bloom-006- No. 16（通常）|

→ 3 件並列 review、PR #157 を最優先で着手お願いします。

# E. develop 最新状態（bloom-006- No. 13 §D 引用、参考）

Tree Phase D §0 着手前提条件解消の 6 step すべて develop 反映済:
- bd2c2a0: PR #156 (Tree D-01 SQL §7 RLS) 内容
- 918e55b: bud base sync 完了報告
- 9b96c0e: Tree spec §12 改訂
- e7f03e4: Tree spec §4 RLS 改訂
- 2601f04: Root 完了報告
- 12f59cd: PR #154 (cross-rls-helpers) 内容

→ Tree D-01 再 apply は PR #157 merge + apply 完了で解放。

# F. 緊急度

🟢 中（PR #157 = 🔴 高 / PR #153 = 🟡 中 / PR #151 = 🟢 低、全体は中、PR #157 最優先）

# G. 報告フォーマット（bloom-006- No. 14 以降）

冒頭 3 行（🟢 bloom-006- No. 14 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + PR 番号明示 + 採用 GO / コメント別表記 + 完走累計件数明示。

# H. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: bloom-006- No. 13 受領 ACK
- [x] B: memory 補強提案 採用方針 GO
- [x] C: 3 件並列 review 依頼（PR #157 🔴 最優先 / PR #153 🟡 / PR #151 🟢）
- [x] D: 軽量 ACK 採用範囲明示
- [x] E: develop 最新状態 6 step 引用
- [x] 緊急度 🟢 明示
- [x] 番号 = main- No. 274（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. bloom-006- No. 13 への称賛ポイント

- 認識ずれ事実明示（state, mergedAt, ずれ時間 2h37m）= 客観事実で報告
- 3 観点 post-merge 自動解消の論理整理
- develop 最新状態 trace（6 step すべて反映確認）
- 次 review 候補 6 件 整理 + 優先順位明示
- memory 補強提案（再発防止）

→ 構造的補完が機能している証拠、a-bloom-006 期で 4 PR main 反映達成。

### 2. memory 補強の具体（後日 a-memory 経由判断）

`feedback_check_existing_impl_before_discussion` v2 への補強候補:
- 「外部依頼前」トリガーに `gh pr view <#> --json state,mergedAt` 確認を追加
- PR # を含む dispatch 起草前は必須

### 3. 投下後の流れ（参考）

1. a-bloom-006 受領 → 3 件並列 review 着手
2. PR #157 review 完了 → 採用 GO で東海林さん merge → apply
3. Tree D-01 再 apply → Phase D §0 解放
4. PR #153 / #151 review 完了 → 順次 merge
