-- 未適用。付与ポイントを受注日と獲得方法で選ぶための共通台帳。
begin;
create extension if not exists btree_gist;

create function public.soil_product_name_key(p_name text)
returns text language sql immutable strict parallel safe
set search_path = public
as $$ select lower(btrim(regexp_replace(normalize(p_name, NFKC), '\s+', ' ', 'g'))) $$;

create table public.soil_product_points (
  id uuid primary key default gen_random_uuid(),
  product text not null check (btrim(product) <> ''),
  channel text not null check (channel in ('hakuchi', 'lp', 'alliance')),
  category text not null check (category in ('kaisen', 'credit', 'denki')),
  report_group text not null check (report_group in ('collab', 'au', 'credit', 'nuro', 'denki', 'other')),
  start_date date not null,
  end_date date,
  total_points numeric(6,2) not null,
  toss_points numeric(6,2) not null default 0.2,
  closer_points numeric(6,2) generated always as (total_points - toss_points) stored,
  unit_price integer check (unit_price >= 0),
  has_option text check (has_option in ('あり', 'なし', '')),
  kintone_names text[] not null default '{}',
  sort_order integer not null default 100,
  note text,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id),
  check (toss_points >= 0 and toss_points <= total_points),
  check (end_date is null or end_date >= start_date),
  constraint soil_product_points_no_overlap exclude using gist (
    (public.soil_product_name_key(product)) with =,
    channel with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  )
);
alter table public.soil_product_points enable row level security;
revoke all on public.soil_product_points from anon, authenticated;
grant select on public.soil_product_points to authenticated;
grant all on public.soil_product_points to service_role;
create policy soil_product_points_read on public.soil_product_points
  for select to authenticated using (public.has_role_at_least('manager'));

create function public.soil_product_points_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger soil_product_points_touch before update on public.soil_product_points
  for each row execute function public.soil_product_points_touch();

create function public.soil_product_point_at(p_product text, p_channel text, p_date date)
returns setof public.soil_product_points language sql stable security invoker
set search_path = public as $$
  select point.* from public.soil_product_points point
  where point.channel = p_channel
    and p_date >= point.start_date and (point.end_date is null or p_date <= point.end_date)
    and (public.soil_product_name_key(point.product) = public.soil_product_name_key(p_product)
      or exists (select 1 from unnest(point.kintone_names) alias
        where public.soil_product_name_key(alias) = public.soil_product_name_key(p_product)))
  order by (public.soil_product_name_key(point.product) = public.soil_product_name_key(p_product)) desc,
    point.start_date desc, point.id
  limit 1
$$;
revoke all on function public.soil_product_point_at(text,text,date) from public;
grant execute on function public.soil_product_point_at(text,text,date) to authenticated, service_role;

-- 既存行をロックし、終了日変更と新期間作成を一つのトランザクションで行う。
-- expected_updated_at は別の編集を上書きしないために必須。
create function public.soil_product_points_save(
  p_row jsonb, p_actor uuid, p_source_id uuid default null,
  p_expected_updated_at timestamptz default null, p_split boolean default false
)
returns setof public.soil_product_points language plpgsql security invoker
set search_path = public as $$
declare
  source public.soil_product_points;
  saved public.soil_product_points;
  new_start date := (p_row->>'start_date')::date;
begin
  if p_source_id is not null then
    select * into strict source from public.soil_product_points where id = p_source_id for update;
    if p_expected_updated_at is null or source.updated_at <> p_expected_updated_at then
      raise exception '別の変更が保存されています。画面を開き直してください。' using errcode = '40001';
    end if;
  elsif p_split then
    raise exception '切り替える期間がありません。';
  end if;
  if p_split then
    if new_start <= source.start_date or (source.end_date is not null and new_start > source.end_date) then
      raise exception '新しい開始日は今の期間内で、開始日の翌日以降にしてください。';
    end if;
    update public.soil_product_points set end_date = new_start - 1, updated_by = p_actor
      where id = source.id returning * into saved;
    return next saved;
    p_row := p_row || jsonb_build_object('product', source.product, 'channel', source.channel, 'end_date', source.end_date);
  end if;
  if p_source_id is null or p_split then
    insert into public.soil_product_points (
      product, channel, category, report_group, start_date, end_date, total_points, toss_points,
      unit_price, has_option, kintone_names, sort_order, note, updated_by
    ) values (
      btrim(p_row->>'product'), p_row->>'channel', p_row->>'category', p_row->>'report_group',
      new_start, (p_row->>'end_date')::date, (p_row->>'total_points')::numeric, (p_row->>'toss_points')::numeric,
      (p_row->>'unit_price')::integer, p_row->>'has_option',
      array(select jsonb_array_elements_text(p_row->'kintone_names')),
      (p_row->>'sort_order')::integer, p_row->>'note', p_actor
    ) returning * into saved;
  else
    update public.soil_product_points set
      product = btrim(p_row->>'product'), channel = p_row->>'channel', category = p_row->>'category',
      report_group = p_row->>'report_group', start_date = new_start, end_date = (p_row->>'end_date')::date,
      total_points = (p_row->>'total_points')::numeric, toss_points = (p_row->>'toss_points')::numeric,
      unit_price = (p_row->>'unit_price')::integer, has_option = p_row->>'has_option',
      kintone_names = array(select jsonb_array_elements_text(p_row->'kintone_names')),
      sort_order = (p_row->>'sort_order')::integer, note = p_row->>'note', updated_by = p_actor
    where id = source.id returning * into saved;
  end if;
  return next saved;
