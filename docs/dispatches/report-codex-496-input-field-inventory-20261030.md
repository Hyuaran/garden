# Codex-496 入力欄・保存先の調査報告（2026-10-30）

## 調査結果の読み方と制約

src/app の全ディレクトリを走査し、通常の input / textarea / select、共通フォーム部品、定義配列、埋め込み HTML、API、サーバー処理、Supabase の書き込み、直接 SQL、関連 migration を照合した。旧版（legacy）、テスト、画面の検索条件、取り込みだけの表、同期・通話の自動記録は検索対象と区別した。画面操作・送信・DB 書き込みは実施していない。書くファイルはこの報告書だけであり、git コマンドは一切実行していない。

**DB の実測行数は取得できなかった。** .env.local の DATABASE_URL を値を表示せずに読み、pg で読み取り専用トランザクションによる pg_stat_user_tables の取得を試みたが、接続段階で EACCES となった。実 DB のスキーマ・RLS・設定値との一致も未確認である。後述の未確定事項を含むため、この報告書の数値は「保存対応を特定した論理入力欄」の集計であり、未確認部分まで含めた完全な実測総数ではない。

各画面の表は入力欄を1行ずつ示す。同一の論理欄を人数・日数・明細数だけ繰り返す場合は [] で示して1欄と数える。同じ値をラジオと選択欄で入力する場合は統合する。URL の別入口は併記する。各小見出し直下の権限・行の制限・結果の開き先は、その表の全行に適用する。JSON の「列 → パス」は別の DB 列ではなく、その列内の項目を意味する。

「通常」は秘密として指定された欄ではないという意味で、公開可能という意味ではない。権限を通した結果だけを返す必要がある。「探さない」は本文・候補・件数・強調表示・索引・ログへの取り込みも対象外とする。

## 権限の共通規則

- 役職: toss=トス、closer=クローザー、cs=CS、staff=正社員、outsource=業務委託、manager=責任者、admin=管理者、super_admin=全権管理者。
- 社員以上は staff / outsource / manager / admin / super_admin、責任者以上は manager / admin / super_admin、管理者以上は admin / super_admin。根拠は src/app/root/_constants/types.ts と src/lib/auth/view-roles.ts。
- 権限一覧の key は src/lib/auth/permission-registry.ts。system_view_permissions の roles / employee_ids は画面・タブの既定権限を上書きする。タブ設定がなければ画面設定へフォールバックする。super_admin の特例があるが、開発ボードは EMP-0008 だけ。src/lib/auth/view-permission.ts、view-permission.server.ts。
- 閲覧者追加は編集権限を与えない。結果一覧、件数、スニペット、結果を押した後の再取得にも同じ画面・タブ・行の制限を適用する。サービスロールによる横断 SELECT だけで実装してはいけない。
- Bloom / Tree / Leaf / Forest の scopes は view-permission.ts で利用されるが、permission-registry.ts の PERMISSION_ENTRIES には直接展開されていない。後述の同名 scope を registry に存在する key と誤記しない。

## 入力欄の一覧

### Root / 従業員マスタ

- URL: `/root/employees`
- 見られる人・行の制限: registry: root-employees-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。本人の行を読む別経路あり。Root 一覧の閲覧許可とは別に判定する。
- 結果の開き先: /root/employees で主キーに一致する行の編集小窓。現状の任意 id クエリによる自動展開は保証しない。
- 保存経路・根拠: src/app/root/employees/page.tsx → src/app/root/_lib/queries.ts の upsert / insert / update。従業員は /api/root/employees → src/app/api/root/employees/route.ts。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0001|従業員ID|文字|root_employees.employee_id|通常|
|F0002|社員番号|文字|root_employees.employee_number|通常|
|F0003|所属法人|選ぶ欄|root_employees.company_id|通常|
|F0004|氏名|文字|root_employees.name|通常|
|F0005|氏名カナ|文字|root_employees.name_kana|通常|
|F0006|公式 LINE の連絡先|文字|root_employees.line_contact_url|通常|
|F0007|メールアドレス|文字|root_employees.email|通常|
|F0008|雇用形態|選ぶ欄|root_employees.employment_type|通常|
|F0009|給与体系|選ぶ欄|root_employees.salary_system_id|通常|
|F0010|社会保険区分|選ぶ欄|root_employees.insurance_type|通常|
|F0011|Garden権限|文字|root_employees.garden_role|通常|
|F0012|入社日|日付|root_employees.hire_date|通常|
|F0013|生年月日|日付|root_employees.birthday|通常|
|F0014|退職日|日付|root_employees.termination_date|通常|
|F0015|契約終了日（外注）|日付|root_employees.contract_end_on|通常|
|F0016|事業|選ぶ欄|root_employees.business|通常|
|F0017|銀行名|文字|root_employee_profile_history.payload → bank_account.bank_name（root_employees の対応列も送信、履歴を優先）|通常|
|F0018|金融機関コード（4桁）|文字|root_employee_profile_history.payload → bank_account.bank_code（root_employees の対応列も送信、履歴を優先）|通常|
|F0019|口座種別|選ぶ欄|root_employee_profile_history.payload → bank_account.account_type（root_employees の対応列も送信、履歴を優先）|通常|
|F0020|支店名|文字|root_employee_profile_history.payload → bank_account.branch_name（root_employees の対応列も送信、履歴を優先）|通常|
|F0021|支店コード（3桁）|文字|root_employee_profile_history.payload → bank_account.branch_code（root_employees の対応列も送信、履歴を優先）|通常|
|F0022|口座番号（7桁）|文字|root_employee_profile_history.payload → bank_account.account_number（root_employees の対応列も送信、履歴を優先）|探さない：口座番号|
|F0023|口座名義|文字|root_employees.account_holder|通常|
|F0024|口座名義カナ|文字|root_employee_profile_history.payload → bank_account.holder_kana（root_employees の対応列も送信、履歴を優先）|通常|
|F0025|年末調整 甲/乙欄|選ぶ欄|root_employees.kou_otsu|通常|
|F0026|扶養家族人数（0〜20）|数字|root_employees.dependents_count|通常|
|F0027|キングオブタイムID|文字|root_employees.kot_employee_id|通常|
|F0028|INNOVERA 内線番号（PC）|文字|root_employees.innovera_extension|通常|
|F0029|INNOVERA 内線番号（モバイル）|文字|root_employees.innovera_mobile_extension|通常|
|F0030|FileMaker 社員名|文字|root_employees.filemaker_employee_name|通常|
|F0031|マネーフォワード クラウド給与 ID|文字|root_employees.mf_employee_id|通常|
|F0032|INNOVERA録音の権限|選ぶ欄|root_employees.call_recording_access|通常|
|F0033|Chatwork ID|文字|root_employees.chatwork_account_id|通常|
|F0034|備考|文字|root_employees.notes|通常|
|F0035|API トークン|文字|root_employees.chatwork_api_token_enc|探さない：暗号化された API トークン|

### Root / 法人マスタ

- URL: `/root/companies`
- 見られる人・行の制限: registry: root-companies-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: /root/companies で主キーに一致する行の編集小窓。現状の任意 id クエリによる自動展開は保証しない。
- 保存経路・根拠: src/app/root/companies/page.tsx → src/app/root/_lib/queries.ts の upsert / insert / update。従業員は /api/root/employees → src/app/api/root/employees/route.ts。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0036|法人ID|文字|root_companies.company_id|通常|
|F0037|デフォルト振込銀行|選ぶ欄|root_companies.default_bank|通常|
|F0038|法人名|文字|root_companies.company_name|通常|
|F0039|法人名カナ|文字|root_companies.company_name_kana|通常|
|F0040|電話番号|文字|root_companies.phone|通常|
|F0041|FAX番号|文字|root_companies.fax|通常|
|F0042|決算月|選ぶ欄|root_companies.fiscal_end_month|通常|
|F0043|設立日|日付|root_companies.established_on|通常|
|F0044|メールドメイン|文字|root_companies.domain|通常|
|F0045|Webサイト|文字|root_companies.website|通常|
|F0046|本店所在地|文字|root_companies.address|通常|
|F0047|法人番号（13桁）|文字|root_companies.corporate_number|通常|
|F0048|インボイス登録番号|文字|root_companies.invoice_registration_number|通常|
|F0049|電気通信事業届出番号|文字|root_companies.telecom_notification_number|通常|
|F0050|雇用保険事業所番号|文字|root_companies.employment_insurance_number|通常|
|F0051|労働保険番号|文字|root_companies.labor_insurance_number|通常|
|F0052|代理店届出番号|文字|root_companies.agency_notification_number|通常|
|F0053|産業分類番号|文字|root_companies.industry_classification|通常|
|F0054|管轄税務署|文字|root_companies.tax_office|通常|
|F0055|代表者名|文字|root_companies.representative|通常|
|F0056|代表者名カナ|文字|root_companies.representative_kana|通常|
|F0057|代表者性別|選ぶ欄|root_companies.representative_gender|通常|
|F0058|代表者生年月日|日付|root_companies.representative_birthday|通常|
|F0059|代表者携帯番号|文字|root_companies.representative_mobile|通常|
|F0060|代表者住所|文字|root_companies.representative_address|通常|
|F0061|担当者1 氏名|文字|root_companies.contact|通常|

### Root / 取引先

- URL: `/root/vendors`
- 見られる人・行の制限: registry: root-vendors-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: /root/vendors で主キーに一致する行の編集小窓。現状の任意 id クエリによる自動展開は保証しない。
- 保存経路・根拠: src/app/root/vendors/page.tsx → src/app/root/_lib/queries.ts の upsert / insert / update。従業員は /api/root/employees → src/app/api/root/employees/route.ts。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0062|取引先ID|文字|root_vendors.vendor_id|通常|
|F0063|区分|選ぶ欄|root_vendors.vendor_type|通常|
|F0064|取引先名|文字|root_vendors.vendor_name|通常|
|F0065|取引先名カナ|文字|root_vendors.vendor_name_kana|通常|
|F0066|銀行名|文字|root_vendors.bank_name|通常|
|F0067|金融機関コード（4桁）|文字|root_vendors.bank_code|通常|
|F0068|支店名|文字|root_vendors.branch_name|通常|
|F0069|支店コード（3桁）|文字|root_vendors.branch_code|通常|
|F0070|口座種別|選ぶ欄|root_vendors.account_type|通常|
|F0071|口座番号（7桁）|文字|root_vendors.account_number|探さない：口座番号|
|F0072|口座名義カナ（全角）|文字|root_vendors.account_holder_kana|通常|
|F0073|手数料負担|選ぶ欄|root_vendors.fee_bearer|通常|
|F0074|担当法人|選ぶ欄|root_vendors.company_id|通常|
|F0075|備考|文字|root_vendors.notes|通常|

### Root / 銀行口座

- URL: `/root/bank-accounts`
- 見られる人・行の制限: registry: root-bank-accounts-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: /root/bank-accounts で主キーに一致する行の編集小窓。現状の任意 id クエリによる自動展開は保証しない。
- 保存経路・根拠: src/app/root/bank-accounts/page.tsx → src/app/root/_lib/queries.ts の upsert / insert / update。従業員は /api/root/employees → src/app/api/root/employees/route.ts。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0076|法人|選ぶ欄|root_bank_accounts.corp_code|通常|
|F0077|銀行|選ぶ欄|root_bank_accounts.bank_code|通常|
|F0078|口座番号|文字|root_bank_accounts.account_number|探さない：口座番号|
|F0079|支店名|文字|root_bank_accounts.branch_name|通常|
|F0080|支店コード（3桁）|文字|root_bank_accounts.branch_code|通常|
|F0081|口座種別|選ぶ欄|root_bank_accounts.account_type|通常|
|F0082|弥生の補助科目名|文字|root_bank_accounts.sub_account_label|通常|
|F0083|CSV 出力|選ぶ欄|root_bank_accounts.has_csv_export|通常|
|F0084|残高の手入力が必要|選ぶ欄|root_bank_accounts.needs_manual_balance|通常|
|F0085|メモ|文字|root_bank_accounts.notes|通常|

### Root / 給与体系

- URL: `/root/salary-systems`
- 見られる人・行の制限: registry: root-salary-systems-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: /root/salary-systems で主キーに一致する行の編集小窓。現状の任意 id クエリによる自動展開は保証しない。
- 保存経路・根拠: src/app/root/salary-systems/page.tsx → src/app/root/_lib/queries.ts の upsert / insert / update。従業員は /api/root/employees → src/app/api/root/employees/route.ts。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0086|給与体系ID|文字|root_salary_systems.salary_system_id|通常|
|F0087|体系名|文字|root_salary_systems.system_name|通常|
|F0088|対象雇用形態|選ぶ欄|root_salary_systems.employment_type|通常|
|F0089|基本給計算方法|選ぶ欄|root_salary_systems.base_salary_type|通常|
|F0090|所定労働時間（日）|数字|root_salary_systems.working_hours_day|通常|
|F0091|所定労働日数（月）|数字|root_salary_systems.working_days_month|通常|
|F0092|残業単価倍率（法定外）|数字|root_salary_systems.overtime_rate|通常|
|F0093|残業単価倍率（深夜）|数字|root_salary_systems.night_overtime_rate|通常|
|F0094|残業単価倍率（休日）|数字|root_salary_systems.holiday_overtime_rate|通常|
|F0095|備考|文字|root_salary_systems.notes|通常|

### Root / 社会保険

- URL: `/root/insurance`
- 見られる人・行の制限: registry: root-insurance-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: /root/insurance で主キーに一致する行の編集小窓。現状の任意 id クエリによる自動展開は保証しない。
- 保存経路・根拠: src/app/root/insurance/page.tsx → src/app/root/_lib/queries.ts の upsert / insert / update。従業員は /api/root/employees → src/app/api/root/employees/route.ts。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0096|保険マスタID|文字|root_insurance.insurance_id|通常|
|F0097|適用年度（4桁）|文字|root_insurance.fiscal_year|通常|
|F0098|適用開始日|日付|root_insurance.effective_from|通常|
|F0099|適用終了日|日付|root_insurance.effective_to|通常|
|F0100|健康保険料率（%）|数字|root_insurance.health_insurance_rate|通常|
|F0101|介護保険料率（%）|数字|root_insurance.nursing_insurance_rate|通常|
|F0102|厚生年金保険料率（%）|数字|root_insurance.pension_rate|通常|
|F0103|雇用保険料率（%）|数字|root_insurance.employment_insurance_rate|通常|
|F0104|子ども・子育て支援金率（%）|数字|root_insurance.child_support_rate|通常|

### Root / 勤怠データ

- URL: `/root/attendance`
- 見られる人・行の制限: registry: root-attendance-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: /root/attendance で主キーに一致する行の編集小窓。現状の任意 id クエリによる自動展開は保証しない。
- 保存経路・根拠: src/app/root/attendance/page.tsx → src/app/root/_lib/queries.ts の upsert / insert / update。従業員は /api/root/employees → src/app/api/root/employees/route.ts。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0105|勤怠ID|文字|root_attendance.attendance_id|通常|
|F0106|従業員|選ぶ欄|root_attendance.employee_id|通常|
|F0107|対象月（YYYY-MM）|文字|root_attendance.target_month|通常|
|F0108|出勤日数|数字|root_attendance.working_days|通常|
|F0109|欠勤日数|数字|root_attendance.absence_days|通常|
|F0110|有給取得日数|数字|root_attendance.paid_leave_days|通常|
|F0111|所定労働時間|数字|root_attendance.scheduled_hours|通常|
|F0112|実労働時間|数字|root_attendance.actual_hours|通常|
|F0113|所定外時間（平日）|数字|root_attendance.overtime_hours|通常|
|F0114|法定外時間（平日）|数字|root_attendance.legal_overtime_hours|通常|
|F0115|深夜時間|数字|root_attendance.night_hours|通常|
|F0116|休日出勤時間|数字|root_attendance.holiday_hours|通常|
|F0117|遅刻時間|数字|root_attendance.late_hours|通常|
|F0118|早退時間|数字|root_attendance.early_leave_hours|通常|
|F0119|研修時間（任意）|数字|root_attendance.training_hours|通常|
|F0120|事務時間（任意）|数字|root_attendance.office_hours|通常|
|F0121|取込ステータス|選ぶ欄|root_attendance.import_status|通常|

### Root / 従業員マスタ / 名簿プロフィール

- URL: `/root/employees`
- 見られる人・行の制限: registry: root-employees-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: 従業員行の編集小窓で住所・連絡先・口座2・通勤・雇用の欄を開く。employee_id と category が識別子。
- 保存経路・根拠: RosterProfileFields.tsx / roster-fields.ts → /api/root/employees の profile_changes → roster-profile-edit.server.ts:saveProfileChanges。root_employee_profile_current は読むための最新値で、書き込み先は履歴。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0122|郵便番号|文字|root_employee_profile_history.payload → category=address, postal_code|通常|
|F0123|都道府県|文字|root_employee_profile_history.payload → category=address, prefecture|通常|
|F0124|市町村|文字|root_employee_profile_history.payload → category=address, city|通常|
|F0125|町域|文字|root_employee_profile_history.payload → category=address, town|通常|
|F0126|建物名|文字|root_employee_profile_history.payload → category=address, building|通常|
|F0127|部屋番号|文字|root_employee_profile_history.payload → category=address, room|通常|
|F0128|連絡先|文字|root_employee_profile_history.payload → category=contact, phone|通常|
|F0129|連絡先1|文字|root_employee_profile_history.payload → category=contact, phone_1|通常|
|F0130|連絡先2|文字|root_employee_profile_history.payload → category=contact, phone_2|通常|
|F0131|連絡先3|文字|root_employee_profile_history.payload → category=contact, phone_3|通常|
|F0132|口座2 銀行名|文字|root_employee_profile_history.payload → category=bank_account, sub_account.bank_name|通常|
|F0133|口座2 金融機関コード|文字|root_employee_profile_history.payload → category=bank_account, sub_account.bank_code|通常|
|F0134|口座2 支店名|文字|root_employee_profile_history.payload → category=bank_account, sub_account.branch_name|通常|
|F0135|口座2 支店コード|文字|root_employee_profile_history.payload → category=bank_account, sub_account.branch_code|通常|
|F0136|口座2 種別|選ぶ欄|root_employee_profile_history.payload → category=bank_account, sub_account.account_type|通常|
|F0137|口座2 口座番号|文字|root_employee_profile_history.payload → category=bank_account, sub_account.account_number|探さない：口座番号|
|F0138|口座2 名義カナ|文字|root_employee_profile_history.payload → category=bank_account, sub_account.holder_kana|通常|
|F0139|交通費 片道|金額|root_employee_profile_history.payload → category=commute, one_way|通常|
|F0140|交通費上限|金額|root_employee_profile_history.payload → category=commute, monthly_cap|通常|
|F0141|最寄り駅|選ぶ欄|root_employee_profile_history.payload → category=commute, nearest_station|通常|
|F0142|通勤経路|文字|root_employee_profile_history.payload → category=commute, route|通常|
|F0143|交通費支給|選ぶ欄|root_employee_profile_history.payload → category=commute, paid|通常|
|F0144|事業名（旧区分・Root の「事業」とは別の項目）|選ぶ欄|root_employee_profile_history.payload → category=employment, business|通常|
|F0145|部署名|選ぶ欄|root_employee_profile_history.payload → category=employment, department|通常|
|F0146|所属|選ぶ欄|root_employee_profile_history.payload → category=employment, affiliation|通常|
|F0147|基準時給|金額|root_employee_profile_history.payload → category=employment, base_hourly|通常|
|F0148|研修時給|金額|root_employee_profile_history.payload → category=employment, training_hourly|通常|
|F0149|研修上限|金額|root_employee_profile_history.payload → category=employment, training_cap|通常|
|F0150|年末調整|選ぶ欄|root_employee_profile_history.payload → category=employment, year_end_adjustment|通常|
|F0151|社会保険|選ぶ欄|root_employee_profile_history.payload → category=employment, social_insurance|通常|
|F0152|雇用保険|選ぶ欄|root_employee_profile_history.payload → category=employment, employment_insurance|通常|
|F0153|雇用保険番号|文字|root_employee_profile_history.payload → category=employment, employment_insurance_no|通常|
|F0154|年金番号|文字|root_employee_profile_history.payload → category=employment, pension_no|通常|
|F0155|前払い希望|選ぶ欄|root_employee_profile_history.payload → category=employment, advance_pay|通常|
|F0156|架電区分|選ぶ欄|root_employee_profile_history.payload → category=employment, call_type|通常|

