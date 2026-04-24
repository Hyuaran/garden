# Bud Phase C-01: 年末調整スキーマ migration

- 対象: 年末調整を管理するテーブル 3 本の新設（年度 × 従業員単位、控除項目内訳、添付証明書）
- 優先度: **🔴 最高**（C-02〜C-06 全ての前提）
- 見積: **0.6d**
- 担当セッション: a-bud
- 作成: 2026-04-25（a-auto 002 / Batch 11 Bud Phase C #01）
- 前提:
  - Batch 6 Bud Phase B（B-01 salary-calc-engine、`bud_salary_records` 完成）
  - `root_employees`（社員マスタ、扶養家族・住所・銀行口座等）
  - spec-cross-rls-audit（Batch 7）
  - spec-cross-audit-log（Batch 7）
  - spec-cross-storage（Batch 7、Storage bucket 設計パターン）
  - spec-leaf-kanden-phase-c-01（列制限 Trigger・論理削除パターン踏襲）

---

## 1. 目的とスコープ

### 目的

毎年 11-12 月に実施する**年末調整業務を Garden 内で完結**させるためのテーブル設計。従業員ごと・年度ごとに 1 行のマスタ + 控除項目の内訳 + 添付証明書を保持する 3 テーブル構成。

### 含める

- 新設 3 テーブル（`bud_nenmatsu_chousei` / `bud_nenmatsu_chousei_items` / `bud_nenmatsu_chousei_files`）
- `root_employees` との FK と論理削除考慮
- 年度跨ぎ運用（1/1 で新年度開始、1-3 月までは前年度分の修正可）
- RLS ポリシー 4 階層（本人 / 事務 / manager / admin+）
- 列制限 Trigger（機密情報保護）
- 論理削除（`deleted_at`）必須
- 監査ログ連携

### 含めない

- 源泉徴収票データ（C-02）
- 支払調書（C-03）
- 法定調書合計表（C-04）
- UI（C-05）
- テスト戦略（C-06）

---

## 2. 既存実装との関係

### 2.1 Bud Phase A/B との接続

| 既存資産 | C-01 での利用 |
|---|---|
| `bud_salary_records`（B-01）| 給与支給額・源泉徴収税額の年間合計を算出 |
| `bud_furikomi_records`（A-03）| 振込実績から給与外支払を特定 |
| `root_employees.kou_otsu`（甲/乙）| 主勤務地判定、年末調整対象者抽出 |
| `root_employees.dependents_count`| 扶養人数（源泉徴収税額表ルックアップ用）|

### 2.2 Root との接続

- `root_employees.employee_number` を FK にした 1:1（年度 × 従業員）
- 退職者（`root_employees.deleted_at` 有）でも**中途退職者年末調整**対応のため参照可

### 2.3 Leaf Phase C との共通パターン

spec-leaf-kanden-phase-c-01 で確立した以下を踏襲:

- 列制限 Trigger（更新不可列を SQL で強制）
- 論理削除 `deleted_at`
- RLS の 4 階層設計
- Storage bucket + 添付管理パターン

---

## 3. データモデル: migration SQL

### 3.1 `bud_nenmatsu_chousei`（年度 × 従業員、1 行）

