# Bud Phase D #02: 給与計算ロジック（実装着手版）

- 対象: Garden-Bud Phase D 月次給与の計算ロジックと結果テーブル
- 優先度: **🔴 最高**（給与処理の中核、誤計算は即金銭・労務問題）
- 見積: **1.5d**（計算エンジン + 結果テーブル + 単体テスト 100+）
- 担当セッション: a-bud（実装）/ a-root（マスタ整合）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #02）
- 前提:
  - **Bud Phase B-01 給与計算エンジン**（設計済、本 spec で実装着手）
  - **Bud Phase D-01 勤怠取込スキーマ**
  - **Root A-3-h** kou_otsu / dependents_count / deleted_at
  - 国税庁「源泉徴収税額表（月額表）2026 年版」
  - `root_salary_systems` / `root_employees` / `root_insurance`

---

## 1. 目的とスコープ

### 1.1 目的

`bud_payroll_attendance_snapshots`（勤怠スナップショット）と給与体系マスタを入力として、**月次の支給額・控除額・差引支給額を確定**する。源泉徴収（甲乙欄判定 + 扶養親族数反映）・各種手当・残業/深夜/休日割増を網羅し、結果を `bud_salary_records` に永続化する。

### 1.2 含めるもの

- `bud_salary_records`（給与結果、1 employee × 1 period = 1 行）
- 給与計算関数 `calculateMonthlySalary(input)` の関数契約
- 雇用形態別ロジック（正社員 / アルバイト / 業務委託）
- 残業/深夜/休日割増（法定割増率）
- 各種手当（通勤・住宅・役職・家族 等）
- 源泉徴収税額表ルックアップ（`kou_otsu` + `dependents_count` 反映）
- 試算モード / 本計算モード
- 冪等性（同入力 → 同出力）

### 1.3 含めないもの

- 社保計算詳細 → D-05
- 賞与 → D-03
- 明細 PDF → D-04
- 振込連携 → D-07
- 年末調整 → D-06

### 1.4 A-07 採択結果との関係（payment_method）

`root_employees.payment_method` ENUM（`bank_transfer` / `cash` / `other`）は計算結果に影響しない。
給与計算は payment_method に**関係なく同じロジック**で実行され、結果（`bud_salary_records`）が出力される。
配信先（D-04）と振込先（D-07）で payment_method 別に分岐する。

---

## 2. 入出力契約

### 2.1 計算関数の型

```typescript
type CalculateMonthlySalaryInput = {
  payroll_period_id: string;
  employee_id: string;
  mode: 'simulation' | 'final';
};

type CalculateMonthlySalaryOutput = {
  salary_record_id: string | null;  // simulation の場合 null
  basic_pay: number;
  overtime_pay: number;
  late_night_pay: number;
  holiday_pay: number;
  allowances: AllowanceBreakdown;
  gross_pay: number;
  social_insurance: SocialInsuranceBreakdown;
  withholding_tax: number;
  resident_tax: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  warnings: CalculationWarning[];
};
```

### 2.2 内部分解

```
1. 入力収集
   - bud_payroll_attendance_snapshots（勤怠）
   - root_employees（雇用形態 / kou_otsu / dependents_count / 給与体系参照）
   - root_salary_systems（基本給 / 時給 / 手当テンプレ）
   - bud_employee_allowances（個別手当上書き）
   - bud_employee_deductions（個別控除上書き）

2. 基本給計算（雇用形態別）
3. 割増計算（残業 / 深夜 / 休日）
4. 手当合計
5. 総支給額（gross_pay）
6. 社保計算（D-05）
7. 源泉徴収（本 spec §6）
8. 住民税（マスタから当月分）
9. 個別控除
10. 差引支給額（net_pay）
11. bud_salary_records に保存（mode='final'）
```

---

## 3. テーブル定義

### 3.1 `bud_salary_records`

