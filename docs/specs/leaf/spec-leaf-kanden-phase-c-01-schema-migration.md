# Leaf 関電業務委託 Phase C-01: DB スキーマ migration

- 対象: `soil_kanden_cases` テーブルの Phase C 拡張
- 優先度: **🔴 最高**（後続 02-06 の前提）
- 見積: **0.75d**
- 担当セッション: a-leaf
- 作成: 2026-04-24（a-auto / Batch 8 Leaf 関電 #01）
- 前提: Phase B 実装（`soil_kanden_cases` 基本カラム）, spec-cross-rls-audit, spec-cross-audit-log

---

## 1. 目的とスコープ

### 目的
Phase B で確定した `soil_kanden_cases` テーブル構造に、**関電業務委託特有のビジネス列**を追加し、事務・管理者・営業の**閲覧/編集権限分離**を RLS ポリシーで表現する。

### 含める
- Phase C で追加する列（契約種別・供給地点・検針日等の拡張）
- sync_log テーブル（Phase C-04 関電報告書バッチ用）
- 関電特有の辞書テーブル（`soil_kanden_plans` 等）
- RLS ポリシー設計（営業 / 事務 / 管理者 / super_admin の 4 階層）
- 既存データへの影響範囲分析

### 含めない
- TSX / API 実装（Phase C-02 以降）
- Chatwork 通知連携（Phase C-05）
- KoT 連携（Root 既設、ここでは参照のみ）

---

## 2. 既存実装との関係

### Phase B までで確定済の `soil_kanden_cases`
`feature/leaf-kanden-supabase-connect` ブランチの `src/app/leaf/_lib/types.ts` 確認結果：

- **8 段階ステータス**（ordered → completed）
- **case_type**（latest / replaced / makinaoshi / outside）
- **acquisition_type**（dakkan / kakoi）
- **営業情報**（employee_number / name / department / app_code）
- **顧客情報**（customer_number / name / supply_point_22 / supply_schedule_code / supply_start_date）
- **PD 情報**（pd_number / old_pd_number）
- **日付 8 種**（ordered_at 〜 completed_at）
- **フラグ**（is_urgent_sw / is_direct_operation / specs_ready_on_submit）
- **OCR 結果**（ocr_status / ocr_customer_number / ocr_confidence）
- **3 者比較結果**（compare_*_result）
- **メタ**（review_note / submitted_by / submitted_at / note）

### Phase C 追加列（本 spec の主テーマ）

| 列名 | 型 | 必須 | 説明 |
|---|---|---|---|
| `contract_type` | text | NOT NULL | 契約種別（高圧 / 特別高圧 / 低圧）|
| `plan_code` | text | NULL | 料金プランコード（関電マスタ参照）|
| `meter_reading_day` | int | NULL | 検針日（1-31）|
| `monthly_kwh` | numeric(10,2) | NULL | 月間想定使用量（kWh）|
| `contract_kw` | numeric(8,2) | NULL | 契約電力（kW、高圧以上）|
| `customer_tier` | text | NULL | 顧客ランク（A/B/C/D）|
| `invoice_sent_date` | date | NULL | 請求書送付日（invoiced_at と別）|
| `expected_payment_date` | date | NULL | 入金予定日 |
| `actual_payment_date` | date | NULL | 入金実績日 |
| `payout_scheduled_date` | date | NULL | 支払予定日 |
| `payout_actual_date` | date | NULL | 支払実績日 |
| `commission_rate` | numeric(5,2) | NULL | 業務委託手数料率 |
| `commission_amount` | bigint | NULL | 手数料金額（円）|
| `cancellation_flag` | boolean | NOT NULL DEFAULT false | 解約フラグ |
| `cancelled_at` | timestamptz | NULL | 解約時刻 |
| `cancellation_reason` | text | NULL | 解約理由 |
| `last_synced_from_pd_at` | timestamptz | NULL | PD 最終同期時刻 |
| `pd_sync_errors` | jsonb | NULL | PD 同期エラー履歴 |

---

## 3. データモデル: migration SQL

### 3.1 列追加

