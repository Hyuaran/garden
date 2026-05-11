~~~
🟡 main- No. 230
【a-main-020 から a-root-002 + a-soil-002 + a-bud-002 への dispatch（横断調査依頼）】
発信日時: 2026-05-11(月) 10:53

# 件名
Batch 7 cross-cutting 関数（auth_employee_number / has_role_at_least / is_same_department）所在 + 既存 migration 横断調査依頼

# 1. 背景

a-tree-002 tree-002- No. 20（2026-05-11 10:40）で Batch 7 cross-cutting 関数未 apply を検出:

| 関数 | 用途 |
|---|---|
| auth_employee_number() | 認証 employee_number 取得 |
| has_role_at_least(role) | ロール階層判定 |
| is_same_department(dept_id) | 同部署判定 |

これらは RLS 設計の cross-cutting 関数として a-tree D-01 schema が WITH CHECK / USING で使用。未 apply 状態では D-01 適用時にエラー発生。

origin/develop の `supabase/migrations` 配下に直接の関数定義 SQL ファイルなし（grep 結果 0 件）= **所在不明**。

# 2. 横断調査依頼（3 セッション分担）

## 2-1. a-root-002（最優先、Root 系認証 / RLS 担当）

### 調査項目
1. **spec-cross-rls-audit.md 詳細精読**（L230 / L345 の命名規則言及部分含む）
2. **3 関数の定義 SQL の所在探索**:
   - `find . -name "*.sql" | xargs grep -l "auth_employee_number\|has_role_at_least\|is_same_department"`
   - `supabase/migrations` + `scripts/` + `docs/` 配下を全件 grep
3. **既存 migration での 3 関数定義**:
   - Root 系 migration（`root-rls-*`、`root-schema-*`）で関数定義箇所
   - 関数定義がない場合は「新規 migration 起草が必要」と判定
4. **PR #31 + その他 Phase D 関連 PR**:
   - PR #31（Batch 9 6 D spec、merge 済）の関連 commit で関数定義含むか
   - 別 PR / branch で関数定義の commit があるか
5. **CLAUDE.md / spec での命名規則整合**:
   - 「auth_employee_number」「has_role_at_least」「is_same_department」が命名規則に従っているか

### 報告先
a-main-020 に root-002- No. NN で報告

## 2-2. a-soil-002（Soil 系 migration + 横断 RLS 利用）

### 調査項目
1. **Soil 系 migration（20260507000003_soil_rls.sql 含む）での 3 関数使用箇所**
2. **3 関数の定義 SQL を Soil 系で確認**（Soil 系で定義されているか、import / 依存しているか）
3. **Phase 1 PR #152 + Phase 2 (準備中) での 3 関数依存度**

### 報告先
a-main-020 に soil- No. NN で報告

## 2-3. a-bud-002（Bud 系 migration + 横断 RLS 利用）

### 調査項目
1. **Bud 系 migration（bud-rls-*）での 3 関数使用箇所**
2. **3 関数の定義 SQL を Bud 系で確認**
3. **PR #148/#149（Phase D 100% + Phase E spec）での 3 関数依存度**

### 報告先
a-main-020 に bud-002- No. NN で報告

# 3. 調査優先順位 + 期限

| 優先 | セッション | 期限 |
|---|---|---|
| 🟢 高 | a-root-002（認証 / RLS 担当の本丸）| 30-60 分以内（main-020 のガンガン稼働 5h 枠内）|
| 🟡 中 | a-soil-002 | 同上、並行進行可 |
| 🟡 中 | a-bud-002 | 同上、並行進行可 |

3 セッション並行調査推奨。main-020 が結果集約後、以下のいずれかを判断:

| ケース | 対応 |
|---|---|
| 3 関数定義が既存 migration にあり、未 apply のみ | 東海林さん apply 指示で解消 |
| 3 関数定義が PR 待ち / branch 内のみ | 該当 PR merge 後 apply |
| 3 関数定義が存在せず | a-root-002 主導で新規 migration 起草（`supabase/migrations/20260511000000_cross_rls_helpers.sql` 等） |

# 4. 報告フォーマット（root-002- No. NN / soil- No. NN / bud-002- No. NN）

各セッションが独立 dispatch（冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用、v5.1 完全準拠）で main-020 へ報告。

### 件名
Batch 7 cross-cutting 関数 横断調査結果（main- No. 230 への返答）

### 調査結果サマリ（表形式）
| 関数 | 定義 SQL 所在 | 使用箇所 | apply 状態 |
|---|---|---|---|
| auth_employee_number() | ... | ... | ... |
| has_role_at_least(role) | ... | ... | ... |
| is_same_department(dept_id) | ... | ... | ... |

### grep 結果（実行コマンド + ヒット件数 + 該当ファイル一覧）
- 機械集計（grep -r 等）必須、目視判定不可

### 推奨アクション
- 既存 migration ですでに定義済 / PR 待ち / 新規起草必要、のいずれか

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 機械集計（grep + wc 等）で数値検証
- [x] 関数 3 件全件調査

# 5. 緊急度

🟡 中（Tree Phase D 着手前提条件、Batch 7 関数解消で D-01 schema apply 可能化、本日中の解消推奨）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 3 セッション横断調査 + 各セッション調査項目明示
- [x] 報告フォーマット雛形提示
- [x] 番号 = main- No. 230（counter 継続）

# 東海林さんへ - コピーテキスト外

本 dispatch は 3 セッション宛の横断調査依頼です。本ファイル全体を:
- a-root-002 セッションに投下
- a-soil-002 セッションに投下
- a-bud-002 セッションに投下

の 3 回投下が必要です（PowerShell rate limit 回避のため、30-60 秒間隔推奨）。
~~~
