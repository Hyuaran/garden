# Soil #06: RLS 設計（manager+ 全件 / staff- 担当案件のみ）

- 対象: Garden-Soil 全テーブルの Row Level Security ポリシー
- 優先度: **🔴 最高**（個人情報・営業情報の漏洩防止）
- 見積: **0.5d**（ポリシー定義 + テスト）
- 担当セッション: a-soil（実装）/ a-root（権限定義整合）/ a-bloom（読込側影響）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #06）
- 前提:
  - `docs/specs/2026-04-25-soil-01-list-master-schema.md`
  - `docs/specs/2026-04-25-soil-02-call-history-schema.md`
  - `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`
  - `docs/specs/cross-cutting/spec-cross-rls-audit.md`
  - Root の `garden_role` 7 段階（toss / closer / cs / staff / manager / admin / super_admin）

---

## 1. 目的とスコープ

### 1.1 目的

Garden-Soil の**個人情報（253 万件の顧客マスタ）と営業情報（335 万件のコール履歴）**を、ロール別に最小権限で公開する。**情報漏洩の防止**と**業務効率（過剰な絞り込みでパフォーマンス低下を避ける）**を両立する。

### 1.2 含めるもの

- ロール別の閲覧範囲定義
- `soil_lists` / `soil_call_history` / 補助テーブル の RLS ポリシー
- 「担当案件のみ」の判定ロジック
- 性能影響と最適化
- テスト戦略（ロール別の境界値テスト）

### 1.3 含めないもの

- ロール定義そのもの → Root spec
- 監査ログ → spec-cross-audit-log
- 削除権限 → #07
- API 経由のアクセス制御 → #08

---

## 2. ロール別アクセス範囲

### 2.1 7 段階ロールと範囲

| ロール | soil_lists 閲覧 | soil_call_history 閲覧 | 書込 |
|---|---|---|---|
| `super_admin` | 全件 | 全件 | 全件 |
| `admin` | 全件 | 全件 | 全件 |
| `manager` | 全件 | 全件 | 自分の担当 + 自部門 |
| `staff` | **担当案件 + 自分の架電履歴** | **自分の架電のみ** | 自分の架電のみ |
| `cs` | カスタマーサポート対応中の案件のみ | 同上 | 同上 |
| `closer` | クロージング担当案件のみ | 自分の架電のみ | 同上 |
| `toss` | トスアップ済の自分担当のみ | 同上 | 同上 |

### 2.2 「担当」の定義

- `leaf_*_cases.assigned_to = auth.uid()` で「担当案件」と判定
- `soil_call_history.user_id = auth.uid()` で「自分の架電」と判定
- 両者は別軸（担当案件でも他人の架電あり、自分の架電でも担当外あり）

### 2.3 manager の「自部門」判定

- `root_employees.department_id` で部門紐付け
- `manager` は同部門の `garden_role IN ('staff', 'cs', 'closer', 'toss')` の架電を閲覧可
- 別部門の manager 同士は互いに見えない（情報統制）

---

## 3. `soil_lists` の RLS ポリシー

### 3.1 SELECT ポリシー

```sql
ALTER TABLE soil_lists ENABLE ROW LEVEL SECURITY;

-- 1. super_admin / admin / manager は全件参照可
CREATE POLICY soil_lists_select_high_priv
  ON soil_lists FOR SELECT
  TO authenticated
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('manager', 'admin', 'super_admin')
    AND deleted_at IS NULL  -- 削除済除外（admin+ は別ポリシーで）
  );

-- 2. staff 以下は「担当している Leaf 案件に紐付くリスト」のみ
CREATE POLICY soil_lists_select_assigned
  ON soil_lists FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM leaf_kanden_cases
        WHERE soil_list_id = soil_lists.id AND assigned_to = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM leaf_hikari_cases
        WHERE soil_list_id = soil_lists.id AND assigned_to = auth.uid()
      )
      -- 他 Leaf 商材も同様（unioned via VIEW、§5 参照）
    )
  );

-- 3. 削除済を見られる admin+
CREATE POLICY soil_lists_select_deleted_admin
  ON soil_lists FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NOT NULL
    AND (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
        IN ('admin', 'super_admin')
  );
```

