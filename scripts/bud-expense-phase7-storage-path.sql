-- ============================================================
-- Garden Bud — 経費精算 Phase 7: 保存先カラムの整理
-- これまで drive_file_id に Supabase Storage のパスを暫定保持していたのを是正：
--   storage_path   … Supabase Storage のパス（レビュー画面の画像表示用）
--   drive_file_id  … 本物の Google Drive ファイルID（申請者向けミラー）
-- 既存行は storage_path へ退避し drive_file_id を空にする（EMP- 始まり＝Storageパスのみ対象）。
-- Supabase SQL Editor で実行。安全（追加と該当行の付け替えのみ）。
-- ============================================================

ALTER TABLE public.bud_expense_requests
  ADD COLUMN IF NOT EXISTS storage_path text;

UPDATE public.bud_expense_requests
   SET storage_path = drive_file_id,
       drive_file_id = NULL
 WHERE storage_path IS NULL
   AND drive_file_id LIKE 'EMP-%';

NOTIFY pgrst, 'reload schema';
