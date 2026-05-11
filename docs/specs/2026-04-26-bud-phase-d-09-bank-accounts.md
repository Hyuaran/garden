# Bud Phase D #09: 口座一覧（Kintone App 92 → Garden 口座分離設計）

- 対象: 給与振込先 + 外部支払先の口座マスタ分離設計
- 優先度: **🔴 高**（給与振込・外部支払の根幹）
- 見積: **0.75d**（テーブル設計 + RLS + queries + 既存 spec 連動）
- 担当セッション: a-bud
- 作成: 2026-04-26（Kintone 解析判断 #16 反映、a-main 006 確定）
- 前提:
  - **Kintone App 92（口座一覧）**: 全口座が 1 アプリに同居（給与口座 + 外部支払先）
  - **東海林判断 (2026-04-26)**: Garden 移行時は **2 テーブル分離**で運用
  - 関連 memory: `project_kintone_tokens_storage.md` / `feedback_kintone_app_reference_format.md`
- 関連 spec:
  - 既存 `2026-04-25-bud-phase-d-04-statement-distribution.md`（配信時の口座参照）
  - 既存 `2026-04-25-bud-phase-d-07-bank-transfer.md`（振込連携、本 spec の口座データを参照）

---

## 1. 目的とスコープ

### 1.1 目的

Kintone App 92（口座一覧）が「給与振込口座（全従業員）」「外部支払先（取引先 + 特殊扱い 10 名）」を同一アプリで管理しているのを、Garden では**用途別に 2 テーブル分離**する。
給与振込フローと外部支払フローが独立して運用でき、月単位での外部支払先の入れ替えに対応する。

### 1.2 含めるもの

- `employee_bank_accounts` テーブル設計（全従業員 1:1〜1:N、給与振込先）
- `payment_recipients` テーブル設計（外部支払先 + 特殊扱い 10 名、月単位）
- 月単位レコード対応（`payment_recipients.applies_month`）
- `employee_id` NULL 可（外部企業 / 個人で従業員以外）
- RLS（`payroll_calculator` / `admin` / `super_admin` 系）
- 既存口座データ（Kintone App 92）の migration 方針

### 1.3 含めないもの

- 振込実行ロジック → D-07
- 給与明細配信 → D-04
- 全銀協 FB データ生成 → D-07
- 外部支払の業務ルール（取引先マスタ運用）→ Phase A-1 A-04 既出（Bud transfers）

---

## 2. Kintone App 92 の現状分析

### 2.1 1 アプリで混在しているもの（Kintone）

| 種別 | 件数（東海林さん共有） | 備考 |
|---|---|---|
| 全従業員の給与振込口座 | 約 100 名 | 月不変、口座変更時のみ更新 |
| 外部企業の支払先（取引先） | 月変動 | 月毎に増減、A-04 vendor master 補完 |
| 特殊扱い 10 名（個人外部）| 月変動 | 給与扱いではない個人支払（例: フリーランス、紹介料） |

### 2.2 移行課題

1. 単一テーブルだと給与振込フィルタ毎回 WHERE 条件が増える
2. 月変動するレコードと不変レコードが同居 → 月次集計のキャッシュ・履歴管理が複雑
3. `employee_id` 列で「該当なし」を区別する設計が必要（NULL 可）

→ **2 テーブル分離**で解決（東海林確定 2026-04-26）

---

## 3. データモデル

### 3.1 `employee_bank_accounts`（給与振込口座、全従業員）

```sql
CREATE TABLE bud.employee_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES root.employees(id),

  -- 口座情報
  bank_code text NOT NULL,                    -- 4 桁
  bank_name text NOT NULL,                    -- 表示用、bank_code 由来
  branch_code text NOT NULL,                  -- 3 桁
  branch_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('普通', '当座', '貯蓄')),
  account_number text NOT NULL,               -- 7 桁
  account_holder_kana text NOT NULL,          -- 半角カナ（FB 互換）

  -- 状態
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL,               -- 適用開始日
  effective_to date,                          -- 適用終了日（NULL = 継続中）

  -- メタ
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES root.employees(id),

  -- 1 従業員 1 アクティブ口座のみ（履歴管理）
  CONSTRAINT uq_active_account_per_employee
    EXCLUDE USING gist (
      employee_id WITH =,
      daterange(effective_from, COALESCE(effective_to, 'infinity'::date)) WITH &&
    ) WHERE (is_active = true)
);

CREATE INDEX idx_eba_employee
  ON bud.employee_bank_accounts (employee_id, is_active);
CREATE INDEX idx_eba_effective
  ON bud.employee_bank_accounts (effective_from, effective_to)
  WHERE is_active = true;
```

**特徴:**
- `employee_id` は **NOT NULL**（必ず従業員に紐づく）
- 履歴管理: 口座変更時は旧レコード `effective_to` セット + 新レコード INSERT
- EXCLUDE 制約で 1 従業員 1 アクティブ口座を保証

### 3.2 `payment_recipients`（外部支払先 + 特殊扱い 10 名、月変動）

