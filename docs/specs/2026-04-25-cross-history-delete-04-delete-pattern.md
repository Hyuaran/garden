# Cross History #04: Garden 全モジュール削除パターン統一

- 対象: Garden 全モジュールの削除仕様（論理 / 物理 / 復元 / UNDO）
- 優先度: **🔴 最高**（誤操作防止、業務継続性）
- 見積: **0.4d**
- 担当セッション: a-main + 各モジュール
- 作成: 2026-04-25（a-auto 002 / Batch 14 Cross History #04）
- 前提:
  - memory: project_delete_pattern_garden_wide.md
  - Cross History #01-03

---

## 1. 目的とスコープ

### 目的

Garden 全モジュールで**統一された削除規格**を定義、誤削除防止・復元容易性・監査性を担保。論理削除と物理削除を明確に分離、UNDO 機能で誤操作の即時復旧を可能にする。

### 含める

- 論理削除 / 物理削除 / 復元 の規格
- 共通 UI コンポーネント 4 種
- 削除済バッジ表示ルール
- UNDO snackbar 5 秒
- 削除権限の階層（全員 → manager → admin → super_admin）

### 含めない

- 履歴記録（#01-02）
- UI 詳細（#03）
- モジュール統合（#05）

---

## 2. 削除パターンの 3 段階

### 2.1 段階別の定義

| 段階 | 操作 | 権限 | DB 状態 |
|---|---|---|---|
| **1: 論理削除** | 通常削除 | **全員可**（業務スコープ内）| `deleted_at = now()` |
| **2: 復元** | 論理削除を取消 | manager+ | `deleted_at = NULL` |
| **3: 物理削除** | 完全消去 | **admin / super_admin のみ** | レコード DELETE |

### 2.2 設計思想

**Kintone の「削除済」管理を改善**:

- Kintone は削除済が同テーブルに残り、検索・集計時にフィルタが必要 → 負荷集中
- Garden では `deleted_at IS NULL` を **デフォルト RLS** で除外、必要時のみ表示

### 2.3 削除済バッジの可視化

- 一覧画面では削除済も表示（**🗑️ 削除済** バッジ付き）
- 誤操作時の認識性向上（「あ、消した！」が見える）
- フィルタで非表示も可能（既定: 表示）

---

## 3. 共通 UI コンポーネント

### 3.1 `<DeleteButton>`

```tsx
type DeleteButtonProps = {
  onDelete: () => Promise<void>;
  recordId: string;
  recordName: string;          // 「案件 #001 山田太郎」等
  permissionLevel: 'all' | 'manager+' | 'admin+';
  reason?: 'logical' | 'physical';   // 既定 'logical'
  confirmRequired?: boolean;    // 既定 true
  cascade?: boolean;            // 関連レコード警告（既定 false）
};
```

#### 動作

```
クリック
  ↓
権限チェック（不可なら disabled）
  ↓
確認モーダル（recordName 込み）
  ↓
理由入力（任意、change_reason に保存）
  ↓
削除実行（onDelete）
  ↓
UNDO snackbar 5 秒表示
```

### 3.2 `<DeletedBadge>`

```tsx
type DeletedBadgeProps = {
  deletedAt: string | Date;
  deletedBy?: string;
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
};

// 表示例:
// 🗑️ 削除済 (2026-04-25 山田太郎)
```

- 一覧テーブル / カード / 詳細ページのヘッダーに表示
- ホバーで詳細ツールチップ（理由・削除者）

### 3.3 `<UndoSnackbar>`

```tsx
type UndoSnackbarProps = {
  message: string;
  onUndo: () => Promise<void>;
  duration?: number;    // 既定 5000ms
};

// 例: 表示 5 秒、ユーザーが UNDO をクリックで復元
```

#### 動作

```
削除直後
  ↓
画面下部に snackbar 表示
  ↓
[UNDO] ボタンクリック → 5 秒以内なら復元成功
  ↓
5 秒経過 or 別操作 → snackbar 消失（UNDO 不可）
  ↓
（その後復元したい場合は通常の RestoreActions 経由）
```

#### UNDO 仕様

- **自分が削除した場合のみ** 表示
- 他人の削除は UNDO 表示なし（権限的に復元できないため）
- localStorage で「最後の論理削除」を一時保持、5 秒後自動クリア

