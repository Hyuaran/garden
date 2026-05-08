# Bud Phase E #02: 退職者・中途入社特例（D-02/D-05/D-06 拡張）

- 対象: Garden-Bud Phase D の月次給与・社保・年末調整における特例フロー
- 優先度: **🟢 高**（運用で頻繁に発生、誤差は従業員不利益）
- 見積: **1.0d**
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-05-08（a-bud-002 / Phase E v1 #02）
- 前提:
  - Bud Phase D-02 給与計算（calculateMonthlySalary）
  - Bud Phase D-05 社保計算（calculateMonthlyInsurance）
  - Bud Phase D-06 年末調整連携（shouldExcludeFromSettlement）
  - Root A-3-h（hire_date / retired_date / kou_otsu / dependents_count フィールド）

---

## 1. 目的とスコープ

### 1.1 目的

月途中入社・月途中退職・年内中途退職の **特例分岐** を Phase D 純関数に追加し、日割り計算 + 社保按分 + 即時年末調整精算を一気通貫で扱う。Phase D 純関数の薄い拡張で、設計判断は最小化。

### 1.2 含めるもの

- **月途中入社**: hire_date が当月の場合の日割り給与 + 社保按分
- **月途中退職**: retired_date が当月の場合の日割り給与 + 社保按分
- **年内中途退職**: 退職時の最終給与で年末調整即時精算（D-06 §2.1 連動）
- **退職金（labor allowance）**: D-07 振込との分離（PHASE E では参照のみ、本実装外）

### 1.3 含めないもの

- 退職金計算ロジック → 別 spec（Phase E v2 候補）
- 退職証明書 PDF 発行 → Phase C-04 連動（Phase C で別実装）
- 雇用保険離職票 → Phase C 別 spec
- 健康保険証回収 → Phase C 別 spec

---

## 2. 純関数拡張

### 2.1 D-02 拡張: 日割り基本給

既存 `calculateMonthlyBasicPay` は月給制 fullsalary 算出。月途中入退社時の日割りは `calculateProrated*` 関数群を新設。

```typescript
// src/app/bud/payroll/_lib/special-case-functions.ts（新規）

import { type SalaryCalculationInput } from "./salary-types";

export interface ProratedDaysInput {
  /** 当月暦日数（28-31）*/
  calendarDays: number;
  /** 入社日（当月内、ISO date）*/
  hireDate?: string;
  /** 退職日（当月内、ISO date）*/
  retiredDate?: string;
  /** 給与計算対象月（1-12）*/
  paymentMonth: number;
  /** 給与計算対象年 */
  paymentYear: number;
}

export interface ProratedDaysResult {
  /** 在籍日数（日割り分子）*/
  enrolledDays: number;
  /** 暦日数（日割り分母）*/
  calendarDays: number;
  /** 比率（0-1）*/
  ratio: number;
  /** 種別 */
  caseType: "full_month" | "mid_month_hire" | "mid_month_retire" | "both";
}

/**
 * 月途中入社・退社時の日割り計算。
 *
 * 例:
 *   - 4 月（30 日）の 4/15 入社 → enrolledDays=16, ratio=16/30
 *   - 4 月の 4/20 退社 → enrolledDays=20, ratio=20/30
 *   - 同月内入退社 → both case
 */
export function calculateProratedDays(input: ProratedDaysInput): ProratedDaysResult;

/**
 * 月給制基本給の日割り。
 */
export function calculateProratedMonthlyBasicPay(
  monthlyBasePay: number,
  proratedDays: ProratedDaysResult,
): number;
```

### 2.2 D-05 拡張: 社保按分

社保は **当月末在籍** が基準。月末退職時のみ当月分徴収、月初退職は前月分まで。月変判定の対象外（短期在籍期間）。

