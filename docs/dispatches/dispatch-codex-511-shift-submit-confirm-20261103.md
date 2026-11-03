# Codex-511 シフトの提出と確定（Garden・スマホ・公式LINE）（2026-11-03）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（commit もしない）。パソコン操作（computer-use）・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。LINE を本当に送らない（テストはモック）。** ファイルは UTF-8。長い説明は不要・必要な範囲だけ読む。
画面の文字はきちんとした日本語（「変える」→「変更する」、「入れる」→「入力する」）。開発者用語・英語を画面に出さない。

KING OF TIME（KOT）へ送るのは次の指示書（Codex-512）。今回は作らない。

## 決まりごと（東海林さん確定）
- 提出するのは **テレマのアルバイトだけ**：`root_employees.employment_type = 'アルバイト'` かつ `business = 'ブロードバンド事業'` かつ 今のチーム（`root_employees_with_team.current_team`）が `バックヤード`・`所属なし` 以外。退職者は除く。判定は `src/lib/line/tags.ts` と同じ考え方で、共通の関数を1つ作って使う（`src/lib/shift/eligibility.ts` など）。社員などは「シフトの提出はありません。」とだけ出す
- 時間：**平日 14:00〜21:00／土日祝 10:00〜21:00**、**30分単位**、出勤する日は **18:00〜21:00 は必ず出勤** → 終わりは必ず 21:00。本人が選ぶのは「休み」か「開始時刻」だけ（平日 14:00〜18:00、土日祝 10:00〜18:00 の30分刻み）。祝日は `src/app/system/kanri/_lib/jp-holidays.ts` の `isJapaneseHoliday`
- 締切：**前月15日の 23:59（日本時間）**。締切までは本人が何度でも変更できる。過ぎたら本人は変更できない（「提出の締切を過ぎました。変更は責任者に連絡してください。」）。責任者は締切後も変更できる
- 定休日：**その日の合計シフト時間が少ない順に候補を出し、責任者が選ぶ**。保存先は今の管理表ポータルと同じ `system_kanri_month_setting.holidays`（同じ月の行。片方で直せばもう片方にも出る）
- 確定・変更できる人＝「みんなのシフト」タブの**閲覧権限がある人**（歯車）。既定＝責任者以上（manager・admin・super_admin）

## 保存先（新しい表・migration `supabase/migrations/20261103000511_shift_submit_confirm.sql`）
RLS 有効・ポリシーなし（サーバーの管理者接続だけで読み書き。ほかの system_* と同じ形）。employee_id は `root_employees(employee_id)` への外部キー（text）。
- `system_shift_wish`：employee_id・work_date date・start_time time（null＝休み）・updated_at・updated_by（employee_id）。一意＝(employee_id, work_date)
- `system_shift_submission`：employee_id・year_month text（'YYYY-MM'）・submitted_at・updated_at・updated_by。一意＝(employee_id, year_month)。「提出済み」の印
- `system_shift_confirmed`：employee_id・work_date・start_time time（null＝休み）・end_time time・updated_at・updated_by。一意＝(employee_id, work_date)。**KOT へ送るのはこの表**（次の指示書で送信状態の列を足す）
- `system_shift_month`：year_month text 主キー・confirmed_at・confirmed_by・confirmed_by_name
- 閲覧権限の行（`system_view_scopes`）：`system-shift` の `mine`＝全員、`team`＝manager・admin・super_admin（20261102000510 と同じ書き方）

## 画面
### A. 本人「自分のシフト」（/system/shift の「自分のシフト」タブ・スマホ /m/shift・公式LINE /liff/shift）
3か所とも**同じ部品**（form-kit でそろえる。画面ごとに css を書かない）。/liff/shift は今は「準備中」の仮の画面 → `src/app/liff/forms/FormsPage.tsx` と同じ作り（LIFF の ID トークン → `verifyLiffEmployee`）で本物にする。`NEXT_PUBLIC_LIFF_SHIFT_ID` を使う。
```
自分のシフト
 [ 12月の希望を提出 ] [ 11月の確定シフト ]        ← 2〜3個なのでラジオ型の切り替え
 提出の締切：11月15日(土) 23:59　　状態：未提出／提出済み（11/10 21:03:12）
 ┌────────────────────────────────┐
 │ 12/1(月)  ( 休み ) ( 出勤 ) 開始 [14:00 ▼] 〜 21:00   │
 │ 12/2(火)  ( 休み ) ( 出勤 ) 開始 [15:30 ▼] 〜 21:00   │
 │ 12/6(土)  ( 休み ) ( 出勤 ) 開始 [10:00 ▼] 〜 21:00   │  ← 土日祝は 10:00 から
 │  …                                                     │
 └────────────────────────────────┘
 出勤 18日・合計 102 時間
 [ まとめて設定：平日 [14:00▼] 土日祝 [10:00▼] を全部の日に入れる ]
                                       [ 提出する ]
```
- 開いた月は「次の月」（今日が11月なら12月）。今月は確定シフトを読むだけ（休み・時間の一覧）
- 定休日に選ばれた日は「定休日」と出して選べない（確定後）
- スマホ幅で1日1行が崩れないこと（375px で横スクロールなし）
- 提出すると全画面で一瞬「提出しました」（`src/app/system/line/LineSendOverlay.tsx` と同じ幕の作り。共通にできるなら共通に）