```sql
-- supabase/migrations/20260501_01_soil_kanden_phase_c_columns.sql
BEGIN;

ALTER TABLE soil_kanden_cases
  -- 契約詳細
  ADD COLUMN IF NOT EXISTS contract_type text
    CHECK (contract_type IN ('low_voltage', 'high_voltage', 'extra_high_voltage', 'unknown')),
  ADD COLUMN IF NOT EXISTS plan_code text,
  ADD COLUMN IF NOT EXISTS meter_reading_day int CHECK (meter_reading_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS monthly_kwh numeric(10,2),
  ADD COLUMN IF NOT EXISTS contract_kw numeric(8,2),
  ADD COLUMN IF NOT EXISTS customer_tier text CHECK (customer_tier IN ('A', 'B', 'C', 'D')),

  -- 請求・支払い詳細
  ADD COLUMN IF NOT EXISTS invoice_sent_date date,
  ADD COLUMN IF NOT EXISTS expected_payment_date date,
  ADD COLUMN IF NOT EXISTS actual_payment_date date,
  ADD COLUMN IF NOT EXISTS payout_scheduled_date date,
  ADD COLUMN IF NOT EXISTS payout_actual_date date,
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2) CHECK (commission_rate BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS commission_amount bigint CHECK (commission_amount >= 0),

  -- 解約
  ADD COLUMN IF NOT EXISTS cancellation_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,

  -- PD 同期
  ADD COLUMN IF NOT EXISTS last_synced_from_pd_at timestamptz,
  ADD COLUMN IF NOT EXISTS pd_sync_errors jsonb;

COMMIT;
```

### 3.2 インデックス追加

```sql
-- supabase/migrations/20260501_02_soil_kanden_phase_c_indexes.sql
BEGIN;

-- 検針日集計（Phase C-04 月次バッチ）
CREATE INDEX IF NOT EXISTS soil_kanden_meter_day_idx
  ON soil_kanden_cases (meter_reading_day)
  WHERE status NOT IN ('completed') AND cancellation_flag = false;

-- 解約以外のアクティブ案件
CREATE INDEX IF NOT EXISTS soil_kanden_active_idx
  ON soil_kanden_cases (status, ordered_at DESC)
  WHERE cancellation_flag = false;

-- 入金予定の近い順
CREATE INDEX IF NOT EXISTS soil_kanden_payment_due_idx
  ON soil_kanden_cases (expected_payment_date)
  WHERE status = 'awaiting_payment' AND cancellation_flag = false;

-- PD 同期状態
CREATE INDEX IF NOT EXISTS soil_kanden_pd_sync_idx
  ON soil_kanden_cases (last_synced_from_pd_at DESC)
  WHERE last_synced_from_pd_at IS NOT NULL;

-- 営業員別検索（既設より強化）
CREATE INDEX IF NOT EXISTS soil_kanden_sales_search_idx
  ON soil_kanden_cases (sales_employee_number, status, ordered_at DESC);

COMMIT;
```

### 3.3 辞書テーブル

```sql
-- supabase/migrations/20260501_03_soil_kanden_plans.sql
BEGIN;

CREATE TABLE soil_kanden_plans (
  plan_code       text PRIMARY KEY,
  plan_name       text NOT NULL,
  contract_type   text NOT NULL
    CHECK (contract_type IN ('low_voltage', 'high_voltage', 'extra_high_voltage')),
  base_rate       numeric(10,2) NOT NULL,       -- 基本料金（円/kW or 円/契約）
  unit_rate       numeric(6,4) NOT NULL,         -- 電力量料金（円/kWh）
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  valid_from      date NOT NULL,
  valid_to        date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE soil_kanden_plans IS
  '関電業務委託 料金プラン辞書。案件の plan_code 参照元';

-- 初期データ（サンプル、実運用時に admin が追加）
INSERT INTO soil_kanden_plans (plan_code, plan_name, contract_type, base_rate, unit_rate, valid_from) VALUES
  ('LV-STD-A', '低圧標準 A', 'low_voltage', 1200, 28.5, '2026-04-01'),
  ('LV-STD-B', '低圧標準 B', 'low_voltage', 1400, 27.0, '2026-04-01'),
  ('HV-BIZ-1', '高圧ビジネス 1', 'high_voltage', 1650, 18.5, '2026-04-01')
ON CONFLICT (plan_code) DO NOTHING;

COMMIT;
```

### 3.4 sync_log テーブル（Phase C-04 バッチ用）

```sql
-- supabase/migrations/20260501_04_soil_kanden_sync_log.sql
BEGIN;

CREATE TABLE soil_kanden_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_kind       text NOT NULL CHECK (sync_kind IN (
    'monthly_report',       -- 月次関電報告書
    'pd_sync',              -- Prodelight 同期
    'commission_calc',      -- 手数料計算
    'status_reminder'       -- ステータスリマインダ
  )),
  method          text NOT NULL CHECK (method IN ('cron_auto', 'manual', 'api_webhook')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  target_month    date,                      -- 対象月（YYYY-MM-01）
  processed_count int NOT NULL DEFAULT 0,
  success_count   int NOT NULL DEFAULT 0,
  error_count     int NOT NULL DEFAULT 0,
  skipped_count   int NOT NULL DEFAULT 0,
  error_summary   text,
  output_file_url text,                      -- 月次報告書の PDF/CSV URL
  executed_by     uuid REFERENCES auth.users(id),
  metadata        jsonb
);

CREATE INDEX soil_kanden_sync_log_kind_idx
  ON soil_kanden_sync_log (sync_kind, started_at DESC);

CREATE INDEX soil_kanden_sync_log_month_idx
  ON soil_kanden_sync_log (target_month DESC)
  WHERE target_month IS NOT NULL;

COMMIT;
```