```typescript
export interface InsuranceProrationInput {
  isEnrolledAtMonthEnd: boolean;  // 月末日に在籍していたか
  isMidMonthHire: boolean;        // 当月入社かつ月末在籍
  isMidMonthRetire: boolean;      // 当月退社（月末退社含む）
  hireDate?: string;
  retiredDate?: string;
}

export interface InsuranceProrationResult {
  /** 当月社保徴収するか */
  shouldChargeInsurance: boolean;
  /** 月変判定対象外フラグ */
  excludeFromGetsuhen: boolean;
  /** 算定基礎届対象外フラグ */
  excludeFromSantei: boolean;
}

export function decideInsuranceProration(
  input: InsuranceProrationInput,
): InsuranceProrationResult;
```

### 2.3 D-06 拡張: 退職時即時年末調整精算

D-06 で `shouldExcludeFromSettlement` は実装済（当年退職 → excluded_reason='retired_in_year'）。E-02 では **退職時最終給与での即時精算** ロジックを追加。

```typescript
export interface ImmediateSettlementInput {
  retiredDate: string;
  fiscalYear: number;
  monthlyWithheldRecords: MonthlyWithheldRecord[];
  /** 退職月までに徴収した源泉徴収累計（D-02/D-03 経由）*/
  totalWithheldUntilRetire: number;
  /** 退職時点の年税額（簡易計算、年末調整未実施）*/
  estimatedAnnualTax: number;
  /** 最終給与の通常計算結果 */
  finalSalary: SalaryCalculationResult;
}

export interface ImmediateSettlementResult {
  settlementAmount: number;
  settlementType: "refund" | "additional" | "zero";
  /** 最終給与に上乗せ・控除 */
  appliedToFinalSalary: ApplySettlementResult;
  /** 源泉徴収票の即時発行が必要 */
  requiresGensenChoshuHyoIssuance: true;
}

export function calculateImmediateSettlement(
  input: ImmediateSettlementInput,
): ImmediateSettlementResult;
```

---

## 3. テーブル拡張（最小）

D-02 / D-05 / D-06 の既存テーブルは変更なし。本 spec では拡張用に **1 テーブル追加** のみ。

### 3.1 `bud_special_case_log`（特例適用記録）

```sql
create table public.bud_special_case_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.root_employees(id),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),

  case_type text not null
    check (case_type in (
      'mid_month_hire',
      'mid_month_retire',
      'immediate_year_end_settlement',
      'maternity_leave_start',     -- E-03 で利用
      'childcare_leave_return'     -- E-03 で利用
    )),

  proration_ratio numeric(5, 4),  -- 0.0000-1.0000
  applied_amount numeric(10, 0),  -- 日割り後の額 or 即時精算額

  -- メタ
  applied_at timestamptz not null default now(),
  applied_by uuid references public.root_employees(id),
  notes text,

  unique (employee_id, payroll_period_id, case_type)
);

create index idx_bsc_log_employee on public.bud_special_case_log(employee_id);
create index idx_bsc_log_period on public.bud_special_case_log(payroll_period_id);
```

---

## 4. RLS

```sql
alter table public.bud_special_case_log enable row level security;

-- 自分の記録は閲覧可
create policy bsc_select_own on public.bud_special_case_log
  for select using (
    employee_id = (select id from public.root_employees where user_id = auth.uid())
  );

-- payroll_* + admin は全件閲覧
create policy bsc_select_payroll on public.bud_special_case_log
  for select using (
    public.bud_has_payroll_role(null) or public.bud_is_admin_or_super_admin()
  );

-- INSERT/UPDATE: payroll_calculator + admin
create policy bsc_insert on public.bud_special_case_log
  for insert with check (
    public.bud_has_payroll_role(array['payroll_calculator']) or public.bud_is_admin_or_super_admin()
  );

-- DELETE 禁止
create policy bsc_no_delete on public.bud_special_case_log
  for delete using (false);
```

---

## 5. 法令対応チェックリスト