```sql
CREATE TABLE public.bud_salary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES public.bud_payroll_periods(id),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),

  -- 基本給
  basic_pay numeric(12, 0) NOT NULL DEFAULT 0,
  hourly_rate numeric(12, 2),                  -- 時給制の場合
  base_calculation_method text NOT NULL,       -- 'monthly' | 'hourly' | 'commission'

  -- 割増（円）
  overtime_pay numeric(12, 0) NOT NULL DEFAULT 0,
  late_night_pay numeric(12, 0) NOT NULL DEFAULT 0,
  holiday_pay numeric(12, 0) NOT NULL DEFAULT 0,
  legal_overtime_pay numeric(12, 0) NOT NULL DEFAULT 0,

  -- 手当
  commute_allowance numeric(12, 0) NOT NULL DEFAULT 0,
  housing_allowance numeric(12, 0) NOT NULL DEFAULT 0,
  position_allowance numeric(12, 0) NOT NULL DEFAULT 0,
  family_allowance numeric(12, 0) NOT NULL DEFAULT 0,
  qualification_allowance numeric(12, 0) NOT NULL DEFAULT 0,
  other_allowances jsonb,                       -- 個別: { "営業手当": 30000, ... }
  total_allowances numeric(12, 0) NOT NULL DEFAULT 0,

  -- 欠勤・遅刻控除
  absent_deduction numeric(12, 0) NOT NULL DEFAULT 0,
  late_deduction numeric(12, 0) NOT NULL DEFAULT 0,
  early_leave_deduction numeric(12, 0) NOT NULL DEFAULT 0,

  -- 総支給額
  gross_pay numeric(12, 0) NOT NULL,

  -- 社保（D-05 が書込）
  health_insurance numeric(10, 0) NOT NULL DEFAULT 0,
  welfare_pension numeric(10, 0) NOT NULL DEFAULT 0,
  long_term_care_insurance numeric(10, 0) NOT NULL DEFAULT 0,
  employment_insurance numeric(10, 0) NOT NULL DEFAULT 0,
  total_social_insurance numeric(10, 0) NOT NULL DEFAULT 0,

  -- 税金
  withholding_tax numeric(10, 0) NOT NULL DEFAULT 0,
  resident_tax numeric(10, 0) NOT NULL DEFAULT 0,

  -- その他控除
  other_deductions jsonb,                       -- { "親睦会費": 500, ... }
  total_other_deductions numeric(10, 0) NOT NULL DEFAULT 0,

  -- 控除合計・差引支給額
  total_deductions numeric(12, 0) NOT NULL,
  net_pay numeric(12, 0) NOT NULL,

  -- 計算メタデータ
  kou_otsu_at_calculation text NOT NULL,        -- 'kou' | 'otsu'（計算時点のスナップショット）
  dependents_count_at_calculation int NOT NULL,
  social_insurance_grade int,                   -- 標準報酬月額の等級
  calculation_warnings jsonb,                   -- [{code, message, level}]

  -- 状態
  status text NOT NULL DEFAULT 'calculated',
    -- 'calculated' | 'approved' | 'paid' | 'cancelled'

  -- 監査
  calculated_at timestamptz NOT NULL DEFAULT now(),
  calculated_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_reason text,

  UNIQUE (payroll_period_id, employee_id),
  CHECK (gross_pay >= 0),
  CHECK (net_pay = gross_pay - total_deductions)
);

CREATE INDEX idx_bud_salary_records_period ON bud_salary_records (payroll_period_id);
CREATE INDEX idx_bud_salary_records_employee ON bud_salary_records (employee_id, calculated_at DESC);
CREATE INDEX idx_bud_salary_records_status ON bud_salary_records (status);
```

### 3.2 `bud_employee_allowances`（個別手当上書き）

```sql
CREATE TABLE public.bud_employee_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  allowance_type text NOT NULL,
    -- 'commute' | 'housing' | 'position' | 'family' | 'qualification' | 'custom'
  custom_label text,                            -- allowance_type='custom' 時
  amount numeric(12, 0) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,                            -- NULL = 無期限
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
```

### 3.3 `bud_employee_deductions`（個別控除上書き）

```sql
CREATE TABLE public.bud_employee_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  deduction_label text NOT NULL,                -- '親睦会費' / '社員旅行積立' 等
  amount numeric(10, 0) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
```

