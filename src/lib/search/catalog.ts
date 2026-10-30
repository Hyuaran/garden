// Reviewed allowlist derived from input inventory F0001-F0612. No wildcard selects.
export type SearchSource = { key: string; table: string; page: string; tab: string; client: string; pk: string; title: string; date: string; href: string; label: string; module: string; fields: { column: string; select?: string; label: string; phone: boolean }[] };
export const SEARCH_SOURCES: SearchSource[] = [
  {
    "key": "root_employees",
    "table": "root_employees",
    "page": "root-employees",
    "tab": "",
    "client": "admin",
    "pk": "employee_id",
    "title": "name",
    "date": "updated_at",
    "href": "/root/employees",
    "label": "従業員マスタ",
    "module": "Root",
    "fields": [
      {
        "column": "employee_id",
        "label": "従業員ID",
        "phone": false
      },
      {
        "column": "employee_number",
        "label": "社員番号",
        "phone": false
      },
      {
        "column": "company_id",
        "label": "所属法人",
        "phone": false
      },
      {
        "column": "name",
        "label": "氏名",
        "phone": false
      },
      {
        "column": "name_kana",
        "label": "氏名カナ",
        "phone": false
      },
      {
        "column": "line_contact_url",
        "label": "公式 LINE の連絡先",
        "phone": false
      },
      {
        "column": "email",
        "label": "メールアドレス",
        "phone": false
      },
      {
        "column": "employment_type",
        "label": "雇用形態",
        "phone": false
      },
      {
        "column": "salary_system_id",
        "label": "給与体系",
        "phone": false
      },
      {
        "column": "insurance_type",
        "label": "社会保険区分",
        "phone": false
      },
      {
        "column": "garden_role",
        "label": "Garden権限",
        "phone": false
      },
      {
        "column": "hire_date",
        "label": "入社日",
        "phone": false
      },
      {
        "column": "birthday",
        "label": "生年月日",
        "phone": false
      },
      {
        "column": "termination_date",
        "label": "退職日",
        "phone": false
      },
      {
        "column": "contract_end_on",
        "label": "契約終了日（外注）",
        "phone": false
      },
      {
        "column": "business",
        "label": "事業",
        "phone": false
      },
      {
        "column": "account_holder",
        "label": "口座名義",
        "phone": false
      },
      {
        "column": "kou_otsu",
        "label": "年末調整 甲/乙欄",
        "phone": false
      },
      {
        "column": "dependents_count",
        "label": "扶養家族人数（0〜20）",
        "phone": false
      },
      {
        "column": "kot_employee_id",
        "label": "キングオブタイムID",
        "phone": false
      },
      {
        "column": "innovera_extension",
        "label": "INNOVERA 内線番号（PC）",
        "phone": false
      },
      {
        "column": "innovera_mobile_extension",
        "label": "INNOVERA 内線番号（モバイル）",
        "phone": true
      },
      {
        "column": "filemaker_employee_name",
        "label": "FileMaker 社員名",
        "phone": false
      },
      {
        "column": "mf_employee_id",
        "label": "マネーフォワード クラウド給与 ID",
        "phone": false
      },
      {
        "column": "call_recording_access",
        "label": "INNOVERA録音の権限",
        "phone": false
      },
      {
        "column": "chatwork_account_id",
        "label": "Chatwork ID",
        "phone": false
      },
      {
        "column": "notes",
        "label": "備考",
        "phone": false
      }
    ]
  },
  {
    "key": "root_companies",
    "table": "root_companies",
    "page": "root-companies",
    "tab": "",
    "client": "admin",
    "pk": "company_id",
    "title": "company_name",
    "date": "updated_at",
    "href": "/root/companies",
    "label": "法人マスタ",
    "module": "Root",
    "fields": [
      {
        "column": "company_id",
        "label": "法人ID",
        "phone": false
      },
      {
        "column": "default_bank",
        "label": "デフォルト振込銀行",
        "phone": false
      },
      {
        "column": "company_name",
        "label": "法人名",
        "phone": false
      },
      {
        "column": "company_name_kana",
        "label": "法人名カナ",
        "phone": false
      },
      {
        "column": "phone",
        "label": "電話番号",
        "phone": true
      },
      {
        "column": "fax",
        "label": "FAX番号",
        "phone": true
      },
      {
        "column": "fiscal_end_month",
        "label": "決算月",
        "phone": false
      },
      {
        "column": "established_on",
        "label": "設立日",
        "phone": false
      },
      {
        "column": "domain",
        "label": "メールドメイン",
        "phone": false
      },
      {
        "column": "website",
        "label": "Webサイト",
        "phone": false
      },
      {
        "column": "address",
        "label": "本店所在地",
        "phone": false
      },
      {
        "column": "corporate_number",
        "label": "法人番号（13桁）",
        "phone": false
      },
      {
        "column": "invoice_registration_number",
        "label": "インボイス登録番号",
        "phone": false
      },
      {
        "column": "telecom_notification_number",
        "label": "電気通信事業届出番号",
        "phone": false
      },
      {
        "column": "employment_insurance_number",
        "label": "雇用保険事業所番号",
        "phone": false
      },
      {
        "column": "labor_insurance_number",
        "label": "労働保険番号",
        "phone": false
      },
      {
        "column": "agency_notification_number",
        "label": "代理店届出番号",
        "phone": false
      },
      {
        "column": "industry_classification",
        "label": "産業分類番号",
        "phone": false
      },
      {
        "column": "tax_office",
        "label": "管轄税務署",
        "phone": false
      },
      {
        "column": "representative",
        "label": "代表者名",
        "phone": false
      },
      {
        "column": "representative_kana",
        "label": "代表者名カナ",
        "phone": false
      },
      {
        "column": "representative_gender",
        "label": "代表者性別",
        "phone": false
      },
      {
        "column": "representative_birthday",
        "label": "代表者生年月日",
        "phone": false
      },
      {
        "column": "representative_mobile",
        "label": "代表者携帯番号",
        "phone": true
      },
      {
        "column": "representative_address",
        "label": "代表者住所",
        "phone": false
      },
      {
        "column": "contact",
        "label": "担当者1 氏名",
        "phone": false
      }
    ]
  },
  {
    "key": "root_vendors",
    "table": "root_vendors",
    "page": "root-vendors",
    "tab": "",
    "client": "admin",
    "pk": "vendor_id",
    "title": "vendor_name",
    "date": "updated_at",
    "href": "/root/vendors",
    "label": "取引先",
    "module": "Root",
    "fields": [
      {
        "column": "vendor_id",
        "label": "取引先ID",
        "phone": false
      },
      {
        "column": "vendor_type",
        "label": "区分",
        "phone": false
      },
      {
        "column": "vendor_name",
        "label": "取引先名",
        "phone": false
      },
      {
        "column": "vendor_name_kana",
        "label": "取引先名カナ",
        "phone": false
      },
      {
        "column": "bank_name",
        "label": "銀行名",
        "phone": false
      },
      {
        "column": "bank_code",
        "label": "金融機関コード（4桁）",
        "phone": false
      },
      {
        "column": "branch_name",
        "label": "支店名",
        "phone": false
      },
      {
        "column": "branch_code",
        "label": "支店コード（3桁）",
        "phone": false
      },
      {
        "column": "account_type",
        "label": "口座種別",
        "phone": false
      },
      {
        "column": "account_holder_kana",
        "label": "口座名義カナ（全角）",
        "phone": false
      },
      {
        "column": "fee_bearer",
        "label": "手数料負担",
        "phone": false
      },
      {
        "column": "company_id",
        "label": "担当法人",
        "phone": false
      },
      {
        "column": "notes",
        "label": "備考",
        "phone": false
      }
    ]
  },
  {
    "key": "root_bank_accounts",
    "table": "root_bank_accounts",
    "page": "root-bank-accounts",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "sub_account_label",
    "date": "updated_at",
    "href": "/root/bank-accounts",
    "label": "銀行口座",
    "module": "Root",
    "fields": [
      {
        "column": "corp_code",
        "label": "法人",
        "phone": false
      },
      {
        "column": "bank_code",
        "label": "銀行",
        "phone": false
      },
      {
        "column": "branch_name",
        "label": "支店名",
        "phone": false
      },
      {
        "column": "branch_code",
        "label": "支店コード（3桁）",
        "phone": false
      },
      {
        "column": "account_type",
        "label": "口座種別",
        "phone": false
      },
      {
        "column": "sub_account_label",
        "label": "弥生の補助科目名",
        "phone": false
      },
      {
        "column": "has_csv_export",
        "label": "CSV 出力",
        "phone": false
      },
      {
        "column": "needs_manual_balance",
        "label": "残高の手入力が必要",
        "phone": false
      },
      {
        "column": "notes",
        "label": "メモ",
        "phone": false
      }
    ]
  },
  {
    "key": "root_salary_systems",
    "table": "root_salary_systems",
    "page": "root-salary-systems",
    "tab": "",
    "client": "admin",
    "pk": "salary_system_id",
    "title": "system_name",
    "date": "updated_at",
    "href": "/root/salary-systems",
    "label": "給与体系",
    "module": "Root",
    "fields": [
      {
        "column": "salary_system_id",
        "label": "給与体系ID",
        "phone": false
      },
      {
        "column": "system_name",
        "label": "体系名",
        "phone": false
      },
      {
        "column": "employment_type",
        "label": "対象雇用形態",
        "phone": false
      },
      {
        "column": "base_salary_type",
        "label": "基本給計算方法",
        "phone": false
      },
      {
        "column": "working_hours_day",
        "label": "所定労働時間（日）",
        "phone": false
      },
      {
        "column": "working_days_month",
        "label": "所定労働日数（月）",
        "phone": false
      },
      {
        "column": "overtime_rate",
        "label": "残業単価倍率（法定外）",
        "phone": false
      },
      {
        "column": "night_overtime_rate",
        "label": "残業単価倍率（深夜）",
        "phone": false
      },
      {
        "column": "holiday_overtime_rate",
        "label": "残業単価倍率（休日）",
        "phone": false
      },
      {
        "column": "notes",
        "label": "備考",
        "phone": false
      }
    ]
  },
  {
    "key": "root_insurance",
    "table": "root_insurance",
    "page": "root-insurance",
    "tab": "",
    "client": "admin",
    "pk": "insurance_id",
    "title": "fiscal_year",
    "date": "updated_at",
    "href": "/root/insurance",
    "label": "社会保険",
    "module": "Root",
    "fields": [
      {
        "column": "insurance_id",
        "label": "保険マスタID",
        "phone": false
      },
      {
        "column": "fiscal_year",
        "label": "適用年度（4桁）",
        "phone": false
      },
      {
        "column": "effective_from",
        "label": "適用開始日",
        "phone": false
      },
      {
        "column": "effective_to",
        "label": "適用終了日",
        "phone": false
      },
      {
        "column": "health_insurance_rate",
        "label": "健康保険料率（%）",
        "phone": false
      },
      {
        "column": "nursing_insurance_rate",
        "label": "介護保険料率（%）",
        "phone": false
      },
      {
        "column": "pension_rate",
        "label": "厚生年金保険料率（%）",
        "phone": false
      },
      {
        "column": "employment_insurance_rate",
        "label": "雇用保険料率（%）",
        "phone": false
      },
      {
        "column": "child_support_rate",
        "label": "子ども・子育て支援金率（%）",
        "phone": false
      }
    ]
  },
  {
    "key": "root_attendance",
    "table": "root_attendance",
    "page": "root-attendance",
    "tab": "",
    "client": "admin",
    "pk": "attendance_id",
    "title": "employee_id",
    "date": "updated_at",
    "href": "/root/attendance",
    "label": "勤怠データ",
    "module": "Root",
    "fields": [
      {
        "column": "attendance_id",
        "label": "勤怠ID",
        "phone": false
      },
      {
        "column": "employee_id",
        "label": "従業員",
        "phone": false
      },
      {
        "column": "target_month",
        "label": "対象月（YYYY-MM）",
        "phone": false
      },
      {
        "column": "working_days",
        "label": "出勤日数",
        "phone": false
      },
      {
        "column": "absence_days",
        "label": "欠勤日数",
        "phone": false
      },
      {
        "column": "paid_leave_days",
        "label": "有給取得日数",
        "phone": false
      },
      {
        "column": "scheduled_hours",
        "label": "所定労働時間",
        "phone": false
      },
      {
        "column": "actual_hours",
        "label": "実労働時間",
        "phone": false
      },
      {
        "column": "overtime_hours",
        "label": "所定外時間（平日）",
        "phone": false
      },
      {
        "column": "legal_overtime_hours",
        "label": "法定外時間（平日）",
        "phone": false
      },
      {
        "column": "night_hours",
        "label": "深夜時間",
        "phone": false
      },
      {
        "column": "holiday_hours",
        "label": "休日出勤時間",
        "phone": false
      },
      {
        "column": "late_hours",
        "label": "遅刻時間",
        "phone": false
      },
      {
        "column": "early_leave_hours",
        "label": "早退時間",
        "phone": false
      },
      {
        "column": "training_hours",
        "label": "研修時間（任意）",
        "phone": false
      },
      {
        "column": "office_hours",
        "label": "事務時間（任意）",
        "phone": false
      },
      {
        "column": "import_status",
        "label": "取込ステータス",
        "phone": false
      }
    ]
  },
  {
    "key": "root_employee_team_history",
    "table": "root_employee_team_history",
    "page": "root-employees",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "team",
    "date": "entered_at",
    "href": "/root/employees",
    "label": "従業員マスタ",
    "module": "Root",
    "fields": [
      {
        "column": "effective_date",
        "label": "移動日",
        "phone": false
      },
      {
        "column": "team",
        "label": "チーム",
        "phone": false
      },
      {
        "column": "memo",
        "label": "メモ",
        "phone": false
      }
    ]
  },
  {
    "key": "root_employee_profile_history",
    "table": "root_employee_profile_history",
    "page": "root-employees",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "employee_id",
    "date": "recorded_at",
    "href": "/root/employees",
    "label": "従業員マスタ",
    "module": "Root",
    "fields": [
      {
        "column": "safe_bank_name",
        "select": "safe_bank_name:payload->bank_name",
        "label": "銀行名",
        "phone": false
      },
      {
        "column": "safe_bank_code",
        "select": "safe_bank_code:payload->bank_code",
        "label": "金融機関コード（4桁）",
        "phone": false
      },
      {
        "column": "safe_account_type",
        "select": "safe_account_type:payload->account_type",
        "label": "口座種別",
        "phone": false
      },
      {
        "column": "safe_branch_name",
        "select": "safe_branch_name:payload->branch_name",
        "label": "支店名",
        "phone": false
      },
      {
        "column": "safe_branch_code",
        "select": "safe_branch_code:payload->branch_code",
        "label": "支店コード（3桁）",
        "phone": false
      },
      {
        "column": "safe_holder_kana",
        "select": "safe_holder_kana:payload->holder_kana",
        "label": "口座名義カナ",
        "phone": false
      },
      {
        "column": "safe_postal_code",
        "select": "safe_postal_code:payload->postal_code",
        "label": "郵便番号",
        "phone": false
      },
      {
        "column": "safe_prefecture",
        "select": "safe_prefecture:payload->prefecture",
        "label": "都道府県",
        "phone": false
      },
      {
        "column": "safe_city",
        "select": "safe_city:payload->city",
        "label": "市町村",
        "phone": false
      },
      {
        "column": "safe_town",
        "select": "safe_town:payload->town",
        "label": "町域",
        "phone": false
      },
      {
        "column": "safe_building",
        "select": "safe_building:payload->building",
        "label": "建物名",
        "phone": false
      },
      {
        "column": "safe_room",
        "select": "safe_room:payload->room",
        "label": "部屋番号",
        "phone": false
      },
      {
        "column": "safe_phone",
        "select": "safe_phone:payload->phone",
        "label": "連絡先",
        "phone": true
      },
      {
        "column": "safe_phone_1",
        "select": "safe_phone_1:payload->phone_1",
        "label": "連絡先1",
        "phone": true
      },
      {
        "column": "safe_phone_2",
        "select": "safe_phone_2:payload->phone_2",
        "label": "連絡先2",
        "phone": true
      },
      {
        "column": "safe_phone_3",
        "select": "safe_phone_3:payload->phone_3",
        "label": "連絡先3",
        "phone": true
      },
      {
        "column": "safe_sub_account_bank_name",
        "select": "safe_sub_account_bank_name:payload->sub_account->bank_name",
        "label": "口座2 銀行名",
        "phone": false
      },
      {
        "column": "safe_sub_account_bank_code",
        "select": "safe_sub_account_bank_code:payload->sub_account->bank_code",
        "label": "口座2 金融機関コード",
        "phone": false
      },
      {
        "column": "safe_sub_account_branch_name",
        "select": "safe_sub_account_branch_name:payload->sub_account->branch_name",
        "label": "口座2 支店名",
        "phone": false
      },
      {
        "column": "safe_sub_account_branch_code",
        "select": "safe_sub_account_branch_code:payload->sub_account->branch_code",
        "label": "口座2 支店コード",
        "phone": false
      },
      {
        "column": "safe_sub_account_account_type",
        "select": "safe_sub_account_account_type:payload->sub_account->account_type",
        "label": "口座2 種別",
        "phone": false
      },
      {
        "column": "safe_sub_account_holder_kana",
        "select": "safe_sub_account_holder_kana:payload->sub_account->holder_kana",
        "label": "口座2 名義カナ",
        "phone": false
      },
      {
        "column": "safe_one_way",
        "select": "safe_one_way:payload->one_way",
        "label": "交通費 片道",
        "phone": false
      },
      {
        "column": "safe_monthly_cap",
        "select": "safe_monthly_cap:payload->monthly_cap",
        "label": "交通費上限",
        "phone": false
      },
      {
        "column": "safe_nearest_station",
        "select": "safe_nearest_station:payload->nearest_station",
        "label": "最寄り駅",
        "phone": false
      },
      {
        "column": "safe_route",
        "select": "safe_route:payload->route",
        "label": "通勤経路",
        "phone": false
      },
      {
        "column": "safe_paid",
        "select": "safe_paid:payload->paid",
        "label": "交通費支給",
        "phone": false
      },
      {
        "column": "safe_business",
        "select": "safe_business:payload->business",
        "label": "事業名（旧区分・Root の「事業」とは別の項目）",
        "phone": false
      },
      {
        "column": "safe_department",
        "select": "safe_department:payload->department",
        "label": "部署名",
        "phone": false
      },
      {
        "column": "safe_affiliation",
        "select": "safe_affiliation:payload->affiliation",
        "label": "所属",
        "phone": false
      },
      {
        "column": "safe_base_hourly",
        "select": "safe_base_hourly:payload->base_hourly",
        "label": "基準時給",
        "phone": false
      },
      {
        "column": "safe_training_hourly",
        "select": "safe_training_hourly:payload->training_hourly",
        "label": "研修時給",
        "phone": false
      },
      {
        "column": "safe_training_cap",
        "select": "safe_training_cap:payload->training_cap",
        "label": "研修上限",
        "phone": false
      },
      {
        "column": "safe_year_end_adjustment",
        "select": "safe_year_end_adjustment:payload->year_end_adjustment",
        "label": "年末調整",
        "phone": false
      },
      {
        "column": "safe_social_insurance",
        "select": "safe_social_insurance:payload->social_insurance",
        "label": "社会保険",
        "phone": false
      },
      {
        "column": "safe_employment_insurance",
        "select": "safe_employment_insurance:payload->employment_insurance",
        "label": "雇用保険",
        "phone": false
      },
      {
        "column": "safe_employment_insurance_no",
        "select": "safe_employment_insurance_no:payload->employment_insurance_no",
        "label": "雇用保険番号",
        "phone": false
      },
      {
        "column": "safe_pension_no",
        "select": "safe_pension_no:payload->pension_no",
        "label": "年金番号",
        "phone": false
      },
      {
        "column": "safe_advance_pay",
        "select": "safe_advance_pay:payload->advance_pay",
        "label": "前払い希望",
        "phone": false
      },
      {
        "column": "safe_call_type",
        "select": "safe_call_type:payload->call_type",
        "label": "架電区分",
        "phone": false
      }
    ]
  },
  {
    "key": "system_employment_contracts",
    "table": "system_employment_contracts",
    "page": "root-contracts",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "employee_id",
    "date": "created_at",
    "href": "/root/contracts",
    "label": "契約書",
    "module": "Root",
    "fields": [
      {
        "column": "employee_id",
        "label": "従業員",
        "phone": false
      },
      {
        "column": "safe_kind",
        "select": "safe_kind:payload->kind",
        "label": "新規 / 更新",
        "phone": false
      },
      {
        "column": "safe_salaryKind",
        "select": "safe_salaryKind:payload->salaryKind",
        "label": "給与区分",
        "phone": false
      },
      {
        "column": "safe_weeklyHours",
        "select": "safe_weeklyHours:payload->weeklyHours",
        "label": "週の所定時間",
        "phone": false
      },
      {
        "column": "safe_contractStart",
        "select": "safe_contractStart:payload->contractStart",
        "label": "契約期間（から）",
        "phone": false
      },
      {
        "column": "safe_contractEnd",
        "select": "safe_contractEnd:payload->contractEnd",
        "label": "契約期間（まで）",
        "phone": false
      },
      {
        "column": "safe_hourlyWage",
        "select": "safe_hourlyWage:payload->hourlyWage",
        "label": "基本賃金（時給・円 / 月給・円）",
        "phone": false
      },
      {
        "column": "safe_concludedOn",
        "select": "safe_concludedOn:payload->concludedOn",
        "label": "通知日及び締結日",
        "phone": false
      },
      {
        "column": "safe_workLocation",
        "select": "safe_workLocation:payload->workLocation",
        "label": "就業場所",
        "phone": false
      },
      {
        "column": "safe_employeeAddress",
        "select": "safe_employeeAddress:payload->employeeAddress",
        "label": "従業員住所（任意）",
        "phone": false
      },
      {
        "column": "safe_jobType",
        "select": "safe_jobType:payload->jobType",
        "label": "業務内容",
        "phone": false
      },
      {
        "column": "safe_jobTypeOther",
        "select": "safe_jobTypeOther:payload->jobTypeOther",
        "label": "その他の業務内容",
        "phone": false
      },
      {
        "column": "safe_templateType",
        "select": "safe_templateType:payload->templateType",
        "label": "契約書の種類",
        "phone": false
      },
      {
        "column": "safe_indefinite",
        "select": "safe_indefinite:payload->indefinite",
        "label": "雇用期間",
        "phone": false
      },
      {
        "column": "safe_renewalText",
        "select": "safe_renewalText:payload->renewalText",
        "label": "契約更新",
        "phone": false
      },
      {
        "column": "safe_commuteCap",
        "select": "safe_commuteCap:payload->commuteCap",
        "label": "通勤手当の月額上限（円）",
        "phone": false
      },
      {
        "column": "safe_duties",
        "select": "safe_duties:payload->duties",
        "label": "業務内容（本文）",
        "phone": false
      },
      {
        "column": "safe_workHours",
        "select": "safe_workHours:payload->workHours",
        "label": "就業時間",
        "phone": false
      },
      {
        "column": "safe_fixedOvertime",
        "select": "safe_fixedOvertime:payload->fixedOvertime",
        "label": "固定残業",
        "phone": false
      },
      {
        "column": "safe_startTime",
        "select": "safe_startTime:payload->startTime",
        "label": "始業",
        "phone": false
      },
      {
        "column": "safe_endTime",
        "select": "safe_endTime:payload->endTime",
        "label": "終業",
        "phone": false
      },
      {
        "column": "safe_breakMinutes",
        "select": "safe_breakMinutes:payload->breakMinutes",
        "label": "休憩（分）",
        "phone": false
      }
    ]
  },
  {
    "key": "system_mypage_submissions",
    "table": "system_mypage_submissions",
    "page": "system-mypage",
    "tab": "",
    "client": "own-employee",
    "pk": "id",
    "title": "submission_type",
    "date": "created_at",
    "href": "/my",
    "label": "届出",
    "module": "System",
    "fields": [
      {
        "column": "proposed_one_way",
        "label": "片道金額",
        "phone": false
      },
      {
        "column": "safe_count",
        "select": "safe_count:payload->count",
        "label": "扶養の変更 / 変更後の扶養の人数",
        "phone": false
      },
      {
        "column": "safe_details",
        "select": "safe_details:payload->details",
        "label": "扶養の変更 / 変更の内容",
        "phone": false
      },
      {
        "column": "safe_effectiveDate",
        "select": "safe_effectiveDate:payload->effectiveDate",
        "label": "通勤経路の変更 / 適用希望日",
        "phone": false
      },
      {
        "column": "safe_note",
        "select": "safe_note:payload->note",
        "label": "通勤経路の変更 / 補足（任意）",
        "phone": false
      },
      {
        "column": "safe_selfAddress",
        "select": "safe_selfAddress:payload->selfAddress",
        "label": "緊急連絡先 / 現住所",
        "phone": false
      },
      {
        "column": "safe_selfPhone",
        "select": "safe_selfPhone:payload->selfPhone",
        "label": "緊急連絡先 / 個人の電話番号（携帯等）",
        "phone": true
      },
      {
        "column": "safe_ecName",
        "select": "safe_ecName:payload->ecName",
        "label": "緊急連絡先 / 緊急連絡先の氏名",
        "phone": false
      },
      {
        "column": "safe_ecRelationship",
        "select": "safe_ecRelationship:payload->ecRelationship",
        "label": "緊急連絡先 / 本人との続柄",
        "phone": false
      },
      {
        "column": "safe_ecAddress",
        "select": "safe_ecAddress:payload->ecAddress",
        "label": "緊急連絡先 / 緊急連絡先の住所（同一の場合は「同上」）",
        "phone": false
      },
      {
        "column": "safe_ecPhone",
        "select": "safe_ecPhone:payload->ecPhone",
        "label": "緊急連絡先 / 緊急連絡先の電話番号",
        "phone": true
      },
      {
        "column": "safe_kind",
        "select": "safe_kind:payload->kind",
        "label": "秘密保持誓約 / 区分",
        "phone": false
      },
      {
        "column": "safe_station",
        "select": "safe_station:payload->station",
        "label": "通勤経路の変更 / 新しい最寄り駅",
        "phone": false
      },
      {
        "column": "safe_bankName",
        "select": "safe_bankName:payload->bankName",
        "label": "給与受取口座の変更 / 銀行名",
        "phone": false
      },
      {
        "column": "safe_bankCode",
        "select": "safe_bankCode:payload->bankCode",
        "label": "給与受取口座の変更 / 金融機関コード（4桁）",
        "phone": false
      },
      {
        "column": "safe_branchName",
        "select": "safe_branchName:payload->branchName",
        "label": "給与受取口座の変更 / 支店名",
        "phone": false
      },
      {
        "column": "safe_branchCode",
        "select": "safe_branchCode:payload->branchCode",
        "label": "給与受取口座の変更 / 支店コード（3桁）",
        "phone": false
      },
      {
        "column": "safe_holderKana",
        "select": "safe_holderKana:payload->holderKana",
        "label": "給与受取口座の変更 / 口座名義カナ",
        "phone": false
      },
      {
        "column": "safe_desiredDate",
        "select": "safe_desiredDate:payload->desiredDate",
        "label": "退職の届出 / 退職希望日",
        "phone": false
      },
      {
        "column": "safe_reason",
        "select": "safe_reason:payload->reason",
        "label": "退職の届出 / 理由（任意）",
        "phone": false
      },
      {
        "column": "safe_pledgeDate",
        "select": "safe_pledgeDate:payload->pledgeDate",
        "label": "秘密保持誓約 / 誓約日",
        "phone": false
      },
      {
        "column": "safe_address",
        "select": "safe_address:payload->address",
        "label": "秘密保持誓約 / 住所",
        "phone": false
      },
      {
        "column": "safe_signature",
        "select": "safe_signature:payload->signature",
        "label": "秘密保持誓約 / 氏名（電子署名）",
        "phone": false
      },
      {
        "column": "safe_agreed",
        "select": "safe_agreed:payload->agreed",
        "label": "秘密保持誓約 / 内容に同意します",
        "phone": false
      }
    ]
  },
  {
    "key": "system_ap_daily_report",
    "table": "system_ap_daily_report",
    "page": "system-mypage",
    "tab": "",
    "client": "own-employee",
    "pk": "id",
    "title": "kind",
    "date": "report_date",
    "href": "/my",
    "label": "AP日報",
    "module": "System",
    "fields": [
      {
        "column": "report_date",
        "label": "日付",
        "phone": false
      },
      {
        "column": "kind",
        "label": "区分",
        "phone": false
      },
      {
        "column": "start_time",
        "label": "開始時間",
        "phone": false
      },
      {
        "column": "end_time",
        "label": "終了時間",
        "phone": false
      },
      {
        "column": "work_minutes",
        "label": "稼働時間（分）",
        "phone": false
      },
      {
        "column": "count",
        "label": "トス / 本日獲得",
        "phone": false
      },
      {
        "column": "month_total",
        "label": "現状合計",
        "phone": false
      },
      {
        "column": "coin_created",
        "label": "コイン作成数",
        "phone": false
      },
      {
        "column": "guide_promised",
        "label": "誘導約束",
        "phone": false
      },
      {
        "column": "guide_in_progress",
        "label": "誘導中",
        "phone": false
      },
      {
        "column": "statement_check_request",
        "label": "明細確認依頼",
        "phone": false
      },
      {
        "column": "coin_total",
        "label": "トータルコイン",
        "phone": false
      },
      {
        "column": "reflection",
        "label": "反省点・改善点",
        "phone": false
      }
    ]
  },
  {
    "key": "root_payroll_notice-input",
    "table": "root_payroll_notice",
    "page": "system-forms",
    "tab": "input",
    "client": "admin",
    "pk": "id",
    "title": "team",
    "date": "submitted_at",
    "href": "/system/forms/payroll-notice",
    "label": "給与計算連絡",
    "module": "System",
    "fields": [
      {
        "column": "team",
        "label": "チーム",
        "phone": false
      },
      {
        "column": "commute_flag",
        "label": "通勤の該当者がいる / いない",
        "phone": false
      },
      {
        "column": "commute_people",
        "label": "通勤 / 該当者名",
        "phone": false
      },
      {
        "column": "training_flag",
        "label": "研修の該当者がいる / いない",
        "phone": false
      },
      {
        "column": "training_people",
        "label": "研修 / 該当者名",
        "phone": false
      },
      {
        "column": "referral_flag",
        "label": "紹介の該当者がいる / いない",
        "phone": false
      },
      {
        "column": "referral_people",
        "label": "紹介 / 該当者名",
        "phone": false
      },
      {
        "column": "other_notes",
        "label": "その他の連絡",
        "phone": false
      }
    ]
  },
  {
    "key": "system_shukkin_member-input",
    "table": "system_shukkin_member",
    "page": "system-forms",
    "tab": "input",
    "client": "admin",
    "pk": "employee_number",
    "title": "display_name",
    "date": "",
    "href": "/system/forms/shukkin",
    "label": "出勤表・シフトLINE連絡テキスト生成",
    "module": "System",
    "fields": [
      {
        "column": "group_name",
        "label": "グループ",
        "phone": false
      },
      {
        "column": "display_name",
        "label": "表示名",
        "phone": false
      },
      {
        "column": "sort_order",
        "label": "表示の並び順（移動操作）",
        "phone": false
      }
    ]
  },
  {
    "key": "system_bank_successors",
    "table": "system_bank_successors",
    "page": "root-bank-check",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "old_bank_code",
    "date": "created_at",
    "href": "/root/bank-check",
    "label": "口座の点検",
    "module": "Root",
    "fields": [
      {
        "column": "old_bank_code",
        "label": "廃止された金融機関コード",
        "phone": false
      },
      {
        "column": "old_branch_code",
        "label": "廃止された支店コード",
        "phone": false
      },
      {
        "column": "new_bank_code",
        "label": "後継の金融機関コード",
        "phone": false
      },
      {
        "column": "new_branch_code",
        "label": "後継の支店コード",
        "phone": false
      },
      {
        "column": "effective_date",
        "label": "適用日",
        "phone": false
      },
      {
        "column": "note",
        "label": "メモ",
        "phone": false
      }
    ]
  },
  {
    "key": "root_minimum_wages",
    "table": "root_minimum_wages",
    "page": "root-minimum-wages",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "prefecture",
    "date": "updated_at",
    "href": "/root/minimum-wages",
    "label": "最低賃金マスタ",
    "module": "Root",
    "fields": [
      {
        "column": "prefecture",
        "label": "都道府県",
        "phone": false
      },
      {
        "column": "hourly_amount",
        "label": "時給",
        "phone": false
      },
      {
        "column": "effective_from",
        "label": "適用開始日",
        "phone": false
      },
      {
        "column": "source_url",
        "label": "出典 URL",
        "phone": false
      }
    ]
  },
  {
    "key": "root_mail_forwardings",
    "table": "root_mail_forwardings",
    "page": "root-mail-forwarding",
    "tab": "",
    "client": "user",
    "pk": "id",
    "title": "holder",
    "date": "updated_at",
    "href": "/root/mail-forwarding",
    "label": "郵便の転送",
    "module": "Root",
    "fields": [
      {
        "column": "holder",
        "label": "名義（必須）",
        "phone": false
      },
      {
        "column": "from_address",
        "label": "転送元の住所 / 郵便番号",
        "phone": false
      },
      {
        "column": "to_address",
        "label": "転送先の住所 / 郵便番号",
        "phone": false
      },
      {
        "column": "notes",
        "label": "メモ",
        "phone": false
      },
      {
        "column": "stopped",
        "label": "止める",
        "phone": false
      }
    ]
  },
  {
    "key": "root_mail_forwarding_filings",
    "table": "root_mail_forwarding_filings",
    "page": "root-mail-forwarding",
    "tab": "",
    "client": "user",
    "pk": "id",
    "title": "method",
    "date": "created_at",
    "href": "/root/mail-forwarding",
    "label": "郵便の転送",
    "module": "Root",
    "fields": [
      {
        "column": "filed_on",
        "label": "最初の届出日 / 新しい届出日",
        "phone": false
      },
      {
        "column": "method",
        "label": "届出の方法",
        "phone": false
      },
      {
        "column": "receipt",
        "label": "受付番号",
        "phone": false
      },
      {
        "column": "filed_by",
        "label": "届けた人",
        "phone": false
      },
      {
        "column": "notes",
        "label": "届出のメモ",
        "phone": false
      }
    ]
  },
  {
    "key": "system_onboarding-self",
    "table": "system_onboarding",
    "page": "system-onboarding",
    "tab": "self",
    "client": "self",
    "pk": "employee_id",
    "title": "name",
    "date": "",
    "href": "/system/onboarding",
    "label": "入社手続き",
    "module": "System",
    "fields": [
      {
        "column": "name",
        "label": "氏名",
        "phone": false
      },
      {
        "column": "name_kana",
        "label": "フリガナ",
        "phone": false
      },
      {
        "column": "gender",
        "label": "性別",
        "phone": false
      },
      {
        "column": "birth_date",
        "label": "生年月日",
        "phone": false
      },
      {
        "column": "postal_code",
        "label": "郵便番号",
        "phone": false
      },
      {
        "column": "address",
        "label": "住所",
        "phone": false
      },
      {
        "column": "address_kana",
        "label": "住所のフリガナ",
        "phone": false
      },
      {
        "column": "phone",
        "label": "電話番号",
        "phone": true
      },
      {
        "column": "email",
        "label": "メールアドレス",
        "phone": false
      },
      {
        "column": "householder_name",
        "label": "世帯主の氏名",
        "phone": false
      },
      {
        "column": "householder_relation",
        "label": "世帯主との続柄",
        "phone": false
      },
      {
        "column": "pension_number",
        "label": "基礎年金番号",
        "phone": false
      },
      {
        "column": "employment_insurance_status",
        "label": "雇用保険被保険者証",
        "phone": false
      },
      {
        "column": "employment_insurance_number",
        "label": "雇用保険被保険者番号",
        "phone": false
      },
      {
        "column": "previous_employer",
        "label": "会社名",
        "phone": false
      },
      {
        "column": "previous_employer_from",
        "label": "勤務した期間（開始）",
        "phone": false
      },
      {
        "column": "previous_employer_to",
        "label": "勤務した期間（終了）",
        "phone": false
      },
      {
        "column": "commute_method",
        "label": "通勤手段（主なもの）",
        "phone": false
      },
      {
        "column": "bank_name",
        "label": "銀行名",
        "phone": false
      },
      {
        "column": "bank_code",
        "label": "金融機関コード（4桁）",
        "phone": false
      },
      {
        "column": "branch_name",
        "label": "支店名",
        "phone": false
      },
      {
        "column": "branch_code",
        "label": "支店コード（3桁）",
        "phone": false
      },
      {
        "column": "account_type",
        "label": "預金種別",
        "phone": false
      },
      {
        "column": "account_holder_kana",
        "label": "口座名義カナ",
        "phone": false
      },
      {
        "column": "emergency_name",
        "label": "氏名",
        "phone": false
      },
      {
        "column": "emergency_relation",
        "label": "続柄",
        "phone": false
      },
      {
        "column": "emergency_relation_other",
        "label": "続柄（その他）",
        "phone": false
      },
      {
        "column": "emergency_address",
        "label": "住所",
        "phone": false
      },
      {
        "column": "emergency_phone",
        "label": "電話番号",
        "phone": true
      },
      {
        "column": "commute_routes",
        "label": "通勤区間 / 交通機関",
        "phone": false
      },
      {
        "column": "nda_agreed_at",
        "label": "内容を確認しました（秘密保持）",
        "phone": false
      }
    ]
  },
  {
    "key": "system_onboarding-all",
    "table": "system_onboarding",
    "page": "system-onboarding",
    "tab": "all",
    "client": "admin",
    "pk": "employee_id",
    "title": "name",
    "date": "",
    "href": "/system/onboarding",
    "label": "入社手続き",
    "module": "System",
    "fields": [
      {
        "column": "name",
        "label": "氏名",
        "phone": false
      },
      {
        "column": "name_kana",
        "label": "フリガナ",
        "phone": false
      },
      {
        "column": "gender",
        "label": "性別",
        "phone": false
      },
      {
        "column": "birth_date",
        "label": "生年月日",
        "phone": false
      },
      {
        "column": "postal_code",
        "label": "郵便番号",
        "phone": false
      },
      {
        "column": "address",
        "label": "住所",
        "phone": false
      },
      {
        "column": "address_kana",
        "label": "住所のフリガナ",
        "phone": false
      },
      {
        "column": "phone",
        "label": "電話番号",
        "phone": true
      },
      {
        "column": "email",
        "label": "メールアドレス",
        "phone": false
      },
      {
        "column": "householder_name",
        "label": "世帯主の氏名",
        "phone": false
      },
      {
        "column": "householder_relation",
        "label": "世帯主との続柄",
        "phone": false
      },
      {
        "column": "pension_number",
        "label": "基礎年金番号",
        "phone": false
      },
      {
        "column": "employment_insurance_status",
        "label": "雇用保険被保険者証",
        "phone": false
      },
      {
        "column": "employment_insurance_number",
        "label": "雇用保険被保険者番号",
        "phone": false
      },
      {
        "column": "previous_employer",
        "label": "会社名",
        "phone": false
      },
      {
        "column": "previous_employer_from",
        "label": "勤務した期間（開始）",
        "phone": false
      },
      {
        "column": "previous_employer_to",
        "label": "勤務した期間（終了）",
        "phone": false
      },
      {
        "column": "commute_method",
        "label": "通勤手段（主なもの）",
        "phone": false
      },
      {
        "column": "bank_name",
        "label": "銀行名",
        "phone": false
      },
      {
        "column": "bank_code",
        "label": "金融機関コード（4桁）",
        "phone": false
      },
      {
        "column": "branch_name",
        "label": "支店名",
        "phone": false
      },
      {
        "column": "branch_code",
        "label": "支店コード（3桁）",
        "phone": false
      },
      {
        "column": "account_type",
        "label": "預金種別",
        "phone": false
      },
      {
        "column": "account_holder_kana",
        "label": "口座名義カナ",
        "phone": false
      },
      {
        "column": "emergency_name",
        "label": "氏名",
        "phone": false
      },
      {
        "column": "emergency_relation",
        "label": "続柄",
        "phone": false
      },
      {
        "column": "emergency_relation_other",
        "label": "続柄（その他）",
        "phone": false
      },
      {
        "column": "emergency_address",
        "label": "住所",
        "phone": false
      },
      {
        "column": "emergency_phone",
        "label": "電話番号",
        "phone": true
      },
      {
        "column": "commute_routes",
        "label": "通勤区間 / 交通機関",
        "phone": false
      },
      {
        "column": "nda_agreed_at",
        "label": "内容を確認しました（秘密保持）",
        "phone": false
      },
      {
        "column": "office",
        "label": "所属店舗",
        "phone": false
      },
      {
        "column": "weekly_hours",
        "label": "週の所定労働時間",
        "phone": false
      },
      {
        "column": "health_insurance",
        "label": "健康保険",
        "phone": false
      },
      {
        "column": "pension_insurance",
        "label": "厚生年金",
        "phone": false
      },
      {
        "column": "employment_insurance",
        "label": "雇用保険",
        "phone": false
      },
      {
        "column": "tax_class",
        "label": "税区分",
        "phone": false
      },
      {
        "column": "salary_kind",
        "label": "給与の区分",
        "phone": false
      },
      {
        "column": "base_salary",
        "label": "基本給（円）",
        "phone": false
      },
      {
        "column": "allowances",
        "label": "手当 / 名前",
        "phone": false
      },
      {
        "column": "commute_cap_monthly",
        "label": "交通費の上限（1か月・円）",
        "phone": false
      },
      {
        "column": "commute_fixed_monthly",
        "label": "支給額（1か月・円）",
        "phone": false
      }
    ]
  },
  {
    "key": "system_hire_candidates-candidates",
    "table": "system_hire_candidates",
    "page": "system-onboarding",
    "tab": "candidates",
    "client": "admin",
    "pk": "id",
    "title": "last_name",
    "date": "hire_date",
    "href": "/system/onboarding",
    "label": "入社手続き",
    "module": "System",
    "fields": [
      {
        "column": "last_name",
        "label": "姓",
        "phone": false
      },
      {
        "column": "first_name",
        "label": "名",
        "phone": false
      },
      {
        "column": "last_name_kana",
        "label": "セイ",
        "phone": false
      },
      {
        "column": "first_name_kana",
        "label": "メイ",
        "phone": false
      },
      {
        "column": "birthday",
        "label": "生年月日",
        "phone": false
      },
      {
        "column": "gender",
        "label": "性別",
        "phone": false
      },
      {
        "column": "hire_date",
        "label": "入社日",
        "phone": false
      },
      {
        "column": "employment_type",
        "label": "雇用形態",
        "phone": false
      },
      {
        "column": "company_id",
        "label": "法人",
        "phone": false
      },
      {
        "column": "kot_division_code",
        "label": "KING OF TIME の所属",
        "phone": false
      },
      {
        "column": "kot_type_code",
        "label": "KING OF TIME の雇用区分",
        "phone": false
      },
      {
        "column": "checklist",
        "label": "確認チェック / undefined",
        "phone": false
      }
    ]
  },
  {
    "key": "system_hire_candidates-confirmations",
    "table": "system_hire_candidates",
    "page": "system-onboarding",
    "tab": "confirmations",
    "client": "admin",
    "pk": "id",
    "title": "last_name",
    "date": "hire_date",
    "href": "/system/onboarding",
    "label": "入社手続き",
    "module": "System",
    "fields": [
      {
        "column": "last_name",
        "label": "姓",
        "phone": false
      },
      {
        "column": "first_name",
        "label": "名",
        "phone": false
      },
      {
        "column": "last_name_kana",
        "label": "セイ",
        "phone": false
      },
      {
        "column": "first_name_kana",
        "label": "メイ",
        "phone": false
      },
      {
        "column": "birthday",
        "label": "生年月日",
        "phone": false
      },
      {
        "column": "gender",
        "label": "性別",
        "phone": false
      },
      {
        "column": "hire_date",
        "label": "入社日",
        "phone": false
      },
      {
        "column": "employment_type",
        "label": "雇用形態",
        "phone": false
      },
      {
        "column": "company_id",
        "label": "法人",
        "phone": false
      },
      {
        "column": "kot_division_code",
        "label": "KING OF TIME の所属",
        "phone": false
      },
      {
        "column": "kot_type_code",
        "label": "KING OF TIME の雇用区分",
        "phone": false
      },
      {
        "column": "checklist",
        "label": "確認チェック / undefined",
        "phone": false
      }
    ]
  },
  {
    "key": "system_expense_report",
    "table": "system_expense_report",
    "page": "system-expense",
    "tab": "",
    "client": "submitted",
    "pk": "id",
    "title": "purpose",
    "date": "created_at",
    "href": "/system/expense",
    "label": "経費 報告",
    "module": "System",
    "fields": [
      {
        "column": "form",
        "label": "経費の種類（フォーム切替）",
        "phone": false
      },
      {
        "column": "business",
        "label": "事業",
        "phone": false
      },
      {
        "column": "payment",
        "label": "決済方法",
        "phone": false
      },
      {
        "column": "paid_on",
        "label": "決済日",
        "phone": false
      },
      {
        "column": "amount",
        "label": "金額（円・税込）",
        "phone": false
      },
      {
        "column": "purpose",
        "label": "使用用途",
        "phone": false
      },
      {
        "column": "purpose_detail",
        "label": "用途の詳細",
        "phone": false
      },
      {
        "column": "note",
        "label": "備考",
        "phone": false
      }
    ]
  },
  {
    "key": "system_nhk_visit_report-input",
    "table": "system_nhk_visit_report",
    "page": "system-forms",
    "tab": "input",
    "client": "submitted",
    "pk": "id",
    "title": "destination",
    "date": "created_at",
    "href": "/system/forms/nhk-visit",
    "label": "NHK訪問業務 報告フォーム",
    "module": "System",
    "fields": [
      {
        "column": "visit_date",
        "label": "日付",
        "phone": false
      },
      {
        "column": "start_time",
        "label": "時間（開始）",
        "phone": false
      },
      {
        "column": "end_time",
        "label": "時間（終了）",
        "phone": false
      },
      {
        "column": "destination",
        "label": "派遣先",
        "phone": false
      },
      {
        "column": "new_ground",
        "label": "成約件数 / 新規 / 地上",
        "phone": false
      },
      {
        "column": "new_satellite",
        "label": "成約件数 / 新規 / 衛星",
        "phone": false
      },
      {
        "column": "address_ground",
        "label": "成約件数 / 住所変更 / 地上",
        "phone": false
      },
      {
        "column": "address_satellite",
        "label": "成約件数 / 住所変更 / 衛星",
        "phone": false
      },
      {
        "column": "bank_credit",
        "label": "口座・クレ / 件数",
        "phone": false
      },
      {
        "column": "transport_fee",
        "label": "交通費",
        "phone": false
      }
    ]
  },
  {
    "key": "system_contracts-browse",
    "table": "system_contracts",
    "page": "system-contracts",
    "tab": "browse",
    "client": "admin",
    "pk": "id",
    "title": "counterparty",
    "date": "created_at",
    "href": "/system/contracts",
    "label": "契約書管理",
    "module": "System",
    "fields": [
      {
        "column": "counterparty",
        "label": "取引先名",
        "phone": false
      },
      {
        "column": "company_id",
        "label": "法人",
        "phone": false
      },
      {
        "column": "contract_type",
        "label": "契約の種類",
        "phone": false
      },
      {
        "column": "concluded_on",
        "label": "契約日",
        "phone": false
      },
      {
        "column": "note",
        "label": "メモ",
        "phone": false
      },
      {
        "column": "drive_file_id",
        "label": "契約書 PDF",
        "phone": false
      },
      {
        "column": "product",
        "label": "商材名（テンプレート作成）",
        "phone": false
      }
    ]
  },
  {
    "key": "system_dev_questions",
    "table": "system_dev_questions",
    "page": "system-dev-board",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "title",
    "date": "created_at",
    "href": "/system/dev-board",
    "label": "開発ボード",
    "module": "System",
    "fields": [
      {
        "column": "title",
        "label": "見出し",
        "phone": false
      },
      {
        "column": "module",
        "label": "モジュール",
        "phone": false
      },
      {
        "column": "body",
        "label": "説明",
        "phone": false
      },
      {
        "column": "answer_type",
        "label": "答え方",
        "phone": false
      },
      {
        "column": "options",
        "label": "選択肢（1行に1つ）",
        "phone": false
      },
      {
        "column": "answer_choice",
        "label": "答えを選んでください",
        "phone": false
      },
      {
        "column": "answer_text_raw",
        "label": "回答 / 補足（もとの文）",
        "phone": false
      },
      {
        "column": "answer_text",
        "label": "整えた文で送る（確認後の回答）",
        "phone": false
      }
    ]
  },
  {
    "key": "system_site_news-news",
    "table": "system_site_news",
    "page": "system-sites",
    "tab": "news",
    "client": "admin",
    "pk": "id",
    "title": "title",
    "date": "updated_at",
    "href": "/system/sites",
    "label": "コーポレートサイト",
    "module": "System",
    "fields": [
      {
        "column": "company_id",
        "label": "法人",
        "phone": false
      },
      {
        "column": "published_on",
        "label": "日付",
        "phone": false
      },
      {
        "column": "title",
        "label": "題名",
        "phone": false
      },
      {
        "column": "body",
        "label": "本文",
        "phone": false
      },
      {
        "column": "is_published",
        "label": "公開する",
        "phone": false
      }
    ]
  },
  {
    "key": "system_kanri_person-settings",
    "table": "system_kanri_person",
    "page": "system-kanri",
    "tab": "settings",
    "client": "admin",
    "pk": "id",
    "title": "name",
    "date": "",
    "href": "/system/kanri",
    "label": "管理表ポータル",
    "module": "System",
    "fields": [
      {
        "column": "name",
        "label": "氏名",
        "phone": false
      },
      {
        "column": "kot_name",
        "label": "KOT 氏名",
        "phone": false
      },
      {
        "column": "team",
        "label": "チーム",
        "phone": false
      },
      {
        "column": "department",
        "label": "部署",
        "phone": false
      },
      {
        "column": "employment_kind",
        "label": "雇用区分",
        "phone": false
      },
      {
        "column": "base_wage",
        "label": "基本時給",
        "phone": false
      },
      {
        "column": "is_field_sales",
        "label": "訪問販売",
        "phone": false
      },
      {
        "column": "active",
        "label": "有効",
        "phone": false
      }
    ]
  },
  {
    "key": "system_kanri_month_setting-settings",
    "table": "system_kanri_month_setting",
    "page": "system-kanri",
    "tab": "settings",
    "client": "admin",
    "pk": "year_month",
    "title": "year_month",
    "date": "updated_at",
    "href": "/system/kanri",
    "label": "管理表ポータル",
    "module": "System",
    "fields": [
      {
        "column": "holidays",
        "label": "休業日",
        "phone": false
      }
    ]
  },
  {
    "key": "soil_list_condition-list",
    "table": "soil_list_condition",
    "page": "system-list",
    "tab": "list",
    "client": "soil",
    "pk": "id",
    "title": "name",
    "date": "updated_at",
    "href": "/system/list",
    "label": "リストマスタ",
    "module": "System",
    "fields": [
      {
        "column": "name",
        "label": "条件名",
        "phone": false
      },
      {
        "column": "condition",
        "label": "都道府県",
        "phone": false
      }
    ]
  },
  {
    "key": "soil_list_internal_block-internal-block",
    "table": "soil_list_internal_block",
    "page": "system-list",
    "tab": "internal-block",
    "client": "soil",
    "pk": "id",
    "title": "電話番号",
    "date": "created_at",
    "href": "/system/list",
    "label": "リストマスタ",
    "module": "System",
    "fields": [
      {
        "column": "電話番号",
        "label": "電話番号",
        "phone": true
      },
      {
        "column": "理由",
        "label": "理由",
        "phone": false
      },
      {
        "column": "解除理由",
        "label": "解除理由",
        "phone": false
      }
    ]
  },
  {
    "key": "system_line_broadcast",
    "table": "system_line_broadcast",
    "page": "system-line",
    "tab": "",
    "client": "line",
    "pk": "id",
    "title": "title",
    "date": "created_at",
    "href": "/system/line",
    "label": "LINE 管理",
    "module": "System",
    "fields": [
      {
        "column": "title",
        "label": "題名",
        "phone": false
      },
      {
        "column": "body",
        "label": "送る文",
        "phone": false
      },
      {
        "column": "tag_ids",
        "label": "送り先のタグ",
        "phone": false
      }
    ]
  },
  {
    "key": "system_line_tag",
    "table": "system_line_tag",
    "page": "system-line",
    "tab": "",
    "client": "line",
    "pk": "id",
    "title": "name",
    "date": "",
    "href": "/system/line",
    "label": "LINE 管理",
    "module": "System",
    "fields": [
      {
        "column": "name",
        "label": "タグの名前",
        "phone": false
      }
    ]
  },
  {
    "key": "system_line_tag_member",
    "table": "system_line_tag_member",
    "page": "system-line",
    "tab": "",
    "client": "line",
    "pk": "employee_id",
    "title": "tag_id",
    "date": "",
    "href": "/system/line",
    "label": "LINE 管理",
    "module": "System",
    "fields": [
      {
        "column": "tag_id",
        "label": "自由タグ",
        "phone": false
      }
    ]
  },
  {
    "key": "system_line_greeting",
    "table": "system_line_greeting",
    "page": "system-line",
    "tab": "",
    "client": "line",
    "pk": "id",
    "title": "body",
    "date": "",
    "href": "/system/line",
    "label": "LINE 管理",
    "module": "System",
    "fields": [
      {
        "column": "employment_tag_id",
        "label": "雇用形態",
        "phone": false
      },
      {
        "column": "business_tag_id",
        "label": "事業",
        "phone": false
      },
      {
        "column": "body",
        "label": "あいさつ文",
        "phone": false
      },
      {
        "column": "enabled",
        "label": "有効",
        "phone": false
      }
    ]
  },
  {
    "key": "system_line_contact",
    "table": "system_line_contact",
    "page": "system-line",
    "tab": "",
    "client": "line",
    "pk": "key",
    "title": "employee_id",
    "date": "",
    "href": "/system/line",
    "label": "LINE 管理",
    "module": "System",
    "fields": [
      {
        "column": "employee_id",
        "label": "担当",
        "phone": false
      }
    ]
  },
  {
    "key": "system_line_target",
    "table": "system_line_target",
    "page": "system-line",
    "tab": "",
    "client": "line",
    "pk": "id",
    "title": "label",
    "date": "",
    "href": "/system/line",
    "label": "LINE 管理",
    "module": "System",
    "fields": [
      {
        "column": "label",
        "label": "グループの名前",
        "phone": false
      },
      {
        "column": "chatwork_room_id",
        "label": "知らせ先の Chatwork ルームの番号",
        "phone": false
      },
      {
        "column": "notify_enabled",
        "label": "知らせ",
        "phone": false
      }
    ]
  },
  {
    "key": "bud_expense_requests",
    "table": "bud_expense_requests",
    "page": "bud-expenses",
    "tab": "",
    "client": "user",
    "pk": "id",
    "title": "store_name",
    "date": "created_at",
    "href": "/bud/expenses",
    "label": "経費精算",
    "module": "Bud",
    "fields": [
      {
        "column": "expense_kind",
        "label": "経費の種類",
        "phone": false
      },
      {
        "column": "corp_id",
        "label": "申請法人",
        "phone": false
      },
      {
        "column": "receipt_date",
        "label": "領収日",
        "phone": false
      },
      {
        "column": "receipt_time",
        "label": "領収時刻",
        "phone": false
      },
      {
        "column": "store_name",
        "label": "店名",
        "phone": false
      },
      {
        "column": "amount",
        "label": "金額",
        "phone": false
      },
      {
        "column": "qualified_class",
        "label": "適格区分",
        "phone": false
      },
      {
        "column": "qualified_number",
        "label": "登録番号",
        "phone": false
      },
      {
        "column": "category_id",
        "label": "経費区分",
        "phone": false
      },
      {
        "column": "description",
        "label": "内容",
        "phone": false
      },
      {
        "column": "receipt_rotation",
        "label": "領収書の向き（回転操作）",
        "phone": false
      },
      {
        "column": "return_reason",
        "label": "差戻し理由",
        "phone": false
      },
      {
        "column": "booking_date",
        "label": "仕分け日",
        "phone": false
      },
      {
        "column": "booking_corp_id",
        "label": "仕分け法人名",
        "phone": false
      },
      {
        "column": "fiscal_period",
        "label": "決算区分の上書き",
        "phone": false
      },
      {
        "column": "storage_path",
        "label": "領収書の写真 / ファイル",
        "phone": false
      }
    ]
  },
  {
    "key": "bud_transfers",
    "table": "bud_transfers",
    "page": "bud-transfers",
    "tab": "",
    "client": "user",
    "pk": "id",
    "title": "payee_name",
    "date": "created_at",
    "href": "/bud/transfers",
    "label": "振込管理",
    "module": "Bud",
    "fields": [
      {
        "column": "data_source",
        "label": "データソース",
        "phone": false
      },
      {
        "column": "payment_category",
        "label": "支払区分",
        "phone": false
      },
      {
        "column": "request_company_id",
        "label": "依頼会社（実行会社の入力から同時設定）",
        "phone": false
      },
      {
        "column": "execute_company_id",
        "label": "実行会社",
        "phone": false
      },
      {
        "column": "source_account_id",
        "label": "支払元口座",
        "phone": false
      },
      {
        "column": "vendor_id",
        "label": "振込先",
        "phone": false
      },
      {
        "column": "payee_name",
        "label": "お支払い先",
        "phone": false
      },
      {
        "column": "payee_bank_name",
        "label": "銀行名",
        "phone": false
      },
      {
        "column": "payee_bank_code",
        "label": "銀行コード",
        "phone": false
      },
      {
        "column": "payee_branch_name",
        "label": "支店名",
        "phone": false
      },
      {
        "column": "payee_branch_code",
        "label": "支店コード",
        "phone": false
      },
      {
        "column": "payee_account_type",
        "label": "口座種別",
        "phone": false
      },
      {
        "column": "payee_account_holder_kana",
        "label": "口座名義カナ",
        "phone": false
      },
      {
        "column": "registered_method",
        "label": "登録済み支払方法",
        "phone": false
      },
      {
        "column": "payeasy_biller_no",
        "label": "収納機関番号",
        "phone": false
      },
      {
        "column": "amount",
        "label": "金額",
        "phone": false
      },
      {
        "column": "fee_bearer",
        "label": "手数料負担",
        "phone": false
      },
      {
        "column": "scheduled_date",
        "label": "振込予定日",
        "phone": false
      },
      {
        "column": "due_date",
        "label": "支払期日",
        "phone": false
      },
      {
        "column": "description",
        "label": "備考",
        "phone": false
      },
      {
        "column": "invoice_pdf_url",
        "label": "請求書 PDF",
        "phone": false
      },
      {
        "column": "scan_image_url",
        "label": "スキャン画像",
        "phone": false
      },
      {
        "column": "cashback_applicant_name",
        "label": "申込者名",
        "phone": false
      },
      {
        "column": "cashback_applicant_name_kana",
        "label": "申込者名カナ",
        "phone": false
      },
      {
        "column": "cashback_applicant_phone",
        "label": "電話番号（任意）",
        "phone": true
      },
      {
        "column": "cashback_product_name",
        "label": "商材名",
        "phone": false
      },
      {
        "column": "cashback_channel_name",
        "label": "商流名",
        "phone": false
      },
      {
        "column": "rejection_reason",
        "label": "差戻し理由",
        "phone": false
      },
      {
        "column": "manual_paid_at",
        "label": "支払済み（確認操作）",
        "phone": false
      }
    ]
  },
  {
    "key": "bud_statements-list",
    "table": "bud_statements",
    "page": "bud-statements",
    "tab": "list",
    "client": "user",
    "pk": "id",
    "title": "matched_transfer_id",
    "date": "",
    "href": "/bud/statements",
    "label": "明細",
    "module": "Bud",
    "fields": [
      {
        "column": "matched_transfer_id",
        "label": "振込を選ぶ",
        "phone": false
      }
    ]
  },
  {
    "key": "bud_mf_accounts",
    "table": "bud_mf_accounts",
    "page": "bud-bank",
    "tab": "",
    "client": "mf",
    "pk": "mf_account_id",
    "title": "name",
    "date": "fetched_at",
    "href": "/bud/bank",
    "label": "銀行口座・カード",
    "module": "Bud",
    "fields": [
      {
        "column": "mail_alias",
        "label": "メールの口座名",
        "phone": false
      },
      {
        "column": "hidden",
        "label": "非表示",
        "phone": false
      },
      {
        "column": "book_sub_account_name",
        "label": "帳簿の補助科目名",
        "phone": false
      },
      {
        "column": "balance_mode",
        "label": "残高の扱い",
        "phone": false
      },
      {
        "column": "anchor_balance",
        "label": "基準残高",
        "phone": false
      },
      {
        "column": "anchor_at",
        "label": "基準時刻",
        "phone": false
      },
      {
        "column": "anchor_date",
        "label": "基準日",
        "phone": false
      },
      {
        "column": "balance_note",
        "label": "メモ",
        "phone": false
      },
      {
        "column": "visible_employee_ids",
        "label": "見られる人（口座）",
        "phone": false
      },
      {
        "column": "sort_order",
        "label": "口座の並び（移動操作）",
        "phone": false
      }
    ]
  },
  {
    "key": "bud_mf_group_viewers",
    "table": "bud_mf_group_viewers",
    "page": "bud-bank",
    "tab": "",
    "client": "mf",
    "pk": "kind",
    "title": "kind",
    "date": "updated_at",
    "href": "/bud/bank",
    "label": "銀行口座・カード",
    "module": "Bud",
    "fields": [
      {
        "column": "employee_ids",
        "label": "見られる人（銀行 / カード全体）",
        "phone": false
      }
    ]
  },
  {
    "key": "bud_mf_axis_order",
    "table": "bud_mf_axis_order",
    "page": "bud-bank",
    "tab": "",
    "client": "mf",
    "pk": "key",
    "title": "key",
    "date": "",
    "href": "/bud/bank",
    "label": "銀行口座・カード",
    "module": "Bud",
    "fields": [
      {
        "column": "sort_order",
        "label": "法人 / 銀行の並び（移動操作）",
        "phone": false
      }
    ]
  },
  {
    "key": "bud_bb_viewers",
    "table": "bud_bb_viewers",
    "page": "bud-broadband",
    "tab": "",
    "client": "broadband",
    "pk": "id",
    "title": "id",
    "date": "",
    "href": "/bud/profit/broadband",
    "label": "損益管理",
    "module": "Bud",
    "fields": [
      {
        "column": "employee_ids",
        "label": "閲覧者",
        "phone": false
      }
    ]
  },
  {
    "key": "sprout_baitoru_postings-baitoru",
    "table": "sprout_baitoru_postings",
    "page": "sprout-postings",
    "tab": "baitoru",
    "client": "user",
    "pk": "id",
    "title": "content",
    "date": "created_at",
    "href": "/sprout/postings",
    "label": "掲載管理",
    "module": "Sprout",
    "fields": [
      {
        "column": "start_date",
        "label": "掲載期間の開始",
        "phone": false
      },
      {
        "column": "end_date",
        "label": "掲載期間の終了",
        "phone": false
      },
      {
        "column": "content",
        "label": "掲載内容",
        "phone": false
      }
    ]
  },
  {
    "key": "sprout_baitoru_settings-baitoru",
    "table": "sprout_baitoru_settings",
    "page": "sprout-postings",
    "tab": "baitoru",
    "client": "user",
    "pk": "id",
    "title": "content_options",
    "date": "updated_at",
    "href": "/sprout/postings",
    "label": "掲載管理",
    "module": "Sprout",
    "fields": [
      {
        "column": "content_options",
        "label": "掲載内容の選択肢 / 追加する文字",
        "phone": false
      },
      {
        "column": "exclude_inquiry_nos",
        "label": "今回だけ除外する問合せ番号（カンマ区切り）",
        "phone": false
      },
      {
        "column": "notify_room",
        "label": "通知先",
        "phone": false
      },
      {
        "column": "mention_employee_ids",
        "label": "通知の宛先",
        "phone": false
      },
      {
        "column": "max_per_run",
        "label": "1回に登録する上限",
        "phone": false
      }
    ]
  },
  {
    "key": "bloom_monthly_digests",
    "table": "bloom_monthly_digests",
    "page": "bloom-monthly-digest",
    "tab": "",
    "client": "admin",
    "pk": "id",
    "title": "title",
    "date": "updated_at",
    "href": "/bloom/monthly-digest",
    "label": "月次まとめの編集",
    "module": "Bloom",
    "fields": [
      {
        "column": "title",
        "label": "タイトル",
        "phone": false
      },
      {
        "column": "summary",
        "label": "サマリ",
        "phone": false
      },
      {
        "column": "pages",
        "label": "追加するページの種類",
        "phone": false
      }
    ]
  },
  {
    "key": "bloom_daily_logs-today",
    "table": "bloom_daily_logs",
    "page": "bloom-workboard",
    "tab": "today",
    "client": "own-user",
    "pk": "id",
    "title": "log_date",
    "date": "updated_at",
    "href": "/bloom/workboard",
    "label": "ワークボード",
    "module": "Bloom",
    "fields": [
      {
        "column": "planned_items",
        "label": "今日やること",
        "phone": false
      }
    ]
  },
  {
    "key": "bloom_ceo_status",
    "table": "bloom_ceo_status",
    "page": "bloom-workboard-ceo-status",
    "tab": "",
    "client": "user",
    "pk": "id",
    "title": "status",
    "date": "updated_at",
    "href": "/bloom/workboard-ceo-status",
    "label": "東海林さんの状況",
    "module": "Bloom",
    "fields": [
      {
        "column": "status",
        "label": "対応可能 / 取り込み中 / 集中業務中 / 外出中",
        "phone": false
      },
      {
        "column": "summary",
        "label": "メモ（200字以内）",
        "phone": false
      }
    ]
  },
  {
    "key": "shinkouki-numbers",
    "table": "shinkouki",
    "page": "forest-shinkouki",
    "tab": "numbers",
    "client": "user",
    "pk": "company_id",
    "title": "company_id",
    "date": "",
    "href": "/forest/shinkouki",
    "label": "進行期",
    "module": "Forest",
    "fields": [
      {
        "column": "uriage",
        "label": "売上高（円）",
        "phone": false
      },
      {
        "column": "gaichuhi",
        "label": "外注費（円）",
        "phone": false
      },
      {
        "column": "rieki",
        "label": "利益（円、赤字は負の値）",
        "phone": false
      },
      {
        "column": "reflected",
        "label": "反映済み期間",
        "phone": false
      },
      {
        "column": "zantei",
        "label": "暫定 / 確定",
        "phone": false
      }
    ]
  },
  {
    "key": "fiscal_periods",
    "table": "fiscal_periods",
    "page": "forest-financial-statements",
    "tab": "",
    "client": "user",
    "pk": "id",
    "title": "company_id",
    "date": "",
    "href": "/forest/financial-statements",
    "label": "進行期",
    "module": "Forest",
    "fields": [
      {
        "column": "junshisan",
        "label": "純資産",
        "phone": false
      },
      {
        "column": "genkin",
        "label": "現金",
        "phone": false
      },
      {
        "column": "yokin",
        "label": "預金",
        "phone": false
      },
      {
        "column": "doc_url",
        "label": "決算書 URL",
        "phone": false
      }
    ]
  },
  {
    "key": "system_innovera_daily_extension",
    "table": "system_innovera_daily_extension",
    "page": "system-attendance",
    "tab": "",
    "client": "self",
    "pk": "id",
    "title": "extension",
    "date": "work_date",
    "href": "/system/attendance",
    "label": "勤怠打刻",
    "module": "System",
    "fields": [
      {
        "column": "extension",
        "label": "今日の内線番号",
        "phone": false
      }
    ]
  },
  {
    "key": "system_zenkaku_check_request",
    "table": "system_zenkaku_check_request",
    "page": "system-zenkaku",
    "tab": "",
    "client": "requested",
    "pk": "id",
    "title": "sales_id",
    "date": "",
    "href": "/system/zenkaku",
    "label": "前確依頼",
    "module": "System",
    "fields": [
      {
        "column": "sales_id",
        "label": "営業ID",
        "phone": false
      }
    ]
  },
  {
    "key": "system_zenkaku_submission",
    "table": "system_zenkaku_submission",
    "page": "system-zenkaku",
    "tab": "",
    "client": "requested",
    "pk": "id",
    "title": "selected_partner_code",
    "date": "",
    "href": "/system/zenkaku",
    "label": "前確依頼",
    "module": "System",
    "fields": [
      {
        "column": "selected_partner_code",
        "label": "依頼するチーム（候補）",
        "phone": false
      },
      {
        "column": "duplicate_confirmed",
        "label": "重複を確認して続ける",
        "phone": false
      }
    ]
  }
];
