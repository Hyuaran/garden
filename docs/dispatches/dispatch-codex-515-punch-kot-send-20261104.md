# Codex-515 打刻を KING OF TIME へ送る（修正申請と承認・管理表ポータルのボタン・締めずみの確認）（2026-11-04）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。KING OF TIME・LINE・Chatwork を本当に呼ばない。ホスト PC に触らない。** ファイルは UTF-8。必要な範囲だけ読む。
画面の文字はきちんとした日本語（変更する・入力する）。英語・開発者用語・略称（KOT など）を出さない。**コードは周りと同じく読みやすく書く**（1 行に詰め込まない）。

## 読むもの（先に）

- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\03_勤怠打刻KOT取込\Garden_System_勤怠打刻KOT取込_4_仕様書_Claude読み込み用.md`（§3・§4-2・§6）
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\07_管理表ポータル\Garden_System_管理表ポータル_4_仕様書_Claude読み込み用.md`（§2・§11）
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\26_ホストPC中継\Garden_System_ホストPC中継_4_仕様書_Claude読み込み用.md`（§15・§16）
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\Garden_System_シフト_4_仕様書_Claude読み込み用.md`（§5・§9）
- 手本のコード：`src/lib/shift/kot-push.server.ts`（中継の呼び方・1 人ずつ・結果の保存）、`src/app/system/shift/KotSendPanel.tsx`（確認の小窓・全画面の幕）
- KING OF TIME の API の説明：https://developer.kingoftime.jp/ （打刻登録・日別打刻データ・日別勤怠）

## 背景

現場は KING OF TIME で直接打刻している（Garden の打刻は本番 0 件）。これを **2026 年 11 月中に** Garden の打刻に切り替え（日付は Garden開発責任者が決める）、毎日 21 時の管理表作成のときに、管理表ポータルのボタンで打刻を KING OF TIME へ送る。**展開の前に、KING OF TIME に入っている 11/1 以降の打刻とシフトを Garden に取得する**（§0）。KING OF TIME の締めは毎日、責任者が KING OF TIME の画面で手作業で行う（楽天早トク給与の前払い額に反映するため）。ポータルは締めずみを読んでから先へ進む。

KING OF TIME の決まり（2026-11-04 確認）：
- 打刻の登録 `POST /daily-workings/timerecord`（一括 1000 件まで）は**勤務日の翌日 23:59:59 まで**。8:30〜10:00・17:30〜18:30 でも使える
- **登録した打刻は API で修正も削除もできない**（画面でしか直せない）
- 打刻の読み取り `GET /daily-workings/timerecord` と日別勤怠 `GET /daily-workings/{date}` は 8:30〜10:00・17:30〜18:30 は使えない
- 締めは API でできない。日別勤怠の `dailyWorkings[].isClosing` で読むだけ（実データで確認済み：`[{date, dailyWorkings:[{employeeKey, isClosing, ...}]}]`、2026-11-03 は 30 人全員 true）
- **締めた日に打刻を登録できるかは、説明に書かれていない**（本番で 1 件通すときに Claude が確かめる）。送れなかったときは失敗として理由を残す作りにする

## 決まったこと（2026-11-04 Garden開発責任者）

- **休憩は 13:00〜14:00 の 1 時間。ふだんは打刻しない。この時間を出勤している日は自動で休憩したことにする**（シフト側 `hasLunchBreak` は 13:00 までの開始に直して本番済み）
- **別の時間に休憩を取ることもあるので、休憩のボタンは全員に残す**（§2-4）
- 11/1 以降の取得は**今いったん取り、切り替え日に上書きする**（§0）
- 本人の提出は今の時間の決まりのまま（18:30・19:00 の開始は提出できない）。**提出に備考欄を付け、希望はそこに書いてもらう。責任者が見て変更する**（§0 の最後）
- 打刻の端末は制限しない。社外からも押せる。**PC かスマホかは記録する**（§2-4）

## やること（順番どおりに作る）

### 0. 11/1 以降の打刻とシフトを KING OF TIME から取得する

