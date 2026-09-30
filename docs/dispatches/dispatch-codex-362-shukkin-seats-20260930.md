# Codex-362 出勤表・シフトLINE連絡テキスト生成：出勤表タブに「席数」を足す／説明文を KOT の出し方の手順に差し替える

作成日: 2026-09-30
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く。作成時点は 123c8fd）
**git は触らないこと（commit・branch・stash すべて禁止）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。画面に出る文言は日本語のまま（英語に書き換えない）。触ってよいのは下の「触るファイル」だけ。**

必ず先に読むもの：
- `src/app/system/forms/shukkin/ShukkinClient.tsx`（出勤表タブ＝`tab === "attendance"`・対象日の行＝`styles.controls`）
- `src/app/system/forms/shukkin/_lib/shukkin.ts`（`hasPlan`・`isRetired`・`activeMembers`・`rowsByNumber`・`SHUKKIN_GROUPS`）
- `src/app/api/system/shukkin/members/route.ts`（並びの GET は `root_employees` から氏名だけ取っている）
- 並びの今の中身（2026-09-30 本番で確認）：テレマ社員＝上田 0004・宮永 1165・小泉 1326・石原 1523（全員 正社員）／宮永・小泉・石原・新人チーム＝ほぼアルバイト（小谷 1554 は正社員・藤木 1490 は outsource・1555／1556／1557／1558／1561 は root_employees に未登録＝派遣）

## 1. 東海林さんの決定（2026-09-30）
- 出勤表タブの**対象日の行の上**に「席数」を出す：`総席数 25 － 出勤（社員 n ＋ アルバイト n）＝ 残 n`
- **数える人**：宮永チーム・小泉チーム・石原チーム・新人チームの全員 ＋ テレマ社員のうち**上田（0004）を除く**人（＝宮永・小泉・石原のリーダー）
- **社員／アルバイトの分け方**：名簿（root_employees）の雇用形態が `正社員` または `役員` なら社員、それ以外（アルバイト・outsource・名簿に未登録）はアルバイト
- **出勤に数える人**：その対象日に出勤予定がある人（今の `hasPlan` が true＝出勤表で「×」「公休」ではない人）。退職（`isRetired`）は数えない。時刻（10:00／14:00）では絞らない
- **数字は自動で入り、手で直せる**：社員・アルバイトの数は出勤表（読み込んだ KOT の日別データ）から自動で入れる。欄は数字の入力欄で、手で書き換えられる。総席数も入力欄（最初は 25）。対象日を変えた・CSV を読み直したときは、社員・アルバイトを自動の値に入れ直す
- **席数はコピーする出勤表の文面には入れない**（画面に出すだけ）
- **1. KOT の日別データ**の下の説明文（`今日の日別データ（出勤表用）と…使えます。`）を、次の文に差し替える（文言はこのまま）：
  `KING OF TIME ログイン＞エクスポート インポート＞データ出力 日別データCSV＞日付指定＞日付を本日/明日選択＞出力レイアウト Garden選択＞データ出力`

- **追加（2026-09-30 東海林さん）**：上田（0004）と東海林（0008）は打刻を押さないので、「出勤の確認を付ける」にしても**確認の印（○・※不明/打刻漏れの可能性・※hh：mm打刻）を一切付けない**。ただし**シフトの表示（14-21・公休・× など）はいつもどおり出す**

## 2. 直し方
### 0. 確認の印を付けない人（`_lib/shukkin.ts`）
- 定数 `CONFIRMATION_EXCLUDED_EMPLOYEE_NUMBERS = ["0004", "0008"]`（上田・東海林＝打刻を押さない・東海林さん 2026-09-30）
- `buildAttendanceMessage` で、この番号の人は `mark` を空にする（`shukkinShift` はそのまま出す）
- テスト：確認ありで 0004・0008 は印が無く、シフト（例 14-21・公休）は出る／ほかの人は今までどおり印が付く

### A. 並びの API に雇用形態を足す（`members/route.ts`）
- `root_employees` から `employee_number,name,employment_type` を取り、返す member に `employmentType: string`（無ければ `""`）を足す。保存（PUT）の受け取りは変えない
- `ShukkinMember` 型に `employmentType?: string` を足す

