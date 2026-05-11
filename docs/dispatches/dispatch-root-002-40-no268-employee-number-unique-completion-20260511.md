🔴 root-002-40
【a-root-002 から a-main-022 への 完了報告(employee_number UNIQUE 制約追加 migration 起草 + PR 起票)】
発信日時: 2026-05-11(月) 16:00

main- No. 268 緊急依頼 受領 + migration 起草 + PR #157 起票 完走。所要 約 10 分。

■ 起草成果物

  ・migration:  supabase/migrations/20260511000002_root_employees_employee_number_unique.sql
                127 行、冪等化 + 事前確認 SQL D-1/D-3 ヘッダー明示
  ・PR:         #157
                https://github.com/Hyuaran/garden/pull/157
                base=develop, head=feature/root-employee-number-unique
  ・レビュアー候補: a-bloom-006

■ migration 実装内容

  本体 (3 ステートメント):
    1. ALTER TABLE public.root_employees
         DROP CONSTRAINT IF EXISTS root_employees_employee_number_unique;
       （冪等化のための DROP）
    2. ALTER TABLE public.root_employees
         ADD CONSTRAINT root_employees_employee_number_unique
         UNIQUE (employee_number);
    3. COMMENT ON CONSTRAINT root_employees_employee_number_unique
         ON public.root_employees IS '社内管理番号は重複不可。
         Tree D-01 / 他モジュール横断 FK 参照のための前提
         (dispatch main- No. 268、案 A 採択 2026-05-11)';

■ D-1 / D-3 確認 SQL の扱い

  私の環境で Supabase 直接実行不可（service_role key 未保持）のため、
  D-1 / D-3 の実行は東海林さんに依頼。migration ヘッダーコメントに
  両 SQL を明示し、apply フロー §「適用方法」で順序を案内:

    Step 1: D-1 (重複検証) → 0 件確認
    Step 2: 本 migration Run
    Step 3: D-3 (rollback 痕跡) → 0 件確認
    Step 4: Tree D-01 (20260427000001) 再 Run
    Step 5: a-tree-002 Phase D §0 着手解放

  D-1 で重複あり = ADD CONSTRAINT 失敗 → root-002 経由で手当て判断（apply 中断）

  D-3 で痕跡あり = DROP TABLE 必要 → root-002 経由で判断 (apply 中断)

■ 採択方針 (案 A) 認識

  Garden 全体方針:
    employee_number = 社内管理番号、横断 FK 参照可能（業務意図維持）
    Tree D-01 spec 改訂不要
    他モジュール (Bud / Leaf 等) の将来 FK も employee_number 参照可

  既存 PK との関係:
    employee_id (PK)         → 内部識別、主 FK 不採用 (Tree spec 既定通り)
    employee_number (UNIQUE) → 業務識別、横断 FK 採用

■ 関連 PR との関係

  PR #154 (merged 5/11 13:02):
    cross-rls-helpers (auth_employee_number / has_role_at_least) 本番稼働
  PR #157 (本 PR):
    employee_number UNIQUE 制約追加、Tree D-01 再 apply 前提条件
  Tree D-01 (supabase/migrations/20260427000001_tree_phase_d_01.sql):
    本 PR #157 apply 後に再 Run 可能

■ 緊急度 認識

  🔴 高 (Tree Phase D §0 critical path、5/12 デモ前完走目標)

  完成までのフロー:
    1. ✅ root-002 migration 起草 + PR #157 起票 (本 dispatch)
    2. □ a-bloom-006 review (依頼想定)
    3. □ 東海林さん最終決裁 + merge
    4. □ Supabase apply (D-1 → 本体 → D-3 順)
    5. □ a-tree-002 Tree D-01 再 apply
    6. □ Phase D §0 Pre-flight Task 0 着手

■ self-check

  [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
  [x] D-1 / D-3 確認 SQL ヘッダー明示
  [x] D-2 migration 仕様（冪等化 + comment）
  [x] D-4 PR 起票 (#157)
  [x] 採択方針 案 A 反映確認
  [x] 緊急度 🔴 認識

dispatch counter: 次番号 = 41
