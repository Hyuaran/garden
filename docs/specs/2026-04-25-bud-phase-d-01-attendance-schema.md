# Bud Phase D #01: 勤怠取込スキーマ（給与計算インプット）

- 対象: Garden-Bud Phase D（給与処理）の入力データ層
- 優先度: **🔴 最高**（給与計算の起点、誤りは即金銭影響）
- 見積: **0.75d**（テーブル + 取込同期 + 整合性検査）
- 担当セッション: a-bud（実装）/ a-root（KoT 連携継続）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #01）
- 前提:
  - **Bud Phase B-01 給与計算エンジン**（設計済、Phase D で実装着手）
  - **Root A-3-d** `root_attendance_daily`（日次勤怠 KoT 同期、PR #42 マージ済）
  - **Root A-3-h** `root_employees.kou_otsu` / `dependents_count` / `deleted_at`（PR #46 マージ済）
  - `root_attendance`（月次勤怠、KoT 月次取込済）

---

## 1. 目的とスコープ

### 1.1 目的

給与計算が正しく動くために、**勤怠データを Bud 視点で確定させた状態で参照可能にする**ためのスキーマと取込同期を定義する。Root の KoT 同期データ（`root_attendance` / `root_attendance_daily`）を、給与締日基準で**Bud のスナップショットテーブルへ転記**し、計算結果の再現性を担保する。

### 1.2 含めるもの

- `bud_payroll_attendance_snapshots`（給与締日時点の勤怠スナップショット）
- `bud_payroll_periods`（給与計算期間の管理）
- KoT → root_attendance → bud_payroll_attendance_snapshots の同期フロー
- 締日確定後の勤怠変更検知と再計算トリガ
- 整合性検査（勤怠合計時間と就業規則の境界値）

### 1.3 含めないもの

- 給与計算ロジック自体 → D-02
- 賞与 → D-03
- 社保計算 → D-05
- KoT API 連携 → Root A-3-d（既実装）
- 勤怠 UI → Root（既実装）

---

## 2. 設計方針

### 2.1 「スナップショット」の必要性

- 給与計算時点の勤怠で再計算可能性を担保
- KoT は遡及修正可能（過去月の打刻訂正等）→ 一度 Bud で確定した値は固定
- 締日確定後の修正は **手動承認**で再計算

### 2.2 期間管理の分離（2026-04-26 [a-bud] 大幅修正）

> **改訂理由**: 元 a-auto 推奨「当月 21 日〜翌月 20 日（KoT 既存運用）」を東海林さん再判断で全面修正。
> 勤怠締めを月初〜月末に揃え、`root_settings` 化で柔軟な変更可能性を確保（admin が設定変更画面から再起動なしで変更可）。
> 確定根拠: `decisions-kintone-batch-20260426-a-main-006.md` + `spec-revision-followups-20260426.md` §2 #1

```
給与計算期間（bud_payroll_periods）
  ├─ 勤怠締め:    1 日 〜 月末（root_settings.kintai_period_start_day / end_day で可変）
  ├─ 締日確定:    月末締め後 + α 営業日（運用で決定、目安: 翌月 5-10 日）
  ├─ 給与支払:    翌月末 最終営業日（root_settings.payment_date_rule）
  ├─ 明細配信:    20-25 日ごろ（root_settings.statement_publish_target、運用決定次第確定）
  └─ 状態:        draft / locked / calculated / approved / paid
```

#### 期間管理の運用例（2026 年 5 月支給分）

| 工程 | 期間 / 日付 |
|---|---|
| 勤怠締め対象 | 2026-04-01 〜 2026-04-30 |
| 締日確定 | 2026-05-05 〜 2026-05-10 ごろ（運用次第）|
| 計算実行 | 締日確定後 |
| 承認 | 計算完了後 |
| **明細公開（マイページ）** | 2026-05-20 〜 2026-05-25 ごろ |
| **給与振込** | **2026-05-29（5 月最終営業日）** |

#### `root_settings` で柔軟設定（admin 画面から変更可）

