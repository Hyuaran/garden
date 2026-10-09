# Codex-369：【損益】センターライズ（Kintone）の支払待ちを見張り、通知・請求書リンク入力・振込依頼／振込実行の自動作成・前日通知を行う（2026-10-09）

## 目的（東海林さんの言葉）
- 「カテゴリー：支払待ち かつ ステータス：支払待ち のレコードが登録（担当：金）されたらまず通知」
- 「支払待ち／入金待ちの該当請求書を Google ドライブ（08_SES事業部／明細・請求書）から探して、共有リンク URL をデータ格納先URL フィールドへ入力」
- 「支払待ちを振込依頼と振込実行にレコード作成。振込期日が年末年始を含む土日祝の場合、前営業日が振込期日」
- 「振込期日前日に通知。振込期日の前営業日に振込依頼（予約）がされてない場合、通知」
- 「振込依頼・振込実行の自動作成したときに Chatwork 通知も出してほしい」

決まっていること（2026-10-09 東海林さん）：通知先＝Garden通知ルーム（env の `GARDEN_NOTICE_CHATWORK_ROOM_ID`）／金額＝損益の「支払金額」／支払元＝レコードの［MF］社名（センターライズ／ヒュアラン）＝依頼会社＝実行会社、実行銀行＝センターライズ→ジャパンネット銀行・ヒュアラン→楽天銀行／年末年始＝12/30〜1/3／「予約されていない」＝振込実行のステータスが「完了」でない／損益アプリに「振込ID」欄を足す（東海林さんが追加。無ければ書かない）

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`（main 566af0f9）。**git の操作は一切しない**
- 新しく作る場所：`src/lib/pl-payments/`・`src/app/api/system/pl-payments/`・`supabase/migrations/20261009000001_system_pl_payment_tasks.sql`・テスト
- 流用する（**中身は変えない**）：`src/lib/chatwork`（`ChatworkClient`）・`src/lib/cron-auth`（`verifyBearerRequest`）・`src/app/api/bud/expense-drive/_lib/drive.ts`（`listDriveFolderEntries` ほか。drive.readonly で動いている）・`src/lib/supabase/admin`（`getSupabaseAdmin`）
- 触らない：`.env.local`・`vercel.json`（**cron の行は足さない**。初回は人が確認してから Claude が足す）・Kintone の振込依頼／振込実行の既存コード・本物の外部サービス（テストはモック）・INNOVERA 系
- 文言は日本語・開発者用語を出さない・絵文字なし

## 環境変数（Claude が用意する。コードは `process.env` から読むだけ）
| 名前 | 中身 |
|---|---|
| `KINTONE_SUBDOMAIN` | 既存（9j11u0q829lg） |
| `KINTONE_PL_CENTERRISE_APP_ID` | 36 |
| `KINTONE_PL_CENTERRISE_TOKEN` | 【損益】センターライズの API トークン（閲覧＋更新） |
| `KINTONE_TRANSFER_REQUEST_APP_ID` / `KINTONE_TRANSFER_REQUEST_TOKEN` | 既存（振込依頼 51） |
| `KINTONE_TRANSFER_EXECUTE_APP_ID` / `KINTONE_TRANSFER_EXECUTE_TOKEN` | 既存（振込実行 98） |
| `PL_INVOICE_DRIVE_FOLDER_ID` | `11ElkauoYT-ZmuxA1j3XRJC_yCzzJ4-SO`（Drive「明細・請求書」） |
| `PL_PAYMENTS_CHATWORK_ROOM_ID` | 通知先ルーム（最初は開発ルーム 433894375・確認後に Garden通知ルームへ。無ければ `GARDEN_NOTICE_CHATWORK_ROOM_ID`） |
| `CHATWORK_API_TOKEN`・`CRON_SECRET`・`GOOGLE_DRIVE_OAUTH_JSON` | 既存 |

## 元データ（Kintone【損益】センターライズ app 36）のフィールドコード
| 項目 | コード | 値の例 |
|---|---|---|
| カテゴリー | `カテゴリー` | 配列。`["支払待ち","支払"]` のように入る（**「支払待ち」「入金待ち」を含むかで判定**） |
| ステータス | `ドロップダウン_1` | 支払待ち／支払完了／入金待ち／入金完了／助成金入金待ち／助成金入金完了／人件費／未確認 |
| 区分 | `ドロップダウン_5` | 入金／助成金／支払／人件費 |
| 取引先会社名 | `ドロップダウン_2` | エンジンポット／クールジャパン／ヒュアラン／2Way／パワーハウス … |
| タスク名 | `ドロップダウン_6` | センターライズ／クールジャパン／… |
| ［MF］社名 | `ドロップダウン_4` | センターライズ／ヒュアラン |
| 担当者 | `ドロップダウン_0` | テスト1：金 ／ テスト1：BY |
| 支払金額 | `数値_9` | 585200 |
| 振込金額 | `数値_8` | （入金側で使われている。支払では使わない） |
| 支払期日 | `日付_5` | 2026-10-10 |
| 実績期間 | `日付_0` | 2026-08-01 など（請求書の年月の元） |
| データ格納先URL | `リンク` | https://drive.google.com/file/d/…/view?usp=sharing |
| 支払日 | `日付_6` | |
| 振込ID（東海林さんが追加予定） | 起動時に `app/form/fields.json` を読み、ラベルが「振込ID」の SINGLE_LINE_TEXT があればそのコードへ書く。無ければ書かない |

Kintone の注意：**GET に content-type を付けない**（400 になる）。`ドロップダウン_2 = "..."` は使えない（`in ("...")` を使う）。

## 記録表（新設・Supabase）`system_pl_payment_tasks`
| 列 | 内容 |
|---|---|
| `pl_record_id` text PK | 損益アプリのレコード番号 |
| `pl_revision` text | 最後に見た $revision |
| `category` text／`status` text／`vendor` text／`mf_company` text／`amount` bigint／`due_date` date／`effective_due_date` date（前営業日に寄せた日）／`period_month` text（YYYY-MM） |
| `notified_new_at` timestamptz | 新規通知を送った時刻 |
| `drive_url` text／`drive_url_set_at` timestamptz／`drive_match_note` text（見つからない／複数のときの理由） |
| `transfer_request_id` text／`transfer_execute_id` text／`transfer_id` text（FK-…）／`transfer_created_at` timestamptz／`transfer_note` text（口座不明などで作れなかった理由） |
| `reminder_sent_on` date（前日通知を送った日）／`unreserved_alert_sent_on` date（予約漏れ通知を送った日） |
| `last_error` text／`created_at`／`updated_at` |
索引：`effective_due_date`。RLS は他の system_ 表にならう（service_role だけ）。

## 処理 A：5 分ごと（`GET /api/system/pl-payments/cron`・Bearer `CRON_SECRET`・`maxDuration 300`）
1. 損益から **カテゴリー に「支払待ち」を含み ステータス＝支払待ち** のレコードと、**カテゴリー に「入金待ち」を含み ステータス＝入金待ち** のレコードを全件読む（`limit 500`・必要ならページ送り）。
2. **新規通知**（支払待ちだけ）：記録表に無いレコード番号＝新規。Chatwork に 1 通：
   ```
   [info][title]損益：支払待ちが登録されました[/title]取引先：エンジンポット（センターライズ）
   支払金額：585,200 円　支払期日：2026-10-10（振込は 2026-10-09）
   担当：金　レコード：https://9j11u0q829lg.cybozu.com/k/36/show#record=554[/info]
   ```
   複数件は 1 通にまとめる（1 件ずつ改行）。送ったら `notified_new_at` を記録。
3. **請求書リンク**（支払待ち・入金待ち両方・データ格納先URL が空のレコードだけ）：
   - 年月＝実績期間（`日付_0`）の年月。無ければ支払期日の前月。
   - Drive「明細・請求書」直下の期フォルダ（名前に「【決算第」を含む）をすべて → その直下の「YYYY年MM月」フォルダ（全角数字は半角に直して比較）→ その直下のファイル（`listDriveFolderEntries`）。
   - ファイル名の正規化（全角→半角・大文字→小文字・空白除去）に **取引先会社名** が含まれ、かつ `YYYY.MM`・`YYYYMM`・`YYYY年MM月` のいずれかを含むものを候補にする。
   - 候補 1 件 → `リンク` に `https://drive.google.com/file/d/<id>/view?usp=sharing` を書き（Kintone 更新）、`drive_url_set_at` を記録。0 件または 2 件以上 → 書かずに `drive_match_note` に理由を記録し、Chatwork で 1 回だけ知らせる（同じ理由が続く間は送らない。理由が変わったら送る）。
   - **共有設定は変えない**（閲覧権限のある社内の人が開けるリンクをそのまま使う）。