### 3.4 `<RestoreActions>`

```tsx
type RestoreActionsProps = {
  recordId: string;
  module: string;
  tableName: string;
  permissionLevel: 'manager+' | 'admin+';
};

// 削除済レコードの詳細画面に表示:
// [♻️ 復元する] [❌ 完全削除（admin のみ）]
```

#### 動作

- **復元**: manager+ がクリック、確認モーダル後に `deleted_at = NULL`
- **完全削除**: admin+ のみ、確認モーダル + admin パスワード再入力で物理 DELETE

---

## 4. 削除済バッジ表示ルール

### 4.1 一覧画面

```
┌──────────────────────────────────┐
│ [🗑️ 削除済] 案件 #001  山田太郎  │ ← 灰色背景 + 取消線
│            ステータス: 完了        │
├──────────────────────────────────┤
│ 案件 #002  佐藤花子               │ ← 通常表示
│            ステータス: 進行中      │
└──────────────────────────────────┘
```

### 4.2 詳細画面

```
┌──────────────────────────────────────┐
│ [🗑️ 削除済] 案件 #001 山田太郎       │
│ 削除者: 山田太郎  削除日: 4/25 14:30 │
│ 理由: 重複案件                        │
│                                      │
│ [♻️ 復元する]                         │
└──────────────────────────────────────┘
```

詳細画面で削除済の場合:

- ヘッダーに大きく「削除済」バッジ
- 編集系ボタンを **disabled**（読み取り専用）
- 復元ボタンを表示（権限あり時）
- ChangeHistorySidebar も削除イベントが目立つ表示

### 4.3 リスト UI のフィルタ

```
表示モード:
○ 通常表示（削除済は薄く表示）
○ 削除済を含めて表示（既定）
○ 削除済のみ表示
○ 削除済を除外
```

### 4.4 検索結果への含め方

検索（Batch 13 #01 等）も削除済を含める:

- 削除済バッジで識別可能
- フィルタで除外可能

---

## 5. UNDO snackbar の詳細

### 5.1 ライブラリ

`sonner`（Batch 7 §5 で採用予定）の Toast を活用:

```tsx
import { toast } from 'sonner';

async function handleSoftDelete(recordId: string) {
  await softDelete(recordId);
  toast(
    '案件を削除しました',
    {
      duration: 5000,
      action: {
        label: '元に戻す',
        onClick: () => restore(recordId),
      },
    }
  );
}
```

### 5.2 視覚デザイン

```
┌──────────────────────────────────────────┐
│ 🗑️ 案件 #001 を削除しました    [元に戻す] │  ← 5 秒で消失
└──────────────────────────────────────────┘
```

- 画面下部中央 / 右下
- ダーク背景 + 白文字
- アクション ボタンはアクセント色

### 5.3 連続削除時の扱い

複数件を連続削除した場合:

```
┌──────────────────────────────────────────┐
│ 🗑️ 3 件を削除しました         [元に戻す] │
└──────────────────────────────────────────┘
```

最後の操作のみ UNDO 可能。

### 5.4 制限

- 5 秒以内のみ UNDO 可
- 5 秒経過後は通常の `<RestoreActions>` 経由
- 物理削除には UNDO なし（復元不可能、慎重操作）

---

## 6. 削除権限の階層

### 6.1 業務スコープ内（事業者全員）

- 通常案件の **論理削除**: 業務スコープ内なら全員可
- 例: 関電業務委託に従事する staff/toss/closer/cs/outsource

### 6.2 manager+

- 自部署の **論理削除レコードを復元**

### 6.3 admin

- 全モジュール論理削除 / 復元 / **物理削除**
- マイナンバー等機密の復号

### 6.4 super_admin

- admin と同等
- 履歴の保存期間経過分の **purge 関数実行**

### 6.5 設定可能性

`project_configurable_permission_policies.md` 準拠:

- 各モジュール / オブジェクトごとに権限閾値を設定可
- 例: 「Bud 振込の論理削除は staff+」と admin が設定可能

---

## 7. cascade 削除の扱い

### 7.1 関連レコードの考慮

例: 関電案件削除 → 関連添付ファイル / 質問・回答 / 関電依頼 履歴 がある場合

### 7.2 推奨方針