| 設定キー | デフォルト | 説明 |
|---|---|---|
| `kintai_period_start_day` | `1` | 勤怠締め対象期間の開始日 |
| `kintai_period_end_day` | `31` | 同 終了日（`31` = 末日扱い、月により自動調整） |
| `payment_date_rule` | `'翌月末営業日'` | 支払日の決定ルール（自由文字列、Phase D 実装で enum 化検討） |
| `statement_publish_target` | `'20-25 日'` | 明細配信目安（Phase E で自動配信化、`'10 日'` 等にも変更可） |

設定変更時の挙動:
- 新規 `bud_payroll_periods` レコード生成時のみ反映（既存レコードは不変、履歴保護）
- 変更履歴は `root_settings_history` で追跡（Root Phase B 連携、別 spec）
- 設定変更は admin 権限必須、`payroll_calculator` のみでは変更不可

### 2.3 Root との役割分離

| 関心事 | Root（既存）| Bud（新規）|
|---|---|---|
| KoT API 取込 | ✅ | ✗ |
| 月次勤怠（root_attendance）| ✅ | 参照のみ |
| 日次勤怠（root_attendance_daily）| ✅ | 参照のみ |
| 給与締日のスナップショット | ✗ | **✅（本 spec）** |
| 給与期間定義 | ✗ | **✅** |

---

## 3. テーブル定義

### 3.1 `bud_payroll_periods`（給与計算期間）

```sql
CREATE TABLE public.bud_payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.root_companies(id),
  period_type text NOT NULL,           -- 'monthly' | 'bonus_summer' | 'bonus_winter' | 'final_settlement'
  start_date date NOT NULL,            -- 期間開始（2026-04-26 改訂例: 2026-04-01、root_settings.kintai_period_start_day から計算）
  end_date date NOT NULL,              -- 期間終了（例: 2026-04-30、月末日、root_settings.kintai_period_end_day から計算）
  cutoff_date date NOT NULL,           -- 締日確定日（例: 2026-05-08、月末 + α 営業日）
  payment_date date NOT NULL,          -- 支給日（例: 2026-05-29、翌月末最終営業日、root_settings.payment_date_rule から導出）
  statement_publish_target_date date,  -- 明細配信目安日（例: 2026-05-22、root_settings.statement_publish_target、NULL = 未設定）
  status text NOT NULL DEFAULT 'draft',
    -- 'draft'   = 期間定義のみ
    -- 'locked'  = 締日確定、勤怠スナップショット完了
    -- 'calculated' = 給与計算完了
    -- 'approved'   = 承認済（振込実行直前）
    -- 'paid'    = 振込実行済
  locked_at timestamptz,
  locked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  UNIQUE (company_id, period_type, end_date)
);

CREATE INDEX idx_bud_payroll_periods_status
  ON bud_payroll_periods (status, payment_date);
```

### 3.2 `bud_payroll_attendance_snapshots`（勤怠スナップショット）

```sql
CREATE TABLE public.bud_payroll_attendance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES public.bud_payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.root_employees(id),

  -- 出勤・労働時間（分単位、KoT に合わせる）
  working_days int NOT NULL DEFAULT 0,         -- 出勤日数
  scheduled_working_minutes int NOT NULL DEFAULT 0, -- 所定労働時間
  actual_working_minutes int NOT NULL DEFAULT 0,    -- 実労働時間
  overtime_minutes int NOT NULL DEFAULT 0,          -- 時間外（残業）
  late_night_minutes int NOT NULL DEFAULT 0,        -- 深夜（22:00〜5:00）
  holiday_working_minutes int NOT NULL DEFAULT 0,   -- 法定休日労働
  legal_overtime_minutes int NOT NULL DEFAULT 0,    -- 法定外休日労働

  -- 欠勤・控除
  absent_days int NOT NULL DEFAULT 0,
  late_count int NOT NULL DEFAULT 0,
  early_leave_count int NOT NULL DEFAULT 0,
  late_minutes_total int NOT NULL DEFAULT 0,
  early_leave_minutes_total int NOT NULL DEFAULT 0,

  -- 有給
  paid_leave_days numeric(4, 2) NOT NULL DEFAULT 0,  -- 半休 0.5 日 単位許容
  paid_leave_remaining numeric(4, 2),                -- スナップショット時点の残

  -- ソース追跡
  source_root_attendance_id uuid REFERENCES public.root_attendance(id),
  source_synced_at timestamptz NOT NULL,

  -- メタ
  is_locked boolean NOT NULL DEFAULT false,    -- locked 後の修正は別フローで
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (payroll_period_id, employee_id)
);

CREATE INDEX idx_bud_payroll_snapshots_period
  ON bud_payroll_attendance_snapshots (payroll_period_id);
CREATE INDEX idx_bud_payroll_snapshots_employee
  ON bud_payroll_attendance_snapshots (employee_id);
```