Claude が本番で流すスクリプト `scripts/attendance/import-kot-november.mjs` を作る（**Codex は実行しない**）。`--from 2026-11-01 --to YYYY-MM-DD`、既定は読むだけ（`--dry-run`）、`--apply` で書き込む。**今いったん取り、切り替え日にもう一度流して上書きする**。切り替えまでは KING OF TIME が正なので、2 回目以降は KING OF TIME の今の内容に置き換える（§0 の「上書き」）。読み取りは仕事表 `system_relay_jobs`（kind=`kot`）経由で 1 件ずつ。KING OF TIME へは書かない。8:30〜10:00・17:30〜18:30 は止める。

**打刻（全員）**：`GET /daily-workings/timerecord`（係 1.4.0 が要る）。
- `system_attendance_punches` に入れる：`source='kot_import'`・`punched_at`＝KING OF TIME の時刻・`kot_punched_at` も同じ・`kot_sync_status='synced'`・`kot_synced_at`＝取得日時・`device_type` は null
- `client_punch_id` は（従業員コード・時刻・種別）から作る UUID v5（同じ打刻は 2 回入らない）
- code は 1 出勤／2 退勤／3 休憩開始／4 休憩終了。**ほかの code（外出など）は入れずに一覧へ**
- 人×日ごとに `system_attendance_kot_send` を `status='sent'` にする（**再送しない**。修正の承認は §2-3 の「KING OF TIME の画面で修正する」になる）
- 打刻を読むほかの画面（`src/app/api/my/ap-daily-report/route.ts` など）に、取得分が入って困らないか確かめて報告に書く

**シフト（提出する人＝`employees()` の判定のみ）**：`GET /daily-schedules`（所属ごと・月をまたがない）。
- 勤務の予定 → `system_shift_wish` と `system_shift_confirmed` の両方へ同じ開始時刻で入れる（希望も入れるのは「確定し直す」で消えないため）。`system_shift_confirmed` は `kot_status='sent'`・`kot_sent_start`・`kot_sent_end`
- 全日休暇（公休・欠勤）・予定なし → 休み（`start_time` null）。公休と欠勤は `kot_status='skipped'`
- `system_shift_submission` は入れない。`system_shift_month` に 11 月の確定（`confirmed_by_name='KING OF TIME から取得'`）を入れる
- 全員が全日休暇の日は定休日の候補として一覧に出すだけで、`system_kanri_month_setting.holidays` は**書き換えない**（食い違いを報告する）
- 終了が 21:00 以外の予定は入れずに一覧へ
- **提出する人以外の予定（09:30〜18:00 など）は取得しない**（今のシフトの表は終了 21:00 固定のため）

**11 月の実データ（2026-11-04 に読み取りで確認・提出する人 17 人）**：14:00 開始 173 件／10:00 開始＋休憩 39 件／18:00 開始 34 件／全日休暇 17 件／15:00 開始 13 件／17:00 開始 6 件／**18:30 開始 6 件**／15:30 開始 1 件。すべて終了 21:00。予定の日に打刻済みの日があるのは当然なので、**KING OF TIME へ予定を送り直す動きを起こさない**（取得後の `kot_status` が `unsent` にならないこと）。

**上書き（2 回目以降）**：
- 打刻：指定の期間の `source='kot_import'` の行を、KING OF TIME の今の内容にそろえる（増えた分は入れる・KING OF TIME から消えた分は消す）。**`source='web'`・`source='correction'` の行には触らない**
- シフト：指定の期間の `system_shift_wish`・`system_shift_confirmed` を人×日ごとに `delete` → `insert` で置き換える。`reset_shift_kot_status` は `update` のときに未送信へ戻すので `update` で開始を変えない
- 取得のあとに責任者が小窓で変えた行も上書きする（切り替えまでは KING OF TIME が正）。dry-run に、変わる行の件数と「責任者が変えた行」の一覧を出す
- **`kot_send_start_date` 以降の日は書き換えない**（切り替えのあとに誤って流しても、Garden の打刻と確定シフトを壊さない）

