# Bud Phase D #10: 給与計算 統合（Excel 排除 + Tree 源泉 + Bloom 集計連携）

- 対象: 給与計算 Excel（「【月1】給与計算用」 + インセン計算シート）の Garden Bud 統合
- 優先度: **🔴 最高**（給与確定の根幹、Excel 完全排除）
- 見積: **2.9d**（旧 2.5d + 4 次 follow-up 上田目視ダブルチェック工程 +0.4d）
- 担当セッション: a-bud
- 作成: 2026-04-26（Kintone 解析判断 #17 + #20 反映、a-main 006 確定）
- 改訂:
  - 3 次 follow-up (2026-04-26): 4 段階 → 6 段階フロー（社労士確認段階追加）
  - **4 次 follow-up (2026-04-26)**: **6 段階 → 7 段階**（⑤ visual_double_checked 追加 = 上田君目視ダブルチェック工程）+ Cat 4 #26 / #28 反映 + 後道さん不在明記
- 前提:
  - **東海林判断 (2026-04-26)**: Excel「【月1】給与計算用」+ インセン計算シート → Bud Phase D に**完全統合**、Excel 廃止
  - **東海林判断 (2026-04-26 4 次)**: 給与確認フロー = 後道さん不在、上田君目視チェック + 東海林さん振込（Cat 4 #26）
  - 関連 memory: `project_payslip_distribution_design.md`（4 次反映、a-main 側で更新済）, `project_session_shared_attachments.md`
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

  -- ステータス（2026-04-26 [a-bud] 4 次 follow-up: 7 段階フローへ拡張、Cat 4 #26 反映）
  -- 旧 6 段階に「⑤ visual_double_checked = 上田君目視ダブルチェック」を挿入
  -- 旧運用にあった「後道さん確認」工程は廃止（後道さんは Garden 上の確認フローに不在）
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'calculated',              -- ① 上田（payroll_calculator）が計算実行完了
    'approved',                -- ② 宮永・小泉（payroll_approver）が承認完了
    'exported',                -- ③ 上田（payroll_disburser）が MFC CSV 生成 + MFC 取込実行
    'confirmed_by_auditor',    -- ④ 東海林さん（payroll_auditor）が目視確認完了
    'visual_double_checked',   -- ⑤ 上田が金額・氏名・口座を 1 件ずつ目視ダブルチェック OK ⭐ NEW 4 次
    'confirmed_by_sharoshi',   -- ⑥ 社労士（root_partners）OK 返答後、東海林さんがマーク
    'finalized'                -- ⑦ 東海林さん（payroll_auditor）が確定処理（=振込実行）
  )),
  calculated_at timestamptz,
  calculated_by uuid REFERENCES root.employees(id),         -- payroll_calculator
  approved_at timestamptz,
  approved_by uuid REFERENCES root.employees(id),           -- payroll_approver
  exported_at timestamptz,                                   -- MFC CSV 出力時刻
  exported_to_csv_id uuid REFERENCES bud.mfc_csv_exports(id), -- D-11 連携
  confirmed_by_auditor_at timestamptz,                       -- ④ 東海林目視確認完了
  confirmed_by_auditor_by uuid REFERENCES root.employees(id),
  visual_double_check_requested_at timestamptz,              -- ⑤ 「上田に目視ダブルチェック依頼」ボタン押下時刻 ⭐ NEW 4 次
  visual_double_checked_at timestamptz,                      -- ⑤ 上田が 1 件ずつ目視で OK 戻し ⭐ NEW 4 次
  visual_double_checked_by uuid REFERENCES root.employees(id), -- ⑤ 通常 = 上田（payroll_visual_checker） ⭐ NEW 4 次
  visual_check_note text,                                    -- ⑤ 上田が気付いた特記事項（NG 時の差戻し理由含む） ⭐ NEW 4 次
  sharoshi_request_sent_at timestamptz,                      -- 「社労士確認依頼」ボタン押下時刻
  sharoshi_partner_id uuid REFERENCES root.partners(id),     -- 依頼先の社労士（root_partners）
  confirmed_by_sharoshi_at timestamptz,                      -- ⑥ 社労士 OK 返答後、東海林さんがマーク
  confirmed_by_sharoshi_by uuid REFERENCES root.employees(id), -- 通常 = 東海林さん
  sharoshi_confirmation_note text,                           -- 社労士からの返答内容（メール / Chatwork 引用）
  finalized_at timestamptz,
  finalized_by uuid REFERENCES root.employees(id),           -- ⑦ 確定処理者（通常 = 東海林さん、振込実行）

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

