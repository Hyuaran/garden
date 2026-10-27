# Codex-456：Vercel の料金を毎日見張る仕組み＋「一定間隔の取り直し」を共通部品にして同じ誤りを防ぐ（2026-10-27）

## なぜ（東海林さん「今後も同様の誤りがないように・追加料金にならないように・日ごとに確認する仕組み」）
2026-10-27 に Vercel から「オンデマンド利用増加」のメール。原因は、①Bud 口座残高の知らせ（`LinkAlerts`）の取り直しが、親の描き直しのたびに作り直される配列を useEffect の依存に入れていて休みなく呼び続けた（12 時間 33,000 回）②ホストPC中継の 25 秒待ち（直し済み）。気付いたのはメールが来てから。→ **毎日、料金を自動で確かめて知らせる**＋**一定間隔の取り直しを共通部品に限定**する。

## A. 毎日の料金の見張り
### 取り方
- Vercel の請求の明細 API：`GET https://api.vercel.com/v1/billing/charges?from=<ISO>&to=<ISO>&slug=hyuaran-5e506769`（`Authorization: Bearer ${VERCEL_BILLING_TOKEN}`）。返り値は FOCUS 形式の JSON Lines（1 行＝1 日×1 サービス）。公式：https://vercel.com/docs/rest-api/reference/endpoints/billing/list-focus-billing-charges 。列名は公式の説明に合わせて読む（日付・サービス名・使用量・単位・金額 USD）。gzip で返ることがある。
- 席の料金（サービス名 `Pro`・`Additional Team Seats`）は使用量ではないので除く。
- 請求期間＝毎月 20 日 0:00（UTC）〜翌月 20 日。込み分＝20 ドル（定数。`VERCEL_INCLUDED_USAGE_USD` で上書き可）。

### 置き場
- migration `supabase/migrations/20261027000456_vercel_usage.sql`（作るだけ。本番は Claude）：
  - `system_vercel_usage_daily`（`day date`・`service text`・`usage numeric`・`unit text`・`cost_usd numeric`・`fetched_at`・主キー＝day+service）。RLS 有効・service_role だけ。
  - `system_vercel_usage_alerts`（`key text primary key`・`active boolean`・`since timestamptz`・`last_notified_at`・`detail jsonb`）。
- `src/lib/vercel-usage/`：取得（`fetchBillingCharges`）・判定（`judgeUsage`＝純粋な関数・テストしやすく）・通知文（`usageNotice`）。
- cron：`GET /api/system/vercel-usage/cron`（`verifyBearerRequest` は既存の cron と同じ `CRON_SECRET`）。**vercel.json には足さない**（初回は止めて配備・Claude が確かめてから足す）。
- 環境変数 `VERCEL_BILLING_TOKEN` が無ければ何もせず `{ok:true, skipped:"no_token"}`。

### 判定（毎朝。前日までの全日を取り直して upsert）
1. **込み分を超えそう**：今の請求期間の使用量の合計 `spent` と、直近 3 日の平均×残りの日数で `projected` を出す。`projected > 込み分` なら警告（key=`projected_over`）。`spent > 込み分` なら「超えました」（key=`spent_over`）。
2. **急に増えた**：前日のサービスごとの金額が、その前の 7 日の中央値の **2 倍以上**かつ **0.20 ドル以上**なら警告（key=`spike:<service>:<day>`）。
3. 知らせは**障害ごとに 1 回＋戻ったら 1 回**（Garden の決まり）：`active` が false→true のときだけ送り、true→false で「落ち着きました」。spike は日付つきの key なので 1 回だけ。
4. **毎週月曜**は、何も無くても 1 行のまとめ（「今の請求期間の使用量 ○ドル／込み分 20 ドル・見込み ○ドル・多い順 3 つ」）。

### 知らせの文（Garden｜通知・ルーム 450125458＝`GARDEN_NOTICE_CHATWORK_ROOM_ID`。既存の `sendGardenNotice` を使う）
```
[info][title]Vercel の料金（Garden のサーバー）[/title]2026-10-28 09:05 自動
今の請求期間（10/20〜11/20）の使用量：24.10 ドル（込み分 20 ドル）
このままだと月末に 58.20 ドルの見込み → 追加料金が出ます
昨日いちばん増えたもの：観測イベント 3.24 ドル（いつもの 6.7 倍）
確認：https://vercel.com/hyuaran-5e506769/garden/observability/vercel-functions[/info]
```
- サービス名は日本語に（Fluid Provisioned Memory＝関数のメモリ／Fast Origin Transfer＝送受信データ／Observability Events＝観測イベント／Function Invocations＝関数の呼び出し／Fluid Active CPU＝関数の CPU／Build CPU Minutes＝配備の作業時間。ほかは英語のまま）。
- 金額は小数 2 桁。開発者用語を書かない。

