-- #377 の drive_file_id 書き戻しが RLS の UPDATE 許可漏れで 0 行更新（無音失敗）になっていた修正。
-- 作成者本人のみ自分の取込行を更新できる。
create policy "garden users can update own intake items"
  on public.garden_intake_items for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