### 3.3 `bud_payroll_attendance_overrides`（締日後の手動修正）

```sql
CREATE TABLE public.bud_payroll_attendance_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.bud_payroll_attendance_snapshots(id),
  changed_field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text NOT NULL,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  audit_log_id uuid                  -- operation_logs.id
);
```

---

## 4. 取込同期フロー

### 4.1 全体図

```
KoT 月次同期（既存 Cron）
  ↓
root_attendance（既存）
  ↓
締日到来 → /api/cron/bud-attendance-snapshot 実行
  ↓
bud_payroll_attendance_snapshots に転記
  ↓
period.status = 'locked'
  ↓
（D-02 給与計算へ）
```

### 4.2 締日確定 Cron

```typescript
// src/app/api/cron/bud-payroll-lock/route.ts
// 毎日 02:00 JST、cutoff_date 到来期間を一括処理

export async function GET() {
  const targets = await fetchPeriodsToLock();  // status=draft AND cutoff_date <= today
  for (const period of targets) {
    await runInTrx(async () => {
      await snapshotAttendance(period);        // root_attendance → bud_snapshots
      await markPeriodLocked(period.id);
      await recordMonitoringEvent({
        module: 'bud',
        category: 'payroll_period_locked',
        severity: 'low',
        source: '/api/cron/bud-payroll-lock',
        message: `${period.company_id} の ${period.end_date} 期間を締日確定`,
      });
    });
  }
  return Response.json({ ok: true, locked: targets.length });
}
```

### 4.3 締日後の修正フロー

```
manager+ がスナップショット修正画面で値変更
  ↓
変更前後の値 + 理由を入力
  ↓
admin+ 承認
  ↓
bud_payroll_attendance_overrides に記録
  ↓
bud_payroll_attendance_snapshots を UPDATE
  ↓
（既に給与計算済なら）再計算トリガ → D-02
```

---

## 5. 整合性検査

### 5.1 取込時の自動検査

```sql
-- working_days と所定労働時間の整合性
SELECT * FROM bud_payroll_attendance_snapshots
WHERE working_days * 8 * 60 < scheduled_working_minutes - 60
  OR working_days * 8 * 60 > scheduled_working_minutes + 60;
-- → 1 時間以上の差分は警告

-- overtime_minutes が 1 ヶ月 80h 超（過労死ライン）
SELECT * FROM bud_payroll_attendance_snapshots
WHERE overtime_minutes > 80 * 60;
-- → 警告 + 該当 employee に追加確認

-- holiday_working_minutes が出勤日数を超える
SELECT * FROM bud_payroll_attendance_snapshots
WHERE holiday_working_minutes > working_days * 24 * 60;
-- → エラー、取込中止
```

### 5.2 警告レベル

| 検査項目 | レベル | 対応 |
|---|---|---|
| 1h 以上の所定 vs 実労働乖離 | 🟡 警告 | snapshot 作成、レビュー必須 |
| 月 80h 超の残業 | 🟡 警告 | snapshot 作成、HR 確認 |
| 月 100h 超の残業 | 🔴 重大 | snapshot 一時保留、確認後に locked |
| 出勤日数 > 暦日数 | 🔴 エラー | 取込中止、KoT 側修正依頼 |
| 欠勤日数 + 出勤日数 + 有給 > 暦日数 | 🔴 エラー | 取込中止 |

---

## 6. RLS ポリシー

### 6.1 SELECT

