begin;
create table public.bud_bb_agent_details (
 payment_date date not null,
 target_month text not null check (target_month ~ '^\d{4}-\d{2}$'),
 payee text not null,
 corp_code text not null,
 net numeric,
 gross numeric,
 tax_rate numeric,
 tax_mode text not null,
 source_file text not null,
 imported_at timestamptz not null default now(),
 review_reason text not null default '',
 primary key(payment_date,payee,corp_code)
);
alter table public.bud_bb_agent_details enable row level security;
create policy bud_bb_agent_details_read on public.bud_bb_agent_details for select to authenticated
 using (public.bud_has_access() and public.bud_is_admin_or_super_admin());
revoke all on public.bud_bb_agent_details from anon, authenticated;
grant select on public.bud_bb_agent_details to authenticated;
grant all on public.bud_bb_agent_details to service_role;
commit;
