# Codex-497 Garden 全体検索 実装報告（2026-10-30）

## 実装した内容

- ベルの左に線画の虫眼鏡を追加。GardenHeaderActions、ModuleShell、BudShachoShell、RillShachoShell のパソコン・スマホに適用。MyShell と System は既存の GardenHeaderActions を通して反映される。
- ルートレイアウトに共通 Modal（lg）の検索小窓を一つ配置。Ctrl+K / Cmd+K、入力フォーカス、↑↓、Enter、Esc、250ms の待機、古い通信の中止、0件、検索失敗、読み込み表示、「さらに表示」を実装。
- GET /api/search は在籍するログイン従業員だけが利用可能。検索文字は200文字まで。設定は1リクエストに1回取得し、画面・タブ・特例権限を判定してから検索する。通常の本人 client で読む表は RLS を維持。admin client の表は既存画面と同じ scope・本人条件・採用状態条件などを付ける。
- 検索対象は固定の列許可リスト。秘密の列を select しない。秘密を含む payload は JSON 全文を取得せず、許可したキーを PostgREST の JSON パスで投影する。入社手続きの dependents は丸ごと取得しない。
- NFKC、大文字小文字、数字の桁カンマ、電話のハイフン、日付の区切りを正規化。完全一致→前方一致→部分一致、同順位は取得した更新日・作成日等の降順。種類単位にまとめ、通常5件・追加表示20件。Supabase の1000行上限を越える場合も主キー順でページを読み、検索前に1000行で切り捨てない。
- 画面・タブは権限 scope、System メニュー、フォーム台帳、My タブから構成。マニュアルは既存台帳と資料タブの閲覧設定に従って題名を検索する。
- 共通 DataTable は初期 URL の q を検索欄に反映。金額・日付・電話の表記も正規化。同じ画面内からの検索遷移と戻る操作にも対応。Root 従業員は既存の employeeId パラメーターで編集小窓を開く。月次まとめ・進行期は対象の月・法人へのリンクにする。
- アプリの監査ログ、console、永続ストレージへ検索文字・スニペットを保存する処理は追加していない。API 応答は private, no-store。検索小窓の入力・結果は Clarity のマスク対象。

## 変更ファイル

### 実装

- src/lib/search/catalog.ts — 表・列・見出し・scope・開き先の固定許可リスト
- src/lib/search/match.ts — 正規化・順位・件数制限・原文の強調位置
- src/lib/search/search.server.ts — 閲覧判定・本人条件・検索・結果リンク
- src/app/api/search/route.ts — 認証必須 API
- src/app/_components/search/GlobalSearch.tsx
- src/app/_components/search/GlobalSearch.module.css
- src/app/layout.tsx
- src/app/system/_components/GardenHeaderActions/GardenHeaderActions.tsx
- src/app/_components/layout/GardenShell/ModuleShell.tsx
- src/app/bud/_components/BudShachoShell/BudShachoShell.tsx
- src/app/rill/_components/RillShachoShell.tsx
- src/app/system/_components/DataTable/DataTable.tsx
- tmp/build-search-catalog.cjs — 正本の入力欄一覧から固定許可リストを作る作業用スクリプト。アプリ実行時には使わない

### テスト

- src/lib/search/match.test.ts
- src/lib/search/search.server.test.ts
- src/app/api/search/route.test.ts
- src/app/_components/search/GlobalSearch.test.tsx
- src/app/system/_components/DataTable/search-url.test.tsx

## 権限の規則

すべての通常 scope は view-permission.ts の resolveCanView と既存の画面・タブ定義を使用する。役職だけでなく roles / employee_ids の上書きとタブから画面へのフォールバックを反映する。開発ボードは EMP-0008 限定。

|client 表記|検索に使用する規則|
|---|---|
|admin|認証済み scope の許可後に admin client。Root view-data / profile-history / team-history、入社管理、System の各読取 API と同じ入口条件|
|user|本人の server client による RLS。admin client へ切り替えない|
|self|本人 client + employee_id=ログイン本人。入社手続きの self は本人画面に出る列だけ|
|own-employee|admin client + employee_id=ログイン本人。本人の届出・AP日報と同じ条件|
|own-user|admin client + user_id=認証ユーザー。ワークボードの既存読取 API と同じ本人条件|
|submitted|admin client + submitted_by=認証ユーザー。経費 報告・NHK訪問の本人履歴と同じ条件|
|requested|本人 client + requested_by=認証ユーザー。前確依頼の本人条件|
|line|在籍者で super_admin のみ。requireLineAdmin と同じ条件で admin client。グループは active、account、target_type も既存読取と同じ条件|
|soil|system-list の対象タブと soil-overview の両方を既存 requireSoilListUser(readTab) と同じ順序・既定役職で判定して admin client|
|mf|bud_has_access 必須・本人 client。口座行は既存 visibleAccounts を再使用し、非表示・個別閲覧者・kind ごとの閲覧者も判定|
|broadband|super_admin かつ bud_bb_can_view の成功。設定の既存 viewers GET と同じ条件で本人 client|

Bud の通常表は bud_has_access に加え画面・タブ権限を確認し、本人 client の既存 RLS による法人・状態・削除済み等の制約を維持する。振込や明細をサービスロールで横断取得しない。入社予定者は planned / hiring / no_show、入社後確認は hired に分ける。Root 銀行口座は deleted_at が null の行のみ。

## 対象外と制約

