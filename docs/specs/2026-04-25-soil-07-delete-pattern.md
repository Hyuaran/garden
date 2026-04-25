# Soil #07: 削除パターン（横断統一規格に準拠）

- 対象: Garden-Soil 全テーブルの削除運用（論理 / 物理 / 復元 / UNDO）
- 優先度: **🔴 最高**（コール履歴は永続保持、リストは状態遷移）
- 見積: **0.25d**（横断規格を踏襲、Soil 固有のルール調整のみ）
- 担当セッション: a-soil（実装）/ a-main（横断整合）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #07）
- 前提:
  - **`docs/specs/2026-04-25-cross-history-delete-04-delete-pattern.md`**（横断統一規格、最優先）
  - `docs/specs/2026-04-25-cross-history-delete-01-data-model.md`
  - `docs/specs/2026-04-25-soil-01-list-master-schema.md`
  - `docs/specs/2026-04-25-soil-02-call-history-schema.md`
  - `docs/specs/2026-04-26-cross-ops-05-data-retention.md`（保持期間 / アーカイブ）

---

## 1. 目的とスコープ

### 1.1 目的

Garden 全モジュールで合意された**削除パターン統一規格**（Cross History #04）を Soil に適用する。Soil 固有の事情（コール履歴は永続保持 / リストは状態遷移管理）を反映した上で、誤削除防止と業務継続性を担保する。

### 1.2 含めるもの

- Soil 各テーブルの削除規格（論理 / 物理 / 復元 / UNDO）
- コール履歴の「削除しない」原則と、それでも誤入力を扱う方法
- リスト統合（merge）の特殊扱い
- 削除権限の階層
- 監査ログとの連動

### 1.3 含めないもの

- 削除規格そのものの設計 → Cross History #04
- 法令保持期間 → Cross Ops #05
- 削除 UI の共通コンポーネント → Cross History #04

---

## 2. 横断規格の要点（再掲）

### 2.1 3 段階の削除

| 段階 | 操作 | 権限 | DB 状態 |
|---|---|---|---|
| 1: 論理削除 | 通常削除 | 全員可（業務範囲内）| `deleted_at = now()` |
| 2: 復元 | 論理削除を取消 | manager+ | `deleted_at = NULL` |
| 3: 物理削除 | 完全消去 | admin / super_admin | レコード DELETE |

### 2.2 共通 UI

- `<DeleteButton>` / `<DeletedBadge>` / `<UndoSnackbar>` / `<RestoreButton>`
- UNDO snackbar 5 秒
- 削除済バッジで一覧に残す（誤操作の認識性）

---

## 3. Soil 各テーブルの削除パターン

### 3.1 `soil_lists`

| 段階 | 動作 | 権限 |
|---|---|---|
| 論理削除 | `deleted_at = now()` 設定 | manager+ |
| 復元 | `deleted_at = NULL` 設定 | manager+ |
| 物理削除 | レコード DELETE | super_admin のみ |

#### 制約

- **case_count > 0 のリストは論理削除のみ**（紐付き Leaf 案件があるため）
- 物理削除は **法定保持期間経過後（Cross Ops #05）かつ全 Leaf 案件が物理削除済**

### 3.2 `soil_call_history`

| 段階 | 動作 | 権限 |
|---|---|---|
| 論理削除 | **不可**（戦略書 判 2、コール履歴は永続保持）| — |
| 訂正 | `is_billable = false` + memo に取消理由 | 自分の架電は 24h 以内 / admin+ はいつでも |
| 物理削除 | 例外的に admin+ のみ（誤入力等）| admin / super_admin |

#### 「削除」の代わりに「無効化」

```sql
UPDATE soil_call_history
SET
  is_billable = false,
  memo = COALESCE(memo, '') || ' [取消: ' || $reason || ']',
  updated_at = now()
WHERE id = $id;

INSERT INTO operation_logs (
  user_id, module, action, target_type, target_id, details
) VALUES (
  auth.uid(), 'soil', 'call_invalidate', 'soil_call_history', $id::text,
  jsonb_build_object('reason', $reason, 'previous_is_billable', true)
);
```

集計から除外されるが、レコードは残る。

### 3.3 `soil_list_tags`

