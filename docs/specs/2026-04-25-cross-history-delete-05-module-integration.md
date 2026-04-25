# Cross History #05: モジュール統合ガイド（9 モジュール retrofit）

- 対象: Cross History #01-04 を 9 モジュールへ統合する手順
- 優先度: **🔴 高**（既存実装への影響大、慎重実施）
- 見積: **0.3d** spec / 各モジュール統合は別工数
- 担当セッション: a-main + 各モジュール（a-leaf / a-bud / a-tree / a-root / a-forest / a-bloom / a-soil / a-rill / a-seed）
- 作成: 2026-04-25（a-auto 002 / Batch 14 Cross History #05）
- 前提:
  - Cross History #01-04
  - 各モジュールの既存実装

---

## 1. 目的とスコープ

### 目的

`garden_change_history` 基盤と削除パターン共通コンポーネントを 9 モジュールへ統合、retrofit 作業の workload と順序を明確化。

### 含める

- 9 モジュールの retrofit 作業量見積
- migration 順序
- 既存データへの影響範囲
- 詳細ページへの `<ChangeHistorySidebar>` 配置手順
- 削除ボタンの retrofit 手順
- 既実装モジュールの追加対応計画

### 含めない

- データモデル詳細（#01）
- UI 詳細（#03）
- テスト（#06）

---

## 2. モジュール別の retrofit 作業量

### 2.1 概要

| モジュール | 主要テーブル数 | retrofit 工数 | 既実装状況 |
|---|---|---|---|
| **Bud** | 5（transfers / meisai / salary / nenmatsu 等）| **1.5d** | 振込 a-bud 実装中 |
| **Leaf 関電** | 4（cases / files / questions / external）| **1.0d** | Phase C 起草済 |
| **Root** | 6（employees / orgs / roles 等）| **1.5d** | Phase A 実装中 |
| **Tree** | 3（sessions / records / assignments）| **0.7d** | Phase D 起草済 |
| **Forest** | 5（fiscal / tax / hankanhi 等）| **1.0d** | Phase A 実装済 |
| **Bloom** | 3（reports / kpis / dashboards）| **0.5d** | 未実装 |
| **Soil** | 2（lists / call_histories）| **0.5d** | 未実装 |
| **Rill** | 1（messages）| **0.3d** | 未実装 |
| **Seed** | 1-N | **0.3d** | 未実装 |

**合計**: 約 **7.0d**（並列化なし）

### 2.2 並列化可能性

- 各モジュールは独立、並列実装可
- a-auto + 各モジュールセッションで 1 週間程度で完了可能

---

## 3. retrofit 作業の標準手順

### 3.1 各モジュールの 5 ステップ

```
Step 1: テーブルに Trigger 適用
  - garden_change_history 用 Trigger を ALTER TABLE で追加
  - 既存データへの影響: なし（INSERT のみ）

Step 2: 詳細ページに <ChangeHistorySidebar> 配置
  - 既存 layout を `flex` で右側スペース確保
  - prop 渡し（module / tableName / recordId）

Step 3: 削除ボタンを <DeleteButton> に置換
  - 既存 onClick → onDelete prop
  - 確認モーダル削除（DeleteButton 内蔵）

Step 4: 一覧画面に <DeletedBadge> 表示
  - WHERE 句から `deleted_at IS NULL` を条件付きに変更
  - レンダー時に削除済を判定

Step 5: テスト
  - 既存テスト動作確認
  - 履歴記録の確認
  - 削除・UNDO・復元の動作
```

### 3.2 既存テーブルへの Trigger 適用例

```sql
-- 既存 bud_transfers への適用
CREATE TRIGGER bud_transfers_history_v2
  AFTER INSERT OR UPDATE OR DELETE ON bud_transfers
  FOR EACH ROW EXECUTE FUNCTION trg_record_change_history('bud');

-- 既存 deleted_at 列確認（なければ追加）
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text REFERENCES root_employees(employee_number);
```

---

## 4. モジュール別の詳細

### 4.1 Bud

#### 対象テーブル

- `bud_transfers`（振込）
- `bud_meisai`（明細）
- `bud_salary_records`（給与）
- `bud_nenmatsu_chousei`（年末調整、Batch 11）
- `bud_gensen_choshu`（源泉徴収票、Batch 11）

#### 特殊事項

- マイナンバー列を **PII リスト** 登録（暗号化）
- 確定済（finalized_at）レコードは履歴の改ざん検知重要
- 振込実行済の論理削除は manager+

#### 工数

- Trigger 適用: 0.5d
- UI 統合（5 画面）: 0.7d
- テスト: 0.3d
- 計 1.5d

### 4.2 Leaf 関電

#### 対象テーブル

- `soil_kanden_cases`
- `soil_kanden_cases_files`
- `soil_kanden_questions`（Batch 13 #04）
- `soil_kanden_external_requests`（Batch 13 #04）

#### 特殊事項

