# Codex-532 メール送信失敗の見張り：Microsoft が答えないときに早く切り上げる（2026-11-13）

作業場所：`C:\garden\a-bloom-008`（main）。

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない。Microsoft Graph・Chatwork を本当に呼ばない（テストはモック）。** ファイルは UTF-8・既存の改行に合わせる。文字化け（??）を残さない。必要な範囲だけ読む。

## 背景（Claude が確かめたこと）

- `/api/system/mail-ndr-watch/cron`（15 分ごと）は、直近 12 時間で 1 回あたり約 2 分かかり、7 割が失敗（Vercel の画面）。Vercel のメモリ代（Fluid Provisioned Memory）が増えている。
- 2026-11-13 の手元の試験：Microsoft Graph の受信箱の読み取りが、どの形の問い合わせでも 502／504 を **21〜30 秒待って**返す（`/users/{mb}/messages?$top=1` でも同じ）。DB の `system_mail_ndr_watch_state` は outage=true・最後の成功 2026-11-12 20:00Z。Microsoft 側の問題で、コードでは直らない。
- 今の作り：`src/lib/mail-payment-check/graph-mail.ts` の `graphFetch` は 429・5xx で 3 回まで待って再試行（500ms×2^n）。1 回の問い合わせに時間の上限が無い。`src/lib/mail-ndr-watch/graph.ts` の `collect` は 3 つの受信箱を順に読み、どれかで失敗しても次の受信箱を読みに行く前に全体が throw するまで待つ。1 回の失敗で 30 秒×4 回×… と積み上がる。
- 失敗が続くと `windowStart` が最後の成功から伸び続け、復旧後の 1 回目の読み込みが重くなる。

## やること（mail-ndr-watch だけ。支払漏れチェックなど graph-mail を使うほかの機能の動きは変えない）

- `collect` で使う Graph の呼び出しに、1 回あたりの時間の上限（例：15 秒・`AbortSignal.timeout`）を付ける。graph-mail の `graphFetch` に options で上限と再試行回数を渡せるようにし、既定は今のまま（ほかの機能に影響させない）。
- mail-ndr-watch では 5xx・時間切れの再試行は 1 回まで。最初の受信箱で Graph が 5xx／時間切れなら、残りの受信箱は読まずにすぐ失敗として返す（今の outage の知らせの動きはそのまま）。
- 読み取る範囲は最大 24 時間に抑える（`windowStart` が 24 時間より前なら 24 時間前から。抑えたときは結果に `window_capped: true`）。
- 1 回の実行全体にも上限（例：60 秒）を設け、超えたら失敗として返す。`maxDuration` は 300 のままでよい。

## テスト

- Graph が 502 を返す → 1 回の実行で Graph を呼ぶ回数が上限内（最初の受信箱で止まる）・失敗として返る・outage の知らせは 1 回
- 時間切れ → 失敗として返る
- 窓が 24 時間で抑えられる
- graph-mail の既定の動き（支払漏れチェック側）が変わらない（既存テストが通る）
- `npx tsc --noEmit`、`npx vitest run src/lib/mail-ndr-watch src/lib/mail-payment-check src/app/api/system/mail-ndr-watch` が通ること

## 終わったら

`docs/dispatches/report-codex-532-mail-ndr-watch-fail-fast-20261113.md` に、直したファイル・テスト結果・迷って決めたこと。マニュアルは不要（Claude がやる）。
