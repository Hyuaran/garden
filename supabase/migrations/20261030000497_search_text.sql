-- Catalog allowlist only. Apply before deploying the DB-side search code.
-- 2026-10-30 Claude: 生成列ではなく search_v_<表> のビュー（security_invoker）＋式の GIN 索引に変更。日付は日本時間。
-- Existing tables/columns are checked at application time; no whole-row JSON conversion.
-- Fixed output settings make the stable text/date formatting deterministic.
CREATE OR REPLACE FUNCTION public.garden_search_value(value anyelement)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog SET TimeZone = 'UTC' SET DateStyle = 'ISO, YMD'
SET IntervalStyle = 'postgres' SET extra_float_digits = 3
AS $$ SELECT value::text $$;

CREATE OR REPLACE FUNCTION public.garden_search_date(value timestamp without time zone)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog
AS $$ SELECT to_char(value, 'YYYY-MM-DD') || ' ' || to_char(value, 'YYYY/MM/DD') $$;

CREATE OR REPLACE FUNCTION public.garden_search_join(VARIADIC parts text[])
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog
AS $$ SELECT concat_ws(' ', VARIADIC parts) $$;

CREATE OR REPLACE FUNCTION public.search_norm(value text, phone boolean DEFAULT false)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog
AS $$
  SELECT public.garden_search_join(n, regexp_replace(n, '[,，]', '', 'g'),
    CASE WHEN phone THEN regexp_replace(regexp_replace(n, '[,，]', '', 'g'), '[-‐‑‒–—−ー[:space:]]', '', 'g') END)
  FROM (SELECT lower(normalize(value, NFKC)) AS n) normalized
$$;

