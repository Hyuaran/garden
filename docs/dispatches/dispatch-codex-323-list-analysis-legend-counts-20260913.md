# Codex-323 リストマスタ「分析」：円グラフの凡例に件数を付けて押せるように／結果ボタン列を廃止／見出しの文字切れと 14px の横スクロールを直す

作成日: 2026-09-13
作業ツリー: C:\garden\a-bloom-008
起点: main c4dee4d（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータに触らないこと。開発サーバ・ブラウザを起動しないこと。DB・API は今回触らない（画面と CSS だけ）。**

必ず先に読むもの：
- 画面：C:\garden\a-bloom-008\src\app\system\list\_components\ListMasterClient.tsx（`renderAnalysisBlock`＝1249 行あたり。`chartData`／`chartOptions`／`resultButtons` の部分・`resultColor`・`formatCount`・`openAnalysisDetail`・`ANALYSIS_TABLE_COLUMNS`）
- CSS：C:\garden\a-bloom-008\src\app\system\list\_components\list-master.module.css（`.analysisGrid`・`.chartPane`・`.analysisTableWrap`・`.analysisTable*`・`.resultButtons`・`.resultButton`・`.sortHeaderButton`）
- テスト：C:\garden\a-bloom-008\src\app\system\list\_components\ListMasterClient.test.tsx
- ④正本：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md §8-7（分析の作り）
- 前回の指示書：C:\garden\a-bloom-008\docs\dispatches\dispatch-codex-322-list-analysis-sort-vendor-filter-20260913.md（本番で実測した残り＝この指示書の 2）

## 0. 何を直すか（東海林さん 2026-09-13）

いま（本番 c4dee4d）：

```
┌ ① どこから購入したか ？                              購入先で絞る [ 指定なし ▼ ] ┐
│      ( 円グラフ )        ■ 留守                                                  │
│                          ■ 担不        ← chart.js の凡例。件数が無い              │
│                          ■ 無効                                                  │
│                          …                                                       │
│ 購入先 │件数 ▼│コール済み│総コール回│回転│有効│受注（案件│獲得（コール│受注率（有効│受注率（総数│ ← 文字が切れる
│ 合計   │ …                                                                       │
│ [● 留守 546,083 件] [● 担不 287,551 件] [● 無効 145,854 件] …  ← 結果ボタン列。廃止する │
└──────────────────────────────────────────────────────────────┘
```

直したあと：

```
┌ ① どこから購入したか ？                              購入先で絞る [ 指定なし ▼ ] ┐
│      ( 円グラフ )        ● 留守          546,083 件   ← 押すと一覧（detail）が開く  │
│                          ● 担不          287,551 件   ← 件数は右ぞろえ            │
│                          ● 無効          145,854 件                              │
│                          ● NG             25,840 件                              │
│                          ● 前確OK          7,548 件                              │
│                          ● 見込            5,771 件                              │
│                          ● 未コール    1,552,704 件                              │
│                          ● その他          3,540 件                              │
│ 購入先   │件数 ▼│コール │総コール│回転│有効│受注  │獲得    │受注率│受注率│ ← 切れない  │
│          │      │済み   │回数    │    │    │（案件）│（コール）│（有効）│（総数）│   （2 段） │
│ 合計     │ …                                                                     │
└──────────────────────────────────────────────────────────────┘
   （結果ボタン列は無くなる。①②③すべて同じ作り）
```

## 1. 凡例を自前で描く（①②③すべて）
- chart.js の凡例は消す（`plugins.legend.display = false`）。tooltip・切れを押したときの一覧（`onClick` → `openAnalysisDetail`）は今のまま
- 円グラフの右に自前の凡例を置く。`.chartPane` を「円グラフ（正方形・260px）＋凡例」の横並びにする（画面幅が狭いときは縦積み。既存の `@media` の `.chartPane` も揃える）
- 凡例の 1 行＝`<button type="button">`：`● 色の丸（10px・resultColor）`＋`結果名（左）`＋`件数（右ぞろえ・font-variant-numeric: tabular-nums・formatCount(item.rowCount) + " 件"）`。行は `display: grid; grid-template-columns: 10px 1fr auto` のように 3 列で、件数の列は右ぞろえ
- 並びは `selected.results` の順（今の結果ボタンと同じ）
- 行を押すと `openAnalysisDetail(block, selected.segment, item.result)`（今の結果ボタンと同じ動き）。乗せると背景がうっすら変わる（`.analysisSelectedRow` と同じ色でよい）
- 見た目は社長スタイル（ゴシック・濃紺/ティール）。ボタンの既定の枠・背景は消す（`.sortHeaderButton` と同じく `!important` で打ち消してよい）。文字 13px。行の高さ 24px 前後・件数が 1,552,704 のように 9 桁でも揃う
- 「購入先で絞る」で合計を作り直したときも、凡例の件数は作り直した合計（`selected.results`）を出す（今の仕組みのまま）

