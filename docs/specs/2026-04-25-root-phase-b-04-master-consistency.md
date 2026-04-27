# Root Phase B-4: マスタ間整合性チェック 仕様書

- 対象: Garden-Root の 7 マスタ間における整合性の自動検証・不整合通知・解消 UI
- 見積: **1.5〜1.75d**（内訳は §11、テーブル設計変更で +0.25〜0.5d）
- 担当セッション: a-root
- 作成: 2026-04-25（a-root-002 / Phase B-4 spec 起草）
- 改訂: 2026-04-26（a-root-002 / decisions-root-phase-b-20260426-a-main-006 反映）
- 元資料: `docs/specs/2026-04-24-root-master-definitions.md`, Phase A-3-g/h migration

---

## 0. 確定事項（2026-04-26 a-main 006 東海林承認済）

本 spec は `decisions-root-phase-b-20260426-a-main-006.md` の **B-4 関連項目** を反映する。

### B-4 で確定した主要事項

| # | 項目 | 確定内容 | 反映先 |
|---|---|---|---|
| #1 | 法人マスタ一元化 + 役割テーブル分離 | `root_business_entities`（法人マスタ一元）+ `partner_relationships`（取引先役割）+ `vendor_relationships`（外注先役割）の **3 テーブル分離設計**。memory `project_partners_vs_vendors_distinction.md` 参照 | §3 / §4 整合性ルール再構成 |
| #4 | App 55 申込者・代表者は受注後追加項目 | Kintone App 55 の「申込者」「代表者」フィールドは**受注後の追加情報**であり、初期取込時は空欄。受注フロー側で後追い入力 | §4.1 BIZ-XX 整合性ルール / §7 API |
| #8 | 段階的エスカレーション（Chatwork 通知） | critical 不整合は ① 事務局 Bot → ② 専用ルーム（30 分後未対応）→ ③ 東海林さん DM（2 時間後未対応）の **3 段階エスカレーション** | §9 Chatwork 通知 |

### 残課題（東海林さん追加情報待ち）

| # | 残課題 | 状態 |
|---|---|---|
| 保留 #1 | `root_business_entities` を **Garden Fruit と統合**するか **Root 独立**にするか | 🔵 要協議。Fruit は法人法的実体情報を扱うモジュール（実体化中）、Root は業務上の取引先・外注先情報を扱う。両者の境界線を a-main 経由で東海林さんに確認後、本 spec を再改訂 |

---

## 1. 目的とスコープ

### 目的

7 つの Root マスタは相互に外部キーや業務ルールで結合している。  
FK 制約で参照整合性の一部は保護されているが、**業務整合性・状態整合性**はアプリ層での保証が弱い。本 Phase では：

1. 参照整合性 / 状態整合性 / 業務整合性の 3 カテゴリを網羅するチェック関数群を整備
2. 日次 cron で自動チェックを走らせ、不整合を `root_consistency_violations` に記録
3. admin UI で一覧確認・解消マークができるようにする
4. critical な不整合（振込・給与計算に直結）は即時 Chatwork 通知する

### 含める

- チェッククエリ群（PostgreSQL function / view）
- `root_consistency_violations` テーブル（結果格納）+ `root_consistency_check_log`（実行履歴）
- Vercel Cron による日次自動チェック（既存 `/api/root/cron/kot-sync` パターン踏襲）
- admin UI: 不整合一覧・解消マーク・手動実行ボタン
- Chatwork 通知（critical のみ即時、その他は日次サマリ）

### 含めない

- 不整合の**自動修正**（データ変更は人間の判断が必要 → 判断保留 §12 参照）
- Bud / Leaf / Tree テーブルへのクロスチェック（Root テーブル内に限定）
- MFクラウド給与 / キングオブタイム側データ検証

---

## 2. 既存実装との関係

### 7 マスタの相互参照（2026-04-26 法人マスタ一元化後）

