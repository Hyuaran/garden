# Cross History #02: RLS ポリシー（履歴閲覧権限・改ざん防止・PII マスキング）

- 対象: `garden_change_history` の RLS ポリシー設計
- 優先度: **🔴 最高**（セキュリティ・コンプライアンス必須）
- 見積: **0.3d**
- 担当セッション: a-main + 各モジュール
- 作成: 2026-04-25（a-auto 002 / Batch 14 Cross History #02）
- 前提:
  - Cross History #01（テーブル設計）
  - spec-cross-rls-audit（Batch 7、ヘルパ関数）

---

## 1. 目的とスコープ

### 目的

`garden_change_history` を**改ざん不可能な記録領域**として運用、業務権限と紐付けて閲覧権限を分離、機密情報のマスキングを徹底する。

### 含める

- 履歴閲覧 RLS（業務権限と紐付け）
- 履歴の改ざん防止（INSERT のみ、UPDATE/DELETE 禁止）
- admin/super_admin の削除履歴閲覧
- 個人情報マスキング（暗号化）
- Trigger 経由の INSERT 許可

### 含めない

- データモデル詳細（#01）
- UI 表示時のマスキング（#03）

---

## 2. 履歴の特殊性

### 2.1 改ざん不可能性が重要

監査・税務調査時に「履歴が後から書き換えられた」ことが許されない:

- INSERT のみ許可
- UPDATE は **完全禁止**（admin でも不可）
- DELETE も **完全禁止**（保存期間内）
- 物理削除は別の管理者承認バッチで実施（保存期間経過時のみ）

### 2.2 業務権限との紐付け

履歴閲覧権限は**対象レコード自体の閲覧権限**と同じ:

- 案件 A の閲覧可な人 → 案件 A の履歴も閲覧可
- 案件 A 閲覧不可な人 → 履歴も不可

これを RLS で実現。

---

## 3. 基本 RLS ポリシー

### 3.1 INSERT のみ許可（Trigger 経由）

```sql
ALTER TABLE garden_change_history ENABLE ROW LEVEL SECURITY;

-- INSERT は service_role でのみ（Trigger 経由）
CREATE POLICY gch_insert_via_trigger ON garden_change_history FOR INSERT
  WITH CHECK (
    -- アプリ層からの直接 INSERT は禁止、Trigger 経由のみ
    current_setting('app.via_trigger', true) = 'true'
  );

-- Trigger 内で SET LOCAL すると WITH CHECK が通る:
-- SET LOCAL app.via_trigger = 'true';
```

### 3.2 UPDATE / DELETE 完全禁止

```sql
-- UPDATE/DELETE ポリシーを作成しない = 拒否される
-- ただし明示的に拒否ポリシー追加:

CREATE POLICY gch_no_update ON garden_change_history FOR UPDATE
  USING (false);

CREATE POLICY gch_no_delete ON garden_change_history FOR DELETE
  USING (false);
```

これで誰も UPDATE / DELETE できない（admin / super_admin も含む）。

### 3.3 物理削除の admin バッチ専用関数

保存期間経過時の物理削除は**専用 SECURITY DEFINER 関数**経由:

```sql
-- 2026-04-26 a-review #5 修正: search_path 固定 + 引数バリデーション
CREATE OR REPLACE FUNCTION admin_purge_old_history(
  p_older_than_days int DEFAULT 2555  -- 7 年
) RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_deleted int;
BEGIN
  -- 引数検証（負数 / 異常値で上限を超えるパージを防止）
  IF p_older_than_days IS NULL OR p_older_than_days < 365 OR p_older_than_days > 36500 THEN
    RAISE EXCEPTION 'Invalid retention days: % (allowed: 365-36500)', p_older_than_days
      USING ERRCODE = '22023';
  END IF;

  IF NOT has_role_at_least('super_admin') THEN
    RAISE EXCEPTION 'Only super_admin can purge history'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- 監査記録（自身を audit_logs に残す）
  INSERT INTO audit_logs (event_type, actor, data) VALUES (
    'history.purge', auth_employee_number(),
    jsonb_build_object('older_than_days', p_older_than_days)
  );

  -- パーティション drop（高速）
  -- 個別行 DELETE は Phase 1 では不可（Phase 2 で検討）
  -- ここはパーティション単位での削除を想定

  RETURN v_deleted;
END;
$$;
```

---

## 4. 閲覧 RLS（業務権限紐付け）

### 4.1 アプローチ

`garden_change_history.module + table_name + record_id` から元レコードを参照、その RLS を継承:

