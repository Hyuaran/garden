# Codex-517 既定の勤務に「選べる勤務」を足す（在宅／出社）（2026-11-04）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。KING OF TIME・LINE を本当に呼ばない。ホスト PC に触らない。** ファイルは UTF-8。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語・略称を出さない。**コードは周りと同じく読みやすく書く**。

## 読むもの

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\Garden_System_シフト_4_仕様書_Claude読み込み用.md` の「既定の勤務で提出する人」、`src/lib/shift/rules.ts`、`src/lib/shift/service.server.ts`、`src/lib/shift/defaults.server.ts`、`src/app/system/shift/DefaultShiftDays.tsx`、`src/app/system/shift/DefaultPatternSettings.tsx`、`supabase/migrations/20261104000517_shift_default_pattern.sql`。

## 背景

既定の勤務（Codex-516・本番）は、本人が選べるのが「その日の既定の勤務」「休み」「有給」の 3 つ。東海林美琴（EMP-0008）は平日ごとに在宅か出社かを選ぶ。

- 在宅：10:30〜14:30
- 出社：12:00〜17:00
- 土日祝は休み

## 作るもの

**人ごとの「選べる勤務」**。登録がある人は、**平日（月〜金で祝日以外）**の選ぶ欄に、既定の勤務の代わりに選べる勤務を出す。登録が無い人は今のまま。

### 画面（自分のシフト）

```
┌ 12/1(火) ─────────┐ ┌ 12/2(水) ─────────┐ ┌ 12/5(土) ──┐
│ 在宅 10:30〜14:30 ▼ │ │ 出社 12:00〜17:00 ▼ │ │ 休み ▼     │
└─────────────┘ └─────────────┘ └────────┘
選ぶ欄：在宅 10:30〜14:30／出社 12:00〜17:00／休み／有給
出勤 20日・合計 90 時間・有給 0日
```

- 最初は `system_shift_default` のその曜日の勤務が入っている（Claude が在宅の時刻で入れている）
- 土日祝の選ぶ欄は今のまま（休み／有給）
- 休憩の扱いは今の `hasLunchBreak` のまま（在宅 10:30〜14:30 も出社 12:00〜17:00 も、13:00〜14:00 を含むので休憩ありになる）

### 画面（みんなのシフト）

変更なし。マスは今の開始〜終了の表示。責任者の小窓も今のまま（30 分単位で変更できる）。

### 画面（歯車の既定の勤務の小窓）

曜日ごとの入力の下に「選べる勤務」を足す。名前・開始・終了の行を足す・消す（ごみ箱は `RowActionButton`）。全権管理者だけ。

```
選べる勤務（平日に本人が選びます）
 [ 在宅 ] [ 10:30 ▼ ] [ 14:30 ▼ ] [ごみ箱]
 [ 出社 ] [ 12:00 ▼ ] [ 17:00 ▼ ] [ごみ箱]
 [ ＋ 選べる勤務を追加 ]
```

## データ

`supabase/migrations/20261104000518_shift_default_options.sql`（ファイルを作るだけ）：

- 新しい表 `system_shift_default_option`：`id`・`employee_id`（`root_employees` への外部キー）・`label text not null`・`start_time time not null`・`end_time time not null`・`sort int`・`updated_at`・`updated_by`。`system_shift_default` と同じ 30 分単位・開始＜終了の CHECK。RLS 有効・ポリシーなし。`revoke`／`grant` も同じ形
- `save_shift_person`：本人の提出（`p_submit`）の検査を、「その日の既定の勤務」に加えて「平日なら、その人の選べる勤務のどれか」も通す。**今の本番の関数（20261104000517）を土台にして `create or replace`** し、ほかの動きを変えない
- 初期データは入れない（Claude が入れる）

## 受け口とロジック

- `validateDefaultDays`（`src/lib/shift/rules.ts`）に選べる勤務を渡せるようにする。本人の検査で、平日は選べる勤務も通す。**休みの日・祝日には通さない**
- `myShift` の応答に `options` を足す（既定の勤務の人だけ）
- 設定の受け口（`src/lib/shift/submitters-route.server.ts` か既定の勤務の受け口の今の形に合わせる）に読み書きを足す。全権管理者だけ
- **KING OF TIME への送信は変えない**（開始・終了で送る）

## マニュアル 5 点（⓪①②③④）

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\` の 5 点を直接直す（下書きのフォルダを作らない）。④を先に。版は v2.4、日付は 2026-11-04 にそろえる。①は「使い方」の書き方を守る（`09_シフト` の今の ① の形・業務の言葉で短く）。**Storage へは上げない**。

## テスト

選べる勤務がある人の平日に通る／土日祝には通らない／無い人は今のまま／既定の勤務の検査が変わらない／テレマの提出が変わらない／歯車の追加・削除・権限／選ぶ欄の表示（時刻つきの名前）／読み込みの形（ちらつかせない）。`npx tsc --noEmit`、`npx vitest run src/lib/shift src/app/system/shift src/lib/ui/no-flicker-source.test.ts` が通ること。

## 終わったら

`docs/dispatches/report-codex-517-shift-default-options-20261104.md` に、直したファイル・migration・テスト結果を書く。cron は足さない。