```sql
-- supabase/migrations/20261101_01_bud_nenmatsu_chousei.sql
BEGIN;

CREATE TABLE bud_nenmatsu_chousei (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本キー
  fiscal_year               int NOT NULL CHECK (fiscal_year BETWEEN 2020 AND 2100),
  employee_id               text NOT NULL REFERENCES root_employees(employee_number),

  -- ステータス
  status                    text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'submitted_by_employee',
                      'reviewed_by_staff', 'finalized', 'rejected')),
  submitted_at              timestamptz,   -- 従業員が提出した日時
  reviewed_at               timestamptz,   -- 事務が確認した日時
  finalized_at              timestamptz,   -- 確定日時（給与反映完了）

  -- 年末調整対象判定
  is_target                 boolean NOT NULL DEFAULT true,    -- 甲欄で対象者
  target_exclusion_reason   text,                              -- 対象外理由（中途退職 / 年間 2000 万超 等）

  -- 給与総額（自動集計）
  annual_gross_salary       bigint,                            -- 年間総支給額
  annual_withholding_tax    bigint,                            -- 年間源泉徴収税額
  annual_social_insurance   bigint,                            -- 年間社保料
  prev_job_gross_salary     bigint,                            -- 中途入社者の前職給与
  prev_job_withholding_tax  bigint,                            -- 前職源泉徴収額

  -- 扶養控除（配偶者・扶養親族）
  spouse_has                boolean NOT NULL DEFAULT false,
  spouse_income             bigint,                            -- 配偶者の所得
  dependents_general        int NOT NULL DEFAULT 0 CHECK (dependents_general >= 0),
  dependents_specific       int NOT NULL DEFAULT 0 CHECK (dependents_specific >= 0),   -- 特定扶養（16-22 歳）
  dependents_elderly        int NOT NULL DEFAULT 0 CHECK (dependents_elderly >= 0),    -- 老人扶養
  dependents_disabled       int NOT NULL DEFAULT 0 CHECK (dependents_disabled >= 0),

  -- 保険料控除・住宅ローン
  life_insurance_new        bigint,                            -- 新生命保険料
  life_insurance_old        bigint,                            -- 旧生命保険料
  life_insurance_care       bigint,                            -- 介護医療保険料
  pension_insurance_new     bigint,                            -- 新個人年金
  pension_insurance_old     bigint,                            -- 旧個人年金
  earthquake_insurance      bigint,                            -- 地震保険料
  house_loan_balance        bigint,                            -- 住宅ローン残高
  house_loan_deduction      bigint,                            -- 住宅ローン控除額

  -- iDeCo / 小規模企業共済
  ideco_amount              bigint,                            -- 年間掛金
  kibo_kyosai_amount        bigint,

  -- 計算結果（事務確定時に更新、Trigger 計算候補）
  total_income_deduction    bigint,                            -- 所得控除合計
  taxable_income            bigint,                            -- 課税所得
  calculated_tax            bigint,                            -- 算出税額
  adjustment_amount         bigint,                            -- 過不足額（+ 還付 / - 追加徴収）

  -- メタ
  note                      text,                              -- 事務メモ
  rejection_reason          text,                              -- 差戻理由
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_by                text REFERENCES root_employees(employee_number),
  updated_by                text REFERENCES root_employees(employee_number),
  deleted_at                timestamptz,

  CONSTRAINT uniq_year_employee UNIQUE (fiscal_year, employee_id)
);

CREATE INDEX idx_bnc_year_status ON bud_nenmatsu_chousei (fiscal_year, status);
CREATE INDEX idx_bnc_employee ON bud_nenmatsu_chousei (employee_id, fiscal_year DESC);
CREATE INDEX idx_bnc_active ON bud_nenmatsu_chousei (fiscal_year) WHERE deleted_at IS NULL;
```

### 3.2 `bud_nenmatsu_chousei_items`（控除項目の内訳）

```sql
CREATE TABLE bud_nenmatsu_chousei_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chousei_id        uuid NOT NULL REFERENCES bud_nenmatsu_chousei(id) ON DELETE CASCADE,

  category          text NOT NULL CHECK (category IN (
    'life_insurance_new', 'life_insurance_old', 'life_insurance_care',
    'pension_insurance_new', 'pension_insurance_old',
    'earthquake_insurance', 'earthquake_insurance_old',
    'ideco', 'kibo_kyosai', 'ssn', 'other'
  )),
  institution_name  text NOT NULL,                       -- 保険会社名等
  contract_number   text,                                 -- 証券番号
  amount            bigint NOT NULL CHECK (amount >= 0),
  currency_yen      boolean NOT NULL DEFAULT true,

  -- 保険契約詳細
  contract_start    date,
  contract_end      date,
  beneficiary       text,                                 -- 受取人氏名
  relationship      text,                                 -- 受取人続柄

  sort_order        int NOT NULL DEFAULT 0,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX idx_bnci_chousei_category ON bud_nenmatsu_chousei_items (chousei_id, category);
```

### 3.3 `bud_nenmatsu_chousei_files`（添付証明書）