### Root / 従業員マスタ / 所属履歴

- URL: `/root/employees`
- 見られる人・行の制限: registry: root-employees-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: 従業員の小窓 → 所属履歴 → id の行。Kintone 由来の履歴は編集不可。
- 保存経路・根拠: src/app/root/employees/TeamHistoryPanel.tsx → /api/root/employees/[employeeId]/team-history → root_employee_team_history insert/update。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0157|移動日|日付|root_employee_team_history.effective_date|通常|
|F0158|チーム|選ぶ欄|root_employee_team_history.team|通常|
|F0159|メモ|文字|root_employee_team_history.memo|通常|

### Root / 口座の点検 / 後継コード登録

- URL: `/root/bank-check`
- 見られる人・行の制限: registry: root-bank-check / api-root-bank-check。既定は管理者以上。
- 結果の開き先: /root/bank-check の後継コードの一覧。口座番号は検索に使わない。
- 保存経路・根拠: src/app/root/bank-check/page.tsx → /api/root/bank-check/successors → src/app/api/root/bank-check/_lib.ts:saveSuccessor。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0160|廃止された金融機関コード|文字|system_bank_successors.old_bank_code|通常|
|F0161|廃止された支店コード|文字|system_bank_successors.old_branch_code|通常|
|F0162|後継の金融機関コード|文字|system_bank_successors.new_bank_code|通常|
|F0163|後継の支店コード|文字|system_bank_successors.new_branch_code|通常|
|F0164|適用日|日付|system_bank_successors.effective_date|通常|
|F0165|メモ|文字|system_bank_successors.note|通常|

### Root / 最低賃金マスタ

- URL: `/root/minimum-wages`
- 見られる人・行の制限: registry: root-minimum-wages-view（既定は責任者以上、閲覧設定で変更）。編集は全権管理者のみ（minimum-wages API）。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: 対象行の小窓（id）。
- 保存経路・根拠: src/app/root/minimum-wages/page.tsx → /api/root/minimum-wages → root_minimum_wages insert/update。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0166|都道府県|文字|root_minimum_wages.prefecture|通常|
|F0167|時給|金額|root_minimum_wages.hourly_amount|通常|
|F0168|適用開始日|日付|root_minimum_wages.effective_from|通常|
|F0169|出典 URL|文字|root_minimum_wages.source_url|通常|

### Root / 郵便の転送

- URL: `/root/mail-forwarding`
- 見られる人・行の制限: registry: root-mail-forwarding-view / root-mail-forwarding-write。既定は全権管理者。DB 側の root_mail_forwarding_can_read も確認対象。
- 結果の開き先: 転送行 id の小窓。届出は forwarding_id で親の転送行を開き、届出記録を表示。
- 保存経路・根拠: src/app/root/mail-forwarding/page.tsx / AddressInputs.tsx → root_mail_forwarding_create RPC（新規は親子を保存）、または各表 insert/update。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0170|名義（必須）|文字|root_mail_forwardings.holder|通常|
|F0171|転送元の住所 / 郵便番号|文字|root_mail_forwardings.from_address（composeAddress で結合）|通常|
|F0172|転送元の住所 / 住所|文字|root_mail_forwardings.from_address（composeAddress で結合）|通常|
|F0173|転送元の住所 / 建物名|文字|root_mail_forwardings.from_address（composeAddress で結合）|通常|
|F0174|転送先の住所 / 郵便番号|文字|root_mail_forwardings.to_address（composeAddress で結合）|通常|
|F0175|転送先の住所 / 住所|文字|root_mail_forwardings.to_address（composeAddress で結合）|通常|
|F0176|転送先の住所 / 建物名|文字|root_mail_forwardings.to_address（composeAddress で結合）|通常|
|F0177|メモ|文字|root_mail_forwardings.notes|通常|
|F0178|止める|選ぶ欄|root_mail_forwardings.stopped|通常|
|F0179|最初の届出日 / 新しい届出日|日付|root_mail_forwarding_filings.filed_on|通常|
|F0180|届出の方法|選ぶ欄|root_mail_forwarding_filings.method|通常|
|F0181|受付番号|文字|root_mail_forwarding_filings.receipt|通常|
|F0182|届けた人|文字|root_mail_forwarding_filings.filed_by|通常|
|F0183|届出のメモ|文字|root_mail_forwarding_filings.notes|通常|

### Root / 契約書

- URL: `/root/contracts`
- 見られる人・行の制限: registry: root-contracts-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: 契約の id 行と PDF。編集フォームは employee_id を選択。
- 保存経路・根拠: src/app/root/contracts/page.tsx / ContractTypeFields.tsx → /api/root/contracts → system_employment_contracts.insert({ employee_id,payload,... })。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0184|従業員|選ぶ欄|system_employment_contracts.employee_id|通常|
|F0185|新規 / 更新|選ぶ欄|system_employment_contracts.payload → kind|通常|
|F0186|給与区分|選ぶ欄|system_employment_contracts.payload → salaryKind|通常|
|F0187|週の所定時間|数字|system_employment_contracts.payload → weeklyHours|通常|
|F0188|契約期間（から）|日付|system_employment_contracts.payload → contractStart|通常|
|F0189|契約期間（まで）|日付|system_employment_contracts.payload → contractEnd|通常|
|F0190|基本賃金（時給・円 / 月給・円）|金額|system_employment_contracts.payload → hourlyWage|通常|
|F0191|通知日及び締結日|日付|system_employment_contracts.payload → concludedOn|通常|
|F0192|就業場所|文字|system_employment_contracts.payload → workLocation|通常|
|F0193|従業員住所（任意）|文字|system_employment_contracts.payload → employeeAddress|通常|
|F0194|業務内容|選ぶ欄|system_employment_contracts.payload → jobType|通常|
|F0195|その他の業務内容|文字|system_employment_contracts.payload → jobTypeOther|通常|
|F0196|契約書の種類|選ぶ欄|system_employment_contracts.payload → templateType|通常|
|F0197|雇用期間|選ぶ欄|system_employment_contracts.payload → indefinite|通常|
|F0198|契約更新|選ぶ欄 / 文字|system_employment_contracts.payload → renewalText|通常|
|F0199|通勤手当の月額上限（円）|金額|system_employment_contracts.payload → commuteCap|通常|
|F0200|業務内容（本文）|文字|system_employment_contracts.payload → duties|通常|
|F0201|就業時間|文字|system_employment_contracts.payload → workHours|通常|
|F0202|固定残業|選ぶ欄|system_employment_contracts.payload → fixedOvertime|通常|
|F0203|始業|日付（時刻）|system_employment_contracts.payload → startTime|通常|
|F0204|終業|日付（時刻）|system_employment_contracts.payload → endTime|通常|
|F0205|休憩（分）|数字|system_employment_contracts.payload → breakMinutes|通常|

### Root / 受信箱 / 通勤経路の承認

- URL: `/root/inbox`
- 見られる人・行の制限: registry: root-inbox-view（既定は責任者以上、閲覧設定で変更）。編集は管理者以上。src/lib/auth/root-view.server.ts / root-view-scopes.ts。
- 結果の開き先: 届出 id 行の詳細。
- 保存経路・根拠: src/app/root/inbox/page.tsx → /api/root/inbox → system_mypage_submissions.update。承認後はプロフィール履歴・給与口座にも反映する。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0206|片道金額|金額|system_mypage_submissions.proposed_one_way|通常|

### System / 入社手続き / 自分の入社手続き・代行入力

- URL: `/system/onboarding?tab=self（代行は /system/onboarding/admin/[employeeId]/proxy）`
- 見られる人・行の制限: registry: system-onboarding / system-onboarding-self（全役職・本人の employee_id）。代行は system-onboarding-proxy（責任者以上）、みんなの入社手続きの閲覧設定を併用。口座・番号を扱う代行は全権管理者。
- 結果の開き先: 本人は自分の入力ステップ。管理側は /system/onboarding/admin/[employeeId]。代理画面の経路は app の proxy ページを参照。提出済みの本人入力は読み取りだけ。
- 保存経路・根拠: OnboardingClient.tsx → /api/system/onboarding → onboarding.server.ts:saveOnboarding → system_onboarding.upsert。代行は onboarding-proxy.server.ts → save_onboarding_proxy RPC。crypto.mjs により本人・家族の番号を暗号化。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0207|氏名|文字|system_onboarding.name|通常|
|F0208|フリガナ|文字|system_onboarding.name_kana|通常|
|F0209|性別|選ぶ欄|system_onboarding.gender|通常|
|F0210|生年月日|日付|system_onboarding.birth_date|通常|
|F0211|郵便番号|文字|system_onboarding.postal_code|通常|
|F0212|住所|文字|system_onboarding.address|通常|
|F0213|住所のフリガナ|文字|system_onboarding.address_kana|通常|
|F0214|電話番号|文字|system_onboarding.phone|通常|
|F0215|メールアドレス|文字|system_onboarding.email|通常|
|F0216|世帯主の氏名|文字|system_onboarding.householder_name|通常|
|F0217|世帯主との続柄|選ぶ欄|system_onboarding.householder_relation|通常|
|F0218|基礎年金番号|文字|system_onboarding.pension_number|通常|
|F0219|雇用保険被保険者証|選ぶ欄|system_onboarding.employment_insurance_status|通常|
|F0220|雇用保険被保険者番号|文字|system_onboarding.employment_insurance_number|通常|
|F0221|会社名|文字|system_onboarding.previous_employer|通常|
|F0222|勤務した期間（開始）|日付|system_onboarding.previous_employer_from|通常|
|F0223|勤務した期間（終了）|日付|system_onboarding.previous_employer_to|通常|
|F0224|通勤手段（主なもの）|選ぶ欄|system_onboarding.commute_method|通常|
|F0225|銀行名|文字|system_onboarding.bank_name|通常|
|F0226|金融機関コード（4桁）|文字|system_onboarding.bank_code|通常|
|F0227|支店名|文字|system_onboarding.branch_name|通常|
|F0228|支店コード（3桁）|文字|system_onboarding.branch_code|通常|
|F0229|預金種別|選ぶ欄|system_onboarding.account_type|通常|
|F0230|口座番号（8桁以内）|文字|system_onboarding.account_number|探さない：口座番号|
|F0231|口座名義カナ|文字|system_onboarding.account_holder_kana|通常|
|F0232|マイナンバー（12桁）|文字|system_onboarding.my_number_secret（暗号化本体）、my_number（マスク）|探さない：マイナンバー（末尾・マスクも検索しない）|
|F0233|氏名|文字|system_onboarding.emergency_name|通常|
|F0234|続柄|選ぶ欄|system_onboarding.emergency_relation|通常|
|F0235|続柄（その他）|文字|system_onboarding.emergency_relation_other|通常|
|F0236|住所|文字|system_onboarding.emergency_address|通常|
|F0237|電話番号|文字|system_onboarding.emergency_phone|通常|
|F0238|扶養家族 / 氏名|文字|system_onboarding.dependents → [].name|通常|
|F0239|扶養家族 / フリガナ|文字|system_onboarding.dependents → [].name_kana|通常|
|F0240|扶養家族 / マイナンバー（12桁）|文字|system_onboarding.dependents → [].my_number_secret（暗号化）、my_number（マスク）|探さない：家族のマイナンバー|
|F0241|扶養家族 / 続柄|選ぶ欄|system_onboarding.dependents → [].relation|通常|
|F0242|扶養家族 / 生年月日|日付|system_onboarding.dependents → [].birth_date|通常|
|F0243|扶養家族 / 年間収入（円）|金額|system_onboarding.dependents → [].annual_income|通常|
|F0244|扶養家族 / 職業または学校と学年|文字|system_onboarding.dependents → [].occupation|通常|
|F0245|通勤区間 / 交通機関|選ぶ欄|system_onboarding.commute_routes → [].kind|通常|
|F0246|通勤区間 / 乗る駅・停留所|文字|system_onboarding.commute_routes → [].from_station|通常|
|F0247|通勤区間 / 降りる駅・停留所|文字|system_onboarding.commute_routes → [].to_station|通常|
|F0248|通勤区間 / 路線・系統|文字|system_onboarding.commute_routes → [].line|通常|
|F0249|通勤区間 / 1か月の定期代（円）|金額|system_onboarding.commute_routes → [].pass_monthly|通常|
|F0250|通勤区間 / 片道の運賃（円）|金額|system_onboarding.commute_routes → [].fare_oneway|通常|
|F0251|内容を確認しました（秘密保持）|選ぶ欄|system_onboarding.nda_agreed_at（同意時刻へ変換）|通常|

### System / 入社手続き / みんなの入社手続き・事務入力

- URL: `/system/onboarding/admin/[employeeId]`
- 見られる人・行の制限: registry: system-onboarding-all / system-onboarding-admin。既定は責任者以上、閲覧追加の対象者は canView(all) を満たすこと。編集は MANAGER_ROLES。口座・番号の参照は sensitive 判定に従い、番号復号は my_number_viewers も必要。
- 結果の開き先: employeeId の詳細ページ。
- 保存経路・根拠: OnboardingAdminDetailClient.tsx → /api/system/onboarding/admin/[employeeId] → onboarding-admin.server.ts → system_onboarding.update。Root への確定反映は同ファイル内に別処理あり。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0252|メールアドレス|文字|system_onboarding.email|通常|
|F0253|世帯主の氏名|文字|system_onboarding.householder_name|通常|
|F0254|世帯主との続柄|選ぶ欄|system_onboarding.householder_relation|通常|
|F0255|所属店舗|文字|system_onboarding.office|通常|
|F0256|週の所定労働時間|数字|system_onboarding.weekly_hours|通常|
|F0257|健康保険|選ぶ欄|system_onboarding.health_insurance|通常|
|F0258|厚生年金|選ぶ欄|system_onboarding.pension_insurance|通常|
|F0259|雇用保険|選ぶ欄|system_onboarding.employment_insurance|通常|
|F0260|税区分|選ぶ欄|system_onboarding.tax_class|通常|
|F0261|給与の区分|選ぶ欄|system_onboarding.salary_kind|通常|
|F0262|基本給（円）|金額|system_onboarding.base_salary|通常|
|F0263|手当 / 名前|文字|system_onboarding.allowances → [].name|通常|
|F0264|手当 / 金額（円）|金額|system_onboarding.allowances → [].amount|通常|
|F0265|交通費の上限（1か月・円）|金額|system_onboarding.commute_cap_monthly|通常|
|F0266|支給額（1か月・円）|金額|system_onboarding.commute_fixed_monthly|通常|

### System / 入社手続き / 入社予定者・入社後の確認

- URL: `/system/onboarding?tab=candidates / /system/onboarding?tab=confirmations`
- 見られる人・行の制限: registry: system-onboarding-candidates / system-onboarding-confirmations / system-onboarding-hire。既定は全権管理者。
- 結果の開き先: 候補者 id 行の編集小窓 / 入社後の確認ステップ。
- 保存経路・根拠: HireCandidatesClient.tsx → /api/system/hire-candidates → hire-candidates.server.ts insert/update。採用実行は Kintone / KOT / Root へ反映。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0267|姓|文字|system_hire_candidates.last_name|通常|
|F0268|名|文字|system_hire_candidates.first_name|通常|
|F0269|セイ|文字|system_hire_candidates.last_name_kana|通常|
|F0270|メイ|文字|system_hire_candidates.first_name_kana|通常|
|F0271|生年月日|日付|system_hire_candidates.birthday|通常|
|F0272|性別|選ぶ欄|system_hire_candidates.gender|通常|
|F0273|入社日|日付|system_hire_candidates.hire_date|通常|
|F0274|雇用形態|選ぶ欄|system_hire_candidates.employment_type|通常|
|F0275|法人|選ぶ欄|system_hire_candidates.company_id|通常|
|F0276|KING OF TIME の所属|選ぶ欄|system_hire_candidates.kot_division_code|通常|
|F0277|KING OF TIME の雇用区分|選ぶ欄|system_hire_candidates.kot_type_code|通常|
|F0278|確認チェック / undefined|選ぶ欄|system_hire_candidates.checklist → undefined.checked_at / checked_by（チェックを記録）|通常|
|F0279|確認チェック / line_skipped|選ぶ欄|system_hire_candidates.checklist → line_skipped.checked_at / checked_by（チェックを記録）|通常|

### My・System・LIFF / マイページ / 自分の情報・各種届出

