-- ============================================================
-- Garden Bud (暫定 Forest 配置) — 仕訳帳 B-min データモデル
-- ============================================================
-- 対応 spec: docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md
-- 対応 dispatch: main- No. 76 (a-main-013, 2026-05-07)
-- 対応 handoff: docs/handoff-forest-202605052235.md §確定事項サマリ 1〜10
-- 作成: 2026-05-07 a-forest-002 (forest-8 進捗中間報告で commit 確定)
--
-- 背景:
--   仕訳帳機能を Garden 化する Phase 1 (B-min) のデータモデル。
--   旧 Python (G:\マイドライブ\..._東海林美琴\001_仕訳帳\*.py) のロジックを
--   TypeScript + Supabase に移植するための土台テーブル群を作成する。
--
-- 配置原則:
--   - テーブル名は "bud_*" プレフィックス（将来の Bud モジュール移行時にテーブル名を変えない）
--   - 暫定的に Forest 配下 (src/app/forest/shiwakechou/) で UI / API を実装
--   - 5/17 以降に Bud モジュール (src/app/bud/shiwakechou/) へ機械的移植
--
-- B-min スコープ (このマイグレーションでカバー):
--   1. bud_corporations         法人マスタ (6 法人)
--   2. bud_bank_accounts        口座マスタ (12 口座)
--   3. bud_master_rules         共通仕訳マスタ (旧 1_共通マスタ_v12.xlsx)
--   4. bud_transactions         取引明細 (中核テーブル, status: pending/ok/excluded)
--   5. bud_yayoi_exports        弥生 CSV エクスポート履歴
--   6. bud_files                アップロードされた元ファイル (Storage path)
--   7. bud_audit_log            操作監査ログ (RLS 必須)
--
-- スコープ外 (Phase 2 以降):
--   - bud_intercompany_rules    法人間取引マスタ
--   - bud_credit_card_*         CC 明細
--   - bud_money_forward_*       MF 仕訳帳
--   - bud_cash_receipts_*       現金領収書
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は B-min 完走 + α/β テスト後にまとめて。
--
-- 冪等性: create table if not exists / create index if not exists / drop trigger if exists
-- で何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- 共通: 取引ステータス enum (text 制約)
-- ------------------------------------------------------------
-- bud_transactions.status:
--   'pending'           B-min 仕訳化対象 (2026/04/01 〜 2026/04/30)
--   'ok'                弥生 CSV import 済 (2025/04/01 〜 2026/03/31)
--   'excluded'          B-min 対象外 (2024/06 〜 2025/03/31, または PayPay ヒュアラン CSV 無し)
--   'intercompany'      法人間取引 (Phase 2 で利用)
--   'internal_transfer' 自社内口座移し替え (Phase 2 で利用)