- 大量データ（253 万件）のため、過去データへの Trigger 適用は不要（INSERT 後の変更のみ記録）
- 削除済バッジは検索結果（Batch 13 #01）でも表示

#### 工数

- Trigger 適用: 0.3d
- UI 統合（一覧 + 詳細）: 0.5d
- テスト: 0.2d
- 計 1.0d

### 4.3 Root

#### 対象テーブル

- `root_employees`
- `root_organizations`
- `root_departments`
- `root_roles`
- `root_attendance`（KoT、変更頻度高）
- `root_salary_systems`

#### 特殊事項

- 個人情報多 → PII 列リスト登録充実
- KoT 取込（root_attendance）は自動化、`source = 'system'` で記録
- 退職者の個人情報は **特別マスキング**

#### 工数

- Trigger 適用: 0.5d
- UI 統合（マイページ + admin）: 0.7d
- テスト: 0.3d
- 計 1.5d

### 4.4 Tree

#### 対象テーブル

- `tree_calling_sessions`（Batch 9）
- `tree_call_records`（月数十万件、高頻度）
- `tree_agent_assignments`

#### 特殊事項

- `tree_call_records` は月 50 万件以上、**履歴量極大**
- パーティショニング必須（#01 §5）
- 結果コード変更のみ記録、duration_sec / called_at の変更は無視

#### 工数

- Trigger 適用 + パーティション: 0.4d
- UI 統合: 0.2d
- テスト: 0.1d
- 計 0.7d

### 4.5 Forest

#### 対象テーブル

- `forest_fiscal_periods`
- `forest_company_taxes`
- `forest_hankanhi`
- `forest_yakuin_houshu`

#### 特殊事項

- 既に audit_logs 連携あり
- 履歴は経営層のみ閲覧（部長以上）

#### 工数

- Trigger 適用: 0.3d
- UI 統合: 0.5d
- テスト: 0.2d
- 計 1.0d

### 4.6 Bloom

#### 対象テーブル

- `bloom_reports`
- `bloom_kpis`
- `bloom_dashboards`

#### 特殊事項

- KPI は計算結果、変更頻度低
- 削除はほぼ発生しない

#### 工数: **0.5d**

### 4.7 Soil

#### 対象テーブル

- `soil_call_lists`（253 万件、初回取込時）
- `soil_call_histories`（335 万件）

#### 特殊事項

- 初回取込時の Trigger は **無効化推奨**（一括 INSERT、履歴記録不要）
- 通常運用後は有効化

#### 工数: **0.5d**

### 4.8 Rill

#### 対象テーブル

- `rill_messages`（Chatwork 連携）

#### 特殊事項

- メッセージ送信は INSERT のみ、UPDATE 少
- 履歴量は中程度

#### 工数: **0.3d**

### 4.9 Seed

#### 対象テーブル

- 新事業枠、商材により異なる

#### 特殊事項

- Phase 初期は最小実装

#### 工数: **0.3d**

---

## 5. migration 順序の提案

### 5.1 段階的展開

```
Phase 1（M3 前 = 2026-06）:
  └─ 共通基盤実装
      ├─ garden_change_history テーブル
      ├─ Trigger 共通関数
      ├─ RLS ポリシー
      └─ 共通 React コンポーネント

Phase 2（M3）:
  └─ 軽量モジュール先行
      ├─ Rill（0.3d）
      ├─ Seed（0.3d）
      ├─ Soil（0.5d）
      └─ Bloom（0.5d）

Phase 3（M3-M4）:
  └─ 中規模モジュール
      ├─ Tree（0.7d）
      ├─ Forest（1.0d）
      └─ Leaf 関電（1.0d）

Phase 4（M4）:
  └─ 大型モジュール（最後、慎重に）
      ├─ Bud（1.5d）
      └─ Root（1.5d）
```

### 5.2 検証期間

各 Phase 完了後、**2 週間の検証期間**を確保:

- 履歴記録の正確性
- パフォーマンス影響
- ユーザー UX

問題なければ次 Phase へ進行。

---

## 6. 既存データへの影響分析

### 6.1 履歴データのバックフィル

既存データに対して**過去履歴を遡って生成しない**:

- 理由: コスト・パフォーマンス影響大
- 代わりに: 「Trigger 適用日時より前のデータは履歴なし」を UI で明示

```
このレコードの履歴は 2026-06-01 以降のみ表示されています
```

### 6.2 deleted_at 列の追加

既存テーブルに `deleted_at` がない場合:

```sql
ALTER TABLE <table>
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text REFERENCES root_employees(employee_number);
```

既存データは `deleted_at IS NULL`（生存）、影響なし。

### 6.3 RLS 変更

既存 RLS ポリシーに `deleted_at IS NULL` を追加（必要に応じて）:

```sql
-- 例: bud_transfers の SELECT
DROP POLICY bt_select ON bud_transfers;
CREATE POLICY bt_select ON bud_transfers FOR SELECT
  USING (
    /* 既存条件 */
    -- deleted_at IS NULL は UI 側で判定（削除済バッジ表示のため）
  );
```

