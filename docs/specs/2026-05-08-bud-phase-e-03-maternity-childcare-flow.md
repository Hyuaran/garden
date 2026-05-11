# Bud Phase E #03: 産休育休フロー（D-05 拡張、社保免除 + 月変 + 育児短時間勤務）

- 対象: Garden-Bud Phase D-05 社保計算の産休育休関連拡張
- 優先度: **🟡 中**（年数件発生、誤差は社保返還リスク）
- 見積: **0.75d**
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-05-08（a-bud-002 / Phase E v1 #03）
- 前提:
  - Bud Phase D-05 社会保険計算（calculateMonthlyInsurance）
  - 既存 `bud_employee_insurance_exemptions`（D-05 で実装済、産休育休免除レコード）
  - 健康保険法 §159（産前産後休業）、健康保険法 §159 の 3（育児休業等）
  - 厚生年金保険法 §81 の 2（育児休業期間中の保険料免除）

---

## 1. 目的とスコープ

### 1.1 目的

産休・育休に関する社保免除フロー + 復帰時の月変判定 + 育児短時間勤務（標準報酬随時改定）を Phase D-05 純関数の拡張で扱う。免除開始・終了・復帰判定を自動化し、誤った社保徴収（多徴収・過小徴収）を防ぐ。

### 1.2 含めるもの

- **産休**: 産前 6 週（多胎 14 週）+ 産後 8 週の社保免除
- **育休**: 子が 1 歳（最長 2 歳）まで社保免除
- **育休復帰**: 復帰月の社保再開判定
- **育児短時間勤務**: 標準報酬月額の随時改定（月変）特例
- **3 歳未満養育期間**: 厚年保険料の特例（標準報酬下がっても従前等級維持）

### 1.3 含めないもの

- 出産育児一時金 / 出産手当金 → 健康保険組合への申請（Phase F 相当、本 spec 範囲外）
- 育休給付金 → 雇用保険（ハローワーク）申請、Phase F 相当
- 産前産後休業申出書フォーム → Phase C-05 連動
- パパ育休 / パパママ育休プラス特例 → Phase E v2 候補

---

## 2. 純関数拡張

### 2.1 maternity-childcare-functions.ts（新規）

```typescript
// src/app/bud/payroll/_lib/maternity-childcare-functions.ts

export type LeaveType =
  | "maternity_pre"      // 産前
  | "maternity_post"     // 産後
  | "childcare"          // 育休
  | "shorttime_work";    // 育児短時間勤務

export interface LeavePeriod {
  type: LeaveType;
  startDate: string;     // ISO date
  endDate: string;       // ISO date
  notes?: string;
}

/**
 * 指定月の社保徴収判定（免除フラグ）。
 *
 * - 月末日に免除期間内 → 当月免除
 * - 月末日が免除終了日以降 → 当月徴収
 * - 月内に免除開始/終了が混在 → 月末日基準
 */
export function isInsuranceExempted(
  fiscalYear: number,
  month: number,
  leavePeriods: readonly LeavePeriod[],
): {
  exempted: boolean;
  matchedLeave: LeavePeriod | null;
};

/**
 * 育休復帰月の判定（社保再開）。
 */
export function detectChildcareReturn(
  fiscalYear: number,
  month: number,
  leavePeriods: readonly LeavePeriod[],
): {
  isReturnMonth: boolean;
  shouldChargeInsurance: boolean;
};

/**
 * 育児短時間勤務時の標準報酬随時改定特例。
 *
 * 通常の月変（3 ヶ月連続 +2 等級以上）に加え、
 * 育児短時間勤務開始月から 3 ヶ月以降に判定（特例月変）。
 */
export function judgeChildcareGetsuhen(
  shorttimeStartDate: string,
  monthlyRecords: readonly MonthlyRemunerationRecord[],
  currentGrade: number,
): {
  isShorttimeGetsuhen: boolean;
  newGrade: number | null;
  effectiveMonth: number | null;
};

/**
 * 養育期間（3 歳未満）の従前標準報酬維持特例（厚年）。
 *
 * 育休復帰後に短時間勤務で標準報酬が下がっても、
 * 厚年保険料は従前等級を維持できる申出制度。
 *
 * 申出時から 3 歳到達月まで適用。
 */
export function applyChildcarePreservedRemuneration(
  childBirthDate: string,
  applicationDate: string,
  currentGrade: number,
  preservedGrade: number,
  paymentDate: string,
): {
  applyPreservation: boolean;
  effectiveGrade: number;
};
```

### 2.2 既存 `judgeGetsuhen` の不変性

D-05 で実装済の `judgeGetsuhen` は維持。本 spec で `judgeChildcareGetsuhen` を新設、産休育休関連の月変は別関数で扱う。

---

## 3. テーブル拡張

### 3.1 既存 `bud_employee_insurance_exemptions`（D-05）の活用

D-05 で実装済のテーブルを利用。本 spec では追加カラム不要。

```sql
-- D-05 既存定義（参考、変更なし）
create table public.bud_employee_insurance_exemptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.root_employees(id),
  exemption_type text not null
    check (exemption_type in (
      'maternity_pre',
      'maternity_post',
      'childcare',
      'shorttime_work',  -- 本 spec で新規利用
      'preserved_grade'  -- 本 spec で新規利用
    )),
  start_date date not null,
  end_date date,
  notes text,
  ...
);
```

### 3.2 新規テーブル: `bud_employee_preserved_grade_applications`

養育期間の従前等級維持申出（厚年特例）を別テーブルで管理。

