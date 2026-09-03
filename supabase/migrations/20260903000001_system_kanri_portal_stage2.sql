-- 管理表ポータル 段階2：設定（付与ポイント・チーム）と計算結果の置き場
-- Supabase の SQL Editor で実行する。閲覧は責任者以上、書き込みはサーバー側（service_role）だけ。
begin;

-- 1) 付与ポイント（Excel の「付与ポイント」シートを設定に移す。商材を足すときは画面から）
create table if not exists public.system_kanri_point_master (
  product text primary key,            -- 管理表の列名（例: BIGLOBE光, JCB）
  kintone_names text[] not null default '{}',  -- Kintone 側の商材名区分2 の表記（例: {"au光　Sonet","au光"}）
  category text not null check (category in ('hikari','credit','denki','other')),
  coefficient numeric(6,3) not null default 1,  -- 係数（ポイント）
  unit_price integer,                  -- 単価（円）。無ければ NULL
  has_option text,                     -- OP有無（あり／なし／NULL）
  sort_order integer not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2) チーム（管理表の列ブロック。Excel では宮永チーム／小泉チーム／石原チームが式に直書きされていた）
create table if not exists public.system_kanri_team (
  team text primary key,               -- Kintone のチーム名と同じ表記
  sort_order integer not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 3) 計算結果（取り込み1回につき、シートごとに1行。中身は JSON の表）
create table if not exists public.system_kanri_result (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.system_kanri_run(id) on delete cascade,
  sheet text not null,                 -- 'kanri' | 'aporan' | 'jisseki' | 'houhan' | 'incentive' | 'payroll'
  grid jsonb not null,                 -- 行×列の値（列名つき）
  calculated_at timestamptz not null default now(),
  unique (run_id, sheet)
);

alter table public.system_kanri_point_master enable row level security;
alter table public.system_kanri_team enable row level security;
alter table public.system_kanri_result enable row level security;
drop policy if exists system_kanri_point_master_select_manager on public.system_kanri_point_master;
create policy system_kanri_point_master_select_manager on public.system_kanri_point_master for select to authenticated using (public.has_role_at_least('manager'));
drop policy if exists system_kanri_team_select_manager on public.system_kanri_team;
create policy system_kanri_team_select_manager on public.system_kanri_team for select to authenticated using (public.has_role_at_least('manager'));
drop policy if exists system_kanri_result_select_manager on public.system_kanri_result;
create policy system_kanri_result_select_manager on public.system_kanri_result for select to authenticated using (public.has_role_at_least('manager'));
grant select on public.system_kanri_point_master, public.system_kanri_team, public.system_kanri_result to authenticated;
grant all on public.system_kanri_point_master, public.system_kanri_team, public.system_kanri_result to service_role;

-- 初期値：8/31 の「付与ポイント」シートそのまま（係数・単価・OP有無）
insert into public.system_kanri_point_master (product, kintone_names, category, coefficient, unit_price, has_option, sort_order) values
  ('BIGLOBE光',        '{"BIGLOBE光"}',                       'hikari', 1.2, 41000, 'あり', 10),
  ('Docomo光',         '{"docomo光"}',                        'hikari', 1.3, 61000, 'なし', 20),
  ('AU光',             '{"au光　Sonet","au光　BIGLOBE","au光"}', 'hikari', 1.6, 84180, 'あり', 30),
  ('JUST光',           '{"JUST光"}',                          'hikari', 1.0, null,  null,   40),
  ('Ichi光',           '{"Ichi光"}',                          'hikari', 1.2, null,  null,   50),
  ('NURO光',           '{"NURO光"}',                          'hikari', 1.4, 63000, 'なし', 60),
  ('So-net光',         '{"So-net光"}',                        'hikari', 1.0, 65750, 'あり', 70),
  ('NURO光（7万CB）',   '{"NURO光（7万CB）"}',                  'hikari', 0.7, 33000, 'なし', 75),
  ('Sofbank光',        '{"Sofbank光"}',                       'hikari', 1.0, 30000, null,   80),
  ('JCB',              '{"JCB Biz ONE"}',                     'credit', 0.4, 20000, null,   90),
  ('NL',               '{"三井住友カード（NL）"}',              'credit', 0.1, 6000,  null,   100),
  ('SMCCAV',           '{"三井住友ビジネスオーナーズ（SMCCAV）"}','credit', 0.3, 17500, null,   110),
  ('セゾン',            '{"セゾン（発行のみ）"}',                'credit', 0.6, 35000, null,   120),
  ('ライフ',            '{"ライフカード"}',                     'credit', 0.3, 12500, null,   130),
  ('UFJ',              '{"三菱UFJニコス"}',                    'credit', 0.3, 16000, null,   140),
  ('ACマスター',        '{"ACマスターカード"}',                 'credit', 0.4, 25000, null,   150),
  ('ドコモでんき',       '{"ドコモでんき"}',                     'denki',  0.3, 16000, null,   160),
  ('大阪ガス電気セット',  '{"大阪ガス電気セット"}',               'denki',  0.2, 5000,  null,   170),
  ('オクトパスエナジー',  '{"オクトパスエナジー"}',               'denki',  0.2, 7000,  null,   180),
  ('さすガねっと',       '{"さすガねっと"}',                     'other',  0.2, 42000, null,   190)
on conflict (product) do nothing;

insert into public.system_kanri_team (team, sort_order) values ('宮永チーム', 10), ('小泉チーム', 20), ('石原チーム', 30)
on conflict (team) do nothing;

comment on table public.system_kanri_point_master is '管理表ポータルの付与ポイント（Excel の付与ポイントシートの置き換え）。kintone_names は Kintone 側の表記のゆれ。AU光の内訳は 8/31 の式で要確認。';
comment on table public.system_kanri_team is '管理表ポータルのチーム（列ブロック）。';
comment on table public.system_kanri_result is '管理表ポータルの計算結果。取り込み1回×シートごとに JSON の表で保存。';

commit;
