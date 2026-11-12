# Codex-527 入社手続きの画面の直し・ボタンとチェックの言葉をそろえる（2026-11-12）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。KING OF TIME・Kintone・LINE・Drive を本当に呼ばない。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。画面の文字はきちんとした日本語。**コードは周りと同じく読みやすく書く**。

## 読むもの

`src/app/system/onboarding/HireCandidatesClient.tsx`（入社予定者の小窓：辞退・入社・閉じる・保存する）、`AdminOnboardingList.tsx`（みんなの入社手続き）、`src/app/system/onboarding/_lib/hire-candidates.server.ts`、`src/app/api/system/onboarding/` の入社予定者の API、`src/app/system/_components/DataTable/`（`defaultSort`）、`src/app/system/_components/form-kit*`。

## 1. 入社予定者の削除（全権管理者だけ）

- 入社予定者の小窓の左下、［辞退］の隣に［削除］を置く。**全権管理者だけ**に出す
- 押すと確認：「○○さんの入社予定を削除します。元に戻せません。」→［削除］［やめる］（危ない操作の色）
- 削除できるのは、まだ入社の手続きを進めていない人（`status` が入社予定・辞退）。**入社済み（`hired`・社員番号や Garden のアカウントを作った人）は削除できない**（ボタンを出さないか、押せない理由を出す）
- 削除は `system_hire_candidates` の行と、その人だけに付いている下書き（書類の控え等）。ほかの表に残る行があれば報告に書く（勝手に消さない）
- サーバーでも全権管理者か確かめる。削除したことを記録に残す（今の監査の記録の仕組みがあればそれに）

## 2. 「保存する」→「保存」（Garden 全体）

ほかのボタン（［入社］［閉じる］［辞退］）に合わせ、**ボタンの文字の「保存する」は「保存」にする**。Garden 全体で、ボタン（`button`・`ActionButton`・`SubmitButton`・`label=` 等）の文字が「保存する」のものを全部直す。例：

- `src/app/system/onboarding/HireCandidatesClient.tsx`・`HireConfirmationSteps.tsx`
- `src/app/soil/product-points/ProductPointsClient.tsx`
- `src/app/system/attendance/sync-status/AttendanceSettings.tsx`
- `src/app/system/haken/HakenDetail.tsx`
- `src/app/system/line/GroupSettings.tsx`・`LineManager.tsx`・`ScheduledBroadcasts.tsx`
- `src/app/system/shift/DefaultPatternSettings.tsx`・`ShiftManager.tsx`
- `src/app/root/employees/TeamHistoryPanel.tsx`
- `src/app/tree/feedback/page.tsx`
- ほか、洗い出して全部（コメント・説明文の「保存する」は変えない。「作って保存する」など動作を足した言葉もそのまま）

## 3. チェックの言葉「〜を表示しない」→「〜を非表示」（Garden 全体）

- 「完了を表示しない」→ **「完了を非表示」**、「辞退者を表示しない」→ **「辞退者を非表示」**
- 同じ形の言葉を Garden 全体で洗い出して直す（例：`src/app/bud/bank/BankAccounts.tsx`）。「〜も表示」（付与ポイント表の「終了期間も表示」）はそのまま

## 4. チェックの場所（入社手続き）

- 今は表の下にある「完了を非表示」「辞退者を非表示」のチェックを、**表の上・右側**に置く。左側は［＋ 入社予定者を登録］などのボタン。ボタンが無いタブでも、チェックは表の上の右
- 入社手続きの各タブ（入社予定者・入社後の確認・みんなの入社手続き）でそろえる
- ちらつかせない（`src/lib/ui/no-flicker-source.test.ts`）

## 5. みんなの入社手続きの並び

既定の並びを **入社日の新しい順（降順）** にする。

## 6. 「事務が入れる」をワンクリックで埋めるひな形

公式 LINE の定型文のように、事務が入れる欄をまとめて埋めるボタンを置く（東海林さん 2026-11-12）。

- 「事務が入れる」の見出しの下に［テレマバイト］［テレマ社員］［NHK社員］の 3 つのボタン
- 押すと、所属店舗・週の所定労働時間・健康保険・厚生年金・雇用保険・税区分・給与の区分・基本給・手当・交通費の上限 に、ひな形の値を入れる（**保存はしない**。入れたあと確かめて［保存］）。すでに入っている欄を上書きするときは確認を出す
- ひな形は DB に置き、**全権管理者が画面で値を変えられる**（公式 LINE の定型文の編集と同じ形の小窓）。表 `system_onboarding_admin_templates`（名前・並び順・各欄の値・最終更新）。migration はファイルだけ
- 初期値：
  - **NHK社員**：大阪本社・40・加入・加入・加入・甲・月給・基本給 260,000・手当なし・交通費の上限 15,000（山﨑さん・清水さんと同じ）
  - **テレマ社員**・**テレマバイト**：東海林さんに値を確認中。今は名前だけ作り、値は空（押しても何も入らない）。全権管理者が小窓で入れられること
- 権限：ボタンを押せるのは事務の欄を直せる人。ひな形の変更は全権管理者だけ

## 7. 入力欄のガタつき

「事務が入れる」の「交通費の上限（1か月・円）」の入力欄が、隣の「支給額（1か月・円）」より下にずれている（見出しと欄の間が空いている）。左右の欄の高さと位置をそろえる。同じ並び（2 列の欄）の画面全体で、見出しと欄の間・欄の高さがそろっているか確かめる。

## マニュアル

`04_入社手続き` の ⓪〜④（削除・言葉・チェックの場所・並び）。ほかに言葉を変えた画面のマニュアルで、ボタン名・チェック名を書いているところも同じ言葉に直す（`C:\Claude\000_Garden\` の下を「保存する」「を表示しない」で探す）。版は次・日付 2026-11-12。④を先に。**Storage へは上げない**。

## テスト

削除：全権管理者だけ表示・確認・入社済みは削除できない・サーバーでも断る・記録が付く／言葉：「保存する」ボタンが残っていない（ソースを探す検査を足す）・「を表示しない」が残っていない／チェックが表の上の右／みんなの入社手続きが入社日の降順／ひな形のボタンで欄が埋まる（保存はしない・上書きの確認・値が空のひな形は何も入れない）・ひな形の変更は全権管理者だけ／交通費の上限と支給額の欄の位置がそろう。
`npx tsc --noEmit`、`npx vitest run src/app/system src/app/soil src/app/root src/app/bud/bank src/app/tree src/lib/ui` が通ること（前から落ちているテストは報告に書く）。

## 終わったら

`docs/dispatches/report-codex-527-onboarding-ui-and-labels-20261112.md` に、直したファイル・言葉を変えた場所の一覧・migration（あれば）・テスト結果・作れなかったものを書く。