```sql
create table public.bud_employee_preserved_grade_applications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.root_employees(id),

  child_birth_date date not null,
  application_date date not null,

  preserved_grade int not null
    check (preserved_grade between 1 and 32),  -- 厚年 32 等級

  effective_from date not null,   -- 申出月の翌月から
  effective_until date not null,  -- 子が 3 歳到達月まで

  status text not null default 'active'
    check (status in ('active', 'cancelled', 'expired')),

  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.root_employees(id)
);

create index idx_bepg_employee on public.bud_employee_preserved_grade_applications(employee_id);
create index idx_bepg_active on public.bud_employee_preserved_grade_applications(status)
  where status = 'active';
```

---

## 4. RLS

```sql
alter table public.bud_employee_preserved_grade_applications enable row level security;

-- 自分の申請は閲覧可
create policy bepg_select_own on public.bud_employee_preserved_grade_applications
  for select using (
    employee_id = (select id from public.root_employees where user_id = auth.uid())
  );

-- payroll_* + admin 全件
create policy bepg_select_payroll on public.bud_employee_preserved_grade_applications
  for select using (
    public.bud_has_payroll_role(null) or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_calculator + admin
create policy bepg_insert on public.bud_employee_preserved_grade_applications
  for insert with check (
    public.bud_has_payroll_role(array['payroll_calculator']) or public.bud_is_admin_or_super_admin()
  );

-- UPDATE: status 変更のみ admin/super_admin
create policy bepg_update_admin on public.bud_employee_preserved_grade_applications
  for update using (public.bud_is_admin_or_super_admin())
    with check (public.bud_is_admin_or_super_admin());

-- DELETE 禁止
create policy bepg_no_delete on public.bud_employee_preserved_grade_applications
  for delete using (false);
```

---

## 5. 法令対応チェックリスト

- [ ] 健保法 §159（産前産後休業期間中の保険料免除）
- [ ] 健保法 §159 の 3（育児休業等期間中の保険料免除）
- [ ] 厚年法 §81 の 2（育児休業期間中の保険料免除）
- [ ] 厚年法 §26（養育期間の従前標準報酬月額の特例）
- [ ] 雇用保険法（育休給付金、本 spec 範囲外だが連動可能）
- [ ] 男女雇用機会均等法（妊娠・出産による不利益取扱い禁止）

---

## 6. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | maternity-childcare-functions.ts 4 関数 | a-bud | 2h |
| 2 | bud_employee_preserved_grade_applications migration + RLS | a-bud | 0.5h |
| 3 | D-05 calculateMonthlyInsurance に免除分岐統合 | a-bud | 1h |
| 4 | 育児短時間勤務 月変判定 統合 | a-bud | 1h |
| 5 | 養育期間特例（厚年従前等級）統合 | a-bud | 0.5h |
| 6 | 単体テスト（境界値: 産前産後 / 育休 / 復帰 / 短時間）| a-bud | 1h |
| 7 | 統合テスト | a-bud | 0.5h |

合計: 約 6.5h ≈ **0.75d**（妥当）

---

## 7. 判断保留事項

| # | 論点 | 起草スタンス |
|---|---|---|
| 判 1 | 多胎妊娠の産前期間 | **14 週**（健保法 §159、3 名以上は別途相談）|
| 判 2 | 育休最長期間 | **2 歳到達月末**（保育所入所できない場合の延長、Garden 運用は東海林さん判断）|
| 判 3 | 育休中の社保免除タイミング | **月末日に育休中なら当月免除**（健保法 §159 の 3）|
| 判 4 | 育児短時間勤務月変の特例 | **3 ヶ月実績で判定**（通常月変と同基準だが、開始月から再カウント）|
| 判 5 | 養育期間特例の申出 | **東海林さん（admin）が個別承認**、自動申請なし |
| 判 6 | パパ育休（出生時育休） | **本 spec 範囲外**（Phase E v2 候補、別フロー）|

---

## 8. 既知のリスクと対策

### 8.1 月末日と免除終了日の境界

- 4/30 まで育休 → 5/1 復帰の場合の 4 月分徴収判定
- 対策: `isInsuranceExempted` のテストで月末日基準を厳密化

### 8.2 育休復帰月の社保

- 復帰月（部分在籍）でも当月末在籍なら徴収 → 但し育児短時間勤務開始なら別判定
- 対策: `detectChildcareReturn` で再開条件を 3 段階で判定

### 8.3 養育期間特例の申出忘れ

- 申出を忘れると標準報酬下がり、将来年金が減る
- 対策: 育休復帰時にリマインダ通知（Phase E #01 の cron に統合可）

### 8.4 多胎妊娠の事務漏れ

- 多胎だが通常 6 週で計算してしまう
- 対策: leave_periods の notes に多胎フラグ、UI で明示

---

## 9. 関連ドキュメント

- `docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md`
- 厚生労働省「育児休業期間中の保険料免除のしおり」
- 日本年金機構「養育期間標準報酬月額特例申出書」

---

## 10. 受入基準（Definition of Done）

- [ ] `isInsuranceExempted` が産休前/後/育休/短時間勤務で正しく判定
- [ ] `detectChildcareReturn` が復帰月を正しく判定
- [ ] `judgeChildcareGetsuhen` が 3 ヶ月実績で月変判定
- [ ] `applyChildcarePreservedRemuneration` が従前等級維持
- [ ] D-05 統合（既存テスト全 pass + 追加 20+ tests pass）
- [ ] bud_employee_preserved_grade_applications RLS 動作
- [ ] 法令準拠（健保法 §159 / §159-3 / 厚年法 §81-2 / §26）
- [ ] 境界値テスト全 pass（月末日 / 復帰月 / 多胎）
