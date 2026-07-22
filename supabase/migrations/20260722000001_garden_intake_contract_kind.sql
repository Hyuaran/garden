-- Codex-161: Garden取込の5分類目「契約書」を許可する。
-- 既存のSELECT/INSERT/作成者UPDATE RLSポリシーはkind非依存のため変更不要。
alter table public.garden_intake_items
  drop constraint if exists garden_intake_items_kind_check;

alter table public.garden_intake_items
  add constraint garden_intake_items_kind_check
  check (kind in ('請求', '入金', '条件', '周知', '契約書'));