```sql
-- 自分の snapshot は閲覧可
CREATE POLICY snapshot_select_own
  ON bud_payroll_attendance_snapshots FOR SELECT
  USING (
    employee_id = (SELECT id FROM root_employees WHERE user_id = auth.uid())
  );

-- manager+ は自部門
CREATE POLICY snapshot_select_manager_dept
  ON bud_payroll_attendance_snapshots FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid()) = 'manager'
    AND employee_id IN (
      SELECT id FROM root_employees
      WHERE department_id = (
        SELECT department_id FROM root_employees WHERE user_id = auth.uid()
      )
    )
  );

-- admin+ は全件
CREATE POLICY snapshot_select_admin
  ON bud_payroll_attendance_snapshots FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('admin', 'super_admin')
  );
```

### 6.2 INSERT / UPDATE

- INSERT は service_role（Cron 経由）のみ
- UPDATE は admin+ のみ + override 経由

### 6.3 DELETE

- 完全禁止（横断削除パターン #07 準拠）
- 期間自体を `deleted_at` 設定で論理削除可能

---

## 7. 法令対応チェックリスト

### 7.1 労働基準法

- [ ] 第 32 条: 1 日 8h / 週 40h を超える労働時間の捕捉（overtime_minutes）
- [ ] 第 35 条: 法定休日労働の区分（holiday_working_minutes / legal_overtime_minutes）
- [ ] 第 37 条: 深夜労働 22:00〜5:00 の区分（late_night_minutes）
- [ ] 第 39 条: 有給休暇の付与残高管理（paid_leave_remaining）
- [ ] 第 109 条: 賃金台帳の保管 5 年（→ Cross Ops #05）

### 7.2 健康保険法

- [ ] 出勤日数の正確性（社保標準報酬月額の算定基礎）

---

## 8. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `bud_payroll_periods` migration | a-bud | 0.5h |
| 2 | `bud_payroll_attendance_snapshots` migration | a-bud | 0.5h |
| 3 | `bud_payroll_attendance_overrides` migration | a-bud | 0.25h |
| 4 | RLS ポリシー全テーブル | a-bud | 1h |
| 5 | 締日確定 Cron 実装 | a-bud | 1.5h |
| 6 | 整合性検査関数 | a-bud | 1h |
| 7 | 締日後修正フロー UI（admin 用）| a-bud | 1.5h |
| 8 | 単体・統合テスト | a-bud | 1.5h |

合計: 約 7.75h ≈ **0.75d**

---

## 9. 判断保留事項

| # | 論点 | スタンス |
|---|---|---|
| 判 1 | 給与期間の開始日 | ~~当月 21 日 〜 翌月 20 日（KoT 既存運用）~~ → **🎯 東海林確定 (2026-04-26)**: 勤怠締め=**1 日 〜 月末** / 給与支払=**翌月末営業日** / 明細配信=**20-25 日**。`root_settings` 化で柔軟設定（admin が再起動なしで変更可、§2.2 参照） |
| 判 2 | 法人ごとの期間定義の差 | **法人ごとに自由設定**（`bud_payroll_periods.company_id` で分離）。判 1 確定後も法人別 `root_settings` で個別調整可 |
| 判 3 | 締日後修正の承認権限 | **payroll_approver+ で最終承認**（#18 反映）、`payroll_calculator` で起票 |
| 判 4 | 月 100h 超残業の取込 | **一時保留 + HR 確認後 unlock**（過労死ライン警戒）|
| 判 5 | 有給残高の管理場所 | **Bud 側のスナップショットにコピー**、Root 側もマスタ管理 |
| 判 6 | KoT 不要日の扱い（祝日等）| **scheduled_working_minutes でゼロ化**、所定労働時間は 0 |
| 判 7 | `root_settings` の変更履歴管理 | **`root_settings_history` で追跡**（Root Phase B 連携、別 spec で起票予定）。Bud 側は read-only |
| 判 8 | 明細配信目安 20-25 日 → 自動配信化 | Phase D 初期は手動公開（admin が "公開" ボタン押下）、Phase E で `root_settings.statement_publish_target` ベースの自動 Cron 化 |

---

## 10. 既知のリスクと対策

### 10.1 KoT 同期の遅延

- KoT API が落ちて当月分が未取込のまま締日到来
- 対策: 締日 Cron は KoT 同期成功確認後のみ実行、未取込ならアラート（Cross Ops #01）

### 10.2 法人別の締日が異なる

- 子会社 A は 20 日締、子会社 B は末日締
- 対策: `bud_payroll_periods.company_id` で完全分離、UI でも company 切替