|表・項目|理由|
|---|---|
|soil_list_phone|指示書で対象外と指定された電話のリスト本体。select しない|
|外部 Kintone・Graph・KOT・INNOVERA の34入力欄|Garden DB 外。外部サービスへの検索は追加しない|
|秘密の16入力欄|番号・口座番号・トークン・鍵・暗号化値等は検索にも表示にも含めない。JSON の口座番号も投影しない|
|root_employee_my_numbers|番号・写真を含む専用表。my_number_viewers の復号・閲覧規則を検索へ複製せず、同表の同意日・差戻し理由も今回は除外|
|system_onboarding.dependents 内の通常項目|同じ JSON 配列に秘密の番号が入る。配列全体の select を避け、安全な子項目だけを取り出す DB 側投影を新設していないため除外|
|system_site_notify_recipients|サイト別の通知先・管理者限定の設定読取条件を検索に再現していないため除外|
|system_kanri_result.grid|管理表・実績・給与など複数タブの内容を含む JSON。同一行内のタブ別公開範囲を安全に投影する処理を再現していないため除外。人員・休業日の専用表は対象|
|system_manual_versions|保存ファイルのバージョン情報。各版と資料タブの閲覧範囲との対応を検索で再現していないため除外。閲覧できるマニュアルの題名は台帳から対象にしている|
|system_view_permissions の入力値|各歯車の設定内容を検索結果として公開するための設定閲覧条件を再現していないため除外。画面・タブの検索許可の判定には使用する|
|garden_intake_items|個人・共有メール箱と閲覧タブの条件を同じ判定にできていないため除外。Graph メール本文も取得しない|
|soil_call_history|入力欄調査で基礎 SELECT policy と過去行の開き先が未確定。推測した行制限での検索は追加しない|

同一の秘密 JSON 内で許可した個別パス以外のキー、入力一覧にない自動記録の列は検索しない。上記の例外があるため「612欄すべてを検索できる」とはしていない。

共通 DataTable を使わない独自画面は q パラメーター付きで開くが、その画面独自の検索欄・年月・法人・状態の絞り込みをすべて自動変更する実装は追加していない。DataTable の searchText が扱わない非表示欄に一致したとき、その語だけでは移動先の一覧で同じ行を絞れない場合がある。Root 従業員では既存の employeeId による直接表示も併用している。

## migration・定期処理

- migration の追加なし。DB の表・関数・ポリシーの作成・変更・適用なし。
- cron・ポーリング・定期的な取り直しの追加なし。新しい定期実行は **0回/日**。
- 250ms は入力操作に対する待機だけであり、定期取得ではない。1入力系列につき待機後1リクエスト。入力変更・小窓を閉じた際は前の通信を中止する。
- git は状態確認を含め一切実行していない。

## 点検とテスト

- Next.js 同梱の route-handlers ガイドを読んで実装した。
- 社長スタイル正本 §2.5 / §2.6 を確認。共通 Modal の色と寸法、ゴシック、線画、スマホ全面表示、横幅の制約を CSS で実装。loading-style の既存 ListProcessingOverlay のスピナーを、指示書の「小さなくるくる」に合わせて縮小した。
- **実ブラウザーでの幅1384・1024・800・390および明暗の目視点検は未実施。** Browser access host is unavailable のためブラウザーに接続できなかった。見た目の確認が完了したとは報告しない。
- 実 DB の RLS 適用状態・実データの網羅性・実 DB 接続時の1秒以内（目標0.5秒）は未測定。テストはモック DB と jsdom によるもので、実 DB の権限検証の代わりにはならない。
- テスト結果と UTF-8 の最終確認は末尾に記載する。

## 探す対象の表・列一覧

以下は実装の固定許可リストから出力した。列の括弧内は結果に表示する見出し。safe_*:payload->... は秘密を含む JSON 全文を取得しない投影であり、safe_* は返却列の別名。主キー・題名・並べ替え用日付・必要な行判定列は検索対象の列とは別に取得する。

<!-- SEARCH-CATALOG -->

52 tables / 54 scope mappings.

### Root / 従業員マスタ / root_employees

- Scope: `root-employees` / `(page)`; client: `admin`; URL: `/root/employees`
- Columns: `employee_id` (従業員ID), `employee_number` (社員番号), `company_id` (所属法人), `name` (氏名), `name_kana` (氏名カナ), `line_contact_url` (公式 LINE の連絡先), `email` (メールアドレス), `employment_type` (雇用形態), `salary_system_id` (給与体系), `insurance_type` (社会保険区分), `garden_role` (Garden権限), `hire_date` (入社日), `birthday` (生年月日), `termination_date` (退職日), `contract_end_on` (契約終了日（外注）), `business` (事業), `account_holder` (口座名義), `kou_otsu` (年末調整 甲/乙欄), `dependents_count` (扶養家族人数（0〜20）), `kot_employee_id` (キングオブタイムID), `innovera_extension` (INNOVERA 内線番号（PC）), `innovera_mobile_extension` (INNOVERA 内線番号（モバイル）), `filemaker_employee_name` (FileMaker 社員名), `mf_employee_id` (マネーフォワード クラウド給与 ID), `call_recording_access` (INNOVERA録音の権限), `chatwork_account_id` (Chatwork ID), `notes` (備考)
- Metadata: `employee_id`, `name`, `updated_at`

### Root / 法人マスタ / root_companies