```sql
CREATE TABLE bud.payment_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES root.employees(id),  -- ★ NULL 可
  recipient_type text NOT NULL CHECK (recipient_type IN ('external_company', 'individual_special', 'employee_special')),
    -- external_company    = 外部企業（取引先、A-04 vendor 補完）
    -- individual_special  = 個人外部（フリーランス・紹介料等、employee_id NULL）
    -- employee_special    = 特殊扱い 10 名（従業員だが給与口座とは別、employee_id 必須）

  -- 識別
  recipient_name text NOT NULL,               -- 法人名 or 個人名
  recipient_name_kana text,                   -- カナ（FB 出力用）

  -- 口座情報（employee_bank_accounts と同構造）
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  branch_code text NOT NULL,
  branch_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('普通', '当座', '貯蓄')),
  account_number text NOT NULL,
  account_holder_kana text NOT NULL,

  -- 月単位レコード対応（東海林確定 2026-04-26）
  applies_month date,                         -- 月の 1 日（例: 2026-05-01）NULL = 通年
  amount bigint,                              -- 当該月の支払額（運用初期は手入力、将来自動算出）
  payment_purpose text,                       -- '紹介料', '業務委託費', '賃料', etc.

  -- 状態
  is_active boolean NOT NULL DEFAULT true,
  notes text,

  -- メタ
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES root.employees(id),

  -- 整合性
  CHECK (
    (recipient_type = 'external_company' AND employee_id IS NULL)
    OR (recipient_type = 'individual_special' AND employee_id IS NULL)
    OR (recipient_type = 'employee_special' AND employee_id IS NOT NULL)
  )
);

CREATE INDEX idx_pr_month
  ON bud.payment_recipients (applies_month, is_active);
CREATE INDEX idx_pr_employee_special
  ON bud.payment_recipients (employee_id, applies_month)
  WHERE recipient_type = 'employee_special';
CREATE INDEX idx_pr_type
  ON bud.payment_recipients (recipient_type, is_active);
```

**特徴:**
- `employee_id` **NULL 可**（recipient_type で整合性担保）
- `applies_month` で月単位レコード対応（同一支払先が複数月で別額の場合は別レコード）
- `recipient_type` で 3 種を区別、UNIQUE 制約は意図的に置かない（同月重複登録は admin 確認運用）

### 3.3 `view_bud_active_employee_accounts`（給与振込時の参照ビュー）

```sql
CREATE OR REPLACE VIEW bud.view_active_employee_accounts AS
SELECT
  e.id AS employee_id,
  e.employee_number,
  e.last_name || ' ' || e.first_name AS full_name,
  eba.bank_code,
  eba.bank_name,
  eba.branch_code,
  eba.branch_name,
  eba.account_type,
  eba.account_number,
  eba.account_holder_kana
FROM root.employees e
INNER JOIN bud.employee_bank_accounts eba
  ON eba.employee_id = e.id
  AND eba.is_active = true
  AND eba.effective_from <= CURRENT_DATE
  AND (eba.effective_to IS NULL OR eba.effective_to >= CURRENT_DATE)
WHERE e.is_active = true;
```

`prepareTransfer`（D-07）はこのビュー経由で振込先を取得。

---

## 4. RLS（#18 反映、payroll role 4 種）

```sql
ALTER TABLE bud.employee_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bud.payment_recipients ENABLE ROW LEVEL SECURITY;

-- SELECT: 本人 + payroll_* 系すべて
CREATE POLICY eba_select_self_or_payroll ON bud.employee_bank_accounts
  FOR SELECT USING (
    employee_id = (SELECT id FROM root.employees WHERE auth_user_id = auth.uid())
    OR has_payroll_role()       -- payroll_calculator / approver / disburser / auditor の OR
  );

-- INSERT / UPDATE: payroll_calculator + admin
CREATE POLICY eba_write_calculator ON bud.employee_bank_accounts
  FOR INSERT WITH CHECK (
    has_payroll_role(ARRAY['payroll_calculator'])
    OR is_admin_or_super_admin()
  );
CREATE POLICY eba_update_calculator ON bud.employee_bank_accounts
  FOR UPDATE USING (
    has_payroll_role(ARRAY['payroll_calculator'])
    OR is_admin_or_super_admin()
  );

-- DELETE: super_admin のみ（論理削除推奨、is_active = false で代替）
CREATE POLICY eba_delete_super_admin ON bud.employee_bank_accounts
  FOR DELETE USING (is_super_admin());

-- payment_recipients も同様の RLS（個人情報を含むため SELECT は payroll_* に限定）
CREATE POLICY pr_select_payroll ON bud.payment_recipients
  FOR SELECT USING (has_payroll_role());
CREATE POLICY pr_write_calculator ON bud.payment_recipients
  FOR INSERT WITH CHECK (
    has_payroll_role(ARRAY['payroll_calculator'])
    OR is_admin_or_super_admin()
  );
CREATE POLICY pr_update_calculator ON bud.payment_recipients
  FOR UPDATE USING (
    has_payroll_role(ARRAY['payroll_calculator'])
    OR is_admin_or_super_admin()
  );
CREATE POLICY pr_delete_super_admin ON bud.payment_recipients
  FOR DELETE USING (is_super_admin());
```

