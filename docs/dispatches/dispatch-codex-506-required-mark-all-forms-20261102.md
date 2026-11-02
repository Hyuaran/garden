# Codex-506 必須の入力欄に赤い「＊」（Garden 全体）（2026-11-02）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
**パソコン操作（computer-use）・ブラウザ操作は使わない。** 画面の確認は Claude がやる。Codex はテストまで。
**ファイルは UTF-8。日本語を書いたら読み直して「?」に化けていないことを確かめる。**
**触らない場所**：`src/app/system/onboarding/**`・`src/app/api/system/onboarding/**`（別の Codex-505 が直している。読みもしない）。

## 東海林さんの指示
「必須項目は＊赤字をつけてほしい（ここだけではなく、Garden 全てその仕様に）」。空のままでは保存できない欄なのに、画面のどこにも必須と書いていない。

## やること
1. **共通の見た目**：`src/app/globals.css` に `.garden-required`（ラベルの文字の直後に置く赤い「＊」。色はライト・ダークどちらでも読める赤＝既存の危険・エラーの色のトークンを使う。少し左に余白・太字にしない・行の高さを変えない）を足す。
2. **共通部品に「必須」を持たせる**：`src/app/system/forms/_components/form-kit/index.tsx` の `FormRow` などラベルを出す部品に `required?: boolean` を足し、true ならラベルの直後に `<span className="garden-required" aria-hidden="true">＊</span>`。入力部品（TextField・NumberField・TextArea・SelectField・RadioGroup・日付など）が `required` を受け取ったら `aria-required="true"` も付ける。README.md に使い方を 1 行足す。
   - そのほかの共通部品（`src/app/system/_components/**` のラベル付きの入力・BoxSelect など）にラベルがあれば同じ形で。
3. **全画面をそろえる**：Garden の中で「空だと保存できない（`required` 属性・保存前の検査で空ならエラー・API で必須）」入力欄を探し、そのラベルに＊を付ける。
   - form-kit を使っている画面は `FormRow required` を付けるだけ。自前のラベル（`<label>` の中の文字・表のような入力欄の見出し）は、その文字の直後に同じ span を置く。
   - 必須でない欄には付けない。「どちらか一方が必須」は両方に付けず、ラベルの横に「（どちらか必須）」と書く。
   - 対象：System・Bud・Root・Leaf・Rill・マイページ・スマホの入口（`/m/**`）・関電トス（`/p/**`）・ログイン画面などすべて。検索欄・絞り込みは対象外。
4. **保存前の検査の文**：空のときのエラーの文が英語や「required」のままなら「〇〇を入力してください」に直す（見つけた分だけ）。

## テスト
- form-kit：`FormRow required` で＊が出る・`aria-required` が付く・required でなければ出ない。
- 直した画面のうち主なもの（各モジュール 1 つ以上）で、必須の欄に＊がある。
- `npx tsc --noEmit` と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx' --exclude 'src/app/system/onboarding/**'` が通ること（前から壊れているテスト AppHeader・KpiCard・BackgroundCarousel は対象外）。

## 終わったら
`docs/dispatches/report-codex-506-required-mark-all-forms-20261102.md`（UTF-8）に、＊を付けた画面と欄の一覧（画面・ファイル・欄）・付けなかった所と理由・テスト結果を書く。