**18:30 開始を扱えるようにする**：
- `system_shift_wish`・`system_shift_confirmed` の CHECK の上限を 18:00 → 20:30 に広げる
- 本人の提出（`validateDays`・`startOptions`）は 18:00 までのまま（18:30・19:00 は選べない）。責任者の変更（`teamShift` の `person`）は 30 分単位・20:30 までを通す
- `ShiftDays.tsx`：今の値が選択肢に無いとき（18:30 など）は、その値を選択肢に足す（「休み」に見せない）。責任者の小窓の選択肢は 20:30 まで出す

**提出の備考欄**：
- `system_shift_submission` に `note text`（500 字まで）を足す。`save_shift_person` に引数を足して提出と同時に保存する
- 本人の画面（`MyShift`。`/system/shift`・`/my?tab=shift`・`/m/shift`・`/liff/shift` のすべて）の［提出する］の上に欄を置く。必須にしない

```
備考
[ 12/5 は 19:00 から出勤したいです                ]
18:30 以降の開始を希望する場合は、ここに記入してください。
[ 提出する ]
```

- 締切後と確定後は読むだけで表示する
- みんなのシフト：表の上に「備考がある人」の一覧（氏名・備考）。人の小窓の日付の上にも備考を出す（読むだけ）
- 備考の中身では LINE を送らない。備考があっても提出は通常どおり。責任者は読んで小窓で変更する

dry-run の出力＝人数・日数・件数・入れない分の一覧（理由つき）。`--apply` は人×日ごとのトランザクション。

### 1. Garden の打刻の開始日

新しい表 `system_attendance_settings`（1 行だけ。`id` は固定値）：`kot_send_start_date date`（null＝まだ切り替えていない）・`updated_at`・`updated_by`。RLS 有効・ポリシーなし。初期値は null。

全権管理者が「勤怠打刻」の同期状況の画面（`/system/attendance/sync-status`）で設定する欄を足す：

```
Garden の打刻の開始日
[ 2026-12-01 ]  [ 保存する ]
この日以降の打刻を KING OF TIME へ送ります。この日から KING OF TIME での直接の打刻を止めてください。
```

- 開始日より前の打刻は送らない。null の間はポータルの送信の欄を出さない（§4）
- 全権管理者以外には欄を出さず、受け口も 403

### 2. 打刻の修正の申請と承認

勤怠打刻の画面をタブにする（社長スタイルの型。`SystemTabs`・`SystemViewButton`）。タブ＝「打刻」「修正の申請」「修正の承認」。

**閲覧権限**：`system_view_scopes` に page_key `system-attendance` のタブを足す。`punch`（打刻）・`request`（修正の申請）＝今の既定と同じ全役職。`approve`（修正の承認）＝`manager`・`admin`・`super_admin`。**承認できる人＝「修正の承認」タブを見られる人**（受け口も `canView` で判定）。既存の `""`（画面全体）の設定は壊さない。

**表 `system_attendance_corrections`**（RLS 有効・ポリシーなし）：
`id`・`employee_id`（`root_employees` への外部キー。text）・`work_date date`・`action`（`add` 追加／`change` 変更／`delete` 削除）・`punch_type`・`target_punch_id bigint`（change・delete のとき）・`requested_time timestamptz`（add・change のとき）・`reason text not null`・`status`（`pending` 未承認／`approved` 承認済み／`rejected` 却下／`canceled` 取消）・`decided_by`・`decided_at`・`decided_comment`・`kot_fix_needed boolean`（§2-3）・`kot_fixed_at`・`kot_fixed_by`・`created_at`・`updated_at`。

**表 `system_attendance_punches` に列を足す**：`voided_at timestamptz`・`voided_by_correction_id bigint`・`correction_id bigint`。

- `punched_at` は書き換えない（生の打刻を残す）
- 承認すると：add＝`source='correction'`・`correction_id` つきの新しい行を入れる（`client_punch_id` は新しい UUID）。change＝元の行に `voided_at` を入れて新しい行を入れる。delete＝元の行に `voided_at` を入れる。**1 つのトランザクション**（関数）で行う
- **`voided_at` のある行は、打刻を読むところすべてで除く**：`src/app/api/my/ap-daily-report/route.ts`・`src/app/api/system/attendance/kot-export/route.ts`・`kot-export/confirm`・`kot-export/revert`・`my`・`sync-status`。読み落としが無いか `system_attendance_punches` を検索して確かめる。テストも足す

