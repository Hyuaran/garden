-- ============================================================
-- Garden Bud — 法人マスタ + 口座マスタ 初期データ投入
-- ============================================================
-- 対応 spec: docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md
-- 対応 dispatch: main- No. 76 (a-main-013, 2026-05-07)
-- 対応 handoff: docs/handoff-forest-202605052235.md §2 (12 口座マッピング)
-- 元データ: G:\マイドライブ\..._東海林美琴\001_仕訳帳\3_口座設定.py BANK_ACCOUNTS
--
-- 投入データ:
--   - bud_corporations:  6 法人
--   - bud_bank_accounts: 12 口座 (うち 5 口座は 4/30 残高手入力, 1 口座は has_csv=false)
--
-- 4/30 手入力残高の根拠:
--   _chat_workspace/garden-forest-shiwakechou/manual-balance-20260430.md
--   - みずほ ARATA       ¥17,493,036  (通帳確認)
--   - みずほ センターライズ ¥8,641,120   (通帳確認)
--   - みずほ ヒュアラン    ¥17,363,036  (通帳確認)
--   - みずほ リンクサポート ¥1,293,092   (通帳確認)
--   - PayPay ヒュアラン    ¥158,041    (システム障害で CSV 無し, 残高画面のみ)
--   合計手入力: ¥45,948,325
--
-- 冪等性: on conflict do nothing で何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_corporations  6 法人
-- ------------------------------------------------------------
insert into public.bud_corporations (id, code, name_full, name_short, sort_order, is_active) values
  ('hyuaran',     '01_株式会社ヒュアラン',     '株式会社ヒュアラン',    'ヒュアラン',    1, true),
  ('centerrise',  '02_株式会社センターライズ', '株式会社センターライズ', 'センターライズ', 2, true),
  ('linksupport', '03_株式会社リンクサポート', '株式会社リンクサポート', 'リンクサポート', 3, true),
  ('arata',       '04_株式会社ARATA',          '株式会社ARATA',         'ARATA',         4, true),
  ('taiyou',      '05_株式会社たいよう',       '株式会社たいよう',      'たいよう',      5, true),
  ('ichi',        '06_株式会社壱',             '株式会社壱',            '壱',            6, true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. bud_bank_accounts  12 口座
-- ------------------------------------------------------------
-- ヒュアラン (4 口座: みずほ + PayPay + 楽天 + 京都)
insert into public.bud_bank_accounts
  (corp_id, bank_name, bank_kind, bank_code, branch_code, branch_name, account_type, account_number, sub_account_label, manual_balance_20260430, has_csv, notes, is_active)
values
  ('hyuaran', 'みずほ銀行',  'mizuho',  '0001', '563', '四ツ橋支店',      '普通預金', '1252992',
   'みずほ銀行_四ツ橋支店(普通預金)1252992_ヒュアラン',
   17363036, true, '通帳確認 (4/30)', true),

  ('hyuaran', 'PayPay銀行',  'paypay',  '0033', '005', 'ビジネス営業部',  '普通預金', '2397629',
   'PayPay銀行_ビジネス営業部(普通預金)2397629_ヒュアラン',
   158041,   false, 'システム障害で CSV 出力不可 (4/30 残高画面のみ取得)。B-min 仕訳化対象外。', true),

  ('hyuaran', '楽天銀行',    'rakuten', '0036', '251', '第一営業支店',    '普通預金', '7853952',
   '楽天銀行_第一営業支店(普通預金)7853952_ヒュアラン',
   null, true, null, true),

  ('hyuaran', '京都銀行',    'kyoto',   '0158', '514', '難波支店',        '普通預金', '0029830',
   '京都銀行_難波支店(普通預金)0029830_ヒュアラン',
   null, true, '期間制限 2026/03/09 〜 2026/05/07 (2 ヶ月, システム制限)', true)
on conflict (corp_id, bank_code, branch_code, account_number) do nothing;

-- センターライズ (2 口座: みずほ + PayPay)
insert into public.bud_bank_accounts
  (corp_id, bank_name, bank_kind, bank_code, branch_code, branch_name, account_type, account_number, sub_account_label, manual_balance_20260430, has_csv, notes, is_active)
values
  ('centerrise', 'みずほ銀行', 'mizuho', '0001', '563', '四ツ橋支店',     '普通預金', '3024334',
   'みずほ銀行_四ツ橋支店(普通預金)3024334_センターライズ',
   8641120, true, '通帳確認 (4/30)', true),

  ('centerrise', 'PayPay銀行', 'paypay', '0033', '005', 'ビジネス営業部', '普通預金', '1266637',
   'PayPay銀行_ビジネス営業部(普通預金)1266637_センターライズ',
   null, true, null, true)
on conflict (corp_id, bank_code, branch_code, account_number) do nothing;

-- リンクサポート (2 口座: みずほ + 楽天)
insert into public.bud_bank_accounts
  (corp_id, bank_name, bank_kind, bank_code, branch_code, branch_name, account_type, account_number, sub_account_label, manual_balance_20260430, has_csv, notes, is_active)
values
  ('linksupport', 'みずほ銀行', 'mizuho',  '0001', '563', '四ツ橋支店',    '普通預金', '3036669',
   'みずほ銀行_四ツ橋支店(普通預金)3036669_リンクサポート',
   1293092, true,
   '通帳確認 (4/30)。CSV 期間 2026/04/10 〜 2026/04/30 (3 週間, システム制限)。',
   true),

  ('linksupport', '楽天銀行',   'rakuten', '0036', '253', '第三営業支店',   '普通預金', '7281769',
   '楽天銀行_第三営業支店(普通預金)7281769_リンクサポート',
   null, true, null, true)
on conflict (corp_id, bank_code, branch_code, account_number) do nothing;

-- ARATA (2 口座: みずほ + 楽天)
insert into public.bud_bank_accounts
  (corp_id, bank_name, bank_kind, bank_code, branch_code, branch_name, account_type, account_number, sub_account_label, manual_balance_20260430, has_csv, notes, is_active)
values
  ('arata', 'みずほ銀行', 'mizuho',  '0001', '563', '四ツ橋支店',    '普通預金', '3026280',
   'みずほ銀行_四ツ橋支店(普通預金)3026280_アラタ',
   17493036, true, '通帳確認 (4/30)', true),

  ('arata', '楽天銀行',   'rakuten', '0036', '254', '第四営業支店',  '普通預金', '7289997',
   '楽天銀行_第四営業支店(普通預金)7289997_アラタ',
   null, true, null, true)
on conflict (corp_id, bank_code, branch_code, account_number) do nothing;

-- たいよう (1 口座: 楽天)
insert into public.bud_bank_accounts
  (corp_id, bank_name, bank_kind, bank_code, branch_code, branch_name, account_type, account_number, sub_account_label, manual_balance_20260430, has_csv, notes, is_active)
values
  ('taiyou', '楽天銀行', 'rakuten', '0036', '254', '第四営業支店',   '普通預金', '7291657',
   '楽天銀行_第四営業支店(普通預金)7291657_タイヨウ',
   null, true, null, true)
on conflict (corp_id, bank_code, branch_code, account_number) do nothing;

-- 壱 (1 口座: 楽天 - 新設法人, 期間 2025/07/31〜)
insert into public.bud_bank_accounts
  (corp_id, bank_name, bank_kind, bank_code, branch_code, branch_name, account_type, account_number, sub_account_label, manual_balance_20260430, has_csv, notes, is_active)
values
  ('ichi', '楽天銀行', 'rakuten', '0036', '254', '第四営業支店',     '普通預金', '7659425',
   '楽天銀行_第四営業支店(普通預金)7659425_イチ',
   null, true, '新設法人。CSV 期間 2025/07/31 〜 2026/04/30 (10 ヶ月分)。', true)
on conflict (corp_id, bank_code, branch_code, account_number) do nothing;

-- ============================================================
-- 確認クエリ (手動実行用)
-- ============================================================
-- -- 6 法人確認
-- SELECT id, code, name_short, sort_order FROM public.bud_corporations ORDER BY sort_order;
--
-- -- 12 口座確認 (法人 × 銀行マトリクス)
-- SELECT
--   c.name_short AS 法人,
--   ba.bank_name AS 銀行,
--   ba.account_number AS 口座番号,
--   ba.manual_balance_20260430 AS 手入力残高_4_30,
--   ba.has_csv AS CSV有無
-- FROM public.bud_bank_accounts ba
-- JOIN public.bud_corporations c ON c.id = ba.corp_id
-- ORDER BY c.sort_order, ba.bank_kind;
--
-- -- 手入力残高合計 (¥45,948,325 と一致するはず)
-- SELECT
--   COUNT(*) AS 口座数,
--   SUM(manual_balance_20260430) AS 手入力合計
-- FROM public.bud_bank_accounts
-- WHERE manual_balance_20260430 IS NOT NULL;