```
root_companies ←── root_bank_accounts.company_id
               ←── root_employees.company_id

root_employees ←── root_attendance.employee_id
               ←── root_attendance_daily.employee_id（A-3-d）
               .salary_system_id ──► root_salary_systems

root_business_entities ←── partner_relationships.entity_id（取引先役割）
                       ←── vendor_relationships.entity_id（外注先役割）
vendor_relationships   .bank_account_id ──► root_bank_accounts

-- 移行期間中（root_vendors deprecated 前）
root_companies ←── root_vendors.company_id（nullable）
```

### Phase A-3-g/h で拡張済のフィールド（整合チェックに関わるもの）

| フィールド | migration | 整合チェックとの関係 |
|---|---|---|
| `employment_type` CHECK ('正社員'/'アルバイト'/'outsource') | A-3-g | 給与体系との整合（§4.3 BIZ-03/04/05） |
| `contract_end_on` | A-3-g | 外注の活性判定（STA-07） |
| `garden_role` CHECK（8 段階） | A-3-g | role と employment_type の整合 |
| `kou_otsu` CHECK ('kou'/'otsu'/null) | A-3-h | 現役社員の甲乙未設定検出（BIZ-06） |
| `deleted_at` | A-3-h | 論理削除と is_active の二重矛盾検出（STA-08） |

### 既存の監査インフラ

- `root_audit_log`: ユーザー操作ログ → 不整合起票時に `check_violation_detected` アクションで再利用
- `root_kot_sync_log`: システム同期履歴 → `root_consistency_check_log` 設計の参照パターン

---

## 3. root_partners の取扱い（2026-04-26 確定: 法人マスタ一元化 + 役割分離）

### 確定した設計

memory `project_partners_vs_vendors_distinction.md` に従い、以下の 3 テーブル分離設計を採用する。

```sql
-- 法人マスタ（一元）：すべての法人 / 個人事業主の基本情報
CREATE TABLE root_business_entities (
  entity_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        text NOT NULL CHECK (entity_type IN ('corporation', 'sole_proprietor', 'individual')),
  legal_name         text NOT NULL,
  legal_name_kana    text,
  registration_number text,                      -- 法人番号 13 桁等
  representative     text,
  established_at     date,
  dissolved_at       date,
  address            text,
  phone              text,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- 取引先役割：その法人が「取引先」として何をしているか（受注・請求等）
CREATE TABLE partner_relationships (
  relationship_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          uuid NOT NULL REFERENCES root_business_entities(entity_id),
  partner_role       text NOT NULL,             -- 'kanden_outsource' / 'sim_supplier' / 'audit_office' 等
  contract_start_on  date,
  contract_end_on    date,
  primary_contact    text,
  notes              text,
  is_active          boolean NOT NULL DEFAULT true
);

-- 外注先役割：その法人 / 個人事業主が「外注先」として何をしているか
CREATE TABLE vendor_relationships (
  relationship_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          uuid NOT NULL REFERENCES root_business_entities(entity_id),
  vendor_role        text NOT NULL,             -- 'kanden_field_agent' / 'tax_advisor' 等
  contract_start_on  date,
  contract_end_on    date,
  primary_contact    text,
  bank_account_id    uuid REFERENCES root_bank_accounts(account_id),
  fee_structure      jsonb,
  is_active          boolean NOT NULL DEFAULT true
);
```

### 既存 root_vendors との関係

既存 `root_vendors` テーブルは Phase B-4 完了後に **deprecated** とする。
移行ステップ:

1. 既存 root_vendors レコードを root_business_entities + vendor_relationships に分割 INSERT
2. 各モジュール（Bud / Leaf）で root_vendors 参照箇所を vendor_relationships へ書換
3. root_vendors を view 化（互換性のため一時的に残す）
4. 全モジュール移行完了後に root_vendors を DROP

### 整合チェックへの影響

本 §3 の設計変更により、§4 の整合性チェックルールは以下のテーブルを対象とする:

- **取引先**: `root_business_entities` + `partner_relationships`
- **外注先**: `root_business_entities` + `vendor_relationships`
- **旧 root_vendors**: 移行期間中は並行してチェック対象に含める

### 残課題（保留 #1）

- `root_business_entities` を **Garden Fruit と統合する**案も検討中
- Fruit は法人法的実体情報の正本テーブル想定
- Root の business_entities と Fruit の対応をどう設計するか、a-main 経由で東海林さんに確認後、本 spec を再改訂