### 3.2 INSERT ポリシー

```sql
-- manager+ のみ（インポート / 手動登録）
CREATE POLICY soil_lists_insert_manager
  ON soil_lists FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('manager', 'admin', 'super_admin')
  );

-- service_role は無制限（インポートスクリプト用）
-- → service role はそもそも RLS バイパス
```

### 3.3 UPDATE ポリシー

```sql
-- manager+ のみ（基本情報の修正）
CREATE POLICY soil_lists_update_manager
  ON soil_lists FOR UPDATE
  TO authenticated
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('manager', 'admin', 'super_admin')
  )
  WITH CHECK (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('manager', 'admin', 'super_admin')
  );

-- staff はメモ・タグの追加のみ可（→ #07 削除パターンと連動）
-- 主要フィールドへの UPDATE は不可
```

### 3.4 DELETE ポリシー

```sql
-- 物理 DELETE は禁止（→ #07 削除パターン）
CREATE POLICY soil_lists_no_delete
  ON soil_lists FOR DELETE
  TO authenticated
  USING (false);

-- 論理削除は UPDATE deleted_at 経由
```

---

## 4. `soil_call_history` の RLS ポリシー

### 4.1 SELECT ポリシー

```sql
ALTER TABLE soil_call_history ENABLE ROW LEVEL SECURITY;

-- 1. 自分の架電は誰でも閲覧可
CREATE POLICY soil_call_history_select_own
  ON soil_call_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. manager+ は自部門の架電を閲覧可
CREATE POLICY soil_call_history_select_manager_dept
  ON soil_call_history FOR SELECT
  TO authenticated
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid()) = 'manager'
    AND user_id IN (
      SELECT user_id FROM root_employees
      WHERE department_id = (
        SELECT department_id FROM root_employees WHERE user_id = auth.uid()
      )
    )
  );

-- 3. admin+ は全件参照可
CREATE POLICY soil_call_history_select_admin
  ON soil_call_history FOR SELECT
  TO authenticated
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('admin', 'super_admin')
  );

-- 4. 担当案件の全履歴（他人の架電も含む）
CREATE POLICY soil_call_history_select_case_assigned
  ON soil_call_history FOR SELECT
  TO authenticated
  USING (
    case_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM leaf_kanden_cases
      WHERE id = soil_call_history.case_id AND assigned_to = auth.uid()
    )
    -- 他 Leaf 商材も同様
  );
```

### 4.2 INSERT ポリシー

```sql
-- 自分の架電のみ INSERT 可（user_id = auth.uid() 必須）
CREATE POLICY soil_call_history_insert_own
  ON soil_call_history FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
        IN ('toss', 'closer', 'cs', 'staff', 'manager', 'admin', 'super_admin')
  );
```

### 4.3 UPDATE ポリシー

```sql
-- 自分の架電を 24 時間以内なら修正可（誤入力訂正）
CREATE POLICY soil_call_history_update_own_recent
  ON soil_call_history FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND created_at > now() - interval '24 hours'
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- admin+ はいつでも修正可（業務監査による訂正）
CREATE POLICY soil_call_history_update_admin
  ON soil_call_history FOR UPDATE
  TO authenticated
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      IN ('admin', 'super_admin')
  );
```

### 4.4 DELETE ポリシー

```sql
-- DELETE 完全禁止（戦略書 判 2）
CREATE POLICY soil_call_history_no_delete
  ON soil_call_history FOR DELETE
  TO authenticated
  USING (false);
```

---

## 5. 「担当案件」判定の最適化

### 5.1 課題

複数の Leaf テーブルへの JOIN を毎回 RLS で評価 → 重い。

