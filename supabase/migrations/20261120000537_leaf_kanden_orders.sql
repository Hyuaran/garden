begin;

insert into public.system_view_scopes (page_key, tab_key, label, default_roles)
values ('leaf-kanden', '', '関電 案件一覧', array['manager', 'admin', 'super_admin']::text[])
on conflict (page_key, tab_key) do update
set label = excluded.label, default_roles = excluded.default_roles;

create table public.leaf_kanden_orders (
  id uuid primary key default gen_random_uuid(),
  fm_pk numeric not null unique,
  kanri_no text,
  kanri_no_raw text,
  ordered_on date,
  entered_on date,
  specs_on date,
  app_sent_on date,
  invoice_sent_on date,
  cancelled_on date,
  payment_confirmed text,
  fc_result text,
  progress text,
  acquisition text,
  acquisition_method text,
  order_method text,
  sales_name text,
  clerk_name text,
  list_name text,
  contract_type text,
  power_apply text,
  plan text,
  phone text,
  denki_customer_no text,
  denki_supply_point text,
  douryoku_customer_no text,
  douryoku_supply_point text,
  gas_customer_no text,
  gas_supply_point text,
  note text,
  customer_name text,
  customer_kana text,
  postal_code text,
  address text,
  billing_amount numeric,
  fm_created_at timestamptz,
  fm_updated_at timestamptz,
  imported_at timestamptz not null default now()
);

create index leaf_kanden_orders_kanri_no_idx on public.leaf_kanden_orders (kanri_no);
create index leaf_kanden_orders_ordered_on_idx on public.leaf_kanden_orders (ordered_on);
create index leaf_kanden_orders_cancelled_on_idx on public.leaf_kanden_orders (cancelled_on);

create table public.leaf_kanden_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  rows integer not null,
  started_at timestamptz not null,
  finished_at timestamptz not null
);

alter table public.leaf_kanden_orders enable row level security;
alter table public.leaf_kanden_import_runs enable row level security;
revoke all on public.leaf_kanden_orders, public.leaf_kanden_import_runs from anon, authenticated;
grant select, insert, update on public.leaf_kanden_orders, public.leaf_kanden_import_runs to service_role;

-- 1 回の読み取りで年度内のタブ件数と選択中の案件・写メ枚数を取得する。
create function public.leaf_kanden_case_list(p_year integer, p_tab text)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with yearly as materialized (
    select o.*,
      case
        when o.cancelled_on is not null or o.progress like '%キャンセル%' then 'cancelled'
        when o.progress = 'エントリー完了' then 'completed'
        else 'active'
      end as status
    from public.leaf_kanden_orders o
    where o.ordered_on >= make_date(p_year, 4, 1)
      and o.ordered_on < make_date(p_year + 1, 4, 1)
  ),
  selected as materialized (select * from yearly where status = p_tab),
  photo_counts as (
    select p.kanri_no, count(*) as photo_count
    from (select distinct kanri_no from selected where kanri_no is not null) s
    join public.leaf_kanden_photos p using (kanri_no)
    where p.image_path !~* '\.pdf$'
    group by p.kanri_no
  )
  select jsonb_build_object(
    'hasOrders', exists (select 1 from public.leaf_kanden_orders),
    'updatedAt', (select max(finished_at) from public.leaf_kanden_import_runs where source = 'filemaker'),
    'years', coalesce((
      select jsonb_agg(year order by year desc)
      from (select distinct extract(year from ordered_on - interval '3 months')::int as year
            from public.leaf_kanden_orders where ordered_on is not null) years
    ), '[]'::jsonb),
    'counts', (select jsonb_build_object(
      'active', count(*) filter (where status = 'active'),
      'completed', count(*) filter (where status = 'completed'),
      'cancelled', count(*) filter (where status = 'cancelled')
    ) from yearly),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'kanri_no', s.kanri_no, 'kanri_no_raw', s.kanri_no_raw,
        'ordered_on', s.ordered_on, 'customer_name', s.customer_name, 'customer_kana', s.customer_kana,
        'address', s.address, 'acquisition', s.acquisition, 'contract_type', s.contract_type,
        'progress', s.progress, 'entered_on', s.entered_on, 'app_sent_on', s.app_sent_on,
        'invoice_sent_on', s.invoice_sent_on, 'sales_name', s.sales_name, 'clerk_name', s.clerk_name,
        'photo_count', coalesce(p.photo_count, 0)
      ) order by s.ordered_on desc, s.fm_pk desc)
      from selected s left join photo_counts p using (kanri_no)
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.leaf_kanden_case_list(integer, text) from public, anon, authenticated;
grant execute on function public.leaf_kanden_case_list(integer, text) to service_role;

commit;
