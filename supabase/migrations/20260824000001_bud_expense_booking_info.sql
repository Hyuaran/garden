alter table public.bud_expense_requests
  add column if not exists booking_date date,
  add column if not exists booking_corp_id text references public.bud_corporations(id),
  add column if not exists booking_set_at timestamptz,
  add column if not exists booking_set_by uuid references auth.users(id);

comment on column public.bud_expense_requests.booking_date is '仕分け日。入力済み判定にも使用する';
comment on column public.bud_expense_requests.booking_corp_id is '仕分け法人。元法人 corp_id は変更しない';
comment on column public.bud_expense_requests.booking_set_at is '仕分け情報の最終入力日時';
comment on column public.bud_expense_requests.booking_set_by is '仕分け情報の最終入力者';

create index if not exists bud_expense_requests_booking_corp_date_idx
  on public.bud_expense_requests (booking_corp_id, booking_date)
  where booking_date is not null and deleted_at is null;

-- RLS は既存の bud_expense_requests ポリシーをそのまま利用する。