## 2. 結果ボタン列を廃止
- `resultButtons` の `<div>` ごと消す。CSS の `.resultButtons`・`.resultButton`・`.resultButton span` も消す（他で使っていないことを grep で確認）

## 3. 表の見出しの文字切れと 14px の横スクロールを直す（Codex-322 の残り・本番で実測）
- 実測（本番・枠 1,020px）：`.analysisTable` が `table-layout: fixed` で数字の列を `8.33%`（＝83px）にしているため、「総コール回数」「受注（案件）」「獲得（コール）」「受注率（有効）」「受注率（総数）」の見出しがはみ出し、右端が「獲得（コール」「受注率（有効」と欠けて見える。はみ出した分（scrollWidth 1,034 − clientWidth 1,020）で 14px の横スクロールが残る
- 直し方：**見出しを 2 段にできるようにする**。`ANALYSIS_TABLE_COLUMNS` の label を `「受注」「（案件）」` のように **1 段目・2 段目に分けて持つ**（例：`label: "受注", sub: "（案件）"`。分けないもの＝件数・コール済み・回転・有効はそのまま）。見出しは `<button className={sortHeaderButton}>` の中で 1 段目＋`<br/>`＋2 段目（または 2 つの `<span>` を縦積み）。▲▼ は 1 段目の右
  - 2 段にする列：総コール回数→「総コール」「回数」／受注（案件）→「受注」「（案件）」／獲得（コール）→「獲得」「（コール）」／受注率（有効）→「受注率」「（有効）」／受注率（総数）→「受注率」「（総数）」／コール済み→「コール」「済み」
- `.analysisTable` の `table-layout: fixed` と `8.33%` は外し、**数字の列は中身の幅（`width: 1%; white-space: nowrap`）・区切りの列は残り全部**（`.analysisSegmentName` の `max-width: 200px` の「…」はそのまま）。`.analysisTable` の `min-width` は 0（`.tableWrap table` の `min-width: 840px` を打ち消す）
- 直したあと、**枠 1,000px 前後で①②③とも `scrollWidth <= clientWidth`（横スクロールなし）**、見出しが 1 文字も欠けないこと。並べ替え（見出し押し）の動きは変えない
- 一覧（detail）の表（`renderAnalysisDetail`）も同じ `.analysisTable` を使っている。列が 3 つ（リスト名・投入日・件数）なので崩れないことだけ確認

## 4. テスト
- ListMasterClient.test.tsx に足す：分析の描画で「凡例の行（留守 546,083 件 など）」が `button` で出ること・押すと detail の fetch（`/api/soil/list/analysis/detail?…result=留守`）が呼ばれること・結果ボタン列（`resultButton`）が無いこと。既存テストで結果ボタンを前提にしているものがあれば凡例に置き換える
- 既存テスト（src/app/system/list）は全部通す

## 5. 変えてはいけないもの
- 集計の中身・API・DB
- 「？」（HelpTip）・表の並べ替え・購入先で絞る・「すべて表示する」・一覧（detail）の動き
- 絞り込みの 4 項目（MultiSelectFilter）の見た目・動き

## 6. 受け入れ基準
1. vitest（src/app/system/list）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. Claude が本番で：凡例に件数が右ぞろえで出る／凡例の行を押すと一覧が開く／結果ボタン列が無い／①②③とも横スクロールが無く見出しが欠けない、を実測

## 7. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜3 の結果（実行したコマンドと結果）／本番データ・git に触っていないことの明記

## 8. 既知の差分（Codex が追記する）
