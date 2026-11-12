# Codex-525 提出後も扶養家族の年間収入・マイナンバーを Garden に入れられるように（2026-11-12）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。Drive・Kintone を本当に呼ばない。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。
画面の文字はきちんとした日本語。**コードは周りと同じく読みやすく書く**。

## 背景（東海林さんの決定）

清水 和恵さん（EMP-1574）の入社連絡表を作るとき、扶養家族の年間収入と 2 人目のマイナンバーが空だった。本人の入力は提出済みで、DB の決まり（`system_onboarding_before_write`・`submitted applicant fields are read only`）により書き換えられず、差し戻しもない。足りない値を連絡表のファイルに後から書き足すと Excel が壊れた。**値は Garden に入れ、Garden から連絡表・扶養控除申告書を作り直す**のが正しい形（東海林さん「マイナンバーを Garden にも入れておく必要がある」）。

## 読むもの

`src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.tsx`（メール・世帯主の「修正」＝事務が提出後に直せる例）、`src/app/system/onboarding/_lib/onboarding-admin.server.ts`、`src/app/api/system/onboarding/admin/[employeeId]/route.ts`、`src/lib/my-number/`（`MyNumberForm.tsx`・`crypto`・`access.server.ts`・`submission.server.ts`）、`supabase/migrations/20261029000479_my_number_encrypt.sql`（トリガーと暗号化）、`20260902000001_system_onboarding_householder_editable.sql`（提出後に直せる欄を足した例）。

## 作るもの

### 1. 扶養家族の「年間収入」「職業または学校と学年」を事務が直せる

- 事務の画面の「本人が入れた内容」の扶養家族の各人に、メール・世帯主と同じ形の［修正］を付ける（年間収入・職業）
- 見る人・直せる人はメール・世帯主の［修正］と同じ
- トリガーは、提出後でも `dependents[n].annual_income` と `dependents[n].occupation` の変更だけを通す（ほかの欄・人数・並びの変更は今どおり断る）。今の本番の関数を土台に `create or replace`
- 年間収入は 0 以上の整数（カンマ可）

### 2. 扶養家族のマイナンバーを事務の画面から入れられる

- 扶養家族のマイナンバーが空の人に［マイナンバーを入れる］を出す。**全権管理者だけ**
- 入力は今のマイナンバーの部品（`MyNumberForm` 等）と同じ扱い：12 桁の検査、伏せて表示、保存は暗号化（`my_number_secret`）、平文を DB・ログ・画面に残さない、閲覧・入力の記録（今のマイナンバーの記録と同じ仕組み）
- すでに入っている人は今の［見る］のまま。直すときも同じ入力（上書きは確認を出す）
- トリガー：service_role の移し替えの例外は今のまま。この入力のための変更は `dependents[n].my_number_secret`（と空の `my_number`）だけを通す

### 3. 入れたあとに連絡表・扶養控除申告書を作り直せる

今の［入社連絡表を作る］［扶養控除申告書を作る］がそのまま新しい値を読むこと（変更不要のはず。テストで確かめる）。

## 変えないもの

本人の画面の動き、ほかの本人入力の読み取り専用、事務が入れる欄、連絡表の置き場（30_入社連絡票／社員番号_氏名）。

## マニュアル

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\` の ⓪〜④。④を先に。版 v1.22・日付 2026-11-12。①は「使い方」の書き方（業務の言葉で短く）。**Storage へは上げない**。

## テスト

提出後に年間収入・職業を直せる／ほかの本人入力は断られる（トリガー）／人数・並びは変えられない／マイナンバーは全権管理者だけ・12 桁の検査・暗号化されて平文が残らない・記録が付く／見るだけの人に［修正］［マイナンバーを入れる］が出ない／連絡表と扶養控除申告書が新しい値で作られる。
`npx tsc --noEmit`、`npx vitest run src/app/system/onboarding src/app/api/system/onboarding src/lib/my-number` が通ること。migration はローカルの PGlite で検証してよい（Codex-520 の方法）。

## 終わったら

`docs/dispatches/report-codex-525-onboarding-dependents-after-submit-20261112.md` に、直したファイル・migration・テスト結果・作れなかったものを書く。