#### 案 A: ヘルパ関数で動的判定

```sql
-- 2026-04-26 a-review #5 修正: search_path 固定 + テーブル名ホワイトリスト + 動的 SQL を public スキーマ強制
-- 参照: a-leaf #65 search_path 全関数固定パターン
CREATE OR REPLACE FUNCTION can_user_view_record(
  p_module text, p_table text, p_record_id text
) RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_can boolean := false;
  v_allowed_tables CONSTANT text[] := ARRAY[
    -- ホワイトリスト: cross-history 連携対象テーブルのみ受付
    'bud_transfers', 'bud_payslips', 'bud_attendance',
    'leaf_kanden_cases', 'leaf_hikari_cases',  -- 他 Leaf 商材は追加必要
    'soil_lists', 'soil_call_history',
    'root_employees', 'root_partners', 'root_attendance',
    'tree_call_records',
    'forest_fiscal_periods', 'forest_shinkouki', 'forest_hankanhi',
    'bloom_workboard_items', 'bloom_kpi_snapshots'
    -- spec 改訂時はここに追加 + テスト追加
  ];
  v_allowed_modules CONSTANT text[] := ARRAY[
    'bud', 'leaf', 'soil', 'root', 'tree', 'forest', 'bloom'
  ];
BEGIN
  -- 引数検証 1: NULL / 空文字を REJECT
  IF p_module IS NULL OR p_table IS NULL OR p_record_id IS NULL
     OR length(p_module) = 0 OR length(p_table) = 0 THEN
    RETURN false;
  END IF;

  -- 引数検証 2: ホワイトリスト確認（SQL injection / 任意テーブル参照を遮断）
  IF NOT (p_module = ANY(v_allowed_modules)) THEN
    RAISE EXCEPTION 'Invalid module: %', p_module
      USING ERRCODE = '22023';
  END IF;
  IF NOT (p_table = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Invalid table: %', p_table
      USING ERRCODE = '22023';
  END IF;

  -- 引数検証 3: identifier 形式（追加保険）
  IF p_table !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid table identifier format: %', p_table
      USING ERRCODE = '22023';
  END IF;

  -- 引数検証 4: record_id 長さ制限（DoS 緩和）
  IF length(p_record_id) > 256 THEN
    RAISE EXCEPTION 'record_id too long: %', length(p_record_id)
      USING ERRCODE = '22023';
  END IF;

  -- モジュール別に分岐
  -- 動的 SQL は %I で識別子クオート、$1 でプレースホルダ、public.* で明示
  IF p_module = 'leaf' THEN
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM public.%I WHERE id::text = $1)',
      p_table
    ) INTO v_can USING p_record_id;
  ELSIF p_module = 'bud' THEN
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM public.%I WHERE id::text = $1)',
      p_table
    ) INTO v_can USING p_record_id;
  -- ... 他モジュール（同パターン）
  END IF;

  RETURN v_can;
END;
$$;

-- 関数の実行権限を絞る（authenticated のみ）
REVOKE ALL ON FUNCTION can_user_view_record(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_user_view_record(text, text, text) TO authenticated;

CREATE POLICY gch_select_with_record_access ON garden_change_history FOR SELECT
  USING (can_user_view_record(module, table_name, record_id));
```

#### セキュリティ設計メモ（2026-04-26 a-review #5 反映）

| 観点 | 対策 |
|---|---|
| **search_path 攻撃** | `SET search_path = pg_catalog, public, pg_temp` 関数定義時固定 |
| **任意テーブル参照** | `v_allowed_tables` ホワイトリスト + `^[a-z][a-z0-9_]{0,62}$` 形式チェック + `public.` スキーマ明示 |
| **任意モジュール指定** | `v_allowed_modules` ホワイトリスト |
| **DoS 緩和** | `p_record_id` の長さ 256 制限 |
| **ERRCODE 標準化** | 入力エラーは `22023`（invalid_parameter_value）|
| **PUBLIC 実行禁止** | `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated` |
| **SECURITY DEFINER の必要性** | RLS 評価時に元テーブル参照に DB 権限が必要、INVOKER だと回避困難 → DEFINER 維持、ただし search_path 固定で攻撃面縮小 |

#### 案 B: モジュール別の SELECT ポリシー直接定義

