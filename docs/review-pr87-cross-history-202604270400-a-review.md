# PR #87 レビュー — cross-history SQL injection 修正（a-review #47 対応）

- **対象**: PR #87 / branch `feature/cross-history-delete-specs-batch14-auto-v2`
- **base**: `develop`
- **mergeStateStatus**: `DIRTY` (CONFLICTING) ⚠️
- **diff**: 3636 additions / 0 deletions / 10 files
- **作成**: 2026-04-27（a-review GW セッション）

## 📋 概要

a-review が PR #47 で指摘した重大事項 5 件のうち、**3 件完全修正 / 1 件部分修正 / 1 件未修正**を確認。SQL injection（最重大）は防御 6 層で完全対策。ただし **`NEW.id::text` のハードコード問題は未修正**で、`bud_transfers`（PK: `transfer_id`）等のテーブルで Trigger が SQL error → INSERT 失敗の致命的バグが残存。

## 🔍 5 重大指摘の修正状況

| # | 指摘内容 | 該当 spec | 状態 |
|---|---|---|---|
| 1 | Trigger 関数 `NEW.id::text` が PK 命名異なるテーブル多数で動作不能 | 02-rls-policy §4.1 | ❌ **未修正** |
| 2 | `app.via_trigger` 整合性破綻で全 INSERT 拒否される | 02-rls-policy §3.1 / §4.4 | ✅ 修正 |
| 3 | 権限閾値ハードコード（memory「権限ポリシー設定変更可能設計」違反）| 02-rls-policy §3.3 / §5 | 🟡 **部分修正** |
| 4 | §4.1 `can_user_view_record` SQL injection + 「常に true」問題 | 02-rls-policy §4.1 | ✅ 完全修正 |
| 5 | 除外列に `deleted_at` 不在で SOFT_DELETE 二重記録 | 02-rls-policy §4.3 | ✅ 修正 |

---

## ✅ 完全修正（3 件）

### #4 SQL injection — 防御 6 層（02-rls-policy §4.1）

優れた多層防御設計：

1. **search_path 攻撃防止**: `SET search_path = pg_catalog, public, pg_temp` を関数定義時固定
2. **テーブルホワイトリスト**: `v_allowed_tables CONSTANT text[]` に 18 テーブル列挙、外側 `format()` も `public.%I` でスキーマ明示
3. **モジュールホワイトリスト**: `v_allowed_modules` で 7 モジュール限定
4. **identifier 形式チェック**: `^[a-z][a-z0-9_]{0,62}$` 正規表現
5. **DoS 緩和**: `length(p_record_id) > 256` で REJECT
6. **PUBLIC 実行禁止**: `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated`

加えて「常に true」問題は `v_can boolean := false;` で初期化、EXISTS 結果のみ true になる仕様に修正済。`RAISE EXCEPTION` の ERRCODE も `22023`（invalid_parameter_value）/ `42501`（insufficient_privilege）で標準化。

### #2 `app.via_trigger` — INSERT policy で強制（§3.1）

```sql
CREATE POLICY gch_insert_via_trigger ON garden_change_history FOR INSERT
  WITH CHECK (
    current_setting('app.via_trigger', true) = 'true'
  );
```

`current_setting(..., true)` の第 2 引数 `true` で「未設定時は NULL を返す」動作 → 比較 `= 'true'` が false → INSERT REJECT。アプリ層からの直接 INSERT は確実に遮断。

§4.4 で各 Server Action 開始時の `set_change_context` RPC 呼出パターンが明文化されており、運用上の漏れも防止。

### #5 deleted_at 二重記録 — SOFT_DELETE / RESTORE 特別扱い（§4.3）

UPDATE Trigger 内で `deleted_at` の変化を検知して、通常の field UPDATE ではなく `SOFT_DELETE` / `RESTORE` 操作として記録。これにより「`deleted_at` 列の変化」と「論理削除イベント」の二重記録は発生しない。

