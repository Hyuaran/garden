🟢 root-002-38
【a-root-002 から a-main-020 への 完了報告(Batch 7 cross-cutting 関数 新規 migration 起草 + spec 改訂 + PR 起票)】
発信日時: 2026-05-11(月) 12:05

main- No. 233 受領 + Q1/Q2/Q3 全件 GO で migration 起草 + spec 改訂 + PR 起票 完走。所要 約 40 分。

■ 起草成果物

  ・migration:   supabase/migrations/20260511000001_cross_rls_helpers.sql
                 関数 2 件実装、is_same_department 縮退（コメント明示）
  ・spec 改訂:   docs/specs/cross-cutting/spec-cross-rls-audit.md
                 §6.1 命名規則 v2 + §9 判3 解消
  ・PR:          #154
                 https://github.com/Hyuaran/garden/pull/154
                 base=develop, head=feature/root-cross-rls-helpers-20260511

差分 +177 / -4。

■ 実装詳細

関数 1: auth_employee_number()
  RETURNS text
  LANGUAGE sql SECURITY DEFINER STABLE
  SELECT employee_number FROM root_employees
    WHERE user_id = auth.uid() AND is_active = true LIMIT 1;

  → 未認証 / 未紐付 / 退職者は NULL
  → RLS から安全に呼出可 (SECURITY DEFINER)

関数 2: has_role_at_least(role_min text)
  RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE
  内部実装:
    role_order CTE (toss=1 ... super_admin=8)
    current_role_rank = role_order WHERE current_garden_role()
    min_role_rank    = role_order WHERE role_min
    SELECT COALESCE(current >= min, false);

  → 8 段階階層 (Phase A-3-g outsource 反映済):
     toss < closer < cs < staff < outsource < manager < admin < super_admin
  → 未認証 / 不正 role_min は false
  → 既存 current_garden_role() 内部利用

関数 3: is_same_department (実装スキップ)
  Q2 (b) 縮退決裁により本 migration から除外。
  migration コメントで縮退理由と将来実装条件を明示:
    - root_employees.department_id 列追加 (要 schema 拡張)
    - root_departments マスタテーブル新規作成
    - department 運用ルール確定 (異動 / 複数所属)

■ spec 改訂内容

docs/specs/cross-cutting/spec-cross-rls-audit.md

  §6.1 ヘルパー関数 命名規則 v2 (2026-05-11 改訂):
    - global 名空間採用 (auth_/has_/is_ prefix)
    - 既存 module 別 helper (bloom_has_access / root_can_access 等) は維持
    - 旧 「<module>_has_role 統一」案は廃止
    - 旧 「Phase C で garden_has_role 抽出」予定は本 PR で前倒し完了 (garden_* 不採用)
    - 実装場所: 本 migration を明記

  §9 判3 解消:
    - 「Phase C で抽出予定」→ 「2026-05-11 確定で本 PR 実装完了」
    - garden_* prefix 案は不採用と明示

■ a-tree-002 連携 (main 経由で別 dispatch 発信予定)

Tree D-01 spec §4.1 改訂依頼:
  - 旧: USING (has_role_at_least('manager') AND is_same_department(employee_id))
  - 新: USING (has_role_at_least('manager') AND employee_id = auth_employee_number())
        → 「自分担当 only」縮退で is_same_department 不要化
  - マネージャー部署絞込は schema 拡張完了後に再導入

Tree D-01 spec apply 前に上記改訂が必須。a-main-020 経由で a-tree-002 へ
通知依頼します（main- No. 後続候補）。

■ 既存 helper 維持方針

  既存 helper                  関係                                   段階置換
  ──────────────────────────  ──────────────────────────────────────  ────────
  current_garden_role()        has_role_at_least 内部利用              維持
  root_can_access()            ≈ has_role_at_least('manager')         別 PR (急務なし)
  root_can_write()             ≈ has_role_at_least('admin')           別 PR
  root_is_super_admin()        ≈ has_role_at_least('super_admin')     別 PR
  tree_can_view_confirm()      Tree 固有、独立                          維持

→ 段階的置換は急務でない。本 PR では追加のみ、削除なし。

■ apply タイミング (main- No. 233 §3-5 通り)

  1. ✅ a-root-002 新規 migration + spec 改訂 + PR 起票 完了 (本 dispatch)
  2. □ 東海林さん最終決裁 + PR review (レビュアー a-bloom 想定)
  3. □ garden-dev apply → 動作確認
  4. □ garden-prod apply
  5. □ a-tree-002 Tree D-01 spec §4.1 改訂 + Phase D §0 着手前提条件解消

■ self-check

  [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
  [x] migration + spec 改訂 + PR 起票 全件完了
  [x] Q1/Q2/Q3 決裁反映確認
  [x] 既存 helper 維持方針明示
  [x] a-tree-002 連携依頼明示

dispatch counter: 次番号 = 39
