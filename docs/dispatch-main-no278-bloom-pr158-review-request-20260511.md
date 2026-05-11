# dispatch main- No. 278 — a-bloom-006 へ PR #158（Tree D-01 spec §3 改訂）review 依頼（軽量、軽微改善後の最終確認）

> 起草: a-main-022
> 用途: a-tree-002 PR #158 起票完了（spec §3 改訂、5 step 10 分完走）受領 → a-bloom-006 review 依頼
> 番号: main- No. 278
> 起草時刻: 2026-05-11(月) 16:25

---

## 投下用短文（東海林さんがコピー → a-bloom-006 にペースト）

~~~
🟢 main- No. 278
【a-main-022 から a-bloom-006 への dispatch（PR #158 Tree D-01 spec §3 改訂 review 依頼、軽量、軽微改善後の最終確認）】
発信日時: 2026-05-11(月) 16:25

# 件名
a-tree-002 PR #158 起票完了（spec D-01 §前提 + §3 FK 参照 3 件 + §12 v1.2 改訂、5 step 10 分完走）+ 軽量 review 依頼（migration ファイル名明示の整合性 + spec 改訂内容妥当性）

# A. PR #158 概要

| 項目 | 内容 |
|---|---|
| PR | #158 |
| URL | https://github.com/Hyuaran/garden/pull/158 |
| branch | feature/tree-spec-d01-employee-number-unique-prep-20260511 |
| base | develop |
| commit hash | 3fa438e04519a4d303c1cb58ec836e4effd4b8b6 |
| 差分 | 1 ファイル / +10 -0（spec のみ、コード変更なし）|
| 起草者 | a-tree-002（tree-002- No. 30）|
| 所要 | 約 10 分（15:13 着手 → 15:23 完了）|

# B. 変更内容サマリ

a-tree-002 採用 候補 3（migration ファイル名明示、trace 強固）:

## B-1. spec §「前提:」L8-13

既存「root_employees / garden_role 7 階層」直下に追加:
- 別 migration ファイル名: supabase/migrations/20260511000002_root_employees_employee_number_unique.sql
- 経緯: 42830 エラー → main- No. 269 案 A 採択
- 業務意図: employee_number ベース横断 FK 維持

## B-2. §3.1 / §3.2 / §3.3 SQL FK 参照箇所（L96 / L130 / L163）

各 FK 参照（REFERENCES root_employees(employee_number)）の直上にコメント追記:
- §前提条件 + 別 migration ファイル名参照

## B-3. §12 改訂履歴 v1.2

- v1.2 (2026-05-11, a-tree-002): 経緯 + 真因 + 採択結果 + trace 強化方針 網羅

# C. review 観点（4 件、軽量）

| # | 観点 | 評価軸 |
|---|---|---|
| 1 | migration ファイル名整合性 | PR #157 (a-root-002 起票) の migration 名と完全一致確認 |
| 2 | spec 改訂内容妥当性 | 候補 3 採用（migration ファイル名明示）が将来読者の誤認再発防止に十分か |
| 3 | コメント追記の可読性 | §3.1 / §3.2 / §3.3 SQL 内コメントが SQL 自体の可読性を損なわないか |
| 4 | §12 改訂履歴 v1.2 trace 完全性 | 経緯 + 真因 + 採択結果 + trace の 4 要素揃っているか |

→ 軽量 review、軽微改善 0 件想定（spec のみ、コード影響なし）= **採用推奨 GO** が標準想定。

# D. PR #157 との関係（並行 review）

| PR | 状態 | 関係 |
|---|---|---|
| #157 (a-root-002 起票、employee_number UNIQUE migration) | bloom-006- No. 14 採用推奨 ✅ | 本 PR #158 の migration ファイル名参照先 |
| #158 (a-tree-002 起票、spec §3 改訂) | review 依頼中（本 dispatch）| #157 ファイル名と整合性確認 |

→ 両 PR 整合性確認後、東海林さん merge → spec 改訂完了 + Tree D-01 再 apply 解放。

# E. 報告フォーマット（bloom-006- No. 17）

冒頭 3 行（🟢 bloom-006- No. 17 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 4 観点表 + 採用推奨 / コメント明示。

軽量 ACK で済む場合（採用推奨即返信）は bloom-006- No. 17-ack 表記 OK。

# F. 緊急度

🟢 低（spec 改訂、軽量、PR #157 merge ブロックではない、ただし整合性確認 critical path）

# G. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: PR #158 概要（URL + commit + 差分）
- [x] B: 変更内容サマリ（§前提 + §3 + §12）
- [x] C: review 観点 4 件（軽量）
- [x] D: PR #157 との関係（整合性確認）
- [x] E: 報告フォーマット
- [x] 緊急度 🟢 明示
- [x] 番号 = main- No. 278（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 投下後の流れ

1. a-bloom-006 受領 → 軽量 review（4 観点）
2. 採用推奨 → 東海林さん merge
3. Tree D-01 spec v1.2 確定 + 将来読者の誤認再発防止完了

### 2. spec 改訂の意義

- 「PR 履歴 trace」のみだと新規メンバー / a-auto 等が誤認再発リスク
- spec 内 migration ファイル名明示 = self-contained で再現性高い
- Tree Phase D §0 着手前提条件の trace 強化
