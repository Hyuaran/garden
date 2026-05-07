# Leaf 関電業務委託 Phase C-04: 月次バッチ処理（関電報告書・PD 同期・リマインダ）

- 対象: 月次集計バッチ、Vercel Cron、sync_log
- 優先度: **🟡 高**
- 見積: **0.75d**
- 担当セッション: a-leaf
- 作成: 2026-04-24（a-auto / Batch 8 Leaf 関電 #04）
- 前提: C-01（sync_log テーブル）, Root KoT sync（PR #15）パターン踏襲

---

## 1. 目的とスコープ

### 目的
関電業務委託の定型業務を自動化し、事務担当の月次作業負荷を削減する。**Root KoT 連携と同じパターン**（`*_sync_log` + `sync_kind` + `method`）で一貫性確保。

### 含める
1. **月次関電報告書自動生成**（毎月 2 日 03:00 JST）
2. **Prodelight（PD）同期**（日次、進行中案件の status 照合）
3. **手数料自動計算**（請求日付与時に trigger、月次でリカバリ）
4. **ステータス滞留リマインダ**（週次、長期未進行案件を事務に通知）

### 含めない
- レポート画面 UI（C-02 の詳細画面で参照のみ）
- Chatwork 通知本体（C-05 で連携）
- 月次会計仕訳との連携（Phase D、Forest 経由）

---

## 2. 既存実装との関係

### Root KoT 連携（PR #15、参考パターン）

| 要素 | KoT（Root）| Leaf 関電（C-04）|
|---|---|---|
| sync_log テーブル | `root_kot_sync_log` | `soil_kanden_sync_log`（C-01 §3.4 で投入済）|
| Route | `/api/root/kot/sync` | `/api/leaf/kanden/cron/<kind>` |
| 認証 | Vercel Cron + CRON_SECRET | 同上 |
| 実行方式 | Node.js Route Handler | Node.js Route Handler（Edge 不可、大量データ処理）|
| エラー記録 | sync_log.error_summary | 同等 |

### Phase C 新規作成

```
src/app/api/leaf/kanden/cron/
  ├── monthly-report/route.ts         # 月次関電報告書
  ├── pd-sync/route.ts                # PD 同期
  ├── commission-calc/route.ts        # 手数料再計算
  └── status-reminder/route.ts        # ステータス滞留

src/lib/leaf/
  ├── monthly-report/
  │   ├── generate.ts                 # レポート生成ロジック
  │   ├── csv-writer.ts               # CSV 出力
  │   └── pdf-renderer.tsx            # PDF 生成（@react-pdf/renderer）
  ├── pd-sync/
  │   ├── client.ts                   # PD API ラッパー
  │   └── differ.ts                   # 差分検出
  ├── commission-calc.ts
  └── reminder.ts
```

---

## 3. Vercel Cron 設定

```json
// vercel.json
{
  "crons": [
    { "path": "/api/leaf/kanden/cron/monthly-report",   "schedule": "0 18 1 * *"   },
    { "path": "/api/leaf/kanden/cron/pd-sync",          "schedule": "0 20 * * *"   },
    { "path": "/api/leaf/kanden/cron/commission-calc",  "schedule": "0 19 1 * *"   },
    { "path": "/api/leaf/kanden/cron/status-reminder",  "schedule": "0 0 * * 1"    }
  ]
}
```

**JST 換算**:
- 月次報告書: **毎月 2 日 03:00 JST**（月初 1 日深夜、前月分集計）
- PD 同期: **毎日 05:00 JST**（営業時間前）
- 手数料再計算: 月次報告書と同じ（月初 1 日深夜）
- 滞留リマインダ: **毎週月曜 09:00 JST**（週初の事務開始時刻）

**注意**: Vercel Cron は UTC。`0 18 1 * *` = UTC 18:00 毎月 1 日 = **JST 03:00 毎月 2 日**（翌日）

---

## 4. 月次関電報告書（`monthly-report/route.ts`）

