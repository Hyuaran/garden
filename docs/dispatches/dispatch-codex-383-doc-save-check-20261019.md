# Codex-383：契約書・条件表の保存チェック（段階 1 知らせる＋段階 2 未整理フォルダへ自動保存）（2026-10-19）

## 正本（必ず全文を読む）
`C:\Claude\000_Garden\150_System_システム\00_マニュアル\24_契約書・条件表の保存チェック\Garden_System_契約書・条件表の保存チェック_4_仕様書_Claude読み込み用.md`

## 手本（同じ型で作る）
支払漏れチェック：`src/lib/mail-payment-check/`（graph-mail.ts・classify.ts・lookups.ts・judge.ts・notify.ts・run.ts・テスト）と `src/app/api/system/mail-payment-check/cron/route.ts`・`supabase/migrations/20261015000002_system_mail_payment_check_runs.sql`

## 作るもの
1. **Graph の読み取りの共通化**：`src/lib/mail-payment-check/graph-mail.ts` を、支払漏れチェックの動きを変えずに、宛先（toRecipients）・添付の有無（hasAttachments）も取れるようにする（取る項目は呼び出し側で選べる形でもよい）。添付の一覧と中身（contentBytes）を取る関数を足す（`/users/{box}/messages/{id}/attachments`・fileAttachment だけ・isInline は除く）。一時的な失敗（429・5xx・通信切れ）は 3 回までやり直す。**支払漏れチェックのテストはそのまま全部通ること**
2. **`src/lib/doc-save-check/`**
   - `classify.ts`：④§4 の 2〜5（候補の言葉・除く言葉・向き・種類と保存先・対象の拡張子）。言葉は配列でまとめて後で調整しやすく
   - `drive-index.ts`：保存先フォルダの下（サブフォルダ全部）のファイルの md5Checksum の一覧を作る（フォルダを順にたどる。`'<id1>' in parents or '<id2>' in parents …` のように数十フォルダずつまとめて問い合わせて回数を減らす・supportsAllDrives・pageSize 1000・nextPageToken）。一時的な失敗は 3 回までやり直し、それでも失敗なら投げる
   - `save.ts`：保存先の下の「00_自動保存（未整理）」を `findOrCreateSubfolder` で用意し、`uploadToFolder` でファイル名 `YYYYMMDD_差出人名_元のファイル名`（ファイル名に使えない文字は全角か「_」に置き換え）で保存
   - `judge.ts`・`notify.ts`・`run.ts`：④§4・§5 のとおり。添付の MD5 は node:crypto で計算。同じ MD5 は 1 回にまとめる。段階 2 はスイッチ `DOC_SAVE_CHECK_AUTOSAVE === "on"` のときだけ保存し、`system_doc_saved_files` にある MD5 は保存しない。dry（`apply: false`）は送らない・保存しない・記録しない
   - テスト：判定（言葉・向き・種類・除外）・MD5 の突き合わせ・二度保存しない・スイッチ切りでは保存しない・dry・失敗通知の 1 回化（支払漏れチェックの run.test.ts と同じ型）
3. **`src/app/api/system/doc-save-check/cron/route.ts`**（＋route.test.ts）：支払漏れチェックの cron と同じ（CRON_SECRET・`?dry=1` は管理者ログインでも可・`?force=1`）
4. **migration** `supabase/migrations/20261019000001_system_doc_save_check.sql`：`system_doc_save_runs`（ran_at・trigger・applied・ok・error・counts jsonb・items jsonb）と `system_doc_saved_files`（md5 主キー・kind・root_folder_id・drive_file_id・drive_url・message_id・mailbox・file_name・saved_at）。RLS 有効（service role で読み書き）。**適用は Claude がする**
5. **vercel.json の cron 行はまだ足さない**（初回は行なしで配備する決まり）

## 守ること
- **commit しない・push しない・DB に接続しない・本物の Drive／Graph／Chatwork に繋がない**（確かめは Claude がする）
- 支払漏れチェックの動き・通知の文面・テストを変えない（graph-mail.ts の共通化で壊さない）
- 前から落ちているテストは無い。関係の無いファイルは触らない
- `npx vitest run src/lib/doc-save-check src/lib/mail-payment-check src/app/api/system` と `npx tsc --noEmit -p .` が通ること

## 報告（日本語・コードブロックで）
- 作った・変えたファイル
- 候補の言葉と除く言葉の一覧（最初の版）
- テストの結果（対象・型チェック）
- Claude が本物で確かめるときの手順（手元でドライランする呼び方）
