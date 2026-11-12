# Codex-529 コール集計の配信：稼働時間（ｈ）を KING OF TIME の勤務時間にする（2026-11-13）

作業場所：`C:\garden\a-bloom-008`（main）。

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない。KING OF TIME・Kintone・Chatwork・中継を本当に呼ばない（テストはモック）。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。コードは周りと同じく読みやすく書く（1 行に詰め込まない）。

## 背景（Claude が本番で確かめたこと）

- 配信文 v3 の【アウトテレマ】の「〇ｈ」は、今は FileMaker のコール履歴（最初のコール〜最後のコール−休憩・`reportHoursFromMetrics`）から出している。コメントの「取り込み済みの KING OF TIME の勤務時間」は誤り。
- 11/12 に KING OF TIME から読もうとして「-ｈ」になった原因は、接続ではない。中継（`KOT_RELAY_MODE=queue`・`system_relay_jobs`）経由の `GET /daily-workings/{date}` と `GET /employees?date=...&includeResigner=true` は成功していた。
- 実物の `/daily-workings/{date}` は `{ date, dailyWorkings: [{ employeeKey, totalWork（分・number）, breakTime, isClosing, ... }] }`。**`workMinutes` という欄は無い**。`kotReportHours` が `workMinutes` を探して throw していた。
- KING OF TIME は日本時間 8:30〜10:00・17:30〜18:30 に日別勤怠の API が使えない（打刻が集中する時間帯。`assertKotAvailable` と同じ時間）。配信の 18:05 の回がここに当たる。

## やること

### 1. `kotReportHours`（`src/app/system/_lib/call-report-v3.server.ts`）

- 勤務時間は `totalWork`（分）を使う。`workMinutes` は見ない。
- 対象＝`telemaEmployees(employees)` の `kot_employee_id`。`employeeKey`→従業員コードは `/employees` の結果（`key`→`code`）で引く。
- 対象の人の行で `totalWork` が数字でなければ throw（今と同じ扱い）。
- 合計分÷60 を四捨五入。**0 は 0 として返す**（読めた結果の 0。「-」にしない）。

### 2. `loadCallReportV3` の稼働時間

- `reportHoursFromMetrics` をやめ、KING OF TIME の勤務時間にする（関数がほかで使われていなければ消す）。
- **KING OF TIME が使える時間**：`fetchKotDailyWorkings(metrics.from)` と `fetchKotEmployees({ date: metrics.from, includeResigner: true })` を並べて呼び、`kotReportHours` で計算。
- **止まっている時間（8:30〜10:00・17:30〜18:30）**：KING OF TIME を呼ばない。その日の、止まる時間の前に中継で読めた最後の結果を `system_relay_jobs` から使う（kind=`kot`・status=`done`・`request->>'path'` が `/daily-workings/{date}` と `/employees?date={date}&includeResigner=true` のもの・その日の 17:30（朝の窓なら 8:30）より前に作られたうち最新）。18:05 の配信が 17:05 の配信と同じ数字になる、という東海林さんの決め。両方そろわなければ「-」。
  - 時間の判定は `kot-api.ts` に「止まっている時間か」を返す関数を足し、`assertKotAvailable` もそれを使う形にする（文言・動きは今のまま）。
  - `system_relay_jobs` の読み取りは `loadCallReportV3` が受け取る client（cron は service role）で行う。
- **読めないとき**（中継停止・エラー・形が違う・止まっている時間に控えが無い）：`hours = null` → 本文は今までどおり「-ｈ」・平均コール数/ｈも「-」。**配信本文に警告の行は足さない**（東海林さん「読めない場合は -ｈ」）。サーバーのログ（console.warn）に理由を 1 行だけ残す（鍵・個人名は出さない）。
- ポイント・ランキング・従業員数の動きは変えない。画面・PDF の「稼働時間」（コール履歴から）は変えない。

### 3. コメント

`call-report-v3.ts` の誤ったコメント（取り込み済みの KING OF TIME…）を消す／正しく書き直す。

## テスト

- `kotReportHours`：上の実物の形（`{ date, dailyWorkings: [...] }`・`totalWork`）で、対象の人だけ合計・0 は 0・`totalWork` が無い対象者は throw・対象外の人は数えない。
- `loadCallReportV3`：
  - 使える時間 → KING OF TIME の値が `reportV3.hours` に入る
  - KING OF TIME がエラー → `hours === null`・warnings に KING OF TIME の行が増えない
  - 17:30〜18:30（例 18:05）→ KING OF TIME を呼ばず、仕事表の 17:30 より前の最新の結果で計算／控えが無ければ null
- 既存の配信のテスト（`call-report`・cron・route）が通ること。
- `npx tsc --noEmit`、`npx vitest run src/app/system/_lib src/app/api/system/call-report src/app/root/_lib` が通ること。

## 終わったら

`docs/dispatches/report-codex-529-call-report-kot-hours-20261113.md` に、直したファイル・テスト結果・迷って決めたことを書く。マニュアルは不要（Claude がやる）。

## 実装時の取得回数見積もり

- cron・ポーリングの新設や間隔変更は無し。既存の毎時05分の配信で、利用可能時間は日別勤怠と従業員一覧の2取得。
- 平日15:05〜21:05の7配信中、18:05を除く6配信で計12取得/日。土日祝11:05〜21:05の11配信中、18:05を除く10配信で計20取得/日（既存クライアントの再試行を除く）。
- 18:05はKOT取得0回、保存済み中継結果へのSELECTが2回。手動実行は利用可能時間なら1実行につき2取得、停止時間ならSELECTが2回増える。