#### 2-1. 修正の申請（本人）

```
勤怠打刻
 打刻 ｜ 修正の申請 ｜ 修正の承認
┌────────────────────────────────┐
│ 日付      [ 2026-11-03 ]            │
│ 修正の内容 ○ 打刻を追加する ○ 時刻を変更する ○ 打刻を削除する │
│ 打刻      [ 退勤 ▼ ] ※変更・削除は「その日の打刻」から選ぶ │
│ 時刻      [ 21:00 ]                │
│ 理由      [ 退勤の打刻を忘れました       ] │
│ [ 申請する ]                        │
└────────────────────────────────┘
自分の申請
 申請日時｜日付｜内容｜状態（未承認・承認済み・却下）｜却下の理由
```

- フォームは部品箱 `form-kit`（`src/app/system/forms/_components/form-kit`）。選ぶ欄の決まり＝普通の select・2〜3 個はラジオ
- 日付は今日以前。理由は必須。未承認の間は本人が［取り消す］で取り消せる
- 自分の申請の表は行全体を押すと小窓で詳しく出す。日時は秒まで（`2026-11-03 21:00:00`）。見出しは中央ぞろえ

#### 2-2. 修正の承認（責任者以上）

```
 打刻 ｜ 修正の申請 ｜ 修正の承認
未承認 2件
申請日時            氏名      日付        内容                理由
2026-11-03 21:40:12 長田さん  2026-11-03  退勤を追加 21:00   打刻を忘れました
 ↓ 行を押す
┌ 打刻の修正の確認 ───────────────── × ┐
│ 長田さん 2026-11-03                          │
│ その日の打刻：出勤 13:58:02                   │
│ 申請の内容：退勤を追加 21:00                  │
│ 却下の理由 [                     ]            │
│               [ 却下する ] [ 承認する ]       │
└──────────────────────────────────┘
```

- 自分の申請は承認できない（全権管理者だけは可）。受け口でも止める
- 却下は理由が必須。楽観更新（押した瞬間に行が消え、失敗したら戻して知らせる）

#### 2-3. KING OF TIME へ送ったあとの修正

承認するとき、その人のその日がすでに送信済み（§3 の表で `sent`）か、登録の期限（翌日 23:59:59）を過ぎているなら、Garden の打刻は直したうえで `kot_fix_needed=true` にし、次を出す：

「この修正は KING OF TIME には自動で反映されません。KING OF TIME の画面で修正してください。」

「修正の承認」タブの上に「KING OF TIME の画面で修正する分」の一覧（氏名・日付・内容・［修正済みにする］）を出す。

**通知は足さない**（新しい Chatwork・LINE の知らせは作らない）。

#### 2-4. 打刻の画面の変更（休憩・端末）

- **休憩のボタンは全員に残す**（今のまま 4 つ）。ボタンの近くに「13:00〜14:00 の休憩は打刻しなくても自動で入ります。別の時間に休憩を取るときだけ押してください。」と出す（`attendance_rule='sales'` の人だけ）
- **加工 `transformDayPunches` を直す**（`sales` のみ。`office` は今のまま）：
  - その日に休憩の打刻が**ある**：13:00〜14:00 の自動の休憩は入れず、**押した時刻のまま（丸めない・秒は切り捨て）**休憩の打刻を送る
  - その日に休憩の打刻が**ない**：今のまま、13:00〜14:00 を丸ごと含めば自動で休憩を入れる
  - 休憩の開始か終了の片方だけ・開始と終了の順が逆・出勤から退勤の外：「要確認」にする（理由＝「休憩の打刻がそろっていません」など）
  - 休憩の打刻を修正で消したら、自動の休憩に戻る
