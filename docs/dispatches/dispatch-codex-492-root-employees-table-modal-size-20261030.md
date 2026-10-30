# Codex-492 従業員マスタの表を共通の表にする・小窓の幅を3段にする（2026-10-30）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。

## 東海林さんの指摘（画面の言葉）
1. 行全体が押せるようになっているが、ID の列だけ色が変わらないので不自然
2. 小窓が狭すぎる。入力が多い小窓は見づらい。小さい小窓と入力の多い小窓の幅をそれぞれ決める
3. 検索窓の見出しと、虫眼鏡の横の薄い字が二重（どちらも「氏名・番号で検索（Ctrl+Shift+G）」）
4. 表の並び順を変えられない。表の見出しの所に絞り込み（複数選択）もない

## 今の作り（原因）
- `src/app/root/employees/page.tsx` の表は Root 独自の古い表 `src/app/root/_components/DataTable.tsx` を使っている。並べ替え・絞り込みがなく、`stickyFirstColumn` の 1 列目だけ自前の背景色を持つので、行の色が変わっても ID だけ変わらない。
- 社長スタイルの決まり（表は全部共通の `src/app/system/_components/DataTable/DataTable.tsx` の形＝見出しに「名前 ⌄」＋「↕」・漏斗・検索の箱）に合っていない。
- 小窓：共通 `src/app/system/_components/Modal/Modal.tsx` は size が `md`（640px）と `sm`（520px）だけ。Root の `src/app/root/_components/Modal.tsx` は `width={860}` などを受けても `md` に丸めている（globals.css 3565 行付近・3587 行）。

## やること

### A. 小窓の幅を 3 段にする（全画面共通）
- `Modal.tsx`（system）の `size` に `"lg"` を足す：`"sm" | "md" | "lg"`。
- `src/app/globals.css` の `[data-garden-modal="panel"][data-size="sm"]` の隣に
  `[data-garden-modal="panel"][data-size="lg"] { width: min(960px, calc(100vw / var(--garden-zoom, 1) - 32px)) !important; }`
- Root の `Modal.tsx`：`width <= 520 → "sm"`、`width >= 800 → "lg"`、それ以外 `"md"`。
- 決まり（このあと正本に書く）：
  - **sm 520px**＝確認・入力が 1〜3 個
  - **md 640px**＝ふつうの入力（1〜2 列・8 個くらいまで）
  - **lg 960px**＝入力が多い（タブがある・3 列・中に表がある）
- スマホ幅では今どおり `100vw − 32px` に縮み、3 列の FieldGrid は今の決まりどおり 1 列に落ちること。

### B. 従業員マスタの表を共通の DataTable にする（`src/app/root/employees/page.tsx`）
- `import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable"` に置き換え、古い `Column` の列定義を `DataColumn<Employee>` に書き直す。各列に `value`・`type`（日付＝`"date"`、その他は `"text"`）。表示は今の `render` を残す（CLARITY_MASK も残す）。
  - 住所は `value`＝住所の文字（未登録は「未登録」）
  - 法人は `value`＝法人名、チームは「所属なし」を含めた文字、事業は「—」の代わりに「未設定」
  - 生年月日・退職日が空のときの `value` は空文字、表示は今どおり「—」。退職日の絞り込み候補は空を「なし」と見せる（`filterValue`）
  - 状態は `value`＝「在籍」「退職」
- `defaultSort={{ id: "num", direction: "asc" }}`（社員番号の小さい順）。`rowKey`＝employee_id。
- **行を押すと今と同じ編集の小窓が開く**（`onRowClick={setEditTarget}`）。
- **右端の操作列（編集・履歴・権限・無効化）は消す**（社長スタイル：表に［変更する］などのボタン列を置かない）。代わりに編集の小窓の中、タブの下に 1 行で並べる（既存の従業員のときだけ・新規追加では出さない）：
  ［履歴を見る］［Garden 権限を変更する］［無効にする］／［有効にする］。押せる条件・押せないときの title は今のボタンと同じ。押したら今と同じ小窓・処理を呼ぶ（編集の小窓は閉じずに上に開いてよい。無効化・有効化のあとは編集の小窓を閉じる）。
- 検索：共通 DataTable の検索の箱を使う。`searchText`＝氏名・カナ・社員番号、`searchPlaceholder="氏名・カナ・社員番号"`。今の `FilterBox`（氏名・番号で検索）は消す。**見出し「検索」と薄い字が同じ文にならないこと。**
- 法人の箱（ChoiceFilter）は消す（法人の列の見出しで複数選べるため）。
- ［Chatwork トークンを取り込む］［＋ 新規追加］は DataTable の `toolbar` に入れる（押せる条件・title は今のまま）。
- `pageSize` は 500（全員が 1 ページに入る）。
- キー操作：Ctrl+Shift+G は共通 DataTable の検索欄（`input[type=search]`）にフォーカスするよう残す。Ctrl+↑↓ の行移動・Ctrl+Enter は共通の表では使えないのでやめる（行は Tab で移って Enter で開ける）。`useMasterShortcuts` の使い方はこれに合わせて直す。
- `PageHeader` の `description`（タイトル下の説明文）は消す（社長スタイル：タイトル下に説明を置かない）。
- 表の行の色が変わるとき、**全部の列が同じ色**になること（1 列目だけ別の背景を持たせない）。

### C. テスト
- 従業員マスタのテスト（`src/app/root/employees/*.test.tsx`、特に role-edit-ui.test.tsx）を新しい形に合わせて直す。権限の変更・履歴・無効化は「行を押す→小窓のボタン」で開くようにする。
- system の Modal・DataTable のテストが通ること。`lg` の data-size が付くことのテストを 1 つ足す。
- `npx tsc --noEmit` と `npx vitest run src/app/root/employees src/app/system/_components/Modal src/app/system/_components/DataTable` が通ること（PDF の完全性テストは前から落ちているので対象外）。

## やらないこと
- 他の Root の画面（法人マスタ・銀行口座マスタ 等）の表は今回は触らない。
- 小窓の中の項目・タブの中身は変えない。
- git は触らない。

## 終わったら
`docs/dispatches/report-codex-492-root-employees-table-modal-size-20261030.md` に、直したファイル・テストの結果・迷った所を書く。
