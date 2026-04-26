# Bud Phase D #12: 給与処理スケジュール + リマインダ通知システム

- 対象: 7 段階給与確定フロー（D-10 / D-11）の各 stage の予定日管理 + 自動リマインダ
- 優先度: **🟡 高**（業務継続性、放置防止、エスカレーション）
- 見積: **1.0d**（テーブル + Cron + Chatwork DM + Garden Toast 通知）
- 担当セッション: a-bud
- 作成: 2026-04-26（3 次 follow-up、東海林さん追加要件反映）
- 改訂:
  - 3 次 follow-up (2026-04-26): 6 段階フロー前提で新規起草
  - **4 次 follow-up (2026-04-26)**: **7 段階対応**（visual_double_check stage 追加 = 上田君目視ダブルチェック、Cat 4 #26）
- 前提:
  - **D-10 給与計算統合**（**7 段階**フローの stage 定義、4 次 follow-up）
  - **D-11 MFC CSV 出力**（exported / confirmed_by_auditor / **visual_double_checked** / confirmed_by_sharoshi 同期）
  - **D-09 口座分離**（`bud.has_payroll_role()` ヘルパー、5 ロール対応）
  - **D-01 給与期間**（`bud_payroll_periods` + `root_settings`）
  - 関連 memory: `feedback_check_existing_impl_before_discussion.md`, `project_partners_vs_vendors_distinction.md`, `project_payslip_distribution_design.md`（4 次反映）

---

## 1. 目的とスコープ

### 1.1 目的

**7 段階**給与確定フローは複数日にまたがる業務で、各 stage の担当者が異なる（上田 / 宮永・小泉 / 東海林さん / 社労士）。
各 stage の**予定日管理**と**自動リマインダ**を仕組み化し、業務放置 / 期日遅延を防止する。

> 4 次 follow-up（Cat 4 #26）で「上田君目視ダブルチェック工程」が正式に追加され、stage 数は 6 → 7 に増加。
> 後道さんは Garden 上の確認フローには登場しない。

### 1.2 含めるもの

- `bud_payroll_schedule` テーブル（stage 別予定日 / 実績日 / 担当 / status）
- admin 設定変更画面（`root_settings` 連動、相対日数計算）
- 日次 Cron（毎日 09:00 JST）で予定日チェック
- Chatwork DM + Garden Toast 通知（KPIHeader 既存通知センター連携）
- 重要度（critical / warning / info）+ エスカレーション（3 日 / 5 日）
- 社労士（root_partners）への外部通知（Chatwork DM or メール）

### 1.3 含めないもの

- 給与計算ロジック → D-10 / D-02 / D-03 / D-05
- MFC CSV 生成 → D-11
- Garden 内通知センター UI 実装 → Tree（KPIHeader 既存）or Bloom（通知ダッシュボード）
- メール送信ライブラリ選定 → D-04 §6.4 と共通

---

## 2. 7 段階フローと予定日の関係（4 次 follow-up: visual_double_check 追加）

### 2.1 stage ↔ 担当者 ↔ Garden ロール の対応表

| Stage | 担当者 | ロール | 予定日（period_end からの相対）| 備考 |
|---|---|---|---|---|
| `calculation` | 上田 | `payroll_calculator` | period_end + 2 営業日 | D-10 ① calculated 達成期限 |
| `approval` | 宮永・小泉 | `payroll_approver` | calculation + 1 営業日 | D-10 ② approved 達成期限 |
| `mfc_import` | 上田 | `payroll_disburser` | approval + 1 営業日 | D-11 ③ exported 達成期限（Cat 4 #27: 振込ファイル生成と同時）|
| `audit` | 東海林さん | `payroll_auditor` | mfc_import + 1 営業日 | D-10/11 ④ confirmed_by_auditor 達成期限 |
| **`visual_double_check`** ⭐ NEW 4 次 | **上田** | **`payroll_visual_checker`** | **audit + 1 営業日** | **D-10/11 ⑤ visual_double_checked 達成期限**（金額・氏名・口座 1 件ずつ目視）|
| `sharoshi_check` | 東海林さん（依頼）+ 社労士（外部） | `payroll_auditor` + `root_partners` | visual_double_check + 3 営業日 | D-10/11 ⑥ confirmed_by_sharoshi 達成期限 |
| `finalization` | 東海林さん | `payroll_auditor` | sharoshi_check + 1 営業日 | D-10/11 ⑦ finalized 達成期限（=振込実行）|