- **同じ数え方の所をそろえる**：`src/app/system/kanri/_lib/kot-daily.ts` の `countedActualHours` は KING OF TIME の書き出しを読んで同じ規則で数えている。休憩の列の読み方を確かめ、別の時間の休憩で時間数がずれるなら直す。直さなくてよいなら理由を報告に書く
- **端末の記録**：`system_attendance_punches` に `device_type text`（`pc`／`smartphone`／null）を足す。打刻の受け口で `Sec-CH-UA-Mobile`（`?1`）か User-Agent（`Mobi|Android|iPhone|iPad`）を見てサーバーで決める（画面から送らせない）。**制限には使わない**。KING OF TIME へも送らない
- **表示**：「今日の打刻」と、同期状況の「加工後の確認」の一覧に「端末」の列（PC／スマホ／—）。文字はこのとおり

### 3. 打刻を KING OF TIME へ送る処理

**表 `system_attendance_kot_send`**：PK（`employee_id`, `work_date`）・`status`（`sent` 送信済み／`failed` 失敗／`unknown` 確認待ち／`manual` 画面で入力済み）・`rows jsonb`（送った内容）・`error`・`sent_at`・`sent_by`・`updated_at`。RLS 有効・ポリシーなし。

**処理（`src/lib/attendance/kot-punch-push.server.ts` を新しく作る）**

読み取り（`GET /api/system/attendance/kot-send?date=`）で人×日ごとに分類する：

| 分類 | 条件 | 動き |
|---|---|---|
| 送れる | 出勤と退勤がそろい、未承認の修正が無く、期限内 | 送る |
| 要確認 | `transformDayPunches` の `needs_check`（出勤か退勤が欠ける・枠の外で終わる） | 送らない。理由を出す |
| 修正待ち | その人のその日に未承認の修正がある | 送らない |
| 期限切れ | 勤務日の翌日 23:59:59 を過ぎて未送信 | 送らない。「KING OF TIME の画面で入力してください」＋［入力済みにする］（`manual`） |

- 対象日＝`kot_send_start_date` 以降で、未送信の人×日。**人×日のまるごとで送る**（一部だけ送らない）
- 打刻は `voided_at` なし。加工は `transformDayPunches`（§2-4 で直したもの）を使う。**CSV の生成と同じ部品を使い、送り方で結果を変えない**
- CSV の束が `sending` で残っているときは、送らずに「同期状況の画面の処理が途中です。」と出す
- 21 時に退勤を押していない人は「要確認」で残り、翌日のボタンで送れる（前日分も対象に入る）

送信（`POST /api/system/attendance/kot-send`・`{date, employee_id}`・1 人ずつ。`maxDuration 300`）：

1. 開始日の確認／中継の係の版が **1.4.0 以上**・生存確認／8:30〜10:00・17:30〜18:30 は止める（手順 2 の読み取りが使えないため。文は `assertKotTime` と同じ形）
2. **二重を防ぐ確認**：`GET /daily-workings/timerecord?employeeKeys=&start=&end=` でその人のその日を読み、**KING OF TIME に打刻が 1 件でもあれば送らない**（`failed`・「KING OF TIME に打刻があります。KING OF TIME の画面で確認してください。」）。直接の打刻の残りと、送信の重複の両方を止める
3. `system_attendance_punches.kot_sync_status='sending'`・`kot_punched_at` を入れる
4. `POST /daily-workings/timerecord`：

```json
{"employeeTimeRecordRequests":[{"employeeKey":"…","timeRecords":[
  {"date":"2026-11-04","time":"2026-11-04T14:00:00+09:00","code":"1","recordId":"garden-…"}
]}]}
```
`code`：1 出勤／2 退勤／3 休憩開始／4 休憩終了。型と応答（`successRequest`・`errorRequest`）は API の説明で確かめる。

5. 結果を保存する：
   - 成功＝`sent`・打刻を `synced`
   - KING OF TIME のエラー（`errorRequest`）＝`failed`・打刻を `unsent` に戻す・理由を残す。**一部だけ入った可能性があるので自動で送り直さない**（次の送信は手順 2 で止まる）
   - 打ち切り・中継のエラー（届いたか分からない）＝`unknown`（確認待ち）。次に押したときに手順 2 で読み、打刻があれば `sent` にする／無ければ送る

