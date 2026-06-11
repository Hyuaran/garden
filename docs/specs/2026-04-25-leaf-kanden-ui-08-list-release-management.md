# Leaf 関電 UI #08: 営業リスト解放管理（アポ禁・期切替）

- 対象: 営業リストの解放制御 + 4 ヶ月毎の期切替時のアポ禁出力
- 優先度: **🟡 中**（営業統制の中核機能）
- 見積: **1.5d 実装** / 0.3d spec
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 13 Leaf 関電 UI #08）
- 前提:
  - Soil 営業リスト（253 万件、Phase D で詳細）
  - `soil_kanden_cases` の見込み案件
  - admin 権限による解放実行

---

## 1. 目的とスコープ

### 目的

営業リストを「いつ」「誰が」「どのリストを」解放できるかを admin が制御し、**4 ヶ月毎の期変わりで見込みアポ禁を一括出力**する仕組みを構築する。リスト × 案件の関連付けを期跨ぎでも維持。

### 含める

- 営業リスト解放テーブル（`bud_kanden_list_release`）
- アポ禁テーブル（`bud_kanden_apokin`）
- 期切替実行 UI（admin 専用）
- 解放対象リストの選択
- アポ禁一括登録
- リスト × 案件の関連付け管理（期跨ぎ対応）
- 解放履歴の追跡

### 含めない

- Soil 側のリスト管理基盤（Soil Phase D で別途）
- アポイント取得 UI（既存 Tree 連携）

---

## 2. 概念整理

### 2.1 「期」（けせ）の定義

- 4 ヶ月単位の営業サイクル
- 例:
  - 第 1 期: 4-7 月
  - 第 2 期: 8-11 月
  - 第 3 期: 12-3 月

### 2.2 「アポ禁」とは

- アポ取得済の顧客に**再度アプローチしない**よう、営業リストから除外
- 期間限定（次の 4 ヶ月）
- 期切替時に再度アプローチ可能化（または継続アポ禁登録）

### 2.3 「リスト解放」とは

- admin が「このリストは今期で営業可能」と判断
- 営業担当者が架電可能になる
- 解放されていないリストはアクセス不可

---

## 3. データモデル

### 3.1 `bud_kanden_periods`（期マスタ）

```sql
CREATE TABLE bud_kanden_periods (
  period_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_code         text UNIQUE NOT NULL,    -- '2026Q1' / '2026Q2' / '2026Q3'
  period_name         text NOT NULL,           -- '2026 第 1 期'
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  is_current          boolean NOT NULL DEFAULT false,
  CONSTRAINT chk_period_dates CHECK (end_date > start_date)
);

-- 1 期だけが is_current = true
CREATE UNIQUE INDEX idx_bkp_current ON bud_kanden_periods (is_current) WHERE is_current = true;
```

### 3.2 `bud_kanden_list_release`（リスト解放管理）

```sql
CREATE TABLE bud_kanden_list_release (
  release_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id           uuid NOT NULL REFERENCES bud_kanden_periods(period_id),

  -- リスト識別（Soil 側の list_id 参照）
  list_id             uuid NOT NULL,
  list_name           text NOT NULL,            -- スナップショット
  list_count          int,                       -- リスト件数

  -- 解放状態
  release_status      text NOT NULL CHECK (release_status IN (
    'not_released',     -- 未解放
    'released',         -- 解放中
    'paused',           -- 一時停止
    'closed'            -- 期終了
  )) DEFAULT 'not_released',

  released_at         timestamptz,
  released_by         text REFERENCES root_employees(employee_number),
  release_reason      text,

  -- 制限
  released_to_employees uuid[],   -- 解放対象社員（NULL = 全員）

  -- 統計
  call_count          int NOT NULL DEFAULT 0,
  case_count          int NOT NULL DEFAULT 0,    -- 案件化数

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bklr_period ON bud_kanden_list_release (period_id, release_status);
CREATE UNIQUE INDEX idx_bklr_unique ON bud_kanden_list_release (period_id, list_id);
```

### 3.3 `bud_kanden_apokin`（アポ禁マスタ）

