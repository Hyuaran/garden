# Codex-438：採用管理（Sprout）の読み込みを速くする（一覧で raw を読まない）（2026-10-26）

## 目的
`/sprout` を開くと「読み込み中」のまま 20 秒以上終わらない（Claude 確認 2026-10-26）。原因を測った：
- `src/app/sprout/actions.ts` の `loadSprout()` が `select * from sprout_applicants`（695 件）で **24 秒**・約 2.4MB。中身の約 9 割が `raw`（Kintone のレコード丸ごとの jsonb・合計 1.7MB）。
- `select * from sprout_hearing_sheets`（425 件）も `raw` 込みで 5 秒。
- `kintone_record_id` だけなら 55ms。
- 画面（`src/app/sprout/sprout.tsx`）で `raw` を使うのは**1 人を開いたときの詳細**（応募・希望・面接・求人の記録・ヒアリングシート＝94〜99 行あたり）だけ。

## やること
1. `loadSprout()`：一覧に要る列だけを読む（`raw` を読まない）。ヒアリングシートも一覧で要るのは `applicant_record_id` と件数程度のはずなので、`raw` を読まない（一覧で使っている列を確かめて最小にする）。4 つの照会は `Promise.all` で並べる（同じ pool・max 1 なら直列でもよいが、1 回の接続で済ませる）。
2. 詳細：応募者を開いたときに `loadApplicantDetail(kintoneRecordId)`（server action・`requireSproutUser()` を通す）で、その人の `raw` と紐づくヒアリングシート（`raw` 込み）だけを読む。開いた瞬間は見出し・基本情報（一覧の列）をすぐ出し、`raw` の欄は読み込み中の表示（`loading-style` の決まり・くるくるは控えめ）→ 届いたら出す。同じ人をもう一度開いたときは読み直さない（画面の中で覚えておく）。
3. 「入社予定者へ送る」など今の動きは変えない。`hireValues` が `raw` を使うならサーバー側で読む（今どおり）。
4. 目標：`/sprout` の一覧が手元で 2 秒以内に出る。詳細は開いて 1 秒以内。
5. テスト：一覧で raw を読まない（照会の列）／詳細を開くと raw を読む・2 回目は読まない／権限の無い人は詳細も読めない。

## 触らないもの
- 取り込み（`importRecruit`）・DB の形・本番。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run src/app/sprout src/lib/sprout`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
変更ファイル／テスト結果／一覧で読む列と、詳細で読む列。