```sql
CREATE TABLE bud_nenmatsu_chousei_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chousei_id        uuid NOT NULL REFERENCES bud_nenmatsu_chousei(id) ON DELETE CASCADE,
  item_id           uuid REFERENCES bud_nenmatsu_chousei_items(id) ON DELETE SET NULL,

  file_type         text NOT NULL CHECK (file_type IN (
    'life_insurance_cert',        -- 生命保険料控除証明書
    'pension_insurance_cert',     -- 個人年金控除証明書
    'earthquake_insurance_cert',  -- 地震保険料控除証明書
    'ideco_cert',                 -- iDeCo 掛金証明書
    'house_loan_cert',            -- 住宅ローン残高証明書
    'house_loan_initial_cert',    -- 住宅取得初年度の申告書
    'disability_cert',            -- 障害者手帳
    'dependent_income_cert',      -- 扶養家族の所得証明
    'prev_job_gensen',            -- 前職源泉徴収票
    'other'
  )),

  storage_key       text NOT NULL,       -- Storage bucket のパス
  original_filename text,
  mime_type         text,
  file_size_bytes   bigint,

  uploaded_by       text REFERENCES root_employees(employee_number),
  uploaded_at       timestamptz NOT NULL DEFAULT now(),

  -- 事務確認
  verified          boolean NOT NULL DEFAULT false,
  verified_by       text REFERENCES root_employees(employee_number),
  verified_at       timestamptz,
  rejection_reason  text,

  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX idx_bncf_chousei ON bud_nenmatsu_chousei_files (chousei_id);
CREATE INDEX idx_bncf_verified ON bud_nenmatsu_chousei_files (chousei_id) WHERE verified = false;
```

### 3.4 Storage bucket `bud-nenmatsu-files`

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('bud-nenmatsu-files', 'bud-nenmatsu-files', false);
```

path prefix:

```
bud-nenmatsu-files/
├── {fiscal_year}/
│   ├── {employee_id}/
│   │   ├── life_insurance_cert_20261120123045_abc.pdf
│   │   ├── house_loan_cert_20261125091230_xyz.pdf
│   │   └── ...
```

---

## 4. 列制限 Trigger

### 4.1 `bud_nenmatsu_chousei` の immutable 列

- `fiscal_year`・`employee_id` は INSERT 後 UPDATE 不可
- `finalized_at` が埋まった後は**全列ロック**（確定済レコードの改変禁止）

```sql
CREATE OR REPLACE FUNCTION trg_bnc_guard_immutable() RETURNS trigger AS $$
BEGIN
  -- キー列の immutable
  IF OLD.fiscal_year IS DISTINCT FROM NEW.fiscal_year THEN
    RAISE EXCEPTION 'fiscal_year is immutable';
  END IF;
  IF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
    RAISE EXCEPTION 'employee_id is immutable';
  END IF;

  -- 確定済は削除/差戻以外不可
  IF OLD.finalized_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    IF NEW.status != 'rejected' THEN
      RAISE EXCEPTION 'finalized record is locked (use rejection or admin unlock)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bnc_before_update
  BEFORE UPDATE ON bud_nenmatsu_chousei
  FOR EACH ROW EXECUTE FUNCTION trg_bnc_guard_immutable();
```

### 4.2 admin+ unlock の抜け穴

- admin/super_admin が `bud_nenmatsu_chousei.finalized_at = NULL` に reset できる SQL 関数 `nenmatsu_admin_unlock(id, reason)` を別途提供
- 実行時に監査ログ（§6）に記録

---

## 5. RLS ポリシー（4 階層）

spec-cross-rls-audit §4 のヘルパ関数を前提に：

### 5.1 `bud_nenmatsu_chousei`

```sql
ALTER TABLE bud_nenmatsu_chousei ENABLE ROW LEVEL SECURITY;

-- 本人: 自分の年末調整のみ SELECT/UPDATE（submitted_by_employee まで）
CREATE POLICY bnc_select_self ON bud_nenmatsu_chousei FOR SELECT
  USING (employee_id = auth_employee_number());

CREATE POLICY bnc_update_self_until_submit ON bud_nenmatsu_chousei FOR UPDATE
  USING (
    employee_id = auth_employee_number()
    AND status IN ('not_started', 'in_progress', 'rejected')
  )
  WITH CHECK (
    employee_id = auth_employee_number()
    AND status IN ('in_progress', 'submitted_by_employee')
  );