```sql
CREATE TABLE bud_kanden_apokin (
  apokin_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 禁止対象
  customer_phone      text NOT NULL,
  customer_name       text,

  -- 期間
  effective_period_id uuid NOT NULL REFERENCES bud_kanden_periods(period_id),
  effective_until     date NOT NULL,

  -- 由来
  source_case_id      uuid REFERENCES soil_kanden_cases(case_id),
  source_period_id   uuid REFERENCES bud_kanden_periods(period_id),
  reason             text NOT NULL CHECK (reason IN (
    'appointment_obtained',  -- アポ取得済
    'cancellation',          -- 顧客キャンセル
    'do_not_call',           -- DNC リクエスト
    'staff_decision'         -- スタッフ判断
  )),

  registered_at       timestamptz NOT NULL DEFAULT now(),
  registered_by       text REFERENCES root_employees(employee_number),

  -- 解除
  cancelled_at        timestamptz,
  cancelled_by        text REFERENCES root_employees(employee_number),
  cancellation_reason text,

  CONSTRAINT chk_until_after_now CHECK (effective_until > registered_at::date)
);

CREATE INDEX idx_bka_phone_active ON bud_kanden_apokin (customer_phone)
  WHERE cancelled_at IS NULL;
CREATE INDEX idx_bka_period ON bud_kanden_apokin (effective_period_id);
```

### 3.4 リスト × 案件の関連付け（期跨ぎ対応）

既存 `soil_kanden_cases` テーブルに関連付け列追加:

```sql
ALTER TABLE soil_kanden_cases
  ADD COLUMN IF NOT EXISTS source_list_id uuid,           -- 元リスト
  ADD COLUMN IF NOT EXISTS source_period_id uuid REFERENCES bud_kanden_periods(period_id);
```

期切替時もこの紐付けは維持され、過去案件のトレース可能。

---

## 4. admin 制御画面

### 4.1 期マスタ管理（`/leaf/kanden/admin/periods`）

```
┌──────────────────────────────────────────────────┐
│ 期管理（admin 専用）                                │
│                                                  │
│ ┌──────────────────────────────────────────┐  │
│ │ 期      期間          状態      操作       │  │
│ │ 2026Q1  2026/04-07  ✅ 進行中  [編集]       │  │
│ │ 2026Q2  2026/08-11  📅 予定    [編集][有効]│  │
│ │ 2026Q3  2026/12-03  📅 予定                │  │
│ │ 2025Q3  2025/12-03  📁 終了    [履歴]       │  │
│ │                                            │  │
│ │ [新規期を作成]                              │  │
│ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

#### 期切替実行

```
┌──────────────────────────────────────┐
│ 期切替の実行                          │
│                                      │
│ 現在: 2026 Q1（4-7 月）               │
│ 切替先: 2026 Q2（8-11 月）            │
│                                      │
│ ⚠️ 切替実行で以下が起こります:        │
│ - 2026Q1 のすべてのリスト解放を停止    │
│ - 2026Q1 の見込みアポ案件を 2026Q2     │
│   のアポ禁マスタに自動登録            │
│ - 2026Q2 が is_current = true に切替  │
│                                      │
│ 影響件数:                             │
│ - 解放停止: 12 リスト                  │
│ - アポ禁登録: 425 件                   │
│                                      │
│ ☐ 確認しました                        │
│ [キャンセル]  [期切替を実行]          │
└──────────────────────────────────────┘
```

### 4.2 リスト解放管理（`/leaf/kanden/admin/list-release`）

```
┌──────────────────────────────────────────────────┐
│ リスト解放（admin 専用）                          │
│ 期: 2026 Q2 ▼                                    │
│                                                  │
│ ┌──────────────────────────────────────────┐  │
│ │ ☐ リスト名         件数    状態       操作  │  │
│ │ ☐ 2025 春 大阪市   12,500  未解放  [解放] │  │
│ │ ☑ 2025 夏 茨木市   8,200   ✅ 解放中  [停止]│  │
│ │ ☑ 2025 秋 高槻市   6,100   ✅ 解放中       │  │
│ │ ☐ 2024 春 全域     45,000  📁 終了        │  │
│ │                                            │  │
│ │ [一括解放]  [一括停止]                       │  │
│ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

#### 部分解放（特定社員のみ）

```
┌──────────────────────────────────────┐
│ リスト解放: 2025 春 大阪市             │
│                                      │
│ 解放対象:                             │
│ ● 全員                                 │
│ ○ 特定社員のみ                         │
│   [従業員選択 → モーダル]               │
│                                      │
│ 解放理由:                             │
│ [新規開拓キャンペーン...        ]      │
│                                      │
│ [キャンセル]  [解放実行]               │
└──────────────────────────────────────┘
```

---

## 5. アポ禁マスタ管理（`/leaf/kanden/admin/apokin`）

### 5.1 一覧

```
┌──────────────────────────────────────────────────┐
│ アポ禁マスタ                                      │
│                                                  │
│ 期: 2026 Q2 ▼  ステータス: [すべて ▼]            │
│ 検索: [          ]                               │
│                                                  │
│ ┌──────────────────────────────────────────┐  │
│ │ 顧客名      電話番号       理由      登録日 │  │
│ │ 山田太郎   080-1234-5678   アポ取得  4/15  │  │
│ │ 佐藤花子   090-2345-6789   キャンセル 4/20 │  │
│ │ ...                                        │  │
│ └──────────────────────────────────────────┘  │
│                                                  │
│ 全 425 件                                         │
│ [新規追加] [CSV エクスポート] [Excel 出力]        │
└──────────────────────────────────────────────────┘
```

