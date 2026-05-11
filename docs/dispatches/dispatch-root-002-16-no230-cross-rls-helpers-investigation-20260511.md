🟡 root-002-16
【a-root-002 から a-main-020 への 進捗報告(Batch 7 cross-cutting 関数 横断調査結果)】
発信日時: 2026-05-11(月) 11:25

main- No. 230 受領、Root 担当範囲の横断調査完了。

■ 調査結果サマリ

3 関数の定義 SQL は本リポジトリのどこにも存在しない（全件 grep 結果 0 件）。
Tree D-01 spec の参照は spec gap（spec-cross-rls-audit に実定義なし、命名規則のみ）。

  関数                       定義 SQL 所在        使用箇所                       apply 状態
  ─────────────────────────  ──────────────────  ─────────────────────────────  ──────────
  auth_employee_number()    なし（未実装）       spec-tree-phase-d-01 (4 箇所)  未 apply
  has_role_at_least(role)   なし（未実装）       spec-tree-phase-d-01 (3 箇所)  未 apply
  is_same_department(...)   なし（未実装）       spec-tree-phase-d-01 (1 箇所)  未 apply

→ いずれも **新規 migration 起草が必要**。

■ grep 結果（機械集計、検証可能）

実行コマンド + ヒット件数:

  $ find . -name "*.sql" -not -path "./node_modules/*" | xargs grep -l "auth_employee_number|has_role_at_least|is_same_department"
    → 0 件（SQL ファイルで定義 / 使用なし）

  $ grep -rln "CREATE OR REPLACE FUNCTION auth_employee_number|CREATE FUNCTION auth_employee_number" \
    --include="*.sql" --include="*.md" .
    → 0 件（CREATE FUNCTION 文ゼロ）

  $ grep -rln "auth_employee_number|has_role_at_least|is_same_department" \
    --include="*.md" .
    → 8 件（全て docs/specs/ 配下、定義ではなく言及のみ）

  ヒットした 8 ファイル:
    docs/specs/tree/spec-tree-phase-d-01-schema-migration.md  ← 主要参照元 (8 箇所)
    docs/specs/tree/spec-tree-phase-d-03-manager-ui.md
    docs/specs/2026-04-25-bud-phase-c-01-nenmatsu-chousei-schema.md
    docs/specs/2026-04-25-bud-phase-c-02-gensen-choshu.md
    docs/specs/2026-04-25-cross-ui-03-personalization.md
    docs/specs/2026-04-25-cross-ui-05-achievement-effects.md
    docs/superpowers/plans/2026-04-25-tree-phase-d-implementation.md
    docs/handoff-tree-202604252100-phase-d-plan.md

  $ ls supabase/migrations/ | wc -l
    → 9 ファイル（全て root_/ forest_ 系、3 関数定義含む migration なし）

  $ ls scripts/*.sql | wc -l
    → 15 ファイル（bloom/forest/root 系、3 関数定義含む script なし）

■ Tree D-01 spec の認識誤り（spec gap 検出）

spec-tree-phase-d-01-schema-migration.md L271 で:
  「auth_employee_number() / has_role_at_least() / is_same_department() は
   すべて spec-cross-rls-audit 定義の SQL 関数」

→ 実際の spec-cross-rls-audit (docs/specs/cross-cutting/spec-cross-rls-audit.md) を精読:

  L228-230 命名規則:
    「各モジュールで `<module>_has_role(role_min text)` を命名規則統一」

  L345 判3:
    「RLS ヘルパー関数の共通化（garden_has_role）→ Phase C、
     各モジュール `<module>_*` から抽出」

→ spec-cross-rls-audit には:
  - 命名規則の記載のみ
  - 3 関数の実定義 SQL なし
  - 「garden_has_role」共通化は Phase C で「これから」抽出予定

つまり Tree D-01 は spec gap を踏んでおり、依存先関数が未定義のため
D-01 schema apply は現状エラー必至。

■ 既存 Root 関数との比較

root-auth-schema.sql §3 で既存 helper:

  current_garden_role()         現ログインユーザーの garden_role 取得（SECURITY DEFINER）
  root_can_access()             manager+ 判定
  root_can_write()              admin+ 判定
  root_is_super_admin()         super_admin 判定
  tree_can_view_confirm()       cs+ 判定

→ has_role_at_least に類似機能あり（current_garden_role + IN 句で代替可能）
→ auth_employee_number に類似機能なし（auth.uid() 直接使用パターンが既存）
→ is_same_department に類似機能なし（root_employees に department 列自体なし）

■ is_same_department の追加検討事項

  $ grep -E "department|dept" scripts/root-schema.sql scripts/root-auth-schema.sql
    → 0 件

root_employees に department 列なし → is_same_department 実装には:
  1. root_employees.department_id 列追加（migration 必要）
  2. root_departments マスタテーブル新規作成（Phase B-4 等で関連検討あったが未着手）
  3. is_same_department(target_employee_id) で双方の department_id 比較

→ schema 拡張も同時に必要、単純な関数追加だけでは済まない。

■ 命名規則整合の判断保留

  Tree D-01 期待                 spec-cross-rls-audit 規則        整合性
  ────────────────────────────  ──────────────────────────────  ──────────
  auth_employee_number()        auth_* prefix の global 名空間   規則外
  has_role_at_least(role)       global 名空間（garden_/ 不使用）  規則外（Phase C で抽出予定）
  is_same_department(dept_id)   is_* prefix の global 名空間     規則外

→ Tree D-01 spec が想定する global 名空間 vs spec-cross-rls-audit
   命名規則 (`<module>_*` / Phase C の `garden_*`) の整合方針を判断必要。

■ PR #31 関連

main- No. 230 で言及の「PR #31 Batch 9 6 D spec」:

  $ gh pr view 31 --json title,body,state
    → GraphQL: Could not resolve to a PullRequest with the number of 31
    → 本 repo に PR #31 存在しない（過去削除 or 別 repo 番号）

  $ git log --all --oneline | grep -iE "batch 7|cross.*rls|garden_has_role|auth_employee"
    → 0 件（全ブランチで該当 commit なし）

→ Garden repo に PR #31 / 3 関数の commit は存在しない。

■ 推奨アクション

ケース判定 (main- No. 230 §3 の表に対応):

  | ケース | 該当 | 対応 |
  | ----------------------------------------- | ---- | ----------------------------- |
  | 3 関数定義が既存 migration にあり apply 待ち | ❌  | --                            |
  | 3 関数定義が PR 待ち / branch 内のみ        | ❌  | --                            |
  | 3 関数定義が存在せず                       | ✅  | **a-root-002 主導で新規 migration 起草** |

  推奨新規 migration: supabase/migrations/20260511000001_cross_rls_helpers.sql

  起草前に判断保留 3 件を main- No. 230 経由で東海林さん確認推奨:

    Q1. 命名規則: Tree D-01 期待（auth_/has_/is_ global）vs cross-rls-audit
         (`<module>_*` 後で `garden_*` 抽出) のどちらを採用するか
         → 候補 A: Tree spec 既存名そのまま採用、spec-cross-rls-audit 改訂
         → 候補 B: spec-cross-rls-audit 規則に従い rename
         → 候補 C: garden_* prefix で抽出 (Phase C 前倒し)

    Q2. is_same_department の実装方針:
         → root_employees に department_id 列追加 + root_departments マスタ新設
         → 既存 Phase B-4 マスタ間整合 spec / B-08 employees 拡張 spec と整合
           （現状未含、新規 schema 拡張要）
         → または Tree D-01 §4.1 から is_same_department を一時除外し、
           manager+ ポリシーは「自分担当 only」に縮退（最小実装）

    Q3. has_role_at_least vs current_garden_role + IN 句:
         → 既存 root_can_access() / root_can_write() 等で実現済の機能を
           has_role_at_least('manager') 等に統一するか、既存 helper のままか

■ 5/9-10 作業との優先順位

a-root-002 5/9-10 着手中の認証統一 (main- No. 83) と本調査は同 領域。
本 cross-rls-helpers 新規 migration は認証統一 plan §残課題 にも該当する内容:
  - has_role_at_least は Phase B-5 認証セキュリティ強化 spec の hasAccess() と
    機能重複
  - auth_employee_number は signInGarden 後の current_garden_role() と機能重複

→ Tree D-01 着手前に 3 関数定義は必須、但し命名規則確定が東海林さん判断待ち。
   判断確定後 0.5d 想定で migration 起草可（root-002 単独実装）。

■ self-check

  [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
  [x] grep / find 機械集計で数値検証 (8 件 / 0 件 / 0 件 等)
  [x] 関数 3 件全件調査完了
  [x] 推奨アクション + 判断保留 3 件明示

dispatch counter: 次番号 = 17