---

## 4. 雇用形態別ロジック

### 4.1 正社員（monthly）

```
基本給 = root_salary_systems.basic_pay
+ 出勤日数による按分（月途中入社・退職時）
- 欠勤日数による控除（基本給 / 暦日数 × 欠勤日数）
- 遅刻早退控除（基本給 / 月所定労働時間 × 遅刻早退分）
```

### 4.2 アルバイト（hourly）

```
基本給 = 時給 × 実労働時間
（残業・深夜・休日は別途割増）
```

### 4.3 業務委託（commission）

- 給与計算対象外（外注扱い、Bud では `bud_furikomi` 経由で支払）
- `root_employees.employment_type='outsource'` の場合は本計算をスキップ

---

## 5. 割増賃金

### 5.1 法定割増率

| 種別 | 割増率 |
|---|---|
| 時間外労働（月 60h 以下）| 25% |
| 時間外労働（月 60h 超）| **50%**（中小企業も 2023-04 以降義務）|
| 深夜労働（22:00〜5:00）| 25%（時間外と重複時 +25% = 計 50%）|
| 法定休日労働 | 35%（深夜重複時 +25% = 計 60%）|

### 5.2 計算式

```typescript
const baseHourlyRate = monthlyBasePay / monthlyScheduledHours;
const overtimePay = baseHourlyRate * overtimeHours * 1.25;
// 60h 超分は 1.5
if (overtimeMinutes > 60 * 60) {
  const above60 = overtimeMinutes - 60 * 60;
  overtimePay += baseHourlyRate * (above60 / 60) * 0.25;  // 追加 25% 分
}
```

### 5.3 月所定労働時間の算出

```
月所定労働時間 = 1 年の所定労働日数 × 1 日の所定労働時間 ÷ 12
（例: 250 日 × 8h ÷ 12 = 166.66h ≈ 10,000 分）
```

`root_salary_systems.monthly_scheduled_minutes` に格納。

---

## 6. 源泉徴収税額表ルックアップ

### 6.1 甲乙欄判定

```sql
SELECT kou_otsu, dependents_count FROM root_employees WHERE id = $1;
```

| kou_otsu | 意味 | 適用 |
|---|---|---|
| `'kou'`（甲）| 主たる給与（扶養控除等申告書提出済）| 月額表「甲」欄 + 扶養人数別 |
| `'otsu'`（乙）| 従たる給与 | 月額表「乙」欄（一律高税率）|

### 6.2 月額表データ

```sql
CREATE TABLE public.bud_withholding_tax_table_kou (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year int NOT NULL,                 -- 2026
  taxable_min numeric(10, 0) NOT NULL,         -- 課税対象額の下限（社保等控除後）
  taxable_max numeric(10, 0) NOT NULL,
  dependents_0 numeric(8, 0) NOT NULL,
  dependents_1 numeric(8, 0) NOT NULL,
  dependents_2 numeric(8, 0) NOT NULL,
  dependents_3 numeric(8, 0) NOT NULL,
  dependents_4 numeric(8, 0) NOT NULL,
  dependents_5 numeric(8, 0) NOT NULL,
  dependents_6 numeric(8, 0) NOT NULL,
  dependents_7 numeric(8, 0) NOT NULL,
  -- 扶養 7 人超は計算式で算出
  UNIQUE (effective_year, taxable_min, taxable_max)
);

CREATE TABLE public.bud_withholding_tax_table_otsu (
  -- 乙欄（一律、扶養関係なし）
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year int NOT NULL,
  taxable_min numeric(10, 0) NOT NULL,
  taxable_max numeric(10, 0) NOT NULL,
  tax_rate numeric(5, 4) NOT NULL,             -- 税率（例: 0.1063）
  flat_amount numeric(8, 0) NOT NULL DEFAULT 0,
  UNIQUE (effective_year, taxable_min, taxable_max)
);
```

### 6.3 ルックアップ関数