01-data-model §3 の `operation` enum に `'SOFT_DELETE'` / `'RESTORE'` が追加されている。

---

## 🟡 部分修正（1 件）

### #3 権限閾値ハードコード — 関数化したが root_settings 連携なし（§3.3 / §5）

```sql
IF NOT has_role_at_least('super_admin') THEN
  RAISE EXCEPTION 'Only super_admin can purge history' ...

CREATE POLICY gch_select_admin ON garden_change_history FOR SELECT
  USING (has_role_at_least('admin'));
```

**改善点**: `has_role_at_least()` 関数で抽象化されているのは良い。

**未解決**: 関数の引数 `'super_admin'` / `'admin'` が **policy / 関数本体に literal でハードコード**されており、memory「権限ポリシー設定変更可能設計」（root_settings で admin が実行時変更可能）に準拠していない。

**例**: 「履歴 purge を super_admin から admin に降格」「履歴 SELECT 権限を admin から manager に降格」という運用変更があった場合、SQL migration 必要 = 即時変更不可。

**推奨修正**:
```sql
-- 案 A: settings ベースの抽象化関数を spec に追加
-- has_role_at_least_for_action('history.purge')
-- 内部で root_settings.history_purge_min_role を参照
-- 値が変わればアプリ再デプロイ不要

-- 案 B: 各 spec で root_settings.* 参照を明示
IF NOT has_role_at_least(
  COALESCE(
    (SELECT setting_value FROM root_settings
     WHERE setting_key = 'history.purge_min_role'),
    'super_admin'  -- フォールバック
  )
) THEN ...
```

GW デモまでに対応必須ではないが、**Bud 経理権限を「manager → admin に変更したい」等の現場要望が出た時点で詰まる**。Phase 2 の cross-settings spec で正式対応推奨。

---

## ❌ 未修正（1 件）— 🔴 マージブロッカー

### #1 `NEW.id::text` ハードコード — Trigger 関数 §4.1 (lines 705, 716, 721)

```sql
-- 現状の trigger 関数（02-rls-policy §4.1）
EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field_name, v_field_name)
  USING OLD, NEW INTO v_old_value, v_new_value;
...
INSERT INTO garden_change_history (
  module, table_name, record_id, operation, ...
) VALUES (
  v_module, TG_TABLE_NAME, NEW.id::text, 'UPDATE',  -- ★ NEW.id をハードコード
  ...
);
```

**問題**: Garden 全モジュールで PK 命名が一貫しておらず、`id` 列が無いテーブル多数：

| テーブル | PK 列名（推定） | NEW.id 参照可? |
|---|---|---|
| `bud_transfers` | `transfer_id text` | ❌ NO（PR #55 review で確認済） |
| `bud_payslips` | `payslip_id` | ❌ NO（推定） |
| `bud_attendance` | `(employee_id, target_month)` 複合キー | ❌ NO |
| `leaf_kanden_cases` | `case_id` | ❌ NO |
| `leaf_kanden_attachments` | `attachment_id text` | ❌ NO（PR #72 で確認） |
| `soil_lists` | `list_id` または `id`? | ⚠️ 要確認 |
| `tree_call_records` | `call_id` | ❌ NO（推定） |
| `forest_fiscal_periods` | `id` | ✅ OK |
| `bloom_workboard_items` | `id` | ✅ OK |
| `root_employees` | `user_id` (UUID FK to auth.users) | ❌ NO |

**実害**: `bud_transfers` への INSERT で Trigger が `column "id" does not exist` の SQL ERROR → INSERT 全件失敗 → 振込登録不可（経理業務停止）。同様に Leaf 関電案件登録、Tree 架電記録登録、Root 従業員登録すべてが失敗する。

**修正案 3 通り**:

#### 案 A: Trigger 引数で PK 列名を渡す（最小変更、推奨）

