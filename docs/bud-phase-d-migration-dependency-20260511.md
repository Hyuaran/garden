# Bud Phase D + 5/11 拡張 migration 依存順序表（main 修復用、2026-05-11 起草）

- 対応 dispatch: main- No. 295（a-main-023 → a-bud-002、Phase D 14 件 audit 修復）
- 起草: 2026-05-11（a-bud-002）
- 機械集計実施: `grep` で create テーブル / FK / helpers 依存を抽出

---

## 0. 件数前提（重要）

- dispatch では **14 件** と記載あり
- **a-bud-002 実態確認では 13 件**（Phase D 11 件 + 5/11 拡張 2 件）
- D-08（テスト戦略 + fixture）は **migration なし**（spec + テストのみ）→ 14 件中 1 件はカウント外と推定
- 14 件と 13 件の差分は a-main-023 で確認推奨

---

## 1. 依存順序表（timestamp 順 = apply 順序として正しい）

| # | timestamp | spec | 作成テーブル | 直接 FK 依存 | helpers 依存 | 順序整合 |
|---|---|---|---|---|---|---|
| 1 | 20260507000001 | D-01 attendance_schema | bud_payroll_periods / bud_payroll_attendance_snapshots / bud_payroll_attendance_overrides | root_employees / root_companies | なし | ✅ 基盤 |
| 2 | 20260507000002 | D-09 bank_accounts | root_employee_payroll_roles / bud_employee_bank_accounts / bud_payment_recipients | root_employees | **helpers 自身を定義**（bud_has_payroll_role / bud_is_admin_or_super_admin / bud_is_super_admin、3 関数）| ✅ 基盤 |
| 3 | 20260507000003 | D-05 social_insurance | bud_standard_remuneration_grades / bud_insurance_rates / bud_employee_remuneration_history / bud_employee_insurance_exemptions | D-01 periods / root_employees | D-09 helpers ✅ | ✅ |
| 4 | 20260507000004 | D-02 salary_calculation | bud_salary_records / bud_employee_allowances / bud_employee_deductions / bud_withholding_tax_table_kou / bud_withholding_tax_table_otsu / bud_resident_tax_assignments | D-01 periods / root_employees | D-09 helpers ✅ | ✅ |
| 5 | 20260507000005 | D-03 bonus_calculation | bud_bonus_records / bud_bonus_withholding_rate_table | D-01 periods / root_employees | D-09 helpers ✅ | ✅ |
| 6 | 20260507000006 | D-07 bank_transfer | bud_payroll_transfer_batches / bud_payroll_transfer_items / bud_payroll_accounting_reports | D-02 salary / D-03 bonus / D-01 periods / root_employees / root_companies | D-09 helpers ✅ | ✅ |
| 7 | 20260507000007 | D-11 mfc_csv_export | bud_mfc_csv_exports / bud_mfc_csv_export_items | D-02 salary / root_employees | D-09 helpers ✅ | ✅ |
| 8 | 20260508000001 | D-04 statement_distribution | bud_payroll_notifications / bud_salary_statements | D-02 salary / D-03 bonus / root_employees | D-09 helpers ✅ | ✅ |
| 9 | 20260508000002 | D-10 payroll_integration | bud_payroll_records / bud_payroll_calculation_history / bud_incentive_rate_tables | D-02 salary / root_employees / root_companies | D-09 helpers ✅ | ✅ |
| 10 | 20260508000003 | D-12 schedule_reminder | bud_payroll_schedule / bud_payroll_schedule_settings / bud_payroll_reminder_log | D-01 periods / root_employees / root_companies | D-09 helpers ✅ | ✅ |
| 11 | 20260508000004 | D-06 nenmatsu_integration | bud_year_end_settlements / root_employees_pii / bud_pii_access_log | D-01 periods / root_employees ※ Phase C bud_nenmatsu_chousei は **FK 制約なし**（nullable + コメント記載のみ、Phase C 起票後に追加） | D-09 helpers ✅ | ✅ |
| 12 | 20260511000010 | Bank (5/11 拡張) | bud_bank_accounts / bud_bank_balances / bud_bank_transactions | root_employees | D-09 helpers ✅ | ✅ |
| 13 | 20260511000011 | Shiwakechou (5/11 拡張) | bud_journal_accounts / bud_journal_entries / bud_journal_export_logs | bud_bank_transactions(#12) / root_employees | D-09 helpers ✅ | ✅ |

→ **timestamp 順 = 完全な apply 順序として整合**。循環依存なし。

---

## 2. Root 前提（Bud apply の前提条件）

下記 Root 系テーブルが **main DB に存在することが Bud 全 13 件 apply の前提**:

| 必須テーブル | 用途 |
|---|---|
| public.root_employees | 全 13 migration が FK 参照 |
| public.root_companies | D-01 / D-07 / D-10 / D-12 が FK 参照 |

→ main DB 検証時に **最初に確認**すべき項目（B-1 検証 SQL §1 参照）。

---

## 3. silent NO-OP 罠リスク（B-3 結果）

全 13 Bud migration が `CREATE TABLE IF NOT EXISTS` パターンを使用:

| migration | CREATE TABLE IF NOT EXISTS 件数 |
|---|---|
| D-01 | 4 |
| D-09 | 3 |
| D-05 | 4 |
| D-02 | 6 |
| D-03 | 2 |
| D-07 | 3 |
| D-11 | 2 |
| D-04 | 2 |
| D-10 | 3 |
| D-12 | 3 |
| D-06 | 3 |
| Bank (5/11) | 3 |
| Shiwakechou (5/11) | 3 |
| **合計** | **41 件** |

→ 既に部分作成されたテーブルがある場合、IF NOT EXISTS で skip されて必要な列/制約が抜けたまま完了する罠リスクあり。

**ALTER TABLE ADD COLUMN IF NOT EXISTS は 0 件**（後付け列追加が無い、apply 1 回完了型） → 罠リスク低め。

**DROP ... IF EXISTS（RLS policy）は多用**（合計 165 件 = drop policy if exists の pattern）→ apply 冪等性に貢献、罠リスクなし。

**CREATE INDEX IF NOT EXISTS（合計 82 件）** → 罠リスクなし（index は機能的に冪等）。

**CREATE OR REPLACE FUNCTION = 5 件**（D-09 で 3 件 helpers + D-06 で 2 件 PII）→ 冪等、罠リスクなし。

### 罠検出推奨手順（apply 時）

各 migration apply 後、テーブル存在 + 全列存在 + 全制約存在を SELECT で機械検証（C-3 verify-bud-phase-d-XX.sql 参照）。
