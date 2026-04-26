# Soil Phase B-06: RLS 詳細設計（8 段階ロール × 案件単位可視範囲）

- 対象: Garden-Soil 全テーブルの RLS、Phase B 実装着手版
- 優先度: **🔴 最高**（個人情報漏洩防止）
- 見積: **1.0d**
- 担当セッション: a-soil + a-root（ロール定義整合）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-06）
- 前提:
  - **Batch 16 Soil 基盤**（特に `2026-04-25-soil-06-rls-design.md`）
  - **Root A-3-g**（outsource ロール追加、既存 PR）
  - Cross Cutting `spec-cross-rls-audit`

---

## 1. 目的とスコープ

### 1.1 目的

Batch 16 で**RLS 基本設計**（7 ロール）は完了済。Phase B 実装着手版として、**8 段階ロール**（outsource 追加）と**案件単位の可視範囲制御**を詳細化する。

### 1.2 含めるもの

- 8 ロール定義（Root A-3-g 既存 PR 反映）
- ロール × テーブル × CRUD マトリックス
- outsource ロールの可視範囲（自分担当のみ）
- 案件単位可視範囲（MV `soil_lists_assignments`）
- MV REFRESH 戦略（即時トリガ + フェイルバック cron）
- `current_garden_role()` SECURITY DEFINER STABLE 関数
- service_role バイパスと監査
- 削除済データの可視範囲
- RLS テスト戦略

### 1.3 含めないもの

- Batch 16 既出の汎用 RLS 設計
- 検索性能 → B-04
- バックアップ → B-05
- 監視ダッシュボード → B-07

---

## 2. 8 段階ロール定義

| ロール | 階層 | 概要 |
|---|---|---|
| `super_admin` | 8 | 東海林さん 1 名、全権限 |
| `admin` | 7 | 経理・総務、全件閲覧 / 編集 / 物理削除 |
| `manager` | 6 | 部門長、自部門全件 |
| `outsource` | 5 | 業務委託、自分担当のみ + 限定機能 |
| `staff` | 4 | 社員一般、自分担当 + 一部社内情報 |
| `cs` | 3 | カスタマーサポート、対応中案件のみ |
| `closer` | 2 | クロージング、担当案件のみ |
| `toss` | 1 | トスアップ担当、トスアップ済自分分のみ |

階層が高いほど権限広い。

### 2.1 outsource の特殊性

- **業務委託契約者**（社員ではない）
- 自分が担当する案件のみ閲覧 / 操作
- カレンダー / Bloom / 他モジュールへのアクセスは限定
- 社内 PC 限定の対象（リモート不可）

### 2.2 staff- と manager+ の境界

- staff- = 担当ベース可視範囲（個別データ）
- manager+ = 部門 / 全社ベース可視範囲（集計含む）

---

## 3. ロール × テーブル × CRUD マトリックス

### 3.1 `soil_lists`

| ロール | SELECT | INSERT | UPDATE | DELETE（論理）| DELETE（物理）|
|---|---|---|---|---|---|
| super_admin | ✅ 全件 | ✅ | ✅ 全件 | ✅ | ✅ |
| admin | ✅ 全件 | ✅ | ✅ 全件 | ✅ | ✅ |
| manager | ✅ 全件 | ✅ | ✅ 全件 | ✅ | ❌ |
| outsource | ✅ 担当のみ | ❌ | ✅ メモ・タグのみ | ❌ | ❌ |
| staff | ✅ 担当のみ | ❌ | ✅ メモ・タグのみ | ❌ | ❌ |
| cs | ✅ 対応中のみ | ❌ | ✅ メモのみ | ❌ | ❌ |
| closer | ✅ 担当のみ | ❌ | ✅ メモのみ | ❌ | ❌ |
| toss | ✅ トスアップ済自分分 | ❌ | ❌ | ❌ | ❌ |

### 3.2 `soil_call_history`

| ロール | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| super_admin | ✅ 全件 | ✅ | ✅ 全件 | ✅ 物理 |
| admin | ✅ 全件 | ✅ | ✅ 全件 | ✅ 物理 |
| manager | ✅ 自部門 | ✅ | ✅ 24h 以内 | ❌ |
| outsource | ✅ 自分のみ | ✅ 自分のみ | ✅ 24h 以内 | ❌ |
| staff / cs / closer / toss | ✅ 自分のみ + 担当案件全 | ✅ 自分のみ | ✅ 24h 以内 | ❌ |