## 6. 計算実行フロー（2026-04-26 [a-bud] 4 次 follow-up: 6 段階 → 7 段階に拡張、Cat 4 #26 反映）

### 6.1 7 段階ステータス（東海林さん 4 次指示の実運用フロー反映）

> **🎯 4 次 follow-up 主要変更点**
> - ⑤ `visual_double_checked` を `confirmed_by_auditor` と `confirmed_by_sharoshi` の間に挿入
> - 旧運用の「後道さん給与確認」工程は**廃止**（Garden 上の確認フローに後道さんは不在）
> - 上田君が金額・氏名・口座を 1 件ずつ目視チェックする工程を Garden 内で正式化
> - 関連 memory: `project_payslip_distribution_design.md`（a-main 側で更新済）

```
draft（仮計算前）
  ↓ ① payroll_calculator（上田）が "計算実行" ボタン押下
calculated（仮計算済、編集可）
  ↓ payroll_calculator が "承認依頼" ボタン押下
  ↓ ② payroll_approver（宮永・小泉）が "承認" ボタン押下
approved（承認済、修正不可）
  ↓ ③ payroll_disburser（上田）が "MFC CSV 出力" ボタン押下（D-11）
exported（CSV 出力済 + MFC 取込実行済）
  ↓ ④ payroll_auditor（東海林さん）が "目視確認完了" ボタン押下
confirmed_by_auditor（東海林の目視 OK）
  ↓ payroll_auditor が "上田に目視ダブルチェック依頼" ボタン押下
  ↓     → Garden 内通知（上田用専用画面に "未チェック" として登録）
  ↓ ⑤ payroll_visual_checker（上田）が金額・氏名・口座を 1 件ずつ目視確認
  ↓     → 全件 OK で "確認 OK" ボタン押下（時間かかってよい、自動 timeout なし）
visual_double_checked（上田の目視ダブルチェック OK） ⭐ NEW 4 次
  ↓ payroll_auditor が "社労士確認依頼" ボタン押下
  ↓     → Chatwork DM / メールで社労士（root_partners）へ確認依頼
  ↓ 社労士から OK 返答（外部経由、Garden ログイン不要）
  ↓ ⑥ payroll_auditor が Garden 上で "社労士確認済" マーク
confirmed_by_sharoshi（社労士 OK 受領済）
  ↓ ⑦ payroll_auditor（東海林さん）が "確定処理 / 振込実行" ボタン押下
finalized（最終、変更不可、東海林さん振込実行）
```

### 6.2 各段階の責任者（4 次 follow-up 確定）

| Stage | 担当者 | Garden ロール | 主な操作 |
|---|---|---|---|
| ① calculated | 上田 | `payroll_calculator` | 計算実行 / 個別調整 |
| ② approved | 宮永・小泉 | `payroll_approver` | 承認 / 差戻し（V6 自起票禁止） |
| ③ exported | 上田 | `payroll_disburser` | MFC CSV 生成 + MFC 取込実行（D-11 連携） |
| ④ confirmed_by_auditor | 東海林さん | `payroll_auditor` | 目視確認 / 異常検知 |
| **⑤ visual_double_checked** | **上田** | **`payroll_visual_checker`** ⭐ NEW 4 次 | **金額・氏名・口座を 1 件ずつ目視ダブルチェック / 編集不可・閲覧 + OK ボタンのみ** |
| ⑥ confirmed_by_sharoshi | 東海林さん | `payroll_auditor` | 社労士確認依頼 + OK 返答後マーク（社労士は Garden ログイン**不要**）|
| ⑦ finalized | 東海林さん | `payroll_auditor` | 確定処理 / 振込実行 GO（**振込実行は東海林さん専任**）|

> **後道さんの位置づけ**: 後道さんは Garden 上の給与確認フローには**登場しない**。
> 旧運用にあった「後道さんが目視確認」工程は廃止。確認フローは「東海林さん目視 → 上田君目視ダブルチェック → 社労士 OK → 東海林さん振込」で完結する。
> 後道さんへの会計レポート共有は別系統（D-07 §3.3 `bud_payroll_accounting_reports.shared_with_godo_at`）。

### 6.3 上田君「目視ダブルチェック」工程の Garden 関与設計（⭐ 4 次 follow-up 新設）