---

## 4. 整合性チェック対象（カテゴリ別）

### 4.1 参照整合性チェック（REF）

| チェック ID | チェック内容 | 対象 | 重要度 |
|---|---|---|---|
| REF-01 | `root_employees.company_id` → `root_companies` 存在確認 | employees → companies | critical |
| REF-02 | `root_employees.salary_system_id` → `root_salary_systems` 存在確認 | employees → salary_systems | critical |
| REF-03 | `root_bank_accounts.company_id` → `root_companies` 存在確認 | bank_accounts → companies | high |
| REF-04 | `root_attendance.employee_id` → `root_employees` 存在確認 | attendance → employees | high |
| REF-05 | `partner_relationships.entity_id` → `root_business_entities` 存在確認（旧: root_vendors.company_id 確認は移行期間中並行） | partner_relationships → root_business_entities | medium |
| REF-06 | `root_attendance_daily.employee_id` → `root_employees` 存在確認 | attendance_daily → employees | medium |
| REF-07 | `vendor_relationships.entity_id` → `root_business_entities` 存在確認 | vendor_relationships → root_business_entities | medium |
| REF-08 | `vendor_relationships.bank_account_id`（nullable）が設定済の場合の存在確認 | vendor_relationships → root_bank_accounts | medium |

### 4.2 状態整合性チェック（STA）

| チェック ID | チェック内容 | 対象 | 重要度 |
|---|---|---|---|
| STA-01 | 退職済 employee（`termination_date` 過去日）に未来月の attendance が存在しないか | employees + attendance | critical |
| STA-02 | `is_active = false` の employee に当月以降の attendance が存在しないか | employees + attendance | high |
| STA-03 | `deleted_at` 設定済の employee に未来月 attendance が存在しないか | employees + attendance | high |
| STA-04 | `is_active = false` の `vendor_relationships` への参照が Bud 側に残っていないか（§8 連携ポイント）。移行期間中は `root_vendors` も並行チェック | vendor_relationships | critical |
| STA-05 | `is_active = false` の `vendor_relationships` で `contract_end_on` が過去日なのに外注先支払が継続されていないか。また `is_active = false` の `root_companies` に紐付く新規 bank_account が存在しないか | vendor_relationships / companies + bank_accounts | high |
| STA-06 | `is_active = false` の salary_system を参照する `is_active = true` の employee がいないか | salary_systems + employees | high |
| STA-07 | 外注 (`employment_type = 'outsource'`) で `contract_end_on` が過去日なのに `is_active = true` のままの employee | employees | medium |
| STA-08 | `deleted_at` 設定済 + `is_active = true` の矛盾レコード | employees | medium |

### 4.3 業務整合性チェック（BIZ）

| チェック ID | チェック内容 | 対象 | 重要度 |
|---|---|---|---|
| BIZ-01 | 同一法人内での `employee_number` の重複 | employees | critical |
| BIZ-02 | 同一法人内での同一銀行口座番号（`bank_code + branch_code + account_number`）の重複 | bank_accounts | high |
| BIZ-03 | `employment_type = 'アルバイト'` に `base_salary_type = '月給'` の salary_system が割当されていないか | employees + salary_systems | high |
| BIZ-04 | `employment_type = '正社員'` に `base_salary_type = '時給'` の salary_system が割当されていないか | employees + salary_systems | medium |
| BIZ-05 | `employment_type = 'outsource'` に正社員向け salary_system が割当されていないか | employees + salary_systems | medium |
| BIZ-06 | `kou_otsu = null` で `is_active = true`（甲乙区分未設定の現役社員） | employees | low |
| BIZ-07 | `insurance_type = '加入'` だが有効な `root_insurance` レコードが存在しない | employees + insurance | high |
| BIZ-08 | 同一 `entity_type` 内で `legal_name_kana` が完全一致する重複 `root_business_entities` | root_business_entities | medium |
| BIZ-09 | `hire_date` が `termination_date` より後の矛盾レコード | employees | critical |
| BIZ-10 | `root_attendance.target_month` が `hire_date` より前 or `termination_date` より後 | employees + attendance | medium |
| BIZ-11 | 受注ステータスが 'received' 以降で申込者・代表者（Kintone App 55 由来）が NULL の場合警告。受注フロー側での後追い入力チェック（§0 確定 #4 参照） | leaf_kanden_orders（または対応受注テーブル） | warning |

