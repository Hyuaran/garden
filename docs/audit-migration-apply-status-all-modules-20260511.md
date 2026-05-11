# Garden 全モジュール migration apply 状況 集約 docs

> 起草: a-audit-001（main- No. 300 §F-3 GO 後）
> 起草日時: 2026-05-11(月) 17:55
> 用途: audit-migration-apply-status.py v1.0 を Garden 全 7 worktree（a-rill 除く 6 worktree、a-bud-002 既済 + 6 件）で実行 → 結果集約 → 5/12-13 修復 apply 戦略の事前情報源
> 起点: main- No. 287（緊急監査）+ main- No. 293（# 5 script 仕様）+ main- No. 300（採否 6 件全 GO）
> 機械検証 timestamp: 2026-05-11 17:34（a-bud-002）〜 17:50（a-bloom-006）

---

## §1 全体集計

### 1-1. unique migration 件数

| 項目 | 値 |
|---|---|
| 全 worktree 合計 migration 検証件数（重複含む）| 90 |
| unique migration ファイル数 | **31** |
| 検証 worktree 数 | 6（a-rill は migrations dir なし、a-bud-002 + 5 件追加検証）|
| 検証環境 | garden-dev |

### 1-2. unique 31 migration の worst-of-worktrees apply 状況

複数 worktree で同じ migration を検証時、最も悪い状態を採用（missing > partial > unknown > applied）:

| 状態 | 件数 | 割合 |
|---|---|---|
| ✅ applied | 2 | 6.5% |
| 🟡 partial | 8 | 25.8% |
| 🔴 missing | 19 | 61.3% |
| 🟦 unknown | 2 | 6.5%（down.sql + indexes-only sql、検証対象なし）|
| **apply 漏れ（partial + missing）** | **27** | **87.1% 🔴** |

→ audit-001- No. 15 報告「25/31 = 80%」を本機械集計で **27/31 = 87.1%** に補正。partial 検出で 2 件追加発見（root 系 3 件のうち 1 件が applied 確定、cross_rls_helpers が partial 化、Soil call_history が partial 化、Soil rls が partial 化）。

---

## §2 worktree 別サマリ

| worktree | total | applied | partial | missing | unknown | apply 漏れ率 |
|---|---|---|---|---|---|---|
| a-bud-002 | 22 | 1 | 6 | 14 | 1 | 95.5% |
| a-soil-002 | 14 | 2 | 6 | 5 | 1 | 78.6% |
| a-tree-002 | 19 | 1 | 6 | 11 | 1 | 89.5% |
| a-root-002 | 20 | 1 | 6 | 12 | 1 | 90.0% |
| a-leaf-002 | 5 | 1 | 4 | 0 | 0 | 80.0% |
| a-forest-002 | 5 | 1 | 4 | 0 | 0 | 80.0% |
| a-bloom-006 | 5 | 1 | 4 | 0 | 0 | 80.0% |
| **合計（重複含む）** | **90** | **8** | **36** | **42** | **4** | **86.7%** |

注: 同一 migration が複数 worktree に存在する重複あり（root_kot_sync_log 等は全 worktree に存在）。worktree 別 apply 漏れ率は重複含む。

---

## §3 unique 31 migration 別 apply 状況（detail）

### 3-1. applied（2 件、6.5%）

| # | migration | rest_verify |
|---|---|---|
| 1 | 20260425000004_root_employees_payroll_extension.sql | 3/3 |
| 2 | 20260511170000_rename_legacy_soil_call_history.sql | 1/1（a-main-023 5/11 17:00 実行）|

### 3-2. partial（8 件、25.8%）

| # | migration | rest_verify | 補足 |
|---|---|---|---|
| 1 | 20260425000001_root_kot_sync_log.sql | 1/2 | 主要テーブル apply、追加要素一部未 |
| 2 | 20260425000002_root_employees_outsource_extension.sql | 2/5 | 追加列 3 件のうち 2 件確認 |
| 3 | 20260425000003_root_attendance_daily.sql | 1/2 | 同上 |
| 4 | 20260425000005_forest_fiscal_periods_shinkouki_updated_at.sql | 2/3 | 追加列 一部 |
| 5 | 20260427000001_tree_phase_d_01.sql | 3/15 | **20% のみ apply**、Tree D-01 部分 apply |
| 6 | 20260507000002_soil_call_history.sql | 1/6 | silent NO-OP 罠検出（17% のみ apply）|
| 7 | 20260507000003_soil_rls.sql | 1/3 | current_garden_role のみ先行 apply（選択的部分 apply）|
| 8 | 20260511000001_cross_rls_helpers.sql | 1/2 | FUNCTION 一部 apply |