- URL: `/my?tab=profile（/system/mypage の ProfileTab、LIFF にも同じ届出処理）`
- 見られる人・行の制限: registry: api-require-employee / system-mypage-view。本人の employee_id で届出一覧・取消・確認。管理側は root-inbox-view と API の管理者確認。
- 結果の開き先: 本人はプロフィールの届出履歴行、管理側は /root/inbox で id の詳細。直接 id を開く URL は未実装として扱う。
- 保存経路・根拠: SubmissionModal.tsx / submission-fields.ts → /api/system/mypage/submissions（LIFF は /api/liff/submissions）→ create-submission.server.ts → system_mypage_submissions.insert。口座変更承認で bud_employee_bank_accounts に反映。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0280|扶養の変更 / 変更後の扶養の人数|数字|system_mypage_submissions.payload → count（submission_type=dependents）|通常|
|F0281|扶養の変更 / 変更の内容|文字|system_mypage_submissions.payload → details（submission_type=dependents）|通常|
|F0282|扶養の変更 / 変更の日|日付|system_mypage_submissions.payload → effectiveDate（submission_type=dependents）|通常|
|F0283|扶養の変更 / 補足（任意）|文字|system_mypage_submissions.payload → note（submission_type=dependents）|通常|
|F0284|緊急連絡先 / 現住所|文字|system_mypage_submissions.payload → selfAddress（submission_type=emergency_contact）|通常|
|F0285|緊急連絡先 / 個人の電話番号（携帯等）|文字|system_mypage_submissions.payload → selfPhone（submission_type=emergency_contact）|通常|
|F0286|緊急連絡先 / 緊急連絡先の氏名|文字|system_mypage_submissions.payload → ecName（submission_type=emergency_contact）|通常|
|F0287|緊急連絡先 / 本人との続柄|文字|system_mypage_submissions.payload → ecRelationship（submission_type=emergency_contact）|通常|
|F0288|緊急連絡先 / 緊急連絡先の住所（同一の場合は「同上」）|文字|system_mypage_submissions.payload → ecAddress（submission_type=emergency_contact）|通常|
|F0289|緊急連絡先 / 緊急連絡先の電話番号|文字|system_mypage_submissions.payload → ecPhone（submission_type=emergency_contact）|通常|
|F0290|緊急連絡先 / 区分|選ぶ欄|system_mypage_submissions.payload → kind（submission_type=emergency_contact）|通常|
|F0291|通勤経路の変更 / 新しい最寄り駅|文字|system_mypage_submissions.payload → station（submission_type=commute_route）|通常|
|F0292|通勤経路の変更 / 適用希望日|日付|system_mypage_submissions.payload → effectiveDate（submission_type=commute_route）|通常|
|F0293|通勤経路の変更 / 補足（任意）|文字|system_mypage_submissions.payload → note（submission_type=commute_route）|通常|
|F0294|給与受取口座の変更 / 銀行名|文字|system_mypage_submissions.payload → bankName（submission_type=bank_account）|通常|
|F0295|給与受取口座の変更 / 金融機関コード（4桁）|文字|system_mypage_submissions.payload → bankCode（submission_type=bank_account）|通常|
|F0296|給与受取口座の変更 / 支店名|文字|system_mypage_submissions.payload → branchName（submission_type=bank_account）|通常|
|F0297|給与受取口座の変更 / 支店コード（3桁）|文字|system_mypage_submissions.payload → branchCode（submission_type=bank_account）|通常|
|F0298|給与受取口座の変更 / 口座番号（8桁以内）|文字|system_mypage_submissions.payload → accountNumber（submission_type=bank_account）|探さない：口座番号|
|F0299|給与受取口座の変更 / 口座名義カナ|文字|system_mypage_submissions.payload → holderKana（submission_type=bank_account）|通常|
|F0300|退職の届出 / 退職希望日|日付|system_mypage_submissions.payload → desiredDate（submission_type=resignation）|通常|
|F0301|退職の届出 / 理由（任意）|文字|system_mypage_submissions.payload → reason（submission_type=resignation）|通常|
|F0302|秘密保持誓約 / 誓約日|日付|system_mypage_submissions.payload → pledgeDate（submission_type=nda）|通常|
|F0303|秘密保持誓約 / 住所|文字|system_mypage_submissions.payload → address（submission_type=nda）|通常|
|F0304|秘密保持誓約 / 氏名（電子署名）|文字|system_mypage_submissions.payload → signature（submission_type=nda）|通常|
|F0305|秘密保持誓約 / 区分|選ぶ欄|system_mypage_submissions.payload → kind（submission_type=nda）|通常|
|F0306|秘密保持誓約 / 内容に同意します|選ぶ欄|system_mypage_submissions.payload → agreed|通常|

### My・LIFF・Root / マイナンバーの提出・差戻し

- URL: `/my（番号提出案内） / /root/my-numbers`
- 見られる人・行の制限: 本人提出は認証した employee_id。管理画面は my_number_viewers の登録者。permission-registry.ts に root-my-numbers の専用 key はない。src/lib/my-number/access.server.ts を優先。
- 結果の開き先: 本人の提出案内 / 管理画面の employee_id 行。秘密自体は検索結果に出さない。
- 保存経路・根拠: src/lib/my-number/MyNumberForm.tsx → submission.server.ts → root_employee_my_numbers.upsert と private storage。管理は /api/root/my-numbers → review_my_number RPC。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0307|マイナンバー|文字|root_employee_my_numbers.my_number_cipher / my_number_iv / my_number_tag / my_number_last4 / key_version|探さない：暗号化番号と末尾|
|F0308|本人確認の写真|ファイル|root_employee_my_numbers.photo_path、Storage my-number-photos|探さない：番号の写真|
|F0309|同意|選ぶ欄|root_employee_my_numbers.consented_at|通常|
|F0310|差戻しの理由|文字|root_employee_my_numbers.rejection_reason（管理操作）|通常|

### System・M / 経費 報告

- URL: `/system/forms/expense（/m/expense/[form] も同じフォーム）`
- 見られる人・行の制限: registry: system-expense-view、業務フォームの閲覧設定。履歴は submitted_by=認証 user.id の本人分。
- 結果の開き先: 元のフォームの本人の最近の報告。行 id による詳細小窓はない。
- 保存経路・根拠: src/app/system/forms/expense/ExpenseClient.tsx → /api/system/expense-report → system_expense_report.insert。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0311|経費の種類（フォーム切替）|選ぶ欄|system_expense_report.form|通常|
|F0312|事業|選ぶ欄|system_expense_report.business|通常|
|F0313|決済方法|選ぶ欄|system_expense_report.payment|通常|
|F0314|決済日|日付|system_expense_report.paid_on|通常|
|F0315|金額（円・税込）|金額|system_expense_report.amount|通常|
|F0316|使用用途|選ぶ欄|system_expense_report.purpose|通常|
|F0317|用途の詳細|文字|system_expense_report.purpose_detail|通常|
|F0318|備考|文字|system_expense_report.note|通常|

### System・M / NHK訪問業務 報告フォーム

- URL: `/system/forms/nhk-visit（スマホ入口も NhkVisitClient を共有）`
- 見られる人・行の制限: registry: system-forms-view / system-forms-tab-input、system-form-<slug>（forms-registry.ts）。各 API の requireStaff / requireEmployee も併用。履歴は employee_number / submitted_by で本人分を取得。
- 結果の開き先: 本人の直近1週間の報告。既存の id 詳細リンクなし。
- 保存経路・根拠: NhkVisitClient.tsx → /api/system/nhk-visit → system_nhk_visit_report.insert、Kintone へも送信。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0319|日付|日付|system_nhk_visit_report.visit_date|通常|
|F0320|時間（開始）|日付（時刻）|system_nhk_visit_report.start_time|通常|
|F0321|時間（終了）|日付（時刻）|system_nhk_visit_report.end_time|通常|
|F0322|派遣先|選ぶ欄|system_nhk_visit_report.destination|通常|
|F0323|成約件数 / 新規 / 地上|数字|system_nhk_visit_report.new_ground|通常|
|F0324|成約件数 / 新規 / 衛星|数字|system_nhk_visit_report.new_satellite|通常|
|F0325|成約件数 / 住所変更 / 地上|数字|system_nhk_visit_report.address_ground|通常|
|F0326|成約件数 / 住所変更 / 衛星|数字|system_nhk_visit_report.address_satellite|通常|
|F0327|口座・クレ / 件数|数字|system_nhk_visit_report.bank_credit|通常|
|F0328|交通費|選ぶ欄|system_nhk_visit_report.transport_fee|通常|

### My / AP日報

- URL: `/my（AP日報のタブ）`
- 見られる人・行の制限: registry に AP日報の独立 key はない。/api/my/ap-daily-report の認証 employee_id、本人分だけ。
- 結果の開き先: /my の AP日報 / 履歴。report_date と employee_id と kind で対象日報を識別。
- 保存経路・根拠: src/app/my/ApDailyReport.tsx / ap-daily-report.ts → /api/my/ap-daily-report → system_ap_daily_report.upsert。自動コール数・有効率は入力欄に数えない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0329|日付|日付|system_ap_daily_report.report_date|通常|
|F0330|区分|選ぶ欄|system_ap_daily_report.kind|通常|
|F0331|開始時間|日付（時刻）|system_ap_daily_report.start_time|通常|
|F0332|終了時間|日付（時刻）|system_ap_daily_report.end_time|通常|
|F0333|稼働時間（分）|数字|system_ap_daily_report.work_minutes|通常|
|F0334|トス / 本日獲得|数字|system_ap_daily_report.count|通常|
|F0335|現状合計|数字|system_ap_daily_report.month_total|通常|
|F0336|コイン作成数|数字|system_ap_daily_report.coin_created|通常|
|F0337|誘導約束|数字|system_ap_daily_report.guide_promised|通常|
|F0338|誘導中|数字|system_ap_daily_report.guide_in_progress|通常|
|F0339|明細確認依頼|数字|system_ap_daily_report.statement_check_request|通常|
|F0340|トータルコイン|数字|system_ap_daily_report.coin_total|通常|
|F0341|反省点・改善点|文字|system_ap_daily_report.reflection|通常|

### System / 給与計算連絡

- URL: `/system/forms/payroll-notice`
- 見られる人・行の制限: registry: system-forms-view / system-forms-tab-input、system-form-<slug>（forms-registry.ts）。各 API の requireStaff / requireEmployee も併用。履歴閲覧はページの canViewHistory と API の役職判定を併用。
- 結果の開き先: 同じ画面の履歴の id 行。配列中の氏名は親の連絡を開く。
- 保存経路・根拠: PayrollNoticeClient.tsx → /api/system/payroll-notice → root_payroll_notice.insert → Chatwork 投稿。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0342|チーム|選ぶ欄|root_payroll_notice.team|通常|
|F0343|通勤の該当者がいる / いない|選ぶ欄|root_payroll_notice.commute_flag|通常|
|F0344|通勤 / 該当者名|文字|root_payroll_notice.commute_people → [].name|通常|
|F0345|通勤最寄り駅|文字|root_payroll_notice.commute_people → [].station|通常|
|F0346|研修の該当者がいる / いない|選ぶ欄|root_payroll_notice.training_flag|通常|
|F0347|研修 / 該当者名|文字|root_payroll_notice.training_people → [].name|通常|
|F0348|紹介の該当者がいる / いない|選ぶ欄|root_payroll_notice.referral_flag|通常|
|F0349|紹介 / 該当者名|文字|root_payroll_notice.referral_people → [].name|通常|
|F0350|紹介者名|文字|root_payroll_notice.referral_people → [].referrer|通常|
|F0351|その他の連絡|文字|root_payroll_notice.other_notes|通常|

### System / 出勤表・シフトLINE連絡テキスト生成 / 並びの設定

- URL: `/system/forms/shukkin`
- 見られる人・行の制限: registry: system-forms-view / system-forms-tab-input、system-form-<slug>（forms-registry.ts）。各 API の requireStaff / requireEmployee も併用。並びの保存は requireManager（責任者以上）。LINE 連携は対象従業員と管理者を API で検証。
- 結果の開き先: 同画面の並びの設定、employee_number 行。
- 保存経路・根拠: ShukkinClient.tsx → /api/system/shukkin/members → system_shukkin_member.upsert。表示名など CSV 取り込みから来る値と手動変更を区別。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0352|グループ|選ぶ欄|system_shukkin_member.group_name|通常|
|F0353|表示名|文字|system_shukkin_member.display_name|通常|
|F0354|表示の並び順（移動操作）|数字|system_shukkin_member.sort_order|通常|

### System / 契約書管理 / 登録

- URL: `/system/contracts?tab=register`
- 見られる人・行の制限: registry: system-contracts-page / system-contracts-view / system-contracts-tab-register。既定は責任者以上。
- 結果の開き先: /system/contracts の契約書タブで id の詳細 / PDF。product の検索結果は契約書行に戻す。
- 保存経路・根拠: src/app/system/contracts/page.tsx → /api/system/contracts → system_contracts.insert/update。元 PDF は Drive、extracted_text は機械抽出で入力欄とは別。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0355|取引先名|文字|system_contracts.counterparty|通常|
|F0356|法人|選ぶ欄|system_contracts.company_id|通常|
|F0357|契約の種類|文字|system_contracts.contract_type|通常|
|F0358|契約日|日付|system_contracts.concluded_on|通常|
|F0359|メモ|文字|system_contracts.note|通常|
|F0360|契約書 PDF|ファイル|system_contracts.drive_file_id|通常|
|F0361|商材名（テンプレート作成）|文字|system_contracts.product|通常|

### System / 開発ボード

- URL: `/system/dev-board`
- 見られる人・行の制限: registry: system-menu-/system/dev-board、system-dev-board-view は役職許可なし。view-permission.ts の EMP-0008 限定条件。
- 結果の開き先: 質問 id のカード。モジュールのタブ・完了表示を合わせて展開する。
- 保存経路・根拠: BoardClient.tsx → /api/system/dev-board → system_dev_create_question / system_dev_answer_question RPC → system_dev_questions。supabase/migrations/20261026043900_system_dev_board.sql。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0362|見出し|文字|system_dev_questions.title|通常|
|F0363|モジュール|選ぶ欄|system_dev_questions.module|通常|
|F0364|説明|文字|system_dev_questions.body|通常|
|F0365|答え方|選ぶ欄|system_dev_questions.answer_type|通常|
|F0366|選択肢（1行に1つ）|文字|system_dev_questions.options → [].label|通常|
|F0367|おすすめ（先頭の *）|選ぶ欄|system_dev_questions.options → [].recommended|通常|
|F0368|答えを選んでください|選ぶ欄|system_dev_questions.answer_choice|通常|
|F0369|回答 / 補足（もとの文）|文字|system_dev_questions.answer_text_raw|通常|
|F0370|整えた文で送る（確認後の回答）|文字|system_dev_questions.answer_text|通常|

### System / コーポレートサイト / お知らせ

- URL: `/system/sites?tab=news`
- 見られる人・行の制限: registry: system-sites-view / system-sites-tab-news。既定は社員以上。保存は API の管理権限を併用。
- 結果の開き先: company_id のサイトを選び、news.id の編集小窓。
- 保存経路・根拠: SiteNewsPanel.tsx → /api/system/sites/news、/api/system/sites/news/[id] → system_site_news.insert/update。保存は requireManager（責任者以上）。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0371|法人|選ぶ欄|system_site_news.company_id|通常|
|F0372|日付|日付|system_site_news.published_on|通常|
|F0373|題名|文字|system_site_news.title|通常|
|F0374|本文|文字|system_site_news.body|通常|
|F0375|公開する|選ぶ欄|system_site_news.is_published|通常|

### System / コーポレートサイト / 通知先

- URL: `/system/sites?tab=sites`
- 見られる人・行の制限: registry: system-sites-tab-sites。既定は社員以上、通知先の保存は super_admin 限定。
- 結果の開き先: サイト一覧の site_key の通知先小窓。
- 保存経路・根拠: SiteNotifyEditor.tsx → notify-actions.ts:saveNotifyRecipients → replace_site_notify_recipients RPC → system_site_notify_recipients。supabase/migrations/20261029000487_site_notify_recipients.sql。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0376|通知先|選ぶ欄|system_site_notify_recipients.employee_id（site_key ごと）|通常|

### System / LINE 管理 / 配信・タグ・あいさつ

- URL: `/system/line`
- 見られる人・行の制限: registry に LINE 専用 scope はない。src/lib/line/tags.server.ts:requireLineAdmin（全権管理者のみ）と src/app/system/line/page.tsx の条件を使用。
- 結果の開き先: 配信履歴 id / タグ id / あいさつ id を該当する画面内の一覧から開く。
- 保存経路・根拠: LineManager.tsx → /api/system/line/manage → system_line_broadcast / system_line_tag / system_line_tag_member / system_line_greeting。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0377|題名|文字|system_line_broadcast.title|通常|
|F0378|送る文|文字|system_line_broadcast.body|通常|
|F0379|送り先のタグ|選ぶ欄|system_line_broadcast.tag_ids|通常|
|F0380|タグの名前|文字|system_line_tag.name|通常|
|F0381|自由タグ|選ぶ欄|system_line_tag_member.tag_id|通常|
|F0382|雇用形態|選ぶ欄|system_line_greeting.employment_tag_id|通常|
|F0383|事業|選ぶ欄|system_line_greeting.business_tag_id|通常|
|F0384|あいさつ文|文字|system_line_greeting.body|通常|
|F0385|有効|選ぶ欄|system_line_greeting.enabled|通常|

### System / LINE 管理 / 連絡先・担当・グループ

- URL: `/system/line`
- 見られる人・行の制限: requireLineAdmin（src/lib/line/tags.server.ts、全権管理者のみ）。連絡先は Root の従業員の在籍状態も確認する。
- 結果の開き先: 連絡先 key、役割 key、グループ id の小窓。
- 保存経路・根拠: ContactSettings.tsx / RichMenuSettings.tsx / GroupSettings.tsx → /api/system/line/manage、/api/system/line/groups。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0386|氏名|選ぶ欄|root_employees.employee_id（選択対象、リンク保存時の行を指定）|通常|
|F0387|連絡先のリンク|文字|root_employees.line_contact_url（従業員）、system_line_contact.url（guest_home）|通常|
|F0388|担当|選ぶ欄|system_line_contact.employee_id（役割 key ごと）|通常|
|F0389|グループの名前|文字|system_line_target.label|通常|
|F0390|知らせ先の Chatwork ルームの番号|文字|system_line_target.chatwork_room_id|通常|
|F0391|知らせ|選ぶ欄|system_line_target.notify_enabled|通常|

### System / 管理表ポータル / 手入力・月次設定

- URL: `/system/kanri?tab=settings（管理表・実績管理・アポラン・訪問販売・インセ計算・給与試算でも入力）`
- 見られる人・行の制限: registry: system-kanri-view、system-kanri-tab-settings / kanri / jisseki / aporan / houhan / incentive（責任者以上）。payroll タブは社員以上。保存 API は settings の閲覧と requireManager。
- 結果の開き先: 対象年月を選び、同じタブ・チーム・人・日付のセル。sheet=inputs の run_id は当月の最新 run に関連。
- 保存経路・根拠: KanriPortalClient.tsx → PUT /api/system/kanri/inputs/[yearMonth] → system_kanri_result.upsert({run_id,sheet:inputs,grid:body.inputs})。JSON の細部は KanriManualInputs の型を参照。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0392|着地稼働時間|数字|system_kanri_result.grid → hoursByTeamByDate[team][date]|通常|
|F0393|開通率|数字|system_kanri_result.grid → openRateByTeamByProduct[team][product]|通常|
|F0394|チームの目標ポイント|数字|system_kanri_result.grid → monthlySettings.targetPointsByTeam[team]|通常|
|F0395|目標ポイント|数字|system_kanri_result.grid → monthlySettings.incentive.targetPoints|通常|
|F0396|達成賞金総額|金額|system_kanri_result.grid → monthlySettings.incentive.achievementBonusTotal|通常|
|F0397|チーム勝利賞金|金額|system_kanri_result.grid → monthlySettings.incentive.teamVictoryBonus|通常|
|F0398|個人 / 着地稼働時間|数字|system_kanri_result.grid → personMonthly[name].landingHours|通常|
|F0399|個人 / 稼働時間|数字|system_kanri_result.grid → personMonthly[name].workHours|通常|
|F0400|個人 / 稼働日数|数字|system_kanri_result.grid → personMonthly[name].workDays|通常|
|F0401|アポラン目標|数字|system_kanri_result.grid → monthlySettings.aporanTargets[key]|通常|
|F0402|基本時給|金額|system_kanri_result.grid → monthlySettings.payroll.baseWage|通常|
|F0403|研修時給|金額|system_kanri_result.grid → monthlySettings.payroll.trainingWage|通常|
|F0404|翌月区分|文字|system_kanri_result.grid → payrollByPerson[name].nextStatus|通常|
|F0405|時給調整|金額|system_kanri_result.grid → payrollByPerson[name].wageAdjustment|通常|
|F0406|紹介ポイント|数字|system_kanri_result.grid → payrollByPerson[name].referralPoints|通常|
|F0407|研修時間|数字|system_kanri_result.grid → payrollByPerson[name].trainingHours|通常|
|F0408|入社祝い金|金額|system_kanri_result.grid → payrollByPerson[name].hiringBonus|通常|
|F0409|人材紹介インセ|金額|system_kanri_result.grid → payrollByPerson[name].talentReferralIncentive|通常|
|F0410|獲得インセ|金額|system_kanri_result.grid → payrollByPerson[name].dealIncentive|通常|
|F0411|訪問販売 / 商材の重み|数字|system_kanri_result.grid → fieldSales.weights[product]|通常|
|F0412|訪問販売 / 出勤状況|選ぶ欄|system_kanri_result.grid → fieldSales.byPerson[name].days[date].status|通常|
|F0413|訪問販売 / 稼働時間|数字|system_kanri_result.grid → fieldSales.byPerson[name].days[date].hours|通常|
|F0414|訪問販売 / 手入力実績|数字|system_kanri_result.grid → fieldSales.byPerson[name].days[date].rental / sales|通常|
|F0415|KOT / 時間の基準|選ぶ欄|system_kanri_result.grid → monthlySettings.kot.hoursBasis|通常|
|F0416|KOT / 派遣を含める氏名|文字|system_kanri_result.grid → monthlySettings.kot.includeDispatchNames|通常|