**ヘルパー関数（D-09 で先行実装、他 D-* spec から再利用）**:

```sql
CREATE OR REPLACE FUNCTION bud.has_payroll_role(roles text[] DEFAULT NULL)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM root.employee_payroll_roles epr
    WHERE epr.employee_id = (SELECT id FROM root.employees WHERE auth_user_id = auth.uid())
      AND epr.is_active = true
      AND (roles IS NULL OR epr.role = ANY(roles))
  );
$$;
```

---

## 5. Kintone → Garden migration 方針

### 5.1 移行タイミング

Phase 1 並行運用時に dual-write、Phase 2 で Kintone 読取専用化（#32 確定方針通り）。

### 5.2 マッピング

Kintone App 92 の各レコードを以下の判定で振り分け:

| Kintone レコード判定 | Garden 移行先 |
|---|---|
| `employee_no` あり + 給与振込目的 | `employee_bank_accounts` |
| `employee_no` あり + 給与外目的（特殊扱い 10 名） | `payment_recipients` (recipient_type='employee_special') |
| 法人名あり + employee_no なし | `payment_recipients` (recipient_type='external_company') |
| 個人名のみ | `payment_recipients` (recipient_type='individual_special') |

特殊扱い 10 名のリストは東海林さん別途共有（migration 着手時にヒアリング、handoff に追記）。

### 5.3 dual-write 期間中の同期

dual-write 1〜2 ヶ月は Kintone App 92 と Garden 両方を最新化。Kintone 側更新時は cron で Garden に upsert。
詳細は #32（Kintone 段階的解約）spec に記載予定。

---

## 6. 既存 spec 連動修正

### 6.1 D-04（給与明細配信）

`bud_payroll_notifications` の振込先参照を `employee_bank_accounts` に変更（旧 `bud_transfers.payee_*` 列直接ではなく、ビュー経由）。

### 6.2 D-07（銀行振込連携）

`prepareTransfer` 関数の対象抽出を `view_active_employee_accounts` 経由に変更。
外部支払先は `payment_recipients` から `applies_month` でフィルタして個別 transfer 作成。

### 6.3 A-04（既存振込新規作成、Phase 1b.2）

A-04 の `vendor` 概念は `payment_recipients.recipient_type='external_company'` に置き換え可能（Phase D 着手時に統合検討、現 Phase A-1 では併存）。

---

## 7. 受入基準

- [ ] `employee_bank_accounts` / `payment_recipients` migration 適用済
- [ ] EXCLUDE 制約で 1 従業員 1 アクティブ口座が保証される
- [ ] `payment_recipients.employee_id` NULL 許容で月単位レコードが INSERT 可能
- [ ] `view_active_employee_accounts` で当日有効な口座が取得できる
- [ ] RLS で本人以外の口座が見えない（payroll_* role を除く）
- [ ] D-07 `prepareTransfer` が新ビュー経由で動作
- [ ] D-04 配信時の振込先表示が新テーブル経由で動作
- [ ] Kintone App 92 dual-write 設計の概要が #32 spec で参照可能

---

## 8. 想定工数（内訳）

| W# | 作業 | 工数 |
|---|---|---|
| W1 | migration SQL（2 テーブル + ビュー + ヘルパー関数） | 0.2d |
| W2 | RLS ポリシー + payroll role ヘルパー | 0.1d |
| W3 | TypeScript types + queries（fetchActiveAccount / fetchRecipientsForMonth） | 0.15d |
| W4 | D-04 / D-07 の連動修正（spec 反映 + 実装変更） | 0.15d |
| W5 | Vitest（純関数 / RLS シナリオ） | 0.1d |
| W6 | dual-write スクリプト（Kintone → Garden）骨格 | 0.05d |
| **合計** | | **0.75d** |

---

## 9. 判断保留

| # | 論点 | a-bud スタンス |
|---|---|---|
| 判 1 | 特殊扱い 10 名のリスト確定 | 東海林さんから migration 着手時にヒアリング、別 handoff |
| 判 2 | `payment_recipients.applies_month` NULL の扱い | NULL = 通年継続支払（家賃等）と解釈、月単位は明示 |
| 判 3 | Kintone App 92 dual-write の cron 粒度 | 日次 1 回（早朝）で十分、より頻度上げる必要があれば再検討 |
| 判 4 | EXCLUDE 制約の btree_gist 拡張依存 | Supabase 標準で利用可、有効化必要 |
| 判 5 | `payment_recipients` の重複検出 | applies_month + bank_code + branch_code + account_number で UNIQUE INDEX 検討（Phase D 実装時） |

---

## 10. 関連ドキュメント / 確定根拠

- 確定ログ: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md` #16
- 添付資料: `C:\garden\_shared\attachments\20260426\` (Kintone App 92 構造の根拠)
- 関連 memory: `feedback_kintone_app_reference_format.md` / `project_kintone_tokens_storage.md`
