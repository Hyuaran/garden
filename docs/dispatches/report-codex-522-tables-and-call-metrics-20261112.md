# Codex-522 作業報告（2026-11-12）

## 実施内容

- 通常画面のすべてのHTML表を globals.css の画面用規則で統一。共通 StickyTable は garden-table クラスも出力する。既存の独自表は table セレクターで同じ規則を適用するため、各画面へのクラスの追加漏れがない。
- セルの上・左の罫線をなくし、下・右の1px罫線に統一。separate / spacing 0 とし、固定列の影による罫線を削除。外枠の角丸を保つ。白・薄いグレー／暗色2色の不透明な列交互色、行ホバー・フォーカス・選択色を定義。
- コール集計：従業員のWEB4項目の実績判定を共通化。すべて0（未取得含む）は4項目とも「-」、1項目でも正の実績があれば0も従来どおり表示。入力データ・小計・合計を変更しない。画面とPDFの定義説明も共通。
- 申込みは従業員表・事業別小計とも太字（0も含む）。小計は画面を内容幅、PDFを専用の幅に変更。PDFは列交互色。
- PDFは配信処理のnowを受け、同一の日本時間・曜日・分までの集計日時を全ページ上部へ表示。表A・Bは縦に並べ、表単位の改ページ、列幅の総和をページの内容幅以内にする。
- Chatworkの本文・添付の送り先を決める関数を一か所に統合。CHATWORK_ROOM_KYOUYU_ID、未設定時CHATWORK_DEV_ROOM_ID。ルーム番号・環境変数の値は変更していない。
- 付与ポイント表の「終了期間も表示」を画面・テスト・マニュアルで統一。
- マニュアルは④を先に更新し、5点すべてへ反映。コール集計はv1.14、付与ポイント表はv1.2、日付は2026-11-12。既存版の記録は履歴として保持。

## 検証

- npx tsc --noEmit：成功。
- npx vitest run src/lib/ui src/app/system/_components src/app/system/call-metrics src/app/system/_lib src/app/api/system/call-report src/app/soil：成功（57ファイル・360テスト、44.80秒）。ログ：`tmp/vitest522-final-all.log`。
- テスト中にjsdomの既存の画面遷移に関する「Not implemented: navigation to another Document」の標準エラー出力があるが、最終の終了コードは0、全件成功。実ブラウザは起動していない。
- CSSソース検査：固定列とseparate、表のinset罫線禁止、縦線、列交互色、明暗3系統。StickyTableとDataTableのクラス出力を検査。
- 画面の実績0表示・申込みのみ実績あり・小計0不変・申込み太字を検査。PDFでは描画文字の座標と使用フォントで実績0表示・申込みの太字を検査。
- PDFの表A・Bのタイトル位置とページ番号から非重複を検査。表Aは20行×22pt以上なので同ページなら表Bまで440pt以上の間隔を要求。各描画文字の右端と列幅総和がページ内に収まることも検査。
- PDFをPDFiumで画像化し、全8ページの一覧と表A・Bを目視確認。日付・罫線・列色・改ページ・右端の切れなし。PyMuPDFでは日本語フォントの表示が不安定なため最終目視はPDFiumを使用。
- 本文色のコントラスト：ライト #17212e／白16.24、薄灰14.82。補助色 #5a6b80／白5.46、薄灰4.98。ダーク #edf4fb／地14.12、交互色12.07。補助色 #b7c5d4／地8.91、交互色7.62。いずれも4.5以上。コール集計の薄い0の色もライトで4.5以上になるよう調整。

## 作れなかったもの・実施しなかった操作・制限

- 指示された実装・マニュアル10点・報告書の未作成項目なし。以下は未実施の確認・運用作業。
- gitコマンド・コミット・computer-use・ブラウザ操作は一切実施していない。
- Kintone・Chatwork・INNOVERA・本番DBへの実呼出し、Vercelの設定変更、Storageへのアップロードなし。テストはモックとローカルPDFのみ。
- 定期取得・cronの追加なし：追加回数0回/日。vercel.jsonは変更なし。
- ブラウザによる1384px・390pxの画面表示の目視確認はユーザー指示に従い未実施。ソース・部品テストで検査した。開発ルームへの実配信と環境変数の切替は人間側／Claudeの後続作業。
- 印刷・PDFの一般表には画面用の共通規則を適用しない（@media screen）。コール集計PDFのみ個別に変更。