### 4.1 要件

- **対象期間**: 前月 1 日〜末日（例: 2026-05-02 実行 → 2026-04 分）
- **集計対象**: 前月中に **status='completed'** に遷移した案件、または **cancellation_flag=true** になった案件
- **出力形式**: CSV + PDF（2 種）
- **格納先**: Supabase Storage `leaf-monthly-reports/` bucket
- **通知**: C-05 で admin + 経理担当に Chatwork 通知

### 4.2 集計項目

```typescript
export interface MonthlyReportRow {
  // 案件識別
  case_id: string;
  customer_number: string;
  customer_name: string | null;

  // 契約
  contract_type: string;
  plan_code: string;
  contract_kw: number | null;
  monthly_kwh: number | null;

  // 営業情報
  sales_employee_number: string;
  sales_name: string;
  sales_department: string;

  // 日付
  ordered_at: string;
  completed_at: string | null;
  cancelled_at: string | null;

  // 手数料
  commission_rate: number | null;
  commission_amount: number | null;

  // 請求・入金
  invoice_sent_date: string | null;
  actual_payment_date: string | null;
  payout_actual_date: string | null;
}

export interface MonthlyReportSummary {
  target_month: string;              // 'YYYY-MM'
  total_completed: number;
  total_cancelled: number;
  total_revenue: bigint;             // 売上合計（手数料ベース）
  by_contract_type: {
    low_voltage: { count: number; revenue: bigint };
    high_voltage: { count: number; revenue: bigint };
    extra_high_voltage: { count: number; revenue: bigint };
  };
  by_sales_department: Record<string, { count: number; revenue: bigint }>;
}
```

### 4.3 実装スケルトン

```typescript
// src/app/api/leaf/kanden/cron/monthly-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { generateMonthlyReport } from '@/lib/leaf/monthly-report/generate';

export const runtime = 'nodejs';
export const maxDuration = 300;  // 5 分

export async function POST(req: NextRequest) {
  // Vercel Cron 認証
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminSupabase();

  // 対象月を算出（実行日の前月）
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetMonthStr = targetMonth.toISOString().slice(0, 7);  // 'YYYY-MM'

  // sync_log 作成（running）
  const { data: logRow } = await admin.from('soil_kanden_sync_log').insert({
    sync_kind: 'monthly_report',
    method: 'cron_auto',
    status: 'running',
    target_month: `${targetMonthStr}-01`,
  }).select('id').single();
  const logId = logRow!.id;

  try {
    const result = await generateMonthlyReport(admin, targetMonth);

    // Storage アップロード（CSV + PDF）
    const csvPath = `leaf-monthly-reports/${targetMonthStr}/report-${Date.now()}.csv`;
    const pdfPath = `leaf-monthly-reports/${targetMonthStr}/report-${Date.now()}.pdf`;
    await admin.storage.from('leaf-monthly-reports').upload(csvPath, result.csvBuffer, { contentType: 'text/csv' });
    await admin.storage.from('leaf-monthly-reports').upload(pdfPath, result.pdfBuffer, { contentType: 'application/pdf' });

    // sync_log 更新（success）
    await admin.from('soil_kanden_sync_log').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      processed_count: result.rows.length,
      success_count: result.rows.length,
      error_count: 0,
      output_file_url: csvPath,
      metadata: { pdfPath, summary: result.summary },
    }).eq('id', logId);

    // TODO: C-05 で Chatwork 通知発火

    return NextResponse.json({ success: true, targetMonth: targetMonthStr, rows: result.rows.length });
  } catch (e) {
    await admin.from('soil_kanden_sync_log').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_summary: e instanceof Error ? e.message : String(e),
    }).eq('id', logId);
    console.error('[monthly-report]', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
```

---

## 5. Prodelight（PD）同期（`pd-sync/route.ts`）

### 5.1 要件

