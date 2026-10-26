# Codex-432 完了報告

共通の画面・タブ閲覧設定と入社手続き4タブへの適用を実装。
git操作、npm install、本番DBへの適用、環境変数変更は行っていない。
`src/app/bud/bank/` と事業の収支の閲覧者設定は変更していない。

## 変更ファイル

- `src/lib/auth/permission-registry.ts`
- `src/lib/auth/view-permission.ts`
- `src/lib/auth/view-permission.server.ts`
- `src/lib/auth/view-permission-notice.server.ts`
- `src/lib/auth/view-permission.test.ts`
- `src/lib/auth/view-permission-onboarding.test.ts`
- `src/app/api/system/view-permissions/route.ts`
- `src/app/api/system/view-permissions/route.test.ts`
- `src/app/api/system/hire-candidates/route.ts`
- `src/app/api/system/onboarding/admin/[employeeId]/route.ts`
- `src/app/system/_components/ViewPermissionButton/ViewPermissionButton.tsx`
- `src/app/system/_components/ViewPermissionButton/view-permission.module.css`
- `src/app/system/_components/ViewPermissionButton/ViewPermissionButton.test.tsx`
- `src/app/system/_components/ShachoShell/ShachoShell.tsx`
- `src/app/system/layout.tsx`
- `src/app/system/onboarding/page.tsx`
- `src/app/system/onboarding/page.test.tsx`
- `src/app/system/onboarding/HireCandidatesClient.tsx`
- `src/app/system/onboarding/_lib/onboarding-admin.server.ts`
- `src/app/system/onboarding/_lib/hire-candidates.server.ts`
- `src/app/system/onboarding/_lib/hire-candidates.test.ts`
- `src/app/system/onboarding/_lib/onboarding.server.test.tsx`
- `src/app/system/onboarding/admin/[employeeId]/page.tsx`
- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.tsx`
- `src/app/root/permissions/page.tsx`
- `supabase/migrations/20261026000002_system_view_permissions.sql`
- この完了報告

型検査に伴う生成キャッシュ：`tsconfig.tsbuildinfo`。

## migration

`20261026000002_system_view_permissions.sql`（作成のみ・未適用）。
設定表、監査ログ、読み取りRLS、全権管理者の保存・リセットRPC、閲覧者追加RPCを追加。
RPC内で在籍・退職日・実行者を確認し、画面単位のロックで継承元の変更と追加を直列化する。
次の画面を適用する際は、registryの画面・タブ定義とSQLの既定役職定義を追加する。

## 検証

- `npx tsc --noEmit`：成功。
- `npx vitest run src/lib/auth src/app/system/onboarding src/app/system/_components src/app/api/system`：639成功・1失敗（114ファイル中113成功）。
- 失敗は `src/app/system/_components/FontSizeButton.test.tsx:51`。Rillの外枠に文字サイズボタンがなく、既存のソース検査が失敗する。該当するRillの実装とテストは変更していない。
- 追加した閲覧判定・設定API・モーダル・入社手続きの認可テストは成功。通知はモックし、実送信していない。
- 関連ファイルの連続した疑問符と置換文字を検査し、日本語の文字化けがないことを確認。

## 読み取りと留意点

- タブ→画面→registry既定で判定。空の役職・個人設定も有効な制限として扱う。全権管理者は常に閲覧可能。
- サーバー描画中はReact cacheで設定をまとめて共有する。設定表がまだない間は従来の既定。その他の読み取り障害では許可を広げない。
- 候補者一覧は対象タブを判定してから管理者接続で読む。入社予定者と入社後の確認で取得対象の状態も分ける。
- 事務一覧・詳細ページ・詳細GET APIは同じ閲覧判定後に管理者接続を使い、関連従業員の情報も管理者接続で読む。
- KOT登録・辞退・確認項目更新・事務入力・帳票保存などの書き込みAPIは従来の役職判定を維持。閲覧のみの人には編集操作も無効化。
- 閲覧を許可したのに既存RLSで事務・候補者データを取得できない経路は、確認した範囲では残っていない。ただしmigration未適用のため実DBでのRPC・RLS検証は未実施。
- 通知失敗時は追加・保存の成功を維持し、通知できなかったことを画面で知らせる。
