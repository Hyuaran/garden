# Root Phase A-3-c: Vercel Cron 自動同期

- 作成: 2026-04-24（a-main）
- 対象モジュール: Garden-Root
- 見込み時間: **0.6d（約 5h）**
- 先行依存: A-3-a（sync_log）／ A-3-b（履歴 UI）／ Phase A-2（KoT API 連携）
- 後続依存: A-3-e（IP 制限問題が blocker になる可能性）
- 担当: a-root セッション

---

## 1. 目的

KoT 勤怠データを**人手を介さず日次で Garden に同期**する。

### 業務効果
- 経理の月末 CSV 手作業（Phase 1）を廃止
- 朝 admin が前日の同期結果を一覧で確認できる
- 失敗時は A-3-b の再実行ボタンで即対応

### 自動化範囲
1. **日次勤怠同期**（毎日 03:00 JST = 18 UTC）: 前日分の `/daily-workings` 取込
2. **月次勤怠同期**（毎月末 03:00 JST）: 当月分の `/monthly-workings` 取込（差分上書き）
3. **マスタ同期**（マスタ変更時の手動 or 週次）: ~~今回は手動運用~~（Phase B 以降）

---

## 2. 前提

### 既存実装
- `src/app/root/_actions/kot-sync.ts` — 月次同期の Server Action
- `src/app/root/_actions/kot-sync-daily.ts` — 日次同期（A-3-d で実装）
- `src/app/root/_lib/kot-sync-log.ts` — log 書込 helper（A-3-a）

### Vercel Cron 制約
- **Hobby プラン**: 2 jobs 上限、日次のみ
- **Pro プラン**: 40 jobs、分単位
- 現状 Garden は Pro プラン前提（確認: Vercel 管理画面）
- タイムアウト: 最大 300 秒（Pro）/ 10 秒（Hobby）→ **Pro 必須**

### セキュリティ
- Cron エンドポイントは **Bearer `CRON_SECRET` 必須**
- Vercel Cron は自動で `authorization: Bearer $CRON_SECRET` ヘッダを付与
- その他のリクエストは 401 拒否

---

## 3. Vercel Cron 設定

### `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/root/kot-sync/cron-daily",
      "schedule": "0 18 * * *"
    },
    {
      "path": "/api/root/kot-sync/cron-monthly",
      "schedule": "0 18 28-31 * *"
    }
  ]
}
```

- `0 18 * * *` = 毎日 UTC 18:00 = JST 03:00
- `0 18 28-31 * *` = 毎月 28-31 日の UTC 18:00 に実行（実装側で「当月末日かつ今日」判定して月末 1 回だけ走らせる）

### 環境変数（Vercel Dashboard）
- `CRON_SECRET`: ランダム生成した 32 文字以上の secret（新規）
- `KOT_API_TOKEN`: 既存
- `NEXT_PUBLIC_SUPABASE_URL`: 既存
- `SUPABASE_SERVICE_ROLE_KEY`: 既存

---

## 4. 実装手順

### Step 1: CRON_SECRET 生成・登録
```bash
# ローカル
openssl rand -base64 48
```
- Vercel Dashboard → Settings → Environment Variables に追加（Production / Preview / Development すべて）
- `.env.local` には記載不要（Cron はデプロイ環境でのみ動作）

### Step 2: 認証 helper
- パス: `src/lib/cron-auth.ts`（モジュール横断で使えるよう `src/lib/` 配下）
```ts
import { NextRequest } from "next/server";

