# Bud B-06: 給与 KPI ダッシュボード（人件費推移）仕様書

- 対象: Garden-Bud の給与・賞与 KPI 可視化、Bloom ダッシュボードとの連携
- 見積: **0.25d**（約 2 時間）
- 担当セッション: a-bud
- 作成: 2026-04-24（a-auto / Phase A 先行 batch6 #B-06）
- 前提 spec: B-01〜B-05 全て

---

## 1. 目的とスコープ

### 目的
B-01〜B-05 で蓄積される給与・賞与データから**人件費 KPI**を集計し、経営判断用のダッシュボードとして可視化。Bloom の Workboard（経営ダッシュボード）と連携、経営会議資料として活用可能にする。

### 含める
- `/bud/kpi/salary` ダッシュボード画面
- 月次・四半期・年度の人件費推移グラフ
- 法人別・雇用形態別・部署別の集計
- 給与 vs 賞与の構成比
- Bloom への集計データ提供 API（将来連携）

### 含めない
- 個別従業員の給与詳細（権限違反）
- 予測・シミュレーション機能（Phase C）
- MF クラウド給与との比較ダッシュボード（Phase A 終盤の並行運用、別 spec）

---

## 2. 既存実装との関係

### Bud B-01〜B-05
- 入力: `bud_salary_records`, `bud_bonus_records`, `bud_transfers`（source_type='salary'/'bonus'）
- 出力: 集計結果（UI と API 両方）

### Bloom Workboard（Phase C 予定）
- Bloom に人件費 KPI カードを組み込む（本 spec の API を Bloom が呼出）
- 集計データは匿名化集計（個人特定不可）

### Forest（経営ダッシュボード）
- 月次 P/L との連携（Forest 側が本 spec の集計 API を呼出可）

---

## 3. 依存関係

```mermaid
flowchart TB
    A[bud_salary_records] --> D[集計ビュー]
    B[bud_bonus_records] --> D
    C[root_employees<br/>法人・雇用形態] --> D

    D --> E[/bud/kpi/salary<br/>admin ダッシュボード]
    D --> F[Bloom Workboard 連携<br/>API /api/bud/kpi/salary-summary]
    D --> G[Forest 月次 P/L 連携<br/>API 同上]
```

---

## 4. データモデル提案

### 4.1 集計ビュー `bud_salary_kpi_monthly_v`

```sql
CREATE VIEW bud_salary_kpi_monthly_v AS
SELECT
  target_month,
  company_id,
  employment_type,

  -- 集計値
  COUNT(*) AS employee_count,
  SUM(gross_pay) AS total_gross_pay,
  SUM(deductions_total) AS total_deductions,
  SUM(net_pay) AS total_net_pay,
  AVG(gross_pay) AS avg_gross_pay,
  SUM(overtime_pay) AS total_overtime_pay,
  SUM(overtime_minutes) AS total_overtime_minutes,

  -- 社保負担（会社負担分は別計算、本ビューは従業員負担分）
  SUM(health_insurance) AS total_health_insurance_employee,
  SUM(welfare_pension) AS total_welfare_pension_employee,
  SUM(employment_insurance) AS total_employment_insurance_employee,
  SUM(income_tax) AS total_income_tax,
  SUM(resident_tax) AS total_resident_tax

FROM bud_salary_records
WHERE status = 'paid'
GROUP BY target_month, company_id, employment_type;
```

### 4.2 賞与集計 `bud_bonus_kpi_quarterly_v`

```sql
CREATE VIEW bud_bonus_kpi_quarterly_v AS
SELECT
  DATE_TRUNC('quarter', target_date)::date AS quarter,
  bonus_type,
  company_id,
  COUNT(*) AS recipient_count,
  SUM(gross_amount) AS total_gross,
  SUM(deductions_total) AS total_deductions,
  SUM(net_amount) AS total_net
FROM bud_bonus_records
WHERE status = 'paid'
GROUP BY 1, bonus_type, company_id;
```

### 4.3 年間人件費 `bud_annual_labor_cost_v`