### 10.3 期間オーバーラップ

- 同 employee × 同月で 2 つの period に紐付く誤運用
- 対策: UNIQUE 制約 + アプリ側の事前チェック

### 10.4 過去期間の誤再計算

- 2 ヶ月前の期間を誤って再 lock → 給与の二重支給リスク
- 対策: status=`paid` 後の lock 解除は super_admin のみ + 警告モーダル

### 10.5 KoT 側の遡及修正

- 1 ヶ月前の打刻訂正が KoT 側で発生
- 対策: スナップショット作成後の遡及は `bud_payroll_attendance_overrides` 経由のみ反映

### 10.6 退職者の月次扱い

- 月途中退職で working_days が極端に少ない
- 対策: snapshot 作成時に `root_employees.deleted_at` をチェック、退職者フラグを付与

---

## 11. 関連ドキュメント

- `docs/specs/2026-04-24-bud-b-01-salary-calc-engine.md`
- `docs/specs/2026-04-24-root-a3d-daily-workings-sync.md`
- `docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md`（後続）
- `docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md`
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`（5 年保管）

---

## 12. 受入基準（Definition of Done）

- [ ] `bud_payroll_periods` / `_snapshots` / `_overrides` migration 適用済
- [ ] RLS ポリシー全テーブル適用済（テスト pass）
- [ ] 締日確定 Cron が稼働、KoT 未取込時に skip + 警告
- [ ] 整合性検査が dev で動作、警告 / エラー区分が機能
- [ ] 締日後修正フロー（manager 起票 → admin 承認）が動作
- [ ] 監査ログ（operation_logs / audit）に締日確定が記録
- [ ] 退職者の snapshot 作成時に flag 付与
- [ ] 単体 + 統合テスト pass
- [ ] Bud CLAUDE.md に Phase D 勤怠セクション追記

---

## ⚙️ Kintone 解析判断 #18 + #25 反映 (2026-04-26)

> a-main 006 確定の 32 件のうち、本 spec に直接影響する 2 件を末尾追記。
> 確定ログ: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`

### #18 給与計算権限境界（4 ロール）

本 spec の RLS / role 列挙に以下 4 ロールを追加：

| ロール | 担当 | 主な権限 |
|---|---|---|
| `payroll_calculator` | 計算者（上田） | 給与計算実行 / 修正 / インポート |
| `payroll_approver` | 承認者（宮永・小泉） | 承認 / 差戻し（V6: 自起票承認禁止と同等の自己承認禁止） |
| `payroll_disburser` | MFC インポート実行（上田） | MFC CSV ダウンロード / 振込 CSV 出力 |
| `payroll_auditor` | 監査（東海林・admin） | 全件閲覧 / 目視チェック |

実装: `bud.has_payroll_role(roles text[])` ヘルパー関数を **D-09 §4** で定義、本 spec で再利用。
RLS は role 別に USING / WITH CHECK を分割（Phase A-1 V6 自己承認禁止と同パターン）。
4 ロールは `root.employee_payroll_roles` テーブル（本 batch では未起票、Root spec で別途定義予定）。

### #25 「東海林頼んだ Excel」フィールド廃止

Kintone App 21（給与一覧）が保持していた **「東海林頼んだ Excel」フィールド**は、
月次報告資料 Excel への外部参照だった。Garden 移行時：

- 当該フィールドは **migration 対象外**（廃止）
- `bud_payroll_records`（D-10）が直接 master、月次報告資料 Excel への参照は不要
- 旧運用フローの「Excel 確認 → 給与確定」は **Bud Phase D 内で完結**（D-10 + D-11）
- field mapping spec（Kintone → Garden 移行時）に `excluded_fields` として明記

詳細は **D-10（給与計算統合）** + **D-11（MFC CSV 出力）** を参照。

### 影響箇所

本 spec の以下のセクションは上記 2 件を**自動的に継承**:

- §RLS / 役割定義 → 4 ロールヘルパー関数経由
- §field mapping（該当する場合）→ 「東海林頼んだ Excel」を `excluded_fields` リストに追加
- §migration 計画（該当する場合）→ Kintone App 21 移行時の field skip ルール
