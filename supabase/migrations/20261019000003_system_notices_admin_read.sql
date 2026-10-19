-- 全権（super_admin）は、見せる相手（役職）に関係なく、公開済み・下書きのすべてのお知らせを読める（公開する／しないの管理のため）
drop policy if exists notices_read on public.system_notices;
create policy notices_read on public.system_notices for select to authenticated using (
 (status = 'published' and (cardinality(visible_roles) = 0 or exists (
 select 1 from public.root_employees e where e.user_id = auth.uid() and e.deleted_at is null and e.garden_role = any(visible_roles))))
 or exists (select 1 from public.root_employees e where e.user_id = auth.uid() and e.deleted_at is null and e.garden_role = 'super_admin')
);