```sql
CREATE OR REPLACE FUNCTION trg_record_change_history()
  ...
DECLARE
  v_module text := TG_ARGV[0];
  v_pk_col text := COALESCE(TG_ARGV[1], 'id');  -- ★ デフォルト 'id'、別 PK は引数で
  v_record_id text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', v_pk_col)
    USING COALESCE(NEW, OLD) INTO v_record_id;
  ...
  INSERT INTO garden_change_history (..., record_id, ...)
    VALUES (..., v_record_id, ...);
END;

-- 適用例
CREATE TRIGGER bud_transfers_history
  AFTER INSERT OR UPDATE OR DELETE ON bud_transfers
  FOR EACH ROW EXECUTE FUNCTION trg_record_change_history('bud', 'transfer_id');

CREATE TRIGGER root_employees_history
  AFTER INSERT OR UPDATE OR DELETE ON root_employees
  FOR EACH ROW EXECUTE FUNCTION trg_record_change_history('root', 'user_id');
```

#### 案 B: `to_jsonb` で PK 取得（より動的）

```sql
-- information_schema.table_constraints + key_column_usage で PK 列名取得
SELECT kcu.column_name INTO v_pk_col
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name)
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = TG_TABLE_SCHEMA
  AND tc.table_name = TG_TABLE_NAME
LIMIT 1;
```

ただし複合 PK の場合 `LIMIT 1` で 1 列だけ取得 → `bud_attendance(employee_id, target_month)` のような複合 PK で誤動作。複合 PK は `string_agg` で結合する設計が必要。

#### 案 C: `record_id` を JSON で記録（最も汎用、ただし spec 改訂幅大）

```sql
record_id jsonb NOT NULL  -- {"id":"abc"} or {"transfer_id":"T-001"} or {"employee_id":"E-1","target_month":"2026-04"}
```

spec を JSON に切り替えると history table 既存データのマイグレーション必要 → GW 中の修正は重い。

**推奨**: **案 A** がコスト最小で確実。Trigger 適用時に PK 名を明示する分手間だが、各 module の `CREATE TRIGGER` ステートメントは spec で 1 度書くだけで済む。

---

## 📚 known-pitfalls.md 横断チェック

- #1 timestamptz 空文字: ✅ 該当なし（spec 範囲外）
- #2 RLS anon 流用: ✅ Trigger は INVOKER（Server Action 経由）/ purge 関数は SECURITY DEFINER + search_path 固定で OK
- #3 空 payload insert: ✅ 該当なし
- #6 garden_role CHECK 制約: ✅ `has_role_at_least()` 経由で抽象化
- #8 deleted_at vs is_active: ✅ §4.3 で SOFT_DELETE / RESTORE 特別扱い

## 🚦 判定

### ❌ REQUEST CHANGES（マージブロッカー 1 件）

**マージ前必須対応**:
1. 🔴 **#1 `NEW.id::text` 修正**（案 A 推奨、Trigger 引数化）— Bud / Leaf / Tree / Root 等の主要テーブルで Trigger が動作しない致命的バグ。spec を修正、各テーブルの `CREATE TRIGGER` 例を全 module 分追記する必要あり。

**マージ後 Phase 2 で対応推奨**:
2. 🟡 **#3 権限閾値の root_settings 連携** — 現場運用変更時の SQL migration 必要を回避するため、cross-settings spec で正式対応。

**Conflict 解消（mergeStateStatus: DIRTY）**:
- 3 ahead / 11 behind diverged の状態 → develop 最新を取り込んで rebase or merge
- conflict 解消後の差分が再レビュー必要（特に他 spec が同時更新されていれば）

## 🎯 重大度サマリ

| 修正 | 件数 | 詳細 |
|---|---|---|
| 🔴 重大 | **1** | #1 NEW.id::text ハードコード未修正 |
| 🟡 推奨 | **1** | #3 権限閾値 root_settings 連携 |
| 🟢 任意 | 0 | — |

---

🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
