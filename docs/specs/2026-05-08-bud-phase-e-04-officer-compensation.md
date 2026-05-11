# Bud Phase E #04: 役員報酬区分（D-07/D-11 拡張、損金算入限度 + 賞与扱い）

- 対象: Garden-Bud Phase D-07 振込連携 / D-11 MFC CSV 出力の役員報酬区分拡張
- 優先度: **🟡 中**（数名の役員のみ対象、誤区分は税務リスク）
- 見積: **0.5d**
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-05-08（a-bud-002 / Phase E v1 #04）
- 前提:
  - Bud Phase D-07 銀行振込連携（transfer-accounting-csv の 8 区分階層）
  - Bud Phase D-11 MFC CSV 出力（72 列 / 9 カテゴリ）
  - 法人税法 §34（役員給与の損金算入）
  - 法人税法施行令 §69（定期同額給与・事前確定届出給与）

---

## 1. 目的とスコープ

### 1.1 目的

役員報酬は **損金算入要件**（定期同額 / 事前確定届出 / 業績連動）を満たさないと税務上経費にならない。Phase D-07 の 8 区分階層 CSV と D-11 MFC CSV 出力で **役員給与 / 役員賞与** を一般従業員給与と分離し、税務上正しい仕訳分類を自動化する。

### 1.2 含めるもの

- 役員報酬の月次定期同額（D-07 で「役員給与」区分に分離）
- 事前確定届出給与（賞与扱い、D-03 連携）
- D-11 MFC CSV の役員報酬列分離（仕訳科目: 役員報酬 vs 役員賞与 vs 給与手当）
- 損金不算入額の計算ヘルパー（届出額超過分等）

### 1.3 含めないもの

- 業績連動給与の計算ロジック → 個社別、本 spec 範囲外
- 役員退職慰労金 → Phase E v2 候補（退職金別 spec）
- 監査役・会計参与の特殊扱い → 個社別判断、本 spec 範囲外

---

## 2. テーブル拡張

### 2.1 既存 `root_employees` の拡張（Root 連携、参考）

役員フラグ・区分は Root マスタ管理（Phase E でも必要）:

```sql
-- Root 側で別途追加検討（本 spec では参照のみ）
alter table public.root_employees add column if not exists is_officer boolean default false;
alter table public.root_employees add column if not exists officer_type text
  check (officer_type is null or officer_type in (
    'representative_director',  -- 代表取締役
    'director',                 -- 取締役
    'auditor',                  -- 監査役
    'accounting_advisor'        -- 会計参与
  ));
```

### 2.2 新規: `bud_officer_compensation_settings`

事前確定届出給与の届出額を管理。

```sql
create table public.bud_officer_compensation_settings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.root_employees(id),
  fiscal_year int not null
    check (fiscal_year between 2020 and 2099),

  -- 月次定期同額（毎月同額）
  monthly_fixed_amount numeric(10, 0) not null
    check (monthly_fixed_amount >= 0),

  -- 事前確定届出給与（賞与）
  predetermined_bonus_amount numeric(10, 0),  -- 届出額
  predetermined_bonus_payment_date date,      -- 届出された支払予定日
  predetermined_bonus_filed_at date,          -- 税務署届出日

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (employee_id, fiscal_year)
);

create index idx_bocs_employee on public.bud_officer_compensation_settings(employee_id);
```

### 2.3 新規: `bud_officer_disallowed_amount_log`

損金不算入額の記録（届出額超過 / 定期同額違反等）。

```sql
create table public.bud_officer_disallowed_amount_log (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.root_employees(id),
  fiscal_year int not null,
  payroll_period_id uuid references public.bud_payroll_periods(id),

  disallowance_type text not null
    check (disallowance_type in (
      'monthly_amount_mismatch',  -- 定期同額違反
      'predetermined_bonus_excess', -- 届出超過
      'undeclared_bonus',          -- 届出なし賞与
      'other'
    )),

  disallowed_amount numeric(10, 0) not null,
  notes text,
  recorded_at timestamptz not null default now()
);
```

---

## 3. 純関数拡張

### 3.1 officer-functions.ts（新規）

```typescript
// src/app/bud/payroll/_lib/officer-functions.ts

export interface OfficerCompensationInput {
  employeeId: string;
  fiscalYear: number;
  monthlyAmount: number;        // 当月の支給額
  monthlyFixedAmount: number;   // 届出済の月次定期同額
  bonusAmount?: number;         // 当月賞与（あれば）
  predeterminedBonus?: number;  // 届出済の賞与額
}

export interface OfficerCompensationResult {
  /** 損金算入可額 */
  allowedAmount: number;
  /** 損金不算入額 */
  disallowedAmount: number;
  /** 不算入理由 */
  disallowanceType: "monthly_amount_mismatch" | "predetermined_bonus_excess" | "undeclared_bonus" | "none";
}

/**
 * 役員報酬の損金算入判定。
 *
 * - 月次が定期同額と一致 → 全額算入
 * - 月次が定期同額と不一致 → 差額が不算入
 * - 賞与が事前届出と一致 → 全額算入
 * - 賞与が事前届出と不一致 → 全額不算入（部分的差額不算入ではなく全額）
 */
export function judgeOfficerCompensation(
  input: OfficerCompensationInput,
): OfficerCompensationResult;

/**
 * D-07 transfer-accounting-csv の 8 区分階層に役員報酬を分離。
 *
 * 既存 8 区分: ①役員給与 / ②給与手当 / ③法定福利費 / ④福利厚生費 /
 *              ⑤雑給 / ⑥旅費交通費 / ⑦消耗品費 / ⑧その他
 *
 * 本関数は role 別に「役員給与」or「給与手当」へ振り分ける。
 */
export function classifyOfficerToAccountingCategory(
  isOfficer: boolean,
  paymentType: "monthly_salary" | "bonus" | "allowance",
): "officer_compensation" | "salary" | "bonus" | "allowance";

/**
 * D-11 MFC CSV の仕訳科目選択。
 */
export function selectOfficerJournalAccount(
  isOfficer: boolean,
  paymentType: "monthly" | "bonus",
  officerType?: string,
): {
  journalAccountCode: string;
  journalAccountName: string;
};
```

