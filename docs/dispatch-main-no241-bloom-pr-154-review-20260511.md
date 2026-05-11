~~~
🟡 main- No. 241
【a-main-020 から a-bloom-006 への dispatch】
発信日時: 2026-05-11(月) 11:37

# 件名
PR #154 (Batch 7 cross-rls-helpers migration) レビュー依頼 + Phase D 着手前提条件解消の要

# 1. 経緯

a-root-002 が main- No. 233 受領 → root-002-38（2026-05-11 12:05）で Batch 7 cross-cutting 関数の新規 migration + spec 改訂 + PR #154 起票完了。

a-tree-002 Phase D §0 着手前提条件解消のため、PR #154 a-bloom-006 レビュー必須。

# 2. レビュー対象

| 項目 | 内容 |
|---|---|
| PR 番号 | **PR #154** |
| URL | https://github.com/Hyuaran/garden/pull/154 |
| base | develop |
| head | feature/root-cross-rls-helpers-20260511 |
| title | feat(root): Batch 7 cross-cutting 関数 + spec 改訂（auth_employee_number / has_role_at_least + spec-cross-rls-audit v2）|
| 差分 | +177 / -4 |

# 3. レビュー観点（共通 4 + PR #154 独自 3 = 7 観点）

## 3-1. 共通観点（PR #150/#147/#152 と同等）

| # | 観点 | 内容 |
|---|---|---|
| 1 | 外部キー整合 | root_employees / auth.uid() の参照整合 |
| 2 | 認証ロール 8 段階 | toss < closer < cs < staff < outsource < manager < admin < super_admin のロール階層判定整合 |
| 3 | Bloom 衝突 | Bloom 既存 RLS との衝突なし、has_role_at_least 統一による Bloom 側へのリファクタ可能性 |
| 4 | 旧版データ保持 | 既存 migration / helper の non-destructive 維持 |

## 3-2. PR #154 独自観点

| # | 観点 | 内容 |
|---|---|---|
| 5 | auth_employee_number() 実装 | SECURITY DEFINER + root_employees join + LIMIT 1 / is_active = true 条件、未認証 / 退職者 NULL 返却の妥当性 |
| 6 | has_role_at_least(role_min) 実装 | 8 段階階層判定の実装（CTE + COALESCE >= 比較）、未認証 / 不正 role_min false 返却の妥当性 |
| 7 | is_same_department 縮退 | 本 PR では実装スキップ（main- No. 233 Q2 (b) 縮退決裁）、migration コメントで縮退理由 + 将来再実装条件明示の妥当性 |

# 4. spec 改訂レビュー（任意）

`docs/specs/cross-cutting/spec-cross-rls-audit.md` §6.1 + §9 改訂内容:
- 旧: <module>_has_role(role_min) 命名規則 + Phase C で garden_has_role 抽出予定
- 新: global 名空間（auth_/has_/is_ prefix）採用 + 既存 module 別 helper 維持

レビュー観点: 命名規則統一の整合性、既存 helper（root_can_access / bloom_has_access 等）との関係明示の妥当性。

# 5. 既存 helper deprecation 候補（参考）

root-002-38 §「既存 helper 維持方針」より:
- root_can_access() ≈ has_role_at_least('manager') 別 PR で段階置換（急務なし）
- root_can_write() ≈ has_role_at_least('admin') 同上
- root_is_super_admin() ≈ has_role_at_least('super_admin') 同上

→ 本 PR では追加のみ、削除なし。段階的置換は将来 PR。

# 6. 報告フォーマット（bloom-006- No. 6 以降）

冒頭 3 行（🟢 bloom-006- No. 6 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
PR #154 レビュー完了 + 採用推奨 / 要修正 / コメント済件数

### PR #154 レビュー結果
- 7 観点完走
- 採用推奨 / 要修正 / コメント済件数
- gh pr review コメント参照（hash / line）

### Tree Phase D §0 着手前提条件解消への寄与
- PR #154 採用推奨で merge + apply 後、Tree D-01 schema apply 可能化

### self-check

# 7. 緊急度

🟡 中（Tree Phase D §0 着手前提条件解消、PR #154 merge + apply → Tree D-01 schema apply の流れ）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] PR #154 情報明示
- [x] レビュー観点 7 項目（共通 4 + 独自 3）明示
- [x] spec 改訂レビュー観点（任意）明示
- [x] 既存 helper deprecation 候補（参考）明示
- [x] 報告フォーマット雛形提示
- [x] 番号 = main- No. 241（counter 継続）
~~~
