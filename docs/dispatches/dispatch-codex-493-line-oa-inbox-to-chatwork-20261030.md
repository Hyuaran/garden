# Codex-493 公式 LINE（ヒカリのプロ・紹介キャンペーン事務局）に届いたメッセージを Chatwork へ知らせる（2026-10-30）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。

## 東海林さんの依頼（画面の言葉）
「ヒカリのプロ」と「紹介キャンペーン事務局」の公式 LINE にお客さまから届いたメッセージを、Chatwork のルーム「公式LINE【Web集客】」（ルームID 451851099）に送りたい。送った人の LINE の表示名も入れる。

## 届く形（Chatwork）
```
[info][title]ヒカリのプロ からメッセージが届きました[/title]送った人：山田 太郎
1
2
3[/info]
```
- 見出しの「ヒカリのプロ」はアカウント名（紹介キャンペーン事務局なら「紹介キャンペーン事務局 からメッセージが届きました」）
- 本文は届いた文そのまま（改行もそのまま）
- 文以外：画像＝（画像）／動画＝（動画）／音声＝（音声）／スタンプ＝（スタンプ）／ファイル＝（ファイル：ファイル名）／位置情報＝（位置情報：住所）
- 表示名が取れないとき＝「送った人：（名前を取得できませんでした）」
- 本文の中の Chatwork の記法（`[info]` `[/info]` `[To:…]` `[title]` など `[` で始まる記法）が効かないようにする（`[` を全角の `［` に置き換えるなど）。見出しが壊れたり、勝手に TO が飛んだりしないこと

## 作るもの
1. 受け口：`src/app/api/system/line/inbox/[account]/route.ts`（POST）
   - `account` は `hikari`（ヒカリのプロ）と `shokai`（紹介キャンペーン事務局）の 2 つだけ。ほかは 404
   - 署名の確認：`x-line-signature` を、そのアカウントの Channel secret で HMAC-SHA256（base64）して照合（今の `src/app/api/system/line/webhook/route.ts` の `verifyLineSignature` と同じやり方。共通にできるなら共通の関数にしてよい）。合わなければ 401
   - 環境変数：`LINE_HIKARI_CHANNEL_SECRET`・`LINE_HIKARI_CHANNEL_ACCESS_TOKEN`・`LINE_SHOKAI_CHANNEL_SECRET`・`LINE_SHOKAI_CHANNEL_ACCESS_TOKEN`。未設定なら 503 にしてログに出す
   - 送り先のルーム：環境変数 `LINE_INBOX_CHATWORK_ROOM_ID`（未設定なら `CHATWORK_DEV_ROOM_ID`）。最初は開発ルームで試し、合格後に 451851099 に切り替える
   - 対象：`type === "message"` かつ `source.type === "user"`（1 対 1 のトーク）だけ。友だち追加・ブロック・グループは何もしない
   - 表示名：`GET https://api.line.me/v2/bot/profile/{userId}`（そのアカウントのアクセストークン）。失敗しても Chatwork への知らせは送る
   - 送信：既存の `ChatworkClient`（`@/lib/chatwork/client`・`CHATWORK_API_TOKEN`＝【事務局】システム自動通知）で `sendMessage`
   - LINE の「Webhook の検証」（events が空）は 200 を返す
   - 1 件の送信に失敗してもほかのイベントは続け、最後は 200 を返す（LINE に送り直させない）。失敗はログに出す
   - LINE へは返信しない（お客さまには何も送らない・月の送信数を使わない）
2. ログインなしで LINE から届くようにする：今の `/api/system/line/webhook` がログイン不要になっている仕組み（middleware など）を探し、同じように `/api/system/line/inbox/` を通す
3. テスト `route.test.ts`：署名 OK／NG、文・画像・スタンプ・ファイル、表示名が取れない、記法の無効化、知らない account は 404、空の events は 200

## やらないこと
- 定期実行（cron）は作らない
- DB の表は作らない
- 今のスタッフ連絡用の webhook の動きは変えない
- git は触らない

## 終わったら
`npx tsc --noEmit` と `npx vitest run src/app/api/system/line` が通ること。
`docs/dispatches/report-codex-493-line-oa-inbox-to-chatwork-20261030.md` に、直したファイル・テストの結果・迷った所を書く。