### System / 管理表ポータル / 人員設定・休業日

- URL: `/system/kanri?tab=settings`
- 見られる人・行の制限: registry: system-kanri-tab-settings、責任者以上。
- 結果の開き先: 対象年月の設定 / 人員の name または id の行。
- 保存経路・根拠: KanriPortalClient.tsx → /api/system/kanri/people、month-settings/[yearMonth] → system_kanri_person / system_kanri_month_setting.upsert。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0417|氏名|文字|system_kanri_person.name|通常|
|F0418|KOT 氏名|文字|system_kanri_person.kot_name|通常|
|F0419|チーム|選ぶ欄|system_kanri_person.team|通常|
|F0420|部署|文字|system_kanri_person.department|通常|
|F0421|雇用区分|選ぶ欄|system_kanri_person.employment_kind|通常|
|F0422|基本時給|金額|system_kanri_person.base_wage|通常|
|F0423|訪問販売|選ぶ欄|system_kanri_person.is_field_sales|通常|
|F0424|有効|選ぶ欄|system_kanri_person.active|通常|
|F0425|休業日|日付（複数）|system_kanri_month_setting.holidays|通常|

### System・Soil / リストマスタ / 保存した検索条件

- URL: `/system/list?tab=list`
- 見られる人・行の制限: registry: system-list-page / system-list-tab-list、既定は責任者以上。requireSoilListUser。取り込みデータ自体は対象外。
- 結果の開き先: 保存条件 id を選択してリスト画面の条件を復元する。
- 保存経路・根拠: ListMasterClient.tsx → /api/soil/list/conditions → soil_list_condition.insert({name,condition,...})。条件は normalizeConditionPayload が受け付ける JSON。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0426|条件名|文字|soil_list_condition.name|通常|

### System・Soil / リストマスタ / 自社アポ禁・区分の手入力

- URL: `/system/list?tab=internal-block（区分は tab=list）`
- 見られる人・行の制限: registry: system-list-tab-internal-block / system-list-tab-list。既定は責任者以上。
- 結果の開き先: 自社アポ禁 id の行、解除済み表示を切り替える。区分変更は電話番号の行を再表示。rowToken は内部の署名トークンで検索対象外。
- 保存経路・根拠: /api/soil/list/internal-block と [id]、phones/category → soil_list_internal_block / soil_list_phone.update。取り込み元の同名欄と画面由来を区別する。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0427|電話番号|文字|soil_list_internal_block.電話番号|通常|
|F0428|理由|文字|soil_list_internal_block.理由|通常|
|F0429|解除理由|文字|soil_list_internal_block.解除理由|通常|
|F0430|区分|選ぶ欄|soil_list_phone.区分（区分_判定元=手入力）|通常|

### System / マニュアル / 差し替え

- URL: `/system/manuals/[moduleSlug]/[slug]`
- 見られる人・行の制限: registry: system-manual-doc-<key> と manual のタブ。差し替えは manuals-api.ts の管理者条件を併用。
- 結果の開き先: 該当ドキュメントの file と versions の版。PDF 等の元ファイルを開く。
- 保存経路・根拠: ManualDetailClient.tsx → /api/system/manuals/.../replace → manuals-api.ts → system_manual_versions.insert、Storage。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0431|差し替えるファイル|ファイル|system_manual_versions.storage_path / file（本文バイナリは Storage）|通常|

### System（共通） / 閲覧設定

- URL: `各画面右上の閲覧設定ボタン`
- 見られる人・行の制限: registry: 各画面・タブの key。閲覧者による追加は viewers_can_add、全権管理者の変更など API と RPC の制限に従う。
- 結果の開き先: 元の page_key / tab_key の閲覧設定小窓。
- 保存経路・根拠: ViewPermissionButton.tsx → /api/system/view-permissions → system_save_view_permission / system_add_viewer RPC。supabase/migrations/20261026000002_system_view_permissions.sql。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0432|見られる役職|選ぶ欄|system_view_permissions.roles|通常|
|F0433|見られる人|選ぶ欄|system_view_permissions.employee_ids|通常|
|F0434|閲覧者も追加できる|選ぶ欄|system_view_permissions.viewers_can_add|通常|

### Bud・M / 経費精算 / 承認待ち・完了待ち・仕訳待ち

- URL: `/bud/expenses?tab=submit（approve / booking）、/m/bud/submit`
- 見られる人・行の制限: registry: bud-expenses-view / bud-expenses-tab-submit。既定は社員以上に bud_has_access（Bud 登録）が必要。閲覧設定だけの追加者に書き込み権限を与えない。スマホ提出は本人の applicant_employee_id。Bud 内の編集は経理アクセスと削除済み等のタブ制限を適用。法人の付け替えは全権管理者のみ。
- 結果の開き先: /bud/expenses で tab と id の行を合わせて表示。スマホでは本人の経費行の詳細。
- 保存経路・根拠: ExpenseReviewPanel.tsx → bud_expense_requests.update（入力後の下書き保存もある）。ExpenseFinalPanel.tsx → 同表.update。ExpenseBookingPanel.tsx → /api/bud/expense-booking/booking-info → bud_complete_expense_booking RPC。M は page.tsx → insert。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0435|経費の種類|選ぶ欄|bud_expense_requests.expense_kind|通常|
|F0436|申請法人|選ぶ欄|bud_expense_requests.corp_id|通常|
|F0437|領収日|日付|bud_expense_requests.receipt_date|通常|
|F0438|領収時刻|日付（時刻）|bud_expense_requests.receipt_time|通常|
|F0439|店名|文字|bud_expense_requests.store_name|通常|
|F0440|金額|金額|bud_expense_requests.amount|通常|
|F0441|適格区分|選ぶ欄|bud_expense_requests.qualified_class|通常|
|F0442|登録番号|文字|bud_expense_requests.qualified_number|通常|
|F0443|経費区分|選ぶ欄|bud_expense_requests.category_id|通常|
|F0444|内容|文字|bud_expense_requests.description|通常|
|F0445|領収書の向き（回転操作）|数字|bud_expense_requests.receipt_rotation|通常|
|F0446|差戻し理由|文字|bud_expense_requests.return_reason|通常|
|F0447|仕分け日|日付|bud_expense_requests.booking_date|通常|
|F0448|仕分け法人名|選ぶ欄|bud_expense_requests.booking_corp_id|通常|
|F0449|決算区分の上書き|文字|bud_expense_requests.fiscal_period|通常|
|F0450|領収書の写真 / ファイル|ファイル|bud_expense_requests.storage_path|通常|

### Bud / 振込管理 / 通常振込の新規・下書き

- URL: `/bud/transfers/new-regular`
- 見られる人・行の制限: registry: bud-transfers-view。既定は社員以上に bud_has_access（Bud 登録）が必要。閲覧設定だけの追加者に書き込み権限を与えない。作成者・担当法人などの RLS は bud_transfers の migration に従う。承認操作は別の役職判定。
- 結果の開き先: /bud/transfers/[transfer_id] で対象の振込詳細。元のフォームは新規作成用。
- 保存経路・根拠: TransferFormRegular.tsx / BankPicker / VendorPicker / AttachmentUploader → createTransfer（transfer-mutations.ts）→ bud_transfers.insert(paymentPayload)。添付は Storage、URL を列に保存。OCR を編集して確定する値は対象。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0451|データソース|選ぶ欄|bud_transfers.data_source|通常|
|F0452|支払区分|選ぶ欄|bud_transfers.payment_category|通常|
|F0453|依頼会社（実行会社の入力から同時設定）|選ぶ欄|bud_transfers.request_company_id|通常|
|F0454|実行会社|選ぶ欄|bud_transfers.execute_company_id|通常|
|F0455|支払元口座|選ぶ欄|bud_transfers.source_account_id|通常|
|F0456|振込先|選ぶ欄|bud_transfers.vendor_id|通常|
|F0457|お支払い先|文字|bud_transfers.payee_name|通常|
|F0458|銀行名|文字|bud_transfers.payee_bank_name|通常|
|F0459|銀行コード|文字|bud_transfers.payee_bank_code|通常|
|F0460|支店名|文字|bud_transfers.payee_branch_name|通常|
|F0461|支店コード|文字|bud_transfers.payee_branch_code|通常|
|F0462|口座種別|選ぶ欄|bud_transfers.payee_account_type|通常|
|F0463|口座番号|文字|bud_transfers.payee_account_number|探さない：口座番号|
|F0464|口座名義カナ|文字|bud_transfers.payee_account_holder_kana|通常|
|F0465|登録済み支払方法|選ぶ欄|bud_transfers.registered_method|通常|
|F0466|収納機関番号|文字|bud_transfers.payeasy_biller_no|通常|
|F0467|お客様番号|文字|bud_transfers.payeasy_customer_no|通常|
|F0468|確認番号|文字|bud_transfers.payeasy_confirm_no|探さない：支払いの確認番号|
|F0469|金額|金額|bud_transfers.amount|通常|
|F0470|手数料負担|選ぶ欄|bud_transfers.fee_bearer|通常|
|F0471|振込予定日|日付|bud_transfers.scheduled_date|通常|
|F0472|支払期日|日付|bud_transfers.due_date|通常|
|F0473|備考|文字|bud_transfers.description|通常|
|F0474|請求書 PDF|ファイル|bud_transfers.invoice_pdf_url|通常|
|F0475|スキャン画像|ファイル|bud_transfers.scan_image_url|通常|

### Bud / 振込管理 / キャッシュバック

- URL: `/bud/transfers/new-cashback`
- 見られる人・行の制限: registry: bud-transfers-view。既定は社員以上に bud_has_access（Bud 登録）が必要。閲覧設定だけの追加者に書き込み権限を与えない。
- 結果の開き先: 保存した transfer_id の /bud/transfers/[transfer_id]。
- 保存経路・根拠: TransferFormCashback.tsx → createTransfer → bud_transfers.insert。申込者名は payee_name にも利用。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0476|データソース|選ぶ欄|bud_transfers.data_source|通常|
|F0477|申込者名|文字|bud_transfers.cashback_applicant_name|通常|
|F0478|申込者名カナ|文字|bud_transfers.cashback_applicant_name_kana|通常|
|F0479|電話番号（任意）|文字|bud_transfers.cashback_applicant_phone|通常|
|F0480|商材名|文字|bud_transfers.cashback_product_name|通常|
|F0481|商流名|文字|bud_transfers.cashback_channel_name|通常|
|F0482|銀行名|文字|bud_transfers.payee_bank_name|通常|
|F0483|銀行コード|文字|bud_transfers.payee_bank_code|通常|
|F0484|支店名|文字|bud_transfers.payee_branch_name|通常|
|F0485|支店コード|文字|bud_transfers.payee_branch_code|通常|
|F0486|口座種別|選ぶ欄|bud_transfers.payee_account_type|通常|
|F0487|口座番号|文字|bud_transfers.payee_account_number|探さない：口座番号|
|F0488|口座名義カナ|文字|bud_transfers.payee_account_holder_kana|通常|
|F0489|金額|金額|bud_transfers.amount|通常|
|F0490|振込予定日|日付|bud_transfers.scheduled_date|通常|
|F0491|支払期日|日付|bud_transfers.due_date|通常|
|F0492|備考|文字|bud_transfers.description|通常|

### Bud / 振込先を追加

- URL: `/bud/transfers/new-regular（振込先の小窓）`
- 見られる人・行の制限: registry: bud-transfers-view / bud-transfers-tab-master。既定は社員以上に bud_has_access（Bud 登録）が必要。閲覧設定だけの追加者に書き込み権限を与えない。
- 結果の開き先: 保存した取引先を VendorPicker で選び、振込詳細またはマスタの行を開く。
- 保存経路・根拠: NewVendorModal.tsx → root_vendors.insert。Root 取引先画面と payee_* の列名が異なる経路なので同じ列と決めつけない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0493|取引先名|文字|root_vendors.vendor_name|通常|
|F0494|銀行名|文字|root_vendors.payee_bank_name|通常|
|F0495|銀行コード|文字|root_vendors.payee_bank_code|通常|
|F0496|支店名|文字|root_vendors.payee_branch_name|通常|
|F0497|支店コード|文字|root_vendors.payee_branch_code|通常|
|F0498|口座種別|選ぶ欄|root_vendors.payee_account_type|通常|
|F0499|口座番号|文字|root_vendors.payee_account_number|探さない：口座番号|
|F0500|口座名義カナ|文字|root_vendors.payee_account_holder_kana|通常|

### Bud / 振込管理 / 承認・支払い確認

- URL: `/bud/transfers?tab=approval（振込詳細からも操作）`
- 見られる人・行の制限: registry: bud-transfers-view / bud-transfers-tab-approval。既定は社員以上に bud_has_access（Bud 登録）が必要。閲覧設定だけの追加者に書き込み権限を与えない。承認者の役割とステータス遷移を別途検証。
- 結果の開き先: /bud/transfers/[transfer_id]。
- 保存経路・根拠: TransferApprovalPanel.tsx → bud_transfers.update、transfer-mutations.ts → bud_transition_transfer_status RPC。PaymentCategoryPanel の支払済み操作 → manual_paid_at.update。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0501|差戻し理由|文字|bud_transfers.rejection_reason|通常|
|F0502|支払済み（確認操作）|日付（操作時刻）|bud_transfers.manual_paid_at|通常|

### Bud / 明細 / 手動紐付け

- URL: `/bud/statements`
- 見られる人・行の制限: registry: bud-statements-view / bud-statements-tab-list。既定は社員以上に bud_has_access（Bud 登録）が必要。閲覧設定だけの追加者に書き込み権限を与えない。
- 結果の開き先: 明細 id の ManualAssignModal、matched_transfer_id の振込詳細。
- 保存経路・根拠: ManualAssignModal.tsx → bud_statements.update。取り込んだ明細本文は対象外、手入力の紐付けのみ対象。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0503|振込を選ぶ|選ぶ欄|bud_statements.matched_transfer_id|通常|

### Bud / 銀行口座・カード / 設定

- URL: `/bud/bank`
- 見られる人・行の制限: permission-registry.ts の bud-pages に bank は含まれず、専用 registry key はない。src/lib/bud/mf/access.ts:mfAccess → bud_has_access。全権管理者または口座・グループの visible_employee_ids / employee_ids を満たす人だけ。編集は全権管理者。
- 結果の開き先: /bud/bank/accounts/[id] または /bud/bank の mf_account_id の設定小窓。
- 保存経路・根拠: BankAccounts.tsx → PATCH /api/bud/mf-accounts → bud_mf_save_settings / bud_mf_save_group_viewers / bud_mf_reorder / bud_mf_reorder_axis RPC。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0504|メールの口座名|文字|bud_mf_accounts.mail_alias|通常|
|F0505|非表示|選ぶ欄|bud_mf_accounts.hidden|通常|
|F0506|帳簿の補助科目名|文字|bud_mf_accounts.book_sub_account_name|通常|
|F0507|残高の扱い|選ぶ欄|bud_mf_accounts.balance_mode|通常|
|F0508|基準残高|金額|bud_mf_accounts.anchor_balance|通常|
|F0509|基準時刻|日付|bud_mf_accounts.anchor_at|通常|
|F0510|基準日|日付|bud_mf_accounts.anchor_date|通常|
|F0511|メモ|文字|bud_mf_accounts.balance_note|通常|
|F0512|見られる人（口座）|選ぶ欄|bud_mf_accounts.visible_employee_ids|通常|
|F0513|口座の並び（移動操作）|数字|bud_mf_accounts.sort_order|通常|
|F0514|見られる人（銀行 / カード全体）|選ぶ欄|bud_mf_group_viewers.employee_ids|通常|
|F0515|法人 / 銀行の並び（移動操作）|数字|bud_mf_axis_order.sort_order|通常|

### Bud / 損益管理 / ブロードバンド / 閲覧者

- URL: `/bud/profit/broadband`
- 見られる人・行の制限: registry に専用 key はない。broadbandAccess → bud_bb_can_view、bud_bb_viewers の employee_ids。設定編集は全権管理者。
- 結果の開き先: /bud/profit/broadband の閲覧者の小窓。
- 保存経路・根拠: BroadbandTable.tsx → /api/bud/broadband/viewers → bud_bb_save_viewers RPC。取り込んだ契約・照合情報は対象外。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0516|閲覧者|選ぶ欄|bud_bb_viewers.employee_ids|通常|

### Sprout / 掲載管理 / バイトル

- URL: `/sprout/postings?tab=baitoru`
- 見られる人・行の制限: registry: sprout-postings-view（既定は社員以上の入口）、sprout-postings-tab-baitoru（実データは全権管理者）。書き込みは requireSproutUser。
- 結果の開き先: 掲載 id 行 / 設定フォーム。
- 保存経路・根拠: baitoru-panel.tsx → baitoru-actions.ts → queryPg の INSERT / UPDATE。取り込んだ応募者の表は対象外。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0517|掲載期間の開始|日付|sprout_baitoru_postings.start_date|通常|
|F0518|掲載期間の終了|日付|sprout_baitoru_postings.end_date|通常|
|F0519|掲載内容|選ぶ欄|sprout_baitoru_postings.content|通常|
|F0520|掲載内容の選択肢 / 追加する文字|文字|sprout_baitoru_settings.content_options|通常|
|F0521|今回だけ除外する問合せ番号（カンマ区切り）|文字|sprout_baitoru_settings.exclude_inquiry_nos|通常|
|F0522|通知先|選ぶ欄|sprout_baitoru_settings.notify_room|通常|
|F0523|通知の宛先|選ぶ欄|sprout_baitoru_settings.mention_employee_ids|通常|
|F0524|1回に登録する上限|数字|sprout_baitoru_settings.max_per_run|通常|

