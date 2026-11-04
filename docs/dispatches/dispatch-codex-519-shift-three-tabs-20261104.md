# Codex-519 シフトを 3 タブにする（2026-11-04）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。KING OF TIME・LINE を本当に呼ばない。ホスト PC に触らない。`vercel.json` の crons に足さない。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語・略称を出さない。**コードは周りと同じく読みやすく書く**（1行に詰め込まない）。

## 読むもの

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\Garden_System_シフト_4_仕様書_Claude読み込み用.md`、`src/app/system/shift/ShiftManager.tsx`、`src/app/system/shift/MyShift.tsx`、`src/lib/shift/service.server.ts`、`src/lib/shift/rules.ts`、`src/lib/auth/system-view-scopes.ts`、`src/app/m/shift/page.tsx`、`src/app/liff/shift/ShiftPage.tsx`、`supabase/migrations/20261104000518_shift_default_options.sql`。

## 背景（東海林さんの決定）

今は「自分のシフト」1 つに提出と確定が混ざっていて分かりにくい。3 タブに分け、提出は 2 か月先まで出せるようにする。

## 画面

```
シフト
 [ 自分のシフトを提出 ] [ 確定した自分のシフト ] [ みんなのシフト ]

── 自分のシフトを提出 ──
 (●) 12月のシフト  ( ) 1月のシフト
 提出の締切：2026/11/15(日) 23:59:59　状態：未提出
 カレンダー／備考／［提出する］

── 確定した自分のシフト ──
 (●) 11月のシフト  ( ) 10月のシフト
 確定：2026/10/20(火) 12:00:00
 カレンダー（見るだけ）
```

### タブ「自分のシフトを提出」（`tab=mine` のまま）

**出す月＝まだ確定していない月のうち、古い順に 2 つ。** 候補は今月・来月・再来月。

- 確定した月（`system_shift_month` に `confirmed_at` がある月）は出さない
- 今月は「確定行が無く、本人の提出がある」ときだけ候補にする（来月の提出のまま月をまたいだ場合に見えるように）
- 既定の勤務の人は `DEFAULT_SHIFT_START_MONTH`（2026-12）より前を出さない

| 日付の例 | 出す月 |
|---|---|
| 11/4 | 12 月（提出できる）・1 月（提出できる） |
| 11/16〜12 月の確定前 | 12 月（見るだけ）・1 月（提出できる） |
| 12 月の確定後 | 1 月・2 月（提出できる） |

- 締切を過ぎた月は見るだけ。今の `closedMessage` を出す
- 提出後〜締切は、提出した内容を変更して出し直せる（今の動き）
- 月が 1 つしかないときはラジオを出さない（上の年月の見出しで分かる）
- 提出後の表示は今の「提出済み（日時）」

### タブ「確定した自分のシフト」（`tab=confirmed`・新規）

**出す月＝本人に確定行がある月、または確定済みの月のうち、新しい順に 2 つ。** 11 月は KING OF TIME から取り込んだ確定行があるが `system_shift_month` の行が無いことがあるので、確定行だけでも出す。

- カレンダーは見るだけ（変更できない）。備考の欄は出さない。提出ボタンを出さない
- 確定日時があれば「確定：日時」を出す。無いときは出さない（「まだ確定していません」と出さない）
- 1 か月も無いときは「確定したシフトはまだありません。」とだけ出す
- 月が 1 つしかないときはラジオを出さない

### タブ「みんなのシフト」

変更なし。

### スマホの入口（`/m/shift`・LIFF）

タブが無いので、上に「提出」「確定」のラジオを置いて同じ 2 つを切り替える。最初は提出。`form-kit` の `RadioGroup` を使う。`/m/shift` の見出しは今の `title` のまま。

### ちらつかせない

タブを切り替えても、読み込みが終わるまで仮の月やカレンダーを描かない。今の `shown`・読み込み中の形を守る。`src/lib/ui/no-flicker-source.test.ts` を通す。

## 受け口

- `myShift` の応答に `submit_months`（`[{ month, editable }]`）と `confirmed_months`（`[{ month }]`）を足す。月を計算する関数は `src/lib/shift/rules.ts` に純粋な関数で置き、テストする
- 画面は最初に月の一覧を受け取ってから描く。`shiftMonths()` に頼らない
- 本人の提出（PUT）は「来月または再来月」「締切前」「確定していない」だけ通す。今は来月だけなので直す

## データ

`supabase/migrations/20261104000520_shift_submit_two_months.sql`（ファイルを作るだけ）。

`save_shift_person` の本人提出（`p_submit`）の月の検査を「来月または再来月」にする。締切の検査（前月 15 日まで）と確定後の検査は今のまま。**今の本番の関数（20261104000518）を土台にして `create or replace`** し、ほかの動きを変えない。

## 権限

`src/lib/auth/system-view-scopes.ts` の shift に `scope('shift', '確定した自分のシフト', all, 'confirmed')` を足す。既定は全員。`自分のシフト` の表示名を `自分のシフトを提出` に変える（キー `mine` は変えない）。権限一覧のテストが通ること。

## 変えないもの

- 責任者の確定・KING OF TIME への送信・定休日候補・提出の案内の文面
- 既定の勤務とテレマの提出の検査（月の条件以外）

## マニュアル 5 点（⓪①②③④）

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\` の 5 点を直接直す。④を先に。版は v2.6、日付は 2026-11-04 にそろえる。①は「使い方」の書き方を守り、タブごとの章立てにする。**Storage へは上げない**。

## テスト

月の計算（上の表の 3 例・月またぎ・12 月→1 月・既定の勤務の開始前・確定行だけの月・今月の提出あり／なし）／再来月を提出できる／3 か月先は断る／締切後は断る／確定後は断る／確定タブは変更できず備考と提出ボタンが無い／確定が 0 か月の表示／月が 1 つのときラジオが無い／スマホの切り替え／権限 3 タブ／テレマと既定の勤務の両方／読み込みの形。
`npx tsc --noEmit`、`npx vitest run src/lib/shift src/app/system/shift src/app/liff/shift src/lib/auth/permission-registry.test.ts src/lib/auth/system-view-coverage.test.ts src/lib/ui/no-flicker-source.test.ts` が通ること。

## 終わったら

`docs/dispatches/report-codex-519-shift-three-tabs-20261104.md` に、直したファイル・migration・テスト結果・作れなかったものを書く。
