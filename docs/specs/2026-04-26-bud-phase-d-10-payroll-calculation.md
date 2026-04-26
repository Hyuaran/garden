# Bud Phase D #10: 給与計算 統合（Excel 排除 + Tree 源泉 + Bloom 集計連携）

- 対象: 給与計算 Excel（「【月1】給与計算用」 + インセン計算シート）の Garden Bud 統合
- 優先度: **🔴 最高**（給与確定の根幹、Excel 完全排除）
- 見積: **2.5d**（計算ロジック移植 + テーブル + Server Action + 監査）
- 担当セッション: a-bud
- 作成: 2026-04-26（Kintone 解析判断 #17 + #20 反映、a-main 006 確定）
- 前提:
  - **東海林判断 (2026-04-26)**: Excel「【月1】給与計算用」+ インセン計算シート → Bud Phase D に**完全統合**、Excel 廃止
  - 関連 memory: `project_payslip_distribution_design.md`, `project_session_shared_attachments.md`
  - 添付資料: `C:\garden\_shared\attachments\20260426\【管理表】実件数報告_20260425.xlsx`（13 シート、給与計算用シート含む）
- 関連 spec:
  - 既存 D-02（給与計算ロジック / 月額表 / 甲乙 / 控除）— 法定計算は D-02、本 spec は事業所固有のインセン計算
  - 既存 D-03（賞与計算）— 同様の役割分担
  - 新 D-09（口座分離）— 振込先参照
  - 新 D-11（MFC CSV 出力）— 計算結果を CSV 化

---

## 1. 目的とスコープ

### 1.1 目的

東海林さんが現状 Excel で運用している以下のロジックを Bud Phase D に**完全移植**し、Excel を廃止する:

- 「【月1】給与計算用」シート（基本給・手当・控除の集計）
- **インセン計算シート**（AP / 件数 / 社長賞 / チーム勝利金 / P 達成金）
- 部署別効率・目標 P・達成率の集計

役割分担:
- **Tree**: 源泉データ提供（架電実績 / アポラン件数 / 部署別効率の元データ）
- **Bloom**: 集計可視化（月次達成率レポート / KPI ダッシュボード）
- **Bud（本 spec）**: **計算本体**（インセン算出 + bud_payroll_records 確定）

### 1.2 含めるもの

- `bud_payroll_records` テーブル設計（給与計算結果の正本）
- インセン計算ロジック移植（AP / 件数 / 社長賞 / チーム勝利金 / P 達成金）
- Tree 源泉データ取得 API 契約（read-only、Tree 側でビュー提供）
- 部署別効率・目標 P・達成率の自動算出ロジック
- 計算実行フロー（仮計算 → 承認 → 確定 → MFC CSV 出力）
- 監査ログ（誰が・いつ・何を計算/承認したか）
- Excel 廃止後の運用フロー定義

### 1.3 含めないもの

- 法定計算（所得税・社保・住民税）→ D-02 / D-05 既存
- 賞与計算 → D-03 既存
- 給与明細 PDF 生成・配信 → D-04 既存
- 振込連携 → D-07 既存
- MFC CSV 出力 → D-11 新規
- Bloom 集計画面の UI 実装 → Bloom セッション担当

---

## 2. 既存 D-02 / D-03 との役割分担（重要）

| 項目 | D-02（既存） | D-03（既存） | **D-10（本 spec）** |
|---|---|---|---|
| スコープ | 月給・時給・日給の基本給 + 法定計算 | 賞与計算 | **インセン + 部署別集計** |
| 計算対象 | 全従業員 | 全従業員 | クローザー / アポインター中心 |
| 入力 | `root.attendance` / `root.salary_systems` | `root.bonus_table` | **`tree.kpi_summary` ビュー（新設） + 部署マスタ** |
| 出力 | `bud_salary_records` | `bud_bonus_records` | **`bud_payroll_records`**（本 spec で新設、最終結果） |
| 法令 | 労基法 24/37、所得税法 | 健保法 40/158 | 社内規程（Excel 由来） |

