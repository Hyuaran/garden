# Codex-527 作業報告（2026-11-12）

## 実装

- 入社予定の小窓の左下に［辞退］と［削除］を並べた。削除は全権管理者だけ。入社予定・辞退のうち採番・従業員作成・名簿登録・入社処理の記録が無い人だけを対象にする。辞退者の行も全権管理者は開ける。入社済みは対象外。
- 名前と「元に戻せません」の確認小窓を出し、危険操作の色の［削除］と［やめる］を表示。DELETE API は全権管理者の認証を必ず通す。DB関数でも操作者の有効な全権管理者ロールを確認し、行ロック後に状態・処理トークン・関連手続きを再確認する。
- 削除と `root_audit_log` の記録は同じトランザクション。監査失敗時は削除もロールバックする。対象ID・操作者・削除前状態・派遣の書類控えIDとDriveファイルIDを記録する。
- Garden全体の単独のボタン名「保存する」を「保存」に統一。説明文、コメント、［作って保存する］等は変更していない。チェックの「を表示しない」を「を非表示」に統一。「終了期間も表示」は維持。
- 入社予定者・入社後の確認・みんなの入社手続きのチェックを、表より上の右側へ移動。登録ボタンは左。既存の `useStoredView` と復元待ちを維持した。
- みんなの入社手続きの既定の並びを入社日の降順にした。
- 事務欄にDBのひな形ボタンと全権管理者向けの編集小窓を追加。適用はフォームの状態を変更するだけで保存しない。入力済みの異なる値を上書きするときは確認。空のひな形は何も変更しない。明示的な手当なし（空配列）は適用する。交通費の支給額は区分と上限から再計算。
- ひな形の読込・適用は事務入力ができる人だけ。変更APIは全権管理者だけ。最終更新日時を比較し、他の人の更新を上書きしない。
- 事務入力の2列は上ぞろえとし、入力・選択欄を48pxに統一。交通費上限の欄が、隣の支給額の補足文に引かれて下がる問題を修正。
- 親が作り直す `initialRows` 配列による再取得を避け、初回読込・タブ切替だけにした。

## migration（ファイル作成のみ・適用していない）

`supabase/migrations/20261112000527_onboarding_ui.sql`

- `system_onboarding_admin_templates`：名前、並び順、値のJSON、最終更新。RLS有効、一般利用者の直接アクセスなし、サーバー経由。
- 初期値：テレマバイト・テレマ社員は空。NHK社員は大阪本社・40時間・保険3種加入・甲・月給・260000円・手当なし・交通費上限15000円。
- `delete_unstarted_hire_candidate(uuid,uuid)`：サービスロール専用の削除・監査関数。
- 適用はClaude側で実施する。適用前はひな形と削除機能を利用できない。

## 削除範囲と残るデータ

- 削除対象：`system_hire_candidates`、その人専用で契約に結び付いていない `system_haken_document` の控え。既存FKのCASCADEで `system_hire_line_checks`、未送信の `system_filemaker_account_requests` も削除する。
- 派遣契約、契約に付いた書類、共有された書類発行バッチ、送信済み/従業員作成済みのFileMaker依頼がある場合は、関連データを勝手に消さず削除を拒否する。
- 採用元の `sprout_applicants` は残す。社員・アカウント・外部名簿は削除しない。
- Drive/Storageの実ファイルは削除しない。派遣の控えのDB行を削除してもDriveのファイルは残り得るため、監査ログの `draft_documents` のIDを基に管理者が確認する。検索用の `garden_search.texts` は既存の削除トリガーに従う。

## 取得回数

- 新規cron・定期取得は0回/日。
- ひな形取得は、権限のある事務詳細画面を開くごとに1回（1日N回開けばN回/日）。編集保存は保存操作1回につき1回。親の入力変更では再取得しない。
- 既存の処理中 `usePolling`（1.2秒間隔）は継続。連続24時間処理中なら最大72000回/日だが、通常は処理中だけで、T秒の処理あたり概ねT/1.2回。新しいタイマーは追加していない。

## 検証

- `npx tsc --noEmit`：成功。
- 指定の `npx vitest run src/app/system src/app/soil src/app/root src/app/bud/bank src/app/tree src/lib/ui`：278ファイル中270成功・2失敗・6スキップ。2380テスト中2370成功・2失敗・8スキップ。
- 今回の入社手続き・文言・ちらつきの検査は成功。追加した検査：削除ボタンの権限と確認・採番済みの除外、未着手/入社済み判定、サーバーの認証拒否とRPCへの操作者引渡し、ひな形の適用/空値/上書き確認/編集/権限、事務欄への反映と保存しないこと、入社日降順と表より上のチェック、全体ソースの旧ラベル残存検査。
- 全体テスト後、ひな形の同時編集拒否の検査を1件追加し、関連テストを再実行して成功（`tmp/codex527-final-focused.log`）。
- 変更外の失敗1：`src/app/system/sites/menu.test.ts:16`。サイトメニューの位置が期待12に対し13。
- 変更外の失敗2：`src/app/root/contracts/_lib/employment-contract-pdf-integrity.test.tsx:43`。`PDFDocument.load(buffer)` でpdfの型をNaNと判定するTypeError。
- 初回の広域実行では変更禁止範囲の `call-report-v3.test.ts` も失敗したが、最終実行では成功。こちらから変更していない。
- 既存の事務詳細テストは新しい独立コンポーネントをモックし、ひな形の通信・操作を専用テストと事務欄の結合テストで検証した。
- ブラウザ・computer-useは不使用。実画面の目視とDB関数の実DB適用/実行は未実施。外部サービスの実呼出しはしていない。