### 3.3 補助テーブル

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `soil_list_tags` | 全員（自リスト分）| 全員（自分が付ける）| 自分のみ | 自分のみ + manager+ 全件 |
| `soil_list_imports` | manager+ | service_role / admin | service_role | super_admin |
| `soil_lists_merge_proposals` | manager+ | service_role | manager+（status 変更）| 1 ヶ月後 cron 自動 |

---

## 4. outsource の可視範囲

### 4.1 ポリシー定義

```sql
-- soil_lists SELECT
CREATE POLICY soil_lists_select_outsource
  ON soil_lists FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND current_garden_role() = 'outsource'
    AND EXISTS (
      SELECT 1 FROM soil_lists_assignments
      WHERE soil_list_id = soil_lists.id
        AND assigned_to = auth.uid()
    )
  );
```

### 4.2 INSERT 不可

outsource は `soil_lists` への INSERT 不可（業務委託契約上、新規顧客作成権限なし）。コール履歴のみ INSERT 可。

### 4.3 UPDATE 制限

- メモ・タグのみ可
- 名前・住所・電話番号は不可（manager 管理）
- 試算: BEFORE UPDATE トリガで OLD/NEW 比較し、許可外列が変更されたら REJECT

### 4.4 ログ記録

outsource の SELECT も操作ログに記録（個人情報アクセスの監査）:

```sql
-- audit_log 自動記録（spec-cross-audit-log）
INSERT INTO operation_logs (user_id, module, action, target_type, target_id)
VALUES (auth.uid(), 'soil', 'read', 'soil_lists', soil_lists.id::text);
```

---

## 5. 案件単位可視範囲（MV `soil_lists_assignments`）

### 5.1 MV 構造（Batch 16 §5.2 既出）

```sql
CREATE MATERIALIZED VIEW soil_lists_assignments AS
SELECT soil_list_id, assigned_to, 'leaf_kanden' AS module, status
FROM leaf_kanden_cases
WHERE assigned_to IS NOT NULL AND deleted_at IS NULL
UNION ALL
SELECT soil_list_id, assigned_to, 'leaf_hikari' AS module, status
FROM leaf_hikari_cases
WHERE assigned_to IS NOT NULL AND deleted_at IS NULL
-- ... 他 Leaf 商材
;

CREATE UNIQUE INDEX idx_assignments_unique ON soil_lists_assignments
  (soil_list_id, assigned_to, module);
CREATE INDEX idx_assignments_user ON soil_lists_assignments (assigned_to);
CREATE INDEX idx_assignments_list ON soil_lists_assignments (soil_list_id);
```

### 5.2 RLS から参照

```sql
CREATE POLICY soil_lists_select_assigned
  ON soil_lists FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND current_garden_role() IN ('staff', 'closer', 'cs', 'toss', 'outsource')
    AND EXISTS (
      SELECT 1 FROM soil_lists_assignments
      WHERE soil_list_id = soil_lists.id
        AND assigned_to = auth.uid()
    )
  );
```

### 5.3 cs ロールの追加条件

cs は「対応中の案件のみ」 → MV に status='active' フィルタを `cs_active_assignments` 別 MV で持つ案も検討。

---

## 6. MV REFRESH 戦略

### 6.1 トリガ即時更新

```sql
-- leaf_kanden_cases assigned_to 変更時に MV 部分更新
CREATE OR REPLACE FUNCTION refresh_assignments_on_leaf_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- MV を完全 REFRESH ではなく、該当行だけ削除 → 挿入
  DELETE FROM soil_lists_assignments
  WHERE soil_list_id = OLD.soil_list_id
    AND assigned_to = OLD.assigned_to
    AND module = 'leaf_kanden';

  IF NEW.assigned_to IS NOT NULL AND NEW.deleted_at IS NULL THEN
    INSERT INTO soil_lists_assignments (soil_list_id, assigned_to, module, status)
    VALUES (NEW.soil_list_id, NEW.assigned_to, 'leaf_kanden', NEW.status);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_refresh_assignments_kanden
AFTER INSERT OR UPDATE OR DELETE ON leaf_kanden_cases
FOR EACH ROW EXECUTE FUNCTION refresh_assignments_on_leaf_change();
```

ただし Materialized View はトリガで部分更新できない（ベーステーブル UPDATE 不可）。代替案:

### 6.2 案 1: MV を通常テーブルに変更

`soil_lists_assignments` を通常テーブルとして実装、トリガで部分 INSERT/DELETE。

```sql
-- 通常テーブル化
CREATE TABLE soil_lists_assignments (
  soil_list_id uuid NOT NULL,
  assigned_to uuid NOT NULL,
  module text NOT NULL,
  status text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (soil_list_id, assigned_to, module)
);
```