end $$;
revoke all on function public.soil_product_points_save(jsonb,uuid,uuid,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.soil_product_points_save(jsonb,uuid,uuid,timestamptz,boolean) to service_role;

insert into public.soil_product_points (product, category, report_group, total_points, toss_points, unit_price, has_option, kintone_names, sort_order, channel, start_date)
select seed.*, channels.channel, date '2026-11-01'
from (values
  ('BIGLOBE光', 'kaisen', 'collab', 1.2, 0.2, 32000, 'あり', ARRAY['BIGLOBE光']::text[], 10),
  ('Docomo光', 'kaisen', 'collab', 1.3, 0.2, 61000, 'なし', ARRAY['Docomo光', 'docomo光']::text[], 20),
  ('AU光', 'kaisen', 'au', 1.6, 0.2, 83500, 'あり', ARRAY['AU光', 'au光　Sonet', 'au光 Sonet', 'au光　BIGLOBE', 'au光 BIGLOBE', 'au光']::text[], 30),
  ('JUST光', 'kaisen', 'collab', 1, 0.2, 0, null, ARRAY['JUST光']::text[], 40),
  ('Ichi光', 'kaisen', 'collab', 1.2, 0.2, 0, null, ARRAY['Ichi光']::text[], 50),
  ('NURO光', 'kaisen', 'nuro', 1.4, 0.2, 86000, 'なし', ARRAY['NURO光']::text[], 60),
  ('So-net光', 'kaisen', 'collab', 1, 0.2, 65750, 'あり', ARRAY['So-net光']::text[], 70),
  ('Softbank光', 'kaisen', 'collab', 1, 0.2, 30000, null, ARRAY['Softbank光', 'Sofbank光']::text[], 80),
  ('さすがネット', 'kaisen', 'other', 0.2, 0.2, 42000, null, ARRAY['さすがネット', 'さすガねっと']::text[], 90),
  ('SoftbankAir レンタル', 'kaisen', 'other', 0.2, 0.2, 12000, null, ARRAY['SoftbankAir レンタル', 'SoftbankAir　レンタル']::text[], 100),
  ('SoftbankAir 割賦', 'kaisen', 'other', 1, 0.2, 52000, null, ARRAY['SoftbankAir 割賦', 'SoftbankAir　割賦']::text[], 110),
  ('au光プラス タイプ1', 'kaisen', 'au', 1.6, 0.2, 52500, null, ARRAY['au光プラス タイプ1', 'au光プラス　タイプ1']::text[], 120),
  ('au光プラス タイプ3', 'kaisen', 'au', 1.2, 0.2, 39000, null, ARRAY['au光プラス タイプ3', 'au光プラス　タイプ3']::text[], 130),
  ('JCB Biz ONE', 'credit', 'credit', 0.4, 0.4, 20000, null, ARRAY['JCB Biz ONE', 'JCB　Biz　ONE']::text[], 140),
  ('三井住友カード（NL）', 'credit', 'credit', 0.1, 0.1, 6000, null, ARRAY['三井住友カード（NL）']::text[], 150),
  ('三井住友ビジネスオーナーズ（SMCCAV）', 'credit', 'credit', 0.3, 0.3, 17500, null, ARRAY['三井住友ビジネスオーナーズ（SMCCAV）']::text[], 160),
  ('セゾン（発行のみ）', 'credit', 'credit', 0.4, 0.4, 28000, null, ARRAY['セゾン（発行のみ）']::text[], 170),
  ('ライフカードビジネスライト', 'credit', 'credit', 0.3, 0.3, 12500, null, ARRAY['ライフカードビジネスライト', 'ライフカード']::text[], 180),
  ('三菱UFJニコス', 'credit', 'credit', 0.3, 0.3, 16000, null, ARRAY['三菱UFJニコス']::text[], 190),
  ('ACマスター', 'credit', 'credit', 0.4, 0.4, 25000, null, ARRAY['ACマスター', 'ACマスターカード']::text[], 200),
  ('ドコモでんき', 'denki', 'denki', 0.3, 0.3, 14000, null, ARRAY['ドコモでんき']::text[], 210),
  ('大阪ガス電気セット', 'denki', 'denki', 0.2, 0.2, 5000, null, ARRAY['大阪ガス電気セット']::text[], 220),
  ('オクトパスエナジー', 'denki', 'denki', 0.2, 0.2, 7000, null, ARRAY['オクトパスエナジー']::text[], 230),
  ('エバーグリーン電気　GPプラン', 'denki', 'denki', 0.4, 0.4, 32000, null, ARRAY['エバーグリーン電気　GPプラン', 'エバーグリーン電気 GPプラン']::text[], 240),
  ('エネワン電気', 'denki', 'denki', 0.2, 0.2, 5000, null, ARRAY['エネワン電気']::text[], 250),
  ('アースインフィニティ', 'denki', 'denki', 0.4, 0.4, 18000, null, ARRAY['アースインフィニティ']::text[], 260),
  ('プライム電気(JAPAN電力)', 'denki', 'denki', 0.4, 0.4, 30600, null, ARRAY['プライム電気(JAPAN電力)']::text[], 270)
) as seed(product, category, report_group, total_points, toss_points, unit_price, has_option, kintone_names, sort_order)
cross join (values ('hakuchi'), ('lp'), ('alliance')) as channels(channel);

commit;
