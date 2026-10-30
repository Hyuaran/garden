# Codex-497b 全体検索 DB 側絞り込み 実装報告

実装日：2026-10-30

## 変更内容

- src/lib/search/search.server.ts：通常の検索対象は ilike("search_text", pattern).limit(21) で DB 内で候補を絞ります。全行の1,000件単位の読み出しを廃止しました。Promise.all による並列処理、select の許可列、既存の eq / in / is、RLS、本人・状態・権限条件は維持しています。
- 検索語は NFKC・小文字・カンマ除去で正規化し、LIKE の %・_・バックスラッシュをエスケープします。日付と電話の検索語の区切りは維持します。
- 返却候補は既存の rowHit と limitHits で照合・順位付け・表示します。bud_mf_accounts は既存どおり全件を読み、visibleAccounts を適用してから照合します。
- supabase/migrations/20261030000497_search_text.sql：53 source が参照する51表について fields と title の和集合を記録し、生成列 search_text と GIN / gin_trgm_ops 索引を作ります。soil_list_phone は含みません。JSON は catalog の select が指定するキーだけを -> / ->> で抽出します。
- search_norm は NFKC・小文字、カンマなし、電話指定列のハイフン・空白なしの表記を追加します。日付・日時は YYYY-MM-DD と YYYY/MM/DD の両方を追加します。
- IMMUTABLE な専用 SQL 関数で concat_ws、型の文字列化、日付書式を処理します。文字列化は UTC・ISO/YMD・IntervalStyle・extra_float_digits を固定し、timestamptz の日付も UTC で決定します。
- cron・定期再取得の追加はありません。追加される定期実行回数は1日0回です。

## 適用順と確認事項

1. Claude が DB のバックアップ・作業時間を確認し、先に migration を適用してください。保存生成列の計算と通常の CREATE INDEX によるロック・負荷があるため、表の件数に応じた作業時間を確保してください。pg_trgm は既存導入済みという指示に従っています。
2. migration の NOTICE（表なし・列なし）を確認してください。適用時に information_schema.columns と to_regclass で実 DB に存在する表・列だけを使います。重複 source は表ごとにまとめています。この migration は既存 search_text を置き換えず、再実行時は重複列で停止します。
3. 通常検索対象の search_text と索引が作成されたことを確認してからアプリを反映してください。先にアプリを反映すると、未作成列を使う source が検索から欠落します。元の catalog の select 自体に欠けた列がある場合も既存の source エラー処理になるため、NOTICE の対象と合わせて確認してください。
4. 本番で日本語・全角・金額のカンマ・電話・日付・権限別の検索を行い、応答時間1秒以内の目標を実測してください。21件の候補に対して既存 rowHit で順位付けするため、DB 上の全候補を順位付けする処理ではありません。

## テストと制約

- npx tsc --noEmit：成功。
- npx vitest run src/lib/search src/app/api/search src/app/_components/search：5ファイル、21件成功。
- DB 絞り込み後の候補だけを使うこと（先頭1,001件が不一致のケースを含む）、21件制限、LIKE エスケープ、権限・本人・状態条件、秘密列の非選択、口座の別経路をテストしました。
- migration の静的テストで catalog と表・列・JSON パス・phone 指定の完全一致、表ごとの和集合、全体 JSON 化の不使用、存在確認、保存生成列・索引・IMMUTABLE 宣言と固定出力設定を確認しました。
- .tmp_chk.mts と同様の information_schema 照合を READ ONLY 接続で試みましたが、この環境では PostgreSQL 宛て通信が EACCES で拒否されました。実 DB との事前照合は未完了です。migration 内の適用時照合で欠けた表・列を除外します。
- PostgreSQL 実行環境・SQL パーサーを利用できず、DB による SQL 構文検証、関数の実行・生成列作成可否、索引利用の確認は未実施です。SQL は静的テストと読み直しまでです。migration は適用していません。
- 本番の応答時間は未測定です。1秒以内の達成は未確認です。
- git 操作は一切行っていません。
- 変更ファイルは UTF-8 として書き、UTF-8 の厳密デコードと日本語の読み戻しを確認しました。

## migration 対象の許可列（表ごとの和集合）

