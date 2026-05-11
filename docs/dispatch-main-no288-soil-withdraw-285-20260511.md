# dispatch main- No. 288 — a-soil-002 へ dispatch # 285 撤回 + Tree D-01 真因 (root_employees UNIQUE 未適用) 確定通知 + Phase B-01 別途進行 GO

> 起草: a-main-023
> 用途: dispatch # 285 (Soil 先行 apply 依頼) の前提誤りを撤回、a-soil-002 待機解除、Phase B-01 は予定通り進行
> 番号: main- No. 288
> 起草時刻: 2026-05-11(月) 16:55

---

## 投下用短文（東海林さんがコピー → a-soil-002 にペースト）

~~~
🟡 main- No. 288
【a-main-023 から a-soil-002 への dispatch（# 285 撤回 + Tree D-01 真因 確定通知 + Phase B-01 別途進行 GO）】
発信日時: 2026-05-11(月) 16:55

# 件名
🟡 dispatch # 285 (Soil Phase B-01 先行 apply 緊急依頼) は前提誤りで撤回。Tree D-01 42830 真因 = root_employees.employee_number UNIQUE 未適用（PR #157 が GitHub merge のみで Supabase apply 漏れ）と確定。soil-62 ご指摘の spec mismatch は別問題、a-tree-002 が中期で spec 修正担当。Phase B-01 は予定通り 5/12-13 で進行 GO

# A. dispatch # 285 撤回理由

## A-1. soil-62 の機械集計 + 私 (a-main-023) の REST 検証 で確定した真因

| 観点 | soil-62 | a-main-023 REST 検証 | 結論 |
|---|---|---|---|
| soil_call_lists 実テーブル | 存在せず（real = soil_lists, uuid PK）| 404 NOT EXISTS | ✅ 一致：spec mismatch だが Tree D-01 IF EXISTS guard で skip |
| root_employees.employee_number UNIQUE | 未言及 | 🔴 未適用 立証（重複 INSERT 成功）| 🆕 a-main-023 発見：これが 42830 直接真因 |

## A-2. 構造
- Tree D-01 schema の inline FK `REFERENCES root_employees(employee_number)` が UNIQUE 未存在で 42830
- soil_call_lists 関連の FK は IF EXISTS guard 内、garden-dev に soil_call_lists 不存在のため skip → 42830 の原因ではない
- → Soil 先行 apply は Tree D-01 解消に不要

# B. 即解消経路（a-main-023 が単独実行中、Soil 関与不要）

| Step | アクション | 担当 |
|---|---|---|
| 1 | migration `20260511000002_root_employees_employee_number_unique.sql` を garden-dev に apply | a-main-023 |
| 2 | UNIQUE 制約検証 SQL | a-main-023 |
| 3 | Tree D-01 (`20260427000001_tree_phase_d_01.sql`) 再 Run | a-main-023 |

# C. soil-62 ご指摘の spec mismatch（中期、a-tree-002 担当）

soil-62 §6 の解決案 A を採択（Tree D-01 spec を実 Soil 実装に整合修正）：
- soil_call_lists → soil_lists
- soil_call_histories → soil_call_history
- list_id bigint → list_id uuid REFERENCES soil_lists(id)

担当 = a-tree-002（次 dispatch # 290 以降で起票予定）
着手予定 = Tree D-01 即解消（B）完了後、Phase D §0 解放と並行

# D. Phase B-01 別途進行 GO

- Soil Phase B-01 migration 8 本の garden-dev apply は予定通り 5/12-13 で進行 OK
- Tree D-01 とは独立、急がなくて OK
- 進行ペースは a-soil-002 の Phase 2 (CSV parser / INDEX) 完成タイミングに合わせて自然に

# E. a-soil-002 への直接依頼

| # | 内容 |
|---|---|
| 1 | dispatch # 285 で求めた緊急先行 apply は不要、待機解除 |
| 2 | 現在進行中の Phase B-01 Phase 2 (CSV parser / INDEX migration / admin UI) 継続 |
| 3 | Phase B-01 migration 8 本の Supabase apply は別途 5/12-13 で計画的に実施（a-main-023 と連携、急ぎは不要）|
| 4 | spec mismatch 解消は a-tree-002 担当、a-soil-002 側の Soil 実装変更は不要 |

# F. ACK 形式

「288 受領、待機解除 + Phase B-01 Phase 2 継続」の 1 行で OK。詳細報告不要。

# G. 緊急度

🟡 中（撤回通知、a-soil-002 待機解除）

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 撤回理由（soil-62 + 私の REST 検証 二方向確認）
- [x] B 即解消経路（私単独実行、Soil 関与不要）
- [x] C spec mismatch 中期解消（a-tree-002 担当）
- [x] D Phase B-01 別途進行 GO
- [x] E 直接依頼 4 件
- [x] F ACK 形式（軽量、1 行で OK）
- [x] 番号 = main- No. 288
~~~

---

## 詳細（参考、投下対象外）

### 1. soil-62 への返答

- soil-62 が提起した「設計判断ブロック」は解消（A 案採択）
- a-soil-002 単独で動けない状態 → 待機解除

### 2. 関連 dispatch

- dispatch # 286（a-analysis-001 事故構造分析）
- dispatch # 287（a-audit-001 PR merge ≠ apply 監査）
- dispatch # 289（a-root-003 # 44 GO）
- dispatch # 290（予定、a-tree-002 へ Tree D-01 spec 修正依頼）