## 変更したソース・テスト

- `src/app/globals.css`
- `src/lib/ui/table-style-source.test.ts`
- `src/app/sprout/sprout.module.css`
- `src/app/system/attendance/attendance.module.css`
- `src/app/system/call-metrics/call-metrics.module.css`
- `src/app/system/call-metrics/CallMetricsClient.tsx`
- `src/app/system/call-metrics/page.test.tsx`
- `src/app/system/docs/docs.module.css`
- `src/app/system/kanri/kanri.module.css`
- `src/app/system/onboarding/onboarding.module.css`
- `src/app/system/_lib/call-metrics-pdf.test.tsx`
- `src/app/system/_lib/call-metrics-pdf.tsx`
- `src/app/system/_lib/call-metrics-web-display.test.ts`
- `src/app/system/_lib/call-metrics.ts`
- `src/app/system/_lib/call-report-delivery.ts`
- `src/app/system/_lib/chatwork.ts`
- `src/app/system/_components/DataTable/DataTable.module.css`
- `src/app/system/_components/StickyTable/table-style.test.tsx`
- `src/app/system/_components/StickyTable/useStickyTable.tsx`
- `src/app/system/list/_components/list-master.module.css`
- `src/app/system/forms/shukkin/shukkin.module.css`
- `src/app/system/forms/shukkin/_components/LineSendDialog.module.css`
- `src/app/sprout/postings/baitoru.module.css`
- `src/app/soil/product-points/ProductPointsClient.test.tsx`
- `src/app/soil/product-points/ProductPointsClient.tsx`
- `src/app/bud/bank/bank.module.css`
- `src/app/bud/expenses/expenses.module.css`
- `src/app/bud/_components/BudFaithfulFrame.module.css`
- `src/app/bud/_components/BudTableLoading.module.css`
- `src/app/bloom/kpi/components/KpiDashboard.module.css`
- `src/app/bloom/ceo-status/components/CeoStatusDashboard.module.css`
- `src/app/(orientation)/system/kanri/display/display.module.css`

## 表の洗い出し：画面・部品

| ファイル（画面はパスに対応） | 適用と理由 |
| --- | --- |
| `src/app/(orientation)/system/kanri/display/DisplayClient.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bloom/ceo-status/components/CeoStatusDashboard.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bloom/kpi/components/KpiDashboard.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/_components/BudTableLoading.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/audit/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/bank/BalanceMatrix.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/bank/TransactionDetail.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/expenses/_components/ExpenseBookingPanel.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/expenses/_components/ExpenseDonePanel.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/expenses/_components/ExpenseFinalPanel.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/expenses/_components/ExpenseReviewPanel.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/expenses/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/invoices/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/journal/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/masters/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/payroll/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/profit/broadband/BroadbandTable.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/profit/ProfitContent.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/settings/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/shiwakechou/_components/JournalTable.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/statements/imports/StatementsImportsContent.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/statements/StatementsContent.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/statements/summary/StatementsSummaryContent.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/transfers/_components/StatusHistoryTab.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/transfers/_components/TransferApprovalPanel.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/transfers/_components/TransferInboxTray.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/transfers/_components/TransferPaymentCategoryPanel.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/bud/transfers/csv-export/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/bud/transfers/page.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/forest/_components/DetailModal.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/forest/_components/MicroGrid.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/forest/shiwakechou/[corp_id]/review/view.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/forest/shiwakechou/[corp_id]/view.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/forest/shiwakechou/balance-overview/view.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/my/ApDailyReview.tsx` | 共通部品から統一規則を適用。 |
| `src/app/p/toss/board/Board.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/root/_components/DataTable.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/_components/KotSyncModal.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/root/attendance/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/bank-accounts/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/bank-check/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/companies/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/employees/TeamHistoryPanel.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/employees/UrlViewClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/insurance/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/kot-sync-history/_components/SyncHistoryTable.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/mail-forwarding/UrlViewClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/minimum-wages/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/my-numbers/MyNumbers.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/permissions/PermissionsClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/salary-systems/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/root/vendors/page.tsx` | 共通部品から統一規則を適用。 |
| `src/app/soil/product-points/ProductPointsClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/sprout/postings/baitoru-panel.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/sprout/sprout.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/system/_components/DataTable/DataTable.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/_components/StickyTable/useStickyTable.tsx` | 共通クラスを付与。固定見出しの複製も元の計算済みスタイルを引き継ぐ。 |
| `src/app/system/_lib/call-metrics-pdf.tsx` | PDFのため画面規則の対象外。コール集計のみ個別修正。 |
| `src/app/system/attendance/AttendanceClient.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/system/attendance/CorrectionsPanel.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/call-metrics/CallMetricsClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/deliveries/DeliveriesHubClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/dev-board/BoardClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/docs/_components/HikariBasicsDocument.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/forms/expense/ExpenseClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/forms/FormsHubClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/forms/payroll-notice/PayrollNoticeClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/forms/shukkin/_components/LineSendDialog.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/system/forms/shukkin/ShukkinClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/haken/HakenClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/innovera/InnoveraSyncClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/innovera-calls/InnoveraCallsClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/kanri/KanriPortalClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/line/ContactSettings.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/line/GroupSettings.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/line/LineManager.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/line/RichMenuSettings.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/line/ScheduledBroadcasts.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/list/_components/ListMasterClient.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/system/manuals/ModuleManualsClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/onboarding/AdminOnboardingList.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/onboarding/HireCandidatesClient.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/shift/ShiftManager.tsx` | 独自HTML表も画面用の共通tableセレクターで適用。構造は維持。 |
| `src/app/system/sites/_components/SiteNewsPanel.tsx` | 共通部品から統一規則を適用。 |
| `src/app/system/sites/SitesHubClient.tsx` | 共通部品から統一規則を適用。 |

