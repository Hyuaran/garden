-- Run only on a local/test database after migration 544.
begin;
do $$
declare
  prefix constant text := 'codex544-fixture-';
  query jsonb := '{"page":1,"search":"codex544-fixture-","sort":{"id":"number","direction":"asc"},"filters":{}}';
  qty_before bigint;
  first_page jsonb;
  second_page jsonb;
  cases jsonb;
begin
  qty_before := coalesce((public.leaf_kanden_entry_page('入金待ち', query, true)#>>'{counts,入金待ち}')::bigint, 0);
  insert into public.leaf_kanden_orders
    (source, kanri_no, customer_name, ordered_on, entered_on, mailed_on, invoice_sent_on)
  select 'garden', (987544000 + n)::text, prefix || lpad(n::text, 2, '0'),
    date '2099-04-01', date '2099-04-02', date '2099-04-03', date '2099-04-04'
  from generate_series(1, 51) n;

  first_page := public.leaf_kanden_entry_page('入金待ち', query, true);
  second_page := public.leaf_kanden_entry_page('入金待ち', jsonb_set(query, '{page}', '2'), false);
  assert jsonb_array_length(first_page->'rows') = 50, 'entry first page';
  assert jsonb_array_length(second_page->'rows') = 1, 'entry second page';
  assert (first_page->>'total')::integer = 51, 'filtered total';
  assert (first_page#>>'{counts,入金待ち}')::bigint = qty_before + 51, 'counts include mailed rows without receipt dates';
  assert second_page->'counts' = 'null'::jsonb, 'page navigation omits badge counts';
  assert first_page#>>'{rows,0,1}' = '987544001', 'first sort position';
  assert second_page#>>'{rows,0,1}' = '987544051', 'last sort position';
  assert second_page#>>'{rows,0,5}' = '2099-04-04', 'invoice date in entry list';
  assert not (first_page->'rows' @> jsonb_build_array(second_page#>'{rows,0}')), 'no overlapping rows';

  query := jsonb_set(query, '{filters}', '{"number":["987544051"]}');
  first_page := public.leaf_kanden_entry_page('入金待ち', query, false);
  assert (first_page->>'total')::integer = 1, 'filter finds a row outside the first page';

  query := jsonb_set(jsonb_set(query, '{filters}', '{}'), '{sort,id}', '"kanri_no"');
  cases := public.leaf_kanden_case_page(2099, 'active', jsonb_set(query, '{page}', '2'), true);
  assert jsonb_array_length(cases->'rows') = 1, 'case list is paginated';
  assert cases#>>'{rows,0,kanri_no}' = '987544051', 'case list sorts before paging';
  assert cases#>>'{rows,0,invoice_sent_on}' = '2099-04-04', 'invoice date in case list';

  perform public.leaf_kanden_import_orders('[{"fm_pk":-20261120000544,"kanri_no":"987544099",
    "mailed_on":"2099-04-03","invoice_sent_on":"2099-04-04"}]');
  assert exists (select from public.leaf_kanden_orders o
    where o.fm_pk = -20261120000544 and o.mailed_on = date '2099-04-03'
      and o.invoice_sent_on = date '2099-04-04'), 'FileMaker dates are persisted by the import RPC';
end $$;
rollback;
