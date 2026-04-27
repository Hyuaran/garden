# PR #87 再レビュー — cross-history `NEW.id::text` 修正検証

- **対象**: PR #87 / branch `feature/cross-history-delete-specs-batch14-auto-v2`
- **修正 commit**: `e980871` （a-auto） + `03dbd2d` （a-main-009 が develop merge で conflict 解消）
- **再レビュー対象**: 初回レビュー（2026-04-27 04:00）の 🔴 重大指摘 #1 = `NEW.id::text` ハードコード問題の解消検証
- **検証ファイル**: 01-data-model / 02-rls-policy / 06-test-strategy（+204 / -18）

## 📋 概要

初回レビューで残っていたマージブロッカー 🔴 #1 が **3 spec 一括で完全修正**されていることを確認。Trigger 関数 (`01-data-model §4.1`) の `NEW.id::text` ハードコードを `to_jsonb(COALESCE(NEW, OLD))->>v_pk_column` パターンに置換、PK 列名は `TG_ARGV[1]` で受領（デフォルト `'id'`）、識別子バリデーション + 列不在 REJECT も整っている。RLS policy 側 (`02-rls-policy §4.1`) も補助関数 `get_table_pk_column(text)` で動的解決、案 B でも `bud_transfers` の PK を `transfer_id::text` に修正済。テスト Case 7-9 が R1 担保で追加され、DoD にも反映。

---

## 🔍 1 重大指摘の修正検証

### ✅ #1 `NEW.id::text` ハードコード — 完全修正

#### Trigger 関数（01-data-model §4.1）— A 案（`TG_ARGV[1]` + `to_jsonb`）採用

```sql
v_pk_column  text := COALESCE(TG_ARGV[1], 'id');
...
IF v_pk_column !~ '^[a-z][a-z0-9_]{0,62}$' THEN
  RAISE EXCEPTION 'Invalid pk_column argument: %', v_pk_column USING ERRCODE = '22023';
END IF;

v_record_id := to_jsonb(COALESCE(NEW, OLD))->>v_pk_column;
IF v_record_id IS NULL THEN
  RAISE EXCEPTION 'PK column "%" not found in table %.%', v_pk_column, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '22023';
END IF;
```

**評価**:
- 私が初回レビューで推奨した **案 A**（`TG_ARGV[1]` で PK 列名を渡す方式）を採用、最小変更でメンテ性最優先。
- `to_jsonb(NEW)->>v_pk_column` は **`NEW.id::text` の直接参照と違って列不在が NULL になる**（例外でなく値で帰ってくる）ため、後段の `IF v_record_id IS NULL THEN ... REJECT` で安全に検出可能。spec コメントの説明（L184-185）も正確。
- `COALESCE(NEW, OLD)` で **DELETE 時 NEW=NULL のケースも OLD から取得**できるよう手当済み（INSERT/UPDATE は NEW、DELETE は OLD）。
- 識別子バリデーション `^[a-z][a-z0-9_]{0,62}$` で SQL injection を遮断。`TG_ARGV[1]` は CREATE TRIGGER 時の固定値なので攻撃面は薄いが、二重保険として妥当。
- `INSERT` / `UPDATE` / `DELETE` の 3 分岐すべてで `v_record_id`（`NEW.id::text` ではなく動的解決値）を使うように修正済み（L210, 221, 229）。**ハードコード参照は完全撤廃**。

#### CREATE TRIGGER 例（01-data-model §4.2）

```sql
-- 例 1: Bud transfers（PK: transfer_id、TG_ARGV[1] 明示）
CREATE TRIGGER bud_transfers_history
  AFTER INSERT OR UPDATE OR DELETE ON bud_transfers
  FOR EACH ROW EXECUTE FUNCTION trg_record_change_history('bud', 'transfer_id');

-- 例 2 (Leaf) / 例 3 (Root): TG_ARGV[1] 省略
```

**評価**: 標準 PK / 非標準 PK の使い分けが 4 例で示されており、実装者の迷いを排除。例 4 のコメント「TG_ARGV[1] 省略時に列不在なら ERRCODE 22023 で REJECT」も Case 9 と整合。

#### PK 列マッピング表（01-data-model §4.1.2、新設）

