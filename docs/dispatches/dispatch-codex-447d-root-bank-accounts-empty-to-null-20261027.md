# Codex-447d：銀行口座の追加で支店コードが空だと保存できない・エラーが小窓の後ろに隠れる（2026-10-27）

## 前提
Codex-447〜447c の続き。Claude が画面で追加を試して見つけた不具合 2 つ。対象は `src/app/root/_lib/queries.ts`（`editableBankFields` まわり）・`src/app/root/bank-accounts/page.tsx`・テストだけ。

## 不具合
1. **支店コードを空にして追加すると保存できない**：空の欄が `""` のまま送られ、表の決まり `branch_code is null or 数字3桁` に引っかかる（Claude が DB で同じ値を入れて確認：`violates check constraint "bud_bank_accounts_branch_code_check"`）。
   → 送る前に、空（前後の空白を除いて空）の `branch_name`・`branch_code`・`sub_account_label`・`notes` は `null` にする。前後の空白は取る。追加・修正の両方。
2. **失敗の文が見えない**：保存に失敗すると、赤い帯が画面の上（小窓の後ろ）に出るだけで、小窓を開いたままの人には見えない。
   → 小窓を開いている間の保存失敗は、小窓の中（保存ボタンの上）に出す。入力チェックの帯も同じ。
   → 表の決まりに反したとき（コード 23514）は「入力の形が正しくありません（支店コードは数字3桁か空・口座番号は数字だけ）」のように、直し方が分かる文に。

## テスト
- 支店コード・補助科目名・メモを空で追加 → 送る値が `null` になる。
- 保存失敗の文が小窓の中に出る。
- `npx tsc --noEmit`・`npx vitest run src/app/root` が通る。「???」の文字化けなし・BOM なし。

## 触らないもの
- 送る列の種類（修正で法人・銀行・口座番号を送らない決まり）は変えない。Bud・Forest・DB・ほかの Root 画面。
- 別の Codex（Codex-446）が同じ作業ツリーで動いている。`src/app/leaf`・`soil`・`seed`・`fruit`・`forest`、`src/lib/auth`、`supabase/migrations` は読みもしない・触らない。
- **git は触らないでください。** npm install はしない。長い説明は不要。

## 完了報告（コードブロックで）
変更ファイル／テスト結果。
