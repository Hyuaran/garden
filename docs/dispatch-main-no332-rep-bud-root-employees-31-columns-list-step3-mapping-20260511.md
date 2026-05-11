# dispatch main- No. 332-rep — a-bud-002 No. 54 への返信、root_employees 実 31 列リスト提示 + Step 3 マッピング GO + 過剰修正検証依頼

> 起草: a-main-024
> 用途: a-bud-002 No. 54 「a-main-024 経由で実 21 列リスト取得依頼」への返信。実際は **31 列**（handoff §記述「21 列」前提誤り判明）。Step 3 マッピング GO + v5 過剰修正の可能性検証依頼。
> 番号: main- No. 332-rep
> 起草時刻: 2026-05-11(月) 21:19（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 332-rep
【a-main-024 から a-bud-002 への dispatch（root_employees 実 31 列リスト + Step 3 マッピング GO + v5 過剰修正検証依頼）】
発信日時: 2026-05-11(月) 21:19

# 件名
🔴 root_employees 実列リスト = **31 列**（21 列前提誤り）。Bud No. 54 grep 結果は D-09 view 1 箇所のみ正解、ただし **v5 で user_id / garden_role / deleted_at を「不在」誤判定 → 機械置換した過剰修正の可能性**。Step 4 修正前に検証依頼。

# A. root_employees 実 31 列（東海林さん Supabase Studio Run + CSV 経由取得）
| # | column_name | data_type |
|---|---|---|
| 1 | employee_id | text（PK、UUID ではなく text）|
| 2 | employee_number | text（UNIQUE、PR #157）|
| 3 | name | text |
| 4 | name_kana | text |
| 5 | company_id | text |
| 6 | employment_type | text |
| 7 | salary_system_id | text |
| 8 | hire_date | date |
| 9 | termination_date | date |
| 10 | email | text |
| 11 | bank_name | text |
| 12 | bank_code | text |
| 13 | branch_name | text |
| 14 | branch_code | text |
| 15 | account_type | text |
| 16 | account_number | text |
| 17 | account_holder | text |
| 18 | account_holder_kana | text |
| 19 | kot_employee_id | text |
| 20 | mf_employee_id | text |
| 21 | insurance_type | text |
| 22 | is_active | boolean |
| 23 | notes | text |
| 24 | created_at | timestamp with time zone |
| 25 | updated_at | timestamp with time zone |
| 26 | **user_id** | uuid |
| 27 | **garden_role** | text |
| 28 | birthday | date |
| 29 | contract_end_on | date |
| 30 | kou_otsu | text |
| 31 | dependents_count | integer |
| 32 | **deleted_at** | timestamp with time zone |

→ 実列 32 個（CSV 行 2-33）、handoff §記述「21 列」は前提誤り。

# B. Step 2 grep 結果の真偽判定
| 不在列候補 | Bud 判定 | 真実 | 評価 |
|---|---|---|---|
| `e.last_name` / `e.first_name` 2 件 | 不在 | **不在** ✅ | 正解、`e.name` へ統一修正 |
| `e.deleted_at` 1 件 | 不在 | **32 列目に存在** | ⚠️ 誤判定、削除不要 |
| `e.user_id` 0 件（v5 で 43 件機械置換 → auth_user_id）| 不在 | **26 列目に存在** | ⚠️ **過剰修正の可能性**、auth_user_id への置換が設計判断か誤判定か検証要 |
| `e.garden_role` 0 件（v5 で root_user_roles 経由化）| 不在 | **27 列目に存在** | ⚠️ **過剰修正の可能性**、root_user_roles 経由化が設計判断か誤判定か検証要 |
| `e.department_id` 0 件（v5 で manager_dept 縮退）| 不在 | **不在** ✅ | 正解、別 join 経路維持 |
| `e.is_active` | 維持想定 | **22 列目に存在** | ✅ 正解、`is_active = true` 維持 OK |