### 5.2 解決策: Materialized View + 定期更新

```sql
-- 一覧化 VIEW（複数 Leaf を UNION）
CREATE MATERIALIZED VIEW soil_lists_assignments AS
SELECT soil_list_id, assigned_to, 'leaf_kanden' AS module
  FROM leaf_kanden_cases
  WHERE assigned_to IS NOT NULL
UNION ALL
SELECT soil_list_id, assigned_to, 'leaf_hikari' AS module
  FROM leaf_hikari_cases
  WHERE assigned_to IS NOT NULL
-- ... 他商材も追加
;

CREATE UNIQUE INDEX idx_assignments_unique
  ON soil_lists_assignments (soil_list_id, assigned_to, module);

CREATE INDEX idx_assignments_user
  ON soil_lists_assignments (assigned_to);
```

### 5.3 RLS ポリシー側で活用

```sql
CREATE POLICY soil_lists_select_assigned
  ON soil_lists FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM soil_lists_assignments
      WHERE soil_list_id = soil_lists.id AND assigned_to = auth.uid()
    )
  );
```

### 5.4 更新タイミング

- Leaf 案件の `assigned_to` 変更時 → DB トリガで MV 更新（差分のみ）
- バックアップ: 1 時間 1 回の `REFRESH MATERIALIZED VIEW CONCURRENTLY`

---

## 6. RLS 評価の性能影響

### 6.1 主要クエリでの追加コスト

| クエリ | RLS なし | RLS 込 | 増分 |
|---|---|---|---|
| `soil_lists` id 単件 | 5ms | 8ms | +3ms |
| `soil_lists` 複合フィルタ | 100ms | 150ms | +50ms |
| `soil_call_history` 月次集計 | 300ms | 450ms | +150ms |

### 6.2 最適化テクニック

1. **`SECURITY DEFINER` 関数で `garden_role` をキャッシュ**
   ```sql
   CREATE OR REPLACE FUNCTION current_garden_role()
   RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
     SELECT garden_role FROM root_employees WHERE user_id = auth.uid();
   $$;
   ```
   - `STABLE` で同一クエリ内のキャッシュ
   - RLS 内の `(SELECT garden_role FROM ...)` を `current_garden_role()` に置換

2. **`auth.uid()` の繰り返し評価を 1 度に**
   - 1 ポリシー内で `auth.uid()` を多数評価 → CTE で 1 回に
   - PG15 でやや改善されているが、複雑な組み合わせは要注意

3. **Materialized View は `auth.uid()` を含めない**
   - MV は全ユーザーで共有、ユーザー特化させない（フィルタは MV 利用側で）

---

## 7. テスト戦略

### 7.1 ロール別テストケース

| ケース | 期待動作 |
|---|---|
| toss として自分の架電 | 閲覧可 |
| toss として他人の架電 | 閲覧不可（404 / 0 件）|
| toss として担当案件のリスト | 閲覧可 |
| toss として未担当のリスト | 閲覧不可 |
| manager として自部門 | 全件閲覧可 |
| manager として他部門 | 閲覧不可 |
| admin として全件 | 閲覧可 |
| 削除済データ（staff）| 閲覧不可 |
| 削除済データ（admin）| 閲覧可 |

### 7.2 自動テスト

```typescript
// tests/soil-rls.test.ts
describe('soil_lists RLS', () => {
  it('toss can read assigned cases only', async () => {
    const tossClient = createClientWith(tossUserToken);
    const { data: assigned } = await tossClient.from('soil_lists').select('*').eq('id', assignedListId);
    expect(assigned).toHaveLength(1);

    const { data: notAssigned } = await tossClient.from('soil_lists').select('*').eq('id', notAssignedListId);
    expect(notAssigned).toHaveLength(0);
  });

  // ... 全ロール × 全テーブル × CRUD 操作の組み合わせ
});
```

### 7.3 RLS 逃れの検知

