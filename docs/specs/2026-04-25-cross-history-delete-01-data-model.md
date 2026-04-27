# Cross History #01: 変更履歴データモデル

- 対象: Garden 全モジュール横断の変更履歴記録基盤
- 優先度: **🔴 最高**（02-06 全 spec の前提）
- 見積: **0.4d**
- 担当セッション: a-main + 各モジュール（適用は全員）
- 作成: 2026-04-25（a-auto 002 / Batch 14 Cross History #01）
- 前提:
  - 既存 `audit_logs` テーブル（spec-cross-audit-log Batch 7、イベントレベル監査）
  - spec-cross-rls-audit（RLS パターン）
  - memory: project_delete_pattern_garden_wide.md / feedback_quality_over_speed_priority.md

---

## 1. 目的とスコープ

### 目的

Kintone 風「レコード履歴」を Garden 全モジュールで実現するため、**フィールド単位の変更前後値**を記録する横断テーブルを設計する。既存の `audit_logs`（イベントレベル）とは別のテーブル分離方針。

### 含める

- `garden_change_history` テーブル（横断共通）
- BEFORE UPDATE / DELETE Trigger 共通テンプレ
- パーティショニング戦略（高頻度モジュール用）
- 保存期間ポリシー（7 年）
- 既存 `audit_logs` との役割分担

### 含めない

- RLS（02 で別途）
- UI（03）
- 削除パターン（04）
- モジュール統合（05）
- テスト（06）

---

## 2. 既存 `audit_logs` との役割分担

| 観点 | `audit_logs` | **`garden_change_history`** |
|---|---|---|
| 粒度 | **イベント単位**（業務操作）| **フィールド単位**（列ごとの変更）|
| データ | event_type / actor / data jsonb | table_name / record_id / field_name / old_value / new_value |
| 用途 | 監査・コンプライアンス | **Kintone 風履歴 UI** |
| 量 | 中（イベント発生時のみ）| **大**（更新ごと、全列分）|
| 例 | `bud.transfer.create` | `bud_transfers.amount: 10000 → 12000` |

**両テーブル併用**:

- イベント発生時: `audit_logs` に 1 行
- 同時に列変更があれば: `garden_change_history` に N 行（変更列分）

---

## 3. テーブル設計

### 3.1 `garden_change_history`

```sql
-- supabase/migrations/20260601_01_garden_change_history.sql
BEGIN;

CREATE TABLE garden_change_history (
  history_id        bigserial PRIMARY KEY,

  -- 識別
  module            text NOT NULL CHECK (module IN (
    'soil', 'root', 'tree', 'leaf', 'bud', 'bloom', 'seed', 'forest', 'rill', 'shared'
  )),
  table_name        text NOT NULL,
  record_id         text NOT NULL,            -- uuid / text 両対応のため text で保持

  -- 操作
  operation         text NOT NULL CHECK (operation IN (
    'INSERT',         -- 新規作成
    'UPDATE',         -- 更新
    'DELETE',         -- 物理削除
    'SOFT_DELETE',    -- 論理削除（deleted_at 設定）
    'RESTORE'         -- 復元（deleted_at NULL 化）
  )),

  -- 変更内容（フィールド単位、UPDATE 時は変更列分の行）
  field_name        text,                      -- INSERT/DELETE では NULL
  old_value         text,                      -- 変更前（NULL の場合は新規）
  new_value         text,                      -- 変更後（NULL の場合は削除）

  -- 値型のヒント（UI 表示用）
  value_type        text CHECK (value_type IN (
    'text', 'number', 'date', 'datetime', 'boolean', 'json', 'reference'
  )),

  -- 変更コンテキスト
  changed_at        timestamptz NOT NULL DEFAULT now(),
  changed_by        text REFERENCES root_employees(employee_number),
  change_reason     text,                      -- ユーザー入力 or 自動値（"bulk_import" 等）
  source            text CHECK (source IN (
    'ui',             -- 通常 UI 操作
    'bulk_import',    -- CSV 一括取込
    'api',            -- 外部 API 経由
    'system',         -- システム自動（Cron 等）
    'admin_unlock'    -- admin 強制解除
  )) DEFAULT 'ui',

  -- IP / UA（admin 監査用）
  ip_address        text,
  user_agent        text,

  -- ハッシュ（改ざん検知、Phase 2 検討）
  content_hash      text,

  -- メタ
  request_id        uuid,                      -- 同一リクエストでの一括変更グループ化
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 必須インデックス
CREATE INDEX idx_gch_record ON garden_change_history (module, table_name, record_id, changed_at DESC);
CREATE INDEX idx_gch_changer ON garden_change_history (changed_by, changed_at DESC);
CREATE INDEX idx_gch_request ON garden_change_history (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_gch_recent ON garden_change_history (changed_at DESC);
```