**自動のやり直しはしない。cron は足さない**（送信はボタンを押したときだけ。追加の自動実行は 1 日 0 回）。

**中継の係 1.4.0（`scripts/relay-agent/agent.mjs`・`config.example.json`・`README.md`・テスト）**：
- `buildKotRequest` に許可を足す：`POST /daily-workings/timerecord`（本文は `employeeTimeRecordRequests` の形だけ・1000 件まで・64KB まで・`employeeKey` は英数字）／`GET /daily-workings/timerecord`（クエリは `employeeKeys`・`start`・`end` だけ）
- 勤務予定と同じく直列で 1 秒あける。**POST は 429 以外やり直さない**（二重になるため）
- 設置キットの 08・09 と入れ替えは Claude が行う。`relay-agent_1.4.0` を入れる場所の手順だけ README に書く

`src/lib/relay/types.ts` の型も足す。`currentAgent` は打刻の送信用に 1.4.0 以上を判定する（シフトの送信の 1.3.1 の判定は変えない）。

### 4. 管理表ポータルの欄

`src/app/system/kanri/KanriPortalClient.tsx` の「データを取り込む」の前に欄を足す。`KanriPortalClient.tsx` は大きいので、新しい部品 `src/app/system/kanri/KotPunchPanel.tsx` に分ける。

```
打刻と締め                             対象日 2026-11-04
────────────────────────────────
打刻を KING OF TIME へ送る
 送れる 28人（112件）  要確認 2人  修正待ち 1人  期限切れ 0人
 要確認：田中さん「退勤がありません」 ／ 佐藤さん「出勤がありません」
 修正待ち：長田さん
 [ KING OF TIME へ送る ]
────────────────────────────────
KING OF TIME の締め
 締めずみ 26人  未 2人（田中さん・佐藤さん）
 KING OF TIME の画面で締めてから、もう一度確かめてください。
 [ 締めを確かめる ]
────────────────────────────────
 [ データを取り込む ]  ← 未が 0 人になるまで押せない
```

- **送信**：［KING OF TIME へ送る］→ 小窓「KING OF TIME へ送りますか？」「28人分（112件）を送ります。送った打刻は Garden から修正できません。」［送信する］→ 全画面の幕（`KotSendPanel` と同じ・「28人中 3人目を送信しています…」）→「送信しました（成功 ○人・失敗 ○人）」。二重押しを止める。失敗は人・理由を一覧に出す
- `kot_send_start_date` が null・対象日より後のときは、送信の段を出さず「打刻は KING OF TIME で直接行っています。」とだけ出す
- **締めの確認**：新しい受け口 `GET /api/system/kanri/kot-closing?date=` が中継で `GET /daily-workings/{date}` を読み、`isClosing` を人ごとに返す。名前は `employeeKey` から `root_employees`（`kot_employee_id` 経由。キーの引き方は `src/app/root/_lib/kot-api.ts` を読む）。一覧は押したときに読む（開くたびには読まない。読み取りの回数を増やさない）
- **締めの確認が通るまで［データを取り込む］は押せない**。理由を画面に出す
- 確かめられないとき（8:30〜10:00・17:30〜18:30・中継の停止）は「締めを確かめられませんでした。」＋理由＋［確かめずに進む］（確認の小窓つき）。過去の日を作り直す運用を止めないため
- 締めの確認は `kot_send_start_date` が null の間も動く（現場は今も毎日締めている）
- 権限は管理表ポータルの今の権限に合わせる（`requireManager`・歯車の判定）。ポータルのほかの動きは変えない
- 表の見出しは中央ぞろえ、日時は秒まで。ライト・ダーク両方で読めること（色は直書きしない）。読み込みの間に欄の高さが変わらないこと（ちらつかせない）

### 5. スマホの入口

`/m/attendance` を新しく作り、打刻と修正の申請ができるようにする（`src/app/m/shift/page.tsx` と同じ形）。修正の承認はスマホの入口には出さない（`/system/attendance` は狭い幅でも使えること）。iPhone で 16px 未満の入力欄にしない。

