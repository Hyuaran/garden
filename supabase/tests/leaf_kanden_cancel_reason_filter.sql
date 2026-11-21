-- Run only on a local/test database after migration 546.
begin;
do $$
declare
  search_query jsonb := '{"page":1,"search":"郵送前キャンセル","filters":{}}';
  fixture_query jsonb := '{"page":1,"search":"codex546-fixture-","filters":{}}';
  cases jsonb;
  entries jsonb;
  before_entry_search bigint;
begin
  before_entry_search := (public.leaf_kanden_entry_page('キャンセル', search_query, false)->>'total')::bigint;
  insert into public.leaf_kanden_orders (source, kanri_no, customer_name, ordered_on, cancelled_on, cancel_reason)
  values
    ('garden', '987546001', 'codex546-fixture-1', '2098-04-01', null, '郵送前キャンセル（入金なし）'),
    ('garden', '987546002', 'codex546-fixture-2', '2098-04-01', '2098-04-02', '戻入あり'),
    ('garden', '987546003', 'codex546-fixture-3', '2098-04-01', '2098-04-02', null),
    ('garden', '987546004', 'codex546-fixture-4', '2098-04-01', '2098-04-02', ''),
    ('garden', '987546005', 'codex546-fixture-5', '2098-04-01', null, '要確認（明細が PDF の月）');

  cases := public.leaf_kanden_case_page(2098, 'cancelled', search_query, true);
  assert (cases->>'total')::integer = 1, 'case search matches the reason';
  assert cases#>>'{rows,0,cancel_reason}' = '郵送前キャンセル（入金なし）', 'case rows include the reason';
  assert cases#>'{options,cancel_reason}' @> '["","戻入あり","郵送前キャンセル（入金なし）"]'::jsonb,
    'case choices include blank and reasons outside the search results';

  cases := public.leaf_kanden_case_page(2098, 'cancelled',
    jsonb_set(fixture_query, '{filters}', '{"cancel_reason":["","戻入あり"]}'), false);
  assert (cases->>'total')::integer = 3, 'case filter matches selected reasons, including null and empty text';

  cases := public.leaf_kanden_case_page(2098, 'active',
    jsonb_set(fixture_query, '{filters}', '{"cancel_reason":["要確認（明細が PDF の月）"]}'), true);
  assert (cases->>'total')::integer = 1, 'case filter finds review reasons on active orders';
  assert cases#>'{options,cancel_reason}' ? '要確認（明細が PDF の月）', 'case choices include the review reason';

  entries := public.leaf_kanden_entry_page('キャンセル', search_query, true);
  assert (entries->>'total')::bigint = before_entry_search + 1, 'entry search matches the reason';
  assert entries#>'{options,reason}' @> '["","戻入あり","郵送前キャンセル（入金なし）","要確認（明細が PDF の月）"]'::jsonb,
    'entry choices include blank, cancellation reasons, and review reasons';

  entries := public.leaf_kanden_entry_page('キャンセル',
    jsonb_set(fixture_query, '{filters}', '{"reason":["","戻入あり"]}'), false);
  assert (entries->>'total')::integer = 3, 'entry filter matches selected reasons, including null and empty text';
end $$;
rollback;
