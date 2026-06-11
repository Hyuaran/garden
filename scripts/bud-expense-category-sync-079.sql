-- Codex-079: Bud 経費区分マスタ同期（適用は東海林さん）
-- 既存の bud_expense_requests.category_id 参照を守るため DELETE は行わない。
-- name が一致する既存行は UPDATE、不足している区分のみ INSERT する。

WITH desired(name, debit_account_name, tax_class, display_order, notes) AS (
  VALUES
    ('会議費', '会議費', '課税仕入 10%', 10, 'Codex-079 現金領収書仕訳ルール'),
    ('接待交際費', '接待交際費', '課税仕入 10%', 20, 'Codex-079 現金領収書仕訳ルール'),
    ('旅費交通費', '旅費交通費', '課税仕入 10%', 30, 'Codex-079 現金領収書仕訳ルール'),
    ('駐車場', '旅費交通費', '課税仕入 10%', 40, 'Codex-079 現金領収書仕訳ルール'),
    ('タクシー', '旅費交通費', '課税仕入 10%', 50, 'Codex-079 現金領収書仕訳ルール'),
    ('備品購入', '消耗品費', '課税仕入 10%', 60, 'Codex-079 現金領収書仕訳ルール'),
    ('社用車備品交換等', '車両費', '課税仕入 10%', 70, 'Codex-079 現金領収書仕訳ルール'),
    ('社用車罰金', '車両費', '対象外', 80, 'Codex-079 現金領収書仕訳ルール'),
    ('処分費', '雑費', '課税仕入 10%', 90, 'Codex-079 現金領収書仕訳ルール'),
    ('その他', null, null, 100, '店名の部分一致で仕訳化時に自動判定。未一致は要確認')
),
updated AS (
  UPDATE public.bud_expense_categories c
     SET debit_account_name = d.debit_account_name,
         tax_class = d.tax_class,
         display_order = d.display_order,
         is_active = true,
         notes = d.notes,
         updated_at = now()
    FROM desired d
   WHERE c.name = d.name
   RETURNING c.name
)
INSERT INTO public.bud_expense_categories (
  name,
  debit_account_name,
  tax_class,
  display_order,
  is_active,
  notes,
  created_at,
  updated_at
)
SELECT
  d.name,
  d.debit_account_name,
  d.tax_class,
  d.display_order,
  true,
  d.notes,
  now(),
  now()
FROM desired d
WHERE NOT EXISTS (
  SELECT 1
    FROM public.bud_expense_categories c
   WHERE c.name = d.name
);
