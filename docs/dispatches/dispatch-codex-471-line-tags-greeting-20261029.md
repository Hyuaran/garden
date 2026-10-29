# Codex-471：公式 LINE（official｜通知）に「タグ」と「人に合わせたあいさつ」と「タグで絞った一斉送信」を作る（2026-10-29）

## 東海林さんの話
- 公式 LINE「official｜通知」（@586gtqpd）は、自動送信の都合で、今後は従業員以外も使う見込みが大きい。
- LINE 管理画面の「あいさつメッセージ」（友だち追加で全員に同じ文）はオフにして、**Garden で紐づいたときに、その人に合った文を Garden から送る**。
- **友だち追加のときの Garden の返事は「友だち追加ありがとうございます。official｜通知です。」だけ**にする（連携の案内は出さない。従業員は入社手続きの中で連携する）。
- Garden で**タグ**を付け、タグ（グループ）ごとに絞って一括送信もできるようにする。タグは 5 種類（決定）：
  | 種類 | 中身 | 付け方 |
  |---|---|---|
  | 雇用形態 | 正社員／アルバイト／業務委託 | Root の名簿から自動 |
  | 事業 | ブロードバンド事業／NHK派遣事業（あとで増やせる） | 画面で付ける |
  | 在籍 | 入社予定／在籍中／退職 | Root の名簿から自動（入社日・退職日・is_active） |
  | 役割 | トス／クローザー／CS／事務 | Root の役職から自動（toss→トス・closer→クローザー・cs→CS・それ以外の社員→事務。業務委託はなし） |
  | 自由タグ | 例：上田チーム、研修中 | 画面で作って付ける |
- リッチメニューの出し分けは次の Codex-472（今回は作らない）。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5〜§2.7。画面の文字に略称・開発者用語を書かない。絵文字なし（印は SVG の線）。

今の作り（読んでから作る）：
- 受け口 `src/app/api/system/line/staff/webhook/route.ts`（`FOLLOW_REPLY`・`LINK_GUIDE`・「連携 社員番号」と入社手続きの 1 回限りの文 `parseOneTimeLink` での紐づけ・紐づけ成功の返事「〇〇さんとして登録しました」）
- 送る部品 `src/lib/line/staff-client.ts`（`replyLineStaff`・`pushLineStaff`・`getLineStaffQuota`）
- 紐づけの列 `root_employees.line_user_id / line_display_name / line_linked_at / line_link_source`、`supabase/migrations/20261014000002_line_staff_link.sql`・`20261024000002_system_line_link_codes.sql`
- 出勤表の LINE 送信 `src/app/api/system/shukkin/line-send/route.ts`（一斉送信の書き方の参考）
- Kintone 従業員名簿の事業名（`KINTONE_EMPLOYEE_ROSTER_*`）：事業タグの初期値の参考にしてよい（自動で決めきれないものは空のまま）

## 1. 友だち追加の返事
- `FOLLOW_REPLY` を「友だち追加ありがとうございます。official｜通知です。」だけにする（`LINK_GUIDE` は友だち追加では出さない。連携されていない人が文を送ってきたときの案内は今のまま）。

## 2. 紐づいたときのあいさつ（返信で送る＝月の送信数に入らない）
- 「連携 社員番号」でも、入社手続きの 1 回限りの文でも、**紐づいたときの返事（replyToken）の吹き出しに続けて**、その人に合ったあいさつを送る（同じ返信で吹き出し 5 つまで。足りなければ切り詰める）。push は使わない。
- あいさつ文の選び方：その人のタグ（雇用形態 × 事業）に一致する文 → 雇用形態だけ一致 → 共通の文、の順で 1 つ選ぶ。
- 文の中で使える置き換え：`{名前}`（氏名の姓）。リンクは文の中に URL をそのまま書く。
- 初期の文（下書き。画面で直せる）：今の LINE のあいさつメッセージを元に、共通の文 1 つを入れておく：
```
{名前}さん
はじめまして！official｜通知です。
友だち追加ありがとうございます。

このアカウントでは、勤務に関する連絡や周知をお送りします。
通知は「オン」にしておいてください。
```
  （区分ごとの文は東海林さんが画面で足す。Claude があとで下書きを入れる）

