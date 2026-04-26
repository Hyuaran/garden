# Bud Phase D #03: 賞与計算（実装着手版）

- 対象: Garden-Bud Phase D 賞与（夏冬・決算賞与）の計算
- 優先度: **🔴 高**（年 2-3 回、金額大、税計算が月給と異なる）
- 見積: **0.75d**（テーブル + 計算 + テスト）
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #03）
- 前提:
  - **Bud Phase B-05 賞与処理**（設計済、本 spec で実装着手）
  - **Bud Phase D-02 給与計算ロジック**
  - **Bud Phase D-05 社保計算**
  - 国税庁「賞与に対する源泉徴収税額の算出率の表」2026 年版

---

## 1. 目的とスコープ

### 1.1 目的

月次給与とは別系統の**賞与（Bonus）**の計算ロジックと結果保存を実装する。社保（標準賞与額ベース）・源泉徴収（前月給与基準の算出率表）・年末調整との合算精算を網羅する。

### 1.2 含めるもの

- `bud_bonus_records`（賞与結果テーブル）
- 賞与計算関数 `calculateBonus(input)`
- 標準賞与額の上限（健保 573 万円 / 厚年 150 万円）
- 賞与の源泉徴収（算出率表 = 前月給与基準）
- 年末調整連携（D-06 と接続）

### 1.3 含めないもの

- 月次給与計算 → D-02
- 退職金 → 別 spec（Phase E）
- 個別インセンティブの算定式 → 業務判断（admin 手動入力）
- 明細 PDF → D-04
- 振込連携 → D-07

### 1.4 配信ロジック

賞与明細の配信は **D-04 の配信ロジック流用**（A-07 採択 = **Y 案 + フォールバック**、2026-04-26 改訂）。
- 通常フロー: Tree マイページ + メール DL リンク（24h ワンタイム、PW なし PDF）+ LINE Bot 通知
- 例外フロー: メール DL リンク + PW 保護 PDF（強ランダム 16 文字、フォールバック）
- `bud_payroll_notifications.bonus_record_id` で識別、給与明細と同じ `delivery_method` ENUM を使用
- 詳細: `docs/specs/2026-04-25-bud-phase-d-04-statement-distribution.md` §2 / §6 / §8

---

## 2. 賞与の特殊性（月給との対比）

| 項目 | 月給（D-02）| 賞与（D-03）|
|---|---|---|
| 期間単位 | 月（1 ヶ月）| 支給回（夏 / 冬 / 決算 等）|
| 社保算定基礎 | 標準報酬月額 | 標準賞与額（× 健保率・厚年率）|
| 社保上限 | 月額 65 万円（厚年）| 健保 573 万円/年 / 厚年 150 万円/月 |
| 源泉徴収方式 | 月額表 + 扶養人数 | **算出率表**（前月給与基準）|
| 残業・深夜割増 | あり | **なし** |
| 住民税 | あり | **なし**（普通徴収または特別徴収から控除済）|
| 年末調整との関係 | 月給控除合算 | 賞与控除合算、両者を年末で精算 |

---

## 3. テーブル定義

### 3.1 `bud_bonus_records`

```sql
CREATE TABLE public.bud_bonus_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 期間（D-01 の bud_payroll_periods.period_type='bonus_summer' 等を参照）
  payroll_period_id uuid NOT NULL REFERENCES public.bud_payroll_periods(id),
  bonus_label text NOT NULL,                    -- '2026年夏季賞与' 等
  bonus_payment_date date NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),

  -- 支給額
  base_bonus numeric(12, 0) NOT NULL,           -- 基本賞与（業務判断による額）
  performance_addition numeric(12, 0) NOT NULL DEFAULT 0,  -- 業績加算
  other_additions jsonb,                        -- 各種加算
  gross_bonus numeric(12, 0) NOT NULL,

  -- 社保（標準賞与額ベース）
  health_insurance numeric(10, 0) NOT NULL DEFAULT 0,
  welfare_pension numeric(10, 0) NOT NULL DEFAULT 0,
  long_term_care_insurance numeric(10, 0) NOT NULL DEFAULT 0,
  employment_insurance numeric(10, 0) NOT NULL DEFAULT 0,
  total_social_insurance numeric(10, 0) NOT NULL DEFAULT 0,

  -- 源泉徴収（算出率表）
  withholding_rate numeric(5, 4) NOT NULL,      -- 算出率（例: 0.04084）
  withholding_tax numeric(10, 0) NOT NULL DEFAULT 0,

  -- 控除合計・差引支給額
  total_deductions numeric(10, 0) NOT NULL,
  net_bonus numeric(12, 0) NOT NULL,

  -- スナップショット（再現性）
  previous_month_taxable_amount numeric(12, 0) NOT NULL,  -- 前月給与（社保等控除後）
  kou_otsu_at_calculation text NOT NULL,
  dependents_count_at_calculation int NOT NULL,
  health_capped boolean NOT NULL DEFAULT false,  -- 健保上限到達
  pension_capped boolean NOT NULL DEFAULT false, -- 厚年上限到達

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
  CHECK (gross_bonus >= 0),
  CHECK (net_bonus = gross_bonus - total_deductions)
);

CREATE INDEX idx_bud_bonus_records_period ON bud_bonus_records (payroll_period_id);
CREATE INDEX idx_bud_bonus_records_employee_payment
  ON bud_bonus_records (employee_id, bonus_payment_date DESC);
```