### 3.2 列の意味

| 列 | 用途 |
|---|---|
| `module` | アプリ識別（10 種、UI のフィルタ用）|
| `table_name` / `record_id` | 対象レコード特定 |
| `operation` | 5 種類（CRUD + SOFT_DELETE / RESTORE）|
| `field_name` / `old_value` / `new_value` | フィールド単位の差分（UPDATE 時のみ）|
| `value_type` | UI 表示時の整形ヒント（日付なら整形）|
| `change_reason` | ユーザー指定 or システム自動文 |
| `source` | UI / 一括取込 / API / システム / admin |
| `request_id` | 同一リクエストの変更を 1 単位として表示 |

### 3.3 `record_id` の text 統一

- UUID も text（`'a1b2c3...'`）
- 整数 ID も text（`'12345'`）
- 複合キーも text（`'kanden:case-001'` 等、コロン区切り）

---

## 4. Trigger テンプレ

### 4.1 BEFORE UPDATE Trigger（共通）

```sql
-- 2026-04-26 a-review #5 修正: search_path 固定 + SECURITY INVOKER 明示
-- 2026-04-27 a-review #1 修正: PK 列名のハードコード解消（TG_ARGV[1] + to_jsonb 抽出パターン）
-- 参照: a-leaf #65 search_path 全関数固定パターン
CREATE OR REPLACE FUNCTION trg_record_change_history() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER                       -- INVOKER 明示（DEFINER 非推奨）
  SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_field_name text;
  v_old_value  text;
  v_new_value  text;
  v_request_id uuid := COALESCE(current_setting('app.request_id', true)::uuid, gen_random_uuid());
  v_changer    text := current_setting('app.employee_id', true);
  v_module     text := TG_ARGV[0];
  -- a-review #1 反映: PK 列名を TG_ARGV[1] で受け取り、デフォルト 'id'
  -- 各テーブルで PK 列名が異なる場合（例: bud_transfers の transfer_id）に CREATE TRIGGER 時に明示
  v_pk_column  text := COALESCE(TG_ARGV[1], 'id');
  v_record_id  text;
BEGIN
  -- TG_ARGV[0] は CREATE TRIGGER 時の固定値、外部入力ではない
  IF v_module IS NULL OR v_module !~ '^[a-z_]{1,32}$' THEN
    RAISE EXCEPTION 'Invalid module argument: %', v_module
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;

  -- TG_ARGV[1] も CREATE TRIGGER 時の固定値、識別子形式チェック
  IF v_pk_column !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid pk_column argument: %', v_pk_column
      USING ERRCODE = '22023';
  END IF;

  -- a-review #1 反映: NEW/OLD から PK 値を抽出（to_jsonb 経由で列名を文字列キー化）
  -- NEW.id::text と書くと、id 列がないテーブル（bud_transfers 等）で実行時エラー
  -- to_jsonb(NEW)->>v_pk_column なら列名を実行時に文字列で参照、列不在は NULL になる
  v_record_id := to_jsonb(COALESCE(NEW, OLD))->>v_pk_column;
  IF v_record_id IS NULL THEN
    RAISE EXCEPTION 'PK column "%" not found in table %.%', v_pk_column, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- 各列を比較、変更があれば記録
    -- v_field_name は information_schema 由来 → 必ず実在する識別子
    -- format %I で安全にクオート、$1/$2 で OLD/NEW を プレースホルダ渡し
    FOR v_field_name IN
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA              -- スキーマも明示比較
        AND table_name = TG_TABLE_NAME
        AND column_name NOT IN ('updated_at', 'created_at')
    LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field_name, v_field_name)
        USING OLD, NEW INTO v_old_value, v_new_value;

      IF v_old_value IS DISTINCT FROM v_new_value THEN
        INSERT INTO garden_change_history (
          module, table_name, record_id, operation,
          field_name, old_value, new_value,
          changed_by, request_id
        ) VALUES (
          v_module, TG_TABLE_NAME, v_record_id, 'UPDATE',
          v_field_name, v_old_value, v_new_value,
          v_changer, v_request_id
        );
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO garden_change_history (
      module, table_name, record_id, operation,
      changed_by, request_id
    ) VALUES (
      v_module, TG_TABLE_NAME, v_record_id, 'INSERT',
      v_changer, v_request_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO garden_change_history (
      module, table_name, record_id, operation,
      changed_by, request_id
    ) VALUES (
      v_module, TG_TABLE_NAME, v_record_id, 'DELETE',
      v_changer, v_request_id
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

### 4.1.1 セキュリティ設計メモ（2026-04-26 a-review #5 反映）

| 観点 | 対策 |
|---|---|
| **search_path 攻撃** | `SET search_path = pg_catalog, public, pg_temp` を関数定義時固定。実行時の `SET search_path = ...` 改竄に追従しない |
| **EXECUTE format インジェクション** | `%I` 修飾子で識別子クオート、`v_field_name` は `information_schema.columns` 由来で実在識別子のみ、$1/$2 は OLD/NEW のプレースホルダ |
| **TG_ARGV[0] の入力検証** | 起動時 `^[a-z_]{1,32}$` の正規表現で module 名を検証、不正なら ERRCODE `22023` で REJECT |
| **TG_ARGV[1] の入力検証** | PK 列名を `^[a-z][a-z0-9_]{0,62}$` の識別子形式で検証、不正なら ERRCODE `22023` で REJECT |
| **SECURITY DEFINER 不採用** | trigger は呼出元の権限で実行（INVOKER）、特権昇格を避ける |
| **table_name 確認** | `TG_TABLE_SCHEMA` も `information_schema` 検索条件に含め、別スキーマの同名テーブル誤認を防止 |

### 4.1.2 PK 列名のテーブル別対応（2026-04-27 a-review #1 反映）

#### 課題

旧 spec では `NEW.id::text` をハードコードしていたため、PK 列名が `id` 以外のテーブル（例: `bud_transfers` の `transfer_id`）に Trigger を適用すると実行時エラー（`record "new" has no field "id"`）で INSERT 失敗する致命的バグが残存していた。

#### 修正方針（A 案: COALESCE/汎用化パターン採用）

`TG_ARGV[1]` で PK 列名を受け取り、`to_jsonb(NEW)->>v_pk_column` で動的に PK 値を抽出する。
- **デフォルト**: `'id'`（標準的な PK 命名のテーブル向け、`TG_ARGV[1]` 省略可）
- **明示指定**: PK 列名が異なるテーブルでは `CREATE TRIGGER` 時に第 2 引数を渡す
- **B 案不採用理由**: テーブル別関数化はメンテコスト高、A 案で十分汎用化可能

#### PK 列マッピング表（参考）

| テーブル | PK 列 | TG_ARGV[1] |
|---|---|---|
| `bud_payslips` / `bud_attendance` / `root_employees` 等（標準命名） | `id` | 省略可 |
| `bud_transfers` | `transfer_id` | `'transfer_id'` |
| `tree_call_records` | `call_id`（仮、実装時確認） | `'call_id'` |
| `forest_fiscal_periods` | `period_id`（仮、実装時確認） | `'period_id'` |
| `bloom_workboard_items` | `item_id`（仮、実装時確認） | `'item_id'` |
| 複合キーテーブル | （非対応） | サブテーブル化 or 仮想 PK 列追加で回避 |

→ 実装時、各テーブルの実 PK 列名を確認して `CREATE TRIGGER` 時に渡す。

### 4.2 各テーブルへの適用

```sql
-- 例 1: Bud transfers（PK: transfer_id、TG_ARGV[1] 明示）
CREATE TRIGGER bud_transfers_history
  AFTER INSERT OR UPDATE OR DELETE ON bud_transfers
  FOR EACH ROW EXECUTE FUNCTION trg_record_change_history('bud', 'transfer_id');