```typescript
function lookupWithholdingTax(
  taxableAmount: number,    // gross_pay - social_insurance - 通勤手当 等
  kouOtsu: 'kou' | 'otsu',
  dependentsCount: number,
  year: number
): number {
  if (kouOtsu === 'kou') {
    const row = await fetchKouRow(year, taxableAmount);
    if (!row) throw new Error(`月額表 甲 範囲外: ${taxableAmount}`);
    if (dependentsCount > 7) {
      // 7 人超は超過 1 人につき所定額を減算
      return row.dependents_7 - (dependentsCount - 7) * 1610;
    }
    return row[`dependents_${dependentsCount}`];
  } else {
    const row = await fetchOtsuRow(year, taxableAmount);
    return row.flat_amount + (taxableAmount - row.taxable_min) * row.tax_rate;
  }
}
```

### 6.4 課税対象額の算出

```
課税対象額 = gross_pay
           - 通勤手当（非課税分）
           - 健康保険料
           - 厚生年金保険料
           - 雇用保険料
           - 介護保険料（40-64 歳のみ）
```

---

## 7. 住民税

### 7.1 マスタからの取得

```sql
CREATE TABLE public.bud_resident_tax_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  fiscal_year int NOT NULL,                    -- 6 月-翌 5 月
  june_amount numeric(10, 0) NOT NULL,         -- 6 月のみ違う額
  monthly_amount numeric(10, 0) NOT NULL,      -- 7 月-翌 5 月
  source_municipality text,
  notes text,
  UNIQUE (employee_id, fiscal_year)
);
```

### 7.2 給与計算時の参照

```typescript
const isJune = monthOfPeriod === 6;
const residentTax = isJune ? assignment.june_amount : assignment.monthly_amount;
```

---

## 8. 計算冪等性

### 8.1 同入力 → 同出力の保証

- 計算関数は **副作用なし**（引数で全て注入）
- マスタ参照時は `effective_at` を渡し、再計算時も同じ結果
- 結果保存時に `kou_otsu_at_calculation` 等のスナップショットを記録

### 8.2 再計算ポリシー

| トリガ | 動作 |
|---|---|
| 勤怠 override → snapshot 更新 | 関連 salary_record を再計算（status=`calculated` のみ）|
| `kou_otsu` 変更 | 当月以降のみ反映、過去は遡及しない |
| 手当 / 控除マスタ変更 | `effective_from` 以降のみ |
| 支給日経過後（status=`paid`）| **再計算不可**（差額調整は別 record で）|

---

## 9. 警告・エラー

### 9.1 警告レベル

```typescript
type CalculationWarning = {
  code: string;
  message: string;
  level: 'info' | 'warning' | 'error';
};
```

| code | level | 例 |
|---|---|---|
| `LOW_NET_PAY` | warning | 差引支給額が前月比 -50% 以下 |
| `OVERTIME_OVER_80H` | warning | 残業 80h 超 |
| `OVERTIME_OVER_100H` | error | 残業 100h 超（過労死ライン）|
| `NEGATIVE_NET_PAY` | error | 控除合計が支給を超過 |
| `MISSING_RESIDENT_TAX` | warning | 住民税マスタ未登録 |
| `WITHHOLDING_TABLE_OUT_OF_RANGE` | error | 月額表の範囲外（要マスタ更新）|

### 9.2 エラー時の動作

- error 1 件以上 → 計算中止、`bud_salary_records` 書込なし
- warning のみ → 警告を `calculation_warnings` に記録して書込

---

## 10. RLS

```sql
-- 自分の給与は閲覧可
CREATE POLICY salary_select_own
  ON bud_salary_records FOR SELECT
  USING (employee_id = (SELECT id FROM root_employees WHERE user_id = auth.uid()));

-- manager+ は自部門
-- admin+ は全件
-- INSERT / UPDATE は service_role + 経理担当
```

---

## 11. 法令対応チェックリスト

### 11.1 労働基準法

- [ ] 第 24 条: 全額払・通貨払い（端数処理は 1 円未満切り捨て）
- [ ] 第 37 条: 法定割増率（25% / 50% / 25% / 35%）
- [ ] 第 109 条: 賃金台帳保存 5 年（→ Cross Ops #05）

### 11.2 所得税法

