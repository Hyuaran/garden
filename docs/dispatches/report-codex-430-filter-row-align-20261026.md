# Codex-430 実装報告

共通の FilterBox / FilterRow を追加し、入力欄を見出し＋値の箱に統一。候補検索は開閉式にして、説明文による高さのずれを解消。BoxSelect 本体、bud/bank、git、本番・DB は操作していません。npm install は実行していません。

## 変更ファイル

- `src/app/bloom/progress/components/ProgressDashboard.tsx`
- `src/app/bud/expenses/_components/ExpenseBookingPanel.tsx`
- `src/app/bud/expenses/_components/ExpenseFinalPanel.tsx`
- `src/app/bud/expenses/_components/ExpenseReviewPanel.tsx`
- `src/app/bud/transfers/_components/FilterBar.tsx`
- `src/app/bud/transfers/_components/TransferApprovalPanel.tsx`
- `src/app/bud/transfers/_components/TransferPaymentCategoryPanel.tsx`
- `src/app/p/toss/board/Board.tsx`
- `src/app/root/employees/page.tsx`
- `src/app/root/kot-sync-history/page.tsx`
- `src/app/sprout/sprout.tsx`
- `src/app/system/innovera-calls/InnoveraCallsClient.tsx`
- `src/app/system/list/_components/ListMasterClient.tsx`
- `src/app/bud/expenses/_components/ExpenseDonePanel.tsx`
- `src/app/bud/statements/imports/page.tsx`
- `src/app/bud/statements/page.tsx`
- `src/app/root/bank-accounts/page.tsx`
- `src/app/root/bank-check/page.tsx`
- `src/app/root/inbox/page.tsx`
- `src/app/root/permissions/PermissionsClient.tsx`
- `src/app/_components/notices/NoticeList.tsx`
- `src/app/system/list/_components/MultiSelectFilter.tsx`
- `src/app/system/list/_components/multi-select-filter.module.css`
- `src/app/system/list/_components/list-master.module.css`
- `src/app/system/innovera-calls/innovera-calls.module.css`
- `src/app/bud/profit/broadband/broadband.module.css`
- `src/app/system/_components/FilterBox/FilterBox.module.css`
- `src/app/system/_components/FilterBox/FilterBox.tsx`
- `src/app/system/_components/FilterBox/FilterRow.module.css`
- `src/app/system/_components/FilterBox/FilterRow.tsx`

## 確認

- npx tsc --noEmit：成功。
- 関連 Vitest：7ファイル・101件すべて成功。別途 BroadbandTable の既存テストも成功。
- 変更したソースを UTF-8 で読み直し、??? と置換文字がないことを確認。

## 未確認・制約

1384px・768px・390px でのブラウザー実表示は未確認。折り返しと幅制約は実装済みですが、実表示での高さ・行数の一致は未検証です。
/system/list は条件数が多く、最小幅160pxと期間入力の幅を保つため、1384pxで1〜2行に収まる要件は満たせていない可能性があります。フィルターの省略は行っていません。