**重要**: D-02 の `bud_salary_records` は法定計算の中間結果、D-10 の `bud_payroll_records` は**インセン込みの最終結果**。
D-02 → D-10 → D-11（MFC CSV）の流れで給与確定。

---

## 3. データモデル

### 3.1 `bud_payroll_records`（給与計算結果の正本）

```sql
CREATE TABLE bud.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period date NOT NULL,                   -- 支給対象月（月初日）
  pay_date date NOT NULL,                     -- 支給日
  employee_id uuid NOT NULL REFERENCES root.employees(id),

  -- D-02 連携（法定計算結果のスナップショット）
  salary_record_id uuid REFERENCES bud.salary_records(id),

  -- インセン計算結果（本 spec の主要範囲）
  ap_incentive bigint NOT NULL DEFAULT 0,           -- AP インセン（時給）
  case_incentive bigint NOT NULL DEFAULT 0,         -- 件数インセン
  president_incentive bigint NOT NULL DEFAULT 0,    -- 社長賞インセン
  team_victory_bonus bigint NOT NULL DEFAULT 0,     -- チーム勝利金
  p_achievement_bonus bigint NOT NULL DEFAULT 0,    -- P 達成金

  -- 部署別集計（参考、計算根拠）
  team_id uuid REFERENCES root.teams(id),
  team_efficiency numeric(5,2),                     -- 部署別効率（%）
  target_p int,                                      -- 目標 P
  achieved_p int,                                    -- 達成 P
  achievement_rate numeric(5,2),                    -- 達成率（%）

  -- 集計結果（D-02 + インセン）
  total_taxable_payment bigint NOT NULL DEFAULT 0,  -- 課税支給合計
  total_non_taxable_payment bigint NOT NULL DEFAULT 0, -- 非課税支給合計
  total_deduction bigint NOT NULL DEFAULT 0,         -- 控除合計
  net_payment bigint NOT NULL DEFAULT 0,             -- 差引支給額

  -- 計算スナップショット（再計算時の根拠保存）
  calculation_snapshot jsonb NOT NULL,               -- 入力値・係数・式の全履歴
  calculation_version text NOT NULL,                 -- ロジックバージョン（'v1.0' 等）

  -- ステータス
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'finalized', 'exported')),
  calculated_at timestamptz,
  calculated_by uuid REFERENCES root.employees(id),  -- payroll_calculator
  approved_at timestamptz,
  approved_by uuid REFERENCES root.employees(id),    -- payroll_approver
  finalized_at timestamptz,
  exported_at timestamptz,                            -- MFC CSV 出力時刻
  exported_to_csv_id uuid REFERENCES bud.mfc_csv_exports(id),  -- D-11 連携

  -- メタ
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text,

  CONSTRAINT uq_payroll_per_employee_month
    UNIQUE (employee_id, pay_period)
);

CREATE INDEX idx_payroll_period ON bud.payroll_records (pay_period DESC);
CREATE INDEX idx_payroll_status ON bud.payroll_records (status, pay_period DESC);
CREATE INDEX idx_payroll_team_period ON bud.payroll_records (team_id, pay_period DESC);
```

### 3.2 `bud_payroll_calculation_history`（計算履歴、監査）

```sql
CREATE TABLE bud.payroll_calculation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_record_id uuid NOT NULL REFERENCES bud.payroll_records(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('calculated', 'recalculated', 'approved', 'rejected', 'finalized', 'exported')),
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid NOT NULL REFERENCES root.employees(id),
  performer_role text NOT NULL,               -- payroll_calculator/approver/disburser/auditor
  before_snapshot jsonb,                       -- 変更前の payroll_record（再計算時）
  after_snapshot jsonb,
  reason text                                  -- 再計算理由・差戻し理由
);

CREATE INDEX idx_pch_record ON bud.payroll_calculation_history (payroll_record_id, performed_at DESC);
```

---

## 4. Tree 源泉データ取得（read-only API 契約）

### 4.1 Tree 側で提供すべきビュー（a-tree との合意必要）

