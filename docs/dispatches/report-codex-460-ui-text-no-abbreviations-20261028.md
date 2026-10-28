# Codex-460 実装報告

## 変更ファイル

ソース・テスト・CSS 85 ファイル、新規 migration 1 ファイル。この報告を含め 87 ファイル。

- `src/app/_components/__tests__/ModuleGrid.test.tsx`
- `src/app/_components/home/OrbGrid.tsx`
- `src/app/_components/layout/GardenShell/garden-shell-config.ts`
- `src/app/access-denied/page.tsx`
- `src/app/api/bloom/progress-html/route.ts`
- `src/app/api/bud/expense-ocr/route.ts`
- `src/app/api/bud/transfer-invoice-ocr/route.ts`
- `src/app/api/root/employees/[employeeId]/kot/route.test.ts`
- `src/app/api/root/employees/[employeeId]/kot/route.ts`
- `src/app/api/soil/list/_lib/history-sql.ts`
- `src/app/api/system/attendance/kot-export/_lib/kot-csv.ts`
- `src/app/api/system/attendance/kot-export/route.ts`
- `src/app/api/system/kanri/runs/[id]/kot/route.ts`
- `src/app/api/system/shineigyo-ingest/complete/route.ts`
- `src/app/bloom/_components/BloomPageHeader.tsx`
- `src/app/bloom/_components/BloomSidebar.tsx`
- `src/app/bloom/blueprint/_data/modules.ts`
- `src/app/bloom/blueprint/_data/notes.ts`
- `src/app/bloom/blueprint/_data/roles.ts`
- `src/app/bloom/daily-report/_data/daily-report.ts`
- `src/app/bloom/monthly-digest/_data/monthly-digest.ts`
- `src/app/bloom/progress/_data/progress.ts`
- `src/app/bloom/workboard/_data/workboard.ts`
- `src/app/bud/audit/page.tsx`
- `src/app/bud/bank/BalanceMatrix.tsx`
- `src/app/bud/bank/BankAccounts.test.tsx`
- `src/app/bud/bank/BankAccounts.tsx`
- `src/app/bud/bank/TransactionDetail.tsx`
- `src/app/bud/bank/bank.module.css`
- `src/app/bud/expenses/_components/ExpenseReviewPanel.tsx`
- `src/app/bud/invoices/page.tsx`
- `src/app/bud/payroll/_lib/distribution-functions.ts`
- `src/app/bud/payroll/_lib/schedule-functions.ts`
- `src/app/bud/payroll/page.tsx`
- `src/app/bud/settings/page.tsx`
- `src/app/bud/shiwakechou/page.tsx`
- `src/app/bud/transfers/_components/TransferFormRegular.tsx`
- `src/app/bud/transfers/_components/TransferInboxTray.tsx`
- `src/app/bud/transfers/new-regular/page.tsx`
- `src/app/forest/shiwakechou/[corp_id]/review/view.tsx`
- `src/app/forest/shiwakechou/[corp_id]/view.tsx`
- `src/app/forest/shiwakechou/view.tsx`
- `src/app/leaf/_components/KandenPrototypePage.tsx`
- `src/app/leaf/_components/LeafOverview.tsx`
- `src/app/leaf/_components/LeafShell.tsx`
- `src/app/m/_lib/mobile-modules.ts`
- `src/app/m/bud/submit/page.tsx`
- `src/app/root/_lib/__tests__/kot-hire.test.ts`
- `src/app/root/_lib/__tests__/kot-relay.test.ts`
- `src/app/root/_lib/csv-parse.ts`
- `src/app/root/_lib/kot-api.ts`
- `src/app/root/_lib/kot-employee-update.test.ts`
- `src/app/root/_lib/roster-sync.server.ts`
- `src/app/root/employees/KotEmployeePanel.test.tsx`
- `src/app/root/employees/KotEmployeePanel.tsx`
- `src/app/root/employees/page.tsx`
- `src/app/root/insurance/page.tsx`
- `src/app/soil/layout.tsx`
- `src/app/soil/view.tsx`
- `src/app/system/_components/UpdatedStamp/UpdatedStamp.test.tsx`
- `src/app/system/_lib/call-metrics-pdf.tsx`
- `src/app/system/_lib/lp-context.server.ts`
- `src/app/system/attendance/sync-status/SyncStatusClient.tsx`
- `src/app/system/attendance/sync-status/page.tsx`
- `src/app/system/attendance/sync-status/sync-status.module.css`
- `src/app/system/call-metrics/CallMetricsClient.tsx`
- `src/app/system/call-metrics/page.test.tsx`
- `src/app/system/forms/shukkin/ShukkinClient.tsx`
- `src/app/system/kanri/KanriPortalClient.test.tsx`
- `src/app/system/kanri/KanriPortalClient.tsx`
- `src/app/system/kanri/_lib/kanri-core.ts`
- `src/app/system/mypage/_lib/submission-kintone.server.test.ts`
- `src/app/system/mypage/_lib/submission-kintone.server.ts`
- `src/app/system/onboarding/HireCandidatesClient.tsx`
- `src/app/system/onboarding/_lib/hire-candidates.server.ts`
- `src/app/tree/page.tsx`
- `src/components/shared/garden-view/__tests__/ModuleSlot.test.tsx`
- `src/components/shared/garden-view/_lib/modules.ts`
- `src/lib/auth/permission-registry.ts`
- `src/lib/auth/root-view-scopes.ts`
- `src/lib/bud/mf/client.ts`
- `src/lib/bud/mf/mf.test.ts`
- `src/lib/bud/mf/sync.test.ts`
- `src/lib/mail-ndr-watch/parse.ts`
- `src/lib/mail-ndr-watch/watch.test.ts`
- `supabase/migrations/20261028000460_view_scope_labels_no_abbrev.sql`

