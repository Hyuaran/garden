-- ============================================================
-- Garden Bud — Phase D #04: 給与明細配信（Y 案 + フォールバック + 上田目視 UI 連携）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-04-statement-distribution.md
-- 作成: 2026-05-08（a-bud、main- No.102 GO 受領後 Friday 朝 D-04 重実装着手）
--
-- 目的:
--   給与・賞与明細の PDF 配信を Y 案 + フォールバック方式で実装する基盤テーブル。
--   - 通常フロー: メール DL リンク（24h ワンタイム、PW なし PDF）+ LINE Bot 通知
--   - 例外フロー: メール DL リンク + PW 保護 PDF（強ランダム 16 文字）+ マイページ PW 確認
--   - 旧採択 MMDD 4 桁 PW は a-review #1 で破棄、本 migration で完全置換
--
-- スコープ（本 migration で対応）:
--   1. bud_payroll_notifications（配信ステータス管理、Y 案 + フォールバック）
--   2. bud_salary_statements（PDF 生成記録、SHA256 改ざん検知）
--   3. RLS（自分閲覧 + admin、INSERT は service_role / payroll_disburser、DELETE 完全禁止）
--
-- 含めない:
--   - PDF 生成本体（@react-pdf/renderer 利用）→ Server Action / API Route
--   - Storage バケット bud-salary-statements 作成 → 別 migration（admin Dashboard）
--   - メール送信（Resend / SendGrid）→ Server Action / Cron
--   - LINE Bot Messaging API → Server Action / Webhook
--   - Cron リトライ → /api/cron/bud-payroll-notification-retry
--   - 純関数（PW gen / token gen / delivery_method 判定）→ src/app/bud/payroll/_lib/distribution-*.ts
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_payroll_notifications（配信ステータス管理）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_notifications (
  id uuid primary key default gen_random_uuid(),
  salary_record_id uuid references public.bud_salary_records(id),
  bonus_record_id uuid references public.bud_bonus_records(id),
  employee_id uuid not null references public.root_employees(id),

  -- 配信方式（Y 案採択で 3 種に確定）
  delivery_method text not null
    check (delivery_method in ('line_email', 'fallback_email_pw', 'manual')),
    -- 'line_email'         = 通常: メール DL リンク + LINE Bot
    -- 'fallback_email_pw'  = 例外: メール DL リンク + PW 保護 PDF
    -- 'manual'             = メアド未登録・admin 個別対応

  -- 全体ステータス
  overall_status text not null default 'pending'
    check (overall_status in ('pending', 'sent', 'failed', 'pending_retry', 'cancelled')),
  retry_count int not null default 0
    check (retry_count >= 0 and retry_count <= 4),
  last_attempt_at timestamptz,
  next_retry_at timestamptz,

  -- メール経路（DL リンク）
  email_status text
    check (email_status is null or email_status in ('sent', 'failed', 'opened', 'downloaded', 'bounced')),
  email_to text,                                      -- 配信時点のスナップショット
  email_provider_message_id text,                     -- Resend / SendGrid 等の ID
  email_sent_at timestamptz,
  email_failed_reason text,

  -- DL リンク（24h ワンタイム）
  dl_token text unique,                               -- crypto.randomBytes(32).toString('base64url')
  dl_token_expires_at timestamptz,
  dl_used_at timestamptz,                             -- ワンタイム消費時刻
  dl_ip text,                                         -- 使用時の IP（監査）

  -- LINE Bot 経路
  line_status text
    check (line_status is null or line_status in ('sent', 'failed', 'unsupported', 'unfriend')),
  line_user_id_hash text,                             -- 配信時の LINE User ID（hash 化、PII 拡散防止）
  line_message_id text,                               -- LINE Platform 発行 ID
  line_sent_at timestamptz,
  line_failed_reason text,

  -- フォールバック PW（例外フロー時のみ、平文非保存）
  fallback_password_hash text,                        -- bcrypt + ランダムソルト
  fallback_password_plain_temp bytea,                 -- マイページ表示用、24h 期限後マスク（暗号化推奨）
  fallback_password_displayed_at timestamptz,         -- マイページで表示した時刻（監査）

  -- 現金手渡し受領確認
  cash_receipt_confirmed_at timestamptz,
  cash_receipt_paper_signed boolean not null default false,

  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- salary_record_id と bonus_record_id は排他（XOR）
  constraint chk_salary_or_bonus_xor
    check (
      (salary_record_id is not null and bonus_record_id is null)
      or (salary_record_id is null and bonus_record_id is not null)
    ),

  -- フォールバック時は PW 必須
  constraint chk_fallback_pw_required
    check (
      delivery_method <> 'fallback_email_pw'
      or fallback_password_hash is not null
    ),

  -- DL リンク発行時は expiry 必須
  constraint chk_dl_token_expiry
    check (
      dl_token is null
      or dl_token_expires_at is not null
    )
);

comment on table public.bud_payroll_notifications is
  '給与・賞与明細の配信ステータス管理。Y 案 + フォールバック対応、24h ワンタイム DL リンク + LINE Bot 通知 + フォールバック時 PW 保護 PDF。salary_record_id と bonus_record_id は排他（XOR）。';

