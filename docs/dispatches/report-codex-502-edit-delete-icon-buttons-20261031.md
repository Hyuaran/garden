# Codex-502 作業報告（2026-10-31）

## 実装

- 共通部品 `RowActionButton`（src/app/system/_components/RowActionButton/）を作成。34px・角丸9px・18px線画を TabActionButton に合わせた。鉛筆の先は左下 (4,20)、ゴミ箱はふた・取っ手・本体・縦線2本。削除のホバー・フォーカス・押下はテーマの --danger、無効時は灰色。
- 名前・title は編集／削除を既定とし、label で対象名を指定できる。既存の onClick・disabled・処理内容を引き継いだ。
- CircuitOrderEditor の表題追加ボタンを枠の一番上・左端へ移動。表題の操作名は「対象名を編集／削除」（代表番号なら「代表番号を編集／削除」）。小窓の題は「表題を編集／表題を削除／表題を追加する」、編集確定は「表題を編集」、削除確定は「削除する」。
- Next.js 同梱 use-client ガイド、社長スタイル正本 §2.5・§2.6 を確認。画面の実測は指示どおり Claude に引き継ぐ。
- 定期取得・cron・追加のデータ取得はなし（増加回数0回／日）。git、computer-use、ブラウザ操作、開発サーバ起動は行っていない。

## 置き換えた場所

| 画面 | ファイル | 前の文字・読み上げ名 |
|---|---|---|
| 振込の添付ファイル | src/app/bud/transfers/_components/AttachmentUploader.tsx | 削除（1か所） |
| メール | src/app/rill/mail/_components/RillMailScreen.tsx | 削除（1か所） |
| 勤怠 | src/app/root/attendance/page.tsx | 編集（1か所） |
| 銀行口座 | src/app/root/bank-accounts/page.tsx | 編集（1か所） |
| 法人 | src/app/root/companies/page.tsx | 編集（1か所） |
| 従業員 | src/app/root/employees/page.tsx | 削除（1か所） |
| 保険料率 | src/app/root/insurance/page.tsx | 編集（1か所） |
| 給与体系 | src/app/root/salary-systems/page.tsx | 編集（1か所） |
| 取引先 | src/app/root/vendors/page.tsx | 編集（1か所） |
| 給与連絡票 | src/app/system/forms/payroll-notice/PayrollNoticeClient.tsx | 削除（3か所） |
| 発信番号の並び順 | src/app/system/innovera-calls/CircuitOrderEditor.tsx | 名前を変更する、削除する（2か所） |
| LINE のタグ・あいさつ文 | src/app/system/line/LineManager.tsx | 名前を変更、削除、編集する（3か所） |
| サイトのお知らせ | src/app/system/sites/_components/SiteNewsPanel.tsx | 編集（1か所） |
| 休憩スケジュール | src/app/tree/break-schedule/page.tsx | 編集、削除（2か所） |
| トークスクリプト | src/app/tree/scripts/page.tsx | 編集、削除（2か所） |
| Q&A | src/app/tree/qa/page.tsx | ✏️ 編集（1か所） |
| 月次まとめ | src/app/bloom/monthly-digest/[month]/page.tsx | ✏️ 編集（1か所） |
| 月次まとめ | src/app/bloom/monthly-digest/[month]/edit/page.tsx | aria-label="削除"（1か所） |
| ワークボード | src/app/bloom/workboard/components/TodayPlanList.tsx | aria-label="削除"（1か所） |
| メール | src/app/rill/mail/_components/RillComposePane.tsx | aria-label={`${address}を削除`}、aria-label={`${attachment.name}を削除`}（2か所） |
| Rill のお気に入り | src/app/rill/_components/RillShachoShell.tsx | aria-label="削除"（1か所） |
| 求人掲載設定 | src/app/sprout/postings/baitoru-panel.tsx | aria-label={`${v}を削除`}（1か所） |
| お気に入り | src/app/_components/layout/GardenShell/GardenShell.tsx | aria-label="お気に入りから削除"（1か所） |