```sql
CREATE VIEW bud_annual_labor_cost_v AS
SELECT
  DATE_PART('year', target_month) AS year,
  company_id,
  -- 給与年額
  SUM(s.gross_pay) AS salary_annual,
  -- 賞与年額
  COALESCE(b.bonus_annual, 0) AS bonus_annual,
  -- 合計
  SUM(s.gross_pay) + COALESCE(b.bonus_annual, 0) AS total_labor_cost
FROM bud_salary_records s
LEFT JOIN (
  SELECT DATE_PART('year', target_date) AS year, company_id,
         SUM(gross_amount) AS bonus_annual
  FROM bud_bonus_records
  WHERE status = 'paid'
  GROUP BY 1, company_id
) b USING (year, company_id)
WHERE s.status = 'paid'
GROUP BY 1, s.company_id, b.bonus_annual;
```

### 4.4 RLS（ビューへの SELECT 権限）

```sql
-- ビューに直接 RLS は付けられない。代わりにクエリ関数経由で提供
CREATE OR REPLACE FUNCTION bud_get_salary_kpi(
  p_from_month date,
  p_to_month date
) RETURNS SETOF bud_salary_kpi_monthly_v
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM bud_salary_kpi_monthly_v
  WHERE target_month BETWEEN p_from_month AND p_to_month
    AND (
      -- admin + super_admin のみ閲覧可
      (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('admin', 'super_admin')
    );
$$;

GRANT EXECUTE ON FUNCTION bud_get_salary_kpi TO authenticated;
```

---

## 5. 業務フロー / UI

### 5.1 `/bud/kpi/salary` ダッシュボード

```
┌─ 給与 KPI ダッシュボード ────────────────────────┐
│                                                   │
│ 期間: [2026-04] ~ [2026-12] [Apply]               │
│ 法人: [▼ 全社]                                    │
│                                                   │
│ ┌─ 月次人件費推移 ─────────────────────────────┐ │
│ │                                                │ │
│ │  ██████  ██████  ██████                       │ │
│ │  ██████  ██████  ██████                       │ │
│ │  ■給与 □賞与（7・12 月に突出）                │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ サマリカード ─────────┐                        │
│ │ 期間中 給与合計 ¥X 億 │                        │
│ │ 期間中 賞与合計 ¥Y 百万│                        │
│ │ 期間中 平均給与 ¥Z 万  │                        │
│ │ 社員 N 名             │                        │
│ └────────────────────────┘                        │
│                                                   │
│ ┌─ 法人別・雇用形態別内訳 ────────────────────┐  │
│ │ テーブル（ピボット）                          │  │
│ └───────────────────────────────────────────────┘  │
│                                                   │
│ ┌─ 残業時間推移 ───────────────────────────────┐ │
│ │ 折れ線グラフ（時間/人・月）                    │ │
│ └────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### 5.2 グラフ・指標

| 指標 | タイプ | 粒度 |
|---|---|---|
| 人件費推移（給与 + 賞与）| 積み上げ棒 | 月次 |
| 従業員数推移 | 折れ線 | 月次 |
| 平均給与推移 | 折れ線 | 月次 |
| 残業時間 | 折れ線（人あたり）| 月次 |
| 社保会社負担 | カード | 月次（推定値）|
| 雇用形態別給与構成 | 円グラフ | 期間合計 |
| 法人別給与構成 | 横棒 | 期間合計 |

---

## 6. API / Server Action 契約

```typescript
// ダッシュボード用
export async function getSalaryKpi(input: {
  fromMonth: string;       // YYYY-MM-DD
  toMonth: string;
  companyIds?: string[];
}): Promise<{
  monthly: Array<{
    targetMonth: string;
    companyId: string;
    employmentType: string;
    employeeCount: number;
    totalGrossPay: number;
    totalNetPay: number;
    totalOvertimePay: number;
    totalOvertimeMinutes: number;
    avgGrossPay: number;
  }>;
  quarterlyBonus: Array<{
    quarter: string;
    bonusType: string;
    companyId: string;
    recipientCount: number;
    totalGross: number;
    totalNet: number;
  }>;
  annual: Array<{
    year: number;
    companyId: string;
    salaryAnnual: number;
    bonusAnnual: number;
    totalLaborCost: number;
  }>;
}>;