**目的**: 東海林さんの目視確認後、振込実行前に**もう 1 段の独立した目視チェック**を入れることで、金額・氏名・口座番号の転記ミス・入れ替わりを防止する。
社員の「絶対に間違えてはいけない」目視チェック係として上田君が責任を持つ。

#### ロール定義

新規ロール `payroll_visual_checker` を追加（`bud.has_payroll_role()` ヘルパーで判定）:

| ロール | 担当 | 権限 |
|---|---|---|
| `payroll_visual_checker` | 上田君 | `confirmed_by_auditor` → `visual_double_checked` のみ遷移可。**閲覧 + 「確認 OK」ボタンのみ**、編集・配信・振込権限**なし** |

> 上田君は既に `payroll_calculator` / `payroll_disburser` を保持。`payroll_visual_checker` を追加することで、計算者・出力者と独立した「最終目視ガード」の責務を明示する。

#### 上田君用 UI 要件（**Bud Phase D D-04 §X 上田 UI 要件 と整合、本 spec が正本リファレンス**）

| 項目 | 要件 |
|---|---|
| UI 複雑度 | **シンプル** — リスト + 行ごとのチェックボックス + 全件 OK 後に "確認 OK" ボタンのみ |
| 表示内容 | 金額・氏名・口座番号を **大きく見やすく**（フォント拡大、行間広く、スクリーン拡大対応）|
| 表示順 | 従業員番号昇順（上田君が業務上慣れている順序）|
| 時間制約 | **自動 timeout なし、急かす UI なし、丁寧に確認できる** |
| 操作権限 | 閲覧 + 各行の目視チェックマーク + 全件 OK 後に「確認 OK」ボタンのみ |
| 編集権限 | **なし**（金額・氏名・口座いずれも編集不可、誤りに気づいたら "差戻し（NG 戻し）" ボタンで `confirmed_by_auditor` 巻き戻し → 計算者へ再修正依頼）|
| 配信・振込権限 | **なし**（編集・配信・振込は東海林さん専任）|
| 通知 | Garden 内 KPIHeader 通知センターに "上田: 給与目視チェック未消化 N 件" バッジ |
| 上田君のスペック前提 | 複雑な操作不可、絶対間違えてはいけない目視チェック係、時間かかってもきっちり |

#### Garden 関与のフロー（④-⑤-⑥ 段階間）

```
④ confirmed_by_auditor 後:
  - 東海林さんが Garden 上で "上田に目視ダブルチェック依頼" ボタン押下
  - visual_double_check_requested_at 記録
  - 上田君用画面（/bud/payroll/visual-check）に当該 batch が "未チェック" として現れる
  - 上田君に Garden 内通知（KPIHeader 通知センター）

上田君の操作（Garden 内）:
  - /bud/payroll/visual-check で当該 batch を開く
  - 各行（従業員 1 名 = 1 行）の金額・氏名・口座番号を 1 件ずつ目視
  - 行ごとに「確認」チェックマーク
  - 全件チェック完了後、画面下部に「確認 OK」ボタンが活性化
  - 押下 → status='visual_double_checked'、visual_double_checked_at + visual_double_checked_by 記録

NG（誤りに気づいた場合）:
  - 上田君が「差戻し（NG 戻し）」ボタン押下、reason 入力（任意）
  - status は変更せず（confirmed_by_auditor のまま）、visual_check_note に NG 内容記録
  - 東海林さんに Garden 内通知「上田から差戻しあり」
  - 東海林さんが必要なら計算者へ再計算依頼（payroll_auditor が `draft` へ巻き戻し）
```

### 6.4 社労士の Garden 関与設計

**社労士は `root_partners` の外部取引先扱い**（`project_partners_vs_vendors_distinction.md` 整合）:

- Garden ログイン**不要**（外部担当者、root_employees ではない）
- `root_partners.partner_type='社労士'` で識別
- コンタクト情報: `root_partners.contact_email` / `contact_chatwork_id` / `contact_phone`
- Garden 関与のフロー（⑤-⑥ 段階間、4 次 follow-up でステージ番号繰下げ）:

```
⑤ visual_double_checked 後:
  - 東海林さんが Garden 上で "社労士確認依頼" ボタン押下
  - Garden が Chatwork DM or メール送信:
    "${root_partners.partner_name} 様、2026年5月給与計算の確認をお願いします。
     詳細レポート添付: <Storage signed URL（社労士向け 7 日有効）>"
  - sharoshi_request_sent_at + sharoshi_partner_id 記録

外部経由（Garden 外）:
  - 社労士が PDF / CSV を確認 → OK / NG 返答（Chatwork or メール）

⑥ confirmed_by_sharoshi 遷移:
  - 東海林さんが返答内容を sharoshi_confirmation_note に記録（任意）
  - "社労士確認済" ボタン押下 → status='confirmed_by_sharoshi'
  - confirmed_by_sharoshi_at + confirmed_by_sharoshi_by 記録
```

### 6.5 差戻し / 巻き戻し（4 次 follow-up: visual_double_checked 巻き戻し追加）

任意 stage から any → `draft`（再計算可）。
監査は `bud_payroll_calculation_history` に全アクション記録（before/after_snapshot + reason 必須）。

特殊ケース:
- **上田君目視で NG → ④ `confirmed_by_auditor` 据え置き**（status 変えず visual_check_note に NG 内容記録、東海林さん再判断）
- 社労士から NG 返答 → ⑤ `visual_double_checked` に巻き戻し（再目視 → 必要なら再計算）
- 取込ミス → ③ `exported` を取消、再 CSV 生成

### 6.6 Server Action 契約（4 次 follow-up で 8 種に拡張、目視ダブルチェック 2 種追加）

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
  records?: BudPayrollRecord[];
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

// 3 次 follow-up
export async function confirmByAuditor(input: {
  payrollRecordIds: string[];
  auditNote?: string;
}): Promise<{
  confirmedCount: number;
  failed: Array<{ id: string; error: string; code: string }>;
}>;

// ⭐ NEW: 4 次 follow-up — 上田君に「目視ダブルチェック」依頼（東海林さん操作）
export async function requestVisualDoubleCheck(input: {
  payrollRecordIds: string[];
  visualCheckerEmployeeId: string;  // 通常 = 上田君（payroll_visual_checker）
  message?: string;
}): Promise<{
  requestedCount: number;
  failed: Array<{ id: string; error: string; code: string }>;
}>;

// ⭐ NEW: 4 次 follow-up — 上田君による「目視ダブルチェック OK」マーク（上田操作、編集権なし）
export async function markVisualDoubleChecked(input: {
  payrollRecordIds: string[];   // 全行を 1 件ずつ目視チェック後の確定送信
  visualCheckNote?: string;
}): Promise<{
  markedCount: number;
  failed: Array<{ id: string; error: string; code: string }>;
}>;

// 3 次 follow-up: 社労士確認依頼送信（Chatwork DM or メール）
export async function requestSharoshiConfirmation(input: {
  payrollRecordIds: string[];
  partnerId: string;          // root_partners.id（partner_type='社労士'）
  channel: 'chatwork' | 'email';
  message?: string;
}): Promise<{
  sentCount: number;
  failedReason?: string;
}>;

// 3 次 follow-up: 社労士確認済マーク（東海林さんが Garden で押下）
export async function markSharoshiConfirmed(input: {
  payrollRecordIds: string[];
  confirmationNote?: string;
}): Promise<{
  markedCount: number;
  failed: Array<{ id: string; error: string; code: string }>;
}>;

// 3 次 follow-up: 確定処理（最終 finalized へ遷移、振込実行 GO）
export async function finalizePayroll(input: {
  payrollRecordIds: string[];
}): Promise<{
  finalizedCount: number;
  failed: Array<{ id: string; error: string; code: string }>;
}>;
```

> **🗑 重複セクション削除（4 次 follow-up）**: 旧 §6.2 「Server Action 契約（3 段階版）」は §6.6 「8 種拡張版」に完全統合されたため削除済。

---

## 7. RLS（#18 反映、4 次 follow-up で 7 段階遷移に拡張）

```sql
ALTER TABLE bud.payroll_records ENABLE ROW LEVEL SECURITY;

-- SELECT: 本人 + payroll_*
CREATE POLICY pr_select ON bud.payroll_records FOR SELECT USING (
  employee_id = (SELECT id FROM root.employees WHERE auth_user_id = auth.uid())
  OR has_payroll_role()
);

-- ① draft → calculated: payroll_calculator
CREATE POLICY pr_calculate ON bud.payroll_records FOR UPDATE
  USING (status IN ('draft', 'calculated') AND has_payroll_role(ARRAY['payroll_calculator']))
  WITH CHECK (status IN ('calculated') AND has_payroll_role(ARRAY['payroll_calculator']));