### Rill / メッセージ / 新規・返信・転送

- URL: `/rill/mail`
- 見られる人・行の制限: registry: rill-mail-view、rill-mail-tab-all / flagged / me / sent / shared（既定は管理者以上）。編集は requireRillWrite（admin / super_admin）。メール箱アクセスは server-auth / view-access.server.ts / access.ts を併用。
- 結果の開き先: /rill/mail で対象 box と message id の送信済みメールを開く。存在未確認の id クエリリンクを作らない。
- 保存経路・根拠: RillComposePane.tsx → /api/rill/mail/compose/send → _lib/graph.ts:sendComposeMessage の Graph 送信（入力検証は compose.ts）。本文の Supabase 保存列はない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0525|宛先|文字|外部 Microsoft Graph メッセージ.toRecipients|通常|
|F0526|CC|文字|外部 Microsoft Graph メッセージ.ccRecipients|通常|
|F0527|件名|文字|外部 Microsoft Graph メッセージ.subject|通常|
|F0528|本文|文字|外部 Microsoft Graph メッセージ.body.content|通常|
|F0529|添付ファイル|ファイル|外部 Microsoft Graph メッセージ.attachments|通常|

### Rill / メッセージ / 周知の準備

- URL: `/rill/mail`
- 見られる人・行の制限: registry: rill-mail の許可タブと box の権限。書き込みは requireRillWrite（管理者以上）。
- 結果の開き先: 元の box / message_id の添付 → Garden取込 → intake.id の周知を開く。
- 保存経路・根拠: RillMailScreen.tsx → /api/rill/mail/intake/notice → garden_intake_items.update({notice_text})。添付の取り込み表そのものを丸ごと検索対象にしない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0530|営業担当|文字|garden_intake_items.notice_text（周知テンプレートに合成）|通常|
|F0531|案件名|文字|garden_intake_items.notice_text（周知テンプレートに合成）|通常|
|F0532|周知文|文字|garden_intake_items.notice_text|通常|

### Bloom / 月次まとめの編集

- URL: `/bloom/monthly-digest/[month]/edit`
- 見られる人・行の制限: registry に直接の展開なし。scope: bloom-monthly-digest-edit（既定は管理者以上）、閲覧は月次まとめの scope と DB RLS。
- 結果の開き先: month のまとめ / 編集ページ。JSON のページは配列 index / kind で位置を示す。
- 保存経路・根拠: edit/page.tsx → digest-queries.ts:updateDigest → bloom_monthly_digests.update。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0533|タイトル|文字|bloom_monthly_digests.title|通常|
|F0534|サマリ|文字|bloom_monthly_digests.summary|通常|
|F0535|追加するページの種類|選ぶ欄|bloom_monthly_digests.pages → [].kind|通常|
|F0536|ページのタイトル|文字|bloom_monthly_digests.pages → [].title|通常|
|F0537|ページの本文|文字|bloom_monthly_digests.pages → [].body|通常|
|F0538|画像 URL|文字|bloom_monthly_digests.pages → [].image_url|通常|

### Bloom / ワークボード / 今日の予定

- URL: `/bloom/workboard?tab=today`
- 見られる人・行の制限: registry に直接の展開なし。scope: bloom-workboard（既定は社員以上）。更新対象は認証 user_id の本人。読める範囲は画面 scope と bloom_daily_logs の RLS の両方。
- 結果の開き先: /bloom/workboard の user_id・log_date の予定。
- 保存経路・根拠: TodayPlanList.tsx → workboard/_lib/mutations.ts:upsertTodayPlannedItems → bloom_daily_logs.upsert。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0539|今日やること|文字|bloom_daily_logs.planned_items → [].title|通常|
|F0540|完了|選ぶ欄|bloom_daily_logs.planned_items → [].done_bool|通常|

### Bloom / 東海林さんの状況

- URL: `/bloom/workboard/ceo-status`
- 見られる人・行の制限: registry に直接の展開なし。scope: bloom-workboard-ceo-status（入口の既定は社員以上）、変更は isSuperAdmin と /api/ceo-status の全権管理者判定。
- 結果の開き先: 元の状況画面、単一行の現在値。
- 保存経路・根拠: CeoStatusEditor.tsx → /api/ceo-status → bloom_ceo_status.update。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0541|対応可能 / 取り込み中 / 集中業務中 / 外出中|選ぶ欄|bloom_ceo_status.status|通常|
|F0542|メモ（200字以内）|文字|bloom_ceo_status.summary|通常|

### Forest / 進行期 / 数値更新・期の切り替え

- URL: `/forest/shinkouki/[companyId]（/forest/shinkouki からも操作）`
- 見られる人・行の制限: registry に直接の展開なし。scope: forest-shinkouki / forest-shinkouki-company（既定は責任者以上）。変更は Forest の admin 条件と RLS。
- 結果の開き先: companyId の進行期。確定済み期は company_id と ki / yr の決算書行を開く。
- 保存経路・根拠: NumberUpdateForm.tsx / PeriodRolloverForm.tsx → forest/_lib/mutations.ts → shinkouki.update、fiscal_periods.insert。PDF 読み取りは値の下書き反映で、元 PDF の保存とは別。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0543|売上高（円）|金額|shinkouki.uriage|通常|
|F0544|外注費（円）|金額|shinkouki.gaichuhi|通常|
|F0545|利益（円、赤字は負の値）|金額|shinkouki.rieki|通常|
|F0546|反映済み期間|文字|shinkouki.reflected|通常|
|F0547|暫定 / 確定|選ぶ欄|shinkouki.zantei|通常|
|F0548|純資産|金額|fiscal_periods.junshisan|通常|
|F0549|現金|金額|fiscal_periods.genkin|通常|
|F0550|預金|金額|fiscal_periods.yokin|通常|
|F0551|決算書 URL|文字|fiscal_periods.doc_url|通常|

### Tree / 通話画面 / 手入力の結果・メモ

- URL: `/tree/call`
- 見られる人・行の制限: registry に直接の展開なし。scope: tree-call（既定は全役職）、toss / confirm タブ。insertCall は employee_id=本人。通話履歴全体を検索対象にせず、手入力部分の扱いは未確定事項を参照。
- 結果の開き先: /tree/call は架電中の状態を表示するため、過去 call_id の再現経路は未実装。検索採用前に閲覧用の開き先が必要。
- 保存経路・根拠: tree/call/page.tsx → tree/_lib/queries.ts:insertCall → soil_call_history.insert。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0552|結果コード|選ぶ欄|soil_call_history.result_code|通常|
|F0553|続柄|選ぶ欄|soil_call_history.relationship|通常|
|F0554|トス先クローザー|選ぶ欄|soil_call_history.toss_to_id|通常|
|F0555|次回の日付・時刻（見込 / コイン）|日付|soil_call_history.next_contact_at|通常|
|F0556|NG その他の理由|文字|soil_call_history.ng_reason|通常|
|F0557|架電メモ|文字|soil_call_history.memo|通常|

### Tree / 誕生日

- URL: `/tree/birthday`
- 見られる人・行の制限: registry に直接の展開なし。scope: tree-birthday（既定は全役職）。本人の user_id だけ更新。
- 結果の開き先: 本人の誕生日画面。
- 保存経路・根拠: tree/birthday/page.tsx → updateBirthday → root_employees.update。MMDD パスワード更新は /api/tree/update-password → Supabase Auth の別処理。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0558|誕生日|日付|root_employees.birthday|探さない：認証パスワードの材料にもなるため、この入口由来の検索採用は保留・探さない|

### P / パートナーポータル / 新規トス

- URL: `/p/toss/new`
- 見られる人・行の制限: registry に専用 key はない。PartnerGate、src/app/p/_lib/server-auth.ts:requirePartnerOrStaff。partner はセッションの partnerCode、staff は tossPartnerCode または入力値。ボード閲覧は partner / mine の条件を再適用。
- 結果の開き先: /p/toss/board の Kintone recordId 行。ボードは read-only。PD など取り込み表示欄を検索対象と混同しない。
- 保存経路・根拠: TossForm.tsx → /api/toss/submit → buildTossRecord（p/toss/_lib/form.ts）→ kintone.server.ts:addRecord。KINTONE_TOSSUP_APP_ID の外部 Kintone アプリ。partnerCode=9999999 は保存しないデモ。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0559|キャッシュバック有無|選ぶ欄|外部 Kintone（トスアップ）.ドロップダウン_2|通常|
|F0560|キャッシュバック金額|金額|外部 Kintone（トスアップ）.数値_0|通常|
|F0561|トス商材|選ぶ欄|外部 Kintone（トスアップ）.チェックボックス|通常|
|F0562|トス者コメント|文字|外部 Kintone（トスアップ）.文字列__複数行_|通常|
|F0563|トスランク|選ぶ欄|外部 Kintone（トスアップ）.ドロップダウン_3|通常|
|F0564|連絡希望時間帯|選ぶ欄|外部 Kintone（トスアップ）.チェックボックス_1|通常|
|F0565|関電リスト区分|選ぶ欄|外部 Kintone（トスアップ）.ドロップダウン_1|通常|
|F0566|PD管理番号|文字|外部 Kintone（トスアップ）.ルックアップ_0|通常|
|F0567|申込者区分|選ぶ欄|外部 Kintone（トスアップ）.ドロップダウン_8|通常|
|F0568|申込者 姓|文字|外部 Kintone（トスアップ）.文字列__1行__4|通常|
|F0569|申込者 名|文字|外部 Kintone（トスアップ）.文字列__1行__5|通常|
|F0570|申込者 セイ|文字|外部 Kintone（トスアップ）.文字列__1行__2|通常|
|F0571|申込者 メイ|文字|外部 Kintone（トスアップ）.文字列__1行__3|通常|
|F0572|生年月日|日付|外部 Kintone（トスアップ）.日付_3|通常|
|F0573|住所区分|選ぶ欄|外部 Kintone（トスアップ）.ドロップダウン_12|通常|
|F0574|郵便番号|文字|外部 Kintone（トスアップ）.文字列__1行__8|通常|
|F0575|都道府県|文字|外部 Kintone（トスアップ）.文字列__1行__17|通常|
|F0576|市区町村|文字|外部 Kintone（トスアップ）.文字列__1行__16|通常|
|F0577|町域・番地|文字|外部 Kintone（トスアップ）.文字列__1行__15|通常|
|F0578|建物名|文字|外部 Kintone（トスアップ）.文字列__1行__9|通常|
|F0579|部屋番号|文字|外部 Kintone（トスアップ）.文字列__1行__18|通常|
|F0580|連絡先区分|選ぶ欄|外部 Kintone（トスアップ）.ドロップダウン_10|通常|
|F0581|連絡先電話番号|文字|外部 Kintone（トスアップ）.文字列__1行__33|通常|
|F0582|スマホキャリア|選ぶ欄|外部 Kintone（トスアップ）.ドロップダウン_9|通常|
|F0583|パートナーコード（社員が入力する場合）|文字|外部 Kintone（トスアップ）.ルックアップ|通常|

### System・My / 勤怠打刻 / 内線番号

- URL: `/system/attendance（/my?tab=attendance も共有）`
- 見られる人・行の制限: registry: system-attendance-view / api-require-employee。本人の employee_id の予約。出勤打刻が必要な対象者のみ入力する。
- 結果の開き先: 本人の今日の内線 / 通話・録音画面。work_date と employee_id の有効な予約区間を使う。
- 保存経路・根拠: AttendanceClient.tsx → /api/system/attendance/punch → lib/innovera/daily-extension.ts:reserveDailyExtensionForClockIn → system_innovera_daily_extension.insert。打刻時刻自体は自動なので入力欄に含めない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0584|今日の内線番号|文字|system_innovera_daily_extension.extension|通常|

### System・My / 通話・録音 / 内線変更と発信番号変更

- URL: `/system/innovera-calls（/my?tab=calls）`
- 見られる人・行の制限: registry: calls.own / calls.view_all / calls.play_all、system-innovera-calls-view。本人の内線区間の制限あり。内線変更は管理者認証を追加、発信番号変更は API の許可対象を検証する。
- 結果の開き先: 自分の今日の内線セクション / 発信番号セクション。
- 保存経路・根拠: InnoveraCallsClient.tsx → /api/system/innovera-calls/daily-extension/change → system_innovera_daily_extension.insert。発信番号は /line → 外部 INNOVERA API を更新、変更ログは自動記録として除外。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0585|新しい内線番号|文字|system_innovera_daily_extension.extension|通常|
|F0586|変更後の発信番号|選ぶ欄|外部 INNOVERA ユーザーの circuit（API の選択 id）|通常|

### System・My / 前確依頼

- URL: `/my?tab=zenkaku（/system/mypage?tab=zenkaku の共通 ZenkakuTab）`
- 見られる人・行の制限: registry: system-zenkaku-view、本人の requested_by=auth.user.id。続行時にも自分の submission.id を確認。
- 結果の開き先: 前確依頼のチェック結果 / submission.id の依頼状況。元の営業IDを入力して状態を確認できる。過去 id の専用詳細 URL はない。
- 保存経路・根拠: ZenkakuTab.tsx → /api/system/zenkaku-check → system_zenkaku_check_request.insert。/api/system/zenkaku-submit → system_zenkaku_submission.insert/update。エージェントが取得する契約詳細の全項目は人の入力欄ではない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0587|営業ID|文字|system_zenkaku_check_request.sales_id（依頼時は system_zenkaku_submission.sales_id に引き継ぎ）|通常|
|F0588|依頼するチーム（候補）|選ぶ欄|system_zenkaku_submission.selected_partner_code|通常|
|F0589|重複を確認して続ける|選ぶ欄|system_zenkaku_submission.duplicate_confirmed|通常|

### Root / 従業員マスタ / KING OF TIME の変更

- URL: `/root/employees`
- 見られる人・行の制限: registry: root-employees-view に加え、[employeeId]/kot API の authorize は全権管理者のみ。KOT_EMPLOYEE_UPDATE_ENABLED が true の場合だけ変更可。
- 結果の開き先: employee_id 行の KING OF TIME パネル。
- 保存経路・根拠: KotEmployeePanel.tsx → /api/root/employees/[employeeId]/kot → updateKotEmployee。主保存先は外部 KOT。root_audit_log は自動監査なので検索用表に数えない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0590|変更後の所属|選ぶ欄|外部 KING OF TIME 従業員.divisionCode|通常|
|F0591|変更後の雇用区分|選ぶ欄|外部 KING OF TIME 従業員.typeCode|通常|
|F0592|変更日|日付|外部 KING OF TIME 更新 API.updateDate|通常|

### System・Soil / リストマスタ / 保存条件の各入力項目

- URL: `/system/list?tab=list`
- 見られる人・行の制限: registry: system-list-page / system-list-tab-list、既定は責任者以上。保存を押した条件だけが永続化する。
- 結果の開き先: 条件 id を選んで復元。日付・回数・複数選択は同じ条件 JSON 内の要素。
- 保存経路・根拠: ListMasterClient.tsx:filtersToCondition（543行以降）→ /api/soil/list/conditions → soil_list_condition.condition。元の顧客台帳の列を検索対象に加える根拠にはならない。

|番号|入力欄の見出し|種類|保存先の表.列（JSON はパス）|秘密の扱い|
|---|---|---|---|---|
|F0593|都道府県|選ぶ欄|soil_list_condition.condition → filters[]（field=prefecture）.value|通常|
|F0594|AU光架電可否|選ぶ欄|soil_list_condition.condition → filters[]（field=auCallAvailability）.value|通常|
|F0595|購入状態|選ぶ欄|soil_list_condition.condition → filters[]（field=purchaseStatus）.value|通常|
|F0596|購入業者|選ぶ欄|soil_list_condition.condition → filters[]（field=latestVendor）.value|通常|
|F0597|アポ禁|選ぶ欄|soil_list_condition.condition → filters[]（field=appointmentBlocked）.value|通常|
|F0598|元回線|選ぶ欄|soil_list_condition.condition → filters[]（field=lineType）.value|通常|
|F0599|区分|選ぶ欄|soil_list_condition.condition → filters[]（field=category）.value|通常|
|F0600|リスト名|文字|soil_list_condition.condition → filters[]（field=listName, op=contains）.value|通常|
|F0601|リスト投入日（から）|日付|soil_list_condition.condition → filters[]（field=listLoadedOn, op=gte）.value|通常|
|F0602|リスト投入日（まで）|日付|soil_list_condition.condition → filters[]（field=listLoadedOn, op=lte）.value|通常|
|F0603|再判定日（から）|日付|soil_list_condition.condition → filters[]（field=recheckedOn, op=gte）.value|通常|
|F0604|再判定日（まで）|日付|soil_list_condition.condition → filters[]（field=recheckedOn, op=lte）.value|通常|
|F0605|最終架電日（から）|日付|soil_list_condition.condition → filters[]（field=lastCalledOn, op=gte）.value|通常|
|F0606|最終架電日（まで）|日付|soil_list_condition.condition → filters[]（field=lastCalledOn, op=lte）.value|通常|
|F0607|架電回数（から）|数字|soil_list_condition.condition → filters[]（field=callCount, op=gte）.value|通常|
|F0608|架電回数（まで）|数字|soil_list_condition.condition → filters[]（field=callCount, op=lte）.value|通常|
|F0609|経過年数（から）|数字|soil_list_condition.condition → filters[]（field=contractMonth, op=lte（入力年数から日付へ変換））.value|通常|
|F0610|経過年数（まで）|数字|soil_list_condition.condition → filters[]（field=contractMonth, op=gte（入力年数から日付へ変換））.value|通常|
|F0611|購入履歴|選ぶ欄|soil_list_condition.condition → filters[]（field=purchaseHistoryExists, op=eq）.value|通常|
|F0612|自社アポ禁|選ぶ欄|soil_list_condition.condition → filters[]（field=internalBlocked, op=eq）.value|通常|

## 行ごとに権限が決まる表・外部データと規則の所在

画面の許可と以下の行条件の両方が必要。migration はリポジトリ上の定義であり、本番への適用済みを確認したものではない。