### 5.2 アポ禁の自動判定

新規リスト架電時に Tree 側で照合:

```sql
SELECT EXISTS (
  SELECT 1 FROM bud_kanden_apokin
  WHERE customer_phone = :phone
    AND effective_period_id = (SELECT period_id FROM bud_kanden_periods WHERE is_current)
    AND cancelled_at IS NULL
    AND effective_until >= today
);
```

該当時は架電前に警告表示:

```
⚠️ この顧客はアポ禁登録されています
理由: アポ取得済（2026Q1 で取得）
有効期限: 2026/11/30
このまま架電しますか？
[キャンセル] [強制架電]
```

### 5.3 一括登録（期切替時）

期切替実行時に自動的に:

1. 前期の **見込みアポ案件**（`status` が `awaiting_*` 系）を抽出
2. `bud_kanden_apokin` に新期 ID で一括 INSERT
3. 重複チェック（同電話番号で既存登録あり → スキップ）

---

## 6. 営業担当の画面

### 6.1 解放リスト一覧（`/leaf/kanden/lists`）

営業が見える画面:

```
┌──────────────────────────────────────────────────┐
│ 営業リスト（あなたの担当）                          │
│ 期: 2026 Q2                                       │
│                                                  │
│ ┌──────────────────────────────────────────┐  │
│ │ リスト名         件数  進捗      操作       │  │
│ │ 2025 夏 茨木市   8,200 ███░ 65%  [架電]  │  │
│ │ 2025 秋 高槻市   6,100 █░ 12%  [架電]   │  │
│ │ 2025 冬 守口市   3,500 ░░ 0%   [架電]   │  │
│ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 6.2 自分のアポ禁件数表示

マイページに「現期のアポ禁件数」を表示:

```
🚫 アポ禁: あなた由来 12 件 / 全社 425 件
```

---

## 7. RLS

### 7.1 期マスタ

```sql
-- 全員が SELECT 可
CREATE POLICY bkp_select_all ON bud_kanden_periods FOR SELECT
  USING (leaf_user_in_business('kanden') AND is_user_active());

-- 編集は admin のみ
CREATE POLICY bkp_all_admin ON bud_kanden_periods FOR ALL
  USING (has_role_at_least('admin'));
```

### 7.2 リスト解放

```sql
-- 営業: 解放されたリストのみ SELECT
CREATE POLICY bklr_select_for_sales ON bud_kanden_list_release FOR SELECT
  USING (
    release_status = 'released'
    AND leaf_user_in_business('kanden')
    AND is_user_active()
    AND (
      released_to_employees IS NULL
      OR auth_employee_number() = ANY (released_to_employees)
    )
  );

-- admin: 全件
CREATE POLICY bklr_all_admin ON bud_kanden_list_release FOR ALL
  USING (has_role_at_least('admin'));
```

### 7.3 アポ禁マスタ

```sql
-- 全員が SELECT 可（架電前に判定が必要）
CREATE POLICY bka_select_all ON bud_kanden_apokin FOR SELECT
  USING (leaf_user_in_business('kanden') AND is_user_active());

-- 登録は staff+
CREATE POLICY bka_insert_staff ON bud_kanden_apokin FOR INSERT
  WITH CHECK (has_role_at_least('staff'));

-- 解除は manager+
CREATE POLICY bka_update_manager ON bud_kanden_apokin FOR UPDATE
  USING (has_role_at_least('manager'));