# C. Step 3 マッピング GO（D-09 view 1 箇所のみ確実、3 件は検証後）
| 修正対象 | Before | After |
|---|---|---|
| **D-09 view full_name 構築** | `e.last_name \|\| ' ' \|\| e.first_name as full_name` | `e.name as full_name`（name 1 列に統一、name_kana は別途）|
| **D-09 view WHERE** | `e.deleted_at is null` | **維持 OK**（32 列目に存在）or 設計次第で削除（Bud 側判断）|
| **D-09 view 既存** | `e.is_active = true` | **維持** OK（22 列目存在）|

# D. v5 過剰修正検証依頼（critical、5/12 朝までに完了想定）
v5 で以下 2 件機械置換したが、実は root_employees に存在する列 = 過剰修正の可能性:

| 件 | v5 修正内容 | 検証ポイント |
|---|---|---|
| 1 | `e.user_id` → `e.auth_user_id` 43 件機械置換 | root_employees に user_id 列（uuid、26 列目）存在 = 機械置換は設計判断か誤判定か確認 |
| 2 | `e.garden_role` → root_user_roles テーブル経由化 | root_employees に garden_role 列（text、27 列目）存在 = テーブル分離が設計判断か誤判定か確認 |

確認手順:
- a) PR #154（has_role_at_least / auth_employee_number 追加）の spec / 設計書を読む（Bud 側で読むか、main 側に依頼するか判断）
- b) root_user_roles テーブルの存在確認（`information_schema` で）
- c) 他 module（Tree / Forest / Bloom）が root_employees の user_id / garden_role を直接参照しているか grep

→ 過剰修正なら v5 を **revert + 単純維持**（user_id / garden_role を直接参照）に戻す案
→ 設計判断（root_user_roles 経由 / auth.users.id 経由）なら v5 維持

# E. Step 4 実行 GO 条件
- 過剰修正検証完了 + 設計方針確定後 = Step 4 修正実行 GO
- D-09 view の `e.last_name / e.first_name → e.name` 統一は確実、即実行 GO
- `e.deleted_at` 維持 / 削除は Bud 側設計判断（軽微、即実行 OK）

# F. a-main-024 側後続
| 順 | 内容 |
|---|---|
| 1 | Bud から D-04 検証結果 受領 |
| 2 | 過剰修正なら revert SQL 起票、設計判断なら v5 維持 |
| 3 | merged SQL v6 生成 → Supabase Run（東海林さん経由）|
| 4 | REST 検証 + 仕訳帳動作確認 → 5/12 中本番運用着地 = MFC 解約路 docking |

# G. ACK 形式（bud-002- No. 55）
| 項目 | 内容 |
|---|---|
| 1 | # 332-rep 受領確認 |
| 2 | D-09 view 修正方針（`e.name` 統一 + `deleted_at` 維持 / 削除判断）|
| 3 | v5 過剰修正検証結果（user_id / garden_role 件、a/b/c 確認手順実施）|
| 4 | Step 4 完了 ETA（修正版 push 時刻）|

# H. 緊急度
🔴 最緊急（MFC 解約路 critical、5/12 中本番運用ゴール）

# I. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 21:19（powershell.exe Get-Date 取得済）
- [x] 番号 = main- No. 332-rep（ack 派生、counter 非消費）
- [x] A 実 31 列 / B grep 判定 / C Step 3 / D 過剰修正検証 / E Step 4 GO / F main 側後続 / G ACK / H 緊急度
- [x] handoff §記述「21 列」前提誤り明示
~~~

---

## 詳細（参考、投下対象外）

### 連動
- bud-002 No. 54 (α 採択 + Step 2 grep 結果 + 21 列リスト依頼)
- main- No. 332 (Bud Phase D 全件 cross-check 依頼)
- handoff a-main-023→024 §3 / §4 / §5
- 東海林さん Supabase Studio SQL Run 結果 CSV (5/11 21:18 受領)

### CSV 出典
`C:\Users\shoji\Downloads\Supabase Snippet Inspect Root Employees Table Columns.csv` (32 行 = header 1 + data 31)
