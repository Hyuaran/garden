# Codex-495c 共通の表の検索の薄い字を表ごとに直す（2026-10-30）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。

## 直す点
共通の表 `src/app/system/_components/DataTable/DataTable.tsx` は `searchPlaceholder` を渡さないと薄い字が「内容・金額」になる。
検索窓が右上に出るようになり（Codex-495）、人の表で「内容・金額」と出るなど合っていないのが目立つ（例：`/system/line` の「人とタグ」）。

## やること
1. 共通の DataTable を使っている表（`import DataTable from "@/app/system/_components/DataTable/DataTable"` のもの。Root の古い `../_components/DataTable` は対象外）のうち、`searchPlaceholder` を渡していないものを全部探す。
   例：`src/app/system/line/LineManager.tsx`（3）・`ContactSettings.tsx`・`GroupSettings.tsx`・`RichMenuSettings.tsx`（2）、`src/app/system/forms/expense/ExpenseClient.tsx`、`src/app/system/docs/_components/HikariBasicsDocument.tsx`（2）、`src/app/bud/bank/TransactionDetail.tsx`、`src/app/sprout/postings/baitoru-panel.tsx`、`src/app/root/employees/TeamHistoryPanel.tsx`、`src/app/system/_lib/call-metrics-pdf.tsx`（2）など。`searchable={false}` のものは対象外。
2. それぞれ、その表の `searchText` に入っている項目を見て、**何で探せるかを「・」でつないだ短い日本語**を `searchPlaceholder` に渡す（例：「氏名・社員番号」「グループ名」「内容・金額」）。開発者用語・英語・略称は書かない。「〜で探す」は付けない（今の多くの表に合わせる）。本当に内容と金額で探す表はそのままでよい。
3. 共通の DataTable の既定値「内容・金額」は「キーワード」に変える（指定し忘れても変な字にならないように）。既定値に頼っているテストがあれば合わせる。

## テスト
`npx tsc --noEmit` と `npx vitest run src/app/system src/app/bud src/app/sprout src/app/root --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること。

## やらないこと
表の中身・検索の動き・置き場所は変えない／git は触らない

## 終わったら
`docs/dispatches/report-codex-495c-datatable-search-placeholders-20261030.md` に、表ごとの薄い字の一覧（ファイル・画面・付けた字）を書く。
