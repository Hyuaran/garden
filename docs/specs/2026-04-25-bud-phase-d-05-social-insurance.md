# Bud Phase D #05: 社会保険計算（健保 / 厚年 / 雇用保険 / 介護保険）

- 対象: Garden-Bud Phase D 社会保険料の計算ロジック
- 優先度: **🔴 最高**（誤計算は法令違反 + 従業員不利益）
- 見積: **1.0d**（料率管理 + 計算 + 月変・賞与時差異）
- 担当セッション: a-bud（実装）/ a-root（料率マスタ）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #05）
- 前提:
  - **Bud Phase B-02 社保・税**（設計済、本 spec で実装着手）
  - **Bud Phase D-02 / D-03**
  - 全国健康保険協会（協会けんぽ）2026 年度料率表
  - 厚生年金保険料率（一律 18.3%）
  - 雇用保険料率 2026 年度
  - `root_insurance` マスタ

---

## 1. 目的とスコープ

### 1.1 目的

Garden-Bud の月次給与・賞与で控除する社会保険料（健保 / 厚年 / 介護 / 雇用）を**正確かつ法令準拠**で計算する。標準報酬月額の改定（4-6 月算定基礎届 / 月変 / 育休復帰時改定）に対応し、料率の年度切替を運用する。

### 1.2 含めるもの

- 標準報酬月額の管理テーブル
- 健保・厚年・介護・雇用の各料率管理
- 月変（随時改定）の判定ロジック
- 算定基礎届（4-6 月平均で 9 月改定）
- 賞与時の標準賞与額計算（→ D-03 連動）
- 育休・産休時の保険料免除

### 1.3 含めないもの

- 給与計算の上位ロジック → D-02
- 賞与計算の上位ロジック → D-03
- 源泉徴収（所得税）→ D-02
- 住民税 → D-02

---

## 2. 用語整理

### 2.1 社保 4 種類

| 保険 | 略称 | 対象 | 料率（労使折半） |
|---|---|---|---|
| 健康保険 | 健保 | 全被保険者 | 約 9-11%（協会けんぽ都道府県別）|
| 厚生年金保険 | 厚年 | 全被保険者 | 18.3%（一律）|
| 介護保険 | 介護 | 40-64 歳 | 1.6%（協会けんぽ）|
| 雇用保険 | 雇保 | 全雇用者 | 一般 0.6%（労使比例 0.4:0.6 等）|

### 2.2 標準報酬月額

- 給与の額に応じて**等級**（1-50 等級）に振り分け
- 健保 / 厚年で等級表が違う（健保 50 / 厚年 32）
- 算定基礎は **4-6 月の平均給与**で決定 → 9 月から翌年 8 月適用

### 2.3 月変（随時改定）

- 連続 3 ヶ月で**等級が 2 級以上**変動した場合、4 ヶ月目から改定
- 固定的賃金の変動（昇給・降給）が前提

---

## 3. テーブル定義

### 3.1 `bud_standard_remuneration_grades`（等級表）

```sql
CREATE TABLE public.bud_standard_remuneration_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_type text NOT NULL,                 -- 'health' | 'pension'
  effective_year int NOT NULL,
  grade int NOT NULL,                           -- 1, 2, ...
  remuneration_min numeric(10, 0) NOT NULL,     -- 報酬月額の下限
  remuneration_max numeric(10, 0),              -- 上限（NULL = 無制限）
  standard_amount numeric(10, 0) NOT NULL,      -- 標準報酬月額
  UNIQUE (insurance_type, effective_year, grade)
);
```

### 3.2 `bud_insurance_rates`（料率）

```sql
CREATE TABLE public.bud_insurance_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from date NOT NULL,
  effective_to date,                            -- NULL = 現行
  prefecture text,                              -- 健保・介護のみ（協会けんぽ都道府県別）

  -- 健康保険（労使合計、折半は計算時）
  health_rate numeric(7, 6) NOT NULL,           -- 例: 0.0998
  long_term_care_rate numeric(7, 6) NOT NULL,   -- 例: 0.0160（40-64 歳のみ加算）

  -- 厚生年金（一律）
  pension_rate numeric(7, 6) NOT NULL,          -- 0.183

  -- 雇用保険（業種別、労使比例）
  employment_total_rate numeric(7, 6) NOT NULL, -- 例: 0.0155
  employment_employee_rate numeric(7, 6) NOT NULL, -- 例: 0.0060
  industry_class text NOT NULL,                 -- 'general' | 'agriculture' | 'construction'

  notes text,
  UNIQUE (effective_from, prefecture, industry_class)
);
```

### 3.3 `bud_employee_remuneration_history`（標準報酬履歴）