-- 事務 (staff): 全従業員の SELECT + reviewed_by_staff まで UPDATE
CREATE POLICY bnc_select_staff ON bud_nenmatsu_chousei FOR SELECT
  USING (has_role_at_least('staff'));

CREATE POLICY bnc_update_staff ON bud_nenmatsu_chousei FOR UPDATE
  USING (has_role_at_least('staff') AND status != 'finalized')
  WITH CHECK (has_role_at_least('staff'));

-- manager: staff と同等（§project_configurable_permission_policies 準拠、設定変更可能）
-- admin+: 全件 SELECT/UPDATE、finalized の unlock 可
CREATE POLICY bnc_all_admin ON bud_nenmatsu_chousei FOR ALL
  USING (has_role_at_least('admin'))
  WITH CHECK (has_role_at_least('admin'));

-- DELETE 直接禁止（deleted_at の UPDATE で代替）
```

### 5.2 `bud_nenmatsu_chousei_items` / `_files`

- 親 `chousei_id` の権限を継承
- Items: 本人 + staff+ が INSERT/UPDATE、admin+ が DELETE
- Files: 本人が INSERT、事務が verified、admin+ が削除

### 5.3 Storage RLS（`bud-nenmatsu-files` bucket）

```sql
-- 本人は自分の年度フォルダ配下にアップロード可
CREATE POLICY bnf_insert_self ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bud-nenmatsu-files'
    AND (storage.foldername(name))[2] = auth_employee_number()
  );

-- 読み取りは本人 + staff+
CREATE POLICY bnf_read_self_or_staff ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bud-nenmatsu-files'
    AND (
      (storage.foldername(name))[2] = auth_employee_number()
      OR has_role_at_least('staff')
    )
  );