- Scope: `root-companies` / `(page)`; client: `admin`; URL: `/root/companies`
- Columns: `company_id` (法人ID), `default_bank` (デフォルト振込銀行), `company_name` (法人名), `company_name_kana` (法人名カナ), `phone` (電話番号), `fax` (FAX番号), `fiscal_end_month` (決算月), `established_on` (設立日), `domain` (メールドメイン), `website` (Webサイト), `address` (本店所在地), `corporate_number` (法人番号（13桁）), `invoice_registration_number` (インボイス登録番号), `telecom_notification_number` (電気通信事業届出番号), `employment_insurance_number` (雇用保険事業所番号), `labor_insurance_number` (労働保険番号), `agency_notification_number` (代理店届出番号), `industry_classification` (産業分類番号), `tax_office` (管轄税務署), `representative` (代表者名), `representative_kana` (代表者名カナ), `representative_gender` (代表者性別), `representative_birthday` (代表者生年月日), `representative_mobile` (代表者携帯番号), `representative_address` (代表者住所), `contact` (担当者1 氏名)
- Metadata: `company_id`, `company_name`, `updated_at`

### Root / 取引先 / root_vendors

- Scope: `root-vendors` / `(page)`; client: `admin`; URL: `/root/vendors`
- Columns: `vendor_id` (取引先ID), `vendor_type` (区分), `vendor_name` (取引先名), `vendor_name_kana` (取引先名カナ), `bank_name` (銀行名), `bank_code` (金融機関コード（4桁）), `branch_name` (支店名), `branch_code` (支店コード（3桁）), `account_type` (口座種別), `account_holder_kana` (口座名義カナ（全角）), `fee_bearer` (手数料負担), `company_id` (担当法人), `notes` (備考)
- Metadata: `vendor_id`, `vendor_name`, `updated_at`

### Root / 銀行口座 / root_bank_accounts

- Scope: `root-bank-accounts` / `(page)`; client: `admin`; URL: `/root/bank-accounts`
- Columns: `corp_code` (法人), `bank_code` (銀行), `branch_name` (支店名), `branch_code` (支店コード（3桁）), `account_type` (口座種別), `sub_account_label` (弥生の補助科目名), `has_csv_export` (CSV 出力), `needs_manual_balance` (残高の手入力が必要), `notes` (メモ)
- Metadata: `id`, `sub_account_label`, `updated_at`

### Root / 給与体系 / root_salary_systems

- Scope: `root-salary-systems` / `(page)`; client: `admin`; URL: `/root/salary-systems`
- Columns: `salary_system_id` (給与体系ID), `system_name` (体系名), `employment_type` (対象雇用形態), `base_salary_type` (基本給計算方法), `working_hours_day` (所定労働時間（日）), `working_days_month` (所定労働日数（月）), `overtime_rate` (残業単価倍率（法定外）), `night_overtime_rate` (残業単価倍率（深夜）), `holiday_overtime_rate` (残業単価倍率（休日）), `notes` (備考)
- Metadata: `salary_system_id`, `system_name`, `updated_at`

### Root / 社会保険 / root_insurance

- Scope: `root-insurance` / `(page)`; client: `admin`; URL: `/root/insurance`
- Columns: `insurance_id` (保険マスタID), `fiscal_year` (適用年度（4桁）), `effective_from` (適用開始日), `effective_to` (適用終了日), `health_insurance_rate` (健康保険料率（%）), `nursing_insurance_rate` (介護保険料率（%）), `pension_rate` (厚生年金保険料率（%）), `employment_insurance_rate` (雇用保険料率（%）), `child_support_rate` (子ども・子育て支援金率（%）)
- Metadata: `insurance_id`, `fiscal_year`, `updated_at`

### Root / 勤怠データ / root_attendance

- Scope: `root-attendance` / `(page)`; client: `admin`; URL: `/root/attendance`
- Columns: `attendance_id` (勤怠ID), `employee_id` (従業員), `target_month` (対象月（YYYY-MM）), `working_days` (出勤日数), `absence_days` (欠勤日数), `paid_leave_days` (有給取得日数), `scheduled_hours` (所定労働時間), `actual_hours` (実労働時間), `overtime_hours` (所定外時間（平日）), `legal_overtime_hours` (法定外時間（平日）), `night_hours` (深夜時間), `holiday_hours` (休日出勤時間), `late_hours` (遅刻時間), `early_leave_hours` (早退時間), `training_hours` (研修時間（任意）), `office_hours` (事務時間（任意）), `import_status` (取込ステータス)
- Metadata: `attendance_id`, `employee_id`, `updated_at`

### Root / 従業員マスタ / root_employee_team_history

- Scope: `root-employees` / `(page)`; client: `admin`; URL: `/root/employees`
- Columns: `effective_date` (移動日), `team` (チーム), `memo` (メモ)
- Metadata: `id`, `team`, `entered_at`, `employee_id`

### Root / 従業員マスタ / root_employee_profile_history