### 3.2 `bud_bonus_withholding_rate_table`（賞与算出率表）

```sql
CREATE TABLE public.bud_bonus_withholding_rate_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year int NOT NULL,
  kou_otsu text NOT NULL,                       -- 'kou' | 'otsu'
  -- 前月給与の社会保険料等控除後の金額（甲乙別、扶養人数別）
  previous_month_min numeric(10, 0) NOT NULL,
  previous_month_max numeric(10, 0),            -- NULL = 上限なし
  dependents_0 numeric(5, 4) NOT NULL,
  dependents_1 numeric(5, 4) NOT NULL,
  dependents_2 numeric(5, 4) NOT NULL,
  dependents_3 numeric(5, 4) NOT NULL,
  dependents_4 numeric(5, 4) NOT NULL,
  dependents_5 numeric(5, 4) NOT NULL,
  dependents_6 numeric(5, 4) NOT NULL,
  dependents_7 numeric(5, 4) NOT NULL,
  UNIQUE (effective_year, kou_otsu, previous_month_min, previous_month_max)
);
```

---

## 4. 計算ロジック

### 4.1 全体フロー

```
1. 入力: bonus_label, employee_id, base_bonus, additions
2. gross_bonus = base_bonus + Σadditions
3. 社保計算（§5）
4. 源泉徴収（§6）
5. total_deductions = 社保合計 + 源泉徴収
6. net_bonus = gross_bonus - total_deductions
7. bud_bonus_records に保存
```

### 4.2 関数契約

```typescript
type CalculateBonusInput = {
  payroll_period_id: string;
  employee_id: string;
  base_bonus: number;
  additions?: Array<{ label: string; amount: number }>;
  mode: 'simulation' | 'final';
};

type CalculateBonusOutput = {
  bonus_record_id: string | null;
  gross_bonus: number;
  social_insurance: SocialInsuranceBreakdown;
  withholding_rate: number;
  withholding_tax: number;
  net_bonus: number;
  warnings: CalculationWarning[];
};
```

---

## 5. 社保計算（賞与）

### 5.1 標準賞与額の上限

```typescript
const STANDARD_BONUS_HEALTH_CAP = 5_730_000;   // 健保: 年度累計 573 万円
const STANDARD_BONUS_PENSION_CAP = 1_500_000;  // 厚年: 1 回 150 万円
```

### 5.2 健保（年度累計上限）

```typescript
async function calculateHealthInsurance(employeeId, grossBonus, fiscalYear) {
  const cumulative = await sumYearToDateBonus(employeeId, fiscalYear);
  const remainingCap = Math.max(STANDARD_BONUS_HEALTH_CAP - cumulative, 0);
  const standardBonus = Math.min(grossBonus, remainingCap);

  // 1,000 円未満切り捨て
  const standardBonusFloored = Math.floor(standardBonus / 1000) * 1000;

  const rate = await getHealthInsuranceRate(employeeId);  // 例: 0.0498
  const employeeShare = standardBonusFloored * rate / 2;
  return Math.floor(employeeShare);
}
```

### 5.3 厚生年金（1 回 150 万円上限）

```typescript
function calculatePension(grossBonus, rate) {
  const standardBonus = Math.min(grossBonus, STANDARD_BONUS_PENSION_CAP);
  const standardBonusFloored = Math.floor(standardBonus / 1000) * 1000;
  return Math.floor(standardBonusFloored * rate / 2);
}
```

### 5.4 介護保険（40-64 歳）

```typescript
const age = calculateAge(employee.date_of_birth, bonusPaymentDate);
if (age >= 40 && age <= 64) {
  // 健保と同じく標準賞与額に対し介護保険料率
  longTermCareInsurance = standardBonus * careRate / 2;
}
```

### 5.5 雇用保険

```typescript
// 雇用保険は「実際の支給額」に対して（標準賞与額ではない）
const employmentInsurance = Math.floor(grossBonus * employmentRate);
// 一般事業: 0.6%、農林水産・建設等: 0.7%（業種別、root_companies で管理）
```

---

## 6. 源泉徴収（賞与算出率表）

### 6.1 ルックアップロジック

```typescript
async function lookupBonusWithholdingRate(input: {
  previousMonthTaxableAmount: number;  // 前月給与（社保等控除後）
  kouOtsu: 'kou' | 'otsu';
  dependentsCount: number;
  year: number;
}): Promise<number> {
  const row = await fetchRateRow(
    input.year,
    input.kouOtsu,
    input.previousMonthTaxableAmount
  );
  if (!row) throw new Error('賞与算出率表 範囲外');

  if (input.dependentsCount > 7) {
    return row.dependents_7;  // 7 人超は同率（実態として）
  }
  return row[`dependents_${input.dependentsCount}`];
}
```