## 表の洗い出し：CSS

| CSS | 対応 |
| --- | --- |
| `src/app/(orientation)/system/kanri/display/display.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/bloom/ceo-status/components/CeoStatusDashboard.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/bloom/kpi/components/KpiDashboard.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/bud/_components/BudFaithfulFrame.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/bud/_components/BudTableLoading.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/bud/bank/bank.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/bud/expenses/expenses.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/bud/profit/broadband/broadband.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/forest/_components/ForestDesign.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/globals.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/p/toss/board/page.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/root/_components/root-shell.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/root/bank-accounts/page.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/root/mail-forwarding/page.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/sprout/postings/baitoru.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/sprout/sprout.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/_components/DataTable/DataTable.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/attendance/attendance.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/attendance/corrections.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/call-metrics/call-metrics.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/deliveries/deliveries.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/docs/docs.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/forms/forms.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/forms/payroll-notice/payroll-notice.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/forms/shukkin/_components/LineSendDialog.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/forms/shukkin/shukkin.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/innovera/innovera.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/innovera-calls/innovera-calls.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/kanri/kanri.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/list/_components/list-master.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/manuals/manuals.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/onboarding/onboarding.module.css` | 画面用共通規則で縦線・列色・separateを適用。 旧collapse等を修正（または共通規則を定義）。 |
| `src/app/system/shift/shift.css` | 画面用共通規則で縦線・列色・separateを適用。 |
| `src/app/system/sites/sites.module.css` | 画面用共通規則で縦線・列色・separateを適用。 |

## マニュアル変更ファイル

- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\01_テレマコール集計ポータル\Garden_System_テレマコール集計ポータル_0_要点サマリ.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\01_テレマコール集計ポータル\Garden_System_テレマコール集計ポータル_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\01_テレマコール集計ポータル\Garden_System_テレマコール集計ポータル_2_仕様書マニュアル_非エンジニア向け.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\01_テレマコール集計ポータル\Garden_System_テレマコール集計ポータル_3_仕様書マニュアル_エンジニア向け.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\01_テレマコール集計ポータル\Garden_System_テレマコール集計ポータル_4_仕様書_Claude読み込み用.md`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\Garden_System_付与ポイント表_0_要点サマリ.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\Garden_System_付与ポイント表_1_操作マニュアル_研修用.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\Garden_System_付与ポイント表_2_仕様書マニュアル_非エンジニア向け.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\Garden_System_付与ポイント表_3_仕様書マニュアル_エンジニア向け.html`
- `C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\Garden_System_付与ポイント表_4_仕様書_Claude読み込み用.md`