これなら部分更新可能、推奨方式。

### 6.3 案 2: REFRESH CONCURRENTLY のみ

トリガなしで MV を CONCURRENTLY REFRESH。1h ごとの cron で十分なら採用可、ただし即時性ない。

### 6.4 採用: 通常テーブル + トリガ

- 即時更新でロール変更が即反映
- フェイルバック: 1h cron で全件突合 + 不整合検出 + 自動修復

---

## 7. `current_garden_role()` SECURITY DEFINER

### 7.1 関数定義

```sql
CREATE OR REPLACE FUNCTION current_garden_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT garden_role FROM root_employees WHERE user_id = auth.uid();
$$;

-- 実行権限
GRANT EXECUTE ON FUNCTION current_garden_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION current_garden_role() FROM PUBLIC;
```

### 7.2 STABLE と CACHE 効果

- `STABLE` = 同一クエリ内での結果を Postgres がキャッシュ
- 1 クエリ内で 100 行に対し 100 回呼ばれる場合 → 実際は 1 回のみ実行

### 7.3 SECURITY DEFINER のリスク

- 関数が定義者（postgres）の権限で実行 → search_path 経由の攻撃可能性
- 対策: `SET search_path = public` を必ず明記

### 7.4 RLS ポリシーでの利用

```sql
-- 簡潔に書ける
USING (current_garden_role() IN ('admin', 'super_admin'))
```

`(SELECT garden_role FROM root_employees WHERE user_id = auth.uid())` の繰り返しを排除。

---

## 8. service_role バイパスと監査

### 8.1 service_role 利用箇所

| 箇所 | 用途 | 監査 |
|---|---|---|
| Cron インポート | Kintone API → soil_lists 投入 | `soil_list_imports` 履歴 |
| MV REFRESH | 全件 SELECT + INSERT | 監査ログ不要（システム）|
| バックアップダンプ | 全件 SELECT | 監査ログ不要（システム）|
| migration 実行 | スキーマ変更 | git ログ + Supabase migrations |

### 8.2 service_role 利用の制限

- アプリ層（Server Action）からの service_role 呼出は**最小限**
- 通常の業務操作は authenticated client 経由
- service_role 用途を spec で明示、事前承認

### 8.3 監査ログの追加項目

```sql
-- service_role 経由の重要操作には明示的に audit
INSERT INTO operation_logs (
  user_id, module, action, details
) VALUES (
  NULL,  -- service_role
  'soil',
  'system_action',
  jsonb_build_object('cron_id', $1, 'rows_affected', $2)
);
```

---

## 9. 削除済データの可視範囲

### 9.1 ポリシー

| ロール | deleted_at IS NULL | deleted_at IS NOT NULL |
|---|---|---|
| super_admin / admin | ✅ | ✅（管理画面で閲覧）|
| manager | ✅ | ✅（自部門のみ）|
| その他 | ✅ | ❌ |

### 9.2 一覧画面での削除済表示

- 既定: 削除済を**表示しない**
- フィルタ「削除済を表示」で manager+ のみ表示
- 削除済バッジ 🗑️ で視覚識別

### 9.3 物理削除のフィルタ

物理削除は record そのものが消えるため RLS 不要。前段で「物理削除前の論理削除」を必須化（B-05 連動）。

---

## 10. RLS テスト戦略

### 10.1 テストマトリクス

8 ロール × 主要テーブル 6 種 × CRUD 4 = **192 ケース**

```typescript
describe('Soil RLS - 8 roles × 6 tables × 4 ops', () => {
  for (const role of ROLES) {
    for (const table of TABLES) {
      for (const op of OPS) {
        it(`${role} - ${table} - ${op}`, async () => {
          const client = createClientWithRole(role);
          const result = await performOp(client, table, op);
          expect(result.allowed).toBe(EXPECTED[role][table][op]);
        });
      }
    }
  }
});
```

### 10.2 境界値テスト

- 担当割当 → 解除直後の SELECT
- 削除直後の RLS（自分の操作 vs 他人の操作）
- 24h 経過後の UPDATE
- merged 状態のリスト参照

### 10.3 性能テスト

```sql
-- RLS あり vs なしの実行時間比較
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM soil_lists WHERE phone_primary = $1;
-- → RLS あり: 30ms / RLS なし: 20ms 想定（増分 10ms 許容）
```

---

## 11. 法令対応チェックリスト

### 11.1 個人情報保護法