ポリシーは `deleted_at IS NULL` を**含めない**、UI 側で表示制御。

---

## 7. 詳細ページへの統合パターン

### 7.1 標準レイアウト

```tsx
// 各モジュール詳細ページ
<div className="flex h-screen">
  <main className="flex-1 overflow-auto">
    {/* 既存の詳細表示 */}
  </main>
  <ChangeHistorySidebar
    module="bud"
    tableName="bud_transfers"
    recordId={params.id}
    recordTitle={`振込 #${transferNumber}`}
  />
</div>
```

### 7.2 削除ボタンの retrofit

```tsx
// Before:
<button onClick={() => handleDelete(id)}>削除</button>

// After:
<DeleteButton
  recordId={id}
  recordName={`振込 #${transferNumber}`}
  onDelete={() => handleDelete(id)}
  permissionLevel="all"
/>
```

### 7.3 一覧画面への DeletedBadge

```tsx
// Before:
{rows.map(row => <Row data={row} />)}

// After:
{rows.map(row => (
  <Row data={row}>
    {row.deleted_at && <DeletedBadge deletedAt={row.deleted_at} deletedBy={row.deleted_by} />}
  </Row>
))}
```

---

## 8. 既実装モジュールの retrofit 計画

### 8.1 Bud 振込（a-bud 進行中）

- a-bud に Cross History 統合タスクを追加発注
- Phase 1b の振込実装完了後、Phase 1c で履歴統合

### 8.2 Root マスタ（a-root 進行中）

- 同上、Phase A-3 完了後に履歴統合

### 8.3 Leaf A-1c

- Leaf 関電 Phase C 実装と並行

### 8.4 統合計画書

各モジュールセッションに以下を提示:

```
【横断履歴・削除パターン統合のお願い】

Batch 14 で Cross History 仕様が確定しました。
以下の手順で既存実装に統合してください:

1. docs/specs/2026-04-25-cross-history-delete-{01-06}.md を読む
2. テーブルに Trigger 適用
3. 詳細ページに <ChangeHistorySidebar> 配置
4. 削除ボタンを <DeleteButton> に置換
5. 一覧に <DeletedBadge> 表示
6. テスト実行

工数: <モジュール別>d
完了後: docs/effort-tracking.md に記録
```

---

## 9. 段階的展開のリスク管理

### 9.1 性能影響

- 各 Phase 完了後に **EXPLAIN ANALYZE** で性能確認
- Trigger オーバーヘッド > 100ms なら最適化検討

### 9.2 ユーザー混乱

- 各 Phase で **使い方ガイド**（マニュアル）を更新
- ロードマップポップアップ（Batch 13 #05）でリリース通知

### 9.3 ロールバック計画

- 各 Phase で問題発生時、該当モジュールの Trigger を `DISABLE TRIGGER` で一時停止
- 履歴データは保持、UI 側で「履歴記録一時停止中」を明示

---

## 10. 実装ステップ（spec 起草）

1. **Step 1**: 9 モジュールの工数見積詳細化（0.5h）
2. **Step 2**: 段階的展開計画（0.5h）
3. **Step 3**: 既存データ影響分析（0.5h）
4. **Step 4**: 各モジュールの統合手順テンプレ（1h）
5. **Step 5**: 既実装モジュールの retrofit 計画書（0.5h）

**合計**（spec 起草）: 約 **0.3d**（約 3h）

---

## 11. 判断保留事項

- **判1: 段階的展開の Phase 数**
  - 4 段階 / 2 段階 / 一括
  - **推定スタンス**: 4 段階（リスク分散、検証期間確保）
- **判2: 過去履歴のバックフィル**
  - 一切しない / 限定的 / 完全
  - **推定スタンス**: 一切しない（コスト > メリット）
- **判3: 検証期間の長さ**
  - 1 週間 / 2 週間 / 1 ヶ月
  - **推定スタンス**: 2 週間（リスク管理 + 進行速度）
- **判4: モジュール並列実装の限度**
  - 1 セッション 1 モジュール / 並列可
  - **推定スタンス**: 並列可（独立性高）
- **判5: 既存テーブル名規約の互換性**
  - そのまま / 命名統一の機会に変更
  - **推定スタンス**: そのまま（変更コスト > 美しさ）
- **判6: 退職者データの取扱**
  - 削除済バッジ表示 / 完全マスク / 物理削除
  - **推定スタンス**: 削除済バッジ + 個人情報マスク

---

## 12. 実装見込み時間の内訳（spec 起草）

| 作業 | 見込 |
|---|---|
| 9 モジュール工数見積 | 0.5h |
| 段階的展開計画 | 0.5h |
| 既存データ影響分析 | 0.5h |
| 統合手順テンプレ | 1.0h |
| retrofit 計画書 | 0.5h |
| **合計（spec）** | **0.3d**（約 3h）|

実際の retrofit 実装は別途、各モジュール 0.3-1.5d 計 7d 程度。

---

— spec-cross-history-05 end —
