# Bud Phase D #11: MFC 互換 CSV 出力（72 列 / cp932 / 9 カテゴリ）

- 対象: マネーフォワードクラウド給与（MFC）への給与インポート CSV 生成
- 優先度: **🔴 最高**（給与確定の最終工程、MFC インポート前提）
- 見積: **1.5d**（テーブル + 72 列マッパー + Server Action + テスト）
- 担当セッション: a-bud
- 作成: 2026-04-26（Kintone 解析判断 #19 反映、a-main 006 確定）
- 前提:
  - **東海林判断 (2026-04-26)**: MFC CSV 仕様判明（72 列 / cp932 / 9 カテゴリ）
  - 関連 memory: `project_mfc_payroll_csv_format.md`（72 列定義の正本）
  - 添付資料: `C:\garden\_shared\attachments\20260426\MFC給与CSVサンプル_20260531支給.csv`
- 関連 spec:
  - D-10（給与計算統合）— `bud_payroll_records` を入力にする
  - D-09（口座分離）— 振込先参照
  - D-04（給与明細配信）— Storage パス uuid 化・admin only DL の同パターン採用

---

## 1. 目的とスコープ

### 1.1 目的

Garden で計算した給与結果を、MFC が要求する 72 列 CSV 仕様に変換して出力する。
MFC 側でインポートして給与確定 → 振込配信する運用フローを実現。

### 1.2 含めるもの

- `bud_mfc_csv_exports` テーブル設計（出力ログ）
- 72 列マッパー（`bud_payroll_records` → CSV 行）
- 9 カテゴリ別フィールド変換ロジック
- cp932 エンコーディング対応（Phase 1a の `iconv-lite` 流用）
- Storage `bud-mfc-csv-exports` バケット（uuid 化パス、admin only DL）
- 4 段階ステータス（draft / approved / exported / imported_to_mfc）
- 監査ログ（誰が・いつ出力 / DL したか）

### 1.3 含めないもの

- 給与計算本体 → D-10
- MFC 側でのインポート（Garden 外）
- 振込実行（D-07）
- 給与明細 PDF 配信（D-04）

---

## 2. 72 列仕様（memory `project_mfc_payroll_csv_format.md` 準拠）

### 2.1 全体仕様

- **エンコーディング**: `cp932`（Shift_JIS 系、Windows 標準）
- **列数**: 72
- **行数**: 従業員数 × 1（1 従業員 = 1 行）
- **改行コード**: CRLF（Windows）
- **数値形式**: 整数（円単位、桁区切りなし）/ 浮動小数（時間）

### 2.2 9 カテゴリ列構成

| カテゴリ | 列数 | 列範囲 | 内容 |
|---|---|---|---|
| 1. 識別 | 5 | 1-5 | Version / 従業員識別子 / 従業員番号 / 姓 / 名 |
| 2. 所属 | 4 | 6-9 | 事業所名 / 部門名 / 職種名 / 契約種別 |
| 3. 所定 | 5 | 10-14 | 所定労働時間・日数（当月 / 月平均） |
| 4. 勤怠（平日） | 11 | 15-25 | 出勤・欠勤・遅刻・早退・所定・残業・深夜・有休・研修・事務 |
| 5. 支給（月給） | 16 | 26-41 | 役員報酬 / 基本給 / 手当各種（残業・通勤・深夜・固定残業・有休・出張） |
| 6. 支給（時給） | 11 | 42-52 | 基本給 / **AP インセン** / 研修・事務手当 / 残業 / **社長賞インセン** / **件数インセン** / 通勤 |
| 7. 支給（日給） | 7 | 53-59 | 基本給 / 残業・深夜・休日手当 / 通勤 |
| 8. 控除 | 12 | 60-71 | 健保 / 介護 / 厚年 / 雇用 / 所得税 / 住民税 / **楽天早トク前払** / 社宅家賃 / 年調過不足 / その他 |
| 9. 備考 | 1 | 72 | 備考欄 |

