# Codex-399：従業員マスタの「最終同期 なし」を社長スタイルの型に（2026-10-21）

正本：社長スタイル `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5（最終更新の決まり）・§2.6

## 今
- `C:\garden\a-bloom-008\src\app\root\employees\page.tsx`：検索欄の横に「最終同期 なし」（`formatRosterSyncLine`）と文字ボタン「名簿と同期」
- 時刻はその画面で「名簿と同期」を押したあとの結果（rosterSyncResult）からしか出ないので、開き直すといつも「なし」
- 記録はある：表 `root_roster_sync_log`（synced_at・dry_run・updated_count・auth_banned_count など。毎朝 6:00（UTC 21:00）の cron `/api/root/roster-sync/cron` と手動の同期）

## 東海林さんの決定（2026-10-21）＝型に合わせる
```
Root / 従業員マスタ
従業員マスタ
                         従業員名簿最終更新：2026/10/21(水) 06:00 (↻)   ← h1 の下・右寄せ・UpdatedStamp
（検索欄・ボタンの並び。「最終同期 なし」と文字ボタン「名簿と同期」は消す）
```
- 時刻＝`root_roster_sync_log` の dry_run=false の最新の synced_at（画面を開いたとき読む。一覧の API に足すか、別に読む）。無ければ「未取得」
- ↻＝今の「名簿と同期」と同じ動き（押すと同期・同期中は回る・押せない）。aria-label／title「Kintone の従業員名簿と同期する」。同期できる権限が無い人には ↻ をグレー（押せない）
- 同期が終わったら、今の「（更新 n・無効化 n）」の中身を知らせの 1 行（画面の上の通知か、↻ の近くの小さな文字）で出し、時刻を新しくする
- 共通の部品 `C:\garden\a-bloom-008\src\app\system\_components\UpdatedStamp\` を使う（Root の他の画面と同じ置き方）

## テスト
- 開いたときに最新の同期の時刻が出る（記録なし＝未取得）
- ↻ で同期が呼ばれ、終わると時刻と結果の 1 行が出る／権限が無いとグレー
- 「最終同期 なし」「名簿と同期」の文字が無い
- テストの中に絵文字を書かない

## 守ること
- commit・push しない。DB・外部 API に接続しない
- 同期の中身（何を書き換えるか）は変えない
- `npx vitest run src/app/root src/app/api/root` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果だけ短く。