---

## 4. RLS ポリシー（4 階層）

### 4.1 ロール階層

| ロール | garden_role | 閲覧範囲 | 編集範囲 |
|---|---|---|---|
| 営業 | cs / closer / toss | **自分の案件のみ** | 自分の案件の限定項目（sales_*, review_note） |
| 事務 | staff | **全案件** | **8 ステータス遷移 + 事務項目** |
| 管理者 | admin | 全案件 | **全項目 + 解約フラグ** |
| 全権 | super_admin | 全案件 | 全項目 + **削除** |

### 4.2 RLS ヘルパー関数

```sql
-- src/lib/leaf/helpers.sql（マイグレーション前段で定義）
CREATE OR REPLACE FUNCTION leaf_current_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT garden_role FROM root_employees WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION leaf_is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT leaf_current_role() IN ('admin', 'super_admin')
$$;

CREATE OR REPLACE FUNCTION leaf_is_office()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT leaf_current_role() IN ('staff', 'manager', 'admin', 'super_admin')
$$;

CREATE OR REPLACE FUNCTION leaf_is_sales()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT leaf_current_role() IN ('toss', 'closer', 'cs')
$$;

-- 案件の自分担当判定
CREATE OR REPLACE FUNCTION leaf_is_my_case(p_case_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(
    SELECT 1 FROM soil_kanden_cases c
    JOIN root_employees e ON e.employee_number = c.sales_employee_number
    WHERE c.case_id = p_case_id AND e.user_id = auth.uid()
  )
$$;
```

### 4.3 RLS ポリシー

```sql
-- supabase/migrations/20260501_05_soil_kanden_rls_phase_c.sql
BEGIN;

ALTER TABLE soil_kanden_cases ENABLE ROW LEVEL SECURITY;

-- SELECT: 営業は自分の案件、事務以上は全件
DROP POLICY IF EXISTS skc_select ON soil_kanden_cases;
CREATE POLICY skc_select ON soil_kanden_cases FOR SELECT
  USING (
    leaf_is_office()
    OR (leaf_is_sales() AND sales_employee_number = (
      SELECT employee_number FROM root_employees WHERE user_id = auth.uid()
    ))
  );

-- INSERT: staff 以上
DROP POLICY IF EXISTS skc_insert ON soil_kanden_cases;
CREATE POLICY skc_insert ON soil_kanden_cases FOR INSERT
  WITH CHECK (leaf_is_office());

-- UPDATE: 事務/admin/super_admin、ただし
--   staff は解約フラグ・削除系以外の列のみ（WITH CHECK で列制限するには Trigger 要）
DROP POLICY IF EXISTS skc_update_office ON soil_kanden_cases;
CREATE POLICY skc_update_office ON soil_kanden_cases FOR UPDATE
  USING (leaf_is_office())
  WITH CHECK (leaf_is_office());

-- 営業は自分の案件の限定列のみ（別 policy）
DROP POLICY IF EXISTS skc_update_sales ON soil_kanden_cases;
CREATE POLICY skc_update_sales ON soil_kanden_cases FOR UPDATE
  USING (
    leaf_is_sales() AND sales_employee_number = (
      SELECT employee_number FROM root_employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    leaf_is_sales() AND sales_employee_number = (
      SELECT employee_number FROM root_employees WHERE user_id = auth.uid()
    )
  );
-- 注: 列制限は Trigger で実装（WITH CHECK では列単位制限不可）

-- DELETE: super_admin のみ（cancellation_flag=true が前提）
DROP POLICY IF EXISTS skc_delete ON soil_kanden_cases;
CREATE POLICY skc_delete ON soil_kanden_cases FOR DELETE
  USING (leaf_current_role() = 'super_admin' AND cancellation_flag = true);

COMMIT;
```

### 4.4 列単位制限 Trigger（営業向け）

```sql
CREATE OR REPLACE FUNCTION leaf_restrict_sales_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  allowed_cols text[] := ARRAY['review_note', 'note', 'sw_target_month'];
  col_name text;
BEGIN
  IF leaf_is_sales() AND NOT leaf_is_office() THEN
    -- 営業は allowed_cols と自身識別列以外を変更してはいけない
    IF NEW.sales_employee_number IS DISTINCT FROM OLD.sales_employee_number
       OR NEW.cancellation_flag IS DISTINCT FROM OLD.cancellation_flag
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
    THEN
      RAISE EXCEPTION 'sales cannot modify this column';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leaf_restrict_sales_columns_trg
  BEFORE UPDATE ON soil_kanden_cases
  FOR EACH ROW
  EXECUTE FUNCTION leaf_restrict_sales_columns();
```