**注意**: 完全な列名・順序は memory `project_mfc_payroll_csv_format.md` を**唯一の正本**として参照。本 spec では概要のみ記述、実装時は memory + サンプル CSV を 1:1 マッチ確認。

### 2.3 重要な設計ポイント

1. **3 形態混在**: 時給制 / 月給 / 日給を 1 CSV で対応。従業員ごとに該当形態の列のみ埋め、他列は空文字（`''`）。
2. **インセン項目（時給制）**: AP / 社長賞 / 件数 の 3 種は D-10 の計算結果から直接マップ。
3. **通勤手当の課税 / 非課税分離**: 給与・時給・日給すべての形態で分離管理（`commuting_taxable` / `commuting_non_taxable` 列）。
4. **楽天早トク前払**: 給与前払いサービス連携（控除項目）。Phase D で対応必要、当面は手入力 → 自動化は Phase E。

---

## 3. データモデル

### 3.1 `bud_mfc_csv_exports`（出力ログ）

```sql
CREATE TABLE bud.mfc_csv_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period date NOT NULL,                     -- 支給対象月
  pay_date date NOT NULL,                        -- 支給日
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid NOT NULL REFERENCES root.employees(id),
  generator_role text NOT NULL,                  -- payroll_calculator / disburser

  -- 集計（メタ情報）
  total_employees int NOT NULL,
  total_taxable_payment bigint NOT NULL,
  total_non_taxable_payment bigint NOT NULL,
  total_deduction bigint NOT NULL,

  -- Storage 情報（uuid 化パス、admin only DL）
  csv_storage_path text NOT NULL UNIQUE,         -- bud-mfc-csv-exports/{uuid}.csv
  csv_filename text NOT NULL,                    -- 表示用、e.g. mfc_20260531.csv
  csv_size_bytes int NOT NULL,
  csv_checksum text NOT NULL,                    -- SHA256（改ざん検知）

  -- ステータス（2026-04-26 [a-bud] 3 次 follow-up: 4 段階 → 6 段階に拡張、D-10 と整合）
  status text NOT NULL CHECK (status IN (
    'draft',                   -- CSV 生成済、未承認
    'approved',                -- payroll_approver 承認済（D-10 ② と同期）
    'exported',                -- payroll_disburser DL + MFC 取込実行（D-10 ③ と同期）
    'confirmed_by_auditor',    -- ④ payroll_auditor 目視確認完了 ⭐ NEW
    'confirmed_by_sharoshi',   -- ⑤ 社労士 OK 受領済 ⭐ NEW
    'imported_to_mfc'          -- ⑥ MFC 取込最終確認（旧 final、命名は D-11 互換維持）
  )),
  approved_at timestamptz,
  approved_by uuid REFERENCES root.employees(id),    -- payroll_approver
  exported_at timestamptz,                            -- DL + MFC 取込実行時刻
  exported_by uuid REFERENCES root.employees(id),     -- payroll_disburser
  confirmed_by_auditor_at timestamptz,                -- ④ 目視確認 ⭐ NEW
  confirmed_by_auditor_by uuid REFERENCES root.employees(id),
  sharoshi_request_sent_at timestamptz,               -- ⑤ 社労士確認依頼送信時刻 ⭐ NEW
  sharoshi_partner_id uuid REFERENCES root.partners(id),  -- 依頼先 root_partners ⭐ NEW
  confirmed_by_sharoshi_at timestamptz,               -- ⑤ 社労士 OK マーク ⭐ NEW
  confirmed_by_sharoshi_by uuid REFERENCES root.employees(id),
  sharoshi_confirmation_note text,                    -- 社労士返答内容
  imported_at timestamptz,                            -- ⑥ 最終 MFC 取込確認後に手動更新
  imported_by uuid REFERENCES root.employees(id),

  -- 監査
  download_count int NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,
  last_downloaded_by uuid REFERENCES root.employees(id),

  -- メタ
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_mfc_export_per_pay_date
    UNIQUE (pay_period, pay_date)
);

CREATE INDEX idx_mfc_csv_status ON bud.mfc_csv_exports (status, pay_period DESC);
CREATE INDEX idx_mfc_csv_period ON bud.mfc_csv_exports (pay_period DESC);
```

