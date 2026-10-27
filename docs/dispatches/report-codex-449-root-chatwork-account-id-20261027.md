# Codex-449 完了報告（2026-10-27）

- pre-flight：作業場所一致、HEAD `2466f208`、指定の既存コードあり、migration 未作成を確認して着手。
- Root の Chatwork ID 入力・検証・読み込み・保存、トークン登録時の ID 保存、バイトルの従業員宛先選択と送信直前の解決を実装。
- 個人番号の履歴比較は `submitted`・`source` のみ。日付だけ違う翌日の同期は 0 行、提出状況が変わると 1 行になるテストを追加。

## migration

`20261027000449_root_chatwork_account_id.sql` は `begin;` ～ `commit;`。
`root_employees.chatwork_account_id text` と数字 1～12 桁または NULL の CHECK（`root_employees_chatwork_account_id_digits`）、指定の列コメントを追加。一意制約なし。
`sprout_baitoru_settings.mention_employee_ids text[] not null default '{}'` を追加。旧 `mentions` 列は保持し、アプリでは取得・使用しない。値の投入・移行は実施していない。

## 検証

- `npx tsc --noEmit -p .`：終了コード 0、エラー 0。
- `npx vitest run src/app/root src/lib/sprout src/lib/chatwork src/app/sprout src/app/api/root src/app/system/forms/payroll-notice`：終了コード 0、56 ファイル・912 テストすべて成功。
- `git diff --check -- src`：問題なし。src 差分および新規ソースに `???` なし。
- テスト実行時に jsdom の `Not implemented: navigation to another Document` が出るが、失敗テストなし。

## 気づいたこと

- 同じトークンでも Chatwork ID が未保存・不一致なら一括同期で補完する。
- 個別トークン登録後は編集中の ID も更新し、続けて従業員を保存しても古い ID を戻さない。トークン削除では ID を保持する。
- migration の DB 適用・既存宛先の値移行は未実施。git の書き込みなし。着手前からの変更はそのまま。

## 変更ファイル

- `docs/dispatches/report-codex-449-root-chatwork-account-id-20261027.md`
- `src/app/api/root/employees/[employeeId]/chatwork-token/route.test.ts`
- `src/app/api/root/employees/[employeeId]/chatwork-token/route.ts`
- `src/app/root/_constants/types.ts`
- `src/app/root/_lib/__tests__/chatwork-mentions.test.ts`
- `src/app/root/_lib/__tests__/queries.employee-role.test.ts`
- `src/app/root/_lib/__tests__/roster-sync.test.ts`
- `src/app/root/_lib/__tests__/validators.employee.test.ts`
- `src/app/root/_lib/employee-select.ts`
- `src/app/root/_lib/roster-sync.server.ts`
- `src/app/root/_lib/validators.ts`
- `src/app/root/employees/page.tsx`
- `src/app/sprout/postings/baitoru-actions.test.ts`
- `src/app/sprout/postings/baitoru-actions.ts`
- `src/app/sprout/postings/baitoru-panel.test.tsx`
- `src/app/sprout/postings/baitoru-panel.tsx`
- `src/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server.test.ts`
- `src/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server.ts`
- `src/lib/chatwork/mentions.server.ts`
- `src/lib/sprout/baitoru.server.test.ts`
- `src/lib/sprout/baitoru.server.ts`
- `src/lib/sprout/baitoru.test.ts`
- `src/lib/sprout/baitoru.ts`
- `supabase/migrations/20261027000449_root_chatwork_account_id.sql`