```sql
CREATE TABLE public.bud_employee_remuneration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  insurance_type text NOT NULL,                 -- 'health' | 'pension'
  effective_from date NOT NULL,                 -- 適用開始月の 1 日
  effective_to date,                            -- 終了（NULL = 現行）
  grade int NOT NULL,
  standard_amount numeric(10, 0) NOT NULL,
  reason text NOT NULL,
    -- 'initial' = 入社時
    -- 'kettei' = 算定基礎届
    -- 'getsu_hen' = 月変
    -- 'sanzen_hen' = 産前産後・育休復帰時
    -- 'manual' = 手動
  source_period_id uuid,                        -- 月変判定根拠の period
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (employee_id, insurance_type, effective_from)
);

CREATE INDEX idx_remuneration_history_active
  ON bud_employee_remuneration_history (employee_id, insurance_type, effective_from DESC)
  WHERE effective_to IS NULL;
```

### 3.4 `bud_employee_insurance_exemptions`（免除）

```sql
CREATE TABLE public.bud_employee_insurance_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),
  exemption_type text NOT NULL,                 -- 'maternity' | 'childcare'
  start_date date NOT NULL,
  end_date date,
  approved_by uuid,
  approved_at timestamptz,
  notes text
);
```

---

## 4. 月次給与時の社保計算

### 4.1 計算フロー

```
1. employee の現行 標準報酬月額（健保 / 厚年）を取得
2. 健保料率（都道府県別）を取得
3. 健保 = 標準報酬月額 × 健保率 × 1/2
4. 厚年 = 標準報酬月額 × 18.3% × 1/2
5. 介護（40-64 歳のみ） = 標準報酬月額 × 介護率 × 1/2
6. 雇用 = gross_pay × 雇用従業員率（標準報酬月額ではなく実支給）
7. 免除中なら 0
```

### 4.2 計算関数

```typescript
type CalculateMonthlyInsuranceInput = {
  employee_id: string;
  payroll_period_id: string;
  gross_pay: number;
  reference_date: Date;  // 計算基準日（通常は支給日）
};

type SocialInsuranceBreakdown = {
  health_insurance: number;
  welfare_pension: number;
  long_term_care_insurance: number;
  employment_insurance: number;
  total: number;
  health_grade: number;
  pension_grade: number;
};

async function calculateMonthlyInsurance(
  input: CalculateMonthlyInsuranceInput
): Promise<SocialInsuranceBreakdown> {
  const exempted = await isExempted(input.employee_id, input.reference_date);
  if (exempted) return zeroBreakdown();

  const healthGrade = await getCurrentGrade(input.employee_id, 'health', input.reference_date);
  const pensionGrade = await getCurrentGrade(input.employee_id, 'pension', input.reference_date);
  const rates = await getInsuranceRates(input.reference_date, getPrefecture(input));
  const age = calculateAge(input.employee_id, input.reference_date);

  const health = Math.floor(healthGrade.standard_amount * rates.health_rate / 2);
  const pension = Math.floor(pensionGrade.standard_amount * rates.pension_rate / 2);
  const longTermCare = (age >= 40 && age <= 64)
    ? Math.floor(healthGrade.standard_amount * rates.long_term_care_rate / 2)
    : 0;
  const employment = Math.floor(input.gross_pay * rates.employment_employee_rate);

  return {
    health_insurance: health,
    welfare_pension: pension,
    long_term_care_insurance: longTermCare,
    employment_insurance: employment,
    total: health + pension + longTermCare + employment,
    health_grade: healthGrade.grade,
    pension_grade: pensionGrade.grade,
  };
}
```

### 4.3 端数処理

- 健保・厚年・介護: 1 円未満は**従業員負担を切り捨て**、会社負担は逆に切り上げ（通則）
- 雇用保険: 1 円未満切り捨て

---

## 5. 月変判定（随時改定）

### 5.1 判定条件（3 つ全て満たすこと）

1. **固定的賃金の変動**（昇給・降給・諸手当の改定）
2. **3 ヶ月連続**で支給額平均が現等級から **2 等級以上**乖離
3. **17 日以上**の支払基礎日数

### 5.2 判定 Cron

```typescript
// /api/cron/bud-getsu-hen-detect（毎月 1 日 04:00 JST）
export async function GET() {
  const targets = await fetchEmployeesNeedingCheck();
  for (const emp of targets) {
    const last3Months = await fetchLast3SalaryRecords(emp.id);
    if (!isFixedPayChanged(last3Months)) continue;
    if (!hasMinimumPayDays(last3Months, 17)) continue;
    const avg = calculateAverage(last3Months);
    const currentGrade = await getCurrentGrade(emp.id, 'health');
    const newGrade = lookupGrade('health', avg, currentYear);
    if (Math.abs(newGrade - currentGrade) >= 2) {
      // 月変対象 → 4 ヶ月目から改定
      await proposeRemunerationChange(emp.id, 'getsu_hen', newGrade, ...);
    }
  }
  return Response.json({ ok: true });
}
```