```sql
CREATE POLICY gch_select_leaf ON garden_change_history FOR SELECT
  USING (
    module = 'leaf'
    AND EXISTS (
      SELECT 1 FROM soil_kanden_cases
      WHERE id::text = garden_change_history.record_id
        AND leaf_user_in_business('kanden')
    )
  );

CREATE POLICY gch_select_bud ON garden_change_history FOR SELECT
  USING (
    module = 'bud'
    AND EXISTS (
      SELECT 1 FROM bud_transfers
      WHERE id::text = garden_change_history.record_id
        AND (
          /* Bud RLS と同じ条件 */
        )
    )
  );

-- ... 他モジュール
```

### 4.2 推奨: 案 A（ヘルパ関数）

- メンテナンス容易
- モジュール追加時に関数 1 箇所修正
- 性能は STABLE + index で許容範囲

### 4.3 削除済レコードの履歴

- 元レコード `deleted_at IS NOT NULL` でも履歴 SELECT 可
- 「いつ削除されたか」を確認するため
- ただし元レコード自体が物理削除された場合、履歴は閲覧不可（参照先消失）

---

## 5. admin/super_admin の特権

### 5.1 全モジュール横断閲覧

```sql
CREATE POLICY gch_select_admin ON garden_change_history FOR SELECT
  USING (has_role_at_least('admin'));
```

- admin はすべての履歴を閲覧可（業務権限を超越）
- 監査・調査用途

### 5.2 super_admin のみ purge 関数実行可

§3.3 の `admin_purge_old_history` は super_admin 権限必須。

---

## 6. PII マスキング

### 6.1 機密列のリスト

```sql
CREATE TABLE garden_history_pii_columns (
  id          serial PRIMARY KEY,
  module      text NOT NULL,
  table_name  text NOT NULL,
  field_name  text NOT NULL,
  reason      text NOT NULL,
  CONSTRAINT uniq_pii UNIQUE (module, table_name, field_name)
);

-- 初期登録例
INSERT INTO garden_history_pii_columns (module, table_name, field_name, reason) VALUES
  ('bud', 'bud_gensen_choshu', 'recipient_my_number', 'マイナンバー'),
  ('bud', 'bud_shiharai_chosho', 'vendor_my_number', 'マイナンバー'),
  ('leaf', 'soil_kanden_cases_files', 'identity_doc_storage_key', '本人確認書類'),
  ('root', 'root_employees', 'birthday', '誕生日（パスワード起源）'),
  ('root', 'root_employees', 'bank_account', '銀行口座');
```

### 6.2 暗号化保存

Trigger 内で `value_type = 'pii'` 列は pgcrypto 暗号化:

```sql
-- Trigger 関数内に追加
IF EXISTS (
  SELECT 1 FROM garden_history_pii_columns
  WHERE module = v_module AND table_name = TG_TABLE_NAME AND field_name = v_field_name
) THEN
  v_old_value := pgp_sym_encrypt(v_old_value, current_setting('app.history_secret'));
  v_new_value := pgp_sym_encrypt(v_new_value, current_setting('app.history_secret'));
END IF;
```

### 6.3 復号権限（admin+ のみ）

```sql
-- 2026-04-26 a-review #5 修正: search_path 固定 + 引数バリデーション + 権限失敗ログ
CREATE OR REPLACE FUNCTION decrypt_history_value(
  p_history_id bigint
) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_value text;
BEGIN
  -- 引数検証
  IF p_history_id IS NULL OR p_history_id <= 0 THEN
    RAISE EXCEPTION 'Invalid history_id: %', p_history_id
      USING ERRCODE = '22023';
  END IF;

  IF NOT has_role_at_least('admin') THEN
    -- 権限失敗時も監査（不正アクセス追跡）
    INSERT INTO audit_logs (event_type, actor, data)
    VALUES ('history.decrypt.denied', auth_employee_number(),
            jsonb_build_object('history_id', p_history_id, 'reason', 'insufficient_role'));
    RAISE EXCEPTION 'Only admin can decrypt'
      USING ERRCODE = '42501';
  END IF;

  SELECT pgp_sym_decrypt(new_value::bytea, current_setting('app.history_secret'))
  INTO v_value FROM garden_change_history WHERE history_id = p_history_id;

  -- 復号も監査
  INSERT INTO audit_logs (event_type, actor, data)
  VALUES ('history.decrypt', auth_employee_number(),
          jsonb_build_object('history_id', p_history_id));

  RETURN v_value;
END;
$$;

REVOKE ALL ON FUNCTION decrypt_history_value(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decrypt_history_value(bigint) TO authenticated;
```

### 6.4 UI 表示時のマスキング

PII 列の history 表示時:

```
銀行口座: ************1234（マスク）
[admin で復号する]
```