- [ ] 月額表の最新年版（2026 年）の使用確認
- [ ] 甲乙欄判定（扶養控除等申告書の提出有無）
- [ ] 通勤手当の非課税枠（月 15 万円まで）

### 11.3 健康保険法・厚生年金保険法

- [ ] 標準報酬月額の正確性（D-05 で詳述）

---

## 12. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_salary_records` migration | a-bud | 0.5h |
| 2 | `bud_employee_allowances` / `_deductions` migration | a-bud | 0.5h |
| 3 | `bud_withholding_tax_table_kou` / `_otsu` + 2026 年版データ投入 | a-bud | 2h |
| 4 | `bud_resident_tax_assignments` migration + UI | a-bud | 1h |
| 5 | 計算関数 `calculateMonthlySalary` 実装 | a-bud | 4h |
| 6 | 雇用形態別ロジック（monthly / hourly）| a-bud | 1.5h |
| 7 | 割増計算（残業・深夜・休日）| a-bud | 1.5h |
| 8 | 源泉徴収ルックアップ | a-bud | 1h |
| 9 | RLS ポリシー | a-bud | 0.5h |
| 10 | 単体テスト 100+ ケース | a-bud | 4h |

合計: 約 16.5h ≈ **1.5d**（妥当）

---

## 13. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 端数処理（10 円未満）| **1 円未満切り捨て**（法定）+ 100 円未満は法人裁量 |
| 判 2 | 住民税マスタの取込方法 | **手動 CSV** で開始、自動化は Phase E |
| 判 3 | 60h 超残業の中小特例 | **2023-04 以降中小も 50%**、特例なし |
| 判 4 | 通勤手当の非課税限度 | **月 15 万円まで**、超過分は課税扱い |
| 判 5 | 試算モードの保存 | **保存しない**（API 応答のみ）、履歴必要なら別 spec |
| 判 6 | 業務委託の給与計算 | **対象外**（`bud_furikomi` 経由）|

---

## 14. 既知のリスクと対策

### 14.1 月額表の年度切替忘れ

- 4 月以降に旧年度表を使い続ける
- 対策: `effective_year` で自動切替、年度跨ぎ時に警告

### 14.2 標準報酬月額の改定漏れ

- 算定基礎届の反映が遅れる
- 対策: 9 月の自動改定 Cron + 月変判定（D-05）

### 14.3 端数処理の差異

- 0.5 円が四捨五入か切り捨てか
- 対策: 法定通り**切り捨て**（1 円未満）、テストで境界値確認

### 14.4 計算結果の改ざん

- 経理担当が結果テーブルを直接編集
- 対策: `bud_salary_records` の UPDATE は admin+ + override 経由のみ

### 14.5 退職月の按分計算

- 月途中退職で日割計算
- 対策: `working_days / scheduled_days` の比率で按分、テストで確認

### 14.6 マイナンバー保管

- 年末調整で必要、ただし給与計算自体には不要
- 対策: マイナンバーは `root_employees_pii`（pgcrypto 暗号化）に分離（D-06 で詳述）

---

## 15. 関連ドキュメント

- `docs/specs/2026-04-24-bud-b-01-salary-calc-engine.md`（設計書）
- `docs/specs/2026-04-25-bud-phase-d-01-attendance-schema.md`
- `docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md`
- `docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md`
- `docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md`

---

## 16. 受入基準（Definition of Done）

- [ ] `bud_salary_records` migration 適用済（CHECK 制約含む）
- [ ] 個別手当 / 控除マスタ + UI（manager+ 編集可）
- [ ] 源泉徴収月額表（甲・乙）2026 年版データ投入済
- [ ] 住民税マスタ + 取込手順
- [ ] 計算関数の単体テスト 100+ ケース pass（境界値網羅）
- [ ] 割増計算（25%/50%/35%/重複）の各ケースで正答
- [ ] 退職月の按分計算で正答
- [ ] 警告 / エラーが正しい場面で発生
- [ ] 冪等性（同入力 → 同出力）テスト pass
- [ ] RLS（自分 / manager / admin / 削除済）テスト pass