- **論理削除**: 親のみ削除、子は残す（`deleted_at IS NULL` 維持）
- **物理削除**: 子も連動削除（CASCADE）
- 削除前に **影響範囲を表示**:

```
案件 #001 を削除します。

関連レコード:
- 添付ファイル: 5 件
- 質問・回答: 3 件
- 関電依頼: 1 件

論理削除では、関連レコードは削除されません。
物理削除では、関連レコードも削除されます（admin 権限のみ）。

[論理削除] [物理削除（admin）] [キャンセル]
```

---

## 8. 一括削除

### 8.1 一括削除の制限

- **最大 100 件まで**（誤操作防止）
- 100 件超は admin 権限 + 確認モーダル
- 一括は論理削除のみ、物理は個別操作

### 8.2 UI

```
☑ 案件 #001
☑ 案件 #002
☑ 案件 #003
...
（5 件選択中）

[選択した 5 件を削除]
```

### 8.3 実行時

- 1 トランザクション内で全件削除
- 失敗 1 件で全体ロールバック
- 完了後 UNDO snackbar（一括 UNDO 可）

---

## 9. 監査ログ連携

### 9.1 削除イベントの記録

`audit_logs` に以下を INSERT:

| 操作 | event_type | data |
|---|---|---|
| 論理削除 | `record.soft_delete` | `{ module, table, id, reason }` |
| 復元 | `record.restore` | `{ module, table, id, restored_by }` |
| 物理削除 | `record.physical_delete` | `{ module, table, id, deleted_by, reason }` |
| 一括削除 | `record.bulk_delete` | `{ module, table, ids[], count }` |

`garden_change_history` にも記録（#01 §4.3）。

### 9.2 物理削除の特別監査

```sql
INSERT INTO audit_logs (event_type, actor, data, severity) VALUES (
  'record.physical_delete',
  auth_employee_number(),
  jsonb_build_object(...),
  'high'   -- 重要度高
);
```

severity 'high' は admin への Chatwork 即時通知。

---

## 10. 実装ステップ

1. **Step 1**: 共通コンポーネント `<DeleteButton>`（1.5h）
2. **Step 2**: `<DeletedBadge>` + 表示ロジック（0.5h）
3. **Step 3**: `<UndoSnackbar>` + sonner 統合（1h）
4. **Step 4**: `<RestoreActions>` + 物理削除モーダル（1h）
5. **Step 5**: 一括削除 UI + バリデーション（1h）
6. **Step 6**: cascade 影響範囲表示（1h）
7. **Step 7**: 監査ログ連携（0.5h）
8. **Step 8**: 結合テスト（1h）

**合計**: 約 **0.4d**（約 7.5h）

---

## 11. 判断保留事項

- **判1: 削除権限の既定値**
  - 全員可 / staff+ / role 別カスタム
  - **推定スタンス**: 業務スコープ内全員可（事業スコープ運用準拠）
- **判2: UNDO snackbar の duration**
  - 5 秒 / 10 秒 / カスタム
  - **推定スタンス**: 5 秒（標準的、誤操作の即時取消に十分）
- **判3: 削除済の検索結果含め方**
  - 既定含める / 既定除外 / ユーザー設定
  - **推定スタンス**: 既定含める（誤削除認識）
- **判4: cascade 削除の自動 / 警告**
  - 自動連動 / 警告のみ / 確認必須
  - **推定スタンス**: 警告 + 確認必須（誤連動防止）
- **判5: 一括削除の上限**
  - 100 件 / 500 件 / 無制限（admin のみ）
  - **推定スタンス**: 100 件、admin で 500 件
- **判6: 物理削除の確認手順**
  - パスワード再入力 / 2 段階確認 / admin 通知
  - **推定スタンス**: パスワード再入力 + admin 即時通知
- **判7: 削除理由の必須化**
  - 必須 / 任意
  - **推定スタンス**: 任意（業務効率優先）、admin 設定で必須化可能

---

## 12. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| DeleteButton | 1.5h |
| DeletedBadge | 0.5h |
| UndoSnackbar + sonner | 1.0h |
| RestoreActions + 物理削除 | 1.0h |
| 一括削除 UI | 1.0h |
| cascade 表示 | 1.0h |
| 監査連携 | 0.5h |
| 結合テスト | 1.0h |
| **合計** | **0.4d**（約 7.5h）|

---

— spec-cross-history-04 end —