- [ ] 労基法 §24（賃金全額払い、日割り計算正確性）
- [ ] 健保法 §40 / §41（保険料徴収月の判定、当月末在籍が基準）
- [ ] 厚年法 §19（同上）
- [ ] 雇用保険法（離職時の手当計算、本 spec 範囲外）
- [ ] 所得税法 §190 / §226（中途退職時の源泉徴収票即時発行義務）

---

## 6. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | special-case-functions.ts（calculateProratedDays / decideInsuranceProration / calculateImmediateSettlement）| a-bud | 2h |
| 2 | D-02 calculateMonthlySalary 統合（特例分岐追加）| a-bud | 1h |
| 3 | D-05 calculateMonthlyInsurance 統合（按分分岐）| a-bud | 1h |
| 4 | D-06 retiree 即時精算 Server Action | a-bud | 1.5h |
| 5 | bud_special_case_log migration + RLS | a-bud | 0.5h |
| 6 | 単体テスト（境界値: 月初・月末・同月内入退社）| a-bud | 1.5h |
| 7 | 統合テスト（D-02 + D-05 + D-06 連携）| a-bud | 0.5h |

合計: 約 8h ≈ **1.0d**（妥当）

---

## 7. 判断保留事項

| # | 論点 | 起草スタンス |
|---|---|---|
| 判 1 | 月末退職の社保徴収月 | **当月分徴収**（月末日 23:59:59 JST まで在籍）、それ以前は前月最終徴収 |
| 判 2 | 同月内入退社の処理 | **日割り両端切り**（在籍日数のみ算定）、社保は徴収なし |
| 判 3 | 月途中入社の社保 | 当月末在籍なら **当月分徴収**、月変判定対象外（3 ヶ月実績なし） |
| 判 4 | 退職時の年末調整（簡易）| **退職月までの累計 + 想定 12 月給与（推定）で年税額算出**、東海林さん要確認 |
| 判 5 | 退職金の源泉徴収 | **本 spec 対象外**（別 spec、退職所得控除の特殊計算が必要）|
| 判 6 | 日割り端数処理 | **切り捨て（基本給 floor）**、Phase D-02 流儀 |
| 判 7 | 特例ログの保管期間 | 賃金台帳と同じ **5 年**（労基法 §109）|

---

## 8. 既知のリスクと対策

### 8.1 月末退職と月初退職の判定ミス

- 4/30 退職 vs 5/1 退職で社保扱いが大きく変わる
- 対策: `decideInsuranceProration` のテストで 4/30 / 5/1 / 5/31 / 6/1 の 4 ケース必須

### 8.2 即時精算の年税額推定誤差

- 退職時の推定年税額と実際の年末調整精算がずれる
- 対策: 「推定」と明記、追加精算が必要なら税務上の確定申告で従業員側対応

### 8.3 同月内入退社（極稀）

- 試用期間で 1 週間で退社等
- 対策: ratio が極小（< 0.1）でも warning を出す

### 8.4 hire_date / retired_date の null

- マスタ未設定で日割り計算できない
- 対策: 両 NULL なら `caseType=full_month`、どちらか NULL なら例外

---

## 9. 関連ドキュメント

- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md`
- `docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md`
- 健康保険法施行規則
- 厚生年金保険法施行規則

---

## 10. 受入基準（Definition of Done）

- [ ] `calculateProratedDays` が 4 種別（full / mid_hire / mid_retire / both）を正しく分類
- [ ] `decideInsuranceProration` が月末日基準で正しく判定
- [ ] `calculateImmediateSettlement` が退職時に refund/additional 正しく算出
- [ ] D-02 / D-05 / D-06 への統合（既存テスト全 pass、追加 20+ tests pass）
- [ ] bud_special_case_log RLS 動作（自分閲覧 / payroll_* 全件 / DELETE 禁止）
- [ ] 法令準拠（労基法 §24 / 健保法 §40-41 / 所得税法 §190 / §226）
- [ ] 境界値テスト全 pass（月初 / 月末 / 同月入退社）