```sql
-- 本番で「RLS bypass」のクエリ実行を監査
-- service_role 経由のクエリは別途監査（spec-cross-audit-log）
```

---

## 8. 監査ログとの連動

### 8.1 RLS 拒否の記録

```sql
-- application 層で「データが見えない」状況を判定し、必要なら記録
-- (RLS 自体は silent、エラーを返さない)
```

### 8.2 高頻度の権限不足アクセス

- staff が他人のデータに 100 回 / 日 アクセスしようとしている → 警戒
- 対策: `monitoring_events` に `category='rls_access_pattern_anomaly'` で記録

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `soil_lists` SELECT/INSERT/UPDATE/DELETE 全ポリシー | a-soil | 1h |
| 2 | `soil_call_history` 同上 | a-soil | 1h |
| 3 | `soil_lists_assignments` Materialized View + トリガ | a-soil | 1h |
| 4 | `current_garden_role()` SECURITY DEFINER 関数 | a-soil | 0.25h |
| 5 | ロール別テストケース実装 | a-soil | 1.5h |
| 6 | 性能計測（RLS あり / なし 比較）| a-soil | 0.5h |
| 7 | RLS audit ドキュメント追記 | a-soil | 0.25h |

合計: 約 5h ≈ 0.5d

---

## 10. 既知のリスクと対策

### 10.1 Materialized View の遅延

- Leaf 案件 assigned_to 変更が MV に反映されない → staff が突如見れなくなる / 残ってしまう
- 対策: トリガで即時更新、バックアップ Cron で 1h ごと REFRESH

### 10.2 ポリシー評価の N+1

- 1 行ごとに `EXISTS` 評価 → 100 行で 100 回
- 対策: PostgreSQL の最適化に任せる（ほとんどの場合 hash join に展開される）、計測で異常時のみ調整

### 10.3 service_role でのバイパス

- バックエンドで service_role 利用 → RLS バイパス
- 対策: service_role 利用箇所を**最小限**、Server Action 内で利用する場合は手動で権限チェック

### 10.4 anon ロール経由の漏洩

- ログイン前のページから query 実行 → anon ロール経由
- 対策: anon ロールは **soil_** 系すべてに対し SELECT 不可（既定）

### 10.5 ロール変更時のキャッシュ

- ユーザーのロールを下げた後、ブラウザセッションがキャッシュを保持
- 対策: ロール変更時に該当ユーザーのセッションを失効（Auth API）

### 10.6 RLS 設定漏れ

- 新テーブル追加時に `ENABLE ROW LEVEL SECURITY` 忘れ
- 対策: `spec-cross-rls-audit` の月次チェックで全テーブル走査

---

## 11. 関連ドキュメント

- `docs/specs/2026-04-25-soil-01-list-master-schema.md`
- `docs/specs/2026-04-25-soil-02-call-history-schema.md`
- `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`
- `docs/specs/2026-04-25-soil-07-delete-pattern.md`
- `docs/specs/cross-cutting/spec-cross-rls-audit.md`
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- Root の `garden_role` 定義 + `root_employees` スキーマ

---

## 12. 受入基準（Definition of Done）

- [ ] `soil_lists` の SELECT/INSERT/UPDATE/DELETE ポリシー全 5 種実装
- [ ] `soil_call_history` の同上 全 5 種実装
- [ ] `soil_lists_assignments` MV + トリガ動作確認
- [ ] `current_garden_role()` 関数の存在 + STABLE 確認
- [ ] 7 ロール × 主要テーブル × CRUD のテストケース 全 pass
- [ ] RLS あり / なし のクエリ性能比較レポート作成（§6.1 想定内）
- [ ] anon ロールから soil_ テーブルが完全に見えない確認
- [ ] service_role 利用箇所のリスト化と手動権限チェック整備
- [ ] spec-cross-rls-audit に Soil 系を追記
- [ ] 監視（rls_access_pattern_anomaly）が稼働