```

---

## 8. 期切替バッチ

### 8.1 トリガー

- admin が「期切替を実行」ボタンを押下
- または Cron で自動実行（4 ヶ月境界、admin 設定可）

### 8.2 処理フロー

```ts
async function executePeriodTransition(fromPeriodId: string, toPeriodId: string) {
  await supabase.rpc('begin_transaction');
  try {
    // 1. 前期のリスト解放を停止
    await supabase.from('bud_kanden_list_release')
      .update({ release_status: 'closed' })
      .eq('period_id', fromPeriodId);

    // 2. 前期の見込みアポを抽出
    const { data: pendingCases } = await supabase.from('soil_kanden_cases')
      .select('case_id, customer_name, customer_phone')
      .eq('source_period_id', fromPeriodId)
      .in('status', ['awaiting_entry', 'submitted'])
      .is('deleted_at', null);

    // 3. アポ禁に一括 INSERT（重複は ON CONFLICT で skip）
    const apokinRows = pendingCases.map(c => ({
      customer_phone: c.customer_phone,
      customer_name: c.customer_name,
      effective_period_id: toPeriodId,
      effective_until: new Date('2026-11-30'),
      source_case_id: c.case_id,
      source_period_id: fromPeriodId,
      reason: 'appointment_obtained',
      registered_by: '<admin_id>',
    }));
    await supabase.from('bud_kanden_apokin').upsert(apokinRows, {
      onConflict: 'customer_phone,effective_period_id',
      ignoreDuplicates: true,
    });

    // 4. 期切替
    await supabase.from('bud_kanden_periods')
      .update({ is_current: false })
      .eq('period_id', fromPeriodId);
    await supabase.from('bud_kanden_periods')
      .update({ is_current: true })
      .eq('period_id', toPeriodId);

    // 5. 監査ログ
    await auditLog({
      event: 'kanden.period.transition',
      data: { from: fromPeriodId, to: toPeriodId, apokin_count: apokinRows.length }
    });

    await supabase.rpc('commit_transaction');
    return { success: true, apokin_added: apokinRows.length };
  } catch (e) {
    await supabase.rpc('rollback_transaction');
    throw e;
  }
}
```

### 8.3 切替後の対応

- Chatwork 通知（管理者全員に「2026Q1 → 2026Q2 切替完了、アポ禁 425 件追加」）
- ロードマップポップアップで現期表示更新

---

## 9. 実装ステップ

1. **Step 1**: 4 つのテーブル migration（periods / list_release / apokin / soil 列追加）+ RLS（2h）
2. **Step 2**: 期マスタ管理 admin UI（1.5h）
3. **Step 3**: リスト解放管理 admin UI（2h）
4. **Step 4**: アポ禁マスタ管理 admin UI（1.5h）
5. **Step 5**: 期切替バッチ（PG 関数）+ admin UI（2h）
6. **Step 6**: 営業画面のリスト一覧 + アポ禁照合（1.5h）
7. **Step 7**: マイページのアポ禁件数表示（0.5h）
8. **Step 8**: Excel/CSV エクスポート + Chatwork 通知（1h）
9. **Step 9**: 結合テスト（1h）

**合計**: 約 **1.5d**（約 13h）

---

## 10. テスト観点

- 期作成・編集・有効化
- 1 期のみ is_current=true 制約
- リスト解放・停止・部分解放
- アポ禁の自動判定（架電前警告）
- 期切替実行の冪等性（同期間 2 回実行 → 重複なし）
- 期切替時の見込みアポ抽出
- アポ禁の重複登録スキップ
- 期切替後のロードマップ表示更新
- RLS: 営業の解放されていないリスト非表示
- 期跨ぎの案件 source_period_id 維持

---

## 11. 判断保留事項

- **判1: 1 期の長さ**
  - 4 ヶ月固定 / カスタマイズ可
  - **推定スタンス**: 4 ヶ月固定（業務サイクル）、カスタマイズは Phase 2
- **判2: アポ禁の有効期限**
  - 1 期間 / 2 期間 / 永続
  - **推定スタンス**: 1 期間（次の 4 ヶ月）、特殊ケースは admin で延長
- **判3: 期切替の自動 / 手動**
  - Cron 自動 / admin 手動実行
  - **推定スタンス**: admin 手動（重要操作）、Cron 通知のみ
- **判4: アポ禁の継続更新**
  - 期切替で自動継続 / 都度判断
  - **推定スタンス**: 都度判断（admin が個別に延長指示）
- **判5: リスト解放の制限粒度**
  - 全員 / 部署 / 個別社員
  - **推定スタンス**: 個別社員選択可（既定は全員）
- **判6: 強制架電の権限**
  - 全員可 / staff+ / manager+
  - **推定スタンス**: staff+（営業判断、ログ記録）
- **判7: 期切替の影響件数事前表示**
  - 必須 / オプション
  - **推定スタンス**: 必須（誤操作防止）
- **判8: アポ禁解除の理由必須化**
  - 必須 / 任意
  - **推定スタンス**: 必須（監査・追跡性）

---

## 12. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| migration（4 テーブル + RLS）| 2.0h |
| 期マスタ管理 UI | 1.5h |
| リスト解放管理 UI | 2.0h |
| アポ禁マスタ UI | 1.5h |
| 期切替バッチ + UI | 2.0h |
| 営業画面 + アポ禁判定 | 1.5h |
| マイページ統合 | 0.5h |
| エクスポート + 通知 | 1.0h |
| 結合テスト | 1.0h |
| **合計** | **1.5d**（約 13h）|

---

— spec-leaf-kanden-ui-08 end —
