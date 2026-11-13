# Codex-530 コール履歴の送り込みを「変わった行だけ・圧縮して」送る（Vercel の料金を下げる）（2026-11-13）

作業場所：`C:\garden\a-bloom-008`（main）。

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない。FileMaker・Garden の本番 API を本当に呼ばない（テストはモック・DryRun）。** ファイルは UTF-8（日本語入り ps1 は今と同じ UTF-8 BOM 付き）・既存の改行に合わせる。文字化け（??）を残さない。必要な範囲だけ読む。

## 背景（Claude が Vercel の画面で確かめたこと）

Vercel の超過料金の最大は「高速オリジン転送」（9/20〜10/20 で 92GB・24.87 ドル）。行き先別では `/api/system/call-ingest` が過去 7 日で **4.02GB**（2 位の shineigyo-ingest は 342MB）。

ホスト PC の `scripts/callcenter-agent/CallCenterAgent.ps1` は `pollSeconds`（300）ごとに、増分に加えて **直近 `refreshWindowDays`（今日と昨日）の全行を毎回送り直し**、60 分ごとに 7 日分を送り直している（README 参照）。行の中身が変わっていなくても毎回同じ行を送っている。

## やること

### 1. エージェント：前回送った中身と同じ行は送らない

- 送った行ごとに「主キー → 中身の要約（送る項目を決まった順に並べた文字列の SHA-256）」をホスト PC の state ディレクトリに保存する（`stateDirectory`。今の `state.json` とは別ファイルでよい。原子的に書く＝一時ファイル→置き換え）。
- 読み返し（recent・full の両方）で読んだ行は、要約が前回と同じなら送らない。新しい主キーと中身が変わった行だけ送る。増分（主キー > last_max）の行はいつも送る。
- 保存する要約は、`fullRefreshWindowDays`（7）より古いコール日の行を消して大きくならないようにする。
- **送信が成功した行だけ**要約を更新する（失敗・partial・DryRun・`-MaxRows`・明示 backfill では更新しない。今の state 更新の決まりに合わせる）。
- 1 日 1 回（例：日本時間 3:00 以降の最初の full 読み返し）は要約を見ずに 7 日分を全部送る（Garden 側が何かで欠けても自然に直るように）。設定 `fullResendHourJst`（既定 3）で変えられるようにする。
- ログの `sync completed` に `refresh_rows`（読んだ数）に加えて `refresh_skipped_unchanged`（送らなかった数）を出す。

### 2. 送る中身を gzip で圧縮する

- エージェント：POST の本文を gzip で圧縮し、`Content-Encoding: gzip`・`Content-Type: application/json` で送る（PowerShell 5.1・32bit。`System.IO.Compression.GZipStream` で byte[] を作り `Invoke-RestMethod -Body <byte[]>`）。設定 `gzipRequestBody`（既定 true）で切れるように。
- Garden：`src/app/api/system/call-ingest/route.ts` は `Content-Encoding: gzip` のときに本文を gunzip してから今と同じ処理。gzip でない今の形も受け付ける（エージェントの入れ替え前後どちらでも動くように）。展開後の大きさに上限（例：20MB）を設け、超えたら 413。
- 同じ送り方の `ShineigyoSnapshot.ps1`（shineigyo-ingest・342MB/週）も gzip にして、`/api/system/shineigyo-ingest` も同じく gzip を受け付ける。

### 3. ホスト PC での入れ替え手順

- `scripts/callcenter-agent/install-changed-only-paste.txt` を作る：ホスト PC の PowerShell に貼るだけで、①今のタスクを止める ②配布した ps1 を置き換える（置き場所は README の今の手順に合わせる・既存 `config.json` は置き換えず足りない設定だけ足す）③タスクを再開 ④最初の 1 回のログで `refresh_skipped_unchanged` が出ていることを確かめる、まで。戻し方（元の ps1 に戻す）も書く。
- README に、変わった行だけ送る仕組み・gzip・新しい設定・戻し方を追記。

## テスト

- エージェント（`scripts/callcenter-agent/tests` の今の Pester／テストの形に合わせる）：同じ行は 2 回目に送らない／中身が変わった行は送る／送信失敗時は要約を更新しない／1 日 1 回の全送り／古い要約の削除／gzip 本文が正しく展開できる
- Garden：gzip 本文・非 gzip 本文の両方を受け付ける／壊れた gzip は 400／大きすぎる本文は 413（call-ingest・shineigyo-ingest）
- `npx tsc --noEmit`、`npx vitest run src/app/api/system/call-ingest src/app/api/system/shineigyo-ingest` が通ること。エージェントのテストも流す（流せないなら理由を報告）

## 終わったら

`docs/dispatches/report-codex-530-call-ingest-send-changed-only-20261113.md` に、直したファイル・テスト結果・1 回の送信で減る見込み・迷って決めたこと。マニュアルは不要（Claude がやる）。