|表・データ|行の決まり|根拠ファイル|
|---|---|---|
|root_employees|本人は user_id=auth.uid()、Root 一覧は画面権限を検証する別経路。退職日・is_active・deleted_at による有効性も確認する|src/app/api/root/view-data/route.ts、src/lib/auth/root-view.server.ts、src/lib/auth/employee-access.ts、src/app/tree/_lib/queries.ts|
|root_employee_profile_history / root_employee_profile_current|本人の employee_id。履歴の直接 SELECT は本人または root_can_write。Root 画面のサービスロール読み取りは Root の画面権限を別途検証する。category と最新値の集約を壊さない|supabase/migrations/20260914000001_root_employee_profile_history.sql、src/app/root/_lib/profile-history.server.ts、roster-profile-edit.server.ts|
|root_employee_team_history|Root の従業員画面を見られる人に対象従業員の履歴を返す。編集は admin 以上、source=garden の履歴だけ。本人用プロフィールで扱う範囲とは別|src/app/api/root/employees/[employeeId]/team-history/route.ts、supabase/migrations/20261029000488_root_team_history.sql|
|system_onboarding|本人は自分の employee_id。管理閲覧は all タブの許可。代理入力は責任者以上、口座・番号の代理入力は sensitive 条件。番号の復号は my_number_viewers も必要|src/app/system/onboarding/_lib/onboarding.server.ts、onboarding-admin.server.ts、onboarding-proxy.server.ts、supabase/migrations/20261029000479_my_number_encrypt.sql|
|system_hire_candidates|候補者と入社後確認のタブ権限。編集は hireAdminContext。採用状態・担当者名で広く一般公開しない|src/app/system/onboarding/_lib/hire-candidates.server.ts、src/lib/auth/view-permission.ts|
|system_mypage_submissions|本人一覧・取消・確認は employee_id=本人。Root 受信箱は管理者処理。payload に秘密の口座番号が含まれるため JSON 全文を索引化しない|src/app/api/system/mypage/submissions/route.ts、[id]/route.ts、src/app/api/root/inbox/route.ts|
|root_employee_my_numbers / my_number_viewers|本人提出は認証された employee_id。管理閲覧・復号・確認は my_number_viewers への登録が必要。役職だけで番号は見せない|src/lib/my-number/access.server.ts、submission.server.ts、src/app/api/root/my-numbers/route.ts、supabase/migrations/20261029000479_my_number_encrypt.sql|
|system_ap_daily_report|本人 employee_id または super_admin の RLS。API の通常読取は本人分。kind・report_date でも識別する|src/app/api/my/ap-daily-report/route.ts、supabase/migrations/20261029000470_system_ap_daily_report.sql|
|system_expense_report / system_nhk_visit_report|本人の履歴は submitted_by / employee_number。管理者の別読み取りがある場合も通常の本人履歴へ混ぜない|src/app/api/system/expense-report/route.ts、src/app/api/system/nhk-visit/route.ts|
|system_zenkaku_check_request / system_zenkaku_submission|requested_by=認証 user.id。続行時もその id の所有者を再確認する|src/app/api/system/zenkaku-check/route.ts、src/app/api/system/zenkaku-submit/route.ts、[id] の読取 API|
|system_innovera_daily_extension|本人の employee_id・work_date の内線使用区間。終了時刻がある区間と現行区間を区別。履歴を見る権限と録音を再生する権限は別|src/lib/innovera/daily-extension.ts、call-access.ts、src/app/api/system/innovera-calls/daily-extension/change/route.ts|
|bud_expense_requests|本人の applicant_employee_id の行、または許可されたタブと status の行。削除済みは deleted タブ、通常行は submit / approve / booking / done / list の条件。基礎の Bud 権限も必要|supabase/migrations/20261026000007_bud_view_scopes.sql、src/lib/auth/bud-view.server.tsx、src/app/m/_lib/mobile-expenses.ts|
|bud_transfers / bud_statements|画面・タブ scope の制限は確認したが、既存の基礎 RLS の全定義は今回の migration 群だけでは確定できない。作成者や法人・チーム制限を推測して実装しない|src/lib/auth/bud-view.server.tsx、supabase/migrations/20261026000007_bud_view_scopes.sql、src/app/bud/_lib/transfer-mutations.ts。実 DB の pg_policies の追加確認が必要|
|bud_mf_accounts / bud_mf_group_viewers|bud_has_access に加え、super_admin または非表示でない口座で個別 visible_employee_ids か kind のグループ employee_ids に本人を含む。関連取引は見られる口座に従う|src/lib/bud/mf/access.ts、src/app/api/bud/mf-accounts/route.ts、supabase/migrations/20261021000009_bud_mf_group_viewers.sql|
|bud_bb_viewers|bud_bb_can_view が許可する閲覧者だけ。設定変更は super_admin。ブロードバンドのデータ行そのものは取り込みなので本調査の入力欄対象外|src/lib/bud/broadband/access.ts、src/app/api/bud/broadband/viewers/route.ts|
|bud_employee_bank_accounts|口座変更承認で作る派生行。本人 employee_id または給与用ロール・管理者という既存 RLS 定義。番号は検索対象外|src/app/api/root/inbox/route.ts、supabase/migrations/20260507000002_bud_phase_d09_bank_accounts.sql。古い UUID 型の定義と現行コードの employee_id の違いは実 DB で要確認|
|bloom_daily_logs / bloom_worker_status|書き込み引数は本人 user_id。閲覧に Bloom scope の restrictive policy が追加されているが、既存の基礎 SELECT policy の全条件は未確定。本人限定閲覧と決めつけない|src/app/bloom/workboard/_lib/mutations.ts、supabase/migrations/20261027000448_bloom_tree_view_permissions.sql|
|soil_call_history|書き込みは本人 employee_id を指定。今回の Tree の手入力経路と、自動取り込みの system_call_history / system_innovera_* は別。基礎の SELECT policy と過去行の開き先は未確定|src/app/tree/_lib/queries.ts、src/app/tree/call/page.tsx、src/app/tree/calling/sprout/page.tsx、src/app/tree/calling/branch/page.tsx|
|garden_intake_items / Graph メール|box と許可タブにより読むメール箱を限定。個人箱・共有箱を区別し、Graph の認証権限も必要。取込行の notice_text だけが手入力候補|src/app/rill/mail/_lib/server-auth.ts、view-access.server.ts、view-access.ts、mail-boxes.ts、src/app/api/rill/mail/intake/route.ts|
|Kintone トスアップ|partner はセッションの partnerCode による範囲、社員は社員としてのアクセス条件と mine 条件。Kintone の実アプリ・権限は未照合|src/app/p/_lib/server-auth.ts、src/app/api/toss/board/route.ts、src/app/p/toss/_lib/form.ts|
|system_view_permissions|page_key / tab_key ごとの roles または employee_ids。タブ未設定時は画面設定へフォールバック。開発ボードは EMP-0008 の特例|src/lib/auth/view-permission.ts、view-permission.server.ts、supabase/migrations/20261026000002_system_view_permissions.sql|

## 検索しない欄・保存しない認証入力

上の表の「探さない」に加え、保存する業務欄ではない次の認証入力も検索対象外。値は読み出し・報告していない。

|画面・欄|扱い・保存先|根拠|
|---|---|---|
|/login の社員番号・パスワード、/p/login の認証入力|認証用。業務本文として索引化しない。パスワードは Supabase Auth / パートナー認証経路|src/app/login/page.tsx、src/app/p/login/page.tsx|
|マイページの誕生日の月日4桁|ロック解除の照合値。届出の payload には保存しない、探さない|src/app/system/mypage/tabs/ProfileTab.tsx、/api/system/mypage/unlock|
|内線変更小窓の管理者の社員番号・パスワード|承認用に送る入力。パスワードの平文保存先はなく、検索しない|src/app/system/innovera-calls/InnoveraCallsClient.tsx、/daily-extension/change|
|出勤表の LINE 送信小窓のパスワード|送信権限の確認入力。探さない|src/app/system/forms/shukkin/_components/LineSendDialog.tsx|
|入社後の LINE 確認コード・リンクコード|一時的な認証・連携用。探さない|src/app/system/onboarding/HireConfirmationSteps.tsx、_components/LineLink.tsx、hire-line.server.ts|
|Rill の OAuth トークン|フォームの手入力ではない。rill_mail_tokens.refresh_token_enc / access_token_enc は暗号化して保存、探さない|src/app/rill/mail/_lib/token-crypto.ts、graph.ts、src/app/api/rill/mail/auth/callback/route.ts|
|Leaf 試作の lock-password|試作のロック解除。Garden の保存先なし、探さない|src/app/leaf/_templates/input.html|

番号の代わりに末尾4桁・マスク・暗号文を索引化することも避ける。system_onboarding.dependents / system_mypage_submissions.payload / root_employee_profile_history.payload は、許可した JSON パスだけを拾う。PDF・領収書・添付メールの全文は口座番号等を含み得るため、本調査の「ファイル欄」はファイルへの導線として整理し、全文検索の採用は確定していない。

## 迷ったもの・対象外としたもの

