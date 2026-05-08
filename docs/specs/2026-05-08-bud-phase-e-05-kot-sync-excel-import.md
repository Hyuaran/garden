# Bud Phase E #05: KoT 完全同期 + Excel 取込（D-01 + Root A-3-a 拡張）

- 対象: Garden-Bud Phase D-01 attendance schema + Root A-3-a kot_sync_log の同期拡張
- 優先度: **🟢 高**（毎月締め日の運用で必須、不正データは給与誤算定）
- 見積: **1.0d**
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-05-08（a-bud-002 / Phase E v1 #05）
- 前提:
  - Bud Phase D-01 勤怠取込スキーマ（bud_payroll_attendance_snapshots / overrides）
  - Root A-3-a KoT 同期（kot_sync_log、kot_employees、kot_attendance_daily）
  - KoT API（既存連携、API key + endpoint 仕様）
  - Excel ファイル取込（既存 xlsx-parser 等の利用検討）

---

## 1. 目的とスコープ

### 1.1 目的

KoT API を月次で完全同期し、欠損や API エラー時は **Excel 直接取込** でフォールバック。修正申請ワークフローで勤怠誤りを payroll_calculator が承認、不正な月締めを防ぐ。

### 1.2 含めるもの

- KoT 月次完全同期 cron（毎月 1 日 02:00 JST、前月分を全社員分一括）
- 同期失敗時のフォールバック: Excel 取込 UI（管理画面）
- 修正申請ワークフロー（従業員 → manager 承認 → snapshot 反映）
- 同期ステータスダッシュボード（admin / payroll_auditor）

### 1.3 含めないもの

- KoT API クライアント実装 → Root A-3-a で既存
- Excel ファイル形式の社内テンプレ → Phase E v2 候補（社内決定後）
- 勤怠承認フローの UI → Tree モジュール側で実装中（連携のみ）

---

## 2. KoT 完全同期 Cron

### 2.1 仕様

```
- 実行: 毎月 1 日 02:00 JST
- 対象: 前月（払込確定済の月）の全社員勤怠
- 処理:
  1. root_employees の全 active 従業員を取得（is_outsourced=false 除外）
  2. 各社員ごとに KoT API から前月勤怠を取得
  3. bud_payroll_attendance_snapshots に upsert（period_id 自動解決）
  4. kot_sync_log に 1 件記録（success / partial / failure）
  5. 失敗時: admin Chatwork 通知 + ダッシュボードに表示
- タイムアウト: Vercel Function 10 秒制限のため、バッチ分割（50 名 ÷ 5 並列 = 10 batch）
```

### 2.2 API: `/api/cron/bud-kot-monthly-sync`

```typescript
export async function GET(request: Request) {
  // Vercel Cron 認証
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const targetPeriod = getPreviousMonthPeriod();
  const employees = await fetchActiveEmployees(supabase);

  const results = await Promise.allSettled(
    employees.map((emp) => syncEmployeeAttendance(supabase, emp, targetPeriod)),
  );

  const success = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - success;

  // sync_log に集計記録
  await supabase.from('kot_sync_log').insert({
    sync_type: 'monthly_full',
    period_year: targetPeriod.year,
    period_month: targetPeriod.month,
    total_employees: employees.length,
    success_count: success,
    failed_count: failed,
    status: failed === 0 ? 'success' : (success > 0 ? 'partial' : 'failure'),
  });

  if (failed > 0) {
    await notifyAdmin(supabase, `KoT 月次同期で ${failed} 名失敗`);
  }

  return Response.json({ success, failed });
}
```

---

## 3. Excel 取込（フォールバック）

### 3.1 UI: `/bud/payroll/attendance-import`

- 対象: payroll_calculator + admin
- アップロードファイル: .xlsx（社内テンプレ準拠）
- バリデーション:
  - 1 行 1 名 1 日（社員番号 + 日付 + 出勤・退勤・休憩 etc.）
  - 必須列: employee_id (社員番号) / date / scheduled_minutes / actual_minutes
  - オプション列: overtime_minutes / late_night_minutes / holiday_working_minutes / absent_flag

### 3.2 純関数: parseAttendanceExcel