## migration

```sql
-- 表示名のみ更新。本番への適用は人間側で行う。
begin;
update public.system_view_scopes
set label = 'KING OF TIME 同期履歴'
where page_key = 'root-kot-sync-history' and tab_key = '' and label = 'KOT 同期履歴';
commit;
```

作成のみ。本番 DB には未適用。既存 migration は未変更。

## 残した略称

現行ソースの文字列・テンプレート文字列・JSX を確認。古い控え、コメント、識別子、テスト説明を除外。通常の画面文言に対象略称は残っていない。日本語を含む文字列で残したものは以下の8件。

|場所|文字列|理由|
|---|---|---|
|src/app/bloom/blueprint/_data/modules.ts|030_Soil_DB基盤|実在する資料フォルダ名の参照|
|src/app/bloom/blueprint/_data/overview.ts|100_Projects/110_Garden/003_世界観とUI方針.md|実在する資料のファイル名|
|src/app/root/_lib/kot-api.ts|KOT_API_TOKEN が環境変数に設定されていません…|確認対象の環境変数名を正確に案内するため|
|src/app/api/soil/list/_lib/history-sql.ts|FM取込|出所を照合する SQL の値。表示用の文言は FileMaker に変更|
|src/lib/bud/broadband/run.ts|_MF_銀行|外部データのフィールドコード|
|src/lib/bud/broadband/run.ts|_MF_摘要|外部データのフィールドコード|
|src/lib/bud/broadband/run.ts|_MF_取引日|外部データのフィールドコード|
|src/lib/bud/broadband/run.ts|_MF_取引額|外部データのフィールドコード|

CSS・HTML 内のコメントにある MFC・OCR は指示どおり保持。URL、API ヘッダー、環境変数、CSV 見出し、DB のキー等も保持。

## 確認

- tsc --noEmit: 終了コード0。
- 文言更新後の ModuleGrid・ModuleSlot: 2ファイル、42テスト成功。
- 全体テスト（指定の AppHeader・KpiCard・BackgroundCarousel の3本を除外、testTimeout 20000）: 605ファイル成功・8ファイルスキップ（613）、6058テスト成功・32テストスキップ（6090）。FAIL 0。
- 最終コマンド: `npx.cmd --no-install vitest run --exclude '**/AppHeader.test.tsx' --exclude '**/KpiCard.test.tsx' --exclude '**/BackgroundCarousel.test.tsx' --testTimeout 20000`。
- 新しい BOM および ??? の文字化けなし。変更ファイルの既存 BOM は除去。既存行の改行コードは保持。
- 口座残高表の最小幅、再取得リンクの折り返し、CSV 生成ボタンの幅と折り返しを調整。1384px・375px のブラウザー実表示は未確認。架空データを渡した実コンポーネントのローカル確認画面を用意したが、http://127.0.0.1:4460 を開く操作がブラウザーの自動承認審査で拒否された（理由: ユーザーが許可しなかった）。確認用ファイル・サーバーは撤去済み。
- cron・ポーリングの追加なし。追加の定期取得は0回/日。
- git・npm install・本番 DB・Storage・環境変数・vercel.json は操作していない。