合計目安: period_end から **8-10 営業日**で給与確定（旧 7-9 営業日 + visual_double_check 1 営業日、4 次 follow-up）。

### 2.2 営業日カウント（既存 Phase 1a `business-day` ライブラリ流用）

`src/app/bud/transfers/_lib/business-day.ts` の `nextBusinessDay()` 関数を再利用。
週末スキップは既存実装で対応済、祝日対応は将来の拡張（Phase E）。

---

## 3. データモデル

### 3.1 `bud_payroll_schedule`（給与処理スケジュール）

```sql
CREATE TABLE bud.payroll_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES bud.payroll_periods(id) ON DELETE CASCADE,

  stage text NOT NULL CHECK (stage IN (
    'calculation',
    'approval',
    'mfc_import',
    'audit',
    'visual_double_check',   -- ⭐ NEW 4 次 follow-up: 上田君目視ダブルチェック
    'sharoshi_check',
    'finalization'
  )),

  -- 予定日 / 実績日
  planned_date date NOT NULL,                 -- 予定完了日（相対計算で初期セット）
  actual_date date,                            -- 実際の完了日（status='completed' 時に記録）

  -- 担当者
  assigned_to_employee_id uuid REFERENCES root.employees(id),
    -- root_employees。stage='sharoshi_check' 時は東海林さん（社労士への依頼担当）
  assigned_to_partner_id uuid REFERENCES root.partners(id),
    -- root_partners（社労士）。stage='sharoshi_check' 時のみ NOT NULL
    -- 社労士は Garden ログイン不要のため、依頼先情報のみ

  -- ステータス
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started',     -- 予定日未到達 or 着手前
    'in_progress',     -- 着手中（前段階完了 + 当該 stage 未完了）
    'completed',       -- 完了（D-10/11 status 同期）
    'overdue'          -- 予定日超過 + 未完了
  )),

  -- リマインダ送信履歴
  reminder_count int NOT NULL DEFAULT 0,
  last_reminder_sent_at timestamptz,
  escalation_level int NOT NULL DEFAULT 0,     -- 0=通常 / 1=東海林さん DM / 2=全社員通知

  -- メタ
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_schedule_per_period_stage
    UNIQUE (period_id, stage),
  CONSTRAINT chk_assigned_to_one
    CHECK (
      (assigned_to_employee_id IS NOT NULL AND assigned_to_partner_id IS NULL)
      OR (assigned_to_employee_id IS NOT NULL AND assigned_to_partner_id IS NOT NULL)
        -- sharoshi_check の場合のみ両方 NOT NULL（社労士 = partner、依頼担当 = 東海林さん）
      OR (assigned_to_employee_id IS NULL AND assigned_to_partner_id IS NULL)
        -- not_started かつ未確定の暫定状態
    )
);

CREATE INDEX idx_schedule_period ON bud.payroll_schedule (period_id, stage);
CREATE INDEX idx_schedule_overdue
  ON bud.payroll_schedule (planned_date, status)
  WHERE status IN ('not_started', 'in_progress');
```

### 3.2 `bud_payroll_schedule_settings`（admin 設定、root_settings 連動）