### 3.2 `bud_mfc_csv_export_items`（出力された各従業員行のスナップショット）

```sql
CREATE TABLE bud.mfc_csv_export_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id uuid NOT NULL REFERENCES bud.mfc_csv_exports(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES root.employees(id),
  payroll_record_id uuid NOT NULL REFERENCES bud.payroll_records(id),
  row_index int NOT NULL,                       -- CSV 内の行番号（1-based）
  csv_row_data jsonb NOT NULL,                  -- 72 列データのスナップショット
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_export_employee
    UNIQUE (export_id, employee_id),
  CONSTRAINT uq_export_row
    UNIQUE (export_id, row_index)
);

CREATE INDEX idx_mfc_items_employee ON bud.mfc_csv_export_items (employee_id, created_at DESC);
```

**意図**: CSV ファイルを再生成しなくても DB から内容を確認可能（監査・トラブル対応）。

---

## 4. 72 列マッパー

### 4.1 マッパーの責務

`bud_payroll_records` 1 行 + 周辺マスタ（root.employees / root.companies / root.salary_systems）から、72 列の値を生成する純関数。

```typescript
// src/lib/bud/mfc-csv/mapper.ts

export interface MfcCsvRow {
  version: string;
  employeeIdentifier: string;
  employeeNumber: string;
  lastName: string;
  firstName: string;
  // ... 72 列分の型定義（memory project_mfc_payroll_csv_format.md と完全一致）
}

export interface MfcMapperContext {
  payrollRecord: BudPayrollRecord;          // D-10 計算結果
  salaryRecord: BudSalaryRecord | null;     // D-02 法定計算結果
  employee: RootEmployee;
  company: RootCompany;
  salarySystem: RootSalarySystem;
  attendance: RootAttendance;
}

export function mapToMfcCsvRow(ctx: MfcMapperContext): MfcCsvRow {
  return {
    version: '1.0',                                     // 固定値
    employeeIdentifier: ctx.employee.mfc_internal_id,    // root.employees に列追加要
    employeeNumber: ctx.employee.employee_number,
    lastName: ctx.employee.last_name,
    firstName: ctx.employee.first_name,
    // 所属（4 列）
    officeName: ctx.company.office_name,
    departmentName: ctx.employee.department_name,
    jobTitle: ctx.employee.job_title,
    contractType: ctx.employee.contract_type,
    // 所定（5 列）
    dailyWorkingHours: ctx.salarySystem.daily_working_hours,
    monthlyWorkingDays: ctx.attendance.monthly_working_days,
    // ... 残り 63 列
  };
}
```

### 4.2 形態別の埋め方

```typescript
// 月給制 employee の場合: 時給列 / 日給列は空
if (ctx.salarySystem.payment_type === 'monthly') {
  // 列 26-41 (月給) を埋める
  // 列 42-52 (時給) は空文字
  // 列 53-59 (日給) は空文字
}

// 時給制 employee の場合: 月給列 / 日給列は空、インセン 3 種を埋める
if (ctx.salarySystem.payment_type === 'hourly') {
  // 列 42 基本給（時給）
  // 列 43 AP インセン = ctx.payrollRecord.ap_incentive
  // 列 47 社長賞インセン = ctx.payrollRecord.president_incentive
  // 列 48 件数インセン = ctx.payrollRecord.case_incentive
  // ...
}

// 日給制 employee の場合: 月給列 / 時給列は空
if (ctx.salarySystem.payment_type === 'daily') {
  // 列 53-59 を埋める
}
```

### 4.3 cp932 エンコーディング

```typescript
// src/lib/bud/mfc-csv/encoder.ts
import iconv from 'iconv-lite';

export function encodeCsvAsCp932(rows: MfcCsvRow[]): Buffer {
  const headerLine = MFC_CSV_COLUMN_NAMES.join(',');  // 72 列名（memory 参照）
  const dataLines = rows.map(row =>
    MFC_CSV_COLUMN_NAMES.map(colName => formatCell(row[colNameToKey(colName)])).join(',')
  );
  const csvText = [headerLine, ...dataLines].join('\r\n') + '\r\n';
  return iconv.encode(csvText, 'cp932');
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  // CSV エスケープ（カンマ・改行・ダブルクオートを含む場合は "" で囲む）
  const s = String(value);
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
```

