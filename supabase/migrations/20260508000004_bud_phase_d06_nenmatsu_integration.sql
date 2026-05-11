-- ============================================================
-- Garden Bud — Phase D #06: 年末調整連携（Phase C 連動 + 1 月精算 + マイナンバー暗号化）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md
-- 作成: 2026-05-08（a-bud-002、Phase D 100% 完走に向けて）
--
-- 目的:
--   月次給与・賞与で控除した源泉徴収を、翌年 1 月給与で精算する設計。
--   Phase C（年末調整）と連動するための連携テーブル + マイナンバー暗号化基盤を整備。
--
-- スコープ（本 migration で対応）:
--   1. pgcrypto 拡張（マイナンバー pgp_sym_encrypt/decrypt 用）
--   2. bud_year_end_settlements（精算記録、fiscal_year × employee_id UNIQUE）
--   3. root_employees_pii（マイナンバー暗号化保管、super_admin only）
--   4. bud_pii_access_log（PII 復号アクセス監査、§6.4 反映）
--   5. PII helper 関数（bud_decrypt_my_number, bud_log_pii_access）
--   6. RLS（自分閲覧 / admin+ 全件 / super_admin の PII / payroll_approver 承認）
--
-- 含めない（Phase C 側で別途）:
--   - bud_nenmatsu_chousei（年末調整本体テーブル）→ Phase C-01
--   - bud_gensen_choshu_bo（月次源泉徴収簿）→ Phase C
--   - 年末調整 UI → Phase C-05
--   - 法定調書合計表 → Phase C-04
--   - D-02 / D-03 から bud_gensen_choshu_bo への自動書込 → Phase C 起票後に追補
--   - 1 月給与の settlement 反映 → D-10 給与計算統合の純関数で対応
--
-- 法令準拠:
--   - 所得税法 第 190 条: 年末調整実施
--   - 所得税法 第 226 条: 源泉徴収票交付（翌年 1/31 まで）
--   - マイナンバー法 第 27-29 条: 安全管理措置（暗号化・アクセス制限・監査）
--   - マイナンバー法 第 25 条: 利用目的の限定（年末調整 / 法定調書のみ）
--   - 個人情報保護法 第 23 条: 安全管理措置
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は Phase D 完走時にまとめて。
--
-- 冪等性: create * if not exists / drop policy if exists で何度でも実行可。
-- ============================================================

-- ------------------------------------------------------------
-- 0. pgcrypto 拡張（マイナンバー暗号化用）
-- ------------------------------------------------------------
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. bud_year_end_settlements（年末調整精算記録）
-- ------------------------------------------------------------
-- 1 名 1 年度 1 件（fiscal_year × employee_id UNIQUE）。
-- 12 月初〜中: Phase C で年税額計算 → settlement 作成（status='calculated'）
-- payroll_approver 承認 → status='approved'
-- 翌 1 月給与計算で settlement_amount 反映 → status='reflected'
create table if not exists public.bud_year_end_settlements (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null
    check (fiscal_year between 2020 and 2099),
  employee_id text not null references public.root_employees(employee_id),

  -- Phase C 連動（nenmatsu_chousei_id は Phase C 起票後に有効化、本 migration では nullable）
  -- spec §3.2 では NOT NULL だが Phase C 未起票のため、本 migration では nullable で先行起票。
  -- Phase C-01 起票時に NOT NULL 化 + FK 追加。
  nenmatsu_chousei_id uuid,                          -- Phase C-01 後に references public.bud_nenmatsu_chousei(id)

  -- 既徴収累計（D-02 / D-03 から、Phase C-bud_gensen_choshu_bo 経由で集計）
  total_withheld_to_november numeric(10, 0) not null
    check (total_withheld_to_november >= 0),         -- 11 月までの累計
  december_salary_withheld numeric(10, 0) not null
    check (december_salary_withheld >= 0),           -- 12 月給与の予定徴収額
  bonus_withheld_total numeric(10, 0) not null
    check (bonus_withheld_total >= 0),               -- 賞与累計

  -- 年税額（Phase C 計算結果）
  annual_tax_amount numeric(10, 0) not null
    check (annual_tax_amount >= 0),

  -- 精算
  settlement_amount numeric(10, 0) not null,         -- + 追徴 / - 還付（マイナス可）
  settlement_type text not null
    check (settlement_type in ('refund', 'additional', 'zero')),
  settlement_period_id uuid not null
    references public.bud_payroll_periods(id),       -- 翌 1 月給与の期間 ID

  -- 退職者除外フラグ（spec §11.5: 1 月精算統一、12 月末退職者は最終給与で即時精算）
  excluded_reason text
    check (excluded_reason is null or excluded_reason in (
      'retired_in_year',
      'mid_year_settlement',
      'manual_exclusion'
    )),

  -- 状態
  status text not null default 'calculated'
    check (status in ('calculated', 'approved', 'reflected', 'cancelled')),

  -- メタ
  calculated_at timestamptz not null default now(),
  calculated_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  reflected_at timestamptz,                          -- 1 月給与計算に反映済の日時
  cancelled_at timestamptz,
  cancelled_by text references public.root_employees(employee_id),

  notes text,
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  -- 1 名 1 年度 1 件（excluded フラグ含む）
  constraint uq_yes_per_employee_year
    unique (fiscal_year, employee_id),

  -- 自己承認禁止（V6 自起票承認禁止、§Kintone 解析 #18 反映）
  constraint chk_yes_no_self_approval
    check (approved_by is null or approved_by <> calculated_by)
);