-- ============================================================
-- 1. bud_corporations  法人マスタ
-- ============================================================
create table if not exists public.bud_corporations (
  id          text         primary key,        -- 'hyuaran' / 'centerrise' / 'linksupport' / 'arata' / 'taiyou' / 'ichi'
  code        text         not null unique,    -- 旧 Python の '01_株式会社ヒュアラン' 形式 (移行時の対照用)
  name_full   text         not null,           -- '株式会社ヒュアラン'
  name_short  text         not null,           -- 'ヒュアラン'
  sort_order  integer      not null default 0, -- 表示順
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

comment on table public.bud_corporations is
  '仕訳帳機能の法人マスタ (6 法人)。Forest companies と同 ID 体系を維持。';

create index if not exists idx_bud_corporations_sort
  on public.bud_corporations (sort_order, id);

-- ============================================================
-- 2. bud_bank_accounts  口座マスタ
-- ============================================================
-- 12 口座 (handoff §2 銀行 × 法人 12 口座マッピング):
--   ヒュアラン:    みずほ + PayPay + 楽天 + 京都 = 4
--   センターライズ: みずほ + PayPay = 2
--   リンクサポート: みずほ + 楽天 = 2
--   ARATA:         みずほ + 楽天 = 2
--   たいよう:      楽天 = 1
--   壱:            楽天 = 1
create table if not exists public.bud_bank_accounts (
  id                 uuid         primary key default gen_random_uuid(),
  corp_id            text         not null references public.bud_corporations(id) on delete restrict,
  bank_name          text         not null,            -- 'みずほ銀行' / 'PayPay銀行' / '楽天銀行' / '京都銀行'
  bank_kind          text         not null,            -- 'mizuho' / 'paypay' / 'rakuten' / 'kyoto' (parser 切替用)
  bank_code          text         not null,            -- 4桁金融機関コード
  branch_code        text,                              -- 3桁支店コード
  branch_name        text,                              -- 支店名
  account_type       text         not null default '普通預金', -- '普通預金' / '当座預金'
  account_number     text         not null,            -- 口座番号
  sub_account_label  text         not null,            -- 弥生用補助科目 (例: '楽天銀行(株式会社ヒュアラン)')
  is_active          boolean      not null default true,
  -- 4/30 期初残高 (B-min 残高検算用, 手入力分はここに入る)
  manual_balance_20260430 bigint,                      -- みずほ 4 値 + PayPay ヒュアラン (5 値), CSV 自動取得分は null
  has_csv            boolean      not null default true, -- false = PayPay ヒュアラン (CSV 無しケース)
  notes              text,                              -- 'システム障害で CSV 出力不可' 等の特記事項
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  -- 同一法人内で銀行 × 口座番号は一意
  constraint uq_bud_bank_accounts_corp_bank_acct
    unique (corp_id, bank_code, branch_code, account_number)
);

comment on table public.bud_bank_accounts is
  '仕訳帳機能の口座マスタ (12 口座)。bank_kind は parser 切替に使用。';
comment on column public.bud_bank_accounts.manual_balance_20260430 is
  '4/30 残高の手入力値 (円)。みずほ 4 値 + PayPay ヒュアラン 1 値 = 5 値が入る。CSV 自動取得分は null。';
comment on column public.bud_bank_accounts.has_csv is
  'CSV / API ファイルが入手可能か。false = PayPay ヒュアラン (システム障害で出力不可)。false の口座は B-min 仕訳化対象外。';

create index if not exists idx_bud_bank_accounts_corp
  on public.bud_bank_accounts (corp_id, is_active);
create index if not exists idx_bud_bank_accounts_bank_kind
  on public.bud_bank_accounts (bank_kind);

-- ============================================================
-- 3. bud_master_rules  共通仕訳マスタ (旧 1_共通マスタ_v12.xlsx 相当)
-- ============================================================
create table if not exists public.bud_master_rules (
  id              uuid         primary key default gen_random_uuid(),
  pattern         text         not null,           -- 摘要の判定キーワード
  pattern_kind    text         not null            -- 'prefix' / 'contains' / 'regex' / 'exact'
                  check (pattern_kind in ('prefix','contains','regex','exact')),
  direction       text         not null            -- 'withdrawal'(出金) / 'deposit'(入金) / 'both'
                  check (direction in ('withdrawal','deposit','both')),
  category        text,                            -- 区分 (通信費 / 交際費 / ...)
  debit_account   text         not null,           -- 借方科目
  credit_account  text         not null,           -- 貸方科目
  tax_class       text         not null,           -- 税区分 (例: '課税仕入 10%')
  is_intercompany boolean      not null default false,
  -- 競合解消用 (摘要が複数パターンにマッチした場合の優先順位, 大きいほど優先)
  priority        integer      not null default 100,
  is_active       boolean      not null default true,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),

  -- 同一 (pattern, pattern_kind, direction) は重複登録不可 (UNIQUE 制約)
  constraint uq_bud_master_rules_pattern
    unique (pattern, pattern_kind, direction)
);