```sql
-- Tree セッション側で実装、Bud から read-only 参照
CREATE OR REPLACE VIEW tree.kpi_summary_for_bud AS
SELECT
  e.id AS employee_id,
  e.team_id,
  date_trunc('month', cl.call_date)::date AS pay_period,
  COUNT(*) FILTER (WHERE cl.call_status = 'apolan') AS aporan_count,    -- アポラン件数
  COUNT(*) FILTER (WHERE cl.call_status = 'closed') AS close_count,
  SUM(cl.case_count) AS total_cases,                                     -- 件数
  AVG(cl.efficiency_score) AS avg_efficiency
FROM root.employees e
INNER JOIN tree.call_logs cl ON cl.employee_id = e.id
GROUP BY e.id, e.team_id, date_trunc('month', cl.call_date);
```

**注意**: 上記 SQL は Bud spec 内の **想定例** のみ。実際の列名・粒度は a-tree と協議。
Bud の API 契約は以下の TypeScript 型で確定:

```typescript
// src/lib/bud/payroll/tree-source.ts
export interface TreeKpiSource {
  employeeId: string;
  teamId: string | null;
  payPeriod: string;        // YYYY-MM-01
  aporanCount: number;      // アポラン件数（社長賞インセンの根拠）
  closeCount: number;
  totalCases: number;       // 件数インセンの根拠
  avgEfficiency: number;    // 部署別効率の根拠
}

export async function fetchTreeKpiForPeriod(
  payPeriod: string,
): Promise<TreeKpiSource[]> {
  // Supabase read-only client で tree.kpi_summary_for_bud SELECT
}
```

### 4.2 アクセス権限

- Bud セッション → `tree.kpi_summary_for_bud` を SELECT のみ可能
- Tree 側で Garden ロール `payroll_calculator` 以上に SELECT 権限付与
- 書込みは厳禁（Tree 側でビュー定義されるため UPDATE/INSERT 不可）

---

## 5. インセン計算ロジック

### 5.1 5 種のインセン

東海林さん Excel の計算ロジックを TypeScript 関数として完全移植:

```typescript
// src/lib/bud/payroll/incentives.ts

export interface IncentiveContext {
  employee: { id: string; teamId: string | null };
  treeKpi: TreeKpiSource;
  team: { targetP: number; teamMembers: Array<{ id: string; achievedP: number }> };
  monthlyIncentiveTable: IncentiveTable;  // 法人別 / 期別の係数表
}

export function calculateAPIncentive(ctx: IncentiveContext): number {
  // AP インセン = アポラン件数 × 係数（係数は monthlyIncentiveTable から）
  return ctx.treeKpi.aporanCount * ctx.monthlyIncentiveTable.apRate;
}

export function calculateCaseIncentive(ctx: IncentiveContext): number {
  // 件数インセン = 案件数 × 係数（段階制、達成率により変動）
  // ロジック詳細は実装時に Excel から完全移植
  // ...
}

export function calculatePresidentIncentive(ctx: IncentiveContext): number {
  // 社長賞インセン = 月次トップ N 名（事業所別）の固定額
  // ...
}

export function calculateTeamVictoryBonus(ctx: IncentiveContext): number {
  // チーム勝利金 = チーム全体の達成率が一定以上で全員に均等配分
  // チーム達成率 = チームメンバーの achievedP 合計 / チーム targetP
  // ...
}

export function calculatePAchievementBonus(ctx: IncentiveContext): number {
  // P 達成金 = 個人の achievedP / targetP の達成率に応じた段階制
  // ...
}
```

### 5.2 係数表の管理

```sql
CREATE TABLE bud.incentive_rate_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from date NOT NULL,
  effective_to date,
  company_id uuid REFERENCES root.companies(id),
  table_data jsonb NOT NULL,                -- 5 種インセンの係数・段階表
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES root.employees(id)
);
```

`table_data` の構造例:

