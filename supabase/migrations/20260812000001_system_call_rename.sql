-- Move the call-center ingest storage from the Soil namespace to System.
-- PostgreSQL table renames preserve all rows, constraints, indexes, triggers, and RLS state.

alter table public.soil_call_history rename to system_call_history;
alter table public.soil_call_sync_log rename to system_call_sync_log;

alter table public.system_call_history
  rename constraint soil_call_history_pkey
  to system_call_history_pkey;
alter table public.system_call_history
  rename constraint soil_call_history_external_call_id_key
  to system_call_history_external_call_id_key;

alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_pkey
  to system_call_sync_log_pkey;
alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_batch_index_check
  to system_call_sync_log_batch_index_check;
alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_status_check
  to system_call_sync_log_status_check;
alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_duration_ms_check
  to system_call_sync_log_duration_ms_check;
alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_records_fetched_check
  to system_call_sync_log_records_fetched_check;
alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_records_inserted_check
  to system_call_sync_log_records_inserted_check;
alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_records_updated_check
  to system_call_sync_log_records_updated_check;
alter table public.system_call_sync_log
  rename constraint soil_call_sync_log_records_rejected_check
  to system_call_sync_log_records_rejected_check;

alter sequence public.soil_call_history_id_seq
  rename to system_call_history_id_seq;

alter index public.idx_soil_call_history_list_name
  rename to idx_system_call_history_list_name;
alter index public.idx_soil_call_history_call_date
  rename to idx_system_call_history_call_date;
alter index public.idx_soil_call_history_employee_date
  rename to idx_system_call_history_employee_date;
alter index public.idx_soil_call_history_phone
  rename to idx_system_call_history_phone;

alter index public.idx_soil_call_sync_log_triggered_at
  rename to idx_system_call_sync_log_triggered_at;
alter index public.idx_soil_call_sync_log_run_batch
  rename to idx_system_call_sync_log_run_batch;
alter index public.idx_soil_call_sync_log_failures
  rename to idx_system_call_sync_log_failures;

alter trigger trg_soil_call_history_updated_at on public.system_call_history
  rename to trg_system_call_history_updated_at;
alter trigger trg_soil_call_sync_log_updated_at on public.system_call_sync_log
  rename to trg_system_call_sync_log_updated_at;

alter function public.soil_call_history_set_updated_at()
  rename to system_call_history_set_updated_at;
alter function public.soil_call_sync_log_set_updated_at()
  rename to system_call_sync_log_set_updated_at;

comment on table public.system_call_history is
  'FileMaker Server 11 call history ingest storage owned by the System module.';
comment on table public.system_call_sync_log is
  'Batch synchronization log for the System call-history ingest endpoint.';

-- Apply verification:
-- select to_regclass('public.system_call_history'), to_regclass('public.system_call_sync_log');
-- select count(*) from public.system_call_history;
-- select indexname from pg_indexes where tablename in ('system_call_history', 'system_call_sync_log') order by indexname;
-- select relname, relrowsecurity from pg_class where relname in ('system_call_history', 'system_call_sync_log');