```sql
CREATE TABLE bud.payroll_schedule_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES root.companies(id),  -- NULL = 全法人共通、企業別の例外設定可

  -- 各 stage の予定日（period_end からの相対営業日数、4 次 follow-up: visual_double_check 追加）
  calculation_offset_days int NOT NULL DEFAULT 2,
  approval_offset_days int NOT NULL DEFAULT 1,         -- calculation 完了からの相対
  mfc_import_offset_days int NOT NULL DEFAULT 1,       -- approval 完了からの相対
  audit_offset_days int NOT NULL DEFAULT 1,            -- mfc_import 完了からの相対
  visual_double_check_offset_days int NOT NULL DEFAULT 1,  -- ⭐ NEW 4 次: audit 完了からの相対
  sharoshi_check_offset_days int NOT NULL DEFAULT 3,   -- visual_double_check 完了からの相対（4 次で繰下げ）
  finalization_offset_days int NOT NULL DEFAULT 1,     -- sharoshi_check 完了からの相対

  -- 担当者デフォルト（変更時のみ NULL 解除して上書き）
  default_calculator_id uuid REFERENCES root.employees(id),
  default_approver_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
    -- 複数の承認者（宮永・小泉、いずれか 1 名で承認 OK）
  default_disburser_id uuid REFERENCES root.employees(id),
  default_auditor_id uuid REFERENCES root.employees(id),
  default_visual_checker_id uuid REFERENCES root.employees(id),  -- ⭐ NEW 4 次: 通常 = 上田
  default_sharoshi_partner_id uuid REFERENCES root.partners(id),

  -- リマインダ閾値
  warn_after_hours int NOT NULL DEFAULT 24,            -- 24h 経過で warning
  critical_after_hours int NOT NULL DEFAULT 72,        -- 72h 経過で critical
  escalation_after_days int NOT NULL DEFAULT 3,        -- 3 日超過で東海林さん DM
  full_company_notify_after_days int NOT NULL DEFAULT 5, -- 5 日超過で全社員通知

  -- メタ
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES root.employees(id)
);

CREATE INDEX idx_schedule_settings_company
  ON bud.payroll_schedule_settings (company_id, effective_from DESC);
```

**root_settings 連動** (D-01 で導入された設定機構の延長):
- admin は `/bud/admin/payroll-schedule` 画面で各 stage の offset_days を変更可
- 変更時は `bud_payroll_schedule_settings` に新行 INSERT（`effective_from` で履歴管理）
- 設定変更は新規 `bud_payroll_periods` 作成時に反映（既存 period の schedule は不変）

### 3.3 `bud_payroll_reminder_log`（リマインダ送信履歴）

```sql
CREATE TABLE bud.payroll_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES bud.payroll_schedule(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),

  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  escalation_level int NOT NULL DEFAULT 0,

  -- 送信先
  notified_employee_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  notified_partner_id uuid REFERENCES root.partners(id),
    -- 社労士へ送信した場合のみ

  -- チャネル
  channel text NOT NULL CHECK (channel IN ('chatwork_dm', 'garden_toast', 'email', 'multi')),
  message_text text NOT NULL,
  external_message_ids jsonb,
    -- { "chatwork": "msg_xxx", "email_resend": "msg_yyy" }

  -- 結果
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'partial')),
  failed_reason text
);

CREATE INDEX idx_reminder_log_schedule ON bud.payroll_reminder_log (schedule_id, sent_at DESC);
```

---

## 4. リマインダ Cron 仕様

### 4.1 実行スケジュール

- **毎日 09:00 JST**（Vercel Cron `cron: "0 0 * * *"` UTC = 09:00 JST）
- Path: `/api/cron/bud-payroll-reminder`
- ランタイム: Node（Edge ではタイムアウト懸念）

### 4.2 処理ロジック