create index if not exists idx_yes_period
  on public.bud_year_end_settlements(settlement_period_id);
create index if not exists idx_yes_employee_year
  on public.bud_year_end_settlements(employee_id, fiscal_year);
create index if not exists idx_yes_status
  on public.bud_year_end_settlements(status)
  where deleted_at is null;

comment on table public.bud_year_end_settlements is
  'Phase D-06 年末調整精算記録（1 月給与精算ベース、2026-04-26 改訂）。fiscal_year × employee_id UNIQUE。';

comment on column public.bud_year_end_settlements.settlement_amount is
  '+ 追徴 / - 還付。1 月給与に加算（refund はマイナス → 給与プラス、additional はプラス → 給与マイナス）。';

-- ------------------------------------------------------------
-- 2. root_employees_pii（マイナンバー等の機微情報、暗号化保管）
-- ------------------------------------------------------------
-- spec §6.1 反映。super_admin のみアクセス可、復号は Server Action 経由のみ。
-- 暗号化キー: Vercel 環境変数 PII_ENCRYPTION_KEY（32 バイト base64）。
-- 鍵 ID: encryption_key_id で世代管理（年 1 回ローテーション想定）。
create table if not exists public.root_employees_pii (
  employee_id text primary key references public.root_employees(employee_id),

  -- マイナンバー（pgp_sym_encrypt で AES-256 相当の暗号化）
  my_number_encrypted bytea,                         -- NULL 許容（未登録）
  encryption_key_id text,                            -- 鍵世代 ID（'2026-default' 等）

  -- 扶養家族マイナンバー（JSONB 内の各 number_encrypted は別途 helper で復号）
  -- 例: [{"name": "山田太郎", "relation": "spouse", "encrypted": "\\x..."}]
  -- 本 spec では構造のみ定義、Phase C-05（年末調整 UI）で書込フロー実装。
  dependents_pii_encrypted jsonb,

  -- メタ
  encrypted_at timestamptz,
  encrypted_by text references public.root_employees(employee_id),

  -- アクセス監査（spec §6.4）
  last_accessed_at timestamptz,
  access_count int not null default 0
    check (access_count >= 0),

  -- 退職時 7 年経過で物理削除（spec 判 3、Cross Ops #05 連動）
  retention_until date,                              -- 退職日 + 7 年

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_root_employees_pii_retention
  on public.root_employees_pii(retention_until)
  where retention_until is not null;

comment on table public.root_employees_pii is
  'Phase D-06 マイナンバー暗号化保管（super_admin only）。pgp_sym_encrypt で AES-256 相当。';

comment on column public.root_employees_pii.dependents_pii_encrypted is
  '扶養家族マイナンバーの JSONB 配列。各 entry に encrypted フィールド（bytea を base64 化して保管）。';

-- ------------------------------------------------------------
-- 3. bud_pii_access_log（PII 復号アクセス監査、spec §6.4）
-- ------------------------------------------------------------
-- マイナンバー復号のたびに INSERT。改ざん検知のため UPDATE / DELETE 不可。
create table if not exists public.bud_pii_access_log (
  id uuid primary key default gen_random_uuid(),
  accessed_by text not null references public.root_employees(employee_id),
  target_employee_id text not null references public.root_employees(employee_id),

  -- アクセス目的（マイナンバー法 第 25 条: 利用目的の限定）
  purpose text not null
    check (purpose in (
      'year_end_settlement',
      'gensen_choshu_hyo',
      'hotei_chosho',
      'shiharai_chosho',
      'audit_review',
      'admin_correction'
    )),

  -- 関連リソース（オプション、例: settlement_id, fiscal_year）
  context jsonb,

  accessed_at timestamptz not null default now(),
  client_ip inet,
  user_agent text
);

create index if not exists idx_pii_log_target
  on public.bud_pii_access_log(target_employee_id, accessed_at desc);
create index if not exists idx_pii_log_accessor
  on public.bud_pii_access_log(accessed_by, accessed_at desc);

comment on table public.bud_pii_access_log is
  'Phase D-06 PII 復号アクセス監査ログ（マイナンバー法 §27-29 準拠）。INSERT only。';

-- ------------------------------------------------------------
-- 4. PII helper 関数
-- ------------------------------------------------------------

-- 4.1 マイナンバー暗号化（admin / super_admin が登録時に呼ぶ）
-- key 引数は呼び出し元（Server Action）が PII_ENCRYPTION_KEY を渡す。
create or replace function public.bud_encrypt_my_number(
  p_employee_id text,
  p_my_number text,
  p_key text,
  p_key_id text default '2026-default'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- super_admin のみ実行可能
  if not public.bud_is_super_admin() then
    raise exception 'FORBIDDEN: only super_admin can encrypt my_number';
  end if;

  -- バリデーション: マイナンバーは 12 桁数字
  if p_my_number !~ '^[0-9]{12}$' then
    raise exception 'INVALID: my_number must be 12 digits';
  end if;

  insert into public.root_employees_pii (
    employee_id,
    my_number_encrypted,
    encryption_key_id,
    encrypted_at,
    encrypted_by,
    updated_at
  ) values (
    p_employee_id,
    pgp_sym_encrypt(p_my_number, p_key, 'cipher-algo=aes256'),
    p_key_id,
    now(),
    (select id from public.root_employees where user_id = auth.uid()),
    now()
  )
  on conflict (employee_id) do update set
    my_number_encrypted = excluded.my_number_encrypted,
    encryption_key_id = excluded.encryption_key_id,
    encrypted_at = excluded.encrypted_at,
    encrypted_by = excluded.encrypted_by,
    updated_at = now();
end;
$$;

comment on function public.bud_encrypt_my_number(text, text, text, text) is
  'マイナンバー暗号化保管（super_admin only）。AES-256 等価の pgp_sym_encrypt 利用。';

-- 4.2 マイナンバー復号 + 監査ログ INSERT（年末調整 / 法定調書のみ）
create or replace function public.bud_decrypt_my_number(
  p_target_employee_id text,
  p_key text,
  p_purpose text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encrypted bytea;
  v_decrypted text;
  v_accessor_id uuid;
begin
  -- super_admin のみ復号可能
  if not public.bud_is_super_admin() then
    raise exception 'FORBIDDEN: only super_admin can decrypt my_number';
  end if;

  -- 利用目的のバリデーション（マイナンバー法 §25）
  if p_purpose not in (
    'year_end_settlement',
    'gensen_choshu_hyo',
    'hotei_chosho',
    'shiharai_chosho',
    'audit_review',
    'admin_correction'
  ) then
    raise exception 'INVALID_PURPOSE: %', p_purpose;
  end if;

  select my_number_encrypted into v_encrypted
  from public.root_employees_pii
  where employee_id = p_target_employee_id;

  if v_encrypted is null then
    return null;
  end if;

  v_decrypted := pgp_sym_decrypt(v_encrypted, p_key);

  -- 監査ログ書込
  v_accessor_id := (select id from public.root_employees where user_id = auth.uid());
  insert into public.bud_pii_access_log (
    accessed_by,
    target_employee_id,
    purpose,
    context
  ) values (
    v_accessor_id,
    p_target_employee_id,
    p_purpose,
    jsonb_build_object('triggered_at', now())
  );

  -- アクセスカウンタ更新
  update public.root_employees_pii set
    last_accessed_at = now(),
    access_count = access_count + 1
  where employee_id = p_target_employee_id;

  return v_decrypted;
end;
$$;

comment on function public.bud_decrypt_my_number(text, text, text) is
  'マイナンバー復号 + 監査ログ INSERT。super_admin only、利用目的限定。';

-- ------------------------------------------------------------
-- 5. RLS: bud_year_end_settlements
-- ------------------------------------------------------------
alter table public.bud_year_end_settlements enable row level security;

-- 5.1 SELECT: 自分の精算は閲覧可
drop policy if exists yes_select_own on public.bud_year_end_settlements;
create policy yes_select_own on public.bud_year_end_settlements
  for select
  using (
    deleted_at is null
    and employee_id = (
      select id from public.root_employees
      where user_id = auth.uid()
        and deleted_at is null
    )
  );

-- 5.2 SELECT: payroll_calculator / payroll_approver / payroll_auditor は全件
drop policy if exists yes_select_payroll_role on public.bud_year_end_settlements;
create policy yes_select_payroll_role on public.bud_year_end_settlements
  for select
  using (
    deleted_at is null
    and public.bud_has_payroll_role(array[
      'payroll_calculator',
      'payroll_approver',
      'payroll_auditor'
    ])
  );

-- 5.3 SELECT: admin / super_admin は全件
drop policy if exists yes_select_admin on public.bud_year_end_settlements;
create policy yes_select_admin on public.bud_year_end_settlements
  for select
  using (
    deleted_at is null
    and public.bud_is_admin_or_super_admin()
  );

-- 5.4 INSERT: payroll_calculator + admin
drop policy if exists yes_insert_calculator on public.bud_year_end_settlements;
create policy yes_insert_calculator on public.bud_year_end_settlements
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

-- 5.5 UPDATE: payroll_approver（承認のみ）+ admin
-- 自起票承認禁止は CHECK 制約 chk_yes_no_self_approval で強制。
drop policy if exists yes_update_approver on public.bud_year_end_settlements;
create policy yes_update_approver on public.bud_year_end_settlements
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  );

-- 5.6 DELETE: 物理削除禁止（deleted_at で論理削除のみ）
drop policy if exists yes_no_delete on public.bud_year_end_settlements;
create policy yes_no_delete on public.bud_year_end_settlements
  for delete
  using (false);

-- ------------------------------------------------------------
-- 6. RLS: root_employees_pii
-- ------------------------------------------------------------
alter table public.root_employees_pii enable row level security;

-- 6.1 SELECT: super_admin のみ（暗号化された値も含めて閲覧可は super_admin のみ）
drop policy if exists pii_select_super_admin on public.root_employees_pii;
create policy pii_select_super_admin on public.root_employees_pii
  for select
  using (public.bud_is_super_admin());

-- 6.2 INSERT / UPDATE: super_admin のみ
drop policy if exists pii_insert_super_admin on public.root_employees_pii;
create policy pii_insert_super_admin on public.root_employees_pii
  for insert
  with check (public.bud_is_super_admin());

drop policy if exists pii_update_super_admin on public.root_employees_pii;
create policy pii_update_super_admin on public.root_employees_pii
  for update
  using (public.bud_is_super_admin())
  with check (public.bud_is_super_admin());

-- 6.3 DELETE: 物理削除禁止（retention_until 経過時は別 Cron で対応、Cross Ops #05）
drop policy if exists pii_no_delete on public.root_employees_pii;
create policy pii_no_delete on public.root_employees_pii
  for delete
  using (false);

-- ------------------------------------------------------------
-- 7. RLS: bud_pii_access_log
-- ------------------------------------------------------------
alter table public.bud_pii_access_log enable row level security;

-- 7.1 SELECT: super_admin + admin（監査用、改ざん不可）
drop policy if exists pii_log_select_admin on public.bud_pii_access_log;
create policy pii_log_select_admin on public.bud_pii_access_log
  for select
  using (public.bud_is_admin_or_super_admin());

-- 7.2 INSERT: helper 関数経由のみ（service_role / SECURITY DEFINER）
-- Server Action から直接 INSERT も super_admin のみ許可。
drop policy if exists pii_log_insert_super_admin on public.bud_pii_access_log;
create policy pii_log_insert_super_admin on public.bud_pii_access_log
  for insert
  with check (public.bud_is_super_admin());

-- 7.3 UPDATE / DELETE: 改ざん検知のため不可
drop policy if exists pii_log_no_update on public.bud_pii_access_log;
create policy pii_log_no_update on public.bud_pii_access_log
  for update
  using (false);

drop policy if exists pii_log_no_delete on public.bud_pii_access_log;
create policy pii_log_no_delete on public.bud_pii_access_log
  for delete
  using (false);

-- ============================================================
-- end of migration 20260508000004
-- ============================================================