// Bloom 連携用（匿名化集計、個人特定不可）
export async function getSalaryKpiForBloom(input: {
  month: string;
}): Promise<{
  totalLaborCost: number;
  employeeCount: number;
  overtimeHours: number;       // 時間
  comparisonToPrevMonth: {
    laborCostDiffPct: number;
    employeeCountDiff: number;
  };
}>;
```

---

## 7. 状態遷移

本 spec は read-only ビュー / 集計のため状態遷移なし。

---

## 8. Chatwork 通知

- **月次 KPI サマリ**: 各月末（支給完了後）、admin + super_admin DM に前月比較付きで配信
- **異常値アラート**: 人件費前月比 +15% 等の変動を自動検出、admin DM

---

## 9. 監査ログ要件

- ダッシュボードアクセスは `root_audit_log` に action='view_salary_kpi' で記録（誰が見たかの履歴）
- Bloom 連携 API 呼出も同等、ただし頻度高いため日次集約

---

## 10. バリデーション規則

| # | ルール | 違反時 |
|---|---|---|
| V1 | 期間指定が 36 ヶ月以内 | 36 ヶ月にトリム（大量データ防止）|
| V2 | `fromMonth <= toMonth` | エラー |
| V3 | 会社 ID が 6 法人の範囲内 | 不明 ID は無視 |
| V4 | 集計対象データが 0 件 | 空結果で返却（エラーではない）|

---

## 11. 受入基準

1. ✅ `bud_salary_kpi_monthly_v` / `bud_bonus_kpi_quarterly_v` / `bud_annual_labor_cost_v` ビュー投入
2. ✅ `bud_get_salary_kpi` RPC 関数 + GRANT 投入
3. ✅ `/bud/kpi/salary` ダッシュボード画面が動作
4. ✅ 期間・法人フィルタが動作
5. ✅ Chart.js（or Forest と揃え）で 4 種グラフが表示
6. ✅ RLS: staff は RPC 呼出時に空結果返却（403 ではない）、admin+ のみデータ見える
7. ✅ Bloom 連携用 API `getSalaryKpiForBloom` が動作、匿名化された集計のみ返却
8. ✅ Chatwork 月次 KPI サマリが動作
9. ✅ パフォーマンス: 12 ヶ月 × 6 法人の集計が 1 秒以内

---

## 12. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | 集計ビュー 3 本 + RPC 関数 | 0.05d |
| W2 | `/bud/kpi/salary` 画面 UI + Chart.js | 0.1d |
| W3 | API 2 本（ダッシュボード用 + Bloom 用）| 0.05d |
| W4 | Chatwork 月次サマリ + 異常値検出 | 0.03d |
| W5 | 動作確認 + パフォーマンス計測 | 0.02d |
| **合計** | | **0.25d** |

---

## 13. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 社保会社負担分の推定精度 | **Phase B v1 は従業員負担 × 1.00 で推定**（折半前提）、厳密化は Phase C |
| 判2 | 残業時間の部署別集計 | `root_employees.department_id` が必要、現状未整備のため Phase C |
| 判3 | 経営層のみアクセス厳密化 | super_admin のみ → admin へ拡張（経理担当もアクセス必要）|
| 判4 | Bloom 連携時の匿名化粒度 | 3 人以下の法人では総額非表示（個人特定防止）|
| 判5 | 予測機能（来月人件費シミュレーション）| Phase C、MF クラウド給与との並行期間を過ぎてから |
| 判6 | ダッシュボードの CSV/Excel エクスポート | Phase B v2、当面は画面参照のみ |
| 判7 | 大量データ時のパフォーマンス | マテリアライズドビュー化は 3 年蓄積後に検討 |

---

## 14. Phase C 以降への繰越事項

- 部署別・プロジェクト別集計
- 業績指標（売上・利益）との連動 KPI
- 予測シミュレーション（昇給・賞与シナリオ）
- 同業他社ベンチマーク
- 残業時間の法令遵守モニタ（月 45 時間超・年 360 時間超）

— end of B-06 spec —