DO $migration$
DECLARE
  spec jsonb := $catalog$[
  {
    "table": "root_employees",
    "fields": [
      {
        "path": [
          "employee_id"
        ],
        "phone": false
      },
      {
        "path": [
          "employee_number"
        ],
        "phone": false
      },
      {
        "path": [
          "company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "name"
        ],
        "phone": false
      },
      {
        "path": [
          "name_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "line_contact_url"
        ],
        "phone": false
      },
      {
        "path": [
          "email"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_type"
        ],
        "phone": false
      },
      {
        "path": [
          "salary_system_id"
        ],
        "phone": false
      },
      {
        "path": [
          "insurance_type"
        ],
        "phone": false
      },
      {
        "path": [
          "garden_role"
        ],
        "phone": false
      },
      {
        "path": [
          "hire_date"
        ],
        "phone": false
      },
      {
        "path": [
          "birthday"
        ],
        "phone": false
      },
      {
        "path": [
          "termination_date"
        ],
        "phone": false
      },
      {
        "path": [
          "contract_end_on"
        ],
        "phone": false
      },
      {
        "path": [
          "business"
        ],
        "phone": false
      },
      {
        "path": [
          "account_holder"
        ],
        "phone": false
      },
      {
        "path": [
          "kou_otsu"
        ],
        "phone": false
      },
      {
        "path": [
          "dependents_count"
        ],
        "phone": false
      },
      {
        "path": [
          "kot_employee_id"
        ],
        "phone": false
      },
      {
        "path": [
          "innovera_extension"
        ],
        "phone": false
      },
      {
        "path": [
          "innovera_mobile_extension"
        ],
        "phone": true
      },
      {
        "path": [
          "filemaker_employee_name"
        ],
        "phone": false
      },
      {
        "path": [
          "mf_employee_id"
        ],
        "phone": false
      },
      {
        "path": [
          "call_recording_access"
        ],
        "phone": false
      },
      {
        "path": [
          "chatwork_account_id"
        ],
        "phone": false
      },
      {
        "path": [
          "notes"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_companies",
    "fields": [
      {
        "path": [
          "company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "default_bank"
        ],
        "phone": false
      },
      {
        "path": [
          "company_name"
        ],
        "phone": false
      },
      {
        "path": [
          "company_name_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "phone"
        ],
        "phone": true
      },
      {
        "path": [
          "fax"
        ],
        "phone": true
      },
      {
        "path": [
          "fiscal_end_month"
        ],
        "phone": false
      },
      {
        "path": [
          "established_on"
        ],
        "phone": false
      },
      {
        "path": [
          "domain"
        ],
        "phone": false
      },
      {
        "path": [
          "website"
        ],
        "phone": false
      },
      {
        "path": [
          "address"
        ],
        "phone": false
      },
      {
        "path": [
          "corporate_number"
        ],
        "phone": false
      },
      {
        "path": [
          "invoice_registration_number"
        ],
        "phone": false
      },
      {
        "path": [
          "telecom_notification_number"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_insurance_number"
        ],
        "phone": false
      },
      {
        "path": [
          "labor_insurance_number"
        ],
        "phone": false
      },
      {
        "path": [
          "agency_notification_number"
        ],
        "phone": false
      },
      {
        "path": [
          "industry_classification"
        ],
        "phone": false
      },
      {
        "path": [
          "tax_office"
        ],
        "phone": false
      },
      {
        "path": [
          "representative"
        ],
        "phone": false
      },
      {
        "path": [
          "representative_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "representative_gender"
        ],
        "phone": false
      },
      {
        "path": [
          "representative_birthday"
        ],
        "phone": false
      },
      {
        "path": [
          "representative_mobile"
        ],
        "phone": true
      },
      {
        "path": [
          "representative_address"
        ],
        "phone": false
      },
      {
        "path": [
          "contact1_name"
        ],
        "phone": false
      },
      {
        "path": [
          "contact1_phone"
        ],
        "phone": true
      },
      {
        "path": [
          "contact2_name"
        ],
        "phone": false
      },
      {
        "path": [
          "contact2_phone"
        ],
        "phone": true
      }
    ]
  },
  {
    "table": "root_vendors",
    "fields": [
      {
        "path": [
          "vendor_id"
        ],
        "phone": false
      },
      {
        "path": [
          "vendor_type"
        ],
        "phone": false
      },
      {
        "path": [
          "vendor_name"
        ],
        "phone": false
      },
      {
        "path": [
          "vendor_name_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "bank_name"
        ],
        "phone": false
      },
      {
        "path": [
          "bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "branch_name"
        ],
        "phone": false
      },
      {
        "path": [
          "branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "account_type"
        ],
        "phone": false
      },
      {
        "path": [
          "account_holder_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "fee_bearer"
        ],
        "phone": false
      },
      {
        "path": [
          "company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "notes"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_bank_accounts",
    "fields": [
      {
        "path": [
          "corp_code"
        ],
        "phone": false
      },
      {
        "path": [
          "bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "branch_name"
        ],
        "phone": false
      },
      {
        "path": [
          "branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "account_type"
        ],
        "phone": false
      },
      {
        "path": [
          "sub_account_label"
        ],
        "phone": false
      },
      {
        "path": [
          "has_csv_export"
        ],
        "phone": false
      },
      {
        "path": [
          "needs_manual_balance"
        ],
        "phone": false
      },
      {
        "path": [
          "notes"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_salary_systems",
    "fields": [
      {
        "path": [
          "salary_system_id"
        ],
        "phone": false
      },
      {
        "path": [
          "system_name"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_type"
        ],
        "phone": false
      },
      {
        "path": [
          "base_salary_type"
        ],
        "phone": false
      },
      {
        "path": [
          "working_hours_day"
        ],
        "phone": false
      },
      {
        "path": [
          "working_days_month"
        ],
        "phone": false
      },
      {
        "path": [
          "overtime_rate"
        ],
        "phone": false
      },
      {
        "path": [
          "night_overtime_rate"
        ],
        "phone": false
      },
      {
        "path": [
          "holiday_overtime_rate"
        ],
        "phone": false
      },
      {
        "path": [
          "notes"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_insurance",
    "fields": [
      {
        "path": [
          "insurance_id"
        ],
        "phone": false
      },
      {
        "path": [
          "fiscal_year"
        ],
        "phone": false
      },
      {
        "path": [
          "effective_from"
        ],
        "phone": false
      },
      {
        "path": [
          "effective_to"
        ],
        "phone": false
      },
      {
        "path": [
          "health_insurance_rate"
        ],
        "phone": false
      },
      {
        "path": [
          "nursing_insurance_rate"
        ],
        "phone": false
      },
      {
        "path": [
          "pension_rate"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_insurance_rate"
        ],
        "phone": false
      },
      {
        "path": [
          "child_support_rate"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_attendance",
    "fields": [
      {
        "path": [
          "attendance_id"
        ],
        "phone": false
      },
      {
        "path": [
          "employee_id"
        ],
        "phone": false
      },
      {
        "path": [
          "target_month"
        ],
        "phone": false
      },
      {
        "path": [
          "working_days"
        ],
        "phone": false
      },
      {
        "path": [
          "absence_days"
        ],
        "phone": false
      },
      {
        "path": [
          "paid_leave_days"
        ],
        "phone": false
      },
      {
        "path": [
          "scheduled_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "actual_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "overtime_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "legal_overtime_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "night_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "holiday_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "late_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "early_leave_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "training_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "office_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "import_status"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_employee_team_history",
    "fields": [
      {
        "path": [
          "effective_date"
        ],
        "phone": false
      },
      {
        "path": [
          "team"
        ],
        "phone": false
      },
      {
        "path": [
          "memo"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_employee_profile_history",
    "fields": [
      {
        "path": [
          "payload",
          "bank_name"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "account_type"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "branch_name"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "holder_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "postal_code"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "prefecture"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "city"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "town"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "building"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "room"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "phone"
        ],
        "phone": true
      },
      {
        "path": [
          "payload",
          "phone_1"
        ],
        "phone": true
      },
      {
        "path": [
          "payload",
          "phone_2"
        ],
        "phone": true
      },
      {
        "path": [
          "payload",
          "phone_3"
        ],
        "phone": true
      },
      {
        "path": [
          "payload",
          "sub_account",
          "bank_name"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "sub_account",
          "bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "sub_account",
          "branch_name"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "sub_account",
          "branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "sub_account",
          "account_type"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "sub_account",
          "holder_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "one_way"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "monthly_cap"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "nearest_station"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "route"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "paid"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "business"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "department"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "affiliation"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "base_hourly"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "training_hourly"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "training_cap"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "year_end_adjustment"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "social_insurance"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "employment_insurance"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "employment_insurance_no"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "pension_no"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "advance_pay"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "call_type"
        ],
        "phone": false
      },
      {
        "path": [
          "employee_id"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_employment_contracts",
    "fields": [
      {
        "path": [
          "employee_id"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "kind"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "salaryKind"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "weeklyHours"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "contractStart"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "contractEnd"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "hourlyWage"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "concludedOn"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "workLocation"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "employeeAddress"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "jobType"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "jobTypeOther"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "templateType"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "indefinite"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "renewalText"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "commuteCap"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "duties"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "workHours"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "fixedOvertime"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "startTime"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "endTime"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "breakMinutes"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_mypage_submissions",
    "fields": [
      {
        "path": [
          "proposed_one_way"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "count"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "details"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "effectiveDate"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "note"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "selfAddress"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "selfPhone"
        ],
        "phone": true
      },
      {
        "path": [
          "payload",
          "ecName"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "ecRelationship"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "ecAddress"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "ecPhone"
        ],
        "phone": true
      },
      {
        "path": [
          "payload",
          "kind"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "station"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "bankName"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "bankCode"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "branchName"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "branchCode"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "holderKana"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "desiredDate"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "reason"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "pledgeDate"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "address"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "signature"
        ],
        "phone": false
      },
      {
        "path": [
          "payload",
          "agreed"
        ],
        "phone": false
      },
      {
        "path": [
          "submission_type"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_ap_daily_report",
    "fields": [
      {
        "path": [
          "report_date"
        ],
        "phone": false
      },
      {
        "path": [
          "kind"
        ],
        "phone": false
      },
      {
        "path": [
          "start_time"
        ],
        "phone": false
      },
      {
        "path": [
          "end_time"
        ],
        "phone": false
      },
      {
        "path": [
          "work_minutes"
        ],
        "phone": false
      },
      {
        "path": [
          "count"
        ],
        "phone": false
      },
      {
        "path": [
          "month_total"
        ],
        "phone": false
      },
      {
        "path": [
          "coin_created"
        ],
        "phone": false
      },
      {
        "path": [
          "guide_promised"
        ],
        "phone": false
      },
      {
        "path": [
          "guide_in_progress"
        ],
        "phone": false
      },
      {
        "path": [
          "statement_check_request"
        ],
        "phone": false
      },
      {
        "path": [
          "coin_total"
        ],
        "phone": false
      },
      {
        "path": [
          "reflection"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_payroll_notice",
    "fields": [
      {
        "path": [
          "team"
        ],
        "phone": false
      },
      {
        "path": [
          "commute_flag"
        ],
        "phone": false
      },
      {
        "path": [
          "commute_people"
        ],
        "phone": false
      },
      {
        "path": [
          "training_flag"
        ],
        "phone": false
      },
      {
        "path": [
          "training_people"
        ],
        "phone": false
      },
      {
        "path": [
          "referral_flag"
        ],
        "phone": false
      },
      {
        "path": [
          "referral_people"
        ],
        "phone": false
      },
      {
        "path": [
          "other_notes"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_shukkin_member",
    "fields": [
      {
        "path": [
          "group_name"
        ],
        "phone": false
      },
      {
        "path": [
          "display_name"
        ],
        "phone": false
      },
      {
        "path": [
          "sort_order"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_bank_successors",
    "fields": [
      {
        "path": [
          "old_bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "old_branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "new_bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "new_branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "effective_date"
        ],
        "phone": false
      },
      {
        "path": [
          "note"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_minimum_wages",
    "fields": [
      {
        "path": [
          "prefecture"
        ],
        "phone": false
      },
      {
        "path": [
          "hourly_amount"
        ],
        "phone": false
      },
      {
        "path": [
          "effective_from"
        ],
        "phone": false
      },
      {
        "path": [
          "source_url"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_mail_forwardings",
    "fields": [
      {
        "path": [
          "holder"
        ],
        "phone": false
      },
      {
        "path": [
          "from_address"
        ],
        "phone": false
      },
      {
        "path": [
          "to_address"
        ],
        "phone": false
      },
      {
        "path": [
          "notes"
        ],
        "phone": false
      },
      {
        "path": [
          "stopped"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "root_mail_forwarding_filings",
    "fields": [
      {
        "path": [
          "filed_on"
        ],
        "phone": false
      },
      {
        "path": [
          "method"
        ],
        "phone": false
      },
      {
        "path": [
          "receipt"
        ],
        "phone": false
      },
      {
        "path": [
          "filed_by"
        ],
        "phone": false
      },
      {
        "path": [
          "notes"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_onboarding",
    "fields": [
      {
        "path": [
          "name"
        ],
        "phone": false
      },
      {
        "path": [
          "name_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "gender"
        ],
        "phone": false
      },
      {
        "path": [
          "birth_date"
        ],
        "phone": false
      },
      {
        "path": [
          "postal_code"
        ],
        "phone": false
      },
      {
        "path": [
          "address"
        ],
        "phone": false
      },
      {
        "path": [
          "address_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "phone"
        ],
        "phone": true
      },
      {
        "path": [
          "email"
        ],
        "phone": false
      },
      {
        "path": [
          "householder_name"
        ],
        "phone": false
      },
      {
        "path": [
          "householder_relation"
        ],
        "phone": false
      },
      {
        "path": [
          "pension_number"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_insurance_status"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_insurance_number"
        ],
        "phone": false
      },
      {
        "path": [
          "previous_employer"
        ],
        "phone": false
      },
      {
        "path": [
          "previous_employer_from"
        ],
        "phone": false
      },
      {
        "path": [
          "previous_employer_to"
        ],
        "phone": false
      },
      {
        "path": [
          "commute_method"
        ],
        "phone": false
      },
      {
        "path": [
          "bank_name"
        ],
        "phone": false
      },
      {
        "path": [
          "bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "branch_name"
        ],
        "phone": false
      },
      {
        "path": [
          "branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "account_type"
        ],
        "phone": false
      },
      {
        "path": [
          "account_holder_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "emergency_name"
        ],
        "phone": false
      },
      {
        "path": [
          "emergency_relation"
        ],
        "phone": false
      },
      {
        "path": [
          "emergency_relation_other"
        ],
        "phone": false
      },
      {
        "path": [
          "emergency_address"
        ],
        "phone": false
      },
      {
        "path": [
          "emergency_phone"
        ],
        "phone": true
      },
      {
        "path": [
          "commute_routes"
        ],
        "phone": false
      },
      {
        "path": [
          "nda_agreed_at"
        ],
        "phone": false
      },
      {
        "path": [
          "office"
        ],
        "phone": false
      },
      {
        "path": [
          "weekly_hours"
        ],
        "phone": false
      },
      {
        "path": [
          "health_insurance"
        ],
        "phone": false
      },
      {
        "path": [
          "pension_insurance"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_insurance"
        ],
        "phone": false
      },
      {
        "path": [
          "tax_class"
        ],
        "phone": false
      },
      {
        "path": [
          "salary_kind"
        ],
        "phone": false
      },
      {
        "path": [
          "base_salary"
        ],
        "phone": false
      },
      {
        "path": [
          "allowances"
        ],
        "phone": false
      },
      {
        "path": [
          "commute_cap_monthly"
        ],
        "phone": false
      },
      {
        "path": [
          "commute_fixed_monthly"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_hire_candidates",
    "fields": [
      {
        "path": [
          "last_name"
        ],
        "phone": false
      },
      {
        "path": [
          "first_name"
        ],
        "phone": false
      },
      {
        "path": [
          "last_name_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "first_name_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "birthday"
        ],
        "phone": false
      },
      {
        "path": [
          "gender"
        ],
        "phone": false
      },
      {
        "path": [
          "hire_date"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_type"
        ],
        "phone": false
      },
      {
        "path": [
          "company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "kot_division_code"
        ],
        "phone": false
      },
      {
        "path": [
          "kot_type_code"
        ],
        "phone": false
      },
      {
        "path": [
          "checklist"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_expense_report",
    "fields": [
      {
        "path": [
          "form"
        ],
        "phone": false
      },
      {
        "path": [
          "business"
        ],
        "phone": false
      },
      {
        "path": [
          "payment"
        ],
        "phone": false
      },
      {
        "path": [
          "paid_on"
        ],
        "phone": false
      },
      {
        "path": [
          "amount"
        ],
        "phone": false
      },
      {
        "path": [
          "purpose"
        ],
        "phone": false
      },
      {
        "path": [
          "purpose_detail"
        ],
        "phone": false
      },
      {
        "path": [
          "note"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_nhk_visit_report",
    "fields": [
      {
        "path": [
          "visit_date"
        ],
        "phone": false
      },
      {
        "path": [
          "start_time"
        ],
        "phone": false
      },
      {
        "path": [
          "end_time"
        ],
        "phone": false
      },
      {
        "path": [
          "destination"
        ],
        "phone": false
      },
      {
        "path": [
          "new_ground"
        ],
        "phone": false
      },
      {
        "path": [
          "new_satellite"
        ],
        "phone": false
      },
      {
        "path": [
          "address_ground"
        ],
        "phone": false
      },
      {
        "path": [
          "address_satellite"
        ],
        "phone": false
      },
      {
        "path": [
          "bank_credit"
        ],
        "phone": false
      },
      {
        "path": [
          "transport_fee"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_contracts",
    "fields": [
      {
        "path": [
          "counterparty"
        ],
        "phone": false
      },
      {
        "path": [
          "company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "contract_type"
        ],
        "phone": false
      },
      {
        "path": [
          "concluded_on"
        ],
        "phone": false
      },
      {
        "path": [
          "note"
        ],
        "phone": false
      },
      {
        "path": [
          "drive_file_id"
        ],
        "phone": false
      },
      {
        "path": [
          "product"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_dev_questions",
    "fields": [
      {
        "path": [
          "title"
        ],
        "phone": false
      },
      {
        "path": [
          "module"
        ],
        "phone": false
      },
      {
        "path": [
          "body"
        ],
        "phone": false
      },
      {
        "path": [
          "answer_type"
        ],
        "phone": false
      },
      {
        "path": [
          "options"
        ],
        "phone": false
      },
      {
        "path": [
          "answer_choice"
        ],
        "phone": false
      },
      {
        "path": [
          "answer_text_raw"
        ],
        "phone": false
      },
      {
        "path": [
          "answer_text"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_site_news",
    "fields": [
      {
        "path": [
          "company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "published_on"
        ],
        "phone": false
      },
      {
        "path": [
          "title"
        ],
        "phone": false
      },
      {
        "path": [
          "body"
        ],
        "phone": false
      },
      {
        "path": [
          "is_published"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_kanri_person",
    "fields": [
      {
        "path": [
          "name"
        ],
        "phone": false
      },
      {
        "path": [
          "kot_name"
        ],
        "phone": false
      },
      {
        "path": [
          "team"
        ],
        "phone": false
      },
      {
        "path": [
          "department"
        ],
        "phone": false
      },
      {
        "path": [
          "employment_kind"
        ],
        "phone": false
      },
      {
        "path": [
          "base_wage"
        ],
        "phone": false
      },
      {
        "path": [
          "is_field_sales"
        ],
        "phone": false
      },
      {
        "path": [
          "active"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_kanri_month_setting",
    "fields": [
      {
        "path": [
          "holidays"
        ],
        "phone": false
      },
      {
        "path": [
          "year_month"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "soil_list_condition",
    "fields": [
      {
        "path": [
          "name"
        ],
        "phone": false
      },
      {
        "path": [
          "condition"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "soil_list_internal_block",
    "fields": [
      {
        "path": [
          "電話番号"
        ],
        "phone": true
      },
      {
        "path": [
          "理由"
        ],
        "phone": false
      },
      {
        "path": [
          "解除理由"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_line_broadcast",
    "fields": [
      {
        "path": [
          "title"
        ],
        "phone": false
      },
      {
        "path": [
          "body"
        ],
        "phone": false
      },
      {
        "path": [
          "tag_ids"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_line_tag",
    "fields": [
      {
        "path": [
          "name"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_line_tag_member",
    "fields": [
      {
        "path": [
          "tag_id"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_line_greeting",
    "fields": [
      {
        "path": [
          "employment_tag_id"
        ],
        "phone": false
      },
      {
        "path": [
          "business_tag_id"
        ],
        "phone": false
      },
      {
        "path": [
          "body"
        ],
        "phone": false
      },
      {
        "path": [
          "enabled"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_line_contact",
    "fields": [
      {
        "path": [
          "employee_id"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_line_target",
    "fields": [
      {
        "path": [
          "label"
        ],
        "phone": false
      },
      {
        "path": [
          "chatwork_room_id"
        ],
        "phone": false
      },
      {
        "path": [
          "notify_enabled"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bud_expense_requests",
    "fields": [
      {
        "path": [
          "expense_kind"
        ],
        "phone": false
      },
      {
        "path": [
          "corp_id"
        ],
        "phone": false
      },
      {
        "path": [
          "receipt_date"
        ],
        "phone": false
      },
      {
        "path": [
          "receipt_time"
        ],
        "phone": false
      },
      {
        "path": [
          "store_name"
        ],
        "phone": false
      },
      {
        "path": [
          "amount"
        ],
        "phone": false
      },
      {
        "path": [
          "qualified_class"
        ],
        "phone": false
      },
      {
        "path": [
          "qualified_number"
        ],
        "phone": false
      },
      {
        "path": [
          "category_id"
        ],
        "phone": false
      },
      {
        "path": [
          "description"
        ],
        "phone": false
      },
      {
        "path": [
          "receipt_rotation"
        ],
        "phone": false
      },
      {
        "path": [
          "return_reason"
        ],
        "phone": false
      },
      {
        "path": [
          "booking_date"
        ],
        "phone": false
      },
      {
        "path": [
          "booking_corp_id"
        ],
        "phone": false
      },
      {
        "path": [
          "fiscal_period"
        ],
        "phone": false
      },
      {
        "path": [
          "storage_path"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bud_transfers",
    "fields": [
      {
        "path": [
          "data_source"
        ],
        "phone": false
      },
      {
        "path": [
          "payment_category"
        ],
        "phone": false
      },
      {
        "path": [
          "request_company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "execute_company_id"
        ],
        "phone": false
      },
      {
        "path": [
          "source_account_id"
        ],
        "phone": false
      },
      {
        "path": [
          "vendor_id"
        ],
        "phone": false
      },
      {
        "path": [
          "payee_name"
        ],
        "phone": false
      },
      {
        "path": [
          "payee_bank_name"
        ],
        "phone": false
      },
      {
        "path": [
          "payee_bank_code"
        ],
        "phone": false
      },
      {
        "path": [
          "payee_branch_name"
        ],
        "phone": false
      },
      {
        "path": [
          "payee_branch_code"
        ],
        "phone": false
      },
      {
        "path": [
          "payee_account_type"
        ],
        "phone": false
      },
      {
        "path": [
          "payee_account_holder_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "registered_method"
        ],
        "phone": false
      },
      {
        "path": [
          "payeasy_biller_no"
        ],
        "phone": false
      },
      {
        "path": [
          "amount"
        ],
        "phone": false
      },
      {
        "path": [
          "fee_bearer"
        ],
        "phone": false
      },
      {
        "path": [
          "scheduled_date"
        ],
        "phone": false
      },
      {
        "path": [
          "due_date"
        ],
        "phone": false
      },
      {
        "path": [
          "description"
        ],
        "phone": false
      },
      {
        "path": [
          "invoice_pdf_url"
        ],
        "phone": false
      },
      {
        "path": [
          "scan_image_url"
        ],
        "phone": false
      },
      {
        "path": [
          "cashback_applicant_name"
        ],
        "phone": false
      },
      {
        "path": [
          "cashback_applicant_name_kana"
        ],
        "phone": false
      },
      {
        "path": [
          "cashback_applicant_phone"
        ],
        "phone": true
      },
      {
        "path": [
          "cashback_product_name"
        ],
        "phone": false
      },
      {
        "path": [
          "cashback_channel_name"
        ],
        "phone": false
      },
      {
        "path": [
          "rejection_reason"
        ],
        "phone": false
      },
      {
        "path": [
          "manual_paid_at"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bud_mf_accounts",
    "fields": [
      {
        "path": [
          "mail_alias"
        ],
        "phone": false
      },
      {
        "path": [
          "hidden"
        ],
        "phone": false
      },
      {
        "path": [
          "book_sub_account_name"
        ],
        "phone": false
      },
      {
        "path": [
          "balance_mode"
        ],
        "phone": false
      },
      {
        "path": [
          "anchor_balance"
        ],
        "phone": false
      },
      {
        "path": [
          "anchor_at"
        ],
        "phone": false
      },
      {
        "path": [
          "anchor_date"
        ],
        "phone": false
      },
      {
        "path": [
          "balance_note"
        ],
        "phone": false
      },
      {
        "path": [
          "visible_employee_ids"
        ],
        "phone": false
      },
      {
        "path": [
          "sort_order"
        ],
        "phone": false
      },
      {
        "path": [
          "name"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bud_mf_group_viewers",
    "fields": [
      {
        "path": [
          "employee_ids"
        ],
        "phone": false
      },
      {
        "path": [
          "kind"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bud_mf_axis_order",
    "fields": [
      {
        "path": [
          "sort_order"
        ],
        "phone": false
      },
      {
        "path": [
          "key"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bud_bb_viewers",
    "fields": [
      {
        "path": [
          "employee_ids"
        ],
        "phone": false
      },
      {
        "path": [
          "id"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "sprout_baitoru_postings",
    "fields": [
      {
        "path": [
          "start_date"
        ],
        "phone": false
      },
      {
        "path": [
          "end_date"
        ],
        "phone": false
      },
      {
        "path": [
          "content"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "sprout_baitoru_settings",
    "fields": [
      {
        "path": [
          "content_options"
        ],
        "phone": false
      },
      {
        "path": [
          "exclude_inquiry_nos"
        ],
        "phone": false
      },
      {
        "path": [
          "notify_room"
        ],
        "phone": false
      },
      {
        "path": [
          "mention_employee_ids"
        ],
        "phone": false
      },
      {
        "path": [
          "max_per_run"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bloom_monthly_digests",
    "fields": [
      {
        "path": [
          "title"
        ],
        "phone": false
      },
      {
        "path": [
          "summary"
        ],
        "phone": false
      },
      {
        "path": [
          "pages"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bloom_daily_logs",
    "fields": [
      {
        "path": [
          "planned_items"
        ],
        "phone": false
      },
      {
        "path": [
          "log_date"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "bloom_ceo_status",
    "fields": [
      {
        "path": [
          "status"
        ],
        "phone": false
      },
      {
        "path": [
          "summary"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "shinkouki",
    "fields": [
      {
        "path": [
          "uriage"
        ],
        "phone": false
      },
      {
        "path": [
          "gaichuhi"
        ],
        "phone": false
      },
      {
        "path": [
          "rieki"
        ],
        "phone": false
      },
      {
        "path": [
          "reflected"
        ],
        "phone": false
      },
      {
        "path": [
          "zantei"
        ],
        "phone": false
      },
      {
        "path": [
          "company_id"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "fiscal_periods",
    "fields": [
      {
        "path": [
          "junshisan"
        ],
        "phone": false
      },
      {
        "path": [
          "genkin"
        ],
        "phone": false
      },
      {
        "path": [
          "yokin"
        ],
        "phone": false
      },
      {
        "path": [
          "doc_url"
        ],
        "phone": false
      },
      {
        "path": [
          "company_id"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_innovera_daily_extension",
    "fields": [
      {
        "path": [
          "extension"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_zenkaku_check_request",
    "fields": [
      {
        "path": [
          "sales_id"
        ],
        "phone": false
      }
    ]
  },
  {
    "table": "system_zenkaku_submission",
    "fields": [
      {
        "path": [
          "selected_partner_code"
        ],
        "phone": false
      },
      {
        "path": [
          "duplicate_confirmed"
        ],
        "phone": false
      }
    ]
  }
]$catalog$::jsonb;
  source jsonb;
  field jsonb;
  base_name text;
  column_type text;
  expression text;
  parts text[];
  segment text;
  path_index integer;
BEGIN
  FOR source IN SELECT * FROM jsonb_array_elements(spec) LOOP
    IF to_regclass(format('%I.%I', 'public', source->>'table')) IS NULL THEN
      RAISE NOTICE 'Search: missing table %, skipped', source->>'table';
      CONTINUE;
    END IF;
    parts := ARRAY[]::text[];
    FOR field IN SELECT * FROM jsonb_array_elements(source->'fields') LOOP
      base_name := field->'path'->>0;
      SELECT c.data_type INTO column_type FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = source->>'table' AND c.column_name = base_name;
      IF NOT FOUND THEN
        RAISE NOTICE 'Search: missing column %.%, skipped', source->>'table', base_name;
        CONTINUE;
      END IF;
      expression := format('%I', base_name);
      IF jsonb_array_length(field->'path') > 1 THEN
        IF column_type NOT IN ('json', 'jsonb') THEN
          RAISE NOTICE 'Search: non-JSON column %.%, skipped', source->>'table', base_name;
          CONTINUE;
        END IF;
        FOR path_index IN 1..jsonb_array_length(field->'path') - 1 LOOP
          segment := field->'path'->>path_index;
          expression := expression || CASE WHEN path_index = jsonb_array_length(field->'path') - 1 THEN '->>' ELSE '->' END || quote_literal(segment);
        END LOOP;
      ELSIF column_type IN ('date', 'timestamp without time zone', 'timestamp with time zone') THEN
        parts := array_append(parts, format('public.garden_search_date(%s)',
          CASE WHEN column_type = 'timestamp with time zone' THEN expression || ' AT TIME ZONE ''Asia/Tokyo''' ELSE expression || '::timestamp without time zone' END));
        expression := format('public.garden_search_value(%s)', expression);
      ELSE
        expression := format('public.garden_search_value(%s)', expression);
      END IF;
      parts := array_append(parts, format('public.search_norm(%s, %L::boolean)', expression, field->>'phone'));
    END LOOP;
    IF cardinality(parts) = 0 THEN CONTINUE; END IF;
    -- 元の表には列を足さない（行を丸ごと読んで書き戻す画面を壊さないため）。検索用のビュー＋式の索引にする
    EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_invoker = true) AS SELECT t.*, public.garden_search_join(%s) AS search_text FROM public.%I t',
      'search_v_' || (source->>'table'), array_to_string(parts, ', '), source->>'table');
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', 'search_v_' || (source->>'table'));
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', 'search_v_' || (source->>'table'));
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin ((public.garden_search_join(%s)) gin_trgm_ops)',
      left(source->>'table', 40) || '_search_trgm_idx', source->>'table', array_to_string(parts, ', '));
  END LOOP;
END;
$migration$;
