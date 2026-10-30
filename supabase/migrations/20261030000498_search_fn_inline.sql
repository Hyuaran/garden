-- 2026-10-30 Claude: 検索の関数から SET を外して軽くする（SET があると1行ずつの呼び出しが重く、2文字の検索で経費が 8 秒かかった）。中身は同じ。索引は作り直す
CREATE OR REPLACE FUNCTION public.garden_search_value(value anyelement)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT value::text $$;
CREATE OR REPLACE FUNCTION public.garden_search_date(value timestamp without time zone)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT to_char(value, 'YYYY-MM-DD') || ' ' || to_char(value, 'YYYY/MM/DD') $$;
CREATE OR REPLACE FUNCTION public.garden_search_join(VARIADIC parts text[])
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT pg_catalog.array_to_string(parts, ' ') $$;
CREATE OR REPLACE FUNCTION public.search_norm(value text, phone boolean DEFAULT false)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT pg_catalog.lower(normalize(value, NFKC)) || ' ' || pg_catalog.regexp_replace(pg_catalog.lower(normalize(value, NFKC)), '[,，]', '', 'g')
    || CASE WHEN phone THEN ' ' || pg_catalog.regexp_replace(pg_catalog.lower(normalize(value, NFKC)), '[-‐‑‒–—−ー,，[:space:]]', '', 'g') ELSE '' END
$$;
REINDEX INDEX public.root_companies_search_trgm_idx;
REINDEX INDEX public.root_vendors_search_trgm_idx;
REINDEX INDEX public.root_employees_search_trgm_idx;
REINDEX INDEX public.root_bank_accounts_search_trgm_idx;
REINDEX INDEX public.root_salary_systems_search_trgm_idx;
REINDEX INDEX public.root_insurance_search_trgm_idx;
REINDEX INDEX public.root_attendance_search_trgm_idx;
REINDEX INDEX public.root_employee_team_history_search_trgm_idx;
REINDEX INDEX public.root_employee_profile_history_search_trgm_idx;
REINDEX INDEX public.system_employment_contracts_search_trgm_idx;
REINDEX INDEX public.system_mypage_submissions_search_trgm_idx;
REINDEX INDEX public.system_ap_daily_report_search_trgm_idx;
REINDEX INDEX public.root_payroll_notice_search_trgm_idx;
REINDEX INDEX public.system_shukkin_member_search_trgm_idx;
REINDEX INDEX public.system_bank_successors_search_trgm_idx;
REINDEX INDEX public.root_minimum_wages_search_trgm_idx;
REINDEX INDEX public.root_mail_forwardings_search_trgm_idx;
REINDEX INDEX public.root_mail_forwarding_filings_search_trgm_idx;
REINDEX INDEX public.system_onboarding_search_trgm_idx;
REINDEX INDEX public.system_hire_candidates_search_trgm_idx;
REINDEX INDEX public.system_expense_report_search_trgm_idx;
REINDEX INDEX public.system_nhk_visit_report_search_trgm_idx;
REINDEX INDEX public.system_contracts_search_trgm_idx;
REINDEX INDEX public.system_dev_questions_search_trgm_idx;
REINDEX INDEX public.system_site_news_search_trgm_idx;
REINDEX INDEX public.system_kanri_person_search_trgm_idx;
REINDEX INDEX public.system_kanri_month_setting_search_trgm_idx;
REINDEX INDEX public.soil_list_condition_search_trgm_idx;
REINDEX INDEX public.soil_list_internal_block_search_trgm_idx;
REINDEX INDEX public.system_line_broadcast_search_trgm_idx;
REINDEX INDEX public.system_line_tag_search_trgm_idx;
REINDEX INDEX public.system_line_tag_member_search_trgm_idx;
REINDEX INDEX public.system_line_greeting_search_trgm_idx;
REINDEX INDEX public.system_line_contact_search_trgm_idx;
REINDEX INDEX public.system_line_target_search_trgm_idx;
REINDEX INDEX public.bud_expense_requests_search_trgm_idx;
REINDEX INDEX public.bud_transfers_search_trgm_idx;
REINDEX INDEX public.bud_mf_accounts_search_trgm_idx;
REINDEX INDEX public.bud_mf_group_viewers_search_trgm_idx;
REINDEX INDEX public.bud_mf_axis_order_search_trgm_idx;
REINDEX INDEX public.bud_bb_viewers_search_trgm_idx;
REINDEX INDEX public.sprout_baitoru_postings_search_trgm_idx;
REINDEX INDEX public.sprout_baitoru_settings_search_trgm_idx;
REINDEX INDEX public.bloom_monthly_digests_search_trgm_idx;
REINDEX INDEX public.bloom_daily_logs_search_trgm_idx;
REINDEX INDEX public.bloom_ceo_status_search_trgm_idx;
REINDEX INDEX public.shinkouki_search_trgm_idx;
REINDEX INDEX public.fiscal_periods_search_trgm_idx;
REINDEX INDEX public.system_innovera_daily_extension_search_trgm_idx;
REINDEX INDEX public.system_zenkaku_check_request_search_trgm_idx;
REINDEX INDEX public.system_zenkaku_submission_search_trgm_idx;