- Scope: `root-employees` / `(page)`; client: `admin`; URL: `/root/employees`
- Columns: `safe_bank_name:payload->bank_name` (銀行名), `safe_bank_code:payload->bank_code` (金融機関コード（4桁）), `safe_account_type:payload->account_type` (口座種別), `safe_branch_name:payload->branch_name` (支店名), `safe_branch_code:payload->branch_code` (支店コード（3桁）), `safe_holder_kana:payload->holder_kana` (口座名義カナ), `safe_postal_code:payload->postal_code` (郵便番号), `safe_prefecture:payload->prefecture` (都道府県), `safe_city:payload->city` (市町村), `safe_town:payload->town` (町域), `safe_building:payload->building` (建物名), `safe_room:payload->room` (部屋番号), `safe_phone:payload->phone` (連絡先), `safe_phone_1:payload->phone_1` (連絡先1), `safe_phone_2:payload->phone_2` (連絡先2), `safe_phone_3:payload->phone_3` (連絡先3), `safe_sub_account_bank_name:payload->sub_account->bank_name` (口座2 銀行名), `safe_sub_account_bank_code:payload->sub_account->bank_code` (口座2 金融機関コード), `safe_sub_account_branch_name:payload->sub_account->branch_name` (口座2 支店名), `safe_sub_account_branch_code:payload->sub_account->branch_code` (口座2 支店コード), `safe_sub_account_account_type:payload->sub_account->account_type` (口座2 種別), `safe_sub_account_holder_kana:payload->sub_account->holder_kana` (口座2 名義カナ), `safe_one_way:payload->one_way` (交通費 片道), `safe_monthly_cap:payload->monthly_cap` (交通費上限), `safe_nearest_station:payload->nearest_station` (最寄り駅), `safe_route:payload->route` (通勤経路), `safe_paid:payload->paid` (交通費支給), `safe_business:payload->business` (事業名（旧区分・Root の「事業」とは別の項目）), `safe_department:payload->department` (部署名), `safe_affiliation:payload->affiliation` (所属), `safe_base_hourly:payload->base_hourly` (基準時給), `safe_training_hourly:payload->training_hourly` (研修時給), `safe_training_cap:payload->training_cap` (研修上限), `safe_year_end_adjustment:payload->year_end_adjustment` (年末調整), `safe_social_insurance:payload->social_insurance` (社会保険), `safe_employment_insurance:payload->employment_insurance` (雇用保険), `safe_employment_insurance_no:payload->employment_insurance_no` (雇用保険番号), `safe_pension_no:payload->pension_no` (年金番号), `safe_advance_pay:payload->advance_pay` (前払い希望), `safe_call_type:payload->call_type` (架電区分)
- Metadata: `id`, `employee_id`, `recorded_at`

### Root / 契約書 / system_employment_contracts

- Scope: `root-contracts` / `(page)`; client: `admin`; URL: `/root/contracts`
- Columns: `employee_id` (従業員), `safe_kind:payload->kind` (新規 / 更新), `safe_salaryKind:payload->salaryKind` (給与区分), `safe_weeklyHours:payload->weeklyHours` (週の所定時間), `safe_contractStart:payload->contractStart` (契約期間（から）), `safe_contractEnd:payload->contractEnd` (契約期間（まで）), `safe_hourlyWage:payload->hourlyWage` (基本賃金（時給・円 / 月給・円）), `safe_concludedOn:payload->concludedOn` (通知日及び締結日), `safe_workLocation:payload->workLocation` (就業場所), `safe_employeeAddress:payload->employeeAddress` (従業員住所（任意）), `safe_jobType:payload->jobType` (業務内容), `safe_jobTypeOther:payload->jobTypeOther` (その他の業務内容), `safe_templateType:payload->templateType` (契約書の種類), `safe_indefinite:payload->indefinite` (雇用期間), `safe_renewalText:payload->renewalText` (契約更新), `safe_commuteCap:payload->commuteCap` (通勤手当の月額上限（円）), `safe_duties:payload->duties` (業務内容（本文）), `safe_workHours:payload->workHours` (就業時間), `safe_fixedOvertime:payload->fixedOvertime` (固定残業), `safe_startTime:payload->startTime` (始業), `safe_endTime:payload->endTime` (終業), `safe_breakMinutes:payload->breakMinutes` (休憩（分）)
- Metadata: `id`, `employee_id`, `created_at`

### System / 届出 / system_mypage_submissions

- Scope: `system-mypage` / `(page)`; client: `own-employee`; URL: `/my`
- Columns: `proposed_one_way` (片道金額), `safe_count:payload->count` (扶養の変更 / 変更後の扶養の人数), `safe_details:payload->details` (扶養の変更 / 変更の内容), `safe_effectiveDate:payload->effectiveDate` (通勤経路の変更 / 適用希望日), `safe_note:payload->note` (通勤経路の変更 / 補足（任意）), `safe_selfAddress:payload->selfAddress` (緊急連絡先 / 現住所), `safe_selfPhone:payload->selfPhone` (緊急連絡先 / 個人の電話番号（携帯等）), `safe_ecName:payload->ecName` (緊急連絡先 / 緊急連絡先の氏名), `safe_ecRelationship:payload->ecRelationship` (緊急連絡先 / 本人との続柄), `safe_ecAddress:payload->ecAddress` (緊急連絡先 / 緊急連絡先の住所（同一の場合は「同上」）), `safe_ecPhone:payload->ecPhone` (緊急連絡先 / 緊急連絡先の電話番号), `safe_kind:payload->kind` (秘密保持誓約 / 区分), `safe_station:payload->station` (通勤経路の変更 / 新しい最寄り駅), `safe_bankName:payload->bankName` (給与受取口座の変更 / 銀行名), `safe_bankCode:payload->bankCode` (給与受取口座の変更 / 金融機関コード（4桁）), `safe_branchName:payload->branchName` (給与受取口座の変更 / 支店名), `safe_branchCode:payload->branchCode` (給与受取口座の変更 / 支店コード（3桁）), `safe_holderKana:payload->holderKana` (給与受取口座の変更 / 口座名義カナ), `safe_desiredDate:payload->desiredDate` (退職の届出 / 退職希望日), `safe_reason:payload->reason` (退職の届出 / 理由（任意）), `safe_pledgeDate:payload->pledgeDate` (秘密保持誓約 / 誓約日), `safe_address:payload->address` (秘密保持誓約 / 住所), `safe_signature:payload->signature` (秘密保持誓約 / 氏名（電子署名）), `safe_agreed:payload->agreed` (秘密保持誓約 / 内容に同意します)
- Metadata: `id`, `submission_type`, `created_at`