---

## 5. Server Action 契約

```typescript
// src/lib/bud/mfc-csv/actions.ts

export async function generateMfcCsv(input: {
  payPeriod: string;            // YYYY-MM-01
  payDate: string;
  employeeIds?: string[];        // 未指定で全従業員
  dryRun?: boolean;              // true で Storage 保存なし
}): Promise<{
  exportId?: string;
  totalEmployees: number;
  totalTaxablePayment: number;
  totalDeduction: number;
  csvFilename?: string;
  csvSizeBytes?: number;
  warnings: Array<{ employeeId: string; message: string }>;
}>;

export async function approveMfcCsvExport(input: {
  exportId: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }>;

export async function downloadMfcCsv(input: {
  exportId: string;
}): Promise<{
  url: string;                  // 60 秒 signed URL（D-04 と同パターン）
  expiresAt: number;
}>;

export async function markAsImportedToMfc(input: {
  exportId: string;
}): Promise<{ success: boolean }>;
```

---

## 6. ステータス遷移（2026-04-26 [a-bud] 3 次 follow-up: 4 段階 → 6 段階に拡張、D-10 と整合）

```
draft（CSV 生成済、未承認）
  ↓ ① payroll_approver が "承認" ボタン押下（V6 自己承認禁止: generated_by != approver）
approved（承認済、ダウンロード可）
  ↓ ② payroll_disburser が "ダウンロード" + MFC 取込実行
exported（DL + MFC 取込実行済）
  ↓ ③ payroll_auditor（東海林さん）が "目視確認完了" ボタン押下
confirmed_by_auditor（目視 OK） ⭐ NEW 3 次 follow-up
  ↓ payroll_auditor が "社労士確認依頼" ボタン押下
  ↓     → Chatwork DM / メールで社労士（root_partners）へ確認依頼
  ↓ 社労士から OK 返答（外部経由、Garden ログイン不要）
  ↓ ④ payroll_auditor が Garden 上で "社労士確認済" マーク
confirmed_by_sharoshi（社労士 OK 受領済） ⭐ NEW 3 次 follow-up
  ↓ ⑤ payroll_auditor が "MFC 取込最終確認済" ボタン押下
imported_to_mfc（最終、変更不可）
```

差戻しは任意 stage → `draft`（再生成可、ただし `bud_mfc_csv_export_items` は履歴保持、reason 必須）。

特殊ケース:
- 社労士 NG → `confirmed_by_auditor` に巻き戻し（再目視 → 必要なら CSV 再生成 → MFC 再取込）
- D-10 `bud.payroll_records` と本テーブルは status 同期（同一 batch_id ベースで片方を更新したら他方も更新）

---

## 7. RLS（#18 反映、4 ロール、3 次 follow-up で 6 段階に拡張）