```typescript
// src/app/api/cron/bud-payroll-reminder/route.ts
export async function GET(req: Request) {
  // 1. 全 active period の schedule を取得（status != 'completed'）
  const overdueOrPending = await fetchOverdueOrPendingSchedules();

  // 2. 各 schedule に対して判定
  for (const sched of overdueOrPending) {
    const hoursOverdue = computeHoursOverdue(sched.planned_date);
    const settings = await fetchScheduleSettings(sched.period.company_id);

    // 重要度判定
    const severity = decideSeverity(hoursOverdue, settings);
    // 'info' (予定日到達直前 -24h)
    // 'warning' (予定日到達 〜 warn_after_hours)
    // 'critical' (warn_after_hours 〜 critical_after_hours)
    // 'critical' + escalation (critical_after_hours 超)

    // エスカレーション判定
    const escalation = decideEscalation(hoursOverdue, settings);
    // 0: 通常（担当者のみ）
    // 1: 担当者 + 東海林さん DM（escalation_after_days 超）
    // 2: 全社員通知（full_company_notify_after_days 超）

    // 通知対象決定
    const recipients = await resolveRecipients(sched, escalation);

    // メッセージ生成（stage 別テンプレ）
    const message = renderReminderMessage(sched, severity, escalation);

    // 送信（Chatwork DM + Garden Toast）
    const result = await sendReminderMulti(recipients, message);

    // ログ記録 + status 更新
    await logReminder(sched.id, severity, escalation, recipients, message, result);
    if (hoursOverdue > 0) {
      await updateScheduleStatus(sched.id, 'overdue');
    }
  }

  return Response.json({ ok: true, processed: overdueOrPending.length });
}
```

### 4.3 メッセージテンプレ（stage 別）

```typescript
const REMINDER_TEMPLATES = {
  calculation: {
    info: '{date} に給与計算開始予定です。{assignee} さん、準備をお願いします。',
    warning: '給与計算が予定日を {hours}h 超過しています。{assignee} さん、開始してください。',
    critical: '⚠️ 給与計算が {hours}h 遅延しています。早急な対応が必要です。{assignee} さん、よろしくお願いします。',
  },
  approval: {
    info: '本日 {date} は給与承認予定日です。{assignee} さん、内容確認をお願いします。',
    warning: '承認待ちが {hours}h 経過しています。{assignee} さん、確認してください。',
    critical: '🔴 承認待ちが {hours}h 経過。給与振込スケジュールに影響します。{assignee} さん、即対応をお願いします。',
  },
  mfc_import: {
    info: '本日 {date} は MFC 取込予定日です。{assignee} さん、CSV 生成と取込をお願いします。',
    warning: 'MFC 取込が {hours}h 遅延。{assignee} さん、実行してください。',
    critical: '🔴 MFC 取込が {hours}h 遅延。給与振込日に間に合わない可能性。',
  },
  audit: {
    info: '本日 {date} は給与目視確認予定日です。東海林さん、ご確認をお願いします。',
    warning: '目視確認待ちが {hours}h 経過。',
    critical: '🔴 目視確認が {hours}h 遅延。',
  },
  // ⭐ NEW 4 次 follow-up: 上田君目視ダブルチェック
  visual_double_check: {
    info: '本日 {date} は上田君の目視ダブルチェック予定日です。{assignee} さん、金額・氏名・口座を 1 件ずつご確認をお願いします（時間かかってもよいです）。',
    warning: '目視ダブルチェックが {hours}h 経過しています。{assignee} さん、ご対応をお願いします。',
    critical: '🔴 目視ダブルチェックが {hours}h 遅延。振込日に影響します。{assignee} さん、最優先でお願いします。',
  },
  sharoshi_check: {
    info: '社労士確認依頼の予定日です。東海林さん、{partner_name} へ確認依頼をお願いします。',
    warning: '社労士確認依頼から {hours}h 経過しています。{partner_name} への状況確認をご検討ください。',
    critical: '🔴 社労士確認待ちが {hours}h 経過。{partner_name} へ催促をお願いします。',
  },
  finalization: {
    info: '本日 {date} は給与確定予定日です。東海林さん、最終処理をお願いします。',
    warning: '給与確定が {hours}h 遅延。',
    critical: '🔴 給与確定が {hours}h 遅延。**振込日に影響大**。即対応必要。',
  },
};
```

