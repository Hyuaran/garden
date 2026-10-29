# Codex-491：Chatwork の「TO を付けた書き込み」を、結んだ LINE グループへ送る（開発アカウントで試す）（2026-10-29）

## 東海林さんの話（開発ボード system 5a1d7efb）
- Chatwork ルームの書き込みを LINE グループへ送れるか、**仕組みとして試す**。導入するかは月 5,000 通の枠があるので別に決める。今回は開発アカウント（account='dev'）のグループだけ。
- 試しの組み合わせ：Chatwork 開発ルーム（433894375）⇄ LINE「Garden開発ルーム A」（Codex-489 で結んだ・`system_line_target.chatwork_room_id`）。

## しくみ
- Chatwork の Webhook（**アカウントの知らせ `mention_to_me`**）：【事務局】システム自動通知（`CHATWORK_API_TOKEN` のアカウント）あてに TO を付けた書き込みが、どのルームでも Garden に届く。ルームの知らせ（1 アカウント 5 件まで）は使わない。
- Garden は、そのルームを `chatwork_room_id` に持つ結んだグループ（`linked_at` あり・`active`・**`account='dev'` だけ**）へ、開発アカウントの LINE（`LINE_CHANNEL_ACCESS_TOKEN`）で push する。

## 1. 受け口 `src/app/api/system/chatwork/webhook/route.ts`（POST）
- 署名の確かめ：env `CHATWORK_WEBHOOK_TOKEN`（Chatwork の Webhook 編集画面のトークン）を Base64 デコードした鍵で、受け取った本文そのままの HMAC-SHA256 を Base64 にし、ヘッダー `x-chatworkwebhooksignature`（無ければクエリ `chatwork_webhook_signature`）と timingSafeEqual で比べる。違えば 401。env が無ければ 503。
- `webhook_event_type === 'mention_to_me'` だけ扱う（ほかは 200 で何もしない）。`webhook_event` の `from_account_id`・`to_account_id`・`room_id`・`message_id`・`body` を使う。
- 送り主が自分（`to_account_id` と同じ）なら何もしない。
- 本文から Chatwork の記法を外す：`[To:数字]名前さん` の行頭の TO（名前部分も）・`[rp aid=… to=…]…`・`[info]`/`[title]` のタグ。前後の空白を詰める。空なら何もしない。
- 送り主の名前：Chatwork API `GET /rooms/{room_id}/members` から `from_account_id` の name（取れなければ「（名前を取得できませんでした）」）。
- LINE への文：`{名前}：{本文}`（法人名は付けない・本文は 5,000 字で切る）。push は `POST https://api.line.me/v2/bot/message/push`（to＝グループの `line_target_id`）。リトライキー `X-Line-Retry-Key` に message_id から作った UUID を付け、同じ書き込みを二度送らない。
- 結んだグループが無いルームは何もしない（200）。同じルームに複数のグループが結ばれていたら全部へ送る。
- 送れなかったとき：同じ Chatwork ルームへ「LINE へ送れませんでした（理由）」と 1 行返す（ChatworkClient・`BLOOM_CHATWORK_DRY_RUN` に従う）。送れたときは何も書かない。
- 記録：表 `system_chatwork_line_forward`（migration `20261029000491_chatwork_line_forward.sql`・作成のみ）：`message_id unique`・`room_id`・`line_target_id`・`from_account_id`・`status`（sent／failed／skipped）・`error`・`created_at`。message_id が既にあれば何もしない（Chatwork の送り直し対策）。RLS は service_role だけ。

## 2. 送信数
- 送った件数を数える関数は作らない（LINE の管理画面で見る）。ただし `system_chatwork_line_forward` の行数で月ごとの件数がわかるようにしておく。

## 3. テスト
- 署名：正しい／違う／env なし。
- 自分あての TO 以外・自分の書き込み・結んだグループの無いルーム・account='official' のグループは送らない。
- 記法の外し方（TO・返信・info）。二度目の同じ message_id は送らない。送れなかったら Chatwork へ 1 行。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。本番の手順（migration→env `CHATWORK_WEBHOOK_TOKEN`→Chatwork で Webhook を作る→試し）を書く。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。LINE・Chatwork に送らない（テストはモック）。**
- **触らない場所（別の Codex が同時に作業する。読みもしない）**：`src/app/root/`・`src/app/api/root/`・`src/app/system/mypage/`・`scripts/`。

## 実装時の取得回数
- 定期の取得は無し。TO を付けた書き込み 1 件につき Chatwork の members 1 回＋LINE の push 1 回（グループの人数分を送信数に数える）。

## Codex-491 実装補足
- 定期取得は 0 回/日。対象の書き込みを 1 日 N 件、各ルームの結んだグループを G 件とすると、members は N 回/日、push は合計 N×G 回/日。失敗時の Chatwork 返信は書き込みごとに最大 1 回。同一 message_id の再配信では外部 API を呼ばない。
- `system_chatwork_line_forward` は message_id を一意に確保する受信記録。複数グループの個別結果は `system_chatwork_line_forward_delivery` に保存し、月別の送信件数は created_at と status='sent' の行数で確認できる。受信記録の line_target_id は先頭の宛先、status/error は全宛先の集約結果。
- リトライキーは message_id と宛先 ID から作る UUID。同じ宛先には同じキー、別グループには異なるキーを使う。
- 適用手順：migration `20261029000491_chatwork_line_forward.sql` → env `CHATWORK_WEBHOOK_TOKEN`（既存の CHATWORK_API_TOKEN / LINE_CHANNEL_ACCESS_TOKEN も確認）→ アカウントの Webhook「mention_to_me」を `/api/system/chatwork/webhook` に設定 → 開発ルーム 433894375 で通知アカウントに TO を付け、結んだ開発 LINE グループにだけ届くことを確認する。