4. **振込依頼・振込実行の作成**（支払待ちだけ・`transfer_request_id` が空のレコード）：
   - 振込先の口座＝振込依頼（51）から **同じ取引先の最新レコード**を探す（`文字列__1行__7`（口座名義カナ）like 取引先会社名 または `文字列__1行__0`（お支払い先）like 取引先会社名、`ドロップダウン_2`（依頼会社名）が［MF］社名に当たる会社名、`$id desc limit 1`）。見つからない → 作らずに `transfer_note`＝「口座が分かりません」で Chatwork に 1 回だけ知らせる。
   - 支払期日の調整＝`effective_due_date`：土日・祝日・12/30〜1/3 なら**前営業日**に（祝日は `src/lib/pl-payments/business-day.ts` に 2026〜2027 年の祝日表を持つ。振替休日も含める。表の更新は年 1 回・④に書く）。
   - 作る中身（今日 Claude が手で作った 1773〜1775／1666〜1668 と同じ形）：
     | コード | 値 |
     |---|---|
     | `支払区分` | 振込 |
     | `ドロップダウン_6`（ステータス） | 支払待ち |
     | `ドロップダウン_8`（実行登録） | 済み（51・98 とも） |
     | `ドロップダウン_2`／`ドロップダウン_3` | ［MF］社名に当たる正式名（センターライズ→株式会社センターライズ／ヒュアラン→株式会社ヒュアラン） |
     | `ドロップダウン_4`（実行銀行） | センターライズ→ジャパンネット銀行／ヒュアラン→楽天銀行 |
     | `ドロップダウン`（依頼者） | 東海林 |
     | `文字列__1行__0`（お支払い先） | 元レコードのお支払い先 |
     | `文字列__1行__8`（お支払い内容） | `{実績期間 YYYY年MM月}分 {タスク名}`（タスク名が空なら取引先会社名） |
     | `数値`（振込金額） | 支払金額 |
     | `数値_1`（手数料） | 元レコードの手数料（空なら空） |
     | `文字列__1行__2/3/4/5/6/7`（銀行名・金融機関コード・支店名・支店コード・口座番号・口座名義カナ） | 元レコードのまま |
     | `ドロップダウン_7`＝1／`ドロップダウン_5`＝普通 | |
     | `日付`（依頼日） | 今日 |
     | `日付_0`（支払期日） | effective_due_date |
     | `文字列__1行__23`／`文字列__1行__36` | effective_due_date の MMDD／YYYYMMDD |
     | `文字列__1行_`（振込ID） | `FK-YYYYMMDD-NNNNNN`（51 の `文字列__1行_ like "FK-" order by 文字列__1行_ desc limit 1` の連番 +1） |
     | `文字列__1行__25`＝3／`文字列__1行__21`＝0 | |
     | `リンク` | 損益のデータ格納先URL（空なら損益のレコード URL） |
     | 51 の `重複キー`／98 の `文字列__1行__26` | `YYYYMMDD,会社,金融機関コード,支店コード,口座番号,金額,` |
     | 98 の `文字列__1行__41`（登録情報識別子） | 金融機関コード＋支店コード＋口座番号＋金額 |
   - **二重作成の防止**：作る前に 51 を `重複キー = "..."` で検索し、あれば作らずにその番号を記録する。98 も同じ（`文字列__1行__26`）。
   - 51 → 98 の順。98 に失敗したら 51 の番号は記録し、次回 98 だけ作る。
   - 作れたら Chatwork に 1 通：
     ```
     [info][title]振込依頼・振込実行を作成しました[/title]取引先：エンジンポット　585,200 円　振込期日：2026-10-09
     振込依頼 1773 ／ 振込実行 1666 ／ 振込ID FK-20261009-096116
     https://9j11u0q829lg.cybozu.com/k/98/show#record=1666[/info]
     ```
   - 損益アプリに「振込ID」欄があれば振込ID を書く。