### 3-3. missing（19 件、61.3%）

| # | migration | rest_verify | モジュール |
|---|---|---|---|
| 1 | 20260507000001_bud_phase_d01_attendance_schema.sql | 0/4 | Bud Phase D 基盤 |
| 2 | 20260507000001_soil_lists.sql | 0/6 | Soil 全後続の親 |
| 3 | 20260507000002_bud_phase_d09_bank_accounts.sql | 0/6 | Bud |
| 4 | 20260507000003_bud_phase_d05_social_insurance.sql | 0/4 | Bud |
| 5 | 20260507000004_bud_phase_d02_salary_calculation.sql | 0/6 | Bud |
| 6 | 20260507000004_leaf_kanden_soil_link.sql | 0/7 | Leaf（親不在）|
| 7 | 20260507000005_bud_phase_d03_bonus_calculation.sql | 0/2 | Bud |
| 8 | 20260507000006_bud_phase_d07_bank_transfer.sql | 0/3 | Bud |
| 9 | 20260507000006_soil_handle_pd_number_change.sql | 0/1 | Soil |
| 10 | 20260507000007_bud_phase_d11_mfc_csv_export.sql | 0/2 | Bud |
| 11 | 20260507000007_soil_imports_staging.sql | 0/10 | Soil |
| 12 | 20260508000001_bud_phase_d04_statement_distribution.sql | 0/2 | Bud |
| 13 | 20260508000002_bud_phase_d10_payroll_integration.sql | 0/3 | Bud |
| 14 | 20260508000003_bud_phase_d12_payroll_schedule_reminder.sql | 0/3 | Bud |
| 15 | 20260508000004_bud_phase_d06_nenmatsu_integration.sql | 0/5 | Bud |
| 16 | 20260509000001_soil_phase2_index_helpers.sql | 0/2 | Soil |
| 17 | 20260511000002_root_employees_employee_number_unique.sql | 0/1 | Root（Tree D-01 関連、本日修復対象）|
| 18 | 20260511000010_bud_bank_accounts_balances.sql | 0/3 | Bud |
| 19 | 20260511000011_bud_journal_entries.sql | 0/4 | Bud |

### 3-4. unknown（2 件、6.5%）

| # | migration | 理由 |
|---|---|---|
| 1 | 20260427000001_tree_phase_d_01.down.sql | down migration、検証対象なし |
| 2 | 20260507000005_soil_indexes.sql | INDEX のみ、REST 検証不可（pg_indexes 必要）|

---

## §4 partial / missing top N（修復優先順位の事前情報源）

### 4-1. 致命度 🔴 最緊急（修復必須 5 件、main- No. 295 連動）

| 優先 | migration | 状態 | rest | 理由 |
|---|---|---|---|---|
| 1 | 20260511000002_root_employees_employee_number_unique | missing | 0/1 | データ整合性、Tree D-01 解消の前提（本日修復中、main- No. 295）|
| 2 | 20260507000002_soil_call_history（衝突解消後）| partial | 1/6 | silent NO-OP 罠、rename 後 apply 必要 |
| 3 | 20260427000001_tree_phase_d_01 | partial | 3/15 | Tree D-01 schema 残部 apply 必要 |
| 4 | 20260507000001_soil_lists | missing | 0/6 | Soil 全後続の親 |
| 5 | 20260507000001_bud_phase_d01_attendance_schema | missing | 0/4 | Bud Phase D 基盤 |

### 4-2. 致命度 🟡 中規模（Bud Phase D 後続 13 件）

audit-001- No. 15 §1-2 + audit-001- No. 17 詳細順序参照。依存順で apply（# 6 〜 # 14 = bud_phase_d02 〜 d12）。

### 4-3. 致命度 🟡 中規模（Soil 後続 + Leaf 本体）