---

## 7. 改ざん検知（Phase 2）

### 7.1 ハッシュチェイン（オプション）

各履歴行に前行のハッシュを含める:

```sql
ALTER TABLE garden_change_history
  ADD COLUMN prev_hash text,
  ADD COLUMN current_hash text;
```

INSERT 時に: `current_hash = sha256(new_value || prev_hash || timestamp)`

改ざん検知バッチで全行のハッシュチェインを検証。

### 7.2 Phase 2 検討

Phase 1 では実装しない。コスト vs 効果検討後に判断。

---

## 8. RLS の動作確認シナリオ

### 8.1 営業（toss/closer）が閲覧

- 関電業務有: 自分の営業案件履歴 ✓
- 自分の振込履歴: ✓
- 他人の振込履歴: ✗
- マイナンバー履歴: ✗（マスク表示）

### 8.2 staff（事務）

- 全関電案件履歴: ✓
- 全振込履歴: ✓（Bud 全件）
- マイナンバー履歴: マスク表示

### 8.3 admin

- 全モジュール全履歴: ✓
- マイナンバー復号関数: ✓

### 8.4 super_admin

- admin と同等
- + purge 関数実行可

---

## 9. パフォーマンス考慮

### 9.1 RLS ヘルパ関数の最適化

`can_user_view_record` は **STABLE** 宣言、PostgreSQL がクエリ内でキャッシュ。

### 9.2 インデックス

#01 §3.1 の `idx_gch_record` で `(module, table_name, record_id)` 複合 index。RLS 評価時に高速参照。

### 9.3 想定クエリ

```sql
-- 案件履歴を取得（典型）
SELECT * FROM garden_change_history
WHERE module = 'leaf' AND table_name = 'soil_kanden_cases' AND record_id = 'abc-123'
ORDER BY changed_at DESC
LIMIT 100;
```

→ index ヒット、< 50ms 想定

---

## 10. 実装ステップ

1. **Step 1**: 基本 RLS ポリシー（INSERT のみ、UPDATE/DELETE 拒否）（0.5h）
2. **Step 2**: `can_user_view_record` ヘルパ関数（1h）
3. **Step 3**: モジュール別の SELECT ポリシー（admin / 業務権限）（1h）
4. **Step 4**: PII マスキング（pgcrypto + 列リスト）（1h）
5. **Step 5**: 復号関数 + 監査連携（0.5h）
6. **Step 6**: 動作確認（4 役割 × 5 シナリオ）（1h）

**合計**: 約 **0.3d**（約 5h）

---

## 11. テスト観点（詳細 #06）

- INSERT は Trigger 経由のみ通る
- UPDATE / DELETE は admin でも拒否
- 営業が他人案件履歴を見られない
- staff が全履歴閲覧可
- admin が全モジュール横断閲覧可
- super_admin のみ purge 関数実行可
- PII 列が暗号化されている
- admin の復号で監査ログ記録
- パーティション境界での RLS 動作

---

## 12. 判断保留事項

- **判1: ヘルパ関数 vs ポリシー直書き**
  - `can_user_view_record` 関数 / 各モジュール直書き
  - **推定スタンス**: ヘルパ関数（メンテナンス容易）
- **判2: PII 列の運用**
  - 暗号化 / マスク表示のみ / 別テーブル分離
  - **推定スタンス**: 暗号化（pgcrypto）+ admin+ 復号
- **判3: 改ざん検知ハッシュ**
  - Phase 1 / Phase 2
  - **推定スタンス**: Phase 2（コスト vs 効果）
- **判4: super_admin の purge 実行頻度**
  - 月次 / 年次 / 手動のみ
  - **推定スタンス**: 年次手動（保存期間 7 年で十分）
- **判5: 削除済レコードの履歴閲覧期間**
  - 元レコードと同期間 / 永続
  - **推定スタンス**: 永続（誤削除発覚時の復旧用）
- **判6: 業務権限の継承方式**
  - 関数経由 / SQL VIEW / マテリアライズドビュー
  - **推定スタンス**: 関数経由（柔軟）

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| 基本 RLS（INSERT/UPDATE/DELETE）| 0.5h |
| ヘルパ関数 `can_user_view_record` | 1.0h |
| モジュール別 SELECT ポリシー | 1.0h |
| PII 暗号化 | 1.0h |
| 復号関数 + 監査 | 0.5h |
| 動作確認 | 1.0h |
| **合計** | **0.3d**（約 5h）|

---

— spec-cross-history-02 end —