### B. 責任者「みんなのシフト」（/system/shift の「みんなのシフト」タブ）
```
みんなのシフト         [ 12月 ▼ ]           最終更新 …   (歯車)
 提出 12/15人（未提出：山田 太郎・…）  [ 未提出の人に公式LINEで知らせる ]
 ┌氏名────┬1(月)┬2(火)┬3(水)┬ … ┬31(水)┐
 │宮永チーム                                    │ ← チームごとの見出し行
 │山田 太郎 │14:00│ 休 │15:30│ … │ 休  │   ← 行を押すと小窓（その人の月の一覧を変更）
 │…                                           │
 │合計時間  │ 42h │ 28h │ 35h │ … │ 40h │
 └────────────────────────────┘   ← 定休日の列は灰色
 定休日の候補（合計時間が少ない順）
  12/2(火) 28h [定休日にする]   12/9(火) 30h [定休日にする] …   ← 選んだ日は［定休日をやめる］
                                   [ この月のシフトを確定する ]
 確定：2026/11/16(日) 10:05:12 東海林 美琴
```
- 表は DataTable（社長スタイル・見出し中央・時刻は中央）。氏名の列は左に固定。行全体を押すと小窓。マスの中に選ぶ欄は置かない
- 小窓「山田 太郎さんのシフト（12月）」：A と同じ1日1行の部品で変更 → ［保存する］。確定前は希望（wish）を、確定後は確定シフト（confirmed）を直す
- ［この月のシフトを確定する］：Garden の確認の小窓 →「定休日以外の希望をそのまま確定シフトにします。確定すると本人の公式LINEに知らせます。」→ 確定。確定シフト＝希望のうち定休日を休みにしたもの。確定後にもう一度押すと「確定し直す」（希望から作り直す。小窓で直した分が消えることを確認の小窓に書く）
- 確定したら、公式LINE とつながっている人へ「12月のシフトが確定しました。公式LINEのメニューの［シフト］から確認できます。」を送る（`pushLineStaff`。送った記録は `system_line_staff_message` と同じ形で残す。つながっていない人は送らずに数だけ出す）
- ［未提出の人に公式LINEで知らせる］：確認の小窓（送る人の名前の一覧）→「12月のシフト希望の提出をお願いします。締切は11月15日(土) 23:59 です。公式LINEのメニューの［シフト］から提出できます。」を送る
- 送信中・送信後は LineSendOverlay と同じ全画面の幕

### 共通
- `/system/shift` は社長スタイルの型（SystemBreadcrumb・SystemTabs に歯車・UpdatedStamp）。今の `MyPageSectionPage section="shift"`／`ShiftTab`（準備中）は置き換える。マイページのシフトのタブも同じ部品を出す
- タブは閲覧権限で出し分け（見られないタブは出さない）。API もタブの権限で止める（本人用＝自分の分だけ・責任者用＝`canView("system-shift","team")`）
- `SYSTEM_VIEW_SCOPES` の `scope("shift","シフト")` にタブ（mine・team）を足す
- 開いた瞬間にちらつかない（最初の見た目を localStorage で決めない・読み込み中の仮の枠と同じ大きさ）。点検テスト `src/lib/ui/no-flicker-source.test.ts` を壊さない
- 小窓はスクロールバーを出さない（Garden の Modal）
- Garden 全体の検索 `src/lib/search/catalog.ts` に「シフト」を足す
- 日時は 2026/11/16(日) 10:05:12 の形（秒まで）

## API（例）
- `GET/PUT /api/system/shift/my?month=YYYY-MM`（本人。PUT＝その月の希望を丸ごと保存＋提出済みの印。締切後は 403 と日本語の理由）
- `GET/PUT /api/liff/shift?month=YYYY-MM`（LIFF の ID トークンで本人を判定。中身は上と同じ処理を共通関数で）
- `GET /api/system/shift/team?month=` ・`PUT /api/system/shift/team/person`（1人の月）・`POST /api/system/shift/team/holiday`（定休日の切り替え。`system_kanri_month_setting` に書く）・`POST /api/system/shift/team/confirm`・`POST /api/system/shift/team/remind`
- 入力チェックはサーバーでも必ず（30分単位・範囲・終わり21:00・対象者・締切）

## テスト
- 時間の決まり（平日/土日祝/祝日・30分・範囲外を弾く）、締切（15日 23:59 の前後・日本時間）、対象者の判定、定休日の候補の並び、確定（定休日が休みになる）、権限なしは 403、LINE はモックで送る相手と文
- 画面：本人の提出、責任者の行を押すと小窓、確定の確認の小窓
- `npx tsc --noEmit`（`.next/` の古い型は対象外）と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること

## 終わったら
`docs/dispatches/report-codex-511-shift-submit-confirm-20261103.md`（UTF-8）に、直したファイル・migration・テスト結果・決めたこと（迷った所）を書く。