---

## 4. RLS

```sql
-- 設定テーブル
alter table public.bud_officer_compensation_settings enable row level security;

create policy bocs_select_admin on public.bud_officer_compensation_settings
  for select using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

create policy bocs_insert_admin on public.bud_officer_compensation_settings
  for insert with check (public.bud_is_admin_or_super_admin());

create policy bocs_update_admin on public.bud_officer_compensation_settings
  for update using (public.bud_is_admin_or_super_admin())
    with check (public.bud_is_admin_or_super_admin());

create policy bocs_no_delete on public.bud_officer_compensation_settings
  for delete using (false);

-- 不算入ログ
alter table public.bud_officer_disallowed_amount_log enable row level security;

create policy bodal_select_admin on public.bud_officer_disallowed_amount_log
  for select using (public.bud_is_admin_or_super_admin());

create policy bodal_insert_admin on public.bud_officer_disallowed_amount_log
  for insert with check (public.bud_is_admin_or_super_admin());

create policy bodal_no_update on public.bud_officer_disallowed_amount_log
  for update using (false);

create policy bodal_no_delete on public.bud_officer_disallowed_amount_log
  for delete using (false);
```

---

## 5. 法令対応チェックリスト

- [ ] 法人税法 §34（役員給与の損金算入：定期同額 / 事前確定届出 / 業績連動）
- [ ] 法人税法施行令 §69（定期同額給与の改定タイミング）
- [ ] 法人税法施行令 §69 の 2（事前確定届出給与の届出期限）
- [ ] 所得税法 §183（役員報酬の源泉徴収義務、一般従業員と同じ）
- [ ] 健保法 §40（役員も被保険者、標準報酬月額の判定）

---

## 6. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | bud_officer_compensation_settings + disallowed_amount_log migration + RLS | a-bud | 0.5h |
| 2 | officer-functions.ts 3 関数（judge / classify / selectJournal）| a-bud | 1.5h |
| 3 | D-07 transfer-accounting-csv に役員給与区分 統合 | a-bud | 1h |
| 4 | D-11 mfc-csv-mapper の仕訳科目 拡張 | a-bud | 1h |
| 5 | 単体テスト（定期同額一致 / 不一致 / 賞与届出超過）| a-bud | 1h |

合計: 約 5h ≈ **0.5d**（妥当）

---

## 7. 判断保留事項

| # | 論点 | 起草スタンス |
|---|---|---|
| 判 1 | 役員兼使用人（取締役兼部長等）| **本 spec では「使用人部分」と「役員部分」を分離せず、全額役員報酬扱い**。要詳細運用判断 |
| 判 2 | 期中の役員報酬改定 | **改定後 3 ヶ月以内なら定期同額継続可**（法人税法施行令 §69）|
| 判 3 | 届出額超過時の計算 | **超過分のみ全額不算入**（部分超過の場合 lock 額を超えた額を全額不算入）|
| 判 4 | 業績連動給与 | **本 spec 範囲外**、Phase E v2 で別 spec |
| 判 5 | 監査役の扱い | 取締役と同様の扱い（is_officer=true）、ただし日常実務関与なしの場合あり |
| 判 6 | 退職慰労金 | **本 spec 範囲外**、退職金専用 spec で対応 |

---

## 8. 既知のリスクと対策

### 8.1 役員フラグ（is_officer）の管理ミス

- Root マスタで is_officer=false のまま月次計算 → 給与手当扱いで誤区分
- 対策: D-10 給与計算統合で is_officer=true なら警告表示

### 8.2 届出書の有効期限管理

- 事前確定届出給与は事業年度ごとに再届出
- 対策: `predetermined_bonus_filed_at` で期限超過を検知、cron で警告通知

### 8.3 改定 3 ヶ月超の定期同額違反

- 期中改定で 3 ヶ月超過後も継続変更すると不算入
- 対策: `judgeOfficerCompensation` で 3 ヶ月窓を判定

### 8.4 D-11 仕訳科目の整合性

- 役員報酬の科目コードが個社別（弥生 / freee 等で異なる）
- 対策: `selectOfficerJournalAccount` を法人別 settings から lookup

---

## 9. 関連ドキュメント

- `docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md`
- `docs/specs/2026-04-26-bud-phase-d-11-mfc-csv-export.md`
- 国税庁「役員給与の損金算入のしおり」
- 法人税法施行令 §69 / §69 の 2

---

## 10. 受入基準（Definition of Done）

- [ ] `judgeOfficerCompensation` が定期同額一致 / 不一致 / 賞与届出超過を正しく判定
- [ ] `classifyOfficerToAccountingCategory` が役員/使用人を正しく分類
- [ ] D-07 transfer-accounting-csv で役員給与が「①役員給与」区分に集計
- [ ] D-11 MFC CSV で役員仕訳科目が正しい列に出力
- [ ] bud_officer_compensation_settings + disallowed_amount_log RLS 動作（admin only）
- [ ] 法令準拠（法人税法 §34 / 施行令 §69 / §69 の 2）
- [ ] 単体テスト 15+ tests pass
