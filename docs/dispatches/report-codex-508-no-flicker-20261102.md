# Codex-508 完了レポート — ちらつき対策（2026-11-02）

git・computer-use・ブラウザ操作・本番への直接書き込みは行っていない。コードとテスト、指定レポートを変更した。

## 共通部品

- DataTable：PC幅のローカル検索をSSRの時点からCSSで非表示。スマホ・ダイアログはローカル表示。検索は同じportalコンテナーを移動し、入力要素・検索文字・フォーカスを保持する。`loading` を追加し、取得中は空結果の文を出さず3行程度の高さを確保する。
- PageSearchSlot：幅・所有者・検索先・見出し余白の確定を `useLayoutEffect` に移した。空の検索枠でも36pxの高さを確保して測り、検索が入った後も余白を維持する。測定時は現在の見出しを参照する。
- HeaderViewToggle：代替ボタンを `visibility:hidden` にし、PC42px／スマホ30pxを予約。代替要素を絶対配置し、本物のボタンと一時的に二重の高さを取らない。保存値未読時のportal表示にも `ready` を渡す。
- ThemeProvider：保存した明暗の適用を描画前へ移した。GardenHeaderActionsは太陽・月を両方描き、`data-theme` のCSSで切り替える。
- `src/lib/ui/useStoredView.ts`：SSRとhydrationは同じ値・未準備状態。描画前に保存値を読み、未準備領域は場所を取って隠す。localStorage／sessionStorage、破損・利用不可、キー変更、storageイベント、既存のお気に入り変更イベントに対応。復元前に既定値を書き戻さない。
- URL初期値：`InitialUrlView` と `withInitialUrlView.server.tsx` で、サーバーの `searchParams` をクライアントに渡す。2系統の `useUrlTab` を共通化し、初回のブラウザURL読み直しを削除。履歴移動時の追従は維持。クライアントのページは `UrlViewClient.tsx` へ分けた。
- 補助フック：`useViewportMatch`、`useThemeAppearance`、`useBrowserOrigin`、`useBrowserLocation`。幅・チャートの明暗・リンク／お気に入りのURLを、未確定の見た目を出さず確定する。

## 乗せ替えた画面

### URL初期値をサーバーから渡すページ（44ページ）

- bloom：blueprint、ceo-status、kpi、progress。
- bud：audit、bank、bank/accounts/[id]、expenses、invoices、journal、masters、payroll、profit、profit/broadband、settings、statements、transfers、transfers/[transfer_id]、transfers/new-cashback、transfers/new-regular。
- forest：dashboard、shinkouki、shinkouki/[companyId]。
- leaf：kanden/backoffice、kanden/input。
- m：expense、expense/[form]。
- my：（入口）。
- root：employees、mail-forwarding、my-numbers。
- sprout：（入口）、postings。
- system：call-metrics、contracts、dev-board、forms/expense、kanri、line、list、manuals、onboarding、sites。
- tree：monitoring。

Budの注入HTMLも、選択中パネルの `active` をSSRのHTMLに反映する。公式LINE、口座残高のタブ・期間、ブロードバンド、管理リスト、振込の詳細指定、Rootの社員指定もサーバーからのURL値を使う。Innoveraは既存の初期タブ取得を維持し、重複した初回読み直しだけを削除した。

### 保存値の共通化

- `src/app/_components/home/GardenHomeClient.tsx`
- `src/app/_components/layout/GardenShell/GardenShell.tsx`
- `src/app/_components/layout/GardenShell/PageHeader.tsx`
- `src/app/bloom/_components/BloomActivityPanel.tsx`
- `src/app/bloom/_components/BloomSidebar.tsx`
- `src/app/bloom/_state/ViewModeContext.tsx`
- `src/app/bloom/ceo-status/components/CeoStatusDashboard.tsx`
- `src/app/bud/expenses/_components/ExpenseBookingPanel.tsx`
- `src/app/bud/expenses/_components/ExpenseFinalPanel.tsx`
- `src/app/bud/expenses/_components/ExpenseReviewPanel.tsx`
- `src/app/bud/profit/broadband/BroadbandTable.tsx`
- `src/app/my/ApDailyReview.tsx`
- `src/app/system/_components/ShachoShell/SidebarNavigation.tsx`
- `src/app/system/contracts/UrlViewClient.tsx`
- `src/app/system/deliveries/DeliveriesHubClient.tsx`
- `src/app/system/dev-board/BoardClient.tsx`
- `src/app/system/forms/FormsHubClient.tsx`
- `src/app/system/forms/expense/ExpenseClient.tsx`
- `src/app/system/line/LineManager.tsx`
- `src/app/system/onboarding/HireCandidatesClient.tsx`
- `src/app/system/onboarding/HireConfirmationSteps.tsx`
- `src/app/system/sites/SitesHubClient.tsx`
- `src/app/tree/qa/page.tsx`