---

## 5. データフロー

```
Vercel Cron（毎日 02:00 JST）
  → POST /api/root/cron/consistency-check
  → run_consistency_checks()（PostgreSQL function）
  → 不整合あり → root_consistency_violations に INSERT（ON CONFLICT DO NOTHING で重複防止）
              → severity=critical → Chatwork 即時通知（§9 段階的エスカレーション起点）
              → severity=warning  → 日次 09:00 サマリ通知（BIZ-11 等）
              → その他            → 日次 09:00 サマリ通知
  → root_consistency_check_log に実行履歴記録
  → root_audit_log に check_violation_detected 起票
  → root_consistency_escalation_log に段階遷移履歴記録（§9.3 参照）

admin UI（/root/consistency）
  → 未解消一覧取得（v_root_violations_active VIEW）
  → 手動実行ボタン → 上記 cron エンドポイントを呼出
  → 解消マーク → resolved_at / resolved_by / resolution_note を UPDATE

受注フロー（Leaf / App 55 連携）
  → 受注ステータス更新時に BIZ-11 警告チェックを呼出
  → 申込者・代表者が NULL のまま 'received' に遷移しようとした場合 → 警告表示
  → 後追い入力完了後に警告を解消マーク
```

---

## 6. データモデル提案

### 6.1 `root_consistency_violations`（不整合記録テーブル）

```sql
CREATE TABLE IF NOT EXISTS public.root_consistency_violations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id            text NOT NULL,          -- 'REF-01', 'STA-01', 'BIZ-01' 等
  check_category      text NOT NULL
    CHECK (check_category IN ('referential', 'state', 'business')),
  severity            text NOT NULL
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  target_table        text NOT NULL,
  target_id           text NOT NULL,          -- レコードの主キー値（文字列統一）
  target_display      text,                   -- 例: '田中 太郎 (EMP-0012)'
  violation_message   text NOT NULL,
  detail              jsonb,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES auth.users(id),
  resolution_note     text,
  CONSTRAINT uq_violation_unresolved
    UNIQUE NULLS NOT DISTINCT (check_id, target_table, target_id, resolved_at),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rcv_unresolved ON public.root_consistency_violations (detected_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_rcv_severity   ON public.root_consistency_violations (severity, detected_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_rcv_check_id   ON public.root_consistency_violations (check_id, detected_at DESC);
```

### 6.2 `root_consistency_check_log`（実行履歴）

```sql
CREATE TABLE IF NOT EXISTS public.root_consistency_check_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by     text NOT NULL,             -- user_id or 'cron'
  triggered_at     timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  duration_ms      integer,
  status           text NOT NULL CHECK (status IN ('running', 'success', 'failure')),
  checks_run       integer NOT NULL DEFAULT 0,
  violations_new   integer NOT NULL DEFAULT 0,
  violations_total integer NOT NULL DEFAULT 0,
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### 6.3 `v_root_violations_active`（管理 VIEW）

```sql
CREATE OR REPLACE VIEW public.v_root_violations_active AS
SELECT
  v.*,
  EXTRACT(DAY FROM now() - v.detected_at)::int AS days_open
FROM public.root_consistency_violations v
WHERE v.resolved_at IS NULL
ORDER BY
  CASE v.severity
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4
  END,
  v.detected_at DESC;