### System / AP日報 / system_ap_daily_report

- Scope: `system-mypage` / `(page)`; client: `own-employee`; URL: `/my`
- Columns: `report_date` (日付), `kind` (区分), `start_time` (開始時間), `end_time` (終了時間), `work_minutes` (稼働時間（分）), `count` (トス / 本日獲得), `month_total` (現状合計), `coin_created` (コイン作成数), `guide_promised` (誘導約束), `guide_in_progress` (誘導中), `statement_check_request` (明細確認依頼), `coin_total` (トータルコイン), `reflection` (反省点・改善点)
- Metadata: `id`, `kind`, `report_date`

### System / 給与計算連絡 / root_payroll_notice (input)

- Scope: `system-forms` / `input`; client: `admin`; URL: `/system/forms/payroll-notice`
- Columns: `team` (チーム), `commute_flag` (通勤の該当者がいる / いない), `commute_people` (通勤 / 該当者名), `training_flag` (研修の該当者がいる / いない), `training_people` (研修 / 該当者名), `referral_flag` (紹介の該当者がいる / いない), `referral_people` (紹介 / 該当者名), `other_notes` (その他の連絡)
- Metadata: `id`, `team`, `submitted_at`

### System / 出勤表・シフトLINE連絡テキスト生成 / system_shukkin_member (input)

- Scope: `system-forms` / `input`; client: `admin`; URL: `/system/forms/shukkin`
- Columns: `group_name` (グループ), `display_name` (表示名), `sort_order` (表示の並び順（移動操作）)
- Metadata: `employee_number`, `display_name`

### Root / 口座の点検 / system_bank_successors

- Scope: `root-bank-check` / `(page)`; client: `admin`; URL: `/root/bank-check`
- Columns: `old_bank_code` (廃止された金融機関コード), `old_branch_code` (廃止された支店コード), `new_bank_code` (後継の金融機関コード), `new_branch_code` (後継の支店コード), `effective_date` (適用日), `note` (メモ)
- Metadata: `id`, `old_bank_code`, `created_at`

### Root / 最低賃金マスタ / root_minimum_wages

- Scope: `root-minimum-wages` / `(page)`; client: `admin`; URL: `/root/minimum-wages`
- Columns: `prefecture` (都道府県), `hourly_amount` (時給), `effective_from` (適用開始日), `source_url` (出典 URL)
- Metadata: `id`, `prefecture`, `updated_at`

### Root / 郵便の転送 / root_mail_forwardings

- Scope: `root-mail-forwarding` / `(page)`; client: `user`; URL: `/root/mail-forwarding`
- Columns: `holder` (名義（必須）), `from_address` (転送元の住所 / 郵便番号), `to_address` (転送先の住所 / 郵便番号), `notes` (メモ), `stopped` (止める)
- Metadata: `id`, `holder`, `updated_at`

### Root / 郵便の転送 / root_mail_forwarding_filings

- Scope: `root-mail-forwarding` / `(page)`; client: `user`; URL: `/root/mail-forwarding`
- Columns: `filed_on` (最初の届出日 / 新しい届出日), `method` (届出の方法), `receipt` (受付番号), `filed_by` (届けた人), `notes` (届出のメモ)
- Metadata: `id`, `method`, `created_at`

### System / 入社手続き / system_onboarding (self)

- Scope: `system-onboarding` / `self`; client: `self`; URL: `/system/onboarding`
- Columns: `name` (氏名), `name_kana` (フリガナ), `gender` (性別), `birth_date` (生年月日), `postal_code` (郵便番号), `address` (住所), `address_kana` (住所のフリガナ), `phone` (電話番号), `email` (メールアドレス), `householder_name` (世帯主の氏名), `householder_relation` (世帯主との続柄), `pension_number` (基礎年金番号), `employment_insurance_status` (雇用保険被保険者証), `employment_insurance_number` (雇用保険被保険者番号), `previous_employer` (会社名), `previous_employer_from` (勤務した期間（開始）), `previous_employer_to` (勤務した期間（終了）), `commute_method` (通勤手段（主なもの）), `bank_name` (銀行名), `bank_code` (金融機関コード（4桁）), `branch_name` (支店名), `branch_code` (支店コード（3桁）), `account_type` (預金種別), `account_holder_kana` (口座名義カナ), `emergency_name` (氏名), `emergency_relation` (続柄), `emergency_relation_other` (続柄（その他）), `emergency_address` (住所), `emergency_phone` (電話番号), `commute_routes` (通勤区間 / 交通機関), `nda_agreed_at` (内容を確認しました（秘密保持）)
- Metadata: `employee_id`, `name`

### System / 入社手続き / system_onboarding (all)