## B. 一定間隔の取り直しを共通部品に（同じ誤りを作らない）
1. 共通フック `src/lib/hooks/usePolling.ts`：`usePolling(callback, intervalMs, { enabled = true, immediate = true, pauseWhenHidden = true })`。
   - callback は ref に持つ（**依存の配列に入れない**＝親の描き直しで取り直しが始まらない）。
   - タイマーは enabled・intervalMs が変わったときだけ作り直す。
   - **画面が隠れている間（`document.visibilityState === "hidden"`）は止め、見えたらすぐ 1 回取り直して再開**（開きっぱなしの裏のタブで呼び続けない）。
   - 前の取り直しが終わる前に次を始めない（重ならない）。
2. 今 `setInterval` で**サーバーへ取りに行っている**箇所を全部これに置き換える（少なくとも：`src/app/bud/bank/LinkAlerts.tsx`・`src/app/rill/mail/_components/RillMailScreen.tsx`・`src/app/rill/_components/RillShachoShell.tsx`・`src/app/system/onboarding/HireCandidatesClient.tsx`・`HireConfirmationSteps.tsx`・`src/app/_components/layout/GardenShell/GardenShell.tsx`・`src/components/shared/ShojiStatusContext.tsx`・`src/app/(orientation)/system/kanri/display/DisplayClient.tsx`・ほか grep で見つかるもの）。時計・タイマーの表示だけ（サーバーに取りに行かない）の setInterval はそのまま。**間隔と画面の動きは今と同じに保つ**（管理表のテレビ表示のように、見えている画面は今どおり更新されること）。
3. **見張りのテスト** `src/lib/hooks/polling-guard.test.ts`：`src/` の .ts/.tsx（テストを除く）を読み、`setInterval(` があり、同じファイルに `fetch(`・`.from(`・`.rpc(` があるものを失敗にする（共通フック自身と、理由を書いた許可リストだけ除く）。失敗の文＝「一定間隔でサーバーへ取りに行くときは usePolling を使ってください（2026-10-27 の Vercel 料金の件）」。
4. `AGENTS.md` に 3 行足す：一定間隔の取り直しは usePolling だけ／useEffect の依存に親が毎回作り直す配列・関数を入れて取りに行かない／cron や取り直しを足すときは 1 日の回数を見積もって指示書に書く。

## テスト（FAIL 0）
- judgeUsage：込み分を超えそう／超えた／急増（2 倍かつ 0.20 ドル以上・そうでないもの）／席の料金を除く／障害ごとに 1 回と回復の 1 回／月曜のまとめ。
- fetchBillingCharges：JSON Lines を読む（gzip も）・トークン無しは skipped。
- cron の route：認証・トークン無し。
- usePolling：依存が変わっても取り直しが増えない・隠れている間は呼ばない・見えたら 1 回呼ぶ・重ならない。
- 置き換えた画面の今のテストが通る。polling-guard が今のコードで通る。
- `npx tsc --noEmit`・`npx vitest run`（全体）。

## 触らないもの
`scripts/callcenter-agent/`（Codex-457 が同時に作業）・本番 DB・Storage・環境変数・vercel.json。**git は触らないでください。コミットは人間側が行います。** npm install はしない。トークンの値をファイルに書かない。

先に読む：社長スタイルの正本は画面を作らないので不要。Garden の通知の決まり＝失敗通知は障害ごとに 1 回＋回復時 1 回。

## 確認
日本語が「???」に化けていないこと（Node で数える）。BOM を付けないこと。

## 完了報告（コードブロックで）
変更したファイル／置き換えた取り直しの箇所の数と一覧／テスト結果（件数・FAIL 0）。

## 実装時の回数見積もり（Codex-456）
画面を24時間表示し続けた場合の上限目安（初回の1回・再表示時の1回・手動操作を除く）。非表示中は停止し、前の取得中は次を始めない。
- LinkAlerts：60秒、1,440回／日。
- RillMailScreen：60秒の一覧更新 1,440回／日＋10秒の通知確認 8,640回／日。通知が新しい場合だけ一覧も更新。
- ShojiStatusContext：30秒、2,880回／日。
- DisplayClient：既定300秒、288回／日（既存の設定値による上書きを維持）。
- HireCandidatesClient：処理中だけ1.2秒、最大72,000回／日。通常は処理完了までの短時間のみ。
- HireConfirmationSteps：1秒で残り時間を表示し、期限到達時に1回だけ確認。確認が済むと停止。
- KoT同期履歴：実行中の履歴がある間だけ30秒、最大2,880回／日。
- Vercel料金cron：登録後は1日1回を想定。請求API1回、前日までの当期分と急増判定用の直近8日を取得。現時点ではスケジュール未登録。