### 4.5 sync_log RLS

```sql
ALTER TABLE soil_kanden_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY sksl_read ON soil_kanden_sync_log FOR SELECT
  USING (leaf_is_office());
CREATE POLICY sksl_insert ON soil_kanden_sync_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);  -- service_role 経由は RLS バイパス
```

---

## 5. 既存データへの影響範囲

### 5.1 列追加の影響
- 新規列は `NULL` or デフォルト値で追加 → **既存行に影響なし**
- `cancellation_flag` は `DEFAULT false`、既存行は自動で `false` 設定
- 列追加 DDL は **数秒で完了**（PostgreSQL 11+ は instant ADD COLUMN）

### 5.2 RLS 変更の影響
- **既存の Phase B RLS を上書き**する（DROP POLICY IF EXISTS で安全）
- 本番での RLS 変更直後は**一時的に READ が制限される可能性** → 事務担当全員に `staff` 以上の garden_role が付与されているか事前確認

### 5.3 影響確認クエリ

```sql
-- Phase C 移行前に実行
SELECT COUNT(*) AS total_cases FROM soil_kanden_cases;
SELECT status, COUNT(*) FROM soil_kanden_cases GROUP BY status;

-- 営業員 → garden_role マッピング確認
SELECT e.employee_number, e.name, e.garden_role
  FROM root_employees e
  WHERE EXISTS (
    SELECT 1 FROM soil_kanden_cases c
    WHERE c.sales_employee_number = e.employee_number
  );
-- 想定: 全員 'toss' / 'closer' / 'cs' のいずれか。
-- 抜け漏れがあれば a-root に連絡して garden_role 設定依頼
```

---

## 6. 監査ログ連携

spec-cross-audit-log 準拠で、以下のイベントを `root_audit_log` に記録：

| イベント | severity | module | action |
|---|---|---|---|
| 案件 INSERT | info | leaf | create |
| status 遷移 | info | leaf | update |
| 解約フラグ ON | **warn** | leaf | cancel |
| 削除（super_admin）| **critical** | leaf | delete |
| commission_amount 変更 | warn | leaf | update |
| PD 同期失敗 | warn | leaf | sync_error |

Trigger 実装は Phase C-04 と並行（バッチ処理での発火も含むため）。

---

## 7. 実装ステップ

### W1: スキーマ追加（0.15d）
- [ ] migration 01 列追加
- [ ] migration 02 インデックス追加
- [ ] migration 03 soil_kanden_plans 投入
- [ ] migration 04 sync_log

### W2: RLS 設計（0.25d）
- [ ] ヘルパー関数 4 つ
- [ ] 4 policy（SELECT / INSERT / UPDATE office / UPDATE sales / DELETE）
- [ ] 列制限 Trigger

### W3: 既存データ影響確認（0.1d）
- [ ] 影響確認クエリ実行
- [ ] garden_role 抜け漏れ修正（必要あれば a-root へ依頼）
- [ ] 実行前 バックアップ（Supabase スナップショット）

### W4: 監査ログ Trigger（0.15d）
- [ ] status 遷移 Trigger
- [ ] 解約フラグ Trigger（severity=warn）
- [ ] 削除 Trigger（severity=critical）

### W5: 検証（0.1d）
- [ ] 営業ロールで SELECT → 自分の案件のみ
- [ ] 営業ロールで UPDATE status → 拒否（Trigger）
- [ ] 事務ロールで UPDATE status → 成功
- [ ] admin で DELETE（cancelled=true のみ）

---

## 8. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | `plan_code` を必須化するか | 現状 NULL 許容、Phase C 後半で NOT NULL 化検討 |
| 判2 | 契約電力（contract_kw）の単位 | kW（国内標準）、kVA は使わない |
| 判3 | 手数料率は案件別 vs プラン別 | **案件別**（同プラン内でも交渉余地あり）|
| 判4 | 解約後のデータ保持期間 | 永続（税務調査 7 年以上）、RLS で表示のみ制御 |
| 判5 | PD 同期のエラー履歴の jsonb 構造 | `[{ at, error_code, message }]` 配列で時系列保存 |
| 判6 | 営業員の案件アクセス範囲 | 自分のみ（manager の全員閲覧は Phase D 検討）|
| 判7 | 列制限 Trigger vs RLS WITH CHECK | Trigger 採用（WITH CHECK は列単位不可）|

---

## 9. 関連参照

- `src/app/leaf/_lib/types.ts`（`feature/leaf-kanden-supabase-connect`）
- `scripts/forest-schema*.sql` パターン参考
- **spec-cross-rls-audit §2**: 3 パターン規格化
- **spec-cross-audit-log §4**: 必須記録一覧

— end of C-01 —