5. 失敗の知らせ方は INNOVERA番号の同期と同じ：**障害ごとに 1 回＋回復時 1 回**（Kintone／Drive／Chatwork の接続失敗が続く間は毎回送らない）。fetch にはタイムアウト（20 秒）。

## 処理 B：毎朝（`GET /api/system/pl-payments/daily`・Bearer `CRON_SECRET`・想定 8:30 JST）
- 記録表から `transfer_request_id` のあるものを見て：
  - **明日の通知**：`effective_due_date` ＝ 翌営業日 のものを一覧で 1 通（`reminder_sent_on` が今日でないもの）。
  - **予約漏れの通知**：`effective_due_date` の**前営業日が今日**のもので、振込実行（98）の `ドロップダウン_6`（ステータス）が「完了」でないもの → 「予約されていません」と 1 通（`unreserved_alert_sent_on` が今日でないもの）。
  ```
  [info][title]明日 2026-10-10 が振込期日です[/title]・エンジンポット 585,200 円（振込実行 1666）
  ・クールジャパン 11,000 円（振込実行 1667）[/info]
  [info][title]振込の予約が確認できません（期日 2026-10-09）[/title]・センターライズ 984,280 円（振込実行 1668：ステータス 支払待ち）
  振込実行で予約を済ませてください。[/info]
  ```