### 6. マニュアル 5 点（⓪①②③④）

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\03_勤怠打刻KOT取込\` と `07_管理表ポータル\`・`26_ホストPC中継\` の 5 点を下書きする。④を先に直し、⓪①②③を同じ版・同じ日付にする。**Storage へは上げない**（Claude が確かめて上げる）。「使い方」の書き方は `09_シフト` の ① を手本にする（業務の言葉で短く・いつ／だれの行なし・開く手順なし・略称なし）。

## migration

`supabase/migrations/20261104000516_attendance_corrections_kot_send.sql`：上の表・列（`device_type` を含む）・関数・`system_view_scopes`・シフトの CHECK の変更。ファイルを作るだけ（**当てない**）。新しい表に検索が要るものは `src/lib/search/catalog.ts` の決まりに従う。

## 画面の決まり（毎回）

社長スタイルの型（`SystemBreadcrumb`・`SystemTabs`・`UpdatedStamp`・`DataTable`）。表の行は全体を押す（`onRowClick`・［変更する］列を置かない）。小窓にスクロールバーを出さない。楽観更新。文字は略称なし（KING OF TIME と書く）。

## テスト

- 取得：2 回流しても増えない、KING OF TIME で消えた打刻が消える、`web`・`correction` の行に触らない、開始日以降の日は書き換えない、種別の変換、`kot_status` が `unsent` にならない、提出する人だけ、終了 21:00 以外は入れない、18:30 開始が入る
- シフトの画面：18:30 開始が「休み」に見えない、本人は 18:30・19:00 を提出できない、責任者は保存できる、備考の保存と表示（4 つの入口・締切後は読むだけ・500 字）
- 打刻：全員に休憩のボタンが出る、案内は `sales` だけ、端末の判定（PC・iPhone・Android・iPad）
- 加工：休憩の打刻がある日は自動の休憩なし・押した時刻のまま、ない日は今のまま、片方だけ・逆順・勤務時間の外は要確認、`office` は変わらない
- 修正：add・change・delete の適用、`voided_at` の行を打刻の読み取りすべてが除く、自分の申請を承認できない、権限、送信後の承認で `kot_fix_needed`
- 送信：4 分類、未承認があると送らない、人×日のまるごと、KING OF TIME に打刻があると送らない、成功・エラー・打ち切り（`unknown`）の保存、`unknown` の次の押下、CSV の束が途中なら止める、開始日より前は送らない、係の版
- 係：許可・拒否（`timerecord` の本文の形・件数・クエリ）、POST をやり直さない
- ポータル：締めの未があると取り込めない、［確かめずに進む］、開始日 null の表示
- `npx tsc --noEmit` と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`、`npx vitest run --config scripts/relay-agent/vitest.config.mjs` が通ること。`src/lib/ui/no-flicker-source.test.ts` を壊さない

## 終わったら

`docs/dispatches/report-codex-515-punch-kot-send-20261104.md` に、直したファイル・migration・テスト結果・追加の定期実行（0 回のはず）・Claude に頼むこと（migration・係の入れ替え・マニュアルの上げ込み）を書く。

## Claude が仕上げること（Codex はしない）

1. 差分を全行読む（日本語のラベルが壊れていないか）→ migration を本番へ → 配備
2. ホスト PC を使っている人がいないか確かめて、係を 1.4.0 へ入れ替える
2-2. 11/1 以降の取得を dry-run → 件数と一覧を Garden開発責任者に見せる → `--apply`。**切り替え日が決まったら、その前日の締めのあとに dry-run → `--apply` で上書きし、開始日を設定する**
3. 本番で 1 人分を通す（Garden開発責任者の打刻 → 送信 → KING OF TIME に入る → **締めた日に登録できるかを確かめる** → KING OF TIME の画面で消して後片付け）
4. 幅 4 段階・ライト／ダーク・スマホ・読み込みの速さを本番の画面で確かめる
5. マニュアルを Storage へ → 版点検 → 開始日を設定（Garden開発責任者が決めた日）