-- ② calculated → approved: payroll_approver（V6 自起票禁止 = 承認者と計算者は別人必須）
CREATE POLICY pr_approve ON bud.payroll_records FOR UPDATE
  USING (
    status = 'calculated'
    AND has_payroll_role(ARRAY['payroll_approver'])
    AND calculated_by <> (SELECT id FROM root.employees WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (status = 'approved' AND has_payroll_role(ARRAY['payroll_approver']));

-- ③ approved → exported: payroll_disburser
CREATE POLICY pr_export ON bud.payroll_records FOR UPDATE
  USING (status = 'approved' AND has_payroll_role(ARRAY['payroll_disburser']))
  WITH CHECK (status = 'exported' AND has_payroll_role(ARRAY['payroll_disburser']));

-- ④ exported → confirmed_by_auditor: payroll_auditor（V6 自起票禁止 = 計算者・承認者・出力者と別人推奨だが、東海林さんが自起票してた場合の例外考慮で警告のみ）
-- 3 次 follow-up
CREATE POLICY pr_audit ON bud.payroll_records FOR UPDATE
  USING (status = 'exported' AND has_payroll_role(ARRAY['payroll_auditor']))
  WITH CHECK (status = 'confirmed_by_auditor' AND has_payroll_role(ARRAY['payroll_auditor']));

-- ⑤ confirmed_by_auditor → visual_double_checked: payroll_visual_checker（上田）⭐ NEW 4 次 follow-up
-- 上田の権限は SELECT + 当該遷移のみ（編集不可）。INSERT 不可、DELETE 不可。
-- 加えて、東海林さんによる "依頼" 送信が前提（visual_double_check_requested_at NOT NULL 必須）
CREATE POLICY pr_visual_check ON bud.payroll_records FOR UPDATE
  USING (
    status = 'confirmed_by_auditor'
    AND has_payroll_role(ARRAY['payroll_visual_checker'])
    AND visual_double_check_requested_at IS NOT NULL  -- 依頼送信済必須
  )
  WITH CHECK (
    status = 'visual_double_checked'
    AND has_payroll_role(ARRAY['payroll_visual_checker'])
    AND visual_double_checked_at IS NOT NULL
    AND visual_double_checked_by IS NOT NULL
  );

-- ⑤-依頼 confirmed_by_auditor (status 据え置き) → visual_double_check_requested_at セット: payroll_auditor
-- 「上田に目視ダブルチェック依頼」ボタン押下時の列セット（status は変えない）
CREATE POLICY pr_request_visual_check ON bud.payroll_records FOR UPDATE
  USING (status = 'confirmed_by_auditor' AND has_payroll_role(ARRAY['payroll_auditor']))
  WITH CHECK (
    status = 'confirmed_by_auditor'  -- status 変えず、列のみ更新
    AND has_payroll_role(ARRAY['payroll_auditor'])
  );

-- ⑥ visual_double_checked → confirmed_by_sharoshi: payroll_auditor（社労士 OK 返答後のマーク）
-- 3 次 follow-up（4 次でステージ番号繰下げ）
-- 注: 社労士自体は Garden ログイン不要、東海林さんが Garden で代理マーク
-- sharoshi_partner_id（依頼先）と confirmed_by_sharoshi_at（マーク時刻）が必須
CREATE POLICY pr_sharoshi ON bud.payroll_records FOR UPDATE
  USING (status = 'visual_double_checked' AND has_payroll_role(ARRAY['payroll_auditor']))
  WITH CHECK (
    status = 'confirmed_by_sharoshi'
    AND has_payroll_role(ARRAY['payroll_auditor'])
    AND sharoshi_request_sent_at IS NOT NULL  -- 確認依頼送信済み必須
    AND sharoshi_partner_id IS NOT NULL        -- 依頼先 root_partners 必須
  );

-- ⑦ confirmed_by_sharoshi → finalized: payroll_auditor（最終確定 = 振込実行）
-- 3 次 follow-up（4 次でステージ番号繰下げ）
CREATE POLICY pr_finalize ON bud.payroll_records FOR UPDATE
  USING (status = 'confirmed_by_sharoshi' AND has_payroll_role(ARRAY['payroll_auditor']))
  WITH CHECK (status = 'finalized' AND has_payroll_role(ARRAY['payroll_auditor']));

-- 巻き戻し: 任意 stage → draft（payroll_auditor が承認時のみ、reason 必須）
-- 4 次 follow-up: visual_double_checked も巻き戻し対象に追加
-- 実装: bud_payroll_calculation_history に before/after_snapshot + reason 記録
CREATE POLICY pr_rollback_to_draft ON bud.payroll_records FOR UPDATE
  USING (
    status IN ('calculated', 'approved', 'exported', 'confirmed_by_auditor', 'visual_double_checked', 'confirmed_by_sharoshi')
    AND has_payroll_role(ARRAY['payroll_auditor'])
  )
  WITH CHECK (status = 'draft' AND has_payroll_role(ARRAY['payroll_auditor']));

-- DELETE: 完全禁止（論理削除も無し、誤計算は status='draft' に戻す運用）
CREATE POLICY pr_no_delete ON bud.payroll_records FOR DELETE USING (false);
```

### 7.1 RLS テスト網羅項目（4 次 follow-up: 上田目視ダブルチェック関連 4 件追加）

| テスト | 期待 |
|---|---|
| payroll_calculator が calculated → approved 試行 | RLS 拒否 |
| payroll_approver が calculated → approved（自起票でない） | OK |
| payroll_approver が calculated → approved（自起票） | RLS 拒否（V6 自己承認禁止） |
| payroll_auditor が exported → confirmed_by_auditor | OK |
| **payroll_visual_checker が confirmed_by_auditor → visual_double_checked（依頼未送信）** ⭐ NEW | RLS 拒否 |
| **payroll_visual_checker が confirmed_by_auditor → visual_double_checked（依頼送信済）** ⭐ NEW | OK |
| **payroll_visual_checker が visual_double_checked レコードを編集試行（金額・氏名・口座）** ⭐ NEW | RLS 拒否（編集権なし）|
| **payroll_visual_checker が confirmed_by_sharoshi → finalized 試行（権限外段階）** ⭐ NEW | RLS 拒否 |
| payroll_auditor が visual_double_checked → confirmed_by_sharoshi（sharoshi_request_sent_at NULL）| RLS 拒否 |
| payroll_auditor が visual_double_checked → confirmed_by_sharoshi（依頼送信済み）| OK |
| payroll_auditor が confirmed_by_sharoshi → finalized | OK |
| payroll_disburser が exported → finalized 試行（段階飛ばし）| RLS 拒否 |
| payroll_auditor が approved → draft（巻き戻し） | OK（reason 必須） |
| payroll_auditor が visual_double_checked → draft（巻き戻し） | OK（reason 必須） |

---

## 8. 受入基準（4 次 follow-up: 7 段階 + 上田目視ダブルチェック関連 5 件追加）

- [ ] `bud_payroll_records` / `bud_payroll_calculation_history` migration 適用済（visual_double_check_* 列含む）
- [ ] `bud.incentive_rate_tables` 初期データ投入（東海林さん Excel から移植）
- [ ] Tree 側 `kpi_summary_for_bud` ビュー定義（a-tree と協議完了）
- [ ] 5 種インセン計算関数の単体テスト（90+ ケース、Excel 結果と完全一致）
- [ ] 部署別効率・達成率算出関数の単体テスト
- [ ] Server Action `calculatePayrollForPeriod` の dryRun モード動作
- [ ] **7 段階**ステータスフローの統合テスト（draft → calculated → approved → exported → confirmed_by_auditor → **visual_double_checked** → confirmed_by_sharoshi → finalized）⭐ 4 次更新
- [ ] **承認者 ≠ 計算者** の RLS 検証（V6 自己承認禁止と同等の原則）
- [ ] **新ロール `payroll_visual_checker`** が `bud.has_payroll_role()` で判定できる ⭐ NEW 4 次
- [ ] **上田君用 `/bud/payroll/visual-check` 画面**が D-04 §X 上田 UI 要件通り動作（大きな表示・自動 timeout なし・閲覧 + OK ボタンのみ）⭐ NEW 4 次
- [ ] **`requestVisualDoubleCheck` Server Action**で東海林さん → 上田君への依頼通知が Garden 内に届く ⭐ NEW 4 次
- [ ] **`markVisualDoubleChecked` Server Action**で上田君が編集権なしで OK マークできる（金額編集試行で RLS 拒否）⭐ NEW 4 次
- [ ] **後道さん不在の確認**: 給与確認フロー UI 上に「後道さん」ロールへのアサイン箇所が存在しない（旧運用との差分検証）⭐ NEW 4 次
- [ ] Excel との結果比較（過去 3 ヶ月分で誤差ゼロ確認）
- [ ] **Excel 廃止**: 東海林さんが Excel を使わずに月次給与確定できることを実証

---

## 9. 想定工数（内訳、4 次 follow-up で +0.4d）

| W# | 作業 | 工数 |
|---|---|---|
| W1 | migration（payroll_records / calculation_history / incentive_rate_tables、visual_double_check_* 列含む） | 0.2d |
| W2 | Tree 連携 API 契約 + read-only ビュー協議 | 0.2d |
| W3 | インセン計算 5 種 関数移植（純関数 + 単体テスト 90+） | 0.8d |
| W4 | 部署別集計関数 + Bloom 連携 API 契約 | 0.3d |
| W5 | Server Action 8 種（calculate/approve/reject/confirmByAuditor/**requestVisualDoubleCheck**/**markVisualDoubleChecked**/markSharoshiConfirmed/finalizePayroll） ⭐ 4 次 +0.15d | 0.45d |
| W6 | RLS（5 ロール × 7 ステータス、4 次でロール+1 / status+1） + ヘルパー関数 ⭐ 4 次 +0.05d | 0.25d |
| W7 | UI（calculator / approver / auditor + **上田 visual-check 画面** 4 画面）⭐ 4 次 +0.2d | 0.6d |
| W8 | Excel 結果比較テスト（過去 3 ヶ月、誤差ゼロ確認） | 0.1d |
| **合計** | | **2.9d**（旧 2.5d + 4 次 0.4d）|

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
| **判 7** | **上田君以外の `payroll_visual_checker` 兼任者** ⭐ NEW 4 次 | 当面は上田君専任、複数人兼任は Phase E で検討（バックアップ要員設計）|
| **判 8** | **上田君不在時の代替** ⭐ NEW 4 次 | 上田君休暇時は東海林さんが代行（payroll_auditor が一時的に payroll_visual_checker を兼任、ただし監査ログに必ず記録）|

---

## 11. 賞与処理 admin 限定（Cat 4 #28 反映、4 次 follow-up）

> **🎯 4 次 follow-up（Cat 4 #28、A 採択）**: 賞与処理の承認・配信は **`admin` 以上のみ**に制限する。給与本体（D-10）と同じ運用。

### 11.1 賞与処理の権限境界

| 操作 | 権限 |
|---|---|
| 賞与計算（D-03 `bud_bonus_records` 起票）| admin / super_admin のみ |
| 賞与承認 | admin / super_admin のみ（V6 自起票禁止と同等の自己承認禁止）|
| 賞与配信（D-04 賞与明細 PDF 配信）| admin / super_admin のみ（給与本体と同じ）|
| 一般従業員からの閲覧 | 自分の `bud_bonus_records` のみ（D-04 マイページ経由）|

### 11.2 D-10 内で賞与は扱わない

本 spec は給与本体の計算統合。賞与は D-03 で別系統管理。
ただし `bud_payroll_records` の status enum / RLS フローは `bud_bonus_records` でも同様に **7 段階 + 5 ロール構造** を採用する（D-03 §X 参照、admin only）。

詳細は **D-03 §X 賞与処理の admin 限定**（Cat 4 #28 反映）を参照。

---

## 12. 関連ドキュメント / 確定根拠

- 確定ログ:
  - `decisions-kintone-batch-20260426-a-main-006.md` #17 + #20（給与計算統合）
  - **`decisions-pending-batch-20260426.md` Cat 4 #26 + #27 + #28** ⭐ 4 次 follow-up
- 添付資料: `C:\garden\_shared\attachments\20260426\【管理表】実件数報告_20260425.xlsx`（13 シート）
- 関連 spec: D-02（給与法定計算）, D-03（賞与計算）, D-04（給与配信、上田 UI 要件正本）, D-07（振込）, D-09（口座分離）, D-11（MFC CSV 出力）, D-12（スケジュール）
- 関連 memory:
  - `project_session_shared_attachments.md`
  - `project_payslip_distribution_design.md`（4 次 follow-up: 上田目視 / 後道不在反映、a-main 側で更新済）
  - `project_partners_vs_vendors_distinction.md`（社労士 = root_partners 外部取引先）
