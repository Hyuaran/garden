# Root Phase A-3-d: 日次打刻 `/daily-workings` 同期（判4）

- 作成: 2026-04-24（a-main）
- 対象モジュール: Garden-Root
- 見込み時間: **0.5d（約 4h）**
- 先行依存: A-3-a（sync_log）／ Phase A-2（月次同期の実装パターン確立）
- 後続依存: A-3-c（Cron がこれを呼ぶ）
- 担当: a-root セッション

---

## 1. 目的

Phase A-2 で実装済の **月次**（`/monthly-workings`）同期に加え、**日次**（`/daily-workings`）同期を追加する。

### Phase A-2 との違い
| 項目 | 月次（A-2 既存） | 日次（本 spec） |
|---|---|---|
| API | `/monthly-workings` | `/daily-workings` |
| 粒度 | 1 人 1 ヶ月 = 1 行 | 1 人 1 日 = 1 行 |
| 取得範囲 | 指定月全体 | 指定日 1 日分（or 日付範囲） |
| 更新頻度 | 月末一括 | 日次（Cron 経由） |
| 用途 | 給与計算の正本 | 直近の勤怠確認・修正対応 |

### 「判4」の定義確認
- handoff に登場したが詳細定義未記載
- **a-root セッション側で実装前に東海林さんに確認**：
  - 判1〜判3 は既存実装（Phase A-2）
  - 判4 = 日次粒度での打刻補正／修正対応レコード？
  - 一旦「日次打刻の詳細レコード化」として実装を進め、定義 FIX 後に追補

---

## 2. 前提

### 既存実装の流用
- `src/app/root/_lib/kot-api.ts` — `fetchKotMonthlyWorkings` の pattern を踏襲
- `src/app/root/_actions/kot-sync.ts` — Server Action の構造を踏襲
- `src/app/root/_types/kot.ts` — 型定義のパターン踏襲

### DB
- 書込先: `root_attendance`（既存）
- 既存の `work_date` カラムがあり、月次同期では月末日のみ埋めていた
- 日次同期では**各日 1 行**として upsert

### RLS
- 書込は service_role のみ（既存パターン）
- 読取は本人 + 上長 + admin（既存 RLS 維持）

---

## 3. KoT `/daily-workings` API 仕様（想定）

実際の仕様は **KoT API Docs** で確認（開発者: 東海林さん契約）。以下は推定：

### エンドポイント
```
GET https://api.kingtime.jp/v1.0/daily-workings/{date}
GET https://api.kingtime.jp/v1.0/daily-workings?start={date}&end={date}
```

### レスポンス（1 日分）
```json
{
  "date": "2026-04-24",
  "employee_key": "xxxx",
  "employee_code": "1165",
  "clock_in": "2026-04-24T09:02:00+09:00",
  "clock_out": "2026-04-24T18:31:00+09:00",
  "break_minutes": 60,
  "work_minutes": 510,
  "overtime_minutes": 30,
  "late_minutes": 2,
  "early_leave_minutes": 0,
  "leave_type": null,
  "note": "",
  "time_records": [
    { "type": "clock_in", "time": "2026-04-24T09:02:00+09:00" },
    { "type": "clock_out", "time": "2026-04-24T18:31:00+09:00" }
  ]
}
```

※ 実装時に KoT API Docs で field 名を必ず検証すること。

---

## 4. 実装手順

### Step 1: 型定義追加
- パス: `src/app/root/_types/kot.ts` に追記
```ts
export type KotDailyWorking = {
  date: string;
  employeeKey: string;
  employeeCode: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  leaveType: string | null;
  note: string | null;
  timeRecords?: Array<{ type: string; time: string }>;
};
```

### Step 2: API Client
- パス: `src/app/root/_lib/kot-api.ts` に追記
```ts
export async function fetchKotDailyWorkings(
  targetDate: string,  // YYYY-MM-DD
  opts?: FetchOptions
): Promise<KotDailyWorking[]> {
  assertDate(targetDate);
  const path = `/daily-workings/${targetDate}`;
  return kotFetch<KotDailyWorking[]>(path, opts);
}

// 日付範囲版（将来の一括取込用）
export async function fetchKotDailyWorkingsRange(
  startDate: string,
  endDate: string,
  opts?: FetchOptions
): Promise<KotDailyWorking[]> {
  const path = `/daily-workings?start=${startDate}&end=${endDate}`;
  return kotFetch<KotDailyWorking[]>(path, opts);
}
```

### Step 3: Server Action
- パス: `src/app/root/_actions/kot-sync-daily.ts`（新規）