| 段階 | 動作 | 権限 |
|---|---|---|
| 論理削除 | **行いずに物理削除**（タグは関係性のみ、復元概念なし）| 全員（自分が付けたタグ）/ manager+（他人のタグ）|
| 物理削除 | レコード DELETE | 同上 |

#### 制約

- タグの「履歴」は `operation_logs` に記録される
- 同じタグを再付与すれば「復元」と同等
- UI に UNDO snackbar 5 秒 → 直後に再追加可能

### 3.4 `soil_list_imports`

| 段階 | 動作 | 権限 |
|---|---|---|
| 論理削除 | 不要（参照履歴として保持）| — |
| 物理削除 | super_admin のみ、関連 `soil_lists` がすべて物理削除済の場合のみ | super_admin |

### 3.5 `soil_lists_merge_proposals`

| 段階 | 動作 | 権限 |
|---|---|---|
| 論理削除 | `status = 'rejected'` で代替（DELETE しない）| manager+ |
| 物理削除 | 1 ヶ月後に Cron で自動物理削除 | service_role |

---

## 4. リスト統合（merge）の扱い

### 4.1 「削除」ではなく「統合」

```
旧 soil_lists A
  ↓ merge 操作
新 soil_lists B（残る）
  + A.merged_into_id = B.id
  + A.status = 'merged'
  + A.deleted_at は NULL のまま（merge は削除ではない）
```

A は表示から除外されるが、レコードは残る（参照履歴として）。

### 4.2 merge と論理削除の関係

| ケース | 動作 |
|---|---|
| A を merge → B（A.status='merged'） | A は閲覧可（admin+ のみ）、検索結果から除外 |
| A を merge → B、後に A を論理削除 | A.status='merged' AND A.deleted_at IS NOT NULL（二重状態）|
| 統合の解除（merge 取消）| A.merged_into_id = NULL に戻す。B 側の関連 leaf_*.soil_list_id を A に戻す手順あり |

### 4.3 merge 解除の難しさ

- B 側に新規追加されたデータが残る → 完全に元に戻せない
- 対策: merge 操作を **物理削除と同等の慎重さ**で扱う、24h 以内のみ取消可

---

## 5. 削除権限と監査

### 5.1 SQL 権限（RLS と並行）

```sql
-- 物理 DELETE は super_admin のみ
GRANT DELETE ON soil_lists TO authenticated;
-- ただし RLS で実質的に super_admin に制限
ALTER TABLE soil_lists FORCE ROW LEVEL SECURITY;

CREATE POLICY soil_lists_delete_super_admin
  ON soil_lists FOR DELETE
  TO authenticated
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
      = 'super_admin'
  );
```

### 5.2 監査ログ

すべての削除・復元・物理削除を `operation_logs` に記録:

```sql
INSERT INTO operation_logs (
  user_id, module, action, target_type, target_id, details, occurred_at
) VALUES (
  auth.uid(),
  'soil',
  'logical_delete' | 'restore' | 'physical_delete' | 'merge' | 'merge_undo',
  'soil_lists' | 'soil_call_history' | ...,
  $target_id::text,
  jsonb_build_object('reason', $reason, ...),
  now()
);
```

### 5.3 物理削除の事前チェック

```sql
-- soil_lists 物理削除前
WITH preconditions AS (
  SELECT
    sl.id,
    sl.deleted_at IS NOT NULL AS is_logically_deleted,
    sl.deleted_at < now() - interval '5 years' AS retention_passed,
    NOT EXISTS (SELECT 1 FROM leaf_kanden_cases WHERE soil_list_id = sl.id)
      AND NOT EXISTS (SELECT 1 FROM leaf_hikari_cases WHERE soil_list_id = sl.id)
      -- ... 他 Leaf
      AS no_active_cases
  FROM soil_lists sl
  WHERE sl.id = $1
)
SELECT
  is_logically_deleted AND retention_passed AND no_active_cases
    AS can_physically_delete
FROM preconditions;
```

3 条件すべて true なら物理削除可。

---

## 6. UI 観点（横断統一規格に従う）

### 6.1 一覧画面での削除済表示

```
┌─────────────────────────┐
│ 田中商店  📞080-...      │
│ 工場照明 / 大阪府        │
│                         │
│ 山田工務店 🗑️削除済      │ ← DeletedBadge
│ 飲食 / 京都府            │
└─────────────────────────┘
```