### 5.3 改定提案 → 承認 → 適用

```
Cron 検知 → bud_remuneration_change_proposals に起票
  ↓
admin が確認・承認
  ↓
bud_employee_remuneration_history に新規行追加（前行の effective_to 設定）
  ↓
翌月以降の給与計算に反映
```

---

## 6. 算定基礎届（年次定時改定）

### 6.1 仕組み

- 4-6 月の 3 ヶ月平均で標準報酬月額を**新規決定**
- 9 月から翌年 8 月まで適用
- 年金事務所への届出が必要（紙 or 電子）

### 6.2 自動計算 + 届出帳票生成

```typescript
// /api/cron/bud-santei-kiso-prepare（7 月 1 日 03:00 JST）
export async function GET() {
  const period = { from: '2026-04-01', to: '2026-06-30' };
  const employees = await fetchActiveEmployees();
  const results = [];
  for (const emp of employees) {
    const records = await fetch3MonthsRecords(emp.id, period);
    if (records.length < 3) continue;  // 中途入社は別判定
    const avg = average(records.map(r => r.gross_pay));
    const newGrade = lookupGrade('health', avg, currentYear);
    results.push({ employee: emp, avg, newGrade });
  }
  // 算定基礎届テンプレ生成 → admin 確認 → 届出
  await generateSanteiPdf(results);
  return Response.json({ ok: true });
}
```

### 6.3 適用タイミング

- 9 月給与から新等級
- `bud_employee_remuneration_history` に **2026-09-01 effective_from** で行追加

---

## 7. 賞与時の社保（標準賞与額）

D-03 §5 で詳述、本 spec では再掲のみ:

- 健保: 年度累計 573 万円上限（千円未満切り捨て後の額に料率）
- 厚年: 1 回 150 万円上限
- 介護（40-64 歳）: 健保と同額
- 雇用: 実支給額に料率（上限なし）

---

## 8. 産休・育休の免除

### 8.1 対象

- 産前 6 週間 〜 産後 8 週間
- 育休（最長 子 2 歳まで）

### 8.2 免除範囲

- 健保・厚年・介護: **本人負担 + 会社負担とも 100% 免除**
- 雇用: 免除なし（実支給がゼロ前提なので影響なし）

### 8.3 計算時の動作

```typescript
const exempted = await isExempted(employeeId, referenceDate);
if (exempted) {
  return {
    health_insurance: 0,
    welfare_pension: 0,
    long_term_care_insurance: 0,
    employment_insurance: 0,
    total: 0,
    health_grade: currentGrade.health,
    pension_grade: currentGrade.pension,
  };
}
```

---

## 9. 法令対応チェックリスト

### 9.1 健康保険法

- [ ] 第 40 条: 標準報酬月額の決定（算定基礎・月変・産休復帰時）
- [ ] 第 158 条: 産休・育休の保険料免除
- [ ] 都道府県別料率（協会けんぽ）

### 9.2 厚生年金保険法

- [ ] 第 21 条: 標準報酬月額（30 等級制、健保と異なる）
- [ ] 一律 18.3%

### 9.3 介護保険法

- [ ] 40 歳到達月から控除開始
- [ ] 65 歳到達月の前月で控除終了

### 9.4 雇用保険法

- [ ] 業種別料率（一般・農林水産・建設）
- [ ] 賞与にも適用

---

## 10. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_standard_remuneration_grades` migration + 健保 50 / 厚年 32 等級表投入 | a-bud | 2h |
| 2 | `bud_insurance_rates` migration + 都道府県別 / 業種別データ投入 | a-bud | 1.5h |
| 3 | `bud_employee_remuneration_history` migration | a-bud | 0.5h |
| 4 | `bud_employee_insurance_exemptions` migration | a-bud | 0.25h |
| 5 | `calculateMonthlyInsurance` 関数 | a-bud | 1.5h |
| 6 | 月変判定 Cron | a-bud | 1.5h |
| 7 | 算定基礎届 自動計算 | a-bud | 1.5h |
| 8 | 賞与時計算（D-03 連動）| a-bud | 0.5h |
| 9 | 免除フロー（産休・育休）| a-bud | 0.5h |
| 10 | 単体テスト 80+ ケース | a-bud | 2h |

合計: 約 12h ≈ **1.0d**（妥当）

---