-- 例 2: Leaf 関電（PK: id、TG_ARGV[1] 省略可）
CREATE TRIGGER soil_kanden_cases_history
  AFTER INSERT OR UPDATE OR DELETE ON soil_kanden_cases
  FOR EACH ROW EXECUTE FUNCTION trg_record_change_history('leaf');

-- 例 3: Root employees（PK: id、TG_ARGV[1] 省略可）
CREATE TRIGGER root_employees_history
  AFTER INSERT OR UPDATE OR DELETE ON root_employees
  FOR EACH ROW EXECUTE FUNCTION trg_record_change_history('root');

-- 例 4: 標準 PK が複数または非標準のテーブルは TG_ARGV[1] 必須
-- CREATE TRIGGER 時に省略すると、Trigger 関数内で PK 列「id」を探し、
-- 列不在なら ERRCODE 22023 で REJECT される（早期検出）
```

### 4.3 SOFT_DELETE / RESTORE の特別扱い

UPDATE Trigger 内で `deleted_at` の変化を検知:

```sql
-- Trigger 関数内に追加
IF v_field_name = 'deleted_at' THEN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- SOFT_DELETE
    INSERT INTO garden_change_history (..., operation, ...) VALUES (..., 'SOFT_DELETE', ...);
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    -- RESTORE
    INSERT INTO garden_change_history (..., operation, ...) VALUES (..., 'RESTORE', ...);
  END IF;