### 取得中の表

入社予定者／入社後確認、公式LINE、LINEグループ、開発ボード、チーム履歴、経費報告、マイナンバー、銀行明細、Root社員一覧、Root郵便転送、Sprout採用一覧・掲載一覧、日報の表に `loading` を渡した。もともとデータ取得後にだけ描いていた表は、その制御も維持した。

入社予定者・入社後の確認は、`onboarding/page.tsx` の既存の `hireAdminContext(tab)` を通して `listCandidates(context, tab)` をサーバーで読み、`initialRows` を渡す。権限のないタブは従来どおり表示・取得しない。初期一覧がある場合、同じ一覧をクライアントのmount時にもう一度取得しない。

## 追加調査で見つけて直した箇所（指示8）

- 経費の記帳・最終確認の法人フィルター、経費報告の保存した種類／URLの種類。
- GardenShellの左メニュー・Activity折りたたみ、お気に入り一覧、PageHeaderのお気に入り状態と現在URL。
- BloomSidebar、BloomActivityPanel、Bloomのsimple/detail表示、開発環境のCEOプレビュー選択。
- ホームとTree Q&Aのお気に入り。
- 入社確認のFileMaker依頼期限の復元。
- Root銀行口座とRill Mailの画面幅判定。
- Systemマイページの従業員向けリンク（相対URLから絶対URLへの表示変更）。
- 振込承認パネルの詳細ID、Root社員一覧の社員ID指定。
- Root郵便転送とSproutの一覧にも取得中指定を追加。

保存用のlegacyファイル、認証・キャッシュ・操作後の業務処理は見た目の保存値復元と区別し、変更対象にしていない。

## 点検テストとルール

- `src/lib/ui/no-flicker-source.test.ts`：ASTで初期state・描画中のブラウザ依存値読み取り、画面内の保存表示復元を検出。共通部品の許可一覧を明示。import経路をたどり、`useUrlTab` に到達する全ページがサーバーの初期URLを渡すことを確認。
- `src/lib/ui/useStoredView.test.tsx`：SSR／hydrate一致、保存値を上書きしないこと、キー変更、保存不可時の継続を確認。
- `DataTable/NoFlicker.test.tsx`：renderToStringでPC検索の非表示指定、loading中の空結果抑止、主要5画面の最初の描画、URL初期タブ、Bud注入パネル、口座残高タブ、サーバー取得済み入社候補行を確認。
- `PageSearchSlot.test.tsx`：入力欄の同一性とフォーカス保持、複数表・ダイアログ、幅変更、検索がなくても余白を保持することを確認。既存のソース確認テストと画面テストのfixtureもサーバーから初期値を渡す形に更新。
- `src/app/system/_components/DataTable/README.md` に指定の点検文を追記した。
- 全体実行で既存のrelayキューテストの `waitMs:0` が時計の1ms進行に依存して失敗したため、そのテストだけDateを固定して安定化した。relayの本体処理は変更していない。

## テスト結果

- 全体テスト：成功 6642 件、失敗 0 件、スキップ 8 件（計 6650 件）。終了状態 success=True。
- `npx tsc --noEmit`：src側のエラー0件。終了コードは1で、`.next/dev/types/validator.ts` に残る旧 `/api/system/hire-candidates/...` 参照の7件のみ（指示書の対象外）。生成型の削除・変更はしていない。
- 全体コマンド：`npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`（集計用JSON reporterを併用）。691ファイルを実行した。
- 個別確認：保存値／初期描画／検索位置の31件、Root・初期描画46件、LINE・経費・振込・Rill等398件、Sprout・郵便転送25件、全体失敗箇所の再確認を実施。入力欄の選択範囲保持・入社候補のSSR行を含む最終30件も全件成功した。各確認の件数には重複がある。
- 新しいcron・周期取得・自動再取得は0回/日。入社一覧の初回取得はクライアントからサーバーへ移しただけで、初期データがある時のmount再取得を削減した。既存の `usePolling` の間隔・有効条件は変更していない。

## 残した事項

- 指定されたObsidianの `110_Garden` 内で、社長スタイル正本の§2.5／§2.6の該当ファイルを特定できなかった。スマホ画面の社長スタイル化の設計書は存在するが、指定節の正本とは一致しないため変更していない。
- ブラウザ実画面での視覚確認は実施していない（指示どおりClaude担当）。PC／スマホの実際の余白と見た目の最終確認は残る。実装上の未修正項目は上記の正本追記と生成型を除いて報告時点で把握していない。
