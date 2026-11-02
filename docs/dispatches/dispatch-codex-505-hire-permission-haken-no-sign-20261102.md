# Codex-505 入社手続き：見られる人が登録・入社まで押せる／派遣は苗字だけで進める／「締結しない」（2026-11-02）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
**パソコン操作（computer-use）・ブラウザ操作は使わない。** 画面の確認は Claude がやる。Codex はテストまで。
**本番の DB・Kintone・KING OF TIME に書き込まない**（migration は作るだけ。当てるのは Claude）。
**ファイルは UTF-8。日本語を書いたら読み直して「?」に化けていないことを確かめる。**
社長スタイル §2.5 の型・§2.6 の点検に従う。画面の文字はきちんとした日本語（変更する・入力する）。
**触ってよい場所**：`src/app/system/onboarding/**`・`src/app/api/system/onboarding/**`・`supabase/migrations/`（新規）・マニュアル（下の「マニュアル」）。`src/app/system/forms/_components/**` と `src/app/globals.css` は **別の Codex が直しているので読むだけ・触らない**。

## 東海林さんの指示（そのまま）
1. 「入社予定者を登録」ボタンが責任者権限で出ていなかった。閲覧権限があれば登録できるようにしておいて。［入社］も閲覧権限あれば押せるでいい（全権管理者は東海林だけ。在宅も多く、業務集中されるのは不可。閲覧は社員以上にしか付けないので問題なし。今までの手動もその子たちがしていた）。
2. 派遣の場合、苗字だけしか分からないことがある。名前の漢字や仮名、生年月日が入社前では不明。
3. 派遣の場合、雇用契約書等は結ばないので「締結しない」を追加。
4. 必須項目には赤い「＊」。

## 1. 書き込みの権限（全権管理者だけ → そのタブを見られる人）
- 今：画面 `page.tsx` の `canWrite={context.viewer.role === "super_admin"}`、裏 `hire-candidates.server.ts` の `hireAdminContext()`（書き込み系は garden_role が super_admin でないと 403）。
- 直し方：**入社予定者タブ（candidates）・入社後の確認タブ（confirmations）を見られる人（歯車の閲覧権限＝`canView("system-onboarding", <tab>, viewer)`）は、そのタブの書き込みもできる**。
  - candidates：登録・修正・辞退（no_show）・［入社］（社員番号→KING OF TIME→名簿→Garden）・［続きから］
  - confirmations：入社後の確認のチェック・LINE 確認・FileMaker など今 super_admin で押せるもの全部
- 裏の判定も同じにする（画面だけ開けて裏で 403 にしない）。どのタブの操作かを API で判定し、そのタブの閲覧権限で通す。在籍・ログインの確認は今どおり。
- 一覧の行を押して小窓が開く条件（`rowClickable`／`onRowClick` の `canWrite`）・ツールバーの［入社予定者を登録］も同じ条件。
- KING OF TIME の選択肢の読み込み（`loadOptions`）も書ける人なら読む。

## 2. 派遣は苗字だけで進められる
- 雇用形態が「派遣」のときだけ、**必須＝セイ・姓・入社予定日・所属法人・KING OF TIME の所属・KING OF TIME の雇用区分**。メイ・名・生年月日・性別は空のまま保存できる（性別は「不明」を選べる）。派遣以外は今どおり全部必須。
  - DB の列（first_name・first_name_kana・birthday・gender など）が NOT NULL なら、派遣だけ空を許す migration を作る（`supabase/migrations/20261102000505_hire_candidates_haken_partial.sql`・条件付きの check で「派遣以外は必須」を残す）。
- 一覧で、派遣で空の項目がある人の状態の横に「情報待ち」の印（状態の列の文字に足す形・色は注意の色）。
- ［入社］を押したとき（派遣で名が空）：
  - KING OF TIME には 姓＝入力どおり・名＝「未定」・カナの名＝「ミテイ」で登録。生年月日・性別は空なら送らない（KING OF TIME の API で省けない項目があれば、レポートに書いて止める＝勝手な値を入れない）。
  - Kintone 名簿：名・生年月日は空で作る（名簿の必須は 2026-11-02 に全部外した）。名簿の同一人物の照合（姓名＋生年月日）は、生年月日が空なら「社員番号＝打刻ID が同じ」で照合する。
  - Garden の root_employees：名が空なら氏名は姓だけ、生年月日は null。
