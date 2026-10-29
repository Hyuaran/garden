# Codex-485：退職日が入ったら「マネーフォワード クラウドのアカウントを止めてください」を Garden｜通知に知らせる（2026-10-29）

## 東海林さんの話（開発ボードの回答）
- 2026-10-27 に決めた「マネーフォワード クラウド（以下 MF）の利用停止の流れ」の①：社員名簿に退職日が入ったら Garden が知らせる。**知らせ先は Garden｜通知のルーム**（環境変数 `GARDEN_NOTICE_CHATWORK_ROOM_ID`・既定 450125458）。
- 止めるのは人の手（MF には API で書き込まない決まり）。東海林さんが Claude に頼めば、手順書（技術レシピ mf-user-suspend）どおり Claude が代わりに止める。
- 9 月に辞めた人は 10 月末の給与の支給のあと（11 月初め）に止めたい＝**止めるのは最後の給与の支給が済んでから**。

先に読む：既存の「知らせ」の作り（例 `src/lib/doc-save-check/notify.ts`・`src/lib/innovera/sync.server.ts` の Chatwork 送信）と、退職日 `root_employees.termination_date` を書いている所（名簿の取り込み `src/app/root/_lib/roster-sync.server.ts`・Root の従業員の画面）。Chatwork の部品 `src/lib/chatwork/client.ts`。長い説明は不要・ファイルは必要な範囲だけ読む。

**触ってよい場所：新しく作る `src/lib/mf-stop-notice/`・`src/app/api/system/mf-stop-notice/`・migration・テストだけ。** 名簿の取り込みや Root の画面は書き換えない（読むだけ）。`vercel.json` は触らない（Claude が初回の確認のあとに足す）。

## 作るもの
1. **知らせを出したかの記録**（migration `20261029000485_mf_stop_notice.sql`・作成のみ）：`root_employees` に `mf_stop_notified_at timestamptz` を足す（または別の表。どちらか簡単な方）。
2. **毎朝の確認の入口** `GET /api/system/mf-stop-notice/cron`（Vercel の cron は GET・`CRON_SECRET` で確かめる。ほかの cron の入口と同じ確かめ方）：
   - 対象＝`termination_date` が入っていて、まだ知らせていない人（`mf_stop_notified_at` が空）。**今日から 60 日より前に辞めた人は対象外**（昔の退職者を一度に大量に知らせないため。初回は特に）。
   - 対象がいれば Garden｜通知に **1 通にまとめて**送る：
     ```
     [info][title]マネーフォワード クラウドのアカウントの停止のお願い[/title]
     退職日が入った人がいます。最後の給与の支給が済んでから、アカウントを止めてください。
     ・山田 太郎（社員番号 1234・退職日 2026-10-31・メール yamada@…）
     止めるときは Claude に「MF の〇〇さんを止めて」と頼めば、手順書どおり代わりに止めます。[/info]
     ```
     メールは名簿のメールアドレス（無ければ「メールの登録なし」）。法人名は書かない。
   - 送れたら、その人たちの `mf_stop_notified_at` を入れる。送れなかったら入れない（次の日にもう一度）。
   - 対象が 0 人なら何も送らない。
   - `?dryRun=1` で送らずに対象だけ返す（Claude が初回に確かめる）。
3. テスト：対象の選び方（未通知・60 日以内）・1 通にまとめる・送れたときだけ記録・0 人なら送らない・dryRun は送らない。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。cron に足す行（時刻は日本時間 10:00 以降＝UTC 1:00 以降）を報告に書く（`vercel.json` は触らない）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。Chatwork に送らない。**

## 実装時の取得回数
- cron 1 日 1 回（Claude が初回の確認のあとに足す）。1 回につき名簿の読み 1 回＋送るときだけ Chatwork 1 通。