### 4.4 エスカレーション 3 段階

| Level | トリガ | 通知先 |
|---|---|---|
| **0 通常** | 予定日到達 | stage 担当者のみ（DM + Toast）|
| **1 escalation** | 3 日超過 (`escalation_after_days`) | + 東海林さん（admin DM）|
| **2 critical-escalation** | 5 日超過 (`full_company_notify_after_days`) | + 全社員通知（Garden 内お知らせバナー）|

### 4.5 社労士への外部通知（stage='sharoshi_check'）

社労士は Garden ログイン不要のため、外部チャネル経由で通知:

```typescript
async function notifySharoshi(schedule: BudPayrollSchedule, severity: Severity) {
  const partner = await fetchPartner(schedule.assigned_to_partner_id);

  // 優先順: Chatwork DM → メール
  if (partner.contact_chatwork_id) {
    await sendChatworkDm(partner.contact_chatwork_id, message);
  } else if (partner.contact_email) {
    await sendEmail(partner.contact_email, subject, message);
  } else {
    // 代替: 東海林さんに「社労士コンタクト未登録」アラート
    await alertAdminUnregisteredPartner(partner.id);
  }
}
```

---

## 5. Server Action 契約

```typescript
// src/lib/bud/payroll-schedule/actions.ts

// 給与期間作成時に schedule 自動生成
export async function generateScheduleForPeriod(input: {
  periodId: string;
}): Promise<{
  scheduleIds: string[];     // 6 stage 分の schedule.id
  warnings?: string[];       // settings 未設定時の警告
}>;

// admin 設定変更
export async function updateScheduleSettings(input: {
  companyId?: string | null;
  settings: Partial<BudPayrollScheduleSettings>;
  effectiveFrom: string;
}): Promise<{ settingsId: string }>;

// 担当者再アサイン（現任者離脱時）
export async function reassignSchedule(input: {
  scheduleId: string;
  newAssigneeEmployeeId?: string;
  newAssigneePartnerId?: string;
  reason: string;
}): Promise<{ success: boolean }>;

// 手動リマインダ送信（即時通知）
export async function sendReminderManually(input: {
  scheduleId: string;
  severity?: 'info' | 'warning' | 'critical';
  customMessage?: string;
}): Promise<{ sentCount: number; failed: number }>;
```

---

## 6. RLS

```sql
ALTER TABLE bud.payroll_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bud.payroll_schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bud.payroll_reminder_log ENABLE ROW LEVEL SECURITY;

-- payroll_schedule: payroll_* 全員 SELECT、設定変更は payroll_auditor + admin
CREATE POLICY ps_select ON bud.payroll_schedule FOR SELECT USING (has_payroll_role());
CREATE POLICY ps_insert ON bud.payroll_schedule FOR INSERT WITH CHECK (
  has_payroll_role(ARRAY['payroll_calculator', 'payroll_auditor'])
);
CREATE POLICY ps_update ON bud.payroll_schedule FOR UPDATE USING (
  has_payroll_role()  -- assigned_to が UPDATE する想定（actual_date 記録等）
) WITH CHECK (has_payroll_role());

-- payroll_schedule_settings: payroll_auditor + admin のみ書込
CREATE POLICY pss_select ON bud.payroll_schedule_settings FOR SELECT USING (has_payroll_role());
CREATE POLICY pss_write ON bud.payroll_schedule_settings FOR INSERT WITH CHECK (
  has_payroll_role(ARRAY['payroll_auditor']) OR is_admin_or_super_admin()
);

-- payroll_reminder_log: 全員 SELECT（監査）、INSERT は service_role のみ（Cron 経由）
CREATE POLICY prl_select ON bud.payroll_reminder_log FOR SELECT USING (has_payroll_role());
CREATE POLICY prl_no_user_insert ON bud.payroll_reminder_log FOR INSERT WITH CHECK (false);

-- DELETE: 全テーブル禁止
CREATE POLICY ps_no_delete ON bud.payroll_schedule FOR DELETE USING (false);
CREATE POLICY pss_no_delete ON bud.payroll_schedule_settings FOR DELETE USING (false);
CREATE POLICY prl_no_delete ON bud.payroll_reminder_log FOR DELETE USING (false);
```

