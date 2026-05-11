~~~
🟡 main- No. 233
【a-main-020 から a-root-002 への dispatch】
発信日時: 2026-05-11(月) 11:25

# 件名
Batch 7 cross-cutting 関数 3 件 命名規則決裁完了 + 新規 migration 起草指示

# 1. root-002-16 受領 + 評価

横断調査優秀、3 関数の所在不明 + Tree D-01 spec gap + is_same_department 用 schema 拡張必要 等を完全特定。

# 2. 東海林さん決裁 3 件 全件 GO（2026-05-11 11:23 受領）

| Q | 判断事項 | 決裁 |
|---|---|---|
| Q1 | 命名規則（Tree spec 既存名 vs <module>_* vs garden_*）| **候補 A 採用**: Tree spec 既存名そのまま（auth_/has_/is_ global）、spec-cross-rls-audit 改訂で命名規則統一 |
| Q2 | is_same_department 実装方針 | **(b) 縮退採用**: Tree D-01 §4.1 から一時除外、manager+ ポリシーは「自分担当 only」に縮退（schema 拡張は別 Phase）|
| Q3 | has_role_at_least vs current_garden_role + IN 句 | **統一採用**: 既存 root_can_access / root_can_write 等 → has_role_at_least に統一（global 名空間、Tree / Forest / Bud 共通利用可）|

# 3. 起草指示: 新規 migration

## 3-1. ファイル
`supabase/migrations/20260511000001_cross_rls_helpers.sql`

## 3-2. 実装内容（3 関数）

### 関数 1: auth_employee_number()
- 機能: 現在ログイン中の auth.uid() から root_employees.employee_number を取得
- 返却型: text
- 既存 current_garden_role() と類似構造（auth.uid() 直接使用、SECURITY DEFINER で root_employees join）

### 関数 2: has_role_at_least(role_min text)
- 機能: 現在ログイン中の garden_role が指定 role_min 以上か判定
- 返却型: boolean
- ロール階層: toss < closer < cs < staff < manager < admin < super_admin（既存 garden_role enum 順）
- 既存 current_garden_role() + IN 句 / CASE 文で実装

### 関数 3: is_same_department(target_employee_id uuid)
- **本実装スコープ外（Q2 縮退決裁により）**
- Tree D-01 §4.1 で本関数を使用していた箇所は「自分担当 only」（auth.uid() = assigned_employee_id 等）に縮退
- Tree D-01 spec の改訂が必要（main- No. 後続候補で a-tree-002 に通知予定）

## 3-3. spec-cross-rls-audit.md 改訂（命名規則統一）

候補 A 採用に伴い、`docs/specs/cross-cutting/spec-cross-rls-audit.md` §L228-230 命名規則 + §L345 判 3 を改訂:
- 旧: <module>_has_role(role_min) パターン → Phase C で garden_* 抽出
- 新: global 名空間（auth_/has_/is_ prefix）採用、本 migration で実装

改訂は a-root-002 が新規 migration と同 PR で実施推奨。

## 3-4. 既存 root helper との関係

| 既存 helper | 関係 |
|---|---|
| current_garden_role() | 維持（has_role_at_least の内部で利用可能）|
| root_can_access() | **deprecation 候補**（has_role_at_least('manager') で代替可、ただし既存利用箇所への影響あり、別 PR で段階的置換推奨）|
| root_can_write() | 同上（has_role_at_least('admin') で代替）|
| root_is_super_admin() | 同上（has_role_at_least('super_admin') で代替）|
| tree_can_view_confirm() | 維持（Tree 固有、本 migration とは独立）|

→ 既存 helper の deprecation / 置換は本 migration とは別 PR、急務ではない。

## 3-5. apply タイミング

- a-root-002 が新規 migration + spec 改訂 + PR 起票完了
- 東海林さん最終決裁 → garden-dev apply → 動作確認 → garden-prod apply
- a-tree-002 Phase D §0 着手前の前提条件解消

# 4. 報告フォーマット（root-002- No. NN）

冒頭 3 行（🟢 root-002- No. NN / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
Batch 7 cross-cutting 関数 新規 migration 起草完了 + spec 改訂 + PR 起票

### 起草成果物
- migration: supabase/migrations/20260511000001_cross_rls_helpers.sql
- 関数 2 件（auth_employee_number / has_role_at_least）実装、is_same_department 縮退
- spec 改訂: docs/specs/cross-cutting/spec-cross-rls-audit.md（命名規則統一）
- PR 番号 / URL

### 実装詳細
- auth_employee_number(): SECURITY DEFINER + root_employees join + 戻り値 text
- has_role_at_least(role_min text): garden_role enum 順序判定、戻り値 boolean
- is_same_department: 実装スキップ（Q2 縮退、コメントで明示）

### a-tree-002 連携
- Tree D-01 spec §4.1 改訂依頼（is_same_department 使用箇所 → 「自分担当 only」縮退）
- main 経由で a-tree-002 に通知予定明示

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] migration + spec 改訂 + PR 起票
- [x] Q1/Q2/Q3 決裁反映確認

# 5. 緊急度

🟡 中（Tree Phase D §0 着手前提条件解消、5/12 以降 apply 想定）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] Q1/Q2/Q3 決裁 全件明示
- [x] 3 関数実装仕様 + 縮退指示 + spec 改訂指示明示
- [x] 既存 helper との関係（deprecation 候補）明示
- [x] 報告フォーマット (root-002- No. NN) 雛形提示
- [x] 番号 = main- No. 233（counter 継続）
~~~