comment on table public.bud_master_rules is
  '共通仕訳マスタ。摘要から借方/貸方/税区分を自動判定する判定ルール。';
comment on column public.bud_master_rules.priority is
  '判定優先順位 (大きいほど優先)。摘要が複数パターンにマッチした場合の競合解消用。';

create index if not exists idx_bud_master_rules_active
  on public.bud_master_rules (is_active, priority desc);
create index if not exists idx_bud_master_rules_lookup
  on public.bud_master_rules (pattern_kind, direction)
  where is_active = true;

-- ============================================================
-- 4. bud_files  アップロードされた元ファイル
-- ============================================================
-- bud_transactions.source_file_id から参照されるため、transactions より先に作成。
create table if not exists public.bud_files (
  id                 uuid         primary key default gen_random_uuid(),
  corp_id            text         not null references public.bud_corporations(id) on delete restrict,
  bank_account_id    uuid         references public.bud_bank_accounts(id) on delete set null,
  source_kind        text         not null            -- 'bk' / 'mf' / 'cc' / 'cash'
                     check (source_kind in ('bk','mf','cc','cash')),
  bank_kind          text,                            -- 'rakuten' / 'mizuho' / 'paypay' / 'kyoto' (BK のみ)
  original_filename  text         not null,
  storage_path       text         not null,           -- Supabase Storage パス
  file_size_bytes    bigint,
  -- ファイル内容のハッシュ (二重 import 検出用)
  content_sha256     text,
  uploaded_by        uuid,
  uploaded_at        timestamptz  not null default now(),
  processed_at       timestamptz,
  processing_status  text         not null default 'uploaded' -- 'uploaded' / 'parsing' / 'parsed' / 'error'
                     check (processing_status in ('uploaded','parsing','parsed','error')),
  error_message      text
);

comment on table public.bud_files is
  'アップロードされた銀行 CSV / .api ファイルの元ファイル管理。Supabase Storage に実体保管。';
comment on column public.bud_files.content_sha256 is
  '元ファイルの SHA-256 ハッシュ。同じファイルの二重 import 検出に使用。';

create index if not exists idx_bud_files_corp_bank
  on public.bud_files (corp_id, bank_account_id, uploaded_at desc);
-- 同一 (corp_id, bank_account_id, content_sha256) は二重 import 不可
create unique index if not exists uq_bud_files_dedup
  on public.bud_files (corp_id, bank_account_id, content_sha256)
  where content_sha256 is not null;

-- ============================================================
-- 5. bud_transactions  取引明細 (中核テーブル)
-- ============================================================
create table if not exists public.bud_transactions (
  id                 uuid         primary key default gen_random_uuid(),
  corp_id            text         not null references public.bud_corporations(id) on delete restrict,
  bank_account_id    uuid         references public.bud_bank_accounts(id) on delete set null,
  source_file_id     uuid         references public.bud_files(id) on delete set null,
  source_kind        text         not null            -- 'bk' / 'mf' / 'cc' / 'cash'
                     check (source_kind in ('bk','mf','cc','cash')),
  -- 取引情報
  transaction_date   date         not null,
  amount             bigint       not null,           -- 円単位 (符号なし、flow で出入金を表現)
  flow               text         not null            -- 'withdrawal'(出金) / 'deposit'(入金)
                     check (flow in ('withdrawal','deposit')),
  description        text         not null,           -- 摘要 (原文)
  balance_after      bigint,                          -- 取引後残高 (CSV から取得できる場合)
  -- ステータス
  status             text         not null default 'pending'
                     check (status in ('pending','ok','excluded','intercompany','internal_transfer')),
  -- 仕訳情報 (status='ok' or 'pending' で値を持つ)
  applied_rule_id    uuid         references public.bud_master_rules(id) on delete set null,
  debit_account      text,
  credit_account     text,
  tax_class          text,
  memo               text,
  -- 確認情報
  confirmed_by       uuid,
  confirmed_at       timestamptz,
  -- メタ
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  -- 同一口座の同一日 + 同一金額 + 同一摘要 + 同一フロー は重複登録不可 (CSV 二重 import 防御)
  constraint uq_bud_transactions_dedup
    unique (bank_account_id, transaction_date, amount, flow, description)
);

