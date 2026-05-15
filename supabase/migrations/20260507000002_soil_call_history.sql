-- ============================================================
-- Garden Soil — コール履歴 `soil_call_history`（月次パーティション）
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-04-25-soil-02-call-history-schema.md（#02 コール履歴スキーマ確定版）
--   - docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md（パーティション戦略）
--   - docs/specs/2026-04-25-soil-07-delete-pattern.md（#07 削除パターン）
-- 作成: 2026-05-07（Batch 16 基盤実装、a-soil）
--
-- 目的:
--   335 万件級のコール履歴を月次 RANGE PARTITION で管理。Tree（架電 INSERT）/
--   Bloom（KPI SELECT）/ admin（パーティション保守）の三役で運用。
--
-- パーティション構成:
--   - 親: soil_call_history（PARTITION BY RANGE (call_datetime)）
--   - 子: soil_call_history_YYYYMM（月次、初期は 過去 12 ヶ月 + 当月 + 未来 3 ヶ月）
--   - default: soil_call_history_default（想定外の古い時刻 INSERT 捕捉、監視対象）
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod 適用は東海林さん別途承認後。
--
-- 冪等性:
--   `create table if not exists` で再実行可能。既存パーティションは上書きしない。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 親テーブル（パーティション）
-- ------------------------------------------------------------
create table if not exists public.soil_call_history (
  id                  bigserial,                          -- パーティション必須により合成 PK
  list_id             uuid not null,                       -- soil_lists.id（FK は #05 で再考、partition では制約限定）
  case_id             uuid,                                -- nullable: 架電時点で未案件化のことあり
  case_module         text,                                -- 'leaf_kanden' | 'leaf_hikari' | ...
  user_id             uuid not null,                       -- 架電者 = root_employees.user_id
  call_datetime       timestamptz not null,                -- 架電開始時刻（パーティションキー）
  call_ended_at       timestamptz,                         -- 架電終了時刻
  call_duration_sec   int,                                 -- end - start（DB トリガで自動計算）
  call_mode           text not null
                      check (call_mode in ('sprout', 'branch', 'leaf', 'bloom', 'fruit', 'noresponse', 'misdial')),
  result              text not null
                      check (result in ('connected', 'voicemail', 'busy', 'noanswer', 'rejected', 'wrongnumber')),
  outcome             text
                      check (outcome is null or outcome in
                        ('appointment_set', 'denied', 'callback_requested', 'sale_done')),
  callback_requested_at  timestamptz,
  callback_target_at     timestamptz,
  memo                text,
  voice_recording_url text,                                 -- Storage 上の通話録音 URL（任意）
  is_misdial          boolean not null default false,       -- 誤タップフラグ
  is_billable         boolean not null default true,        -- KPI 集計対象か（誤タップ等は false）
  created_at          timestamptz not null default now(),

  primary key (id, call_datetime)                           -- パーティションキー必須
) partition by range (call_datetime);

comment on table public.soil_call_history is
  'Garden-Soil コール履歴（335 万件級、月次パーティション）。call_datetime をパーティションキーに使用。';
comment on column public.soil_call_history.call_mode is
  'Garden 7 段階通話タイプ: sprout/branch/leaf/bloom/fruit + noresponse + misdial';
comment on column public.soil_call_history.is_billable is
  'KPI 集計対象フラグ。誤タップ・テスト架電等は false。';

-- ------------------------------------------------------------
-- 2. 月次パーティション（過去 12 ヶ月 + 当月 + 未来 3 ヶ月）
--    現在: 2026-05 → 過去 2025-05〜2026-04 + 当月 2026-05 + 未来 2026-06〜2026-08
-- ------------------------------------------------------------
do $$
declare
  m int;
  ym text;
  ym_next text;
  start_date text;
  end_date text;
begin
  -- 過去 12 ヶ月 + 当月 + 未来 3 ヶ月 = 16 ヶ月分（2025-05 〜 2026-08）
  for m in 0..15 loop
    -- 2025-05 始点で 16 ヶ月生成
    ym := to_char((make_date(2025, 5, 1) + (m || ' months')::interval)::date, 'YYYYMM');
    start_date := to_char((make_date(2025, 5, 1) + (m || ' months')::interval)::date, 'YYYY-MM-DD');
    end_date := to_char((make_date(2025, 5, 1) + ((m+1) || ' months')::interval)::date, 'YYYY-MM-DD');

    execute format(
      'create table if not exists public.soil_call_history_%s partition of public.soil_call_history
       for values from (%L) to (%L)',
      ym, start_date, end_date
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. アーカイブ default パーティション（想定外時刻の捕捉）
-- ------------------------------------------------------------
create table if not exists public.soil_call_history_default
  partition of public.soil_call_history default;

comment on table public.soil_call_history_default is
  '想定外の古い/未来時刻 INSERT 捕捉用 default パーティション。INSERT 時に B-07 監視通知を発火させる対象。';

-- ------------------------------------------------------------
-- 4. 通話時間自動計算トリガ
-- ------------------------------------------------------------
create or replace function public.soil_call_history_compute_duration()
returns trigger language plpgsql as $$
begin
  if new.call_ended_at is not null and new.call_datetime is not null then
    new.call_duration_sec := extract(epoch from (new.call_ended_at - new.call_datetime))::int;
  end if;
  return new;
end $$;

-- 親テーブルに trigger を貼ることで全パーティションに継承される
drop trigger if exists trg_soil_call_history_compute_duration on public.soil_call_history;
create trigger trg_soil_call_history_compute_duration
  before insert or update on public.soil_call_history
  for each row execute function public.soil_call_history_compute_duration();

-- ------------------------------------------------------------
-- 5. 基本インデックス（パーティション継承）
--    詳細性能チューニングは #05 で追加。
-- ------------------------------------------------------------
-- list_id（架電履歴の顧客逆引き）
create index if not exists idx_soil_call_history_list_id
  on public.soil_call_history (list_id, call_datetime desc);

-- user_id（個人の本日コール一覧用）
create index if not exists idx_soil_call_history_user_id
  on public.soil_call_history (user_id, call_datetime desc);

-- case_id（案件の全履歴用）
create index if not exists idx_soil_call_history_case_id
  on public.soil_call_history (case_module, case_id, call_datetime desc)
  where case_id is not null;

-- callback_target_at（コールバック予定一覧用）
create index if not exists idx_soil_call_history_callback_target
  on public.soil_call_history (callback_target_at)
  where callback_target_at is not null;

-- ------------------------------------------------------------
-- 6. 月次パーティション自動作成 helper（B-02 で cron 化、ここでは関数定義のみ）
-- ------------------------------------------------------------
create or replace function public.soil_call_history_ensure_partition(
  target_year int,
  target_month int
) returns void language plpgsql as $$
declare
  ym         text;
  start_date text;
  end_date   text;
begin
  ym         := to_char(make_date(target_year, target_month, 1), 'YYYYMM');
  start_date := to_char(make_date(target_year, target_month, 1), 'YYYY-MM-DD');
  end_date   := to_char((make_date(target_year, target_month, 1) + interval '1 month')::date, 'YYYY-MM-DD');

  execute format(
    'create table if not exists public.soil_call_history_%s partition of public.soil_call_history
     for values from (%L) to (%L)',
    ym, start_date, end_date
  );
end $$;

comment on function public.soil_call_history_ensure_partition(int, int) is
  '月次パーティションを idempotent に作成。B-02 で毎月 25 日 cron から呼出予定。';

-- ============================================================
-- end of migration
-- ============================================================