- 入社後の確認タブ：派遣で空の項目がある人には、①締結の上に「⓪ 名前・生年月日」の欄を出す（名・メイ・生年月日・性別を入力して［保存する］）。保存すると Garden（入社予定者・root_employees）・KING OF TIME（従業員の変更 `updateKotEmployee`：lastName/firstName/phonetics/birthDate/gender）・Kintone 名簿（姓名・カナ・生年月日）をそろえる。KING OF TIME の変更が止まっている（`KOT_EMPLOYEE_UPDATE_ENABLED` が true でない・中継が止まっている）ときは、Garden と名簿だけ直して「KING OF TIME は手で直してください」と出す。
- 全部そろうと「情報待ち」が消える。

## 3. 「締結しない」
- 入社後の確認の ① 締結（雇用契約書・秘密保持誓約書・緊急連絡先）の各行に、「送った」「締結済み」に並べて「締結しない」のチェックを足す。
  - 「締結しない」を付けると、その行の「送った」「締結済み」は押せない（灰色）。外すと戻る。
  - 「締結しない」も済んだ扱い：見出しの 0/3 の数・`signaturesComplete`・次の段階へ進める条件（②以降）で、締結済みと同じに数える。
  - チェックリストの記録は今の形に合わせる（例：`contract_not_required` などのキーに checked_at／checked_by）。
- **派遣の人は、入社した時点で 3 つとも「締結しない」が付いている**（外せる）。
- 「雇用契約書の中身」の欄は、雇用契約書が「締結しない」なら閉じたまま（または出さない）。

## 4. 必須の赤い＊（この画面の分）
- 別の Codex（506）が Garden 全体に「必須の印」を入れる。共通の見た目は `globals.css` の `.garden-required`（赤い「＊」）として 506 が作る。
- この画面（入社予定者の登録・修正の小窓、⓪ 名前・生年月日の欄）では、ラベルの文字の直後に `<span className="garden-required" aria-hidden="true">＊</span>` を置き、入力欄には `required`／`aria-required="true"` を付ける。派遣のときは必須でなくなる欄の＊を消す（雇用形態を変えるとすぐ変わる）。

## テスト
- 責任者（歯車で入社予定者タブを見られる）が：登録ボタンが見える・登録できる・［入社］が押せる・入社後の確認のチェックができる（画面と API）。見られない人は 403。
- 派遣で姓だけ：保存できる／派遣以外で名が空なら保存できない／「情報待ち」が出る／入社で KING OF TIME に名「未定」で送る（中継のモック）／⓪で入れると KING OF TIME の変更・名簿の更新を呼ぶ。
- 締結しない：付けると数に入る・送った／締結済みが押せない・派遣は最初から 3 つ付いている。
- `npx tsc --noEmit` と `npx vitest run src/app/system/onboarding src/app/api/system/onboarding` が通ること。

## マニュアル（下書きまで・Storage に上げない）
`C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\` の ⓪①②③④ を、今回の変更に合わせて直す（④を正とし、版を 1 つ上げ、②③④の版と日付 2026-11-02 をそろえる）。直す前のファイルは同じフォルダの `999_Archive\<元の名前>.bak-20261102c` にコピー。①は「使い方」の書き方の決まり（`C:\Users\shoji\.claude\projects\C--garden-main028\memory\feedback_manual_usage_guide_style.md`）に従う。⓪の中の④（`<script id="md4">`）は触らない（Claude が写す）。

## 終わったら
`docs/dispatches/report-codex-505-hire-permission-haken-no-sign-20261102.md`（UTF-8）に、直したファイル・migration・KING OF TIME で省けなかった項目・テスト結果・マニュアルで直した所・決めきれなかった所を書く。