```sql
ALTER TABLE bud.mfc_csv_exports ENABLE ROW LEVEL SECURITY;

-- SELECT: payroll_* 全員
CREATE POLICY mfc_select ON bud.mfc_csv_exports FOR SELECT USING (has_payroll_role());

-- INSERT: payroll_calculator + disburser（generateMfcCsv 経由）
CREATE POLICY mfc_insert ON bud.mfc_csv_exports FOR INSERT WITH CHECK (
  has_payroll_role(ARRAY['payroll_calculator', 'payroll_disburser'])
);

-- ① draft → approved: payroll_approver（V6 自己承認禁止: generated_by != approver）
CREATE POLICY mfc_approve ON bud.mfc_csv_exports FOR UPDATE
  USING (
    status = 'draft'
    AND has_payroll_role(ARRAY['payroll_approver'])
    AND generated_by <> (SELECT id FROM root.employees WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (status = 'approved' AND has_payroll_role(ARRAY['payroll_approver']));

-- ② approved → exported: payroll_disburser（DL + MFC 取込実行）
CREATE POLICY mfc_export ON bud.mfc_csv_exports FOR UPDATE
  USING (status = 'approved' AND has_payroll_role(ARRAY['payroll_disburser']))
  WITH CHECK (status = 'exported' AND has_payroll_role(ARRAY['payroll_disburser']));

-- ③ exported → confirmed_by_auditor: payroll_auditor（目視確認）⭐ NEW
CREATE POLICY mfc_audit ON bud.mfc_csv_exports FOR UPDATE
  USING (status = 'exported' AND has_payroll_role(ARRAY['payroll_auditor']))
  WITH CHECK (status = 'confirmed_by_auditor' AND has_payroll_role(ARRAY['payroll_auditor']));

-- ④ confirmed_by_auditor → confirmed_by_sharoshi: payroll_auditor（社労士 OK 後マーク）⭐ NEW
-- 注: 社労士は Garden ログイン不要、東海林さんが Garden 上で代理マーク
CREATE POLICY mfc_sharoshi ON bud.mfc_csv_exports FOR UPDATE
  USING (status = 'confirmed_by_auditor' AND has_payroll_role(ARRAY['payroll_auditor']))
  WITH CHECK (
    status = 'confirmed_by_sharoshi'
    AND has_payroll_role(ARRAY['payroll_auditor'])
    AND sharoshi_request_sent_at IS NOT NULL
    AND sharoshi_partner_id IS NOT NULL
  );

-- ⑤ confirmed_by_sharoshi → imported_to_mfc: payroll_auditor（最終確認）⭐ NEW
CREATE POLICY mfc_finalize ON bud.mfc_csv_exports FOR UPDATE
  USING (status = 'confirmed_by_sharoshi' AND has_payroll_role(ARRAY['payroll_auditor']))
  WITH CHECK (status = 'imported_to_mfc' AND has_payroll_role(ARRAY['payroll_auditor']));

-- 巻き戻し: 任意 stage → draft（payroll_auditor が承認時のみ、reason 必須）
CREATE POLICY mfc_rollback ON bud.mfc_csv_exports FOR UPDATE
  USING (
    status IN ('approved', 'exported', 'confirmed_by_auditor', 'confirmed_by_sharoshi')
    AND has_payroll_role(ARRAY['payroll_auditor'])
  )
  WITH CHECK (status = 'draft' AND has_payroll_role(ARRAY['payroll_auditor']));

-- DELETE: 完全禁止
CREATE POLICY mfc_no_delete ON bud.mfc_csv_exports FOR DELETE USING (false);
```

---

## 8. Storage バケット設計

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bud-mfc-csv-exports', 'bud-mfc-csv-exports', false, 5 * 1024 * 1024,  -- 5MB 上限
  ARRAY['text/csv', 'application/vnd.ms-excel']);
```

### 8.1 Storage パスは uuid 化（D-04 と同パターン）

```
旧（推測可）: bud-mfc-csv-exports/2026-05/payroll.csv
新（uuid）: bud-mfc-csv-exports/{export_id}.csv
```

`bud_mfc_csv_exports.csv_storage_path` に **uuid を含むパス**を保存。
`csv_filename` は表示用のみ（実 Storage パスとは別）。

### 8.2 RLS

```sql
-- Storage 直接 SELECT は payroll_disburser + auditor + super_admin のみ
CREATE POLICY mfc_storage_select ON storage.objects FOR SELECT USING (
  bucket_id = 'bud-mfc-csv-exports'
  AND has_payroll_role(ARRAY['payroll_disburser', 'payroll_auditor'])
);