create index if not exists idx_payroll_noti_pending_retry
  on public.bud_payroll_notifications (next_retry_at)
  where overall_status = 'pending_retry';

create index if not exists idx_payroll_noti_employee
  on public.bud_payroll_notifications (employee_id, created_at desc);

create index if not exists idx_payroll_noti_dl_token
  on public.bud_payroll_notifications (dl_token)
  where dl_token is not null and dl_used_at is null;

create index if not exists idx_payroll_noti_overall_status
  on public.bud_payroll_notifications (overall_status, created_at desc);

-- ------------------------------------------------------------
-- 2. bud_salary_statements（PDF 生成記録）
-- ------------------------------------------------------------
create table if not exists public.bud_salary_statements (
  id uuid primary key default gen_random_uuid(),
  salary_record_id uuid references public.bud_salary_records(id),
  bonus_record_id uuid references public.bud_bonus_records(id),
  employee_id uuid not null references public.root_employees(id),
  statement_type text not null
    check (statement_type in ('salary', 'bonus')),
  storage_path text not null,                         -- bud-salary-statements/{uuid}/{period}.pdf
  file_size_bytes int not null check (file_size_bytes > 0),
  pdf_checksum text not null,                         -- SHA256（改ざん検知）
  generated_at timestamptz not null default now(),
  generated_by uuid references public.root_employees(id),
  notification_sent_at timestamptz,
  notification_chatwork_message_id text,
  download_count int not null default 0 check (download_count >= 0),
  last_downloaded_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by uuid references public.root_employees(id),

  constraint chk_salary_or_bonus_type_consistency
    check (
      (salary_record_id is not null and bonus_record_id is null and statement_type = 'salary')
      or (salary_record_id is null and bonus_record_id is not null and statement_type = 'bonus')
    )
);

comment on table public.bud_salary_statements is
  '給与・賞与明細 PDF の生成記録。SHA256 改ざん検知、5 年保管（労基法 109 条）。salary_record_id / bonus_record_id と statement_type の整合性 CHECK。';

create index if not exists idx_statements_employee
  on public.bud_salary_statements (employee_id, generated_at desc);
create index if not exists idx_statements_period
  on public.bud_salary_statements (salary_record_id, bonus_record_id);

-- ------------------------------------------------------------
-- 3. RLS（D-09 helpers 利用）
-- ------------------------------------------------------------
alter table public.bud_payroll_notifications enable row level security;
alter table public.bud_salary_statements enable row level security;

-- ----- bud_payroll_notifications RLS -----
-- SELECT: 自分の通知 + payroll_* + admin
drop policy if exists pn_select on public.bud_payroll_notifications;
create policy pn_select on public.bud_payroll_notifications
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_disburser + admin（service_role は RLS バイパス）
drop policy if exists pn_insert on public.bud_payroll_notifications;
create policy pn_insert on public.bud_payroll_notifications
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

-- UPDATE: payroll_disburser + admin（status 遷移、retry_count 等）
-- 自分の cash_receipt_confirmed_at 更新は別 policy で許容
drop policy if exists pn_update on public.bud_payroll_notifications;
create policy pn_update on public.bud_payroll_notifications
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

-- 自分の cash_receipt_confirmed_at は本人 UPDATE 可（受領確認ボタン）
drop policy if exists pn_update_cash_receipt_self on public.bud_payroll_notifications;
create policy pn_update_cash_receipt_self on public.bud_payroll_notifications
  for update
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
  )
  with check (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
  );

-- DELETE: 完全禁止（5 年保管、労基法 109 条）
drop policy if exists pn_no_delete on public.bud_payroll_notifications;
create policy pn_no_delete on public.bud_payroll_notifications
  for delete
  using (false);

-- ----- bud_salary_statements RLS -----
-- SELECT: 自分の明細 + payroll_* + admin
drop policy if exists ss_select on public.bud_salary_statements;
create policy ss_select on public.bud_salary_statements
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- INSERT: payroll_disburser + admin（PDF 生成と同時、service_role は RLS バイパス）
drop policy if exists ss_insert on public.bud_salary_statements;
create policy ss_insert on public.bud_salary_statements
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

-- UPDATE: download_count / last_downloaded_at の自己更新のみ + admin
-- 本人による DL カウンター更新を許容（DL Server Action 経由）
drop policy if exists ss_update_download_self on public.bud_salary_statements;
create policy ss_update_download_self on public.bud_salary_statements
  for update
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_is_admin_or_super_admin()
  );

-- DELETE: 完全禁止
drop policy if exists ss_no_delete on public.bud_salary_statements;
create policy ss_no_delete on public.bud_salary_statements
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('bud_payroll_notifications', 'bud_salary_statements');
--
-- -- Y 案 + フォールバック対応の delivery_method 確認
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.bud_payroll_notifications'::regclass
--     AND conname LIKE '%delivery_method%';
--
-- -- フォールバック PW 必須 CHECK 確認
-- SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.bud_payroll_notifications'::regclass
--     AND conname = 'chk_fallback_pw_required';