END IF;
```

### 4.4 アプリケーション側の `app.*` 設定

各 Server Action 開始時に:

```ts
await supabase.rpc('set_change_context', {
  employee_id: currentUser.employee_number,
  request_id: requestId,
  source: 'ui',
});
```

---

## 5. パーティショニング戦略

### 5.1 高頻度テーブル

以下は履歴量が多い見込み:

- `bud_transfers`（振込、月数千件）
- `soil_kanden_cases`（関電、月数百件 × 全列変更）
- `tree_call_records`（架電、月数十万件）
- `soil_call_lists`（営業リスト 253 万件、初回取込時）

### 5.2 月次パーティショニング

```sql
-- 親テーブル（既存）
CREATE TABLE garden_change_history (...) PARTITION BY RANGE (changed_at);

-- 月次パーティション（自動生成）
CREATE TABLE garden_change_history_2026_06
  PARTITION OF garden_change_history
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE garden_change_history_2026_07
  PARTITION OF garden_change_history
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- ...
```

### 5.3 自動パーティション生成

`pg_partman` 拡張で月初に翌月パーティション自動生成:

```sql
SELECT partman.create_parent(
  p_parent_table => 'public.garden_change_history',
  p_control => 'changed_at',
  p_type => 'range',
  p_interval => '1 month'
);
```

---

## 6. 保存期間ポリシー

### 6.1 7 年保存

- 税務（7 年）/ 個人情報保護（5 年）/ 業務監査（5 年）の最大値
- Phase 1: 永続論理削除、Phase 2 で 7 年経過分を物理削除バッチ

### 6.2 自動削除バッチ（Phase 2）

```sql
-- 7 年経過分を月次バッチで物理削除
DELETE FROM garden_change_history
WHERE changed_at < now() - interval '7 years';
```

- 月次 Cron 実行
- 削除前に S3 / Cloudflare R2 にアーカイブ（オプション）

---

## 7. パフォーマンス見積

### 7.1 想定容量

| モジュール | 月間レコード変更数 | 月間履歴行数 |
|---|---|---|
| Tree（架電）| 100,000 | **5,000,000**（50 列 × 変更率 10%）|
| Bud（振込・給与）| 5,000 | 100,000 |
| Leaf（関電）| 1,000 | 50,000 |
| Forest | 100 | 5,000 |
| **合計（月間）** | — | **~5,200,000** |

### 7.2 7 年累計

5,200,000 × 12 × 7 = **約 4.4 億行**

→ パーティショニング必須

### 7.3 インデックスサイズ

各 index は親テーブル + パーティション数（84 ヶ月）に分散、各 100 万行/月程度。

---

## 8. ストレージ容量

- 1 行平均 200 bytes（text 列あり）
- 月間 5,200,000 × 200 = **約 1 GB / 月**
- 7 年累計 = **約 84 GB**

Supabase の現プランで対応可能、コスト管理対象。

---

## 9. value 列の制限

### 9.1 大型 BLOB / 長文の扱い

- `text` 列で保存、ただし**5,000 文字超は切り詰め + 注記**
- `json` / `jsonb` は `JSON.stringify` した text に変換
- 添付ファイルキー（Storage path）は通常通り記録

### 9.2 PII（個人情報）の扱い

- マイナンバー / 銀行口座番号等の機密列は **value 列に暗号化保存**
- 復号は admin+ のみ（spec-cross-history-02 で詳細）
- マスキングルール: `'1234-XXXX-XXXX'` 等

---

## 10. 実装ステップ

1. **Step 1**: `garden_change_history` テーブル migration（パーティション含む）（1.5h）
2. **Step 2**: `trg_record_change_history` 共通関数（2h）
3. **Step 3**: 既存テーブル 5-10 個に Trigger 適用（1h）
4. **Step 4**: pg_partman セットアップ（0.5h）
5. **Step 5**: 動作確認（INSERT/UPDATE/DELETE/SOFT_DELETE/RESTORE）（1h）

**合計**: 約 **0.4d**（約 6h）

---

## 11. 判断保留事項

- **判1: 共通テーブル vs モジュール別テーブル**
  - `garden_change_history` 共通 / `bud_change_history` 別々
  - **推定スタンス**: 共通（横断 UI で扱いやすい、パーティションで負荷分散）
- **判2: パーティショニングの導入時期**
  - Phase 1 から / 100 万行到達後
  - **推定スタンス**: Phase 1 から（後付けは難しい）
- **判3: 保存期間 7 年 vs 永続**
  - Phase 1 永続 / 7 年で削除
  - **推定スタンス**: Phase 1 永続、Phase 2 で 7 年バッチ削除実装
- **判4: PII の暗号化**
  - 全 value 暗号化 / 機密列のみ / なし
  - **推定スタンス**: 機密列のみ（pgcrypto、列リスト admin 設定）
- **判5: Trigger の自動適用**
  - 全テーブル一括 / 必要なテーブルのみ
  - **推定スタンス**: 必要なテーブルのみ（auto-detect は誤適用リスク）
- **判6: `request_id` の生成元**
  - クライアント / サーバー / DB
  - **推定スタンス**: サーバー（Server Action 開始時に発行）
- **判7: 改ざん検知ハッシュ**
  - sha256 保存 / なし
  - **推定スタンス**: Phase 1 なし、Phase 2 で検討
- **判8: BLOB 大型値の扱い**
  - 切り詰め / 別テーブルに分離
  - **推定スタンス**: 5,000 文字切り詰め（注記付き）

---

## 12. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| migration（テーブル + パーティション）| 1.5h |
| Trigger 共通関数 | 2.0h |
| 既存テーブル適用（5-10 個）| 1.0h |
| pg_partman セットアップ | 0.5h |
| 動作確認 | 1.0h |
| **合計** | **0.4d**（約 6h）|

---

— spec-cross-history-01 end —