- Scope: `system-onboarding` / `all`; client: `admin`; URL: `/system/onboarding`
- Columns: `name` (氏名), `name_kana` (フリガナ), `gender` (性別), `birth_date` (生年月日), `postal_code` (郵便番号), `address` (住所), `address_kana` (住所のフリガナ), `phone` (電話番号), `email` (メールアドレス), `householder_name` (世帯主の氏名), `householder_relation` (世帯主との続柄), `pension_number` (基礎年金番号), `employment_insurance_status` (雇用保険被保険者証), `employment_insurance_number` (雇用保険被保険者番号), `previous_employer` (会社名), `previous_employer_from` (勤務した期間（開始）), `previous_employer_to` (勤務した期間（終了）), `commute_method` (通勤手段（主なもの）), `bank_name` (銀行名), `bank_code` (金融機関コード（4桁）), `branch_name` (支店名), `branch_code` (支店コード（3桁）), `account_type` (預金種別), `account_holder_kana` (口座名義カナ), `emergency_name` (氏名), `emergency_relation` (続柄), `emergency_relation_other` (続柄（その他）), `emergency_address` (住所), `emergency_phone` (電話番号), `commute_routes` (通勤区間 / 交通機関), `nda_agreed_at` (内容を確認しました（秘密保持）), `office` (所属店舗), `weekly_hours` (週の所定労働時間), `health_insurance` (健康保険), `pension_insurance` (厚生年金), `employment_insurance` (雇用保険), `tax_class` (税区分), `salary_kind` (給与の区分), `base_salary` (基本給（円）), `allowances` (手当 / 名前), `commute_cap_monthly` (交通費の上限（1か月・円）), `commute_fixed_monthly` (支給額（1か月・円）)
- Metadata: `employee_id`, `name`

### System / 入社手続き / system_hire_candidates (candidates)

- Scope: `system-onboarding` / `candidates`; client: `admin`; URL: `/system/onboarding`
- Columns: `last_name` (姓), `first_name` (名), `last_name_kana` (セイ), `first_name_kana` (メイ), `birthday` (生年月日), `gender` (性別), `hire_date` (入社日), `employment_type` (雇用形態), `company_id` (法人), `kot_division_code` (KING OF TIME の所属), `kot_type_code` (KING OF TIME の雇用区分), `checklist` (確認チェック / undefined)
- Metadata: `id`, `last_name`, `hire_date`

### System / 入社手続き / system_hire_candidates (confirmations)

- Scope: `system-onboarding` / `confirmations`; client: `admin`; URL: `/system/onboarding`
- Columns: `last_name` (姓), `first_name` (名), `last_name_kana` (セイ), `first_name_kana` (メイ), `birthday` (生年月日), `gender` (性別), `hire_date` (入社日), `employment_type` (雇用形態), `company_id` (法人), `kot_division_code` (KING OF TIME の所属), `kot_type_code` (KING OF TIME の雇用区分), `checklist` (確認チェック / undefined)
- Metadata: `id`, `last_name`, `hire_date`

### System / 経費 報告 / system_expense_report

- Scope: `system-expense` / `(page)`; client: `submitted`; URL: `/system/expense`
- Columns: `form` (経費の種類（フォーム切替）), `business` (事業), `payment` (決済方法), `paid_on` (決済日), `amount` (金額（円・税込）), `purpose` (使用用途), `purpose_detail` (用途の詳細), `note` (備考)
- Metadata: `id`, `purpose`, `created_at`

### System / NHK訪問業務 報告フォーム / system_nhk_visit_report (input)

- Scope: `system-forms` / `input`; client: `submitted`; URL: `/system/forms/nhk-visit`
- Columns: `visit_date` (日付), `start_time` (時間（開始）), `end_time` (時間（終了）), `destination` (派遣先), `new_ground` (成約件数 / 新規 / 地上), `new_satellite` (成約件数 / 新規 / 衛星), `address_ground` (成約件数 / 住所変更 / 地上), `address_satellite` (成約件数 / 住所変更 / 衛星), `bank_credit` (口座・クレ / 件数), `transport_fee` (交通費)
- Metadata: `id`, `destination`, `created_at`

### System / 契約書管理 / system_contracts (browse)

- Scope: `system-contracts` / `browse`; client: `admin`; URL: `/system/contracts`
- Columns: `counterparty` (取引先名), `company_id` (法人), `contract_type` (契約の種類), `concluded_on` (契約日), `note` (メモ), `drive_file_id` (契約書 PDF), `product` (商材名（テンプレート作成）)
- Metadata: `id`, `counterparty`, `created_at`

### System / 開発ボード / system_dev_questions

- Scope: `system-dev-board` / `(page)`; client: `admin`; URL: `/system/dev-board`
- Columns: `title` (見出し), `module` (モジュール), `body` (説明), `answer_type` (答え方), `options` (選択肢（1行に1つ）), `answer_choice` (答えを選んでください), `answer_text_raw` (回答 / 補足（もとの文）), `answer_text` (整えた文で送る（確認後の回答）)
- Metadata: `id`, `title`, `created_at`

### System / コーポレートサイト / system_site_news (news)

- Scope: `system-sites` / `news`; client: `admin`; URL: `/system/sites`
- Columns: `company_id` (法人), `published_on` (日付), `title` (題名), `body` (本文), `is_published` (公開する)
- Metadata: `id`, `title`, `updated_at`

### System / 管理表ポータル / system_kanri_person (settings)

- Scope: `system-kanri` / `settings`; client: `admin`; URL: `/system/kanri`
- Columns: `name` (氏名), `kot_name` (KOT 氏名), `team` (チーム), `department` (部署), `employment_kind` (雇用区分), `base_wage` (基本時給), `is_field_sales` (訪問販売), `active` (有効)
- Metadata: `id`, `name`

### System / 管理表ポータル / system_kanri_month_setting (settings)

- Scope: `system-kanri` / `settings`; client: `admin`; URL: `/system/kanri`
- Columns: `holidays` (休業日)
- Metadata: `year_month`, `updated_at`

### System / リストマスタ / soil_list_condition (list)

- Scope: `system-list` / `list`; client: `soil`; URL: `/system/list`
- Columns: `name` (条件名), `condition` (都道府県)
- Metadata: `id`, `name`, `updated_at`

### System / リストマスタ / soil_list_internal_block (internal-block)