| テーブル | PK 列 | TG_ARGV[1] |
|---|---|---|
| `bud_transfers` | `transfer_id` | `'transfer_id'` |
| `tree_call_records` | `call_id`（仮） | `'call_id'` |
| `forest_fiscal_periods` | `period_id`（仮） | `'period_id'` |
| `bloom_workboard_items` | `item_id`（仮） | `'item_id'` |

**評価**: 新設の 4.1.2 が**初回レビューで指摘した実害 6 テーブルのうち 5 つを明示**。「（仮、実装時確認）」との注記もありフォローアップが意識されている。複合キーは「サブテーブル化 or 仮想 PK 列追加で回避」と spec で除外宣言、`bud_attendance` の `(employee_id, target_month)` のような構成は実装フェーズで cleanup する方針が明確。

#### RLS Policy（02-rls-policy §4.1）

**案 A**: `get_table_pk_column(text)` 補助関数 + `can_user_view_record` から呼出。

```sql
CREATE OR REPLACE FUNCTION get_table_pk_column(p_table text) RETURNS text
  LANGUAGE plpgsql IMMUTABLE
  SET search_path = pg_catalog, public, pg_temp
AS $$ ... CASE p_table WHEN 'bud_transfers' THEN 'transfer_id' ... ELSE 'id' END; $$;

REVOKE ALL ON FUNCTION get_table_pk_column(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_table_pk_column(text) TO authenticated;
...
v_pk_column := get_table_pk_column(p_table);
IF v_pk_column !~ '^[a-z][a-z0-9_]{0,62}$' THEN
  RAISE EXCEPTION 'Invalid pk_column derived for table %: %' ... USING ERRCODE = '22023';
END IF;
EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I::text = $1)', p_table, v_pk_column)
  INTO v_can USING p_record_id;
```

**評価**:
- `LANGUAGE plpgsql IMMUTABLE` + `search_path` 固定で **plan キャッシュ可能 & search_path 攻撃耐性**。
- `CASE p_table WHEN ... END` の **ホワイトリスト式マッピング**は SQL injection 不可（`p_table` 自体は `v_allowed_tables` で既にホワイトリスト検証済、補助関数内でも識別子形式チェック）。case 不一致は `ELSE 'id'` に fallback、**`get_table_pk_column` の戻り値を `^[a-z][a-z0-9_]{0,62}$` で再検証**する念押しチェックも入っており多層防御。
- 動的 SQL は `format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I::text = $1)', p_table, v_pk_column)` で **テーブル名と PK 列名を両方とも `%I` でクオート**、`$1` プレースホルダで `record_id` 渡し → 私が初回レビューで指摘した「PK 列名のクオートが抜けてないか」も対応済。
- `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated` で 6 層防御の整合性維持。

**案 B**: 各 SELECT policy で実 PK 列名を直接記述。

```sql
-- bud_transfers の PK は 'transfer_id'（a-review #1 反映）
WHERE transfer_id::text = garden_change_history.record_id

-- soil_kanden_cases の PK は 'id'（標準命名）
WHERE id::text = garden_change_history.record_id
```

**評価**: **案 A と案 B のマッピングが 100% consistency**。両方とも `bud_transfers` → `transfer_id`、`soil_kanden_cases` → `id` で一致。spec のコメントで「01-data-model §4.1.2 マッピング表と同期」と明記され、改訂時の同期義務も明示。

---

#### テストケース Case 7-9（06-test-strategy §15.2）

| Case | 検証内容 | R1 担保 |
|---|---|---|
| 7 | 非標準 PK (`transfer_id`) で `to_jsonb` 抽出が正しく動作 | ✅ ハードコード回帰防止 |
| 8 | `TG_ARGV[1]` 不正識別子（`'INVALID PK NAME'`）が ERRCODE 22023 で REJECT | ✅ identifier バリデーション |
| 9 | PK 列不在時（`code` PK のテーブルに TG_ARGV[1] 省略）が ERRCODE 22023 で REJECT | ✅ 早期 REJECT |

**評価**:
- Case 7 は `INSERT` 後 `garden_change_history.record_id = v_test_id::text` を ASSERT、私が初回レビューで指摘した「Trigger 関数 INSERT 失敗で経理業務停止」シナリオの**正面からの回帰防止**。
- Case 8 / 9 は `EXCEPTION WHEN sqlstate '22023'` で REJECT を確認、ハッピーパス通過時に `RAISE EXCEPTION 'Test failed: ...'` を上げる「fail-loud」設計。
- §15.6 DoD に「Case 1 〜 9 がすべて PASS（CI 必須）」 + Case 7-9 個別箇条書きが追加されており、**マージ条件と回帰防止が紐付いている**。
- §15.3 でテスト実装場所 `pk-column-handling.test.sql` も指定、spec 実装時に迷わない構成。