```json
{
  "ap": { "rate_per_aporan": 500 },
  "case": [
    { "from": 0, "to": 5, "amount_per_case": 1000 },
    { "from": 6, "to": 10, "amount_per_case": 1500 },
    { "from": 11, "to": null, "amount_per_case": 2000 }
  ],
  "president": { "top_n": 3, "rewards": [50000, 30000, 20000] },
  "team_victory": { "achievement_threshold": 1.0, "amount_per_member": 5000 },
  "p_achievement": [
    { "rate_from": 1.0, "rate_to": 1.2, "bonus": 10000 },
    { "rate_from": 1.2, "rate_to": null, "bonus": 30000 }
  ]
}
```

### 5.3 部署別効率・達成率の算出

```typescript
export interface TeamSummary {
  teamId: string;
  teamName: string;
  payPeriod: string;
  targetP: number;
  achievedP: number;
  achievementRate: number;            // achievedP / targetP
  memberCount: number;
  avgEfficiency: number;              // メンバー平均効率
}

export async function summarizeTeamForPeriod(
  teamId: string,
  payPeriod: string,
): Promise<TeamSummary> {
  // tree.kpi_summary_for_bud + root.teams から集計
  // bud_payroll_records.team_efficiency / target_p / achieved_p / achievement_rate に保存
}
```

---

## 6. 計算実行フロー

### 6.1 4 段階ステータス

```
draft（仮計算前）
  ↓ payroll_calculator が "計算実行" ボタン押下
calculated（仮計算済、編集可）
  ↓ payroll_calculator が "承認依頼" ボタン押下
  ↓ payroll_approver が "承認" ボタン押下
approved（承認済、修正不可）
  ↓ payroll_disburser が "MFC CSV 出力" ボタン押下（D-11）
finalized（CSV 出力済、振込実行待ち）
  ↓ MFC で給与確定、Garden に "exported" マーク
exported（最終、変更不可）
```

差戻しは any → draft（再計算可）。
監査は `bud_payroll_calculation_history` に全アクション記録。

### 6.2 Server Action 契約

```typescript
// src/lib/bud/payroll/actions.ts

export async function calculatePayrollForPeriod(input: {
  payPeriod: string;          // YYYY-MM-01
  payDate: string;
  employeeIds?: string[];     // 未指定で全従業員
  dryRun?: boolean;           // true で DB 書込なし
}): Promise<{
  successCount: number;
  failedCount: number;
  records?: BudPayrollRecord[];  // dryRun 時に返す
  errors: Array<{ employeeId: string; error: string; code: string }>;
}>;

export async function approvePayroll(input: {
  payrollRecordIds: string[];
  reason?: string;
}): Promise<{
  approvedCount: number;
  failed: Array<{ id: string; error: string; code: string }>;
}>;

export async function rejectPayroll(input: {
  payrollRecordIds: string[];
  reason: string;             // 必須、10 文字以上
}): Promise<{
  rejectedCount: number;
  failed: Array<{ id: string; error: string; code: string }>;
}>;
```

---

## 7. RLS（#18 反映）

```sql
ALTER TABLE bud.payroll_records ENABLE ROW LEVEL SECURITY;

-- SELECT: 本人 + payroll_*
CREATE POLICY pr_select ON bud.payroll_records FOR SELECT USING (
  employee_id = (SELECT id FROM root.employees WHERE auth_user_id = auth.uid())
  OR has_payroll_role()
);

-- INSERT / UPDATE: status 別に role 限定
-- draft → calculated: payroll_calculator
CREATE POLICY pr_calculate ON bud.payroll_records FOR UPDATE
  USING (status IN ('draft', 'calculated') AND has_payroll_role(ARRAY['payroll_calculator']))
  WITH CHECK (status IN ('calculated') AND has_payroll_role(ARRAY['payroll_calculator']));

-- calculated → approved: payroll_approver（自起票禁止 = 承認者と計算者は別人必須）
CREATE POLICY pr_approve ON bud.payroll_records FOR UPDATE
  USING (
    status = 'calculated'
    AND has_payroll_role(ARRAY['payroll_approver'])
    AND calculated_by <> (SELECT id FROM root.employees WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (status = 'approved' AND has_payroll_role(ARRAY['payroll_approver']));

-- approved → finalized: payroll_disburser
CREATE POLICY pr_finalize ON bud.payroll_records FOR UPDATE
  USING (status = 'approved' AND has_payroll_role(ARRAY['payroll_disburser']))
  WITH CHECK (status = 'finalized' AND has_payroll_role(ARRAY['payroll_disburser']));

-- DELETE: 完全禁止（論理削除も無し、誤計算は status='draft' に戻す運用）
CREATE POLICY pr_no_delete ON bud.payroll_records FOR DELETE USING (false);
```