## 11. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 健保組合 vs 協会けんぽ | **協会けんぽ前提**で開始、健保組合は Phase E |
| 判 2 | 月変の固定的賃金判定 | `root_salary_systems` の base_pay 変動で判定 |
| 判 3 | 算定基礎届の電子提出 | **当面紙 PDF 出力**、e-Gov 対応は Phase E |
| 判 4 | 産休・育休の自動検知 | **手動登録**で開始、KoT 連携は Phase E |
| 判 5 | 同月転入時の保険料 | 末日在籍で 1 ヶ月分（法定通り）|
| 判 6 | 雇用保険率の業種判定 | `root_companies.industry_class` を初期値、年度切替で再確認 |

---

## 12. 既知のリスクと対策

### 12.1 都道府県切替

- 引っ越しで保険料変動
- 対策: `bud_employee_remuneration_history` に都道府県 snapshot、変更時は手動で再判定

### 12.2 40 歳・65 歳到達月

- 介護保険の開始・終了タイミング
- 対策: `date_of_birth` から自動判定、月初基準

### 12.3 月変判定の誤検知

- 一時的な手当（夜勤等）で平均が変動
- 対策: 固定的賃金の変動有無を**事前判定**してから 3 ヶ月平均

### 12.4 算定基礎届の対象外

- 6/1 以降入社、休業中等
- 対策: 個別に判定ロジック（中途・育休復帰特例）

### 12.5 料率年度切替忘れ

- 3 月給与で旧料率使用
- 対策: `effective_from` で自動切替、未設定なら警告

### 12.6 端数処理の差異

- 円未満を四捨五入か切り捨てか
- 対策: 法定通り**労使共に従業員負担分は切り捨て**

---

## 13. 関連ドキュメント

- `docs/specs/2026-04-24-bud-b-02-social-insurance-tax.md`（設計書）
- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md`
- `docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md`

---

## 14. 受入基準（Definition of Done）

- [ ] 等級表（健保 50 等級 / 厚年 32 等級）2026 年度版投入済
- [ ] 都道府県別 + 業種別 料率投入済
- [ ] 標準報酬月額履歴の管理動作
- [ ] `calculateMonthlyInsurance` 単体テスト 80+ pass（境界値網羅）
- [ ] 月変 Cron が動作、改定提案 → 承認 → 適用
- [ ] 算定基礎届 自動計算 + PDF 出力
- [ ] 賞与時計算が D-03 と連動して正答
- [ ] 産休・育休の免除フロー動作
- [ ] 40 歳・65 歳到達の境界値で介護保険判定正答
- [ ] 端数処理（切り捨て）テスト pass

---

## ⚙️ Kintone 解析判断 #18 + #25 反映 (2026-04-26)

> a-main 006 確定の 32 件のうち、本 spec に直接影響する 2 件を末尾追記。
> 確定ログ: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`

### #18 給与計算権限境界（4 ロール）

本 spec の RLS / role 列挙に以下 4 ロールを追加：

| ロール | 担当 | 主な権限 |
|---|---|---|
| `payroll_calculator` | 計算者（上田） | 給与計算実行 / 修正 / インポート |
| `payroll_approver` | 承認者（宮永・小泉） | 承認 / 差戻し（V6: 自起票承認禁止と同等の自己承認禁止） |
| `payroll_disburser` | MFC インポート実行（上田） | MFC CSV ダウンロード / 振込 CSV 出力 |
| `payroll_auditor` | 監査（東海林・admin） | 全件閲覧 / 目視チェック |

実装: `bud.has_payroll_role(roles text[])` ヘルパー関数を **D-09 §4** で定義、本 spec で再利用。
RLS は role 別に USING / WITH CHECK を分割（Phase A-1 V6 自己承認禁止と同パターン）。
4 ロールは `root.employee_payroll_roles` テーブル（本 batch では未起票、Root spec で別途定義予定）。

### #25 「東海林頼んだ Excel」フィールド廃止

Kintone App 21（給与一覧）が保持していた **「東海林頼んだ Excel」フィールド**は、
月次報告資料 Excel への外部参照だった。Garden 移行時：

- 当該フィールドは **migration 対象外**（廃止）
- `bud_payroll_records`（D-10）が直接 master、月次報告資料 Excel への参照は不要
- 旧運用フローの「Excel 確認 → 給与確定」は **Bud Phase D 内で完結**（D-10 + D-11）
- field mapping spec（Kintone → Garden 移行時）に `excluded_fields` として明記

詳細は **D-10（給与計算統合）** + **D-11（MFC CSV 出力）** を参照。

### 影響箇所

本 spec の以下のセクションは上記 2 件を**自動的に継承**:

- §RLS / 役割定義 → 4 ロールヘルパー関数経由
- §field mapping（該当する場合）→ 「東海林頼んだ Excel」を `excluded_fields` リストに追加
- §migration 計画（該当する場合）→ Kintone App 21 移行時の field skip ルール