- **対象**: `status NOT IN ('completed', ordered, awaiting_specs)` かつ `cancellation_flag=false` の案件（約 100-500 件想定）
- **目的**: PD 側のステータスと Garden 側の整合確認、差分を `pd_sync_errors` に記録
- **実行**: 毎日 05:00 JST、1 日 1 回
- **レート制限**: PD API 60 req/min、バッチ 100 件ずつ処理

### 5.2 差分検出ロジック

```typescript
// src/lib/leaf/pd-sync/differ.ts
export interface PdSyncDiff {
  case_id: string;
  pd_number: string;
  garden_status: KandenStatus;
  pd_status: string | null;
  mismatch: 'status_ahead' | 'status_behind' | 'pd_not_found' | 'garden_not_found' | 'sync';
}

export async function diffGardenVsPd(
  cases: Pick<KandenCase, 'case_id' | 'pd_number' | 'status'>[],
  pdClient: PdClient,
): Promise<PdSyncDiff[]> {
  const pdStatuses = await pdClient.batchFetch(cases.map(c => c.pd_number));
  return cases.map(c => {
    const pd = pdStatuses.get(c.pd_number ?? '');
    // ... 差分判定ロジック
  });
}
```

### 5.3 エラー記録

`soil_kanden_cases.pd_sync_errors` は jsonb、直近 10 件の履歴を保持：

```json
[
  {
    "at": "2026-04-24T20:05:00+09:00",
    "error_code": "PD_STATUS_AHEAD",
    "message": "PD 側が送付待ち、Garden 側はエントリー待ち"
  },
  ...
]
```

---

## 6. 手数料再計算（`commission-calc/route.ts`）

### 6.1 トリガ
- Trigger: `soil_kanden_cases.invoice_sent_date` 設定時 → Trigger で即計算
- 月次 Cron: 設定漏れのリカバリ（毎月 2 日 04:00 JST）

### 6.2 計算ロジック

```typescript
export function calculateCommission(input: {
  caseRecord: KandenCase;
  plan: KandenPlan;
}): { amount: bigint; rate: number } {
  const { contract_kw, monthly_kwh, contract_type } = input.caseRecord;
  const { base_rate, unit_rate, commission_table } = input.plan;

  // 基本料金 + 電力量料金
  const baseFee = BigInt(Math.floor(base_rate * (contract_kw ?? 0)));
  const usageFee = BigInt(Math.floor(unit_rate * (monthly_kwh ?? 0)));
  const totalInvoice = baseFee + usageFee;

  // 手数料率（案件別 or プラン別）
  const rate = input.caseRecord.commission_rate
    ?? commission_table[contract_type]
    ?? 8.0;

  return {
    amount: totalInvoice * BigInt(Math.floor(rate * 100)) / BigInt(10000),
    rate,
  };
}
```

### 6.3 更新

計算結果を `soil_kanden_cases.commission_amount` に UPDATE、`root_audit_log` に記録。

---

## 7. ステータス滞留リマインダ（`status-reminder/route.ts`）

### 7.1 要件

- **週次月曜 09:00 JST** 実行
- **滞留定義**: 同 status で **14 日以上**更新なし（cancellation_flag=false）
- **通知**: 事務担当（staff+）の Chatwork ルームに集約
- **除外**: completed / canceled

### 7.2 滞留検出クエリ

```sql
SELECT
  case_id, customer_name, status, sales_name,
  COALESCE(
    specs_collected_at, entered_at, sent_at,
    invoiced_at, payment_received_at, payment_sent_at, ordered_at
  ) AS last_progressed_at,
  EXTRACT(DAY FROM now() - last_progressed_at) AS days_stuck
FROM soil_kanden_cases
WHERE status NOT IN ('completed', 'ordered')
  AND cancellation_flag = false
  AND last_progressed_at < now() - INTERVAL '14 days'
ORDER BY last_progressed_at ASC
LIMIT 50;
```

### 7.3 通知フォーマット（Chatwork に渡す、C-05 で実装）