```

### 6.4 `run_consistency_checks()`（チェック実行関数・骨格）

```sql
CREATE OR REPLACE FUNCTION public.run_consistency_checks()
  RETURNS TABLE (check_id text, violations_found int)
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_log_id uuid;
BEGIN
  INSERT INTO public.root_consistency_check_log (triggered_by, status)
    VALUES ('cron', 'running') RETURNING id INTO v_log_id;

  -- REF-01: employee → company 孤立チェック（他チェックも同パターン）
  INSERT INTO public.root_consistency_violations
    (check_id, check_category, severity, target_table, target_id, target_display, violation_message)
  SELECT 'REF-01', 'referential', 'critical', 'root_employees',
    e.employee_id, e.name || ' (' || e.employee_id || ')',
    'company_id ' || e.company_id || ' が root_companies に存在しない'
  FROM public.root_employees e
  LEFT JOIN public.root_companies c ON c.company_id = e.company_id
  WHERE c.company_id IS NULL
  ON CONFLICT (check_id, target_table, target_id, resolved_at) DO NOTHING;

  -- BIZ-01: 同一法人内 employee_number 重複（detail に件数を格納する例）
  INSERT INTO public.root_consistency_violations
    (check_id, check_category, severity, target_table, target_id, target_display, violation_message, detail)
  SELECT 'BIZ-01', 'business', 'critical', 'root_employees',
    e.employee_id, e.name || ' (' || e.employee_id || ')',
    '従業員番号 ' || e.employee_number || ' が法人 ' || e.company_id || ' 内で重複',
    jsonb_build_object('duplicate_count', cnt.dup_count)
  FROM public.root_employees e
  INNER JOIN (
    SELECT company_id, employee_number, COUNT(*) AS dup_count
    FROM public.root_employees WHERE is_active = true
    GROUP BY company_id, employee_number HAVING COUNT(*) > 1
  ) cnt ON cnt.company_id = e.company_id AND cnt.employee_number = e.employee_number
  WHERE e.is_active = true
  ON CONFLICT (check_id, target_table, target_id, resolved_at) DO NOTHING;

  -- （§4 の全 20 チェックを同パターンで実装）

  UPDATE public.root_consistency_check_log
    SET status = 'success', completed_at = now(),
        duration_ms = EXTRACT(MILLISECONDS FROM now() - triggered_at)::int
    WHERE id = v_log_id;

  RETURN QUERY
    SELECT v.check_id, COUNT(*)::int
    FROM public.root_consistency_violations v WHERE v.resolved_at IS NULL
    GROUP BY v.check_id;
END; $$;
```

### 6.5 `root_consistency_escalation_log`（段階エスカレーション履歴）

```sql
CREATE TABLE IF NOT EXISTS public.root_consistency_escalation_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id        uuid NOT NULL REFERENCES public.root_consistency_violations(id),
  escalation_stage    integer NOT NULL CHECK (escalation_stage IN (1, 2, 3)),
  -- 1: 事務局 Bot 即時通知
  -- 2: 専用ルーム（30 分後未対応）
  -- 3: 東海林さん DM（2 時間後未対応）
  notified_at         timestamptz NOT NULL DEFAULT now(),
  channel_type        text NOT NULL,              -- 'jimukyoku' / 'consistency_alert' / 'shoji_dm'
  chatwork_room_id    text,
  message_preview     text,
  triggered_by        text NOT NULL DEFAULT 'cron',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rcel_violation_id ON public.root_consistency_escalation_log (violation_id, escalation_stage);
CREATE INDEX idx_rcel_notified_at  ON public.root_consistency_escalation_log (notified_at DESC);
```

### 6.6 RLS

```sql
ALTER TABLE public.root_consistency_violations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.root_consistency_check_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.root_consistency_escalation_log    ENABLE ROW LEVEL SECURITY;

