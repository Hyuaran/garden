# Codex-506 作業レポート（2026-11-02）

## 共通の変更

- `src/app/globals.css` に `.garden-required` を追加。既存の明暗対応 `--modal-danger` を使用し、左余白・通常の太さ・継承する行高を指定。
- `src/app/system/forms/_components/form-kit/index.tsx` の FormRow・FieldLabel に `required?: boolean` を追加。TextField・NumberField・TextArea・SelectField・RadioGroup・TimeRange は必須状態を `aria-required` でも伝える。
- 同ディレクトリの README.md に利用方法を追記。
- `src/app/root/_components/FormField.tsx` の既存の半角 * を共通の赤い全角＊へ変更し、入力に aria-required を追加。既存の保存処理・検証方法は維持。
- `src/app/system/_components/BoxSelect/BoxSelect.tsx` に required を追加。検索・絞り込み用の呼び出しには指定しない。
- 定期取得・cron・取得の依存配列は変更なし。追加の定期取得は 0 回／日。

## ＊を付けた画面と欄

以下のパスはリポジトリ直下からの相対パス。共通部品の変更だけで表示がそろう画面も含む。

| 画面 | ファイル | 欄 |
| --- | --- | --- |
| 統合ログイン | `src/app/login/page.tsx` | 社員番号またはID、パスワード |
| 関電トスのログイン | `src/app/p/login/page.tsx` | パートナーコードまたは社員番号、パスワード |
| 関電トス新規送信 | `src/app/p/toss/new/TossForm.tsx` | トスランク、キャッシュバック有無、関電リスト区分、リスト内の場合のPD管理番号、申込者の姓・名・セイ・メイ、生年月日、郵便番号、都道府県、市区町村、町域・番地、連絡先電話番号、手入力する場合のパートナーコード |
| 経費報告（スマホ入口でも共用） | `src/app/system/forms/expense/ExpenseClient.tsx` | 編集可能な事業、決済方法、決済日、金額、使用用途、用途が「その他」の場合の用途の詳細 |
| NHK訪問業務報告（スマホ入口でも共用） | `src/app/system/forms/nhk-visit/NhkVisitClient.tsx` | 日付、時間、派遣先、交通費 |
| チーム給与計算通知 | `src/app/system/forms/payroll-notice/PayrollNoticeClient.tsx` | 対象チーム、交通費変更・研修中・紹介入社の該当者有無、表示中の該当者名・通勤最寄り駅・紹介者名、その他共有事項 |
| 出勤連絡のLINE送信 | `src/app/system/forms/shukkin/_components/LineSendDialog.tsx` | 要求される場合の送信パスワード |
| AP日報 | `src/app/my/ApDailyReport.tsx` | 開始・終了時間、反省点・改善点 |
| マイページの各届出 | `src/app/system/mypage/_components/SubmissionModal.tsx` | 区分、扶養の人数・変更内容・変更の日、現住所・本人電話番号・緊急連絡先の氏名／続柄／住所／電話番号、最寄り駅・適用希望日、給与受取口座の銀行名／金融機関コード／支店名／支店コード／口座番号／名義カナ、退職希望日、誓約日・住所・氏名（電子署名）・内容への同意 |
| LINE内の届出 | `src/app/liff/forms/FormsPage.tsx` | 同じ submissionFields 定義の任意でない欄。textarea にも同じ必須状態を指定 |
| マイナンバー提出（共用） | `src/lib/my-number/MyNumberForm.tsx` | 利用目的の確認、マイナンバー、カードの写真 |
| Root 法人 | `src/app/root/companies/page.tsx` → 共通 FormField | 法人ID、デフォルト振込銀行、法人名、法人名カナ、本店所在地、代表者名 |
| Root 取引先 | `src/app/root/vendors/page.tsx` → 共通 FormField | 取引先ID・名前・カナ、銀行名・金融機関コード、支店名・支店コード、口座種別・番号・名義カナ、手数料負担 |
| Root 従業員 | `src/app/root/employees/page.tsx` → 共通 FormField・FieldLabel | 従業員ID、社員番号、所属法人、氏名・カナ、メール、雇用形態、給与体系、社会保険区分、入社日、口座情報（bankRequired のときだけ）、保存するAPIトークン |
| Root 給与体系 | `src/app/root/salary-systems/page.tsx` → 共通 FormField | 給与体系ID、体系名、対象雇用形態、基本給計算方法 |
| Root 保険 | `src/app/root/insurance/page.tsx` → 共通 FormField | 保険マスタID、適用年度、適用開始日 |
| Root 勤怠 | `src/app/root/attendance/page.tsx` → 共通 FormField | 勤怠ID、従業員、対象月、取込ステータス |
| Root 銀行口座 | `src/app/root/bank-accounts/page.tsx` → 共通 FormField | 法人、銀行、口座番号 |
| Root 雇用契約 | `src/app/root/contracts/page.tsx`、`_components/ContractTypeFields.tsx` | 従業員、月給時の週の所定時間、契約期間（終了日は期間の定めがある場合）、基本賃金、通知日及び締結日、就業場所、社員向けの従業員住所・業務内容・就業時間、NHK派遣の始業・終業・休憩、その他の業務内容 |
| Root 郵便転送 | `src/app/root/mail-forwarding/page.tsx`、`AddressInputs.tsx` | 名義、転送元・転送先の住所、新規または再届出の日付。届出待ちでは日付欄自体を表示しない |
| Root 最低賃金 | `src/app/root/minimum-wages/page.tsx` | 都道府県、時給、いつから |
| Root マイナンバー差戻し | `src/app/root/my-numbers/MyNumbers.tsx` | 差し戻す理由 |
| Bud 口座設定 | `src/app/bud/bank/BankAccounts.tsx` | 到着ベースの場合の起点の時刻 |
| Bud 振込依頼・CB・新規取引先 | `src/app/bud/transfers/_components/BankPicker.tsx`、`VendorPicker.tsx`、`NewVendorModal.tsx`、`TransferFormRegular.tsx`、`TransferFormCashback.tsx` | 既存の半角 * を共通化。起票法人、支払元口座、取引先、必須の銀行・支店コード／口座番号／預金種目／名義カナ、金額・予定日、CBの申込者名・カナ・商材名・商流名、Pay-easyの収納機関番号・お客様番号・確認番号、決済登録済の決済方法 |
| Bud 振込差戻し | `src/app/bud/transfers/_components/RejectModal.tsx` | 差戻し理由 |
| Bud 明細CSV取込 | `src/app/bud/statements/_components/StatementImportModal.tsx` | 対象口座、CSVファイル |
| Bud 経費最終確認 | `src/app/bud/expenses/_components/ExpenseFinalPanel.tsx` | 差戻し理由 |
| System 契約管理 | `src/app/system/contracts/page.tsx` | 相手先、自社法人、契約種別、締結日 |
| System 開発ボード | `src/app/system/dev-board/BoardClient.tsx` | 質問の見出し、選択式の選択肢、文章回答、その他選択時の補足。通常の選択式回答では「選択肢とどちらか必須」と表示 |
| System 勤怠 | `src/app/system/attendance/AttendanceClient.tsx` | 今日の内線番号 |
| System LINE | `src/app/system/line/ContactSettings.tsx`、`LineManager.tsx` | 連絡先追加の氏名、連絡先リンク（guest_home は任意）、一斉送信の題名・文、あいさつ文、自由タグの名前 |
| System リスト | `src/app/system/list/_components/ListMasterClient.tsx` | 条件の保存名、取込の購入先・その他購入先、自社アポ禁の電話番号・理由、解除理由 |
| System サイトのお知らせ | `src/app/system/sites/_components/SiteNewsPanel.tsx` | 日付、題名 |
| Sprout バイトル | `src/app/sprout/postings/baitoru-panel.tsx` | 掲載期間の開始・終了、掲載内容、追加する選択肢、1回の取込上限 |
| Leaf 関電事務 | `src/app/leaf/_templates/backoffice.html` | 既存の required 定義に従うフリガナ・契約名義・電話番号・使用場所住所・各商材の供給地点番号／お客様番号等。検索モードには表示しない |
| Leaf 関電入力 | `src/app/leaf/_templates/input.html` | 獲得種類、リスト外の関電お客様番号。電灯・動力・ガスの添付は各々に＊を付けず、共通見出しに「いずれか必須」と表示 |
| Rill メール作成 | `src/app/rill/mail/_components/RillComposePane.tsx` | 宛先、件名 |
| Rill 周知保存 | `src/app/rill/mail/_components/RillMailScreen.tsx` | 周知文 |
| Forest 期切替 | `src/app/forest/_components/PeriodRolloverForm.tsx` | 純資産、現金、預金、決算書URL |
| Tree 初回登録 | `src/app/tree/birthday/page.tsx` | 誕生日 |
| Tree 架電 | `src/app/tree/call/page.tsx`、`src/app/tree/calling/sprout/page.tsx` | 既存の条件付き必須表示（NG理由・次回対応日時・架電メモ）を共通の＊へ変更 |
| Bloom 今日の予定 | `src/app/bloom/workboard/components/TodayPlanList.tsx` | 追加する予定 |
| Tree Breeze | `src/app/tree/breeze/page.tsx` | 送信するメッセージ |
| Tree Q&A | `src/app/tree/qa/page.tsx` | 質問。トス向け回答とクローザー向け回答はそれぞれ「どちらか必須」と表示し、個別の＊は付けない |