## マニュアル

④を先に更新し、入社手続き⓪〜④をv1.23・2026-11-12へ更新。削除、文言、チェックの位置、入社日降順、ひな形と権限を追記した。ほかにボタン名・チェック名を記したマニュアルを検索して更新し、該当する埋込み④も正本に同期。計16ファイル。UTF-8読込・置換文字なし・HTMLパーサーの確認済み。Storageにはアップロードしていない。

- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\Garden_System_入社手続き_4_仕様書_Claude読み込み用.md`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\Garden_System_入社手続き_0_要点サマリ.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\Garden_System_入社手続き_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\Garden_System_入社手続き_2_仕様書マニュアル_非エンジニア向け.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\Garden_System_入社手続き_3_仕様書マニュアル_エンジニア向け.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\Garden_System_シフト_0_要点サマリ.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\Garden_System_シフト_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\09_シフト\Garden_System_シフト_4_仕様書_Claude読み込み用.md`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\31_公式LINE\Garden_System_公式LINE_0_要点サマリ.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\31_公式LINE\Garden_System_公式LINE_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\31_公式LINE\Garden_System_公式LINE_4_仕様書_Claude読み込み用.md`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\33_派遣管理\Garden_System_派遣管理_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\Garden_System_付与ポイント表_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\070_Bud_経理収支\00_マニュアル\09_口座残高・カード利用\Garden_Bud_口座残高・カード利用_0_要点サマリ.html`
- `C:\Claude\000_Garden\070_Bud_経理収支\00_マニュアル\09_口座残高・カード利用\Garden_Bud_口座残高・カード利用_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\070_Bud_経理収支\00_マニュアル\09_口座残高・カード利用\Garden_Bud_口座残高・カード利用_4_仕様書_Claude読み込み用.md`

## コード変更ファイル

- `src/app/api/system/onboarding/admin-templates/route.ts`
- `src/app/api/system/onboarding/hire-candidates/[id]/route.ts`
- `src/app/bud/bank/BankAccounts.tsx`
- `src/app/bud/statements/statement-accounts.test.tsx`
- `src/app/my/ApDailyReport.test.tsx`
- `src/app/root/employees/TeamHistoryPanel.tsx`
- `src/app/root/employees/role-edit-ui.test.tsx`
- `src/app/root/minimum-wages/page.tsx`
- `src/app/soil/product-points/ProductPointsClient.test.tsx`
- `src/app/soil/product-points/ProductPointsClient.tsx`
- `src/app/system/attendance/sync-status/AttendanceSettings.tsx`
- `src/app/system/haken/HakenDetail.tsx`
- `src/app/system/line/GroupSettings.test.tsx`
- `src/app/system/line/GroupSettings.tsx`
- `src/app/system/line/LineManager.tsx`
- `src/app/system/line/ScheduledBroadcasts.test.tsx`
- `src/app/system/line/ScheduledBroadcasts.tsx`
- `src/app/system/line/settings.test.tsx`
- `src/app/system/onboarding/AdminOnboardingList.test.tsx`
- `src/app/system/onboarding/AdminOnboardingList.tsx`
- `src/app/system/onboarding/HireCandidatesClient.test.tsx`
- `src/app/system/onboarding/HireCandidatesClient.tsx`
- `src/app/system/onboarding/HireConfirmationSteps.tsx`
- `src/app/system/onboarding/_components/AdminTemplates.test.tsx`
- `src/app/system/onboarding/_components/AdminTemplates.tsx`
- `src/app/system/onboarding/_lib/hire-candidate-delete.server.test.ts`
- `src/app/system/onboarding/_lib/hire-candidate-delete.server.ts`
- `src/app/system/onboarding/_lib/hire-candidates.ts`
- `src/app/system/onboarding/_lib/onboarding-admin-templates.server.test.ts`
- `src/app/system/onboarding/_lib/onboarding-admin-templates.server.ts`
- `src/app/system/onboarding/_lib/onboarding-admin-templates.test.ts`
- `src/app/system/onboarding/_lib/onboarding-admin-templates.ts`
- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.dependent.test.tsx`
- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.householder.test.tsx`
- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.templates.test.tsx`
- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.test.tsx`
- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.tsx`
- `src/app/system/onboarding/onboarding.module.css`
- `src/app/system/onboarding/page.tsx`
- `src/app/system/shift/DefaultPatternSettings.test.tsx`
- `src/app/system/shift/DefaultPatternSettings.tsx`
- `src/app/system/shift/Shift.test.tsx`
- `src/app/system/shift/ShiftManager.tsx`
- `src/app/tree/feedback/page.tsx`
- `src/lib/ui/action-labels-source.test.ts`
- `supabase/migrations/20261112000527_onboarding_ui.sql`

## 未実施・引継ぎ

- テレマ2種の具体値は指示どおり未設定。東海林さん確認後に全権管理者がひな形編集で入力する。
- migrationの本番適用、実DBでの削除/監査の実行検証、Drive/Storage実ファイルの整理、ブラウザでの見た目の確認は未実施。
- git操作・コミット・本番書込なし。指定の4つの変更禁止ディレクトリは変更していない。