- Scope: `system-list` / `internal-block`; client: `soil`; URL: `/system/list`
- Columns: `電話番号` (電話番号), `理由` (理由), `解除理由` (解除理由)
- Metadata: `id`, `電話番号`, `created_at`

### System / LINE 管理 / system_line_broadcast

- Scope: `system-line` / `(page)`; client: `line`; URL: `/system/line`
- Columns: `title` (題名), `body` (送る文), `tag_ids` (送り先のタグ)
- Metadata: `id`, `title`, `created_at`

### System / LINE 管理 / system_line_tag

- Scope: `system-line` / `(page)`; client: `line`; URL: `/system/line`
- Columns: `name` (タグの名前)
- Metadata: `id`, `name`

### System / LINE 管理 / system_line_tag_member

- Scope: `system-line` / `(page)`; client: `line`; URL: `/system/line`
- Columns: `tag_id` (自由タグ)
- Metadata: `employee_id`, `tag_id`

### System / LINE 管理 / system_line_greeting

- Scope: `system-line` / `(page)`; client: `line`; URL: `/system/line`
- Columns: `employment_tag_id` (雇用形態), `business_tag_id` (事業), `body` (あいさつ文), `enabled` (有効)
- Metadata: `id`, `body`

### System / LINE 管理 / system_line_contact

- Scope: `system-line` / `(page)`; client: `line`; URL: `/system/line`
- Columns: `employee_id` (担当)
- Metadata: `key`, `employee_id`

### System / LINE 管理 / system_line_target

- Scope: `system-line` / `(page)`; client: `line`; URL: `/system/line`
- Columns: `label` (グループの名前), `chatwork_room_id` (知らせ先の Chatwork ルームの番号), `notify_enabled` (知らせ)
- Metadata: `id`, `label`

### Bud / 経費精算 / bud_expense_requests

- Scope: `bud-expenses` / `(page)`; client: `user`; URL: `/bud/expenses`
- Columns: `expense_kind` (経費の種類), `corp_id` (申請法人), `receipt_date` (領収日), `receipt_time` (領収時刻), `store_name` (店名), `amount` (金額), `qualified_class` (適格区分), `qualified_number` (登録番号), `category_id` (経費区分), `description` (内容), `receipt_rotation` (領収書の向き（回転操作）), `return_reason` (差戻し理由), `booking_date` (仕分け日), `booking_corp_id` (仕分け法人名), `fiscal_period` (決算区分の上書き), `storage_path` (領収書の写真 / ファイル)
- Metadata: `id`, `store_name`, `created_at`

### Bud / 振込管理 / bud_transfers

- Scope: `bud-transfers` / `(page)`; client: `user`; URL: `/bud/transfers`
- Columns: `data_source` (データソース), `payment_category` (支払区分), `request_company_id` (依頼会社（実行会社の入力から同時設定）), `execute_company_id` (実行会社), `source_account_id` (支払元口座), `vendor_id` (振込先), `payee_name` (お支払い先), `payee_bank_name` (銀行名), `payee_bank_code` (銀行コード), `payee_branch_name` (支店名), `payee_branch_code` (支店コード), `payee_account_type` (口座種別), `payee_account_holder_kana` (口座名義カナ), `registered_method` (登録済み支払方法), `payeasy_biller_no` (収納機関番号), `amount` (金額), `fee_bearer` (手数料負担), `scheduled_date` (振込予定日), `due_date` (支払期日), `description` (備考), `invoice_pdf_url` (請求書 PDF), `scan_image_url` (スキャン画像), `cashback_applicant_name` (申込者名), `cashback_applicant_name_kana` (申込者名カナ), `cashback_applicant_phone` (電話番号（任意）), `cashback_product_name` (商材名), `cashback_channel_name` (商流名), `rejection_reason` (差戻し理由), `manual_paid_at` (支払済み（確認操作）)
- Metadata: `id`, `payee_name`, `created_at`

### Bud / 明細 / bud_statements (list)

- Scope: `bud-statements` / `list`; client: `user`; URL: `/bud/statements`
- Columns: `matched_transfer_id` (振込を選ぶ)
- Metadata: `id`, `matched_transfer_id`

### Bud / 銀行口座・カード / bud_mf_accounts

- Scope: `bud-bank` / `(page)`; client: `mf`; URL: `/bud/bank`
- Columns: `mail_alias` (メールの口座名), `hidden` (非表示), `book_sub_account_name` (帳簿の補助科目名), `balance_mode` (残高の扱い), `anchor_balance` (基準残高), `anchor_at` (基準時刻), `anchor_date` (基準日), `balance_note` (メモ), `visible_employee_ids` (見られる人（口座）), `sort_order` (口座の並び（移動操作）)
- Metadata: `mf_account_id`, `name`, `fetched_at`, `kind`, `hidden`, `visible_employee_ids`, `sort_order`

### Bud / 銀行口座・カード / bud_mf_group_viewers

- Scope: `bud-bank` / `(page)`; client: `mf`; URL: `/bud/bank`
- Columns: `employee_ids` (見られる人（銀行 / カード全体）)
- Metadata: `kind`, `updated_at`

### Bud / 銀行口座・カード / bud_mf_axis_order

- Scope: `bud-bank` / `(page)`; client: `mf`; URL: `/bud/bank`
- Columns: `sort_order` (法人 / 銀行の並び（移動操作）)
- Metadata: `key`, `axis`

### Bud / 損益管理 / bud_bb_viewers

- Scope: `bud-broadband` / `(page)`; client: `broadband`; URL: `/bud/profit/broadband`
- Columns: `employee_ids` (閲覧者)
- Metadata: `id`

### Sprout / 掲載管理 / sprout_baitoru_postings (baitoru)