comment on table public.bud_transactions is
  '取引明細 (BK/MF/CC/Cash 統合)。仕訳化前/後を status で管理。';
comment on column public.bud_transactions.status is
  E'\'pending\' = B-min 仕訳化対象 (2026/04/01-04/30) / \'ok\' = 弥生 import 済 (2025/04-2026/03) / \'excluded\' = B-min 対象外 / \'intercompany\' = 法人間 / \'internal_transfer\' = 自社内移し替え';
comment on column public.bud_transactions.amount is
  '取引金額 (円, 符号なし)。flow が withdrawal なら出金、deposit なら入金。';
comment on column public.bud_transactions.balance_after is
  'CSV / API から取得した取引後残高。残高検算 / opening_balance 逆算で使用。';

create index if not exists idx_bud_transactions_corp_date
  on public.bud_transactions (corp_id, transaction_date);
create index if not exists idx_bud_transactions_account_date
  on public.bud_transactions (bank_account_id, transaction_date);
create index if not exists idx_bud_transactions_status_pending
  on public.bud_transactions (corp_id, transaction_date)
  where status = 'pending';
create index if not exists idx_bud_transactions_source_file
  on public.bud_transactions (source_file_id);

-- ============================================================
-- 6. bud_yayoi_exports  弥生 CSV エクスポート履歴
-- ============================================================
create table if not exists public.bud_yayoi_exports (
  id                  uuid         primary key default gen_random_uuid(),
  corp_id             text         not null references public.bud_corporations(id) on delete restrict,
  bank_account_id     uuid         references public.bud_bank_accounts(id) on delete set null,
  source_kind         text         not null
                      check (source_kind in ('bk','mf','cc','cash')),
  period_from         date         not null,
  period_to           date         not null,
  transaction_count   integer      not null,
  storage_path        text         not null,            -- Supabase Storage 上の弥生 CSV パス
  file_size_bytes     bigint,
  exported_by         uuid,
  exported_at         timestamptz  not null default now(),
  marked_imported_at  timestamptz                       -- 弥生取込済みマーク (手動)
);

comment on table public.bud_yayoi_exports is
  '弥生 CSV エクスポート履歴。再ダウンロード可能。手動で「弥生取込済み」マーク可能。';

create index if not exists idx_bud_yayoi_exports_corp
  on public.bud_yayoi_exports (corp_id, exported_at desc);

-- ============================================================
-- 7. bud_audit_log  操作監査ログ
-- ============================================================
create table if not exists public.bud_audit_log (
  id           bigserial    primary key,
  user_id      uuid,
  action       text         not null,    -- 'upload_bk' / 'parse_bk' / 'resolve_tx' / 'export_yayoi' / 'master_create' / ...
  target_kind  text,                     -- 'transaction' / 'master_rule' / 'file' / ...
  target_id    text,                     -- 対象レコード ID (uuid を text 化)
  meta         jsonb        not null default '{}'::jsonb,
  created_at   timestamptz  not null default now()
);

comment on table public.bud_audit_log is
  '仕訳帳機能の操作監査ログ。誰が何をしたかの履歴を全保管 (税法 7 年保存対応)。';

create index if not exists idx_bud_audit_log_user_created
  on public.bud_audit_log (user_id, created_at desc);
create index if not exists idx_bud_audit_log_action_created
  on public.bud_audit_log (action, created_at desc);
create index if not exists idx_bud_audit_log_target
  on public.bud_audit_log (target_kind, target_id);

