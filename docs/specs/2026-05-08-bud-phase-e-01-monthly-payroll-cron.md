# Bud Phase E #01: 月次運用 Cron + リマインダ拡張（D-12 実運用化）

- 対象: Garden-Bud Phase D-12 schedule + reminder の本番運用化
- 優先度: **🟢 高**（本番運用で必須、リマインダ漏れ = 給与遅延リスク）
- 見積: **0.75d**
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-05-08（a-bud-002 / Phase E v1 #01）
- 前提:
  - Bud Phase D-12 schedule + reminder（migration 20260508000003、純関数 schedule-functions.ts）
  - Vercel Cron Jobs（既存 cron 経路、`/api/cron/...`）
  - Chatwork API + Garden Toast 通知基盤（既存）

---

## 1. 目的とスコープ

### 1.1 目的

D-12 で実装した schedule + reminder の純関数群を **Vercel Cron で日次実行** する運用基盤。停止条件・リトライ・障害通知・運用設定 UI を整備して、給与処理が**確実に進む**仕組みを完成させる。

### 1.2 含めるもの

- Vercel Cron `/api/cron/bud-payroll-reminder`（日次 09:00 JST 実行）
- 停止条件（給与確定済の period は通知スキップ）
- リトライ機構（API 失敗時、最大 3 回）
- 障害通知（cron 自体が失敗した場合の admin 通知）
- 運用設定 UI（admin 専用、stage 別 offset_days / 担当者変更）

### 1.3 含めないもの

- schedule 計算ロジック → D-12（既存）
- リマインダメッセージテンプレ → D-12 REMINDER_TEMPLATES（既存）
- 月次給与計算実行 cron → 別 spec（E-02 に含める可能性あり）

---

## 2. Cron 仕様

### 2.1 実行スケジュール

| Cron | 実行時刻 | 内容 |
|---|---|---|
| `bud-payroll-reminder` | 毎日 09:00 JST | 各 period の各 stage を確認、未完了 → severity 判定 → 通知 |
| `bud-payroll-cleanup` | 毎月 1 日 03:00 JST | 6 ヶ月超の reminder_log を archive（COLD storage） |
| `bud-payroll-monthly-init` | 毎月 1 日 04:00 JST | 翌月分の bud_payroll_periods + schedule 自動生成 |

### 2.2 vercel.json 設定（既存ファイル拡張）

```json
{
  "crons": [
    {
      "path": "/api/cron/bud-payroll-reminder",
      "schedule": "0 0 * * *"  // UTC 00:00 = JST 09:00
    },
    {
      "path": "/api/cron/bud-payroll-cleanup",
      "schedule": "0 18 1 * *"  // UTC 18:00 1 日 = JST 03:00 1 日
    },
    {
      "path": "/api/cron/bud-payroll-monthly-init",
      "schedule": "0 19 1 * *"  // UTC 19:00 1 日 = JST 04:00 1 日
    }
  ]
}
```

---

## 3. API 実装

### 3.1 `/api/cron/bud-payroll-reminder`

```typescript
export async function GET(request: Request) {
  // Vercel Cron 認証ヘッダ確認
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const settings = await fetchActiveSettings(supabase);

  // アクティブな全 period × 全 stage を確認
  const periods = await fetchActivePeriods(supabase);
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const period of periods) {
    for (const stage of SCHEDULE_STAGES) {
      const schedule = await fetchSchedule(supabase, period.id, stage);

      // 停止条件 1: 既に完了済 → skip
      if (schedule.status === 'completed') continue;

      // 停止条件 2: period 自体が finalized → skip
      if (period.status === 'finalized') continue;

      // 停止条件 3: 当日に既に通知済 → skip（重複防止）
      const todayLog = await fetchTodayReminderLog(supabase, schedule.id);
      if (todayLog) continue;

      // severity 判定 + 通知送信
      const severity = decideSeverity(schedule.scheduledDate, schedule.actualDate, today);
      const escalation = decideEscalationLevel(schedule.scheduledDate, today);
      const recipients = resolveRecipients(stage, settings, escalation);

      try {
        await sendReminders(supabase, schedule, severity, escalation, recipients);
        sent += recipients.length;
      } catch (e) {
        await logCronError(supabase, schedule.id, e);
        failed += 1;
      }
      processed += 1;
    }
  }

  return Response.json({ processed, sent, failed });
}
```

### 3.2 リトライ機構