- Scope: `sprout-postings` / `baitoru`; client: `user`; URL: `/sprout/postings`
- Columns: `start_date` (掲載期間の開始), `end_date` (掲載期間の終了), `content` (掲載内容)
- Metadata: `id`, `content`, `created_at`

### Sprout / 掲載管理 / sprout_baitoru_settings (baitoru)

- Scope: `sprout-postings` / `baitoru`; client: `user`; URL: `/sprout/postings`
- Columns: `content_options` (掲載内容の選択肢 / 追加する文字), `exclude_inquiry_nos` (今回だけ除外する問合せ番号（カンマ区切り）), `notify_room` (通知先), `mention_employee_ids` (通知の宛先), `max_per_run` (1回に登録する上限)
- Metadata: `id`, `content_options`, `updated_at`

### Bloom / 月次まとめの編集 / bloom_monthly_digests

- Scope: `bloom-monthly-digest` / `(page)`; client: `admin`; URL: `/bloom/monthly-digest`
- Columns: `title` (タイトル), `summary` (サマリ), `pages` (追加するページの種類)
- Metadata: `id`, `title`, `updated_at`

### Bloom / ワークボード / bloom_daily_logs (today)

- Scope: `bloom-workboard` / `today`; client: `own-user`; URL: `/bloom/workboard`
- Columns: `planned_items` (今日やること)
- Metadata: `id`, `log_date`, `updated_at`

### Bloom / 東海林さんの状況 / bloom_ceo_status

- Scope: `bloom-workboard-ceo-status` / `(page)`; client: `user`; URL: `/bloom/workboard-ceo-status`
- Columns: `status` (対応可能 / 取り込み中 / 集中業務中 / 外出中), `summary` (メモ（200字以内）)
- Metadata: `id`, `status`, `updated_at`

### Forest / 進行期 / shinkouki (numbers)

- Scope: `forest-shinkouki` / `numbers`; client: `user`; URL: `/forest/shinkouki`
- Columns: `uriage` (売上高（円）), `gaichuhi` (外注費（円）), `rieki` (利益（円、赤字は負の値）), `reflected` (反映済み期間), `zantei` (暫定 / 確定)
- Metadata: `company_id`

### Forest / 進行期 / fiscal_periods

- Scope: `forest-financial-statements` / `(page)`; client: `user`; URL: `/forest/financial-statements`
- Columns: `junshisan` (純資産), `genkin` (現金), `yokin` (預金), `doc_url` (決算書 URL)
- Metadata: `id`, `company_id`

### System / 勤怠打刻 / system_innovera_daily_extension

- Scope: `system-attendance` / `(page)`; client: `self`; URL: `/system/attendance`
- Columns: `extension` (今日の内線番号)
- Metadata: `id`, `extension`, `work_date`

### System / 前確依頼 / system_zenkaku_check_request

- Scope: `system-zenkaku` / `(page)`; client: `requested`; URL: `/system/zenkaku`
- Columns: `sales_id` (営業ID)
- Metadata: `id`, `sales_id`

### System / 前確依頼 / system_zenkaku_submission

- Scope: `system-zenkaku` / `(page)`; client: `requested`; URL: `/system/zenkaku`
- Columns: `selected_partner_code` (依頼するチーム（候補）), `duplicate_confirmed` (重複を確認して続ける)
- Metadata: `id`, `selected_partner_code`

## 最終テスト結果

- `npx tsc --noEmit` — 成功、診断なし。
- 指定コマンド `npx vitest run src/app/api src/app/system src/app/root src/app/bud src/lib --exclude '**/employment-contract-pdf-integrity.test.tsx'` — 最終実行は **561ファイル成功・7ファイルスキップ、5,788テスト成功・20テストスキップ**。410.38秒。
- 最後の検索周辺の再確認（src/lib/search、src/app/api/search、src/app/_components/search、共通 DataTable）— **6ファイル・24テスト成功**。10.53秒。全体テストの対象外となる GlobalSearch の UI テストもこの実行に含む。
- 数字・金額・全半角・電話・日付・順位・5/20件の制限、ログイン、scope の拒否・設定上書き、本人条件、秘密の列を取得しない許可リスト、検索結果のリンク、Ctrl/Cmd+K・矢印・Enter・閉じる操作、250ms待機、0件・読み込み、URL q の DataTable への反映を確認した。
- 初回の全体実行では既存の TransactionDetail と relay queue に計2件の失敗があり、対象だけの再実行は成功した。DataTable の初期化で不要なページリセットを行わないようにも修正した。その後の指定コマンドの全体実行は2回とも成功した。jsdom の `Not implemented: navigation to another Document` は標準エラーに出るが、最終実行の失敗テストは0件。
- DB の実測・実ブラウザーの目視点検は前述のとおり未実施。並べ替えは取得できる更新・作成等の日付を用い、時刻列を設定していない表では同順位を主キー順で安定化する。

## UTF-8・日本語の読み直し

- 実装・テスト・作業スクリプト・この報告書の19ファイルを UTF-8 の厳密デコードで再読した。U+FFFD の置換文字、連続した不審な `???` はなく、日本語の「Garden 全体を検索」「電話番号」「見つかりませんでした」、見出し・列名・権限の説明が `?` に化けていないことを読み直して確認した。
- この報告書は UTF-8・BOMなし。対象は **52表・54個の scope 対応**。同じ表の self / all 等を別々に許可判定するため、表数と対応数は異なる。
- git コマンドは検証にも使用していない。migration の適用、DB の書き込み、外部への投稿・配信も実施していない。

