This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## テレマ コール集計 Chatwork配信テスト

管理者用の`POST /api/system/call-report`で、単日集計のpreviewと開発デモルームへのテスト送信ができます。UI・定時実行・本番ルーム送信はありません。必要なサーバー環境変数は`CHATWORK_API_TOKEN`と`CHATWORK_DEV_ROOM_ID`です。API本文にroom指定はなく、送信先は開発用envだけから決まります。

ログイン済みのmanager、admin、super_adminのみ実行できます。ブラウザの認証Cookieを`cookie.txt`へ保存した例です。

```bash
curl -X POST https://garden-os.net/api/system/call-report -H "Content-Type: application/json" -b cookie.txt -d '{"mode":"preview","date":"2026-08-12"}'
curl -X POST https://garden-os.net/api/system/call-report -H "Content-Type: application/json" -b cookie.txt -d '{"mode":"send","date":"2026-08-12"}'
```

`date`省略時はJSTの当日です。まずpreviewで本文と集計値を確認し、その後sendを1回だけ実行してください。総コール0件の日は自動スキップされます。レスポンスとサーバーログの集計・送信時間で5分枠を確認できます。トークンと送信本文はログへ出しません。

### テレマ コール集計の定時配信（開発ルーム）

Vercel Cronが`GET /api/system/call-report/cron`をUTC 02:05〜12:05（JST 11:05〜21:05）に毎時呼び出します。平日はJST 15〜21時、土日祝は11〜21時だけ集計し、総コール0件なら送信しません。送信先は引き続き`CHATWORK_DEV_ROOM_ID`固定です。

必要なサーバー環境変数は`CRON_SECRET`、`CHATWORK_API_TOKEN`、`CHATWORK_DEV_ROOM_ID`、`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`です。Vercelは`CRON_SECRET`を`Authorization: Bearer ...`として付与します。手動確認も同じGETとBearer認証を使用します。

```bash
curl https://garden-os.net/api/system/call-report/cron \
  -H "Authorization: Bearer $CRON_SECRET"
```

先に`supabase/migrations/20260813000001_system_call_metrics_service_role.sql`を適用してください。未適用時のRPC権限エラーは0件扱いにせずHTTP 500になります。適用後、配信時間内のレスポンスが`reason: no_calls`ではなく実数日の`sent: true`となり、開発ルームへ届くことを確認します。

祝日は内閣府公表の2026・2027年分を`call-report-schedule.ts`へ埋め込んでいます。実行時fetchはありません。内閣府が翌年分を公表したら日付Setとテストを更新してください。重複発火に対する配信履歴・冪等性制御は未実装です。

### テレマ コール集計の日次ロールアップ

長期間の集計は`system_call_history`を毎回走査せず、正本から再構築可能な`system_call_daily_rollup`を読みます。migrationは次の順でSupabase SQL Editorから適用してください。

1. `20260813000002_system_call_daily_rollup.sql`（表・refresh関数・sync log列・初期構築）
2. `scripts/call-metrics-rollup-verify.sql`で`differing_cells=0`、`summary_matches=true`を確認
3. `20260813000003_system_call_metrics_rollup.sql`（本番4引数RPCの読取先切替）
4. 同じ検算SQLと`EXPLAIN (ANALYZE, BUFFERS)`で数値・速度を確認

取込APIはupsertした行の新旧`call_date`をrefreshします。refresh失敗は正本の取込を失敗させず、`system_call_sync_log.rollup_refresh_status/error`へ記録します。失敗日は次のように手動再構築できます。

```sql
select * from public.system_call_rollup_refresh(array[date '2026-08-12']);
```

ロールアップの主キーは`(call_date, employee_name, list_name, result_flag)`です。結果フラグのNULL・空・空白はsentinel `空`、社員名とリスト名の空値はそれぞれ`氏名なし`、`リスト名なし`として正規化します。3引数版`system_call_metrics`はデッドコードのため再作成しません。

ポータルではコール履歴の結果フラグ「獲得」を「受注」と表示します。受注率は獲得件数÷コール数、前確OK率は結果フラグ「前確OK」の件数÷コール数です。RPC内部の`acquired_count`（獲得）と`order_count`（前確OK）の意味は変更していません。トス数は結果フラグ「トス」から集計し、従業員タブのシフトは打刻アプリ連携まで「未取得」と表示します。

前確OKは`system_call_history.external_sales_id`（営業ID）が同じ獲得行の担当者・リストへ帰属します。電話番号は照合に使いません。同じ営業IDに獲得が複数ある場合は、前確OK日以前の最新獲得、なければ全期間の最新獲得を選び、同日時は主キーで決定します。営業IDなし・獲得なしは前確OK行自身へフォールバックします。期間内コール0でも前確OKがある担当者・リストは0コール行として残ります。

`20260814000002_system_call_metrics_preconfirm_reattribution.sql`はSupabase SQL Editorで手動適用します。2本の`CREATE INDEX CONCURRENTLY`をそれぞれ1文ずつ、トランザクションで囲まず実行し、両方の完了後に同ファイルの`CREATE OR REPLACE FUNCTION`以降を実行してください。適用後は`scripts/call-metrics-preconfirm-reattribution-verify.sql`で前確OK総数の一致、孤児件数、実例、ゼロコール行、1年レンジの実行時間を確認します。

### 勤怠打刻（第1段）

ログイン済みの在籍従業員は`/system/attendance`から出勤・退勤・休憩開始・休憩終了を打刻できます。時刻は端末値ではなくDB時刻をUTC保存し、画面ではJST秒表示します。ブラウザ発行UUIDを一意キーとして再送時の二重保存を防ぎます。

責任者以上は`/system/attendance/sync-status`で未送信・失敗等の件数と直近200件を確認できます。第1段ではKOTへの実送信は行わないため、新規打刻は`unsent`で保存されます。

責任者以上は同期状況画面から、KOT取込用の4列・ヘッダなし・Shift-JIS CSVを生成できます。生成した打刻は`送信中`になり、KOTへの手動アップロード成功後に「アップロード完了」、エラー時は「取消」して再生成します。未確定のCSVがある間は次のCSVを生成できません。

先に`supabase/migrations/20260813000004_system_attendance_punches.sql`を適用してください。適用前には同ファイル冒頭のSQLで`root_employees.employee_id`が`text`の主キーであることを確認します。ログインユーザーと`root_employees.user_id`をサーバーで照合し、本人の`employee_id`だけを保存します。ブラウザからテーブルを直接操作するRLS policyはありません。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