---

## 🟢 加点要素 / 評価

1. **「`COALESCE` literal は実行時 evaluate 前に列不在エラーになる」問題の正確な理解**: コメント L183-184 に `NEW.id::text` の直接参照では実行時エラーが回避できない理由が明記、`to_jsonb` 経由を選択する根拠が spec 内で示されている（実装者教育的）。
2. **複合キー除外宣言**: 「複合キーテーブル（非対応）：サブテーブル化 or 仮想 PK 列追加で回避」と spec で明示、`bud_attendance` のような複合キーで Trigger を破壊しない安全側の設計判断。
3. **6 層防御の整合性維持**: 初回レビュー時の SQL injection 防御（テーブル / モジュール / identifier / DoS / search_path / PUBLIC）は維持しつつ、補助関数 `get_table_pk_column` の REVOKE / GRANT も同等に設定 → 6 層 → 7 層相当に強化。
4. **`COALESCE(NEW, OLD)` で DELETE 時の NEW=NULL を吸収**: `to_jsonb(COALESCE(NEW, OLD))->>v_pk_column` の組み立て順、INSERT/UPDATE は NEW、DELETE は OLD という挙動を1行で表現できている。
5. **「（仮、実装時確認）」コメント**: PK 列名が推測のテーブル（`call_id` / `period_id` / `item_id`）に明示注記、実装フェーズで confirm するチェックポイントを spec 内に埋め込み済。

---

## 📚 known-pitfalls 横断

- **#2 RLS anon 流用** ✅ Trigger は INVOKER、purge / can_user_view_record は SECURITY DEFINER + search_path 固定で OK
- **#6 garden_role CHECK 制約** ✅ `has_role_at_least()` 経由で抽象化（変更なし）
- **#8 deleted_at vs is_active** ✅ §4.3 で SOFT_DELETE / RESTORE 特別扱い（変更なし）
- 新規 pitfall 候補: 「Trigger 関数で `NEW.<col>::text` 直接参照禁止、`to_jsonb(COALESCE(NEW, OLD))->>v_col` パターン使用」を **known-pitfalls.md に追記推奨**（次セッションで他モジュール Trigger 設計時に参照されるべき）

---

## 🟡 残留事項（マージブロッカーではない）

- **初回レビュー指摘 #3（権限閾値 root_settings 連携）**: 今回のスコープ外で OK。Phase 2 の cross-settings spec で正式対応するという初回判定どおり。`has_role_at_least('super_admin')` 等の literal 引数は本 PR では未対応 → **マージ後の Phase 2 で必ずフォロー**（GW デモまでは不要、Bud 経理権限変更要望が出た時点で着手）。
- **複合キーテーブルの将来対応**: spec で「サブテーブル化 or 仮想 PK 列追加で回避」と除外宣言は妥当だが、`bud_attendance(employee_id, target_month)` のような既存テーブルが今後 cross-history 対象になる場合、**仮想 `attendance_id`（既存 `(employee_id, target_month)` を sha1 / concat した GENERATED COLUMN）** 追加 spec が要る。Phase 2 の Bud 給与処理 spec で同期検討。

---

## 🚦 判定

### ✅ APPROVE

**理由**:
- 初回レビューの **🔴 マージブロッカー 1 件が完全修正**（修正方針も初回推奨案 A と一致）
- Trigger 関数 / RLS policy / テスト の **3 spec 横断で整合性のある修正**
- Case 7-9 + DoD で **回帰防止が CI 担保**
- 残留事項（権限閾値 root_settings 連携 / 複合キー対応）はいずれも初回判定どおり Phase 2 スコープ

**マージ後フォロー**:
1. 🟡 Phase 2 で `has_role_at_least_for_action('history.purge')` 等の root_settings 連携 spec 化
2. 🟢 known-pitfalls.md に「Trigger 関数で `NEW.<col>::text` 直接参照禁止、`to_jsonb` 経由」追記
3. 🟢 PK 列名「（仮）」3 件（`call_id` / `period_id` / `item_id`）を実装時に confirm

🎯 重大度サマリ: 🔴 0 / 🟡 0 / 🟢 3（マージ後フォロー）

---

🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