### 6.2 削除確認モーダル

```
┌─────────────────────────────┐
│ リストを削除しますか？        │
│                             │
│ 山田工務店（電話: 080-...）   │
│                             │
│ ⚠️ このリストには関電案件が    │
│  3 件紐付いています。         │
│  削除すると案件も非表示に     │
│  なります。                  │
│                             │
│  理由（任意）:                │
│  [____________________]     │
│                             │
│  [キャンセル] [削除する]      │
└─────────────────────────────┘
```

### 6.3 UNDO snackbar

```
┌──────────────────────────────────┐
│ ✓ 山田工務店 を削除しました   [元に戻す]  │ ← 5 秒間表示
└──────────────────────────────────┘
```

### 6.4 復元（admin / manager 用）

`/soil/lists/deleted` で削除済一覧 → `<RestoreButton>`

---

## 7. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `soil_lists.deleted_at` カラム追加（#01 で既定済）| a-soil | 0 |
| 2 | 論理削除 / 復元 Server Action | a-soil | 0.5h |
| 3 | 物理削除前のチェック関数 | a-soil | 0.5h |
| 4 | コール履歴の「無効化」UI + Server Action | a-soil + a-tree | 0.5h |
| 5 | 監査ログ統合 | a-soil | 0.25h |
| 6 | 削除済一覧 UI（`/soil/lists/deleted`）| a-soil | 0.5h |
| 7 | テスト（権限境界 + 紐付き案件あり時の警告）| a-soil | 0.5h |

合計: 約 2.75h ≈ 0.25d（横断 UI コンポーネントは流用）

---

## 8. 既知のリスクと対策

### 8.1 リスト削除の業務影響

- `soil_lists` 削除 → Tree の架電中タップで「リストが見つかりません」
- 対策: 架電中は `deleted_at IS NULL` のみセグメント化、Tree 側で削除済を予期しない

### 8.2 コール履歴の「削除したい」要求

- 業務側から「明らかな誤架電は消したい」要望あり
- 対策: `is_billable = false` で集計除外、admin+ にのみ物理削除許可（極稀ケース）

### 8.3 merge の取り消し漏れ

- 24h 経過後の取消は不可
- 対策: merge 確認モーダルで「24h 以内のみ取消可」を明示、慎重操作を促す

### 8.4 物理削除前提チェックの抜け

- 紐付き Leaf があるのに物理削除実行
- 対策: §5.3 の preconditions 関数を Server Action で必ず呼ぶ、未通過なら拒否

### 8.5 タグ削除のスパム

- staff が他人のタグを大量削除
- 対策: 自分が付けたタグのみ削除可（manager+ 以外）

### 8.6 削除済データへの参照漏れ

- 案件詳細で「リスト名: 山田工務店」と表示中、リスト論理削除 → 表示が崩れる
- 対策: case 側に snapshot（list_name_at_creation 等）を持つ or 削除済バッジ表示

---

## 9. 関連ドキュメント

- `docs/specs/2026-04-25-cross-history-delete-04-delete-pattern.md`
- `docs/specs/2026-04-25-cross-history-delete-01-data-model.md`
- `docs/specs/2026-04-25-cross-history-delete-03-sidebar-component.md`
- `docs/specs/2026-04-25-soil-01-list-master-schema.md`
- `docs/specs/2026-04-25-soil-02-call-history-schema.md`
- `docs/specs/2026-04-25-soil-06-rls-design.md`
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`
- memory: `project_delete_pattern_garden_wide`

---

## 10. 受入基準（Definition of Done）

- [ ] `soil_lists` の論理削除 / 復元 / 物理削除が動作（権限境界 OK）
- [ ] `soil_call_history` の「無効化」UI + 監査ログが動作
- [ ] `soil_list_tags` の物理削除 + UNDO snackbar 5 秒動作
- [ ] merge 操作と論理削除の二重状態を扱えることをテスト
- [ ] 物理削除前提チェック関数（§5.3）が動作、未通過時に拒否
- [ ] 監査ログに削除・復元・物理削除がすべて記録
- [ ] 削除済一覧 UI（`/soil/lists/deleted`）が manager+ で動作
- [ ] Cross History #04 の共通コンポーネント（`<DeleteButton>` 等）流用確認
- [ ] Soil CLAUDE.md に削除運用を追記