---

## 8. 受入基準

- [ ] `bud_payroll_records` / `bud_payroll_calculation_history` migration 適用済
- [ ] `bud.incentive_rate_tables` 初期データ投入（東海林さん Excel から移植）
- [ ] Tree 側 `kpi_summary_for_bud` ビュー定義（a-tree と協議完了）
- [ ] 5 種インセン計算関数の単体テスト（90+ ケース、Excel 結果と完全一致）
- [ ] 部署別効率・達成率算出関数の単体テスト
- [ ] Server Action `calculatePayrollForPeriod` の dryRun モード動作
- [ ] 4 段階ステータスフローの統合テスト（draft → calculated → approved → finalized）
- [ ] **承認者 ≠ 計算者** の RLS 検証（V6 自己承認禁止と同等の原則）
- [ ] Excel との結果比較（過去 3 ヶ月分で誤差ゼロ確認）
- [ ] **Excel 廃止**: 東海林さんが Excel を使わずに月次給与確定できることを実証

---

## 9. 想定工数（内訳）

| W# | 作業 | 工数 |
|---|---|---|
| W1 | migration（payroll_records / calculation_history / incentive_rate_tables） | 0.2d |
| W2 | Tree 連携 API 契約 + read-only ビュー協議 | 0.2d |
| W3 | インセン計算 5 種 関数移植（純関数 + 単体テスト 90+） | 0.8d |
| W4 | 部署別集計関数 + Bloom 連携 API 契約 | 0.3d |
| W5 | Server Action 4 種（calculate/approve/reject/recalculate） | 0.3d |
| W6 | RLS（4 ロール × 4 ステータス） + ヘルパー関数 | 0.2d |
| W7 | UI（calculator / approver / auditor 3 画面） | 0.4d |
| W8 | Excel 結果比較テスト（過去 3 ヶ月、誤差ゼロ確認） | 0.1d |
| **合計** | | **2.5d** |

---

## 10. 判断保留

| # | 論点 | a-bud スタンス |
|---|---|---|
| 判 1 | Tree 側ビュー名・列名 | a-tree と協議、本 spec は仮称（協議結果で更新） |
| 判 2 | インセン係数表の事業所別分離 | `incentive_rate_tables.company_id` で対応、初期データは東海林さん Excel から手動移植 |
| 判 3 | 過去計算結果の修正再計算 | `bud_payroll_calculation_history` に before/after 残し、表面上は新レコード扱い |
| 判 4 | Bloom 連携の粒度 | Bloom は read-only で `bud_payroll_records` から集計、本 spec は API 提供のみ |
| 判 5 | Excel 廃止の最終タイミング | 並行運用 1 ヶ月で誤差ゼロ確認後、東海林さん最終承認で廃止 |
| 判 6 | 派遣従業員の扱い | 派遣はインセン対象外（Excel と同様）、`employee_type='dispatch'` でスキップ |

---

## 11. 関連ドキュメント / 確定根拠

- 確定ログ: `decisions-kintone-batch-20260426-a-main-006.md` #17 + #20
- 添付資料: `C:\garden\_shared\attachments\20260426\【管理表】実件数報告_20260425.xlsx`（13 シート）
- 関連 spec: D-02（給与法定計算）, D-09（口座分離）, D-11（MFC CSV 出力）
- 関連 memory: `project_session_shared_attachments.md`