### 6.2 課税対象額の算出

```
賞与の課税対象額 = gross_bonus - 賞与社保合計
源泉徴収税額    = 課税対象額 × 算出率
```

### 6.3 前月給与の取得

```sql
SELECT (gross_pay - total_social_insurance - non_taxable_commute) AS taxable_amount
FROM bud_salary_records
WHERE employee_id = $1
  AND payroll_period_id = (
    SELECT id FROM bud_payroll_periods
    WHERE company_id = $2
      AND period_type = 'monthly'
      AND payment_date < $bonus_payment_date
    ORDER BY payment_date DESC LIMIT 1
  );
```

### 6.4 前月給与なしの特例

新入社員等で前月給与がない場合:

- **特例 1**: 賞与 ÷ 6（6 ヶ月按分）→ 月額表で計算 → × 6
- **特例 2**: 一律 5%（簡易処理）

→ Garden では特例 1 を採用（合理性高）。

---

## 7. RLS

```sql
-- 自分の賞与は閲覧可
CREATE POLICY bonus_select_own
  ON bud_bonus_records FOR SELECT
  USING (employee_id = (SELECT id FROM root_employees WHERE user_id = auth.uid()));

-- manager+ は自部門
-- admin+ は全件
-- INSERT / UPDATE は admin+ のみ（賞与額は経理が直接入力）
```

---

## 8. 法令対応チェックリスト

### 8.1 健康保険法

- [ ] 第 45 条: 標準賞与額の上限（年度累計 573 万円）
- [ ] 健保料率の年度切替（毎年 3 月）

### 8.2 厚生年金保険法

- [ ] 第 24 条の 4: 標準賞与額の上限（1 回 150 万円）
- [ ] 厚生年金料率（一律 18.300% を労使折半）

### 8.3 所得税法

- [ ] 第 186 条: 賞与に対する源泉徴収（算出率表）
- [ ] 前月給与なしの特例適用

### 8.4 雇用保険法

- [ ] 賞与にも雇用保険料あり（実際の支給額に対し）

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_bonus_records` migration | a-bud | 0.5h |
| 2 | `bud_bonus_withholding_rate_table` + 2026 年版データ投入 | a-bud | 1.5h |
| 3 | `calculateBonus` 関数実装 | a-bud | 2h |
| 4 | 健保・厚年の上限処理 | a-bud | 1h |
| 5 | 雇用保険・介護保険対応 | a-bud | 0.5h |
| 6 | 算出率表ルックアップ | a-bud | 0.5h |
| 7 | RLS ポリシー | a-bud | 0.5h |
| 8 | 単体テスト 50+ ケース | a-bud | 2h |

合計: 約 8.5h ≈ **0.75d**

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 賞与算定式 | **admin 手動入力**で開始、自動化は Phase E |
| 判 2 | 業績加算の処理 | `performance_addition` 列で個別管理、根拠は別テーブル（Phase E）|
| 判 3 | 前月給与なしの特例 | **特例 1（6 ヶ月按分）** 採用 |
| 判 4 | 退職者への寸志 | 賞与扱いせず、`bud_furikomi` で個別処理 |
| 判 5 | 決算賞与の頻度 | **年 1 回まで**、追加分は別期間で |
| 判 6 | 健保上限の累計対象 | 4 月 - 翌 3 月（健保年度）|

---

## 11. 既知のリスクと対策

### 11.1 健保年度累計の追跡漏れ

- 4 月跨ぎで累計リセット忘れ
- 対策: `effective_fiscal_year` で明示、テストで境界値確認

### 11.2 月給ゼロでの算出率ルックアップ

- 育休中等で前月給与 0 円
- 対策: §6.4 特例適用、テストケースで確認

### 11.3 賞与の二重支給

- 同期間で 2 回計算実行
- 対策: UNIQUE 制約 (period_id, employee_id) + 事前チェック

### 11.4 標準賞与額上限の判定誤り

- 健保（年度累計）と厚年（1 回）を混同
- 対策: 関数を分離、各々独立にテスト

### 11.5 算出率表の年度更新忘れ

- 2027 年版が未投入のまま 2027 年支給
- 対策: 年度切替前に Cron でアラート

### 11.6 雇用保険率の業種差

- 一般 / 建設 / 農林水産で異なる
- 対策: `root_companies.industry_class` で分岐

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-24-bud-b-05-bonus-processing.md`（設計書）
- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md`
- `docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md`

---

## 13. 受入基準（Definition of Done）

- [ ] `bud_bonus_records` migration 適用済
- [ ] 算出率表 2026 年版（甲・乙）データ投入済
- [ ] `calculateBonus` 単体テスト 50+ ケース pass
- [ ] 健保 573 万円 / 厚年 150 万円 上限処理が境界値で正答
- [ ] 介護保険（40-64 歳）の年齢判定が正答
- [ ] 前月給与なしの特例（6 ヶ月按分）が動作
- [ ] 算出率表ルックアップが範囲外でエラー
- [ ] RLS（自分 / manager / admin）テスト pass
- [ ] 健保年度累計の追跡が正答