-- INSERT は service_role のみ（Server Action 経由）
-- DELETE 禁止（5 年保管、Cross Ops #05 準拠）
```

---

## 9. 監査ログ

### 9.1 記録対象

| イベント | ログ項目 |
|---|---|
| CSV 生成成功 | export_id / total_employees / total_taxable_payment / generated_by |
| CSV 生成失敗 | + error_reason / failed_employee_ids |
| 承認 | export_id / approver / approval_reason |
| ダウンロード | export_id / downloaded_by / ip / user_agent_redacted |
| MFC インポート確認 | export_id / imported_by / external_mfc_batch_id |

### 9.2 異常検知

- 同一 admin が 1 日 5 回以上 DL → 警告（情報持ち出し懸念、東海林さん通知）
- approve から export まで 30 日以上経過 → status='draft' に強制差戻し（陳腐化防止）

---

## 10. 受入基準

- [ ] `bud_mfc_csv_exports` / `bud_mfc_csv_export_items` migration 適用済
- [ ] Storage バケット `bud-mfc-csv-exports` 作成 + RLS（payroll_* 限定）
- [ ] 72 列マッパーの単体テスト（**全 72 列の値が memory 仕様と完全一致**）
- [ ] cp932 エンコーディング動作（サンプル CSV と byte 一致）
- [ ] 3 形態（月給 / 時給 / 日給）の混在 CSV 生成テスト
- [ ] インセン 3 種（AP / 件数 / 社長賞）が D-10 結果から正しくマップ
- [ ] **承認者 ≠ 生成者** の RLS 検証（V6 自己承認禁止と同等）
- [ ] 4 段階ステータス遷移の統合テスト
- [ ] サンプル CSV（`MFC給与CSVサンプル_20260531支給.csv`）と Garden 出力 CSV を**全列 byte 一致確認**
- [ ] MFC 側で Garden 出力 CSV をインポート成功（東海林さん実機テスト）

---

## 11. 想定工数（内訳）

| W# | 作業 | 工数 |
|---|---|---|
| W1 | migration（mfc_csv_exports / mfc_csv_export_items + Storage バケット + RLS） | 0.2d |
| W2 | 72 列定数定義 + 列名マッピング（memory から TypeScript 移植） | 0.15d |
| W3 | マッパー関数 + 単体テスト（全 72 列カバー） | 0.5d |
| W4 | cp932 エンコーダー + サンプル CSV byte 一致テスト | 0.15d |
| W5 | Server Action 4 種（generate / approve / download / markAsImported） | 0.25d |
| W6 | UI（生成画面 / 承認画面 / 出力履歴一覧、admin only） | 0.2d |
| W7 | 監査ログ + 異常検知 | 0.05d |
| **合計** | | **1.5d** |

---

## 12. 判断保留

| # | 論点 | a-bud スタンス |
|---|---|---|
| 判 1 | `mfc_internal_id` カラムの追加位置 | `root.employees` に列追加。Phase B-3 認証 spec 連動 |
| 判 2 | 楽天早トク前払の連携方法 | Phase D 初期は手入力（`bud_payroll_records.other_deduction` から流用）、自動連携は Phase E |
| 判 3 | 部門名・職種名の値ソース | `root.employees.department_id` + `root.departments` で参照、列名は memory 通り |
| 判 4 | 月給 / 時給 / 日給混在 CSV のソート順 | 従業員番号昇順（MFC 側仕様未明、サンプル CSV と一致確認） |
| 判 5 | dryRun モードの結果格納 | DB 書込なし、メモリ上で MfcCsvRow[] を返すのみ（テスト用途） |
| 判 6 | CSV 5 年保管の自動削除 | Cross Ops #05 準拠、archive バケットへ移動 → 7 年で物理削除 |

---

## 13. 関連ドキュメント / 確定根拠

- 確定ログ: `decisions-kintone-batch-20260426-a-main-006.md` #19
- **正本仕様**: memory `project_mfc_payroll_csv_format.md`（72 列定義、本 spec の唯一の参照源）
- 添付資料: `C:\garden\_shared\attachments\20260426\MFC給与CSVサンプル_20260531支給.csv`
- 関連 spec: D-09（口座分離）, D-10（給与計算統合）, D-04（配信、uuid パス + admin DL の同パターン）
- 関連 memory: `project_payslip_distribution_design.md`, `project_session_shared_attachments.md`