```typescript
async function sendReminderWithRetry(
  supabase: SupabaseClient,
  payload: ReminderPayload,
  maxRetries = 3,
): Promise<{ success: boolean; attempts: number }> {
  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < maxRetries) {
    attempts += 1;
    try {
      await sendChatwork(payload);
      return { success: true, attempts };
    } catch (e) {
      lastError = e;
      // exponential backoff
      await sleep(1000 * 2 ** (attempts - 1));
    }
  }

  // 全失敗時、admin Chatwork に escalate
  await escalateToAdmin(supabase, payload, lastError);
  return { success: false, attempts };
}
```

---

## 4. 運用設定 UI（admin only）

### 4.1 画面: `/bud/admin/payroll-schedule-settings`

- 7 stage 別 offset_days 編集
- 担当者変更（payroll_calculator / approver / disburser / visual_checker / auditor）
- リマインダ閾値（24h / 72h / 3d / 5d）変更
- 履歴表示（effective_from で過去設定確認）

### 4.2 RLS

```sql
-- D-12 で既存定義済の bud_payroll_schedule_settings に対し、
-- UPDATE は payroll_auditor + admin/super_admin のみ
```

---

## 5. 法令対応チェックリスト

- [ ] 労基法 §24（毎月払い、給与遅延禁止）
  - リマインダ漏れで給与が法定支払期日に間に合わなければ法令違反
- [ ] 個人情報保護法 §23（受信者の連絡先漏洩防止）
  - reminder_log に payload を保存する場合、PII 注意

---

## 6. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `/api/cron/bud-payroll-reminder` 実装 | a-bud | 1.5h |
| 2 | リトライ機構 + 障害通知 | a-bud | 1h |
| 3 | `/api/cron/bud-payroll-cleanup` | a-bud | 0.5h |
| 4 | `/api/cron/bud-payroll-monthly-init` | a-bud | 1h |
| 5 | vercel.json 拡張 + CRON_SECRET 環境変数 | a-bud | 0.25h |
| 6 | 運用設定 UI（admin、5 画面要素）| a-bud | 1.5h |
| 7 | 単体テスト（cron handler + retry） | a-bud | 1h |
| 8 | 統合テスト（cron 実行 → reminder_log 確認） | a-bud | 0.5h |

合計: 約 7.25h ≈ **0.75d**（妥当）

---

## 7. 判断保留事項

| # | 論点 | 起草スタンス |
|---|---|---|
| 判 1 | 重複通知の判定基準 | **当日 09:00 以降に schedule.id 単位で 1 通知**。02:00 等の早朝再実行でも重複防止 |
| 判 2 | リトライ上限 | **3 回（exponential backoff）**、4 回目で admin escalate |
| 判 3 | cleanup 対象期間 | **6 ヶ月超**、archive 後は COLD storage（Supabase 別 schema） |
| 判 4 | 翌月 period 自動生成日 | **毎月 1 日 04:00 JST**、当月給与確定後すぐに次月準備 |
| 判 5 | Cron 失敗時の通知先 | **東海林 Chatwork DM + admin 全員**、severity=critical で一斉通知 |
| 判 6 | 設定 UI の効果適用タイミング | **次回 cron 実行から**、effective_from は変更日 +1 日 |

---

## 8. 既知のリスクと対策

### 8.1 Vercel Cron の遅延

- Vercel Cron は ±10 分の誤差あり
- 対策: severity 判定は cron 実行時刻ではなく実 `now()` で判定、誤差吸収

### 8.2 Chatwork API レート制限

- 一時に 50+ 通知で 429 になる可能性
- 対策: バッチごとに 1 秒間隔挿入、優先度高は先送出

### 8.3 cron 自体の失敗

- DB 接続エラー / 環境変数不正 / Vercel Function timeout (10 秒) 等
- 対策: `@vercel/cron-monitor` 連携、3 日連続失敗で東海林通知

### 8.4 タイムゾーン誤差

- Vercel UTC vs JST 9 時間差
- 対策: cron schedule は UTC 表記、DB 比較は `now() at time zone 'Asia/Tokyo'`

---

## 9. 関連ドキュメント

- `docs/specs/2026-04-26-bud-phase-d-12-payroll-schedule-reminder.md`（D-12 純関数）
- `supabase/migrations/20260508000003_bud_phase_d12_payroll_schedule_reminder.sql`
- Vercel Cron Jobs: <https://vercel.com/docs/cron-jobs>

---

## 10. 受入基準（Definition of Done）

- [ ] `/api/cron/bud-payroll-reminder` 実装 + Vercel Cron 設定
- [ ] リトライ 3 回 + admin escalate 動作
- [ ] cleanup cron + monthly-init cron 動作
- [ ] 運用設定 UI（admin only、effective_from 履歴）
- [ ] 単体 + 統合テスト 20+ tests pass
- [ ] 重複通知なし（同じ stage × 同じ日 × 1 通知）
- [ ] 法令準拠（毎月払い遵守、リマインダ漏れなし）