- 該当 0 件なら送らない。

## 共通
- `src/lib/pl-payments/` に分ける：`kintone-pl.ts`（損益の読み書き）・`transfer.ts`（51/98 の作成）・`drive-match.ts`（請求書探し）・`business-day.ts`（営業日・祝日）・`notify.ts`（Chatwork 文面）・`run.ts`（処理 A／B の本体。`apply: false` のドライランを持つ）。
- 2 つの API は `?dry=1` でドライラン（何も書かず、やる予定を JSON で返す）。Claude が本番で先に `dry=1` を見てから本番運転に入る。
- 日付・時刻は日本時間。日時の表示は `2026-10-09 08:30:00` の形。

## テスト（vitest・外部はモック）
- `business-day.test.ts`：土日・祝日（例 2026-11-03）・振替休日（例 2026-05-06）・12/30〜1/3・1/4 の扱い、前営業日の計算
- `drive-match.test.ts`：全角半角・大文字小文字・`2026.08`／`202608`／`2026年08月`・候補 0／1／2 件
- `transfer.test.ts`：レコードの中身（重複キー・識別子・振込ID の連番・会社と実行銀行の対応・前営業日）・重複があれば作らない
- `run.test.ts`：新規通知は 1 回だけ／リンク入力／51→98 の順と 98 失敗時の再開／前日通知と予約漏れ通知（98 が完了なら出ない）／失敗通知は障害ごと 1 回
- `npx tsc --noEmit`・`npx vitest run src/lib/pl-payments src/app/api/system/pl-payments` が緑

## 完了報告（コードブロックで）
- 作ったファイル一覧／移行 SQL のファイル名／`dry=1` の返りの例／テスト結果／Claude が用意する環境変数の一覧／④に書くべき注意（祝日表の更新など）
