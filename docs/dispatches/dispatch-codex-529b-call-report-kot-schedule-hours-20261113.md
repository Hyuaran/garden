# Codex-529b コール集計の配信：稼働時間（ｈ）を KING OF TIME の「予定」の時間にする（2026-11-13）

作業場所：`C:\garden\a-bloom-008`（main）。Codex-529（commit 2b976ca0）の続き。

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない。KING OF TIME・Kintone・Chatwork・中継を本当に呼ばない（テストはモック）。** ファイルは UTF-8・改行は LF（今のファイルに合わせる）。文字化け（??）を残さない。必要な範囲だけ読む。コードは周りと同じく読みやすく書く。

## 決め（東海林さん 2026-11-13）

配信の【アウトテレマ】の「〇ｈ」は、KING OF TIME の **予定** の時間の合計にする（KING OF TIME の日別データの「予実」で見える「予定」）。実績（`/daily-workings` の `totalWork`）は使わない。

- 1 人の予定の時間＝`clockOutSchedule − clockInSchedule − Σ(startEndBreakSchedule の end − start)`（分）。出勤予定・退勤予定のどちらかが無い人（休み）は 0。
- 対象＝今と同じ（`telemaEmployees(employees)` の `kot_employee_id`。`/employees` の `key`→`code` で対応）。
- 合計分÷60 を小数 1 桁に丸めず、今と同じく四捨五入の整数。0 は 0ｈ。

## 読み方

予定は `GET /daily-schedules?division={所属コード}&ondivision=true&start={日付}&end={日付}`（中継が通す形。`src/lib/shift/kot-push.server.ts` の読み方を参考に）。

- `/employees?date={日付}&includeResigner=true`（今も読んでいる）で、対象の人の `divisionCode` を集め、所属コードごとに 1 回ずつ読む（重複しない・並べて読んでよい）。
- 応答の形（実物）：`[{ date, dailySchedules: [{ date, employeeKey, clockInSchedule: "2026-09-01T10:00+09:00", clockOutSchedule: "...", startEndBreakSchedule: [{ start, end }], scheduleTypeName, workDayTypeName, workPlaceDivisionCode, ... }] }]`
- 予定が 1 件も無い範囲は、中継が「JSON でない」と返す（`kot-push.server.ts` の `KOT_EMPTY_RESPONSE` の扱い）→ その所属は 0 件として扱う。
- `/daily-workings` はもう読まない（`kotReportHours` の実績の計算は消す。テストも予定に合わせる）。

## 止まる時間・読めないとき（Codex-529 と同じ決め）

- 8:30〜10:00・17:30〜18:30 は KING OF TIME を呼ばず、`system_relay_jobs`（kind=kot・status=done・同じ path・その日の 0:00〜止まる時刻の前）の最新の結果を使う（18:05 の回＝17:05 の回と同じ数字）。必要な path（従業員＋所属ごとの予定）が 1 つでも無ければ null。
- 読めないとき（中継停止・エラー・形が違う）は `hours = null`→「-ｈ」。配信本文に警告の行は足さない。console.warn に理由を 1 行（個人名・鍵は出さない）。

## テスト

- 予定の時間の計算（休憩あり／休憩なし／休み＝出勤予定なし／対象外の人は数えない／複数の所属）
- 予定が空の所属（中継が JSON でないと返す）→ 0 件
- 使える時間は中継を呼ぶ・止まる時間は仕事表の結果を使う・控えが無ければ null・読めなければ null で警告の行なし
- `npx tsc --noEmit`、`npx vitest run src/app/system/_lib src/app/api/system/call-report src/app/root/_lib src/lib/shift` が通ること

## 終わったら

`docs/dispatches/report-codex-529b-call-report-kot-schedule-hours-20261113.md` に、直したファイル・テスト結果・迷って決めたことを書く。マニュアルは不要（Claude がやる）。

## 実装時の取得回数見積もり（Codex-529b）

cron・ポーリングの追加はなし。対象者の所属数を D とすると、通常の集計1回につき従業員1回＋予定D回＝1＋D回（従来は従業員＋実績の2回）。既存cronはUTC 2〜12時の毎時05分＝JST 11:05〜21:05の11回/日。このうち18:05は保存結果だけを読み、残り10回がすべて集計まで進む場合、KOT取得は最大10×(1＋D)回/日。D=1なら20回、D=2なら30回、D=3なら40回。手動実行・再試行分は別。停止時間は外部取得0回で、保存結果を1＋Dパス読む。
