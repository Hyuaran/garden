# Codex-498 表の上の絞り込みの箱のうち、見出しの絞り込みと二重のものを消す（2026-10-30）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
**ファイルは UTF-8。日本語を書いたら読み直して「?」に化けていないことを確かめる。**
社長スタイル §2.5 の型・§2.6 の点検に従う。

## 東海林さんの指摘（画面の言葉）
「公式 LINE の人とタグの表の上のプルダウン（雇用形態・事業・在籍・役割・チーム・自由タグ）はいらないのでは？　他の箇所も同じような残りがないか確認して」
→ 共通の表（`src/app/system/_components/DataTable/DataTable.tsx`）は、見出しの「名前 ⌄」で**値を複数選んで絞り込める**。表の上に同じ列の絞り込みの箱があると二重。

## 決まり（この判断で全画面を見る）
**消す**：共通の DataTable の**上（または近く）にある絞り込みの箱（BoxSelect・ChoiceFilter・MultiSelectFilter など）で、その表の列と同じ値で行を絞るだけのもの**。
**残す**（消さない）：
1. 読み込むデータの範囲を決めるもの（期間・集計期間・月・年度など。表の行を絞るのではなく取り直すもの）
2. 表の列に無い値で絞るもの（例：列に出ていないタグで絞る）→ ただし、その値を列として足せば見出しで絞れるなら、**列を足して箱を消す**（例：公式 LINE の「自由タグ」が列に無ければ「自由タグ」の列を足して見出しで絞れるようにし、箱は消す）
3. 共通の DataTable ではない表（見出しで絞れない表）の上の箱
4. フォームの入力欄（`FormRow` の中・設定の小窓の中）
5. サーバーで絞って件数が多すぎるのを防いでいるもの（全件を読まないための箱）。迷ったら残して報告に書く

## 候補（`grep -rn "<BoxSelect\|<ChoiceFilter\|MultiSelectFilter" src/app` の結果から。全部を見ること）
- `src/app/system/line/LineManager.tsx`（人とタグ：雇用形態・事業・在籍・役割・チーム・自由タグ）← **東海林さんの指摘の画面。必ず消す**
- `src/app/sprout/sprout.tsx`（状況・期間）／`src/app/sprout/postings/baitoru-panel.tsx`（通知の宛先）
- `src/app/root/employees/page.tsx`（区分・出どころ＝履歴の小窓）／`src/app/root/bank-accounts/page.tsx`／`src/app/root/permissions/PermissionsClient.tsx`（権限）／`src/app/root/inbox/page.tsx`／`src/app/root/bank-check/page.tsx`／`src/app/root/kot-sync-history/page.tsx`
- `src/app/bud/transfers/_components/FilterBar.tsx`・`TransferApprovalPanel.tsx`・`TransferPaymentCategoryPanel.tsx`／`src/app/bud/expenses/_components/*Panel.tsx`／`src/app/bud/statements/*`／`src/app/bud/profit/broadband/BroadbandTable.tsx`
- `src/app/system/innovera-calls/InnoveraCallsClient.tsx`（発着）／`src/app/system/list/_components/ListMasterClient.tsx`／`src/app/_components/notices/NoticeList.tsx`／`src/app/bloom/progress/components/ProgressDashboard.tsx`／`src/app/p/toss/board/Board.tsx`
- ほかに見つかったものも同じ決まりで判断する

## やること
1. 候補を 1 つずつ見て、上の決まりで「消す／残す」を決める。
2. 消すもの：箱と、その箱のための状態（useState）・絞り込みの処理を消す。表の列に `filterValue` が要るなら足す（「—」「未設定」などが選べるように）。URL に絞り込みの状態を持っていたら、その引数も外す（古いリンクで壊れないこと）。
3. 箱が無くなって空いた行（FilterRow など）は詰める。
4. テストを直す（箱を探しているテストは、見出しの絞り込みで同じことを確かめる形に）。

## テスト
`npx tsc --noEmit` と `npx vitest run src/app --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること。

## 終わったら
`docs/dispatches/report-codex-498-remove-duplicate-table-filters-20261030.md`（UTF-8）に、**箱ごとの一覧**（画面・箱の見出し・消した／残した・理由）を書く。
