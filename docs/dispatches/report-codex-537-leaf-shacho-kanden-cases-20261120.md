# Codex-537 実装報告

## 実装内容

- Leaf の概要と「関電 案件一覧」を Soil と同じ社長スタイルの外枠に移しました。左メニューと概要の関電カードは閲覧権限に応じて表示します。
- 案件一覧は日本時間の年度を既定とし、4 月 1 日から翌年 3 月 31 日までを対象にします。進捗タブの件数は選択年度内で集計し、キャンセルの条件を優先します。案件一覧、写メの枚数、取り込み最終更新は 1 回のデータベース関数呼び出しで取得します。
- 行を開くと、閲覧権限を再確認して案件の詳細と写メを読み込みます。既存テーブルの `image_path` を保存先のキーとして使い、日付とキーの順に 1 時間の署名 URL を発行します。画像は遅延読み込みし、拡大・前後移動・JPEG としての保存に対応します。
- 新しい受注テーブルと取り込み履歴はサービスロール専用です。CSV は BOM と引用符内の改行に対応し、FileMaker 主キーで 1,000 件ずつ更新または追加します。全バッチが成功した時点で取り込み履歴を記録します。
- `leaf-overview` と `leaf-kanden` の保存済み設定を引き継ぎます。`leaf-kanden` の既定は責任者以上です。全権管理者は歯車で役職と個人を指定できます。旧入力・事務画面のキーはアプリの定義から外し、保存済み設定の行を移行時に削除する処理は設けていません。

## 作成したファイル

- `supabase/migrations/20261120000537_leaf_kanden_orders.sql`
- `scripts/leaf-kanden-orders/` の `import-fm-csv.ts`、`import-fm-csv.core.ts`、`import-fm-csv.core.test.ts`
- `src/app/leaf/_constants/menus.ts`、`src/lib/auth/leaf-view-scopes.ts`
- `src/app/leaf/kanden/` の `KandenCases.tsx`、`CaseDialog.tsx`、`case-dialog.module.css`、`cases.ts`、`actions.ts`、`KandenCases.test.tsx`、`cases.test.ts`、`actions.test.ts`
- この報告書

## 更新したファイル

- `src/app/leaf/` の `layout.tsx`、`page.tsx`、`view.tsx`、`_components/LeafShell.tsx`、`kanden/page.tsx`、`kanden/backoffice/page.tsx`。旧事務画面の URL は案件一覧へ転送します。
- `src/lib/auth/` の `leaf-forest-view-scopes.ts`、`leaf-forest-view.test.tsx`、`permission-registry.ts`、および `src/app/root/permissions/PermissionsClient.tsx`
- `src/app/system/_components/` の `HeaderViewToggle.tsx`、`UpdatedStamp/UpdatedStamp.tsx`、`ViewPermissionButton/ViewPermissionButton.tsx`
- `next.config.ts`、`vitest.config.ts`

## 削除したファイル

- `src/app/leaf/kanden/view.tsx`、`src/app/leaf/kanden/input/page.tsx`、`src/app/leaf/kanden/input/view.tsx`、`src/app/leaf/kanden/backoffice/view.tsx`
- `src/app/leaf/_components/` の `KandenPrototypePage.tsx`、`KandenPrototypePage.test.tsx`、`LeafOverview.tsx`、`LeafPages.module.css`
- `src/app/leaf/_templates/input.html`、`src/app/leaf/_templates/backoffice.html`、`src/app/api/leaf/prototype/route.ts`、`src/lib/auth/leaf-prototype-html.ts`

## 検証結果

- `npx tsc --noEmit` は成功しました。
- Leaf、CSV 変換、写メの管理番号、閲覧権限と共通部品の関連テストは 12 ファイル、258 件すべて成功しました。
- 指定の `npx vitest run src/app/leaf src/lib scripts/leaf-kanden-orders` は 2,051 件成功、3 件失敗、12 件スキップでした。失敗は変更対象と別の機能にありました。
  - `src/lib/auth/root-view-integration.test.tsx` の社員 API テストで、派遣会社の取得に使う `.in()` がモックにありません。
  - `src/lib/auth/system-view-integration.test.tsx` の権限定義テストで、シフトのタブ名と、そのテストが読む SQL の文字列が一致しません。
  - `src/lib/search/migration.test.ts` の検索索引テストで、SQL の索引定義に `system_haken_party` と `system_haken_worker` がありません。
- 社長スタイルの正本 §2.5〜2.7 と §3-6 をソースで確認しました。画面幅、明暗、スクロール時の見え方は実機未確認です。マイグレーションの適用、取り込みスクリプトの実行、実データの照合は実施していません。

## 気になった点

- **追加の定期 Vercel 呼び出しは 0 回/日**の見積もりです。利用者が一覧を開く、年度やタブを切り替える、詳細を開くときに読み込みます。画像本体は署名 URL から Storage が直接返します。
- 既存の PNG などは保存時に端末で JPEG に変換します。HEIC の表示・保存は端末の画像形式対応に依存します。
- CSV の更新は 1,000 件単位です。途中で失敗した場合は完了履歴が付かず、同じ CSV を再実行すると FileMaker 主キーで更新できます。受注日を読み取れない案件も取り込みますが、年度を判定できないため年度別一覧の対象外です。
- ホスト PC での実行書式は `npx tsx scripts/leaf-kanden-orders/import-fm-csv.ts --csv "<CSVのパス>" --dry-run` です。本取り込みでは `--dry-run` を外します。