export function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return authHeader === expected;
}
```

### Step 3: 日次 Cron Route Handler
- パス: `src/app/api/root/kot-sync/cron-daily/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { syncDailyAttendance } from "@/app/root/_actions/kot-sync-daily";
import { insertSyncLog, updateSyncLogComplete, updateSyncLogFailure } from "@/app/root/_lib/kot-sync-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 前日 JST の日付を算出
  const yesterdayJst = new Date(Date.now() - 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
  const targetDate = yesterdayJst.toISOString().slice(0, 10);

  const logId = await insertSyncLog({
    sync_type: "daily_attendance",
    sync_target: targetDate,
    triggered_by: "cron",
    status: "running",
  });

  try {
    const result = await syncDailyAttendance({ targetDate });
    await updateSyncLogComplete(logId, result);
    return NextResponse.json({ ok: true, logId, ...result });
  } catch (error) {
    await updateSyncLogFailure(logId, error);
    return NextResponse.json({ error: "sync failed", logId }, { status: 500 });
  }
}
```

### Step 4: 月次 Cron Route Handler
- パス: `src/app/api/root/kot-sync/cron-monthly/route.ts`
- 日次と同じ形。`syncMonthlyAttendance` を呼ぶ
- **月末判定**: 今日の翌日が 1 日なら実行、そうでなければ 204 No Content で早期 return

```ts
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
if (tomorrow.getUTCDate() !== 1) {
  return NextResponse.json({ skipped: true, reason: "not last day of month" });
}
```

### Step 5: running ステータス cleanup
- もし前回の cron で `status='running'` のまま残った log 行があれば、Cron 実行前に `status='failure', error_message='timeout or orphaned'` で更新
- `updateOrphanedRunning()` helper を作成し、A-3-b の rerun ボタンで誤認されないようにする

### Step 6: 動作確認（ローカル不可、Vercel Preview で）
1. PR を立てる
2. Vercel Preview の URL に以下で curl
```bash
curl -H "authorization: Bearer $CRON_SECRET" \
  https://<preview-url>/api/root/kot-sync/cron-daily
```
3. `/root/kot-sync-history` で log が入ることを確認

---

## 5. テスト観点（§16 7 種テスト該当）

| # | 種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 正常系で log 追加・status='success' |
| 2 | エッジケース | KoT API 5xx → retry / log status='failure', error 記録 |
| 3 | 権限 | `CRON_SECRET` なし → 401 |
| 4 | データ境界 | 前日が月跨ぎでも targetDate が正しい |
| 5 | パフォーマンス | 1000 人規模の同期で 60 秒以内 |
| 6 | コンソール | Vercel Function Logs にトークン等秘匿情報が出ていない |
| 7 | a11y | （API のため対象外） |

---

## 6. 完了条件 (DoD)

- [ ] `vercel.json` に crons 定義追加
- [ ] `CRON_SECRET` を Vercel 環境変数に登録（本番・Preview 両方）
- [ ] `cron-daily` / `cron-monthly` Route Handler 実装
- [ ] Preview 環境で手動 curl 実行 → log 追加確認
- [ ] 本番 Cron が初回自動実行されることを翌朝確認
- [ ] orphaned running cleanup 動作確認
- [ ] commit + push + PR 発行

---

## 7. 注意事項・既知リスク

### 🚨 KoT API IP 制限 blocker
- KoT API は**契約 IP のみ許可**（東海林 PC 固定 IP のみ）
- Vercel Functions は動的 IP → **現状 Cron からの KoT API 呼出は失敗する**
- **A-3-e で issue 起票 → 解決策決定後に本 spec の Cron 実装を有効化**
- 暫定対応案:
  - (A) Preview/本番では KoT 呼出を skip、staging 用の mock で動作確認
  - (B) `KOT_API_BASE_URL` 環境変数で mock サーバへ切替
  - (C) 解決策決定まで Cron は cron-job.org など外部サービスで東海林 PC へ wake call

### Vercel Cron 冪等性
- Vercel は稀に同じ cron を 2 回発火させることがある
- 対策: 同期関数内で **直近 5 分以内に同じ target の log が `running` or `success`** なら早期 return

### トークン管理
- `CRON_SECRET` を一度設定したら**他人にも共有しない**（Supabase Publishable ではなく Secret 相当）
- ローテーション時は Cron が一時的に 401 になるので、デプロイと連動させる
