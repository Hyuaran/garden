# Codex-493 実装レポート（2026-10-30）

## 変更したファイル

- `src/app/api/system/line/inbox/[account]/route.ts`（新規）
  - `hikari` / `shokai` の POST 受け口を追加。それ以外は 404。
  - 各アカウントの Channel secret で、生のリクエスト本文を HMAC-SHA256 / base64 化し、長さ確認と timingSafeEqual で署名を確認。不一致は 401。
  - 対象アカウントの secret / access token、Chatwork トークン、通知先が未設定なら、変数名をログに出して 503。秘密値はログに出さない。
  - 1 対 1 の message イベントのみ通知。アカウント別アクセストークンで表示名を取得し、失敗しても名前の代替文で通知。
  - 本文の改行を維持し、画像・動画・音声・スタンプ・ファイル・位置情報を指定の表現へ変換。
  - 本文・ファイル名・住所・表示名の `[` を `［` に置換し、Chatwork 記法を無効化。
  - ChatworkClient.sendMessage を使用。通知先は LINE_INBOX_CHATWORK_ROOM_ID、未設定なら CHATWORK_DEV_ROOM_ID。既存の BLOOM_CHATWORK_DRY_RUN にも対応。
  - イベント単位で失敗をログに出し、次のイベントを処理して最終的に 200。空 events も外部通信せず 200。
- `src/app/api/system/line/inbox/[account]/route.test.ts`（新規）
  - 上記の正常系・異常系とアカウント間の署名分離を検証。
- `docs/dispatches/report-codex-493-line-oa-inbox-to-chatwork-20261030.md`（本レポート）

## テスト結果

- `npx tsc --noEmit`：成功（終了コード 0）。
- `npx vitest run src/app/api/system/line`：成功（7 ファイル、78 テスト）。
- テストでは LINE のプロフィール取得と Chatwork 送信をモック化。実際のお客さま・Chatwork への送信はしていない。

## 判断した点・迷った所

- `src/middleware.ts` の matcher は既に `/api` 全体を除外している。新しい `/api/system/line/inbox/` もログイン不要なので、middleware の変更は不要と判断。
- 既存 webhook の動きを保つため、署名関数の共通化は行わず、新規受け口内で同じ確認方式を実装した。
- Chatwork トークンや通知先がない状態も通知できないため、LINE の認証設定不足と同じく 503 にした。
- 不正 JSON / 配列でない events は 400。未対応のメッセージ種別には「（未対応のメッセージ）」を使用。
- Next.js 同梱の route.md を確認し、動的パラメータは Promise を await する形で実装。

## 利用開始時の設定

1. LINE_HIKARI_CHANNEL_SECRET / LINE_HIKARI_CHANNEL_ACCESS_TOKEN / LINE_SHOKAI_CHANNEL_SECRET / LINE_SHOKAI_CHANNEL_ACCESS_TOKEN と CHATWORK_API_TOKEN を設定する。
2. 最初は LINE_INBOX_CHATWORK_ROOM_ID を未設定にして CHATWORK_DEV_ROOM_ID の開発ルームへ送るか、LINE_INBOX_CHATWORK_ROOM_ID に開発ルームを明示する。
3. 各 LINE アカウントの Webhook URL を、それぞれ `/api/system/line/inbox/hikari` と `/api/system/line/inbox/shokai` に設定し、Webhook 検証・実メッセージ通知を確認する。
4. 開発ルームで合格後、LINE_INBOX_CHATWORK_ROOM_ID を `451851099` に切り替える。環境変数の変更・実配信確認は今回実施していない。

LINE への返信、DB 変更、cron、ポーリング、再試行処理は追加していない。追加した定期実行・定期取り直しは 1 日 0 回。対象メッセージごとにプロフィール取得を最大 1 回、Chatwork 通知を 1 回試みる。

git コマンドは一切実行していない。
