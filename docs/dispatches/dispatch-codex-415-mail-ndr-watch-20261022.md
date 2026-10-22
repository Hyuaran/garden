# Codex-415：メールの送信失敗（NDR）を見つけて Chatwork で知らせる（2026-10-22）

## 背景（東海林さん 2026-10-22）
Microsoft 365（テナント hyuaran1.onmicrosoft.com）で、共有メールボックスを差出人にした送信が「Send as 権限不足」で失敗し、本人が気づかないまま相手に届かない事故があった（10/15〜10/22 で 7 通。例：ソフトバンク宛・各社の請求書）。
- エラー＝SendAsDenied（`Microsoft.Exchange.Data.Storage.SendAsDeniedException`・`ec=1244`・`HResult 0x80070005`・本文の hex に「SOBO rights have been checked but are not granted」・日本語の NDR「指定されたユーザーの代理として送信するアクセス権がありません」）
- 権限は付与済み。再発したらすぐ気づけるよう、**送信失敗の通知（NDR）が届いたら Chatwork で知らせる**

## 一番大事な前提
この失敗は配送に乗る前に本人の箱で弾かれるので、Exchange のメッセージ追跡には残らない。**分かるのは本人の箱に届く NDR メールだけ**。→ Garden の Graph アプリ（garden-bud-mail・Mail.Read アプリ権限・社内の全部の箱を読める）で NDR を拾う。

## 既存の部品（使い回す）
- Graph のトークンとメールの読み取り：`src/lib/mail-payment-check/graph-mail.ts`（環境変数 `MS_GRAPH_TENANT_ID`／`MS_GRAPH_CLIENT_ID`／`MS_GRAPH_CLIENT_SECRET`）。`src/lib/bud/mf/link-alerts.ts` も同じアプリで shoji@ の箱を読んでいる
- Chatwork 送信：`src/lib/chatwork/client.ts`（`CHATWORK_API_TOKEN`・既存の送り方。トークンの値は出さない）
- cron の鍵：`CRON_SECRET`（`verifyBearerRequest`）。失敗の知らせは障害ごとに 1 回・回復で 1 回（既存の決まり）

## 作るもの
1. `src/lib/mail-ndr-watch/`
   - **見る箱**：環境変数 `MAIL_NDR_WATCH_MAILBOXES`（カンマ区切り。既定＝`shoji@hyuaran1.onmicrosoft.com,keiri@hyuaran1.onmicrosoft.com,cs@hyuaran1.onmicrosoft.com`）。a-kin@hyuaran.com は後から足せるように
   - **探し方**：各箱の受信（`/users/{box}/messages`・`receivedDateTime ge 前回の実行時刻−15 分`（重ねて取りこぼしを防ぐ）・新しい順・ページ送りあり）
   - **NDR の判定**（どれかに当たれば候補・最後は本文の診断情報で確定）：
     - 差出人が `postmaster@*`／`MicrosoftExchange329e71ec88ae4615bbc36ab6ce41109e@*`（先頭一致で `MicrosoftExchange` も可）／表示名「Microsoft Outlook」「System Administrator」「Mail Delivery Subsystem」
     - 件名に「配信できませんでした」「Undeliverable」「Delivery has failed」「宛先不明」「Delivery Status Notification」「配信不能」
     - 本文に「Diagnostic information」「診断情報」「応答の例外」「#550」「RESOLVER」「SendAsDenied」「5.x.x」の形
   - **種別**（本文から判定・最初に当たったもの）：
     - `SendAsDenied（送信権限不足）`＝「SendAsDenied」「ec=1244」「代理として送信するアクセス権がありません」「SOBO rights」
     - `宛先不明`＝「RESOLVER.ADR」「550 5.1.1」「存在しません」「RecipientNotFound」
     - `外部転送ブロック`＝「550 5.7.520」
     - `容量・サイズ超過`＝「5.2.2」「5.3.4」「mailbox full」「容量」「サイズ」
     - `その他`
   - **元のメールの情報**：NDR の添付（Graph の `attachments`・`#microsoft.graph.itemAttachment` を `$expand=microsoft.graph.itemAttachment/item` で）から元の件名・宛先・送信日時を取る。取れなければ NDR の件名から前置き（「配信できませんでした: 」「Undeliverable: 」など）を外したものを元の件名に、本文の宛先の行・「送信日時／Sent」の行から拾う。宛先は 1 件目＋「他 n 件」
   - **重複しない**：表 `system_mail_ndr_alerts`（graph の message id＝主キー・箱・種別・元の件名・宛先・元の送信日時・NDR の受信日時・知らせた日時）。知らせ済みの id は二度と知らせない
   - **初回に過去分を流さない**：表 `system_mail_ndr_watch_state`（1 行・`started_at`・`last_run_at`）。最初の実行で `started_at=今` を入れ、**`started_at` より前に受信した NDR は対象外**
2. `GET /api/system/mail-ndr-watch/cron`（`CRON_SECRET`）：上を流して、新しい NDR を 1 件ずつ Chatwork に送る。`?dryRun=1` は送らずに見つけたものを JSON で返す（状態も書かない）
3. 知らせの文（Chatwork・1 件 1 通）：
   ```
   [info][title]メール送信失敗を検知[/title]
   種別：SendAsDenied（送信権限不足）
   差出人アカウント：keiri@hyuaran1.onmicrosoft.com
   元件名：RE: 申込書不備案件（MX）【回答期日10/30迄】
   送信日時：2026/10/22 18:30
   宛先：Watanabe-MXM 他3件
   NDR受信：2026/10/22 18:49
   → 相手に届いていません。再送が必要です。[/info]
   ```
   - 日時は日本時間 `YYYY/MM/DD HH:MM`。分からない項目は「記録なし」
   - 送り先＝環境変数 `MAIL_NDR_WATCH_CHATWORK_ROOM_ID`（試しの間は開発ルーム 433894375。本番の部屋は東海林さんが決める）
   - Graph や Chatwork の失敗は、障害ごとに 1 回だけ同じルームに「送信失敗の見張りが止まっています」、直ったら 1 回「復旧しました」（状態は `system_mail_ndr_watch_state` に）
4. migration `supabase/migrations/20261022000001_system_mail_ndr_watch.sql`（RLS：service_role のみ）
5. 業務管理ツールの「自動で動いている」（`src/app/system/forms/_data/gyomu-tools.json` の auto）に 1 行：名前「メール送信失敗（NDR）の知らせ」・15 分ごと・Garden・対象「Microsoft 365（shoji／keiri／cs の箱）」・minRole admin（件数のテストも直す）
6. **vercel.json にはまだ足さない**（試しで NDR を拾えることを確かめてから、Claude が `*/15 * * * *` で入れる）

## テスト
- NDR の判定（差出人・件名・本文の組み合わせ／ふつうのメールは拾わない）
- 種別の判定（SendAsDenied の 4 つの印・宛先不明・外部転送ブロック・容量・その他）
- 元のメールの情報（添付から／添付が無いときの件名・本文から／分からないときは「記録なし」）
- 重複しない・started_at より前は対象外・時間窓の重ね
- 知らせの文の形
- 試しモードは送らず状態も書かない
- 失敗の知らせは 1 回・回復で 1 回

## 守ること
- commit・push しない。DB・Graph・Chatwork・外部 API に接続しない
- `npx vitest run src/lib/mail-ndr-watch src/app/api/system/mail-ndr-watch src/app/system/forms` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・migration・テストの結果・Claude がやること（環境変数・試しの呼び方）だけ短く。