```ts
"use server";

import { fetchKotDailyWorkings } from "../_lib/kot-api";
import { serviceSupabase } from "../_lib/supabase-service";
import { insertSyncLog, updateSyncLogComplete, updateSyncLogFailure } from "../_lib/kot-sync-log";

export async function syncDailyAttendance(params: {
  targetDate: string;
  triggeredBy?: string;
}) {
  const { targetDate, triggeredBy = "manual" } = params;
  const logId = await insertSyncLog({
    sync_type: "daily_attendance",
    sync_target: targetDate,
    triggered_by: triggeredBy,
    status: "running",
  });

  try {
    const dailyData = await fetchKotDailyWorkings(targetDate);

    // employee_code → employee_id 解決
    const supabase = serviceSupabase();
    const { data: employees } = await supabase
      .from("root_employees")
      .select("id, employee_number");
    const empMap = new Map(employees?.map(e => [e.employee_number, e.id]) ?? []);

    const rows = dailyData
      .filter(d => empMap.has(d.employeeCode))
      .map(d => ({
        employee_id: empMap.get(d.employeeCode)!,
        work_date: d.date,
        clock_in_at: d.clockIn,
        clock_out_at: d.clockOut,
        break_minutes: d.breakMinutes,
        work_minutes: d.workMinutes,
        overtime_minutes: d.overtimeMinutes,
        late_minutes: d.lateMinutes,
        early_leave_minutes: d.earlyLeaveMinutes,
        leave_type: d.leaveType,
        note: d.note,
        source: "kot-api-daily",
        imported_at: new Date().toISOString(),
        // created_at / updated_at は含めない（§A-3-f 横展開 fix と同じパターン）
      }));

    const { error, count } = await supabase
      .from("root_attendance")
      .upsert(rows, { onConflict: "employee_id,work_date", count: "exact" });

    if (error) throw error;

    const result = {
      records_fetched: dailyData.length,
      records_inserted: count ?? 0,  // upsert の挿入+更新合算
      records_updated: 0,
      records_skipped: dailyData.length - rows.length,
    };
    await updateSyncLogComplete(logId, result);
    return result;
  } catch (error) {
    await updateSyncLogFailure(logId, error);
    throw error;
  }
}
```

### Step 4: UI からの手動実行
- 既存 `KotSyncModal.tsx` に「日次取込」タブ追加
- 日付ピッカー → 実行ボタン → log 確認リンク

### Step 5: `root_attendance` スキーマ拡張（必要なら）
- 既存スキーマが **月次前提**（`target_month` 列）で日次を入れる構造になっていない可能性
- その場合は migration で以下追加：
  - `work_date date`
  - `clock_in_at timestamptz`
  - `clock_out_at timestamptz`
  - `late_minutes int`
  - `early_leave_minutes int`
  - `source text check (source in ('csv-manual', 'kot-api-monthly', 'kot-api-daily'))`
  - unique constraint: `(employee_id, work_date)`
- **既存月次同期データとの共存方針を東海林さんに確認**（別テーブルに分けるか、source 列で区別するか）

---

## 5. テスト観点（§16 7 種テスト該当）

| # | 種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 1 日分取込 → 全社員の root_attendance が更新 |
| 2 | エッジケース | 打刻なしの社員（休日・休職）→ clock_in_at が NULL |
| 3 | 権限 | 本人・上長は自分の日次 attendance を閲覧可能 |
| 4 | データ境界 | 月跨ぎ（日付変わり）の深夜勤務で clock_out_at > clock_in_at |
| 5 | パフォーマンス | 100 人規模で < 10 秒 |
| 6 | コンソール | 警告ゼロ |
| 7 | a11y | UI タブの aria-label |

### 特に注意
- **§A-3-f の timestamptz 空文字バグ**が日次でも再現する可能性大 → payload 構築時に除外する helper を使う
- **§KotSyncModal の toAttendanceRow で発見されたバグ**（created_at / updated_at 除外）と同じパターンを踏襲

---

## 6. 完了条件 (DoD)

- [ ] KoT API Docs で `/daily-workings` の正確な field 名を確認済
- [ ] 型定義・API Client 実装
- [ ] Server Action 実装
- [ ] UI モーダル（日次タブ）実装
- [ ] スキーマ拡張（必要なら）の migration 実装
- [ ] 手動実行でテスト日の取込成功
- [ ] log 行が入り、A-3-b の画面で確認できる
- [ ] commit + push + PR 発行

---

## 7. 注意事項・「判4」について

### 判4 の扱い
- 現時点で判4 の正確な定義が handoff にない
- 実装開始前に東海林さんに確認：
  - 判1〜判3 との違い
  - 本 spec の「日次打刻同期」が判4 に相当するか
  - もし別機能なら、本 spec とは別に追加 spec が必要か

### KoT API IP 制限
- 本 spec は KoT API 呼出ありなので、§A-3-e の IP 制限問題が未解決だと Vercel からは動作しない
- **開発中はローカル（東海林 PC の固定 IP）で動作確認**
- Cron 経由の自動実行は A-3-e 解決まで手動のみ

### データ設計の迷い
- 月次 `root_attendance` と日次 `root_attendance` を**同じテーブルに混ぜる** vs **別テーブルに分離**
- 本 spec では **source 列で区別** を初期案としているが、給与計算時に月次優先するロジックが複雑化する恐れ
- 実装着手前に東海林さんに確認推奨