```typescript
// src/app/bud/payroll/_lib/attendance-excel-functions.ts

export interface AttendanceRowExcel {
  employeeNumber: string;
  date: string; // ISO YYYY-MM-DD
  scheduledMinutes: number;
  actualMinutes: number;
  overtimeMinutes?: number;
  lateNightMinutes?: number;
  holidayWorkingMinutes?: number;
  isAbsent?: boolean;
  notes?: string;
}

export interface ParseResult {
  rows: AttendanceRowExcel[];
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: Array<{ row: number; message: string }>;
}

/**
 * Excel buffer をパースして AttendanceRow[] に変換。
 *
 * - SheetJS（既存依存）または exceljs（既存）を利用
 * - ヘッダ行を検出（"社員番号" / "日付" / "実労働" 等の固定文言）
 * - 空セル → null / undefined
 * - 不正値 → errors に蓄積、行ごとにスキップ
 */
export function parseAttendanceExcel(
  buffer: ArrayBuffer,
  fiscalYear: number,
  month: number,
): ParseResult;

/**
 * Parsed row を bud_payroll_attendance_snapshots へ upsert する形式に変換。
 */
export function toSnapshotInsert(
  row: AttendanceRowExcel,
  employeeId: string,
  periodId: string,
): SnapshotInsert;
```

---

## 4. 修正申請ワークフロー

### 4.1 既存テーブル `bud_payroll_attendance_overrides`（D-01）の活用

D-01 で実装済の overrides テーブルを利用、本 spec で UI + workflow を追加。

```sql
-- D-01 既存（変更なし）
create table public.bud_payroll_attendance_overrides (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.bud_payroll_attendance_snapshots(id),
  field_name text not null,
  original_value text,
  new_value text,
  reason text not null check (length(reason) >= 5),
  approved_by uuid references public.root_employees(id),
  approved_at timestamptz not null default now(),
  audit_log_id uuid
);
```

### 4.2 申請フロー（state machine）

```
従業員（Tree マイページ等から申請）
   ↓ INSERT bud_attendance_correction_requests
manager（部署）が確認
   ↓ approve / reject
payroll_calculator（経理）が反映
   ↓ INSERT bud_payroll_attendance_overrides
   ↓ snapshot に応じて recalculate
```

### 4.3 新規テーブル: `bud_attendance_correction_requests`

```sql
create table public.bud_attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.root_employees(id),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),
  target_date date not null,
  field_name text not null
    check (field_name in (
      'actual_minutes',
      'overtime_minutes',
      'late_night_minutes',
      'holiday_working_minutes',
      'absent_flag'
    )),
  current_value text,
  requested_value text not null,
  reason text not null check (length(reason) >= 5),

  status text not null default 'pending'
    check (status in ('pending', 'manager_approved', 'rejected', 'reflected')),

  -- 承認チェーン
  manager_approved_by uuid references public.root_employees(id),
  manager_approved_at timestamptz,
  manager_comment text,

  -- 反映時
  reflected_at timestamptz,
  reflected_by uuid references public.root_employees(id),
  resulting_override_id uuid references public.bud_payroll_attendance_overrides(id),

  -- 却下時
  rejected_at timestamptz,
  rejected_by uuid references public.root_employees(id),
  rejected_reason text,

  created_at timestamptz not null default now(),
  created_by uuid references public.root_employees(id)
);

create index idx_bacr_employee_status on public.bud_attendance_correction_requests(employee_id, status);
create index idx_bacr_period on public.bud_attendance_correction_requests(payroll_period_id);
```

---

## 5. RLS

```sql
alter table public.bud_attendance_correction_requests enable row level security;

-- 自分の申請は閲覧 + 作成可
create policy bacr_select_own on public.bud_attendance_correction_requests
  for select using (
    employee_id = (select id from public.root_employees where user_id = auth.uid())
  );

create policy bacr_insert_own on public.bud_attendance_correction_requests
  for insert with check (
    employee_id = (select id from public.root_employees where user_id = auth.uid())
  );

-- manager は部署メンバーの申請を閲覧 + 承認
create policy bacr_select_manager on public.bud_attendance_correction_requests
  for select using (
    exists (
      select 1 from public.root_employees re
      where re.user_id = auth.uid()
        and re.garden_role in ('manager', 'admin', 'super_admin')
    )
  );

create policy bacr_update_manager on public.bud_attendance_correction_requests
  for update using (
    exists (
      select 1 from public.root_employees re
      where re.user_id = auth.uid()
        and re.garden_role in ('manager', 'admin', 'super_admin')
    )
  );

-- payroll_calculator は反映可
create policy bacr_update_calculator on public.bud_attendance_correction_requests
  for update using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

create policy bacr_no_delete on public.bud_attendance_correction_requests
  for delete using (false);
```