## 付けなかった所と理由

- `src/app/system/onboarding/**` と `src/app/api/system/onboarding/**`：指示に従い、検索走査からも除外。内容の読み取り・編集なし。
- 検索欄・絞り込み欄：対象外。System の通話集計の検索日付も含む。
- 入力部品を出さない固定表示の送信者や値：利用者が入力する欄ではない。経費の固定事業 NHK も含む。
- 任意の備考、建物・部屋番号、扶養届の補足、退職理由、関電トスのキャッシュバック金額、関電トスのコメント：既存の空欄許容に従う。
- Rill の Cc と本文：本文は空文字で送信可能。型チェックだけを根拠に＊を付けない。
- 郵便転送の郵便番号：`validPostal` は空欄を許容するので付けない。
- データ行の選択・削除対象の選択・確認ダイアログの操作ボタン：入力欄のラベルではない。
- 再取得・外部送信の動作は追加せず、画面の目視確認は指示どおり実施しない。

## 検証文言

- Root の既存の日本語「必須」は維持。英語や required の文言を修正対象とした。
- 関電トスのAPI検証で英語のフィールドキーが露出していた箇所を日本語の欄名へ変更。
- Rill の宛先・件名・本文の required エラーを日本語へ変更。

## テスト結果

- `npx tsc --noEmit`：作業途中の実行は成功。最終実行は変更対象外の生成ファイル `.next/dev/types/validator.ts` の TS2307 が2件。参照先の `src/app/api/system/hire-candidates/[id]/documents/route.js` と `line/route.js` に対応するソースが存在しない。生成キャッシュ・該当APIは変更していない。
- 生成ファイル1件だけを除外する一時設定で `npx tsc --noEmit -p tsconfig.codex-506-check.json`：成功。アプリとテストの最終ソースを型確認。一時設定は確認後に削除。
- 指定の全体 Vitest コマンドを実行。指示書にある既存不具合の AppHeader・KpiCard・BackgroundCarousel も除外して全体確認した結果：653ファイル中642成功・5失敗・6スキップ、6258テスト中6236成功・14失敗・8スキップ（630.40秒）。
- 上記14件は実行途中の古いコード／期待値によるもの（リスト1件、Root検証12件、関電トス文言1件）。修正後の対象ファイルを再実行し、最終結果を下記に記載。
- 残る1ファイルは `src/app/api/system/hire-candidates/[id]/filemaker/route.test.ts` 自体を見つけられない読み込みエラー（0 test）。このファイルには触れていない。全体コマンドが成功したとは扱わない。
- 必須表示の追加テスト：FormRowの必須／任意切替、入力各種のaria-required、Rootの条件切替、Rillの宛先・件名と任意の本文、Leafの選択必須、各モジュールの代表フォームを確認。
- 最終の対象別テスト：15ファイル・319テストすべて成功（22.08秒）。Rootのマスタ検証・従業員検証・従業員UI、関電トスの検証・UI・ログイン、リスト、契約、バイトル、サイト、郵便転送、Bud明細、form-kit、必須表示の追加テストをまとめて再実行。

git・computer-use・ブラウザ操作は使用していない。UTF-8 で保存し、日本語と全角＊を読み直して確認。