以下は適用時の存在確認前の許可リストです。実 DB の有無を確認済みという意味ではありません。→ は JSON キーの経路、（電話）は電話用の表記も追加する列です。

- root_employees：employee_id、employee_number、company_id、name、name_kana、line_contact_url、email、employment_type、salary_system_id、insurance_type、garden_role、hire_date、birthday、termination_date、contract_end_on、business、account_holder、kou_otsu、dependents_count、kot_employee_id、innovera_extension、innovera_mobile_extension（電話）、filemaker_employee_name、mf_employee_id、call_recording_access、chatwork_account_id、notes
- root_companies：company_id、default_bank、company_name、company_name_kana、phone（電話）、fax（電話）、fiscal_end_month、established_on、domain、website、address、corporate_number、invoice_registration_number、telecom_notification_number、employment_insurance_number、labor_insurance_number、agency_notification_number、industry_classification、tax_office、representative、representative_kana、representative_gender、representative_birthday、representative_mobile（電話）、representative_address、contact1_name、contact1_phone（電話）、contact2_name、contact2_phone（電話）
- root_vendors：vendor_id、vendor_type、vendor_name、vendor_name_kana、bank_name、bank_code、branch_name、branch_code、account_type、account_holder_kana、fee_bearer、company_id、notes
- root_bank_accounts：corp_code、bank_code、branch_name、branch_code、account_type、sub_account_label、has_csv_export、needs_manual_balance、notes
- root_salary_systems：salary_system_id、system_name、employment_type、base_salary_type、working_hours_day、working_days_month、overtime_rate、night_overtime_rate、holiday_overtime_rate、notes
- root_insurance：insurance_id、fiscal_year、effective_from、effective_to、health_insurance_rate、nursing_insurance_rate、pension_rate、employment_insurance_rate、child_support_rate
- root_attendance：attendance_id、employee_id、target_month、working_days、absence_days、paid_leave_days、scheduled_hours、actual_hours、overtime_hours、legal_overtime_hours、night_hours、holiday_hours、late_hours、early_leave_hours、training_hours、office_hours、import_status
- root_employee_team_history：effective_date、team、memo
- root_employee_profile_history：payload→bank_name、payload→bank_code、payload→account_type、payload→branch_name、payload→branch_code、payload→holder_kana、payload→postal_code、payload→prefecture、payload→city、payload→town、payload→building、payload→room、payload→phone（電話）、payload→phone_1（電話）、payload→phone_2（電話）、payload→phone_3（電話）、payload→sub_account→bank_name、payload→sub_account→bank_code、payload→sub_account→branch_name、payload→sub_account→branch_code、payload→sub_account→account_type、payload→sub_account→holder_kana、payload→one_way、payload→monthly_cap、payload→nearest_station、payload→route、payload→paid、payload→business、payload→department、payload→affiliation、payload→base_hourly、payload→training_hourly、payload→training_cap、payload→year_end_adjustment、payload→social_insurance、payload→employment_insurance、payload→employment_insurance_no、payload→pension_no、payload→advance_pay、payload→call_type、employee_id
- system_employment_contracts：employee_id、payload→kind、payload→salaryKind、payload→weeklyHours、payload→contractStart、payload→contractEnd、payload→hourlyWage、payload→concludedOn、payload→workLocation、payload→employeeAddress、payload→jobType、payload→jobTypeOther、payload→templateType、payload→indefinite、payload→renewalText、payload→commuteCap、payload→duties、payload→workHours、payload→fixedOvertime、payload→startTime、payload→endTime、payload→breakMinutes
- system_mypage_submissions：proposed_one_way、payload→count、payload→details、payload→effectiveDate、payload→note、payload→selfAddress、payload→selfPhone（電話）、payload→ecName、payload→ecRelationship、payload→ecAddress、payload→ecPhone（電話）、payload→kind、payload→station、payload→bankName、payload→bankCode、payload→branchName、payload→branchCode、payload→holderKana、payload→desiredDate、payload→reason、payload→pledgeDate、payload→address、payload→signature、payload→agreed、submission_type
- system_ap_daily_report：report_date、kind、start_time、end_time、work_minutes、count、month_total、coin_created、guide_promised、guide_in_progress、statement_check_request、coin_total、reflection
- root_payroll_notice：team、commute_flag、commute_people、training_flag、training_people、referral_flag、referral_people、other_notes
- system_shukkin_member：group_name、display_name、sort_order
- system_bank_successors：old_bank_code、old_branch_code、new_bank_code、new_branch_code、effective_date、note
- root_minimum_wages：prefecture、hourly_amount、effective_from、source_url
- root_mail_forwardings：holder、from_address、to_address、notes、stopped
- root_mail_forwarding_filings：filed_on、method、receipt、filed_by、notes
- system_onboarding：name、name_kana、gender、birth_date、postal_code、address、address_kana、phone（電話）、email、householder_name、householder_relation、pension_number、employment_insurance_status、employment_insurance_number、previous_employer、previous_employer_from、previous_employer_to、commute_method、bank_name、bank_code、branch_name、branch_code、account_type、account_holder_kana、emergency_name、emergency_relation、emergency_relation_other、emergency_address、emergency_phone（電話）、commute_routes、nda_agreed_at、office、weekly_hours、health_insurance、pension_insurance、employment_insurance、tax_class、salary_kind、base_salary、allowances、commute_cap_monthly、commute_fixed_monthly
- system_hire_candidates：last_name、first_name、last_name_kana、first_name_kana、birthday、gender、hire_date、employment_type、company_id、kot_division_code、kot_type_code、checklist
- system_expense_report：form、business、payment、paid_on、amount、purpose、purpose_detail、note
- system_nhk_visit_report：visit_date、start_time、end_time、destination、new_ground、new_satellite、address_ground、address_satellite、bank_credit、transport_fee
- system_contracts：counterparty、company_id、contract_type、concluded_on、note、drive_file_id、product
- system_dev_questions：title、module、body、answer_type、options、answer_choice、answer_text_raw、answer_text
- system_site_news：company_id、published_on、title、body、is_published
- system_kanri_person：name、kot_name、team、department、employment_kind、base_wage、is_field_sales、active
- system_kanri_month_setting：holidays、year_month
- soil_list_condition：name、condition
- soil_list_internal_block：電話番号（電話）、理由、解除理由
- system_line_broadcast：title、body、tag_ids
- system_line_tag：name
- system_line_tag_member：tag_id
- system_line_greeting：employment_tag_id、business_tag_id、body、enabled
- system_line_contact：employee_id
- system_line_target：label、chatwork_room_id、notify_enabled
- bud_expense_requests：expense_kind、corp_id、receipt_date、receipt_time、store_name、amount、qualified_class、qualified_number、category_id、description、receipt_rotation、return_reason、booking_date、booking_corp_id、fiscal_period、storage_path
- bud_transfers：data_source、payment_category、request_company_id、execute_company_id、source_account_id、vendor_id、payee_name、payee_bank_name、payee_bank_code、payee_branch_name、payee_branch_code、payee_account_type、payee_account_holder_kana、registered_method、payeasy_biller_no、amount、fee_bearer、scheduled_date、due_date、description、invoice_pdf_url、scan_image_url、cashback_applicant_name、cashback_applicant_name_kana、cashback_applicant_phone（電話）、cashback_product_name、cashback_channel_name、rejection_reason、manual_paid_at
- bud_mf_accounts：mail_alias、hidden、book_sub_account_name、balance_mode、anchor_balance、anchor_at、anchor_date、balance_note、visible_employee_ids、sort_order、name
- bud_mf_group_viewers：employee_ids、kind
- bud_mf_axis_order：sort_order、key
- bud_bb_viewers：employee_ids、id
- sprout_baitoru_postings：start_date、end_date、content
- sprout_baitoru_settings：content_options、exclude_inquiry_nos、notify_room、mention_employee_ids、max_per_run
- bloom_monthly_digests：title、summary、pages
- bloom_daily_logs：planned_items、log_date
- bloom_ceo_status：status、summary
- shinkouki：uriage、gaichuhi、rieki、reflected、zantei、company_id
- fiscal_periods：junshisan、genkin、yokin、doc_url、company_id
- system_innovera_daily_extension：extension
- system_zenkaku_check_request：sales_id
- system_zenkaku_submission：selected_partner_code、duplicate_confirmed
