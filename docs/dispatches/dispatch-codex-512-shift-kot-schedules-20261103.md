# Codex-512 確定シフトを KING OF TIME の勤務予定（スケジュール）へ送る（2026-11-03）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ）。KING OF TIME（KOT）を本当に呼ばない（テストはモック）。LINE を送らない。** ファイルは UTF-8。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語を出さない（「KING OF TIME」は正式名で書く）。
**コードは周りと同じく読みやすく書く**（1行に詰め込まない。prettier 相当の形）。

前提：Codex-511/511b（`src/lib/shift/*`・`src/app/system/shift/*`・表 `system_shift_confirmed`）は本番に出ている。

## KOT の決まり（公式資料 developer.kingoftime.jp で確認済み）
- 予定の登録・更新（一括）：`PUT /daily-schedules`、本文 `{"employeeScheduleRequests":[{"employeeKey":"…","dailySchedules":[{"workingDate":"2026-12-01","workPlaceDivisionCode":"1000","clockInSchedule":"2026-12-01T14:00+09:00","clockOutSchedule":"2026-12-01T21:00+09:00"}]}]}`。1回 1,000件まで。応答 200 で `successRequest` と `errorRequest`（`errors[].date/code/message`）。**その日に打刻がもうあると失敗**
- 予定の削除：`DELETE /daily-schedules/{employeeKey}/{date}`（204）。打刻があると失敗
- 予定の一覧：`GET /daily-schedules?division=…&ondivision=true&start=YYYY-MM-DD&end=YYYY-MM-DD`
- 従業員：`GET /employees/{従業員コード}` で `key`（employeeKey）と `divisionCode` が取れる（今の `fetchKotEmployeeByCode` を使う）
- **毎日 8:30〜10:00 と 17:30〜18:30（日本時間）は予定の API が使えない**
- 直列で、1件ずつ約1秒あける。403（コード105）・429 は待ってやり直し
- 呼び出しはホスト PC の中継（`src/lib/relay/queue.server.ts`・`scripts/relay-agent/agent.mjs`）を通す（KOT は社内の IP からしか呼べない）

## A. ホスト PC の中継の係（scripts/relay-agent）
- `buildKotRequest` の許可に次を足す（形をきっちり確かめる。ほかは今どおり拒否）
  - `PUT /daily-schedules`（本文は `employeeScheduleRequests` の配列だけ・1回の本文 64KB まで）
  - `DELETE /daily-schedules/{英数字の key}/{YYYY-MM-DD}`
  - `GET /daily-schedules`（クエリは `division`・`ondivision`・`start`・`end` だけ）
- DELETE の 204（本文なし）は成功として null を返す
- `config.example.json` と README の版を **1.3.0** に。README に「1.3.0 の入れ替え手順」（ホスト PC で agent.mjs を差し替え→タスク再起動→ログで版を確認）を書く
- `src/lib/relay/types.ts` の `RelayRequest` に上の3つを足す
- Garden 側は心拍（`getRelayHeartbeat`）の `agent_version` が 1.3.0 より古いとき送らず、画面に「会社のパソコンの中継の係が古いため送れません。係の入れ替えが必要です。」と出す

## B. 保存先（migration `supabase/migrations/20261103000512_shift_kot_status.sql`）
`system_shift_confirmed` に列を足す：
- `kot_status text not null default 'unsent'`（unsent＝未送信／sent＝送信済み／failed＝失敗／skipped＝送らない日）
- `kot_sent_at timestamptz`・`kot_error text`
- `kot_sent_start time`・`kot_sent_end time`（KOT に今入っているはずの予定。休みを送った・消した後は null）
- 開始・終了が変わったら `kot_status` を `unsent` に戻すトリガー（確定し直し・個別の変更・定休日で休みになった、のどれでも）

## C. 送る処理（`src/lib/shift/kot-push.server.ts` など）
対象＝その月の `system_shift_confirmed` のうち `kot_status in ('unsent','failed')` で、**明日以降の日**（今日・過去の日は打刻があり得るので送らない。画面に「今日より前の日は送りません」と出す）。
1. 人ごとに `root_employees.kot_employee_id`（従業員コード）→ `GET /employees/{コード}` で key と所属コード。コードが無い人は失敗「KING OF TIME の従業員コードが登録されていません」
2. 所属ごとに `GET /daily-schedules`（その月の明日〜月末）で、KOT に今ある予定を読む（KOT 側で手で入れた予定も含めて知るため）
3. 出勤の日 → `PUT /daily-schedules`（1人ぶんの月をまとめて1回）。開始＝確定の開始、終了＝21:00、`workPlaceDivisionCode`＝その人の所属コード
4. 休みの日 → KOT に予定があれば `DELETE`。無ければ何もしない（`kot_status='sent'`・`kot_sent_start/end=null`）
5. 結果を行ごとに記録（成功＝sent・kot_sent_start/end を更新／失敗＝failed・kot_error に KOT の文を日本語で短く）
6. 予定の API が使えない時間帯（8:30〜10:00・17:30〜18:30）は、押せても送らずに「この時間は KING OF TIME が予定を受け付けていません。10:00 以降にもう一度押してください。」（18:30 以降）
7. 1回の処理が長くなるので、API は「受け付け→裏で順に送る」にせず、**画面からは人ごとに順に呼ぶ**形でよい（1人ぶん＝GET 社員・PUT 1回・DELETE 数回。Vercel の時間内に収まる）。全体の進み具合を画面に出す

## D. 画面（/system/shift の「みんなのシフト」・確定した月だけ）
```
 KING OF TIME への送信
  送信済み 210件　未送信 31件　失敗 2件　　最後に送った日時 2026/11/16(日) 10:20:05
  失敗：山田 太郎 12/5(土)「打刻があるため変更できません」 …
  （今日より前の日は送りません）
                                   [ KING OF TIME へ送る ]
```
- 押すと Garden の確認の小窓「未送信・失敗の 33件を KING OF TIME の勤務予定に送ります。」→ 送信中は全画面の幕（`src/app/system/_components/DoneOverlay` と同じ見た目。「12人中 5人目を送信しています…」）→ 終わったら「送信しました（成功 31件・失敗 2件）」
- 表のマスで、失敗した日は小さな印（赤い点など・色だけに頼らず title で理由）
- 確定した直後（［この月のシフトを確定する］の後）にも「KING OF TIME へ送りますか？」の小窓を出して、そのまま送れるようにする
- 権限＝「みんなのシフト」タブの閲覧権限（今と同じ）

## テスト
- 中継の係：許可する形・拒否する形（パス・クエリ・本文の大きさ・DELETE の 204）
- 送る処理：出勤＝PUT の本文、休み＝予定があれば DELETE・無ければ何もしない、今日以前は送らない、時間帯で止まる、従業員コードなし、KOT の errorRequest を失敗として記録、変更で unsent に戻る（トリガーは SQL の文で確かめる）、中継の係が古いと止まる
- 画面：送信の欄・確認の小窓・幕・失敗の一覧
- `npx tsc --noEmit` と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`、`scripts/relay-agent` のテスト（`scripts/relay-agent/tests`）が通ること

## 終わったら
`docs/dispatches/report-codex-512-shift-kot-schedules-20261103.md` に、直したファイル・migration・テスト結果・ホスト PC の係の入れ替え手順（東海林さん向けに短く）を書く。