-- ============================================================
-- 8. updated_at 自動更新 trigger (bud 用)
-- ============================================================
create or replace function public.bud_update_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.bud_update_updated_at() is
  'Bud テーブル用 updated_at 自動更新 trigger 関数。Forest 用 forest_update_updated_at と同等。';

-- 各テーブルに before update trigger を設定
drop trigger if exists trg_bud_corporations_updated_at on public.bud_corporations;
create trigger trg_bud_corporations_updated_at
  before update on public.bud_corporations
  for each row execute function public.bud_update_updated_at();

drop trigger if exists trg_bud_bank_accounts_updated_at on public.bud_bank_accounts;
create trigger trg_bud_bank_accounts_updated_at
  before update on public.bud_bank_accounts
  for each row execute function public.bud_update_updated_at();

drop trigger if exists trg_bud_master_rules_updated_at on public.bud_master_rules;
create trigger trg_bud_master_rules_updated_at
  before update on public.bud_master_rules
  for each row execute function public.bud_update_updated_at();

drop trigger if exists trg_bud_transactions_updated_at on public.bud_transactions;
create trigger trg_bud_transactions_updated_at
  before update on public.bud_transactions
  for each row execute function public.bud_update_updated_at();

-- ============================================================
-- 9. RLS (B-min: forest_users.role IN ('admin','executive') のみ)
-- ============================================================
-- B-min では一旦 admin + executive のみアクセス。Phase 2 以降で経理担当 editor ロール追加。
-- 'executive' は Q4 後道さん向け balance-overview 閲覧用 (read-only 想定だが B-min では admin と同等)。

alter table public.bud_corporations         enable row level security;
alter table public.bud_bank_accounts        enable row level security;
alter table public.bud_master_rules         enable row level security;
alter table public.bud_files                enable row level security;
alter table public.bud_transactions         enable row level security;
alter table public.bud_yayoi_exports        enable row level security;
alter table public.bud_audit_log            enable row level security;

-- ヘルパー関数: 仕訳帳アクセス可能ロールか
create or replace function public.bud_shiwakechou_can_access()
  returns boolean
  language sql
  stable
  security definer
as $$
  select exists (
    select 1
    from public.forest_users
    where forest_users.user_id = auth.uid()
      and forest_users.role in ('admin','executive')
  );
$$;

comment on function public.bud_shiwakechou_can_access() is
  'B-min: 仕訳帳機能アクセス可能か (forest_users.role IN admin/executive)。Bud 移行時に bud_users 参照に切替予定。';

-- 各テーブルの RLS policy (admin + executive は read/write 可能)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'bud_corporations',
    'bud_bank_accounts',
    'bud_master_rules',
    'bud_files',
    'bud_transactions',
    'bud_yayoi_exports',
    'bud_audit_log'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      tbl || '_admin_all', tbl
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.bud_shiwakechou_can_access()) with check (public.bud_shiwakechou_can_access())',
      tbl || '_admin_all', tbl
    );
  end loop;
end$$;

-- ============================================================
-- 10. 確認クエリ (手動実行用)
-- ============================================================
-- -- テーブル一覧確認
-- SELECT table_name
--   FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'bud_%'
--   ORDER BY table_name;
--
-- -- UNIQUE 制約確認
-- SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS def
--   FROM pg_constraint
--   WHERE conrelid::regclass::text LIKE 'public.bud_%'
--     AND contype = 'u'
--   ORDER BY conrelid::regclass::text, conname;
--
-- -- index 確認
-- SELECT tablename, indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename LIKE 'bud_%'
--   ORDER BY tablename, indexname;
--
-- -- RLS 確認
-- SELECT schemaname, tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public' AND tablename LIKE 'bud_%'
--   ORDER BY tablename;
--
-- -- trigger 確認
-- SELECT trigger_name, event_object_table
--   FROM information_schema.triggers
--   WHERE trigger_name LIKE 'trg_bud_%'
--   ORDER BY trigger_name;