× の削除ボタンも、1件の予定・資料ページ・宛先・添付・選択肢・お気に入りを操作するものは同じゴミ箱へそろえた。月次まとめ・Q&A の絵文字付き編集も鉛筆へ変更。

## 置き換えなかった場所と理由

| ファイル | 前の文字 | 理由 |
|---|---|---|
| src/app/bud/expenses/_components/ExpenseReviewPanel.tsx | 削除 | 複数選択への一括操作 |
| src/app/rill/mail/_components/RillMailScreen.tsx | 削除 | 複数選択への一括操作 |
| src/app/root/employees/TeamHistoryPanel.tsx | 削除する | 小窓の保存と並ぶ最終削除 |
| src/app/system/innovera-calls/InnoveraCallsClient.tsx | 変更する | 画面の主操作（変更の実行・届出） |
| src/app/system/innovera-calls/InnoveraCallsClient.tsx | 変更する | 小窓の最終確認 |
| src/app/system/list/_components/ListMasterClient.tsx | 削除 | 小窓の最終確認 |
| src/app/system/mypage/tabs/ProfileTab.tsx | 変更する | 画面の主操作（変更の実行・届出） |
| src/app/tree/break-schedule/page.tsx | 削除 | 行内の最終削除確認 |

- src/app/root/employees/page.tsx の Garden 権限変更の実行、src/app/system/innovera-calls/InnoveraCallsClient.tsx の内線番号変更確定、共通 ConfirmDialog などの削除確定・送信・保存：小窓の最終操作なので文字を維持。
- src/app/bud/expenses/_components/ExpenseBookingPanel.tsx の「選択を削除」「要確認…件を対象外として削除」、ExpenseFinalPanel.tsx の「選択を削除」：一括操作なので文字を維持。
- ExpenseBookingPanel.tsx の「対象外として削除」、ExpenseReviewPanel.tsx の「削除済みへ」：単純な削除と異なる業務上の意味を文字で伝えるため保留。
- src/app/bloom/monthly-digest/components/MonthlyDigestDashboard.tsx の「編集」：別ページへのリンク（a）なのでナビゲーションの意味を維持。
- src/app/root/bank-accounts/page.tsx の銀行口座カード本体：カードの内容全体を押して編集する仕組みで、独立した編集ボタンではないため維持。カード内の編集操作は共通部品へ変更済み。
- src/app/bud/{expenses,invoices,journal,masters,payroll,settings,transfers}/page.tsx 内の SOURCE_HTML 等にある「編集／削除」：HTML文字列の旧画面。React の RowActionButton を直接埋められず、HTML注入や既存の委譲処理を変える必要があるため、指示書の「迷ったら置き換えず報告」に従って保留。React で実装された実操作は上の一覧で置き換えた。

## テスト

- RowActionButton 単体：名前・title・クリック・無効時・鉛筆の左下始点を検証。
- CircuitOrderEditor：追加ボタンが最初の行より前にあること、小窓の操作名、追加・編集・削除・番号の移動・保存失敗時の戻しを検証。
- LINE の既存テストを「編集」の名前で探す形へ更新。
- 関連3ファイル：12件成功。
- npx tsc --noEmit：成功。
- npx vitest run src/app --exclude '**/employment-contract-pdf-integrity.test.tsx'：終了コード0。550ファイル成功・6ファイルスキップ、4,463件成功・8件スキップ（所要380.14秒）。失敗0件。
- 実行ログ：tmp/codex-502-vitest-final.log。jsdom の既存の navigation 未実装メッセージが出るが、テストはすべて成功。
- 最初の全体実行では LINE の旧ボタン名を参照するテストが失敗したため修正し、関連テスト成功後に全体を最初から再実行して上記結果を確認。

UTF-8で保存し、日本語の読み直しを実施。画面表示・明暗・390px/1384px の実測は行っていない（指示どおり Claude の確認対象）。