---

## 6. 法令対応チェックリスト

- [ ] 労基法 §32（法定労働時間、勤怠正確性）
- [ ] 労基法 §108 / §109（賃金台帳・労働者名簿の整備、5 年保管）
- [ ] 労働時間管理ガイドライン（厚労省）: 勤怠の自己申告 vs 客観記録
- [ ] 36 協定（時間外労働の上限規制）の遵守確認

---

## 7. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `/api/cron/bud-kot-monthly-sync` 実装 | a-bud | 1.5h |
| 2 | バッチ分割（並列度制御）+ リトライ | a-bud | 1h |
| 3 | Excel 取込 UI + parseAttendanceExcel | a-bud | 2h |
| 4 | bud_attendance_correction_requests migration + RLS | a-bud | 0.5h |
| 5 | 申請ワークフロー API（状態遷移）| a-bud | 1.5h |
| 6 | 同期ステータスダッシュボード（admin）| a-bud | 1h |
| 7 | 単体テスト（parseExcel + 状態遷移）| a-bud | 1h |
| 8 | 統合テスト（cron → snapshot 反映）| a-bud | 0.5h |

合計: 約 9h ≈ **1.0d**（妥当）

---

## 8. 判断保留事項

| # | 論点 | 起草スタンス |
|---|---|---|
| 判 1 | KoT 同期失敗時の自動リトライ | **3 回リトライ → 失敗時 admin 通知**、Excel 取込で手動対応 |
| 判 2 | Excel テンプレート | **東海林さん要決定**、社内既存テンプレ調査必要 |
| 判 3 | 修正申請の期限 | **当該月末から 5 営業日以内**、超過時は admin 個別判断 |
| 判 4 | 同期対象から除外する従業員 | **is_outsourced=true（業務委託）+ 退職済**、その他は自動同期 |
| 判 5 | 申請の自動反映 vs 手動 | **manager 承認 → payroll_calculator が手動反映**、自動反映なし（誤反映防止）|
| 判 6 | 36 協定上限到達者の警告 | **時間外 80h 超 → 警告、100h 超 → 申請ブロック**（労安衛法）|

---

## 9. 既知のリスクと対策

### 9.1 KoT API のレート制限

- 50 名同時取得で 429 エラー
- 対策: 並列度 5、バッチ間 1 秒間隔

### 9.2 Excel 形式の揺れ

- セルフォーマット（時刻 vs 数値 vs 文字列）が不統一
- 対策: parseExcel で 3 種類の入力形式を許容、warnings で記録

### 9.3 申請の二重反映

- 同じ申請が manager 承認 → payroll_calculator が 2 度反映
- 対策: status='reflected' チェック、UPDATE 制約で防止

### 9.4 時系列の不整合

- 修正申請が前々月分（既に給与確定済）に対して来た場合
- 対策: payroll_period.status='finalized' の場合は申請を拒否、admin 個別対応

### 9.5 KoT と Excel の重複

- 同じ日のデータが両ソースから来る
- 対策: snapshot は (employee_id, date) UNIQUE、後勝ち（updated_at で履歴管理）

---

## 10. 関連ドキュメント

- `docs/specs/2026-04-25-bud-phase-d-01-attendance-schema.md`
- `supabase/migrations/20260425000001_root_kot_sync_log.sql`
- KoT API 仕様書（社内）
- 厚労省「労働時間の適正な把握のために使用者が講ずべき措置に関するガイドライン」

---

## 11. 受入基準（Definition of Done）

- [ ] `/api/cron/bud-kot-monthly-sync` 実装 + Vercel Cron 設定
- [ ] バッチ分割で 50 名同期成功（Vercel timeout 内）
- [ ] Excel 取込 UI + parseAttendanceExcel 動作
- [ ] bud_attendance_correction_requests migration + RLS + 状態遷移 API
- [ ] manager 承認 → payroll_calculator 反映 フロー動作
- [ ] 同期ステータスダッシュボード表示
- [ ] 法令準拠（労基法 §32 / §108 / §109、36 協定）
- [ ] 単体 + 統合テスト 30+ tests pass
- [ ] エッジケース: KoT API 失敗 / Excel 不正 / 二重申請 / 月締め後申請 全 pass