|対象|調査で分かったこと・判断|根拠|
|---|---|---|
|Tree の通話履歴のメモ・理由|人の手入力があるので一覧には保存対応を記載した。ただし依頼の「通話の履歴は対象外」が表全体を指す場合は除外する。自動履歴表と混ぜず、採用は保留。過去行を開く先も未実装|tree/call/page.tsx、calling/sprout/page.tsx、calling/branch/page.tsx、_lib/queries.ts|
|Tree のフィードバック・スクリプト・休憩予定・要フォローのメモ・Breeze・業務終了報告|保存ボタンや入力欄があるが、React state の更新・デモ表示が中心。永続 DB の保存先を確認できないため検索対象表を作らない|tree/feedback/page.tsx、scripts/page.tsx、break-schedule/page.tsx、alerts/page.tsx、breeze/page.tsx、wrap-up/page.tsx|
|Tree の QA|質問・回答等の編集は state。localStorage はお気に入りの保持。質問本文の永続 DB 保存と誤認しない|src/app/tree/qa/page.tsx|
|Leaf 関電の入力 / 事務|iframe は /api/leaf/prototype が src/app/leaf/_templates/input.html / backoffice.html を返す。写真、PD、供給地点番号、お客様番号、SW の選択、情報変更文、事務の契約名義・住所・電話・受注から完了までの日付・差戻し理由等の試作入力がある。Garden DB へ保存する API 経路は確認できず、表.列は「なし」。試作データを本番の searchable data として数えない|KandenPrototypePage.tsx、src/app/api/leaf/prototype/route.ts、_templates/*.html|
|Bud の請求書・給与・マスタ・設定等の SOURCE_HTML|埋め込み HTML に入力欄があっても保存処理がないものがある。BudFaithfulFrame の HTML と操作スクリプトを区別。React の経費精算・振込・明細・口座設定は上表の実経路を採用|src/app/bud/invoices/page.tsx、payroll/page.tsx、masters/page.tsx、settings/page.tsx、journal/page.tsx、_components/BudFaithfulFrame.tsx|
|Bud の請求書・明細・Forest の CSV/PDF 取り込み|原本取り込み・機械抽出・取引履歴の全列は対象外。画面で人が直せる欄と手動紐付けだけ上表に記載。元ファイルの全文の検索可否は未確定|StatementImportModal.tsx、forest/shiwakechou/[corp_id]/view.tsx、forest/_components/PdfUploader.tsx|
|Sprout の応募者・面接・研修|Kintone 取り込み表示が中心。採用へ引き継ぐ操作はあるが、取り込み由来の応募者の全列は対象外。バイトルの掲載と設定の入力は対象|src/app/sprout/sprout.tsx、actions.ts、postings/baitoru-actions.ts|
|出勤表の席数・出勤時刻・予定文|画面内の文面作成用。ヒュアラン予定・面接予定・研修予定・上田予定・後確予定は Chatwork 投稿本文へ送れるが、その予定欄ごとの Garden DB 保存先はない。LINE のシフト文も自動生成、system_line_staff_message は配信記録。外部 Chatwork 投稿も横断検索したい場合は別の取り込みが必要|ShukkinClient.tsx、_lib/shukkin.ts、_components/ChatworkSendDialog.tsx、/api/system/shukkin/chatwork|
|入社後確認ステップの雇用契約書の編集欄|契約開始日・終了日・締結日等は書類作成リクエストに使用する。hire-documents.server.ts のダウンロード経路と /root/contracts の system_employment_contracts 保存は別。書類作成だけの入力を契約書履歴に保存されたと数えない|HireConfirmationSteps.tsx、_lib/hire-documents.server.ts|
|My の本人確認・定期確認・変更のないことの確認|確認時刻や自動履歴は操作記録。新しい自由入力の本文ではないため件数から除外|my/QuarterlyConfirm.tsx、system/mypage/tabs/ProfileTab.tsx|
|シフト・Seed・Soil・Fruit・Calendar 等の入口|準備中・案内・閲覧画面の入口と API を確認。シフトには現在保存フォームなし。Soil の実入力は System のリストマスタに集約して記載|src/app/system/mypage/tabs/ShiftTab.tsx、src/app/liff/shift/ShiftPage.tsx、各 module の page.tsx|
|共通の検索欄・フィルタ・フォント・テーマ・お気に入り|通常は検索対象となる業務データの入力ではない。保存条件の名前と condition は明示保存されるため上表に含めた。表示設定だけの localStorage は除外|各 Header / Topbar、DataTable、ListMasterClient.tsx、src/app/layout.tsx|
|数字の表示と検索|金額は numeric 列と JSON 文字列が混在する。検索語の 1000 / 1,000 / １０００ を NFKC・桁区切り除去で同じ値として比較する設計が必要。口座・電話・社員番号等を金額と同じ数値化で扱わず、秘密欄はそもそも索引へ入れない|system_expense_report.amount、bud_expense_requests.amount、bud_transfers.amount、system_onboarding の収入と交通費等|
|保存先と実 DB の整合|Root 取引先の bank_* と Bud 追加の payee_*、旧 migration の UUID と現行 employee_id、表・RPC の存在や本番 RLS は DB 接続できず未確定。コードの保存先として記載しており、実 DB への保存成功を確認したわけではない|root/_lib/queries.ts、bud/transfers/_components/NewVendorModal.tsx、関連 migration|
|検索結果から行を直接開く方法|既存の詳細 URL がある振込・入社手続き以外は、一覧を開いて id で小窓を展開する対応が必要な場合がある。架空の ?id= URL が動くと断定していない。今回 src は変更しない|各表の「結果の開き先」|

既存 polling / cron の変更・追加はしていない。今回の追加定期取得は **0回/日**。DB の行数取得は手動の1回の接続試行で、定期実行は設けていない。

## 全モジュールの走査範囲

page.tsx はソース上の入口数で、リダイレクト・別入口・準備中も含む。UI 候補ファイル数は JSX の入力部品を直接持つファイル数で、共通部品の定義・検索欄・試作も含む。入力欄の確定件数とは異なる。埋め込み HTML は別に確認した。

|ディレクトリ|page.tsx 数|入力部品の候補ファイル数|調査結果|
|---|---:|---:|---|
|(home)|0|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|(orientation)|3|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|access-denied|1|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|away|1|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|bloom|12|5|まとめ・予定・状況を記載。進捗の期間フィルタは除外。|
|break|1|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|bud|25|25|実保存と SOURCE_HTML の試作を本文で区別。|
|calendar|1|0|入口・閲覧。|
|codex-187-preview|0|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|codex-188-preview|0|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|forest|13|4|進行期の手入力と取り込みを区別。|
|fruit|1|0|入口・準備中。|
|leaf|4|0|iframe 内の試作 HTML も確認。永続 DB 保存先なし。|
|liff|3|1|共通届出・番号提出。shift は準備中。|
|login|1|1|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|m|11|3|経費写真提出と System のモバイルフォームを確認。|
|my|1|1|共通 System フォームと AP 日報、認証・確認操作を区別。|
|notices|1|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|p|5|4|Kintone トスフォーム、認証、ボードフィルタを区別。|
|rill|2|3|送信は Graph、周知文は DB、メール表示・検索だけの欄を区別。|
|root|17|24|実保存は Root の一覧。点検・取り込み・権限表だけの表示は区別。|
|seed|1|0|入口・準備中。|
|soil|1|0|実入力は System のリストマスタ。|
|sprout|2|2|バイトルの設定と掲載は実保存、応募者等は取り込み中心。|
|system|36|33|実保存は本文の System / My の一覧。検索条件・履歴・同期だけの画面は除外。|
|tree|25|16|通話手入力・誕生日以外は試作/state が多い。|
|_components|0|4|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|_constants|0|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|_hooks|0|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|
|_lib|0|0|共通部品・認証・案内・リダイレクト等。業務の保存欄は呼び出し側に記載。|

### UI 候補のソース索引

見落とし照合用。以下の「宣言数」は論理入力欄の件数ではない（同じ共通部品・条件分岐・検索欄を重複して含む）。同じファイル内の主な label / aria-label / name / value を添えた。動的に生成する欄は本文の定義配列・JSON パスで展開した。

|ソース（先頭の入力宣言行）|宣言数|入力部品・バインドの手掛かり|
|---|---:|---|
|[src/app/bloom/monthly-digest/[month]/edit/page.tsx:158](../../src/app/bloom/monthly-digest/[month]/edit/page.tsx#L158)|5|{title} / {summary} / ページタイトル / 本文（Markdown 可 / 改行保持） / 画像 URL (任意)|
|[src/app/bloom/progress/components/ProgressDashboard.tsx:353](../../src/app/bloom/progress/components/ProgressDashboard.tsx#L353)|2|{defaultFrom} / {defaultTo}|
|[src/app/bloom/workboard/components/TodayPlanList.tsx:80](../../src/app/bloom/workboard/components/TodayPlanList.tsx#L80)|2|input / 追加する予定を入力|
|[src/app/bloom/_components/BloomTopbar.tsx:116](../../src/app/bloom/_components/BloomTopbar.tsx#L116)|1|検索（取引先、請求書、タスク、ヘルプなど）|
|[src/app/bloom/_components/CeoStatusEditor.tsx:53](../../src/app/bloom/_components/CeoStatusEditor.tsx#L53)|2|status / a-main 006 で Root Phase B 確定中|
|[src/app/bud/bank/BankAccounts.tsx:39](../../src/app/bud/bank/BankAccounts.tsx#L39)|11|名前で探す / input / {draft.mail_alias ?? ""} / {draft.book_sub_account_name} / {draft.balance_mode} / {draft.anchor_balance ?? ""} / {draft.anchor_at ? new Date(Date.parse(draft.anchor_at) + 9 * 3600000).toISOString().slice(0,19) : " / {draft.anchor_date ?? ""} / {draft.balance_note} / {period}|
|[src/app/bud/bank/PeriodSelect.tsx:6](../../src/app/bud/bank/PeriodSelect.tsx#L6)|1|期間|
|[src/app/bud/bank/TransactionDetail.tsx:42](../../src/app/bud/bank/TransactionDetail.tsx#L42)|1|{period}|
|[src/app/bud/expenses/_components/ExpenseBookingGroupHeader.tsx:58](../../src/app/bud/expenses/_components/ExpenseBookingGroupHeader.tsx#L58)|1|{`${applicantName}をまとめて選ぶ`}|
|[src/app/bud/expenses/_components/ExpenseBookingPanel.tsx:510](../../src/app/bud/expenses/_components/ExpenseBookingPanel.tsx#L510)|7|仕訳待ちを検索 / input / 仕分け日 / 一括仕分け法人名 / 決算区分の上書き / {`${applicant}の仕分け法人名`}|
|[src/app/bud/expenses/_components/ExpenseDonePanel.tsx:121](../../src/app/bud/expenses/_components/ExpenseDonePanel.tsx#L121)|2|表示中の経費をすべて選択 / {`${row.store_name ?? "経費"}を選択`}|
|[src/app/bud/expenses/_components/ExpenseFinalPanel.tsx:597](../../src/app/bud/expenses/_components/ExpenseFinalPanel.tsx#L597)|4|完了待ちを検索 / 表示中の完了待ちをすべて選択 / {`${employeeLabel(row, employees)} の申請を選択`} / {returnReason}|
|[src/app/bud/expenses/_components/ExpenseReviewPanel.tsx:1054](../../src/app/bud/expenses/_components/ExpenseReviewPanel.tsx#L1054)|28|{sortField} / 区分 / {searchMode ? activeSearch.expense_kind ?? "" : form.expense_kind} / 申請者 / 氏名で検索 / 法人 / {searchMode ? activeSearch.corp_id ?? "" : form.corp_id} / レシート日付 / {searchMode ? "//・7/1...7/31" : undefined} / レシート時刻 / {searchMode ? "09:00...12:00" : undefined} / 経費区分 / {searchMode ? activeSearch.category_id ?? "" : form.category_id} / 適格区分 / {searchMode ? activeSearch.qualified_class ?? "" : form.qualified_class} / 適格番号(T) / {qualifiedNumberValue} / 店名 / {searchMode ? "部分一致・==完全一致・!除外" : undefined} / 金額 / {searchMode ? ">5000" : undefined} / 摘要 / {searchMode ? "部分一致・*ワイルドカード" : undefined} / 一覧を検索 / 表示中の経費申請をすべて選択 / 経費申請を選択 / input|
|[src/app/bud/profit/broadband/BroadbandTable.tsx:126](../../src/app/bud/profit/broadband/BroadbandTable.tsx#L126)|1|期間|
|[src/app/bud/statements/summary/StatementsSummaryContent.tsx:91](../../src/app/bud/statements/summary/StatementsSummaryContent.tsx#L91)|1|{yyyymm}|
|[src/app/bud/statements/_components/ManualAssignModal.tsx:151](../../src/app/bud/statements/_components/ManualAssignModal.tsx#L151)|1|transfer|
|[src/app/bud/statements/_components/StatementImportModal.tsx:123](../../src/app/bud/statements/_components/StatementImportModal.tsx#L123)|3|{bankAccountId} / {sourceType} / input|
|[src/app/bud/transfers/csv-export/page.tsx:190](../../src/app/bud/transfers/csv-export/page.tsx#L190)|2|input / {`選択 ${t.transfer_id}`}|
|[src/app/bud/transfers/_components/AttachmentUploader.tsx:37](../../src/app/bud/transfers/_components/AttachmentUploader.tsx#L37)|1|input|
|[src/app/bud/transfers/_components/BankPicker.tsx:124](../../src/app/bud/transfers/_components/BankPicker.tsx#L124)|2|{executeCompanyId} / {sourceAccountId}|
|[src/app/bud/transfers/_components/DataSourceSelector.tsx:36](../../src/app/bud/transfers/_components/DataSourceSelector.tsx#L36)|1|data_source|
|[src/app/bud/transfers/_components/FilterBar.tsx:82](../../src/app/bud/transfers/_components/FilterBar.tsx#L82)|1|Enter で検索|
|[src/app/bud/transfers/_components/NewVendorModal.tsx:110](../../src/app/bud/transfers/_components/NewVendorModal.tsx#L110)|9|取引先名 * / 銀行名 / 銀行コード *（4桁） / 支店名 / 支店コード *（3桁） / {form.account_type} / 口座番号 *（7桁） / 口座名義カナ / {value}|
|[src/app/bud/transfers/_components/RejectModal.tsx:67](../../src/app/bud/transfers/_components/RejectModal.tsx#L67)|2|例: 金額が請求書と異なるため、再確認をお願いします / input|
|[src/app/bud/transfers/_components/TransferApprovalPanel.tsx:442](../../src/app/bud/transfers/_components/TransferApprovalPanel.tsx#L442)|3|振込先 / 摘要 / ID / このページをすべて選択 / {`${row.payee_name ?? row.transfer_id}を選択`}|
|[src/app/bud/transfers/_components/TransferFormCashback.tsx:233](../../src/app/bud/transfers/_components/TransferFormCashback.tsx#L233)|17|申込者名 * / 申込者名カナ * / 電話番号（任意） / 商材名 * / 商流名 * / 銀行名 / 銀行コード *（4桁） / 支店名 / 支店コード *（3桁） / {accountType} / 口座番号 *（1〜7桁） / 口座名義カナ * / {amount} / {scheduledDate} / {dueDate} / {notes} / {value}|
|[src/app/bud/transfers/_components/TransferFormRegular.tsx:458](../../src/app/bud/transfers/_components/TransferFormRegular.tsx#L458)|11|input / payment_category / {payeasyBillerNo} / {payeasyCustomerNo} / {payeasyConfirmNo} / {registeredMethod} / {amount} / fee_bearer / {scheduledDate} / {dueDate} / {notes}|
|[src/app/bud/transfers/_components/TransferPaymentCategoryPanel.tsx:408](../../src/app/bud/transfers/_components/TransferPaymentCategoryPanel.tsx#L408)|3|振込先 / 摘要 / ID / このページをすべて選択 / {`${row.payee_name ?? row.transfer_id}を選択`}|
|[src/app/bud/transfers/_components/VendorPicker.tsx:64](../../src/app/bud/transfers/_components/VendorPicker.tsx#L64)|1|{selectedVendorId}|
|[src/app/bud/_components/ViewerPicker/ViewerPicker.tsx:12](../../src/app/bud/_components/ViewerPicker/ViewerPicker.tsx#L12)|2|名前で探す / input|
|[src/app/forest/shiwakechou/[corp_id]/view.tsx:311](../../src/app/forest/shiwakechou/[corp_id]/view.tsx#L311)|1|input|
|[src/app/forest/_components/NumberUpdateForm.tsx:91](../../src/app/forest/_components/NumberUpdateForm.tsx#L91)|6|190797587 / 124932774 / 6444667 / 2026/3まで反映中 / input|
|[src/app/forest/_components/PdfUploader.tsx:102](../../src/app/forest/_components/PdfUploader.tsx#L102)|1|input|
|[src/app/forest/_components/PeriodRolloverForm.tsx:87](../../src/app/forest/_components/PeriodRolloverForm.tsx#L87)|4|{junshisan} / {genkin} / {yokin} / https://drive.google.com/...|
|[src/app/liff/forms/FormsPage.tsx:49](../../src/app/liff/forms/FormsPage.tsx#L49)|3|申告の種類 / {drafts[type][key]／／''}|
|[src/app/login/page.tsx:127](../../src/app/login/page.tsx#L127)|3|employeeIdOrPartnerCode / パスワードを入力 / input|
|[src/app/m/bud/submit/CameraCapture.tsx:323](../../src/app/m/bud/submit/CameraCapture.tsx#L323)|1|input|
|[src/app/m/bud/submit/page.tsx:426](../../src/app/m/bud/submit/page.tsx#L426)|1|{selectedCorpId}|
|[src/app/m/search/page.tsx:62](../../src/app/m/search/page.tsx#L62)|1|モジュール、店名、金額、状態|
|[src/app/my/ApDailyReport.tsx:38](../../src/app/my/ApDailyReport.tsx#L38)|9|日付 / 区分 / TimeRange / 稼働時間（分） / {current.kind === 'toss' ? 'トス':'本日獲得'} / 現状合計 / {labels[i]} / 反省点・改善点 / Chatwork に送る文|
|[src/app/p/login/page.tsx:60](../../src/app/p/login/page.tsx#L60)|2|7桁のコード / 社員番号 / パスワードを入力|
|[src/app/p/toss/board/Board.tsx:38](../../src/app/p/toss/board/Board.tsx#L38)|2|名前・エリア・商材など / input|
|[src/app/p/toss/board/ColumnFilter.tsx:8](../../src/app/p/toss/board/ColumnFilter.tsx#L8)|1|input|
|[src/app/p/toss/new/TossForm.tsx:33](../../src/app/p/toss/new/TossForm.tsx#L33)|29|トスランク / キャッシュバック有無 / tossCbAmount / トス商材 / 連絡希望時間帯 / 関電リスト区分 / {form.pdManagementNumber} / 申込者区分 / applicantLastName / applicantFirstName / applicantLastKana / applicantFirstKana / birthDate / 住所区分 / {form.postalCode} / prefecture / city / town / building / room / contactPhone / 連絡先区分 / スマホキャリア / {session.tossPartnerCode} / {form.partnerCode／／""} / {form.comment} / {String(form[name])} / {value} / input|
|[src/app/page_20260427T172100Z.tsx:151](../../src/app/page_20260427T172100Z.tsx#L151)|1|検索（暫定 placeholder、v7-E で再有効化）|
|[src/app/rill/mail/_components/RillComposePane.tsx:52](../../src/app/rill/mail/_components/RillComposePane.tsx#L52)|5|メールアドレス / {draft.subject} / 本文を入力 / input|
|[src/app/rill/mail/_components/RillMailScreen.tsx:882](../../src/app/rill/mail/_components/RillMailScreen.tsx#L882)|6|メールを検索 / input / {noticeWorkspace.salesPerson} / {noticeWorkspace.projectName} / {noticeWorkspace.text}|
|[src/app/rill/_components/RillShachoShell.tsx:292](../../src/app/rill/_components/RillShachoShell.tsx#L292)|1|検索|
|[src/app/root/attendance/page.tsx:152](../../src/app/root/attendance/page.tsx#L152)|18|{month} / 勤怠ID / 従業員 / 対象月（YYYY-MM） / 出勤日数 / 欠勤日数 / 有給取得日数 / 所定労働時間 / 実労働時間 / 所定外時間（平日） / 法定外時間（平日） / 深夜時間 / 休日出勤時間 / 遅刻時間 / 早退時間 / 研修時間（任意） / 事務時間（任意） / 取込ステータス|
|[src/app/root/bank-accounts/page.tsx:308](../../src/app/root/bank-accounts/page.tsx#L308)|10|法人 / 銀行 / 口座番号 / 支店名 / 支店コード（3桁） / 口座種別 / 弥生の補助科目名 / input / メモ|
|[src/app/root/bank-check/page.tsx:231](../../src/app/root/bank-check/page.tsx#L231)|6|廃止された金融機関コード / 廃止された支店コード / 後継の金融機関コード / 後継の支店コード / 適用日 / メモ|
|[src/app/root/companies/page.tsx:324](../../src/app/root/companies/page.tsx#L324)|29|法人ID / デフォルト振込銀行 / 法人名 / 法人名カナ / 電話番号 / FAX番号 / 決算月 / 設立日 / メールドメイン / Webサイト / 本店所在地 / 法人番号（13桁） / インボイス登録番号 / 電気通信事業届出番号 / 雇用保険事業所番号 / 労働保険番号 / 代理店届出番号 / 産業分類番号 / 管轄税務署 / 代表者名 / 代表者名カナ / 代表者性別 / 代表者生年月日 / 代表者携帯番号 / 代表者住所 / 担当者1 氏名 / 担当者1 電話番号 / 担当者2 氏名 / 担当者2 電話番号|
|[src/app/root/contracts/page.tsx:130](../../src/app/root/contracts/page.tsx#L130)|7|{employeeId} / kind / {p.salaryKind??"hourly"} / {p.weeklyHours??""} / {String(p[key as keyof EmploymentContractPayload])} / {p.jobType} / {p.jobTypeOther}|
|[src/app/root/contracts/_components/ContractTypeFields.tsx:7](../../src/app/root/contracts/_components/ContractTypeFields.tsx#L7)|11|{p.templateType??"part_time"} / {p.indefinite?"yes":"no"} / {!p.renewalText／／p.renewalText==="更新する場合がある"?renewalOptions[1]:p.renewalText} / {p.renewalText??""} / {p.commuteCap??20000} / {p.duties??""} / {p.workHours??""} / {p.fixedOvertime?"yes":"no"} / {p.startTime??""} / {p.endTime??""} / {p.breakMinutes??60}|
|[src/app/root/employees/GardenRoleField.tsx:25](../../src/app/root/employees/GardenRoleField.tsx#L25)|2|{label}|
|[src/app/root/employees/KotEmployeePanel.tsx:45](../../src/app/root/employees/KotEmployeePanel.tsx#L45)|3|{division} / {type} / {date}|
|[src/app/root/employees/page.tsx:843](../../src/app/root/employees/page.tsx#L843)|36|変更後 / 従業員ID / 社員番号 / 所属法人 / 氏名 / 氏名カナ / 公式 LINE の連絡先 / メールアドレス / 雇用形態 / 給与体系 / 社会保険区分 / {editTarget.garden_role ?? "staff"} / 入社日 / 生年月日 / 退職日 / 契約終了日（外注） / 事業 / 銀行名 / 金融機関コード（4桁） / 口座種別 / 支店名 / 支店コード（3桁） / 口座番号（7桁） / 口座名義 / 口座名義カナ / 年末調整 甲/乙欄 / 扶養家族人数（0〜20） / キングオブタイムID / INNOVERA 内線番号（PC） / INNOVERA 内線番号（モバイル） / FileMaker 社員名 / マネーフォワード クラウド給与 ID / INNOVERA録音の権限 / Chatwork ID / API トークン / 備考|
|[src/app/root/employees/RosterProfileFields.tsx:20](../../src/app/root/employees/RosterProfileFields.tsx#L20)|3|{label}|
|[src/app/root/employees/TeamHistoryPanel.tsx:40](../../src/app/root/employees/TeamHistoryPanel.tsx#L40)|3|移動日 / チーム / メモ|
|[src/app/root/inbox/page.tsx:149](../../src/app/root/inbox/page.tsx#L149)|1|片道金額|
|[src/app/root/insurance/page.tsx:162](../../src/app/root/insurance/page.tsx#L162)|9|保険マスタID / 適用年度（4桁） / 適用開始日 / 適用終了日 / 健康保険料率（%） / 介護保険料率（%） / 厚生年金保険料率（%） / 雇用保険料率（%） / 子ども・子育て支援金率（%）|
|[src/app/root/kot-sync-history/page.tsx:129](../../src/app/root/kot-sync-history/page.tsx#L129)|5|種別 / ステータス / from / to / {value}|
|[src/app/root/kot-sync-history/_components/SyncLogDetailModal.tsx:89](../../src/app/root/kot-sync-history/_components/SyncLogDetailModal.tsx#L89)|13|ID / 種別 / 対象 / 起動者 / ステータス / 起動日時 / 開始日時 / 完了日時 / 処理時間 / 取得件数 / 追加件数 / 更新件数 / スキップ件数|
|[src/app/root/mail-forwarding/AddressInputs.tsx:36](../../src/app/root/mail-forwarding/AddressInputs.tsx#L36)|3|{`${name}_postal`} / {`${label}（必須）`} / {`${name}_building`}|
|[src/app/root/mail-forwarding/page.tsx:85](../../src/app/root/mail-forwarding/page.tsx#L85)|9|holder / notes / stopped / input / filed_on / method / receipt / filed_by / filing_notes|
|[src/app/root/minimum-wages/page.tsx:31](../../src/app/root/minimum-wages/page.tsx#L31)|4|{draft.prefecture} / {draft.hourly_amount／／""} / {draft.effective_from} / {draft.source_url??""}|
|[src/app/root/my-numbers/MyNumbers.tsx:36](../../src/app/root/my-numbers/MyNumbers.tsx#L36)|1|{reason}|
|[src/app/root/permissions/PermissionsClient.tsx:269](../../src/app/root/permissions/PermissionsClient.tsx#L269)|1|input|
|[src/app/root/salary-systems/page.tsx:171](../../src/app/root/salary-systems/page.tsx#L171)|10|給与体系ID / 体系名 / 対象雇用形態 / 基本給計算方法 / 所定労働時間（日） / 所定労働日数（月） / 残業単価倍率（法定外） / 残業単価倍率（深夜） / 残業単価倍率（休日） / 備考|
|[src/app/root/vendors/page.tsx:182](../../src/app/root/vendors/page.tsx#L182)|15|取引先名・カナ・IDで検索（Ctrl+Shift+G） / 取引先ID / 区分 / 取引先名 / 取引先名カナ / 銀行名 / 金融機関コード（4桁） / 支店名 / 支店コード（3桁） / 口座種別 / 口座番号（7桁） / 口座名義カナ（全角） / 手数料負担 / 担当法人 / 備考|
|[src/app/root/_components/FormField.tsx:47](../../src/app/root/_components/FormField.tsx#L47)|3|input / select / textarea|
|[src/app/root/_components/KotSyncModal.tsx:188](../../src/app/root/_components/KotSyncModal.tsx#L188)|1|{targetMonth}|
|[src/app/sprout/postings/baitoru-panel.tsx:40](../../src/app/sprout/postings/baitoru-panel.tsx#L40)|8|{start} / {end} / {s.content_options.includes(content)?content:s.content_options[0] ／／ ''} / {option} / {excluded} / {s.notify_room} / 通知の宛先 / {s.max_per_run}|
|[src/app/sprout/sprout.tsx:110](../../src/app/sprout/sprout.tsx#L110)|3|期間 / 状況 / {search}|
|[src/app/system/attendance/AttendanceClient.tsx:112](../../src/app/system/attendance/AttendanceClient.tsx#L112)|1|{extensionDialog.extension}|
|[src/app/system/call-metrics/CallMetricsClient.tsx:128](../../src/app/system/call-metrics/CallMetricsClient.tsx#L128)|4|{from} / {to} / 完全一致・任意|
|[src/app/system/contracts/page.tsx:244](../../src/app/system/contracts/page.tsx#L244)|8|input / {draft.counterparty} / {draft.companyId} / {draft.contractType} / {draft.concludedOn} / {draft.note} / {issuerId} / {product}|
|[src/app/system/dev-board/BoardClient.tsx:34](../../src/app/system/dev-board/BoardClient.tsx#L34)|8|input / {q.id} / {q.answer_type==="choice"?"補足":"回答"} / title / module / body / {type} / options|
|[src/app/system/forms/expense/ExpenseClient.tsx:73](../../src/app/system/forms/expense/ExpenseClient.tsx#L73)|10|SelectField / 事業 / 決済方法 / 決済日 / 金額（円・税込） / 使用用途 / {(PURPOSES.slice(7) as readonly string[]).includes(purpose) ? purpose : ''} / {purpose === 'その他' ? '用途の詳細（必須）' : '用途の詳細'} / 備考|
|[src/app/system/forms/nhk-visit/NhkVisitClient.tsx:123](../../src/app/system/forms/nhk-visit/NhkVisitClient.tsx#L123)|10|{visitDate} / {startTime} / {endTime} / {destination} / 地上 / 衛星 / 件数 / 交通費|
|[src/app/system/forms/payroll-notice/PayrollNoticeClient.tsx:187](../../src/app/system/forms/payroll-notice/PayrollNoticeClient.tsx#L187)|9|team / 該当者名 / 通勤最寄り駅 / 紹介者名 / 共有したいことを入力してください / {name} / {placeholder}|
|[src/app/system/forms/shukkin/ShukkinClient.tsx:224](../../src/app/system/forms/shukkin/ShukkinClient.tsx#L224)|15|input / {seatTotal} / {seatLeader} / {seatPartTime} / {member.groupName} / {value} / {plans[key]} / {selected[item.lineUserId] ?? ""} / {missingGroups[row.employeeCode] ?? "宮永チーム"} / 社員番号|
|[src/app/system/forms/shukkin/_components/LineSendDialog.tsx:193](../../src/app/system/forms/shukkin/_components/LineSendDialog.tsx#L193)|2|input / {password}|
|[src/app/system/forms/_components/form-kit/index.tsx:10](../../src/app/system/forms/_components/form-kit/index.tsx#L10)|8|{name} / select / input / TextField / textarea / {label + 'の件数'} / 開始時間 / 終了時間|
|[src/app/system/innovera-calls/InnoveraCallsClient.tsx:445](../../src/app/system/innovera-calls/InnoveraCallsClient.tsx#L445)|9|変更後の発信番号 / {fromDate} / {fromTime} / {toDate} / {toTime} / {number} / {extensionChange.extension} / {extensionChange.adminNumber} / {extensionChange.adminPassword}|
|[src/app/system/kanri/KanriPortalClient.tsx:678](../../src/app/system/kanri/KanriPortalClient.tsx#L678)|42|{targetDate} / kanri-mode / input / kot-hours-basis / {kotDispatchNames(inputs)} / {inputValue(inputs, team, day.date)} / {rateValue(inputs, team, product)} / {inputs.monthlySettings?.targetPointsByTeam?.[team] ?? ""} / {inputs.monthlySettings?.incentive?.targetPoints ?? ""} / {inputs.monthlySettings?.incentive?.achievementBonusTotal ?? ""} / {inputs.monthlySettings?.incentive?.teamVictoryBonus ?? ""} / {personInputValue(inputs, person.name, "landingHours")} / {personInputValue(inputs, person.name, "workHours")} / {personInputValue(inputs, person.name, "workDays")} / {aporanTargetValue(inputs, key)} / {incentiveValue(inputs, "targetPoints")} / {incentiveValue(inputs, "achievementBonusTotal")} / {incentiveValue(inputs, "teamVictoryBonus")} / {payrollSettingValue(inputs, "baseWage", payroll?.settings.baseWage ?? 1177)} / {payrollSettingValue(inputs, "trainingWage", payroll?.settings.trainingWage ?? 1500)} / {payrollPersonValue(inputs, row.personName, "nextStatus")} / {payrollPersonValue(inputs, row.personName, "wageAdjustment")} / {payrollPersonValue(inputs, row.personName, "referralPoints")} / {payrollPersonValue(inputs, row.personName, "trainingHours")} / {payrollPersonValue(inputs, row.personName, "hiringBonus")} / {payrollPersonValue(inputs, row.personName, "talentReferralIncentive")} / {payrollPersonValue(inputs, row.personName, "dealIncentive")} / {fieldSalesWeightValue(inputs, product.key, product.defaultWeight)} / {String(fieldSalesDayValue(inputs, personName, day.date, "status"))} / {fieldSalesDayValue(inputs, personName, day.date, "hours")} / {fieldSalesDayValue(inputs, personName, day.date, manualKey)} / {person.name} / {person.kot_name ?? ""} / {person.team} / {person.department} / {person.employment_kind} / {person.base_wage ?? ""}|
|[src/app/system/line/ContactSettings.tsx:27](../../src/app/system/line/ContactSettings.tsx#L27)|2|氏名 / 連絡先のリンク|
|[src/app/system/line/GroupSettings.tsx:49](../../src/app/system/line/GroupSettings.tsx#L49)|3|グループの名前 / 知らせ先の Chatwork ルームの番号 / 知らせ|
|[src/app/system/line/LineManager.tsx:36](../../src/app/system/line/LineManager.tsx#L36)|9|{label} / 題名 / 送る文 / 雇用形態 / 事業 / あいさつ文 / input / 自由タグ / タグの名前|
|[src/app/system/line/RichMenuSettings.tsx:53](../../src/app/system/line/RichMenuSettings.tsx#L53)|1|担当|
|[src/app/system/list/_components/ListMasterClient.tsx:1022](../../src/app/system/list/_components/ListMasterClient.tsx#L1022)|39|{conditionName} / {reason} / analysis-axis / 含む / {fmExportLineType} / {fmExportListLoadedOn} / {fmExportListName} / input / 年以上 / 年以下 / から / まで / 回以上 / 回以下 / 区分 / {exportFormat} / {purchaseVendor} / {purchaseVendorOther} / {edit.listName} / {edit.lastName} / {edit.firstName} / {edit.phone} / {edit.postal} / 0285720215 / {internalBlockPhone} / {internalBlockReason} / {internalBlockQuery}|
|[src/app/system/list/_components/MultiSelectFilter.tsx:38](../../src/app/system/list/_components/MultiSelectFilter.tsx#L38)|2|{label} / {`${label}の候補を検索`}|
|[src/app/system/manuals/ManualDetailClient.tsx:311](../../src/app/system/manuals/ManualDetailClient.tsx#L311)|1|input|
|[src/app/system/mypage/tabs/ProfileTab.tsx:86](../../src/app/system/mypage/tabs/ProfileTab.tsx#L86)|1|誕生日の月日4桁|
|[src/app/system/mypage/tabs/ZenkakuTab.tsx:53](../../src/app/system/mypage/tabs/ZenkakuTab.tsx#L53)|2|{salesId} / zenkaku-partner|
|[src/app/system/mypage/_components/SubmissionModal.tsx:66](../../src/app/system/mypage/_components/SubmissionModal.tsx#L66)|6|区分 / {employeeName} / {type === "dependents" && key === "details" ? "増える人・外れる人の氏名、続柄、生年月日、その年の収入の見込みを入力してください。" : undefine / {String(values[key] ?? "")} / input|
|[src/app/system/mypage/_lib/todoke-pdf.server.tsx:229](../../src/app/system/mypage/_lib/todoke-pdf.server.tsx#L229)|7|氏名 / 現住所 / 個人の電話番号（携帯等） / 本人との続柄 / 住所 / 電話番号|
|[src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.tsx:301](../../src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.tsx#L301)|15|メールアドレス / 世帯主の氏名 / 世帯主との続柄 / {admin.office} / {admin.weekly_hours} / {admin.health_insurance} / {admin.pension_insurance} / {admin.employment_insurance} / {admin.tax_class} / {admin.salary_kind} / {admin.base_salary} / {allowance.name} / {allowance.amount} / {admin.commute_cap_monthly} / {admin.commute_fixed_monthly}|
|[src/app/system/onboarding/HireCandidatesClient.tsx:99](../../src/app/system/onboarding/HireCandidatesClient.tsx#L99)|5|{form?.[key] ?? ""} / {`${r.last_name} ${r.first_name} ${key.startsWith("contract")?"雇用契約書":key.startsWith("nda")?"秘密保持":k / input|
|[src/app/system/onboarding/HireConfirmationSteps.tsx:52](../../src/app/system/onboarding/HireConfirmationSteps.tsx#L52)|2|既存の契約書の値を使用 / 確認コード|
|[src/app/system/onboarding/OnboardingClient.tsx:171](../../src/app/system/onboarding/OnboardingClient.tsx#L171)|20|{relationSelectValue(value)} / {route[key]} / {values[key]} / 住所の候補 / 銀行の候補 / 支店の候補 / {hasFamily ? "yes" : "no"} / {person.my_number} / {person[key]} / 続柄（その他） / input|
|[src/app/system/sites/_components/SiteNewsPanel.tsx:115](../../src/app/system/sites/_components/SiteNewsPanel.tsx#L115)|5|{companyId} / {form.published_on} / {form.title} / {form.body} / input|
|[src/app/system/sites/_components/SiteNotifyEditor.tsx:23](../../src/app/system/sites/_components/SiteNotifyEditor.tsx#L23)|1|通知先|
|[src/app/system/_components/BoxSelect/BoxSelect.tsx:33](../../src/app/system/_components/BoxSelect/BoxSelect.tsx#L33)|1|{multiple ? undefined : label}|
|[src/app/system/_components/ChoiceFilter.tsx:29](../../src/app/system/_components/ChoiceFilter.tsx#L29)|1|{label}|
|[src/app/system/_components/DataTable/DataTable.tsx:72](../../src/app/system/_components/DataTable/DataTable.tsx#L72)|4|{searchTarget ? "この画面の中を検索" : "検索"} / 値を検索 / input|
|[src/app/system/_components/ViewPermissionButton/ViewPermissionButton.tsx:52](../../src/app/system/_components/ViewPermissionButton/ViewPermissionButton.tsx#L52)|4|scope / input|
|[src/app/tree/alerts/page.tsx:210](../../src/app/tree/alerts/page.tsx#L210)|1|メモ（Chatwork通知に添付）|
|[src/app/tree/birthday/page.tsx:169](../../src/app/tree/birthday/page.tsx#L169)|1|{birthday}|
|[src/app/tree/break-schedule/page.tsx:122](../../src/app/tree/break-schedule/page.tsx#L122)|5|{form.startTime} / {form.endTime} / {form.type} / 例: 昼休憩（第1グループ） / 休憩開始時に表示するメッセージ|
|[src/app/tree/breeze/page (1).tsx:151](../../src/app/tree/breeze/page (1).tsx#L151)|1|メッセージを入力...|
|[src/app/tree/breeze/page.tsx:154](../../src/app/tree/breeze/page.tsx#L154)|1|メッセージを入力...|
|[src/app/tree/call/page.tsx:480](../../src/app/tree/call/page.tsx#L480)|7|{scheduleDate} / {scheduleTime} / NGの理由を入力してください（入力しないと次に進めません） / {nextDate} / {nextTime} / 通話内容や気づいたことをメモ（任意） / {`${label}を入力`}|
|[src/app/tree/calling/branch/page.tsx:543](../../src/app/tree/calling/branch/page.tsx#L543)|1|select|
|[src/app/tree/calling/sprout/page.tsx:390](../../src/app/tree/calling/sprout/page.tsx#L390)|4|NGの理由を入力してください（入力しないと次に進めません） / {nextDate} / {nextTime} / { memoRequired ? "通話内容を入力してください（入力しないと次に進めません）" : "通話内容や気づいたことをメモ（任意）" }|
|[src/app/tree/feedback/list/page.tsx:91](../../src/app/tree/feedback/list/page.tsx#L91)|1|メンバー名・内容で検索...|
|[src/app/tree/feedback/page.tsx:174](../../src/app/tree/feedback/page.tsx#L174)|2|例: 今日のトークめっちゃいい感じだった。がんばってほしい / {convertedText}|
|[src/app/tree/qa/page.tsx:148](../../src/app/tree/qa/page.tsx#L148)|6|疑問検索窓（例：転用手続き と入力） / textarea / 例：転用手続きの流れは？ / トス向けの回答内容を入力 / クローザー向けの回答内容を入力|
|[src/app/tree/scripts/page.tsx:117](../../src/app/tree/scripts/page.tsx#L117)|6|タイトル / {editCat} / スクリプト本文... / {editTitle} / {editContent}|
|[src/app/tree/search/page.tsx:70](../../src/app/tree/search/page.tsx#L70)|1|顧客名・Q&A・見込み・ヒアリングを横断検索...|
|[src/app/tree/wrap-up/page.tsx:112](../../src/app/tree/wrap-up/page.tsx#L112)|1|日報に追記したい内容があれば入力...|
|[src/app/tree/_components/KPIHeader.tsx:593](../../src/app/tree/_components/KPIHeader.tsx#L593)|1|検索...|
|[src/app/tree/_components/ProspectList.tsx:166](../../src/app/tree/_components/ProspectList.tsx#L166)|1|{dateFilter}|
|[src/app/_components/AppHeader.tsx:153](../../src/app/_components/AppHeader.tsx#L153)|1|検索（取引先・請求書・タスク・ヘルプなど）|
|[src/app/_components/layout/GardenShell/GardenShell.tsx:850](../../src/app/_components/layout/GardenShell/GardenShell.tsx#L850)|1|検索 (取引先、請求書、タスク、ヘルプなど)|
|[src/app/_components/layout/Topbar.tsx:66](../../src/app/_components/layout/Topbar.tsx#L66)|1|検索（取引先、請求書、タスク、ヘルプなど）|
|[src/app/_components/notices/NoticeList.tsx:74](../../src/app/_components/notices/NoticeList.tsx#L74)|2|{`publish-${notice.id}`} / input|

共通の番号入力部品は src/lib/my-number/MyNumberForm.tsx にあり、src/app の索引とは別に確認済み。Leaf の src/app/leaf/_templates/*.html と Bud の SOURCE_HTML は JSX 宣言数には含めていない。page (1).tsx は Next の page.tsx 入口ではないため、実画面数には数えない。

## まとめ（集計の定義を含む）

|項目|結果|
|---|---:|
|走査した src/app の page.tsx 入口数（API・旧版・テストを除く）|169|
|入力欄一覧の画面・機能群数（同じ画面の別小窓を含む）|59|
|主 URL の異なり数（別入口・別タブの網羅的な実画面数ではない）|50|
|保存対応を記載した論理入力欄数|612|
|うち外部保存（Kintone・Graph・KOT・INNOVERA）|34|
|うち「探さない」とした論理入力欄数|16|
|入力欄一覧の保存先 DB 表の異なり数（副次保存先も含む）|60|
|保存先表の合計行数|取得できず（EACCES）|

これらはこの報告書の F 番号行の集計であり、試作・保存しない認証入力・自動生成記録を含めて全画面の実運用を確認した総数ではない。1欄が複数の列・表へ保存される場合や、同一列を別画面から編集する場合がある。秘密欄の数も同じ DB 列を複数画面から扱う場合は画面ごとに数える。未接続のため表の存在・行数を検証した数ではない。

|モジュール表記|画面・機能群|論理入力欄|探さない欄|
|---|---:|---:|---:|
|Root|15|209|5|
|System|14|158|3|
|My・System・LIFF|1|27|1|
|My・LIFF・Root|1|4|2|
|System・M|2|18|0|
|My|1|13|0|
|System・Soil|3|25|0|
|System（共通）|1|3|0|
|Bud・M|1|16|0|
|Bud|7|66|4|
|Sprout|1|8|0|
|Rill|2|8|0|
|Bloom|3|10|0|
|Forest|1|9|0|
|Tree|2|7|1|
|P|1|25|0|
|System・My|3|6|0|

## 表ごとの行数

取得対象 SQL は次のとおり。実際は接続前に EACCES となり、SQL は DB 上で実行されていない。接続が確立していれば BEGIN READ ONLY の後に実行し、ROLLBACK で終了する構成で試行した。資格情報・接続 URL は報告書に転記していない。

```sql
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY schemaname, relname;
```

n_live_tup は統計上の概数であり、取得できても正確な COUNT ではない。表の合計は同一表を1回だけ足す。JSON の人数・通勤区間・明細数を DB 行数へ加算しない。

|保存先の表（コード上）|行数の目安|
|---|---|
|bloom_ceo_status|未取得（DB 接続 EACCES）|
|bloom_daily_logs|未取得（DB 接続 EACCES）|
|bloom_monthly_digests|未取得（DB 接続 EACCES）|
|bud_bb_viewers|未取得（DB 接続 EACCES）|
|bud_expense_requests|未取得（DB 接続 EACCES）|
|bud_mf_accounts|未取得（DB 接続 EACCES）|
|bud_mf_axis_order|未取得（DB 接続 EACCES）|
|bud_mf_group_viewers|未取得（DB 接続 EACCES）|
|bud_statements|未取得（DB 接続 EACCES）|
|bud_transfers|未取得（DB 接続 EACCES）|
|fiscal_periods|未取得（DB 接続 EACCES）|
|garden_intake_items|未取得（DB 接続 EACCES）|
|root_attendance|未取得（DB 接続 EACCES）|
|root_bank_accounts|未取得（DB 接続 EACCES）|
|root_companies|未取得（DB 接続 EACCES）|
|root_employee_my_numbers|未取得（DB 接続 EACCES）|
|root_employee_profile_history|未取得（DB 接続 EACCES）|
|root_employee_team_history|未取得（DB 接続 EACCES）|
|root_employees|未取得（DB 接続 EACCES）|
|root_insurance|未取得（DB 接続 EACCES）|
|root_mail_forwarding_filings|未取得（DB 接続 EACCES）|
|root_mail_forwardings|未取得（DB 接続 EACCES）|
|root_minimum_wages|未取得（DB 接続 EACCES）|
|root_payroll_notice|未取得（DB 接続 EACCES）|
|root_salary_systems|未取得（DB 接続 EACCES）|
|root_vendors|未取得（DB 接続 EACCES）|
|shinkouki|未取得（DB 接続 EACCES）|
|soil_call_history|未取得（DB 接続 EACCES）|
|soil_list_condition|未取得（DB 接続 EACCES）|
|soil_list_internal_block|未取得（DB 接続 EACCES）|
|soil_list_phone|未取得（DB 接続 EACCES）|
|sprout_baitoru_postings|未取得（DB 接続 EACCES）|
|sprout_baitoru_settings|未取得（DB 接続 EACCES）|
|system_ap_daily_report|未取得（DB 接続 EACCES）|
|system_bank_successors|未取得（DB 接続 EACCES）|
|system_contracts|未取得（DB 接続 EACCES）|
|system_dev_questions|未取得（DB 接続 EACCES）|
|system_employment_contracts|未取得（DB 接続 EACCES）|
|system_expense_report|未取得（DB 接続 EACCES）|
|system_hire_candidates|未取得（DB 接続 EACCES）|
|system_innovera_daily_extension|未取得（DB 接続 EACCES）|
|system_kanri_month_setting|未取得（DB 接続 EACCES）|
|system_kanri_person|未取得（DB 接続 EACCES）|
|system_kanri_result|未取得（DB 接続 EACCES）|
|system_line_broadcast|未取得（DB 接続 EACCES）|
|system_line_contact|未取得（DB 接続 EACCES）|
|system_line_greeting|未取得（DB 接続 EACCES）|
|system_line_tag|未取得（DB 接続 EACCES）|
|system_line_tag_member|未取得（DB 接続 EACCES）|
|system_line_target|未取得（DB 接続 EACCES）|
|system_manual_versions|未取得（DB 接続 EACCES）|
|system_mypage_submissions|未取得（DB 接続 EACCES）|
|system_nhk_visit_report|未取得（DB 接続 EACCES）|
|system_onboarding|未取得（DB 接続 EACCES）|
|system_shukkin_member|未取得（DB 接続 EACCES）|
|system_site_news|未取得（DB 接続 EACCES）|
|system_site_notify_recipients|未取得（DB 接続 EACCES）|
|system_view_permissions|未取得（DB 接続 EACCES）|
|system_zenkaku_check_request|未取得（DB 接続 EACCES）|
|system_zenkaku_submission|未取得（DB 接続 EACCES）|

派生先の bud_employee_bank_accounts、root_employee_profile_current（最新値のビュー / 読み取りモデル）、自動監査ログ、取り込み元表、外部 Kintone・Graph・KOT は上表の手入力主保存先の集計と区別する。これらも含めた全 DB の合計行数を求めた結果ではない。

## 保存後の確認

- この報告書は UTF-8、BOM なしで保存した。保存後にファイル全体を UTF-8 の厳密デコードで読み直し、BOM・不正な UTF-8・置換文字 U+FFFD がないことを確認した。日本語の見出し・入力欄・権限説明・集計を再読し、日本語が ? に置き換わった文字化けがないことを確認した。ソース式や URL に含まれる本来の ? はそのまま記載している。
- src 配下 2,190 ファイルについて、調査中に取得した SHA-256 と報告書完成時の SHA-256 を照合し、追加・削除・内容変更は 0 件だった。git は検証にも使用していない。
- DB は接続失敗のためデータを読み出していない。DB へ書き込む SQL・API は実行していない。src・設定・migration・指示書の変更も行っていない。
