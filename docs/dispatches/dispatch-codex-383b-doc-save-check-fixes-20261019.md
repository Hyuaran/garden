# Codex-383b：契約書・条件表の保存チェックの直し 3 点（Claude のレビューから）（2026-10-19）

前の指示書：`docs/dispatches/dispatch-codex-383-doc-save-check-20261019.md`（作ったものは未コミットのまま作業ツリーにある）

## 直すこと
1. **人が消したファイルを毎日知らせない**：`judge.ts` の status `"previously-saved"`（自動保存した記録はあるが、保存先に無い＝人が未整理フォルダから消した）は、**未保存（missing）に数えず、知らせ（reportMessage）にも出さない**。件数（counts.previouslySaved）としてだけ残し、知らせの最後の 1 行の「自動保存履歴あり n 件」には出してよい。知らせを送るかどうかの判定（missing か autosaved が 1 件以上）にも入れない
2. **添付の中身のダウンロードを候補だけにする**：今は添付付きのメールすべてで添付の中身（contentBytes）を取っている。24 箱では添付付きが数百通あり時間切れ（Vercel 300 秒）のおそれ。
   - 添付の一覧は中身なしで取る（`/attachments?$select=id,name,contentType,size,isInline` ＋ `@odata.type` で fileAttachment だけ）
   - `classifyAttachment` を名前・大きさ・拡張子・メールで判定し、候補になった添付だけ `/attachments/{id}`（`$value` か `contentBytes`）で中身を取る
   - `fetchMessageAttachments` の今の形を使う所があれば合わせて直す。テストも合わせる
3. **新しく作ったファイルの先頭の BOM（U+FEFF）を外す**（`src/lib/doc-save-check/*.ts`・`src/app/api/system/doc-save-check/cron/*.ts`・migration）。リポジトリの他のファイルと同じ UTF-8（BOM なし）にする

## 守ること
- commit・push しない。DB・本物の Drive／Graph／Chatwork に接続しない
- 支払漏れチェックの動き・テストを変えない
- `npx vitest run src/lib/doc-save-check src/lib/mail-payment-check src/app/api/system` と `npx tsc --noEmit -p .` が通ること

## 報告（日本語・コードブロック）
変えたファイルと、テストの結果だけ短く。