- [ ] 第 23 条: 安全管理措置（最小権限の原則）
- [ ] 第 25 条: 委託先（outsource）の監督

### 11.2 関電業務委託契約

- [ ] outsource ロールの利用範囲が契約範囲内
- [ ] 監査ログで委託先のアクセスを追跡可能

---

## 12. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `current_garden_role()` 関数 | a-soil + a-root | 0.5h |
| 2 | `soil_lists_assignments` 通常テーブル化 + トリガ | a-soil | 1.5h |
| 3 | フェイルバック 1h cron（整合性検証 + 自動修復）| a-soil | 1h |
| 4 | `soil_lists` 全 RLS ポリシー（8 ロール × CRUD）| a-soil | 1.5h |
| 5 | `soil_call_history` 全 RLS ポリシー | a-soil | 1.5h |
| 6 | 補助テーブル RLS | a-soil | 0.5h |
| 7 | outsource UPDATE 列制限トリガ | a-soil | 0.5h |
| 8 | 192 ケース RLS テスト | a-soil | 2h |
| 9 | 性能比較計測 | a-soil | 0.5h |
| 10 | spec-cross-rls-audit に Soil 追記 | a-soil | 0.25h |

合計: 約 9.75h ≈ **1.0d**

---

## 13. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | `soil_lists_assignments` を MV vs 通常テーブル | **通常テーブル**（即時更新可、フェイルバック cron）|
| 判 2 | outsource の SELECT を audit 必須にするか | 必須（個人情報アクセス追跡）|
| 判 3 | cs ロールの「対応中」判定 | `leaf_*_cases.status IN ('active', 'pending')` |
| 判 4 | 24h UPDATE 制限の対象列 | 全列対象（admin+ は除く）|
| 判 5 | toss の「トスアップ済自分分」判定 | `tree_call_records.tossed_up_by = auth.uid()` |
| 判 6 | 削除済参照を manager に許可する範囲 | 自部門のみ（admin+ は全件）|
| 判 7 | 192 ケーステストの CI 統合 | 全ケース必須、PR 時間 5 分以内目標 |

---

## 14. 既知のリスクと対策

### 14.1 RLS パフォーマンス劣化

- 8 ポリシー × `EXISTS` 評価で重い
- 対策: `current_garden_role()` STABLE キャッシュ + assignments テーブル INDEX

### 14.2 トリガ無限ループ

- assignments テーブル更新が leaf テーブル更新を引き起こす
- 対策: assignments への直接更新のみ、leaf へ書き戻さない

### 14.3 anon ロール経由漏洩

- ログイン前のページから query → anon ロール
- 対策: anon は soil_* 全テーブル SELECT 不可（既定）

### 14.4 ロール変更直後のキャッシュ

- staff → outsource に降格、ブラウザに古い JWT 残存
- 対策: ロール変更時に該当ユーザー強制サインアウト

### 14.5 outsource UPDATE 列制限の抜け

- 名前など主要列を編集してしまう
- 対策: BEFORE UPDATE トリガで OLD/NEW 比較、許可外列差分で REJECT

### 14.6 service_role 過剰利用

- アプリ層で `supabaseAdmin` 多用 → RLS バイパス常態化
- 対策: `supabaseAdmin` 利用箇所を `eslint-no-restricted-imports` で限定

---

## 15. 関連ドキュメント

- `docs/specs/2026-04-25-soil-06-rls-design.md`（基本設計）
- `docs/specs/cross-cutting/spec-cross-rls-audit.md`
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- `docs/specs/2026-04-26-soil-phase-b-04-search-optimization.md`（性能影響）
- `docs/specs/2026-04-26-soil-phase-b-07-monitoring-alerting.md`（rls 違反監視）

---

## 16. 受入基準（Definition of Done）

- [ ] `current_garden_role()` SECURITY DEFINER STABLE 関数 実装
- [ ] `soil_lists_assignments` 通常テーブル + トリガ + フェイルバック cron
- [ ] `soil_lists` / `soil_call_history` / 補助テーブル の全 RLS ポリシー実装
- [ ] outsource UPDATE 列制限トリガが動作
- [ ] 8 ロール × 6 テーブル × 4 op = 192 ケーステスト全 pass
- [ ] RLS 性能（あり / なし）比較で増分 §16 §11 RLS allowed 範囲内
- [ ] anon ロールから soil_ 完全に見えない確認
- [ ] service_role 利用箇所のリスト + ESLint 制限
- [ ] spec-cross-rls-audit に Soil 系追記
- [ ] 192 ケーステストが PR CI で 5 分以内