---

## 7. UI（admin 設定画面）

### 7.1 `/bud/admin/payroll-schedule`

```
┌─ 給与処理スケジュール設定 ──────────────────┐
│                                            │
│ 法人: [ 全法人共通 ▼ ]                      │
│                                            │
│ ── 各 stage の予定日（営業日 offset、4 次：7 stage）──│
│                                            │
│ ① 給与計算（period_end から）        [ 2 ] 営業日 │
│ ② 承認（calculation から）            [ 1 ] 営業日 │
│ ③ MFC 取込（approval から）           [ 1 ] 営業日 │
│ ④ 目視確認（mfc_import から）         [ 1 ] 営業日 │
│ ⑤ 上田目視ダブルチェック（audit から）⭐[ 1 ] 営業日 │
│ ⑥ 社労士確認（visual_double_check から）[ 3 ] 営業日 │
│ ⑦ 確定処理（sharoshi_check から）     [ 1 ] 営業日 │
│                                            │
│ 累計: period_end + 10 営業日（給与確定まで）│
│                                            │
│ ── 担当者デフォルト（4 次：5 ロール）─────  │
│                                            │
│ 計算者:    [ 上田 基人 ▼ ]                  │
│ 承認者:    [ ☑ 宮永 ☑ 小泉 ]                │
│ 出力者:    [ 上田 基人 ▼ ]                  │
│ 監査:      [ 東海林 ▼ ]                    │
│ 目視 Dチェック:[ 上田 基人 ▼ ] ⭐ NEW 4 次  │
│ 社労士:    [ ○○社労士事務所 ▼ root_partners] │
│                                            │
│ ── リマインダ閾値 ────────────────          │
│                                            │
│ Warning:   [ 24 ] h 経過で                  │
│ Critical:  [ 72 ] h 経過で                  │
│ 東海林 DM: [ 3 ] 日超過で                   │
│ 全社員通知:[ 5 ] 日超過で                   │
│                                            │
│ [ 保存 ]                                    │
└────────────────────────────────────────────┘
```

### 7.2 `/bud/admin/payroll-schedule/[periodId]`（個別期間の状況）

```
┌─ 2026年5月給与スケジュール ─────────────────┐
│ Period: 2026-05-01 〜 2026-05-31           │
│                                            │
│ ステージ                 予定      実績    状態 │
│ ① 計算                  06-02    06-02  ✅完了 │
│ ② 承認                  06-03    06-03  ✅完了 │
│ ③ MFC 取込              06-04    —     🟡進行 │
│ ④ 目視確認(東海林)       06-05    —     ⏳待機 │
│ ⑤ 目視Dチェック(上田)⭐  06-06    —     ⏳待機 │
│ ⑥ 社労士確認            06-11    —     ⏳待機 │
│ ⑦ 確定処理(振込実行)     06-12    —     ⏳待機 │
│                                            │
│ [ リマインダ手動送信 ] [ 担当者変更 ]       │
└────────────────────────────────────────────┘
```

---

## 8. 受入基準