Soil 7 件 + Leaf 1 件（leaf_kanden_cases 親本体は別 migration 群、要追加調査）。

---

## §5 修復 apply 戦略提案（5/12-13）

### 5-1. partial 8 件の取扱

| アプローチ | 内容 |
|---|---|
| A 案 | 未 apply DDL のみ個別 apply（既 apply DDL は skip、IF NOT EXISTS 活用）|
| B 案 | migration 全体を再 apply（IF NOT EXISTS で安全、ただし silent NO-OP 罠リスク）|
| C 案 | partial の未 apply 部分を手動 SQL 起草 + 個別 apply |

**推奨**: A 案（IF NOT EXISTS 活用 + 部分 apply）。ただし `20260507000002_soil_call_history` は silent NO-OP 罠ありのため、別途 rename 後の再 apply 必要。

### 5-2. missing 19 件の取扱

| アプローチ | 内容 |
|---|---|
| A 案 | 一括 apply（依存順守、supabase db push）|
| B 案 | 個別 apply（手動 SQL、Dashboard 経由）|
| C 案 | カテゴリ別バッチ apply（Soil バッチ / Bud バッチ / Tree バッチ）|

**推奨**: C 案（カテゴリ別バッチ）。
1. Soil バッチ（soil_lists → call_history → rls → indexes → handle → imports → phase2）
2. Bud バッチ（phase_d01 → d09 → d05 → d02 → d03 → d07 → d11 → d04 → d10 → d12 → d06 → bank → journal）
3. Tree バッチ（既 partial の残部）
4. Leaf 本体（leaf_kanden_cases 親 migration 特定 → 適用 → link migration）

### 5-3. 適用後検証

各バッチ apply 後、本 script を再実行 → JSON 出力で applied/partial/missing 状態確認。

```
# 修復後検証コマンド
python docs/scripts/audit-migration-apply-status.py \
  --migrations-dir C:/garden/a-bud-002/supabase/migrations \
  --json \
  --json-out docs/audit-migration-apply-status-result-AFTER-FIX-YYYYMMDD-HHMM.json
```

before / after JSON で diff を取れば修復効果を機械的に立証可能。

---

## §6 重要発見の補足

### 6-1. 「選択的部分 apply」構造課題の機械的立証

partial 8 件のうち以下が「DDL 1 件中、一部のみ apply」を機械検証で立証:
- `20260427000001_tree_phase_d_01` = 15 検証項目中 3 件のみ apply（20%）
- `20260507000002_soil_call_history` = 6 検証項目中 1 件のみ apply（17%）= silent NO-OP 罠
- `20260507000003_soil_rls` = 3 検証項目中 1 件のみ apply（33%）= current_garden_role 単独先行

→ audit-001- No. 15 §「3 種運用ギャップ」の「選択的部分 apply」を機械検証で確証。

### 6-2. unique 31 件中 applied 確定 2 件のみ

`20260425000004_root_employees_payroll_extension`（5/7 適用済）+ `20260511170000_rename_legacy_soil_call_history`（本日 17:00 a-main-023 適用、衝突解消）の 2 件のみ完全 apply。

→ Garden 全体で完全 apply は 2 件、残 29 件は何らかの apply 漏れ。

### 6-3. cross_rls_helpers は partial（rest 1/2）

audit-001- No. 15 では「applied」判定だったが、本機械集計で partial（1/2）= FUNCTION 一部のみ apply。共通 RLS helper の整合性に懸念。

---

## §7 検証限界 transparent 開示

本 script は REST GET / RPC POST のみで検証:
- ✅ CREATE TABLE / ALTER ADD COLUMN: REST 検証可
- 🟡 CREATE FUNCTION: RPC POST 試行（404 = 未存在）
- ❌ ALTER ADD CONSTRAINT / CREATE INDEX / CREATE POLICY: REST 不可、要 pg_* SELECT

→ v1.1 拡張（main- No. 300 §G）で migration_history + pg_* SELECT 検証拡張予定（5/12-13 判断）。

---

## §8 改訂履歴

- 2026-05-11 17:55 v1 初版（a-audit-001、main- No. 300 §F-3 GO 後集約、6 worktree script 実行結果統合）