```

### 5.4 機密列の RLS + View 分離

一般列（status / 扶養等）と**機密列**（住所 / 配偶者所得 / 障害者手帳番号）を分離：

- admin+ のみ SELECT 可能な `bud_nenmatsu_chousei_confidential` VIEW 新設
- 機密列は別テーブル `bud_nenmatsu_chousei_sensitive` に逃がす案も検討（§判断保留）

---

## 6. 監査ログ連携

spec-cross-audit-log の `audit_logs` テーブルに以下を INSERT:

| イベント | 発生契機 | データ |
|---|---|---|
| `bud.nenmatsu.start` | INSERT | `{ year, employee_id }` |
| `bud.nenmatsu.submit` | `status = submitted_by_employee` | `{ chousei_id, employee_id }` |
| `bud.nenmatsu.review` | `status = reviewed_by_staff` | `{ chousei_id, reviewed_by }` |
| `bud.nenmatsu.finalize` | `finalized_at` 設定 | `{ chousei_id, adjustment_amount }` |
| `bud.nenmatsu.reject` | `status = rejected` | `{ chousei_id, reason }` |
| `bud.nenmatsu.admin_unlock` | admin 関数 | `{ chousei_id, unlocked_by, reason }` |
| `bud.nenmatsu.file.upload` | INSERT files | `{ file_id, file_type }` |
| `bud.nenmatsu.file.verify` | `verified = true` | `{ file_id, verified_by }` |

---

## 7. 年度跨ぎ運用

### 7.1 年度切替タイミング

- 毎年 **11/1** に新年度レコード一括生成（Cron）
- 対象: `root_employees.deleted_at IS NULL` AND `kou_otsu = 甲`
- 既存在行は重複エラーとせず `ON CONFLICT DO NOTHING`

### 7.2 前年度分の修正可能期間

- 1/1 〜 3/15（確定申告期限まで）は前年度 `bud_nenmatsu_chousei` の修正可能
- 3/16 以降は**admin unlock 必須**（admin の責任下で開錠）

### 7.3 中途退職者

- `root_employees.deleted_at` 設定 → Cron が検出 → 年末調整対象外に切替
- ただし退職時の「年末調整済」扱いが必要なら `is_target = false` + `target_exclusion_reason = 'mid_year_resignation'` で個別処理

---

## 8. migration 順序

1. `20261101_01_bud_nenmatsu_chousei.sql`
2. `20261101_02_bud_nenmatsu_chousei_items.sql`
3. `20261101_03_bud_nenmatsu_chousei_files.sql`
4. `20261101_04_bud_nenmatsu_storage_bucket.sql`
5. `20261101_05_bud_nenmatsu_triggers.sql`（列制限 + 集計 Trigger）
6. `20261101_06_bud_nenmatsu_rls.sql`
7. `20261101_07_bud_nenmatsu_audit.sql`

各 migration は `BEGIN; ... COMMIT;`、rollback 用 `down.sql` 併設。

---

## 9. 性能見積

| 指標 | 目標 | 計算根拠 |
|---|---|---|
| 年度内の SELECT | < 100ms | 100 従業員 × `idx_bnc_year_status` |
| 1 件 INSERT + Trigger | < 50ms | 年 1 回の操作、大量ではない |
| 一覧表示（全従業員 × 当年度）| < 300ms | 100 行程度、index で高速 |
| 添付 SELECT（1 件）| < 200ms | 個別年度フォルダで絞り込み |

---

## 10. テスト観点（詳細は C-06）

- 年度跨ぎの正しい挙動（12/31 → 1/1 境界）
- RLS: 本人が他人の年末調整を見られないこと
- `finalized_at` 後の更新禁止（Trigger で弾かれる）
- admin_unlock 関数の動作と監査記録
- 機密列の VIEW 分離 / 一般列の RLS が両方効くこと
- Storage: 他人年度フォルダへのアップロード拒否
- 扶養家族 0 / 1 / 5 / 10 の境界値
- 住宅ローン控除あり / なし の分岐

---

## 11. 判断保留事項

- **判1: 機密列の分離方式**
  - 同一テーブルに列追加 + VIEW RLS / 別テーブル `_sensitive` / 列レベル暗号化
  - **推定スタンス**: VIEW RLS（最小変更）、将来暗号化は admin 設定で選択可
- **判2: 確定後の差戻**
  - 確定 → 差戻 が可能か（一度確定 = ロック なら不可）
  - **推定スタンス**: admin unlock 経由で可能、ただし監査必須（§6 記録）
- **判3: 年度レコードの事前生成**
  - 11/1 一括 or 従業員が開始時に逐次
  - **推定スタンス**: 11/1 Cron で事前生成（進捗ダッシュボードで「未着手」が可視化）
- **判4: 退職者の履歴保持期間**
  - 税法上の保持義務: 7 年
  - **推定スタンス**: 論理削除 + 7 年永続、7 年超で物理削除バッチ
- **判5: 前職源泉徴収票の取込方法**
  - OCR 自動 / 手入力
  - **推定スタンス**: Phase C-1 は手入力、OCR は Phase D で検討
- **判6: 住宅ローン控除の初年度と 2 年目以降の扱い**
  - 初年度は確定申告、2 年目以降は年末調整
  - **推定スタンス**: 2 年目以降のみ年末調整対応、初年度は個人確定申告（Garden 外）
- **判7: 配偶者特別控除の段階刻み**
  - 配偶者所得による控除額の細分化（2020 税制改正以降、9 段階）
  - **推定スタンス**: マスタテーブル `bud_tax_table_kaigu_tokubetsu` で柔軟化
- **判8: iDeCo 掛金の月次登録 vs 年末一括**
  - 月次登録なら給与計算で都度控除、年末一括なら年調のみ
  - **推定スタンス**: 月次登録優先、年末一括は従業員選択可
- **判9: 法改正への追随**
  - 毎年の税制改正対応（控除額・税率変更）
  - **推定スタンス**: マスタテーブル駆動で SQL 変更のみで対応、Bud Phase D で法改正適用 UI

---

## 12. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| migration SQL 7 本 + rollback | 2.5h |
| Trigger / VIEW 実装とテスト | 1.5h |
| RLS ポリシー + Storage bucket + policy | 1.0h |
| 年度切替 Cron / admin unlock 関数 | 1.0h |
| dev 環境での 3 往復 + seed データ | 1.0h |
| **合計** | **0.6d**（約 7h）|

---

— spec-bud-phase-c-01 end —
