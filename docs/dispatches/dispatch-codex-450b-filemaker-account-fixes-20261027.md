# Codex-450b：FileMaker アカウント自動化の手直し（4 点）

あなたは Codex-450b です。作業場所は C:\garden\a-bloom-008（main）。**commit・push はしない**。Codex-450 で作ったファイルだけを直す。長い説明は不要。終わったら `npx tsc --noEmit` と関係するテスト（`src/app/system/onboarding/` 配下・`src/app/api/system/filemaker-accounts/` 配下）を流し、`src` と `scripts` を `???` で検索する。

1. **1 件の不備で全員が止まらないように**（`src/app/system/onboarding/_lib/filemaker-accounts.server.ts` の `agentWork`）
   今は誕生日が無い／hired でない依頼が 1 件あると throw して、全員の依頼が返らない。その依頼だけ waiting のファイルを `failed`（error「入社情報（誕生日）を確認してください」）にして保存し、通知（`reconcileRequest`）を走らせ、他の依頼は普通に返す。

2. **毎回すべての済み依頼を見直さない**（同 `checkFilemakerRequests`）
   今は done を含む全行を毎回 `reconcileRequest` している（入社のたびに増え続ける）。対象は「status が waiting/sent/failed の行」＋「done で updated_at が 2 日以内の行」だけにする。

3. **確認欄の自動チェックの書き方**（同 `reconcileRequest`）
   `.eq("checklist", JSON.stringify(c.checklist))` は jsonb の比較として当てにならない（キーの並びで外れる）。`.is("checklist->filemaker_added", null)` を条件にして `checklist` を既存の中身とマージして更新する形に変える（既に付いていれば何もしない）。手で付けたチェックは上書きしない。

4. **一時的な接続切れで「失敗」にしない**（`scripts/filemaker-account-agent/FilemakerAccountAgent.ps1`）
   今は ODBC の例外が起きると `step:"checked", error` を送って failed にしてしまい、FileMaker サーバーが一瞬落ちただけで［もう一度］が必要になる。例外のときは結果を送らずログだけ残す（状態は waiting/sent のまま。30 分止まったら Garden 側の「止まっている」通知が出る）。FileMaker が返したエラー番号（status が pending でも 0 でもない値）はこれまで通り failed として送る。README の説明もこれに合わせる。

テスト：1〜3 を vitest に足す（不備の 1 件があっても他の依頼が返る／done の古い行は見ない／既に手でチェック済みなら更新しない）。

## 完了報告（この形で）
- 変更ファイル
- tsc／テストの結果（コマンドと件数）
- `???` 検索の結果