```
[info][title]📌 案件滞留リマインダ 2026-04-28[/title]
14 日以上進行していない案件が X 件あります:

• K-20260401-0042 山田商店（諸元待ち / 15日）担当: 田中太郎
• K-20260405-0018 佐藤邸（エントリー待ち / 19日）担当: 鈴木花子
...

🔗 詳細確認: https://garden.app/leaf/backoffice?stuck=true
[/info]
```

---

## 8. 監査ログ連携

| Cron | sync_log 以外の記録先 |
|---|---|
| monthly-report | severity=info, action='leaf.monthly_report_generated' |
| pd-sync | 差分検出時 warn、API 失敗時 critical |
| commission-calc | 金額変更時 info（金額自体は warn 扱い）|
| status-reminder | 滞留 10 件超で warn |

---

## 9. エラーハンドリング

### 9.1 リトライ戦略

| エラー | 対応 |
|---|---|
| Supabase タイムアウト | 30 秒待機 → 1 回再実行、失敗で sync_log.status=failed |
| PD API 503 | 指数バックオフ 1s/2s/4s で 3 回、失敗で skip（次回バッチで再試行）|
| Storage upload 失敗 | CSV/PDF どちらか片方でも成功なら partial、両方失敗で failed |
| メモリ不足（大量案件）| page 分割 100 件ずつ処理 |

### 9.2 sync_log による追跡

```sql
-- 失敗の連続回数をチェック（5 回連続失敗 → Chatwork critical）
SELECT count(*) FROM soil_kanden_sync_log
  WHERE sync_kind = 'monthly_report'
    AND status = 'failed'
    AND started_at > now() - INTERVAL '7 days';
```

---

## 10. Storage bucket

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('leaf-monthly-reports', 'leaf-monthly-reports', false, 52428800,
  ARRAY['text/csv', 'application/pdf'])
ON CONFLICT DO NOTHING;

-- RLS: leaf_is_office で read、service_role で upload
CREATE POLICY lmr_read ON storage.objects FOR SELECT
  USING (bucket_id = 'leaf-monthly-reports' AND leaf_is_office());
```

---

## 11. 実装ステップ

### W1: monthly-report（0.3d）
- [ ] `generate.ts` 集計ロジック + CSV/PDF 生成
- [ ] Route Handler + sync_log 記録
- [ ] Storage upload + Chatwork hook

### W2: pd-sync（0.2d）
- [ ] PD API クライアント（認証・レート制限）
- [ ] 差分検出 + pd_sync_errors 更新

### W3: commission-calc（0.1d）
- [ ] 計算関数 + Trigger
- [ ] 月次リカバリ Route

### W4: status-reminder（0.1d）
- [ ] 滞留検出クエリ + 通知組立
- [ ] C-05 への hook

### W5: 動作確認（0.05d）
- [ ] CRON_SECRET 認証
- [ ] dev 環境で手動実行（Vercel CLI）
- [ ] sync_log 記録確認

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 月次報告書の PDF は admin 手動修正可か | **admin UI で再生成**可、手動編集は不可 |
| 判2 | PD API のトークン更新頻度 | 3 ヶ月毎ローテーション推奨 |
| 判3 | 手数料計算の端数処理 | 円未満切捨て（Math.floor）|
| 判4 | 滞留閾値 14 日の妥当性 | 運用開始 3 ヶ月で調整 |
| 判5 | 連続失敗時の自動停止 | 5 回連続で Cron スケジュール自動無効化は Phase D |
| 判6 | 月次報告書の送付先 | Phase C では内部保管のみ、関電送付は admin 手動 |

---

## 13. 関連参照

- **C-01 §3.4**: sync_log テーブル
- **C-05**: Chatwork 通知実装
- **spec-cross-audit-log §4**: 必須記録
- **spec-cross-storage**: bucket 設計パターン
- **Root KoT 連携（PR #15）**: 参考パターン

— end of C-04 —