-- 閲覧: admin / super_admin のみ
CREATE POLICY rcv_select ON public.root_consistency_violations FOR SELECT
  USING (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- 解消マーク: admin / super_admin のみ
CREATE POLICY rcv_update ON public.root_consistency_violations FOR UPDATE
  USING  (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- INSERT は service_role のみ（cron / server action 経由）
CREATE POLICY rcl_select ON public.root_consistency_check_log FOR SELECT
  USING (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- エスカレーションログ: admin / super_admin 閲覧のみ
CREATE POLICY rcel_select ON public.root_consistency_escalation_log FOR SELECT
  USING (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'));
```

---

## 7. API / Server Action 契約

### 7.1 手動チェック実行

```typescript
// POST /api/root/cron/consistency-check  または  Server Action
export async function runConsistencyCheck(params: {
  triggeredBy: string;  // userId or 'manual'
}): Promise<{
  success: boolean; logId: string; checksRun: number;
  violationsNew: number; violationsTotal: number; durationMs: number; error?: string;
}>;
```

### 7.2 不整合一覧取得

```typescript
export async function listViolations(params: {
  severity?: 'critical' | 'high' | 'medium' | 'low';
  checkCategory?: 'referential' | 'state' | 'business';
  resolved?: boolean;   // false = 未解消のみ（デフォルト）
  limit?: number;       // デフォルト 50
  offset?: number;
}): Promise<{ items: ConsistencyViolation[]; total: number }>;

interface ConsistencyViolation {
  id: string; checkId: string; checkCategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  targetTable: string; targetId: string; targetDisplay: string | null;
  violationMessage: string; detail: Record<string, unknown> | null;
  detectedAt: string; daysOpen: number;
  resolvedAt: string | null; resolvedBy: string | null; resolutionNote: string | null;
}
```

### 7.3 個別不整合の解消マーク

```typescript
export async function resolveViolation(params: {
  violationId: string; resolutionNote: string;
}): Promise<{ success: boolean; error?: string }>;

// 同一 checkId 全件一括解消
export async function resolveViolationsByCheckId(params: {
  checkId: string; resolutionNote: string;
}): Promise<{ success: boolean; resolvedCount: number; error?: string }>;
```

### 7.4 App 55 申込者・代表者の後追い入力チェック（BIZ-11 対応、§0 確定 #4）

> **設計注記**: Kintone App 55 の「申込者」「代表者」フィールドは受注後の追加情報であり、
> 初期取込時は空欄。受注ステータスが 'received' 以降になったタイミングで
> Leaf / 受注フロー側から本 API を呼び出し、入力漏れを警告する。

```typescript
// 受注フロー側が呼び出す警告チェック（Root 側が提供）
export async function checkApp55OrderRequiredFields(params: {
  orderId: string;        // leaf 側の受注レコード ID
  orderStatus: string;   // 現在の受注ステータス（'received' 以降で起動）
}): Promise<{
  hasWarnings: boolean;
  warnings: Array<{
    field: 'applicant' | 'representative';
    message: string;
  }>;
}>;
```

- 実装場所: `src/app/root/_actions/consistency-biz11.ts`
- 呼出元: `src/app/leaf/_actions/update-order-status.ts`（受注ステータス更新時）
- 警告が返ってきた場合は UI でインライン警告表示。遷移をブロックはしない（warning 止まり）

---

## 8. a-bud / a-leaf / a-tree との連携ポイント

### 8.1 a-bud（振込実行前の vendor 整合確認）

- 振込 CSV 作成前に `vendor_relationships.is_active = true` を確認。`false` なら**エラーで停止**（critical）
- 移行期間中は `root_vendors.is_active = true` も並行チェック
- 実装場所: `bud/_actions/create-furikomi.ts`
- Root 側提供ユーティリティ: `assertVendorActive(vendorRelationshipId: string): Promise<void>`（`VENDOR_INACTIVE` を throw）
- root_vendors deprecated 後は引数を `vendor_relationships.relationship_id` に切替

### 8.2 a-leaf（案件登録時の employee 在籍確認）

- 案件作成時に担当者の `is_active = true` + `termination_date` 未来日 or null を確認
- A-3-g で実装済の `is_user_active()` 関数を流用可

### 8.3 a-tree（架電セレクト前の employee 在籍確認）

- シフト・架電割当の担当者候補リストから退職済 / 外注契約終了の employee を除外
- `is_user_active()` または `is_active = true AND (termination_date IS NULL OR termination_date > current_date)` でフィルタ

---

## 9. Chatwork 通知（段階的エスカレーション）

不整合発見時の通知は重要度別 + **3 段階エスカレーション** で実施する（§0 確定 #8）。
メモリ参照: `project_chatwork_bot_ownership.md`（事務局 Bot の所有権・運用ルール）

### 9.1 critical 不整合の段階的エスカレーション

| 段階 | タイミング | 通知先 | 通知内容 |
|---|---|---|---|
| ① | 即時（cron 完了直後） | 事務局 Bot ルーム（chatwork-jimukyoku） | 「critical 不整合 X 件検出」+ check_id / 対象 / メッセージ一覧 |
| ② | 30 分後（① で未対応時） | 専用ルーム（chatwork-consistency-alert） | 「30 分経過、未対応の critical 不整合あり」+ admin メンション |
| ③ | 2 時間後（② で未対応時） | 東海林さん DM（chatwork-shoji-dm） | 「2 時間経過、未対応の critical 不整合あり」+ super_admin 緊急対応依頼 |

### 9.2 「対応」の定義

- `root_consistency_violations.status` を `'investigating'` or `'resolved'` に変更したら「対応中」「対応済み」とみなす
- `'detected'` のままなら未対応扱い（エスカレーション継続）

### 9.3 段階遷移の実装

- B-6 通知基盤（Phase B-6.4 以降）の購読設定で実現
- 各段階に対し Vercel Cron（5 分間隔）で「30 分経過 / 2 時間経過判定」を実施
- 判定ロジック: `root_consistency_escalation_log` を参照し、同一 violation_id で最大 stage が未到達かつ経過時間を超えていたら次段階に進む
- `root_consistency_escalation_log` テーブルで段階遷移履歴を記録（§6.5 参照）

### 9.4 その他の通知（non-critical）

| トリガー | タイミング | 内容 |
|---|---|---|
| 日次サマリ（high / medium / low） | 毎日 09:00 JST | 未解消件数（severity 別）と上位 5 件 |
| warning（BIZ-11 等） | 日次 09:00 JST | App 55 申込者・代表者 未入力の受注件数 |

通知先チャンネル ID は未確認事項 U4 参照。既存 Chatwork 通知実装（B-6）に準拠。

---

## 10. 受入基準

1. `root_consistency_violations` + `root_consistency_check_log` が migration で作成され RLS 設定済
2. `run_consistency_checks()` が §4 の全 20 チェック（REF-01〜06, STA-01〜08, BIZ-01〜10）を実行し INSERT できること
3. Vercel Cron（毎日 02:00 JST）で自動チェックが走り実行ログが記録されること
4. admin UI（`/root/consistency`）で未解消一覧が severity 順に表示されること
5. 手動実行ボタンで即時チェックが走ること
6. 解消マーク（`resolved_at` / `resolved_by` / `resolution_note`）が保存され一覧から消えること
7. critical 不整合検出時に Chatwork へ即時通知されること
8. RLS: admin / super_admin のみ閲覧・更新、INSERT は service_role のみ
9. `garden_role_of()`（A-3-g 実装済）を RLS ポリシーで再利用していること
10. 既存マスタテーブルへの**破壊的変更なし**

---

## 11. 想定工数（内訳）

> 2026-04-26 改訂: テーブル設計変更（§3 法人マスタ一元化）と段階的エスカレーション追加により +0.25〜0.5d。

| # | 作業 | 工数 | 備考 |
|---|---|---|---|
| W1 | `root_consistency_violations` + `root_consistency_check_log` + `root_consistency_escalation_log` migration + RLS | 0.15d | escalation_log 追加で +0.05d |
| W2 | `root_business_entities` + `partner_relationships` + `vendor_relationships` migration（root_vendors deprecated + view 化含む） | 0.25d | 新規追加タスク（#1 法人マスタ一元化） |
| W3 | `v_root_violations_active` VIEW + `run_consistency_checks()` 関数（全チェック: REF 8 件 + STA 8 件 + BIZ 11 件） | 0.3d | チェック数増加で +0.05d |
| W4 | Vercel Cron エンドポイント（`/api/root/cron/consistency-check`） | 0.1d | |
| W5 | Server Actions（runConsistencyCheck / listViolations / resolveViolation / checkApp55OrderRequiredFields） | 0.15d | BIZ-11 API 追加で +0.05d |
| W6 | admin UI — 不整合一覧画面（`/root/consistency`）+ 手動実行ボタン | 0.25d | |
| W7 | admin UI — 解消マークモーダル + 実行ログ一覧タブ | 0.1d | |
| W8 | Chatwork 通知（段階的エスカレーション 3 段階 + 日次サマリ） | 0.2d | 3 段階エスカレーション追加で +0.1d |
| W9 | 動作確認・テスト（dev 環境でサンプル不整合・エスカレーション動作を確認） | 0.3d | エスカレーション確認追加で +0.05d |
| **合計** | | **1.8d** | 旧見積 1.25d より +0.55d |

> **注**: 保留 #1（Fruit 統合）が確定した場合、W2 の migration が再設計となり +0.25〜0.5d 追加の可能性あり。

---

## 12. 判断保留

| # | 論点 | 本 spec のスタンス |
|---|---|---|
| 判1 | ~~**root_partners の意味**（最重要）~~ | **確定済（§0 / §3）**: root_business_entities + partner_relationships / vendor_relationships の 3 テーブル分離設計を採用 |
| 判2 | **自動修正の可否** | 禁止。解消マークのみ提供。将来の許可は U5 で確認 |
| 判3 | **チェック頻度** | 日次 02:00 JST を既定値。Vercel Cron 設定変更で調整可能 |
| 判4 | **STA-04（Bud 側振込参照）の実装場所** | Root 外のチェックは a-bud 担当（§8.1 参照） |
| 判5 | **BIZ-03/04 の重要度** | 現状 high だが給与計算誤りに繋がるため critical への格上げを東海林さんに確認 |
| 判6 | **BIZ-08 の重複判定基準** | `legal_name_kana` 完全一致（旧: vendor_name_kana）。部分一致は誤検知リスクがあるため保留 |
| 判7 | **解消マークの権限** | admin / super_admin 限定。manager への開放の可否は要確認 |
| 判8 | ~~**3 日超過エスカレーション先**~~ | **確定済（§0 / §9）**: 3 段階エスカレーション（事務局 Bot → 専用ルーム → 東海林さん DM）を採用 |
| 判9 | **outsource の担当 vendor との紐付け** | 現状 employee に vendor_relationships への FK なし。追加時は整合チェック対象に追加 |
| 判10 | **attendance vs attendance_daily の月次合計一致チェック** | 本 Phase の対象外。Phase C で検討 |
| 判11 | **root_business_entities と Garden Fruit の統合** | **保留 #1（§0 / §3 参照）**: a-main 経由で東海林さんに確認後、本 spec 再改訂 |
| 判12 | **root_vendors deprecated のタイミング** | 全モジュール（Bud / Leaf）の vendor_relationships 移行完了後に DROP。移行期間は並行チェックを維持 |

---

## 13. 未確認事項（東海林さんに要ヒアリング）

| # | 未確認事項 | 状態 |
|---|---|---|
| U1 | ~~**root_partners の意味**~~ | ✅ **確定済（2026-04-26）**: 法人マスタ一元化 + 役割テーブル分離設計（§3）を採用 |
| U2 | BIZ-03/04 を critical に格上げしてよいか | 🔵 未確認 |
| U3 | 解消マークの権限を manager にも開放するか（現状 admin 限定） | 🔵 未確認 |
| U4 | Chatwork 通知の送信先チャンネル ID（critical 即時・日次サマリ・専用ルーム・東海林さん DM） | 🔵 未確認 |
| U5 | 自動修正（例: STA-07 で contract_end_on 過去日の outsource を is_active=false に自動更新）を将来的に許可するか | 🔵 未確認 |
| U6 | `root_insurance` に有効レコードがない場合（BIZ-07）のフォールバック動作（エラー vs 警告） | 🔵 未確認 |
| U7 | **root_business_entities と Garden Fruit の統合判断**（保留 #1）: Fruit モジュールに法人法的実体テーブルが正本として存在する場合、Root の root_business_entities と二重管理になる可能性。統合 or 独立を決定後に §3 / W2 を再設計 | 🔴 **要協議（最重要）** |

— end of Root Phase B-4 spec —