## 3. タグ
- migration `supabase/migrations/20261029000471_system_line_tags.sql`：
  - `system_line_tag`（id・kind：'employment'|'business'|'status'|'role'|'free'・name・sort・created_at）
  - `system_line_tag_member`（tag_id・employee_id・source：'auto'|'manual'・created_at・unique(tag_id, employee_id)）
  - `system_line_greeting`（id・employment_tag_id null 可・business_tag_id null 可・body・enabled・updated_at・updated_by）。共通の文は両方 null の 1 行。
  - `system_line_broadcast`（id・title・body・tag_ids・recipient_count・sent_count・failed_count・created_by・created_at・sent_at）
  - RLS：読み書きは全権管理者だけ（画面の入口からは service_role）。
- 自動のタグ（雇用形態・在籍・役割）は、画面を開いたときと一斉送信の前に Root の名簿から付け直す（source='auto' の行だけ入れ替える。手で付けた行は消さない）。
- 本番 DB に当てるのは Claude。Codex は当てない。

## 4. 画面：System ＞「公式 LINE」 `/system/line`
- 全権管理者だけ。社長スタイル §2.5 の型。タブ 3 つ：
  1. **人とタグ**：在籍者と紐づき状態の一覧（DataTable：氏名・社員番号・LINE の紐づき（済／未）・雇用形態・事業・在籍・役割・自由タグ）。事業タグと自由タグは行ごとに付け外し（BoxSelect）。自由タグの作成・名前変更・削除。
  2. **あいさつ文**：区分（雇用形態 × 事業／雇用形態だけ／共通）ごとの文の一覧と編集。編集の横に「この文が送られる人の数」を出す。［自分に試しに送る］（東海林さんの LINE に push で 1 通。押す前に「送信数に 1 通数えます」と出す）。
  3. **一斉送信**：タグを選ぶ（同じ種類の中は「または」、違う種類どうしは「かつ」）→ 送る人の数と名前の一覧（LINE の紐づきがある人だけ）→ 文を書く → ［送信する］の前に「〇人に送ります。今月の残りは〇通です（getLineStaffQuota）」と確認 → push で送る（500 人ずつ）。送った記録（system_line_broadcast）の一覧。
- 画面の絵（人とタグ）：
```
System / 公式 LINE
公式 LINE                                    LINE 最終更新：2026/10/29(木) 14:10:05 ↻
[人とタグ] [あいさつ文] [一斉送信]
──────────────────────────────────────────────
絞り込み：[雇用形態 ▼][事業 ▼][在籍 ▼][役割 ▼][自由タグ ▼]
| 氏名 | 社員番号 | LINE | 雇用形態 | 事業 | 在籍 | 役割 | 自由タグ |
| 上田 基人 | 0004 | 未 | 正社員 | [ブロードバンド事業 ▼] | 在籍中 | 事務 | [ ▼ ] |
```
- 業務管理ツールの登録簿（`src/app/system/forms/_data/gyomu-tools.json`）とサイドバー（System）に「公式 LINE」を足す（全権管理者だけに見える）。

## 5. テスト
- 友だち追加の返事の文。紐づいたとき：返事＋あいさつが同じ replyToken で送られる・push を使わない・区分の選び方（雇用形態×事業 → 雇用形態 → 共通）・`{名前}` の置き換え。
- 自動タグ（雇用形態・在籍・役割）の付け直しで手で付けたタグが消えない。
- 一斉送信：タグの絞り込み（同じ種類は「または」・違う種類は「かつ」）・LINE 未紐づけと退職者を除く・送る前の人数と残り通数・500 人ずつ。
- 全権管理者以外は画面も入口も 403。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。LINE へ実際に送らない。**

## 実装時の取得回数
- 定期的な取得・cron の追加は無し（1 日 0 回）。画面を開いたときに名簿・タグ・紐づきを 1 回読み、一斉送信の確認のときに残り通数を 1 回読む。紐づいたときのあいさつは返信（送信数 0）。一斉送信と試し送信だけが送信数に数える。