- [ ] `bud_payroll_schedule` / `bud_payroll_schedule_settings` / `bud_payroll_reminder_log` migration 適用済（visual_double_check stage 含む）⭐ 4 次
- [ ] `generateScheduleForPeriod` で **7 stage** 分の schedule が自動生成 ⭐ 4 次
- [ ] 営業日 offset 計算が `business-day.ts` の `nextBusinessDay()` と整合
- [ ] 日次 Cron `/api/cron/bud-payroll-reminder` が 09:00 JST に実行
- [ ] 重要度判定（info / warning / critical）が `warn_after_hours` / `critical_after_hours` 通り動作
- [ ] エスカレーション 3 段階（通常 / +東海林さん / +全社員）が動作
- [ ] Chatwork DM 送信成功（D-04 §6.4 と同じ Chatwork API クライアント使用）
- [ ] Garden Toast 通知が KPIHeader 既存通知センターに表示
- [ ] 社労士への外部通知（Chatwork DM or メール）が動作
- [ ] `payroll_partner_id` 未登録時は東海林さんへアラート
- [ ] **visual_double_check stage の上田向けリマインダ**が `default_visual_checker_id`（上田）に届く ⭐ NEW 4 次
- [ ] **visual_double_check リマインダ文面**が「時間かかってもよい」「金額・氏名・口座を 1 件ずつ」のトーンで届く ⭐ NEW 4 次
- [ ] admin 設定画面で全項目変更可、新規 period から反映
- [ ] RLS で payroll_calculator が settings 変更不可

---

## 9. 想定工数（内訳）

| W# | 作業 | 工数 |
|---|---|---|
| W1 | migration（schedule / settings / reminder_log + **visual_double_check stage**）+ RLS | 0.15d |
| W2 | `generateScheduleForPeriod` + 営業日 offset 計算（**7 stage**） | 0.15d |
| W3 | リマインダ Cron（重要度判定 + エスカレーション、**7 stage 対応 + visual_double_check 文面**） | 0.3d |
| W4 | Chatwork DM + Garden Toast 通知連携 | 0.15d |
| W5 | 社労士外部通知（root_partners 連携、D-04 §6.4 流用） | 0.1d |
| W6 | admin 設定画面 + 個別期間状況画面（**7 stage 表示**） | 0.2d |
| **合計** | | **1.05d**（旧 1.0d + 4 次 0.05d）|

---

## 10. 判断保留

| # | 論点 | a-bud スタンス |
|---|---|---|
| 判 1 | 祝日対応（営業日カウント） | Phase D は週末スキップのみ、Phase E で `root.holidays` 参照 |
| 判 2 | 全社員通知の文面トーン | 5 日超過は緊急性高、東海林さん監修必須（実装時相談） |
| 判 3 | 社労士コンタクト情報の保管場所 | `root.partners.contact_*` フィールド、Root Phase B で詳細起票 |
| 判 4 | 複数承認者（宮永・小泉）の OR / AND | OR（いずれか 1 名で OK）が現運用、明示的に AND 指定機構は Phase E |
| 判 5 | リマインダ通知言語 | 日本語のみ（社労士・社員すべて日本語、英語版は Phase E）|
| 判 6 | 重要度判定の時間単位 | 営業時間（9-18h）のみカウント vs カレンダー時間 → 当面カレンダー時間（運用見ながら判断）|
| 判 7 | 緊急停止フラグ | `bud_payroll_periods.is_paused` で全 stage の Cron リマインダを一時停止可（年末年始等） |

---

## 11. 関連ドキュメント

- 確定根拠: `decisions-kintone-batch-20260426-a-main-006.md` + 3 次 follow-up 投下
- 関連 spec: D-10（給与計算統合）, D-11（MFC CSV 出力）, D-09（口座分離 / has_payroll_role 定義）, D-01（給与期間 / root_settings）
- 関連 memory:
  - `feedback_check_existing_impl_before_discussion.md`（実装前の現状確認）
  - `feedback_ui_first_then_postcheck_with_godo.md`（UI 完成後の後道さん確認）
  - `project_partners_vs_vendors_distinction.md`（社労士 = root_partners 外部取引先）
- 既存ライブラリ:
  - `src/app/bud/transfers/_lib/business-day.ts`（営業日カウント、Phase 1a で実装済み）
  - `src/app/bud/_actions/chatwork-notify.ts`（Chatwork API 呼出、D-04 §6.4 で実装）