### B. 数える関数（`_lib/shukkin.ts`・純粋関数）
- 定数：`SEAT_TOTAL_DEFAULT = 25`／`SEAT_GROUPS = ["テレマ社員", "宮永チーム", "小泉チーム", "石原チーム", "新人チーム"]`／`SEAT_EXCLUDED_EMPLOYEE_NUMBERS = ["0004"]`（上田・東海林さん 2026-09-30）／`SEAT_STAFF_EMPLOYMENT_TYPES = ["正社員", "役員"]`
- `countSeatUsage({ rows, members, date }): { staff: number; partTime: number }`：`activeMembers` のうち `SEAT_GROUPS` に入り、除外番号でなく、その日の行が `hasPlan` で `isRetired` でない人を数える。`employmentType` が社員の種類なら staff、それ以外は partTime

### C. 画面（`ShukkinClient.tsx`・`shukkin.module.css`）
- 出勤表タブの先頭（今の `attendanceControls` の上）に、枠つきの 1 行：
  `席数　総席数 [25] － 出勤 社員 [3] ＋ アルバイト [14] ＝ 17　＝　残 8`
  - 入力欄は `type="number"`・`min=0`・幅は 3 桁ぶん。出勤の合計と残りは表示だけ
  - 残りがマイナスのときは赤字（社長スタイルの危険色の変数を使う・色の直書きはしない）
  - 狭い画面（760px 以下）では折り返してよい。横にはみ出さない
- 社員・アルバイトの値：`countSeatUsage` の結果を state に入れ、`attendanceDate`・`rows`・`members` が変わったら入れ直す。手で書き換えた値はその日のあいだ保持（入れ直しのきっかけ以外では上書きしない）
- 見た目は今の画面の部品（`styles.controls` などの余白・文字の大きさ）に合わせる。絵文字は使わない
- 説明文（`styles.hint`）を §1 の文に差し替える

## 3. 触るファイル
- `src/app/system/forms/shukkin/_lib/shukkin.ts`・`_lib/shukkin.test.ts`
- `src/app/system/forms/shukkin/ShukkinClient.tsx`・`shukkin.module.css`（画面のテストが無ければ新規 `ShukkinClient.test.tsx`）
- `src/app/api/system/shukkin/members/route.ts`（テストがあれば直す・無ければ新規）

## 4. テスト（vitest・`npx vitest run src/app/system/forms src/app/api/system/shukkin` を全部緑に）
- `countSeatUsage`：テレマ社員の上田（0004）は数えない・宮永（1165）は社員で数える／チームのアルバイトは partTime／正社員の小谷は staff／outsource と名簿に未登録は partTime／予定なし（×・公休・休みの種類）と退職は数えない／`SEAT_GROUPS` の外（訪販社員・ＢＹ）は数えない
- 画面：席数の行が対象日の上にある／自動の数が入る／手で直すと合計と残りが変わる／残りがマイナスで赤字の印／対象日を変えると自動の値に戻る／説明文が新しい文になっている
- 並びの API：`employmentType` が返る
- `npx tsc --noEmit`・触ったファイルの eslint

## 5. 画面の絵
```
1. KOT の日別データ
 ［CSV を選ぶ］ 2026-09-30.csv、2026-10-01.csv   2026/09/30〜2026/10/01・40 人
 KING OF TIME ログイン＞エクスポート インポート＞データ出力 日別データCSV＞日付指定＞日付を本日/明日選択＞出力レイアウト Garden選択＞データ出力   ← 差し替え

［出勤表］［シフト連絡（LINE）］［並びの設定］
┌──────────────────────────────────────────────┐
│ 席数　総席数 [25] － 出勤 社員 [3] ＋ アルバイト [14] ＝ 17　＝　残 8 │  ← 新しい
└──────────────────────────────────────────────┘
 対象日 [2026/09/30 ▼]  時刻 ○10:00 ●14:00  □出勤の確認を付ける          ［コピー］
┌────────────────────────────┐
│【出勤表】2026/09/30（水）14：00       │  ← 文面は今のまま（席数は入れない）
```

## 6. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル／テスト本数と結果／tsc・eslint
- 気づいた点・やり残し
