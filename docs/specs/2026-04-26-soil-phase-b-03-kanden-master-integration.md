# Soil Phase B-03: 関電リスト連携（Soil = master / Leaf 関電 = ミラー）

- 対象: Garden-Soil `soil_lists` と Garden-Leaf `leaf_kanden_cases` の master データ整合運用
- 優先度: **🟡 中**（既存稼働中の Leaf 関電と整合維持、ミス時影響大）
- 見積: **1.0d**
- 担当セッション: a-soil + a-leaf（実装）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-03）
- **改訂**: 2026-04-26（a-auto 011 / 東海林さん指摘で前提見直し、follow-up §1.2 大幅修正反映）
- 前提:
  - **Batch 16 Soil 基盤**（特に `2026-04-25-soil-03-kanden-list-integration.md` 境界線定義済）
  - **B-01 リストインポート Phase 1** 完了（Kintone 30 万件投入済）
  - 既存 Leaf 関電（`leaf_kanden_cases` 稼働中）
  - **確定ログ**: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`
  - **改訂指針**: `C:\garden\_shared\decisions\spec-revision-followups-20260426.md` §1.2

---

## 1. 目的とスコープ

### 1.1 目的

**Soil = single source of truth（master）/ Leaf 関電 = ミラー表示**の関係を明確化し、Soil ↔ Leaf 関電の整合運用を Phase B 実装着手版で定義する。Kintone App 55（74 fields、関西電力リスト一覧）からの差分同期、Soil 不在の Leaf 案件の早期検知、`supply_point_22`（電力供給地点 22 桁、不変 ID）を主キーとした正確なマッチングを担保。

### 1.2 設計の核心（東海林さん指摘で前提見直し、2026-04-26 改訂）

#### 概念図: Soil = master / Leaf 関電 = ミラー

```
┌─────────────────────────────────────────────────────────┐
│  Garden-Soil（顧客マスタ = single source of truth、30 万件）│
│  ┌─────────────────────────────────────────────────┐    │
│  │ soil_lists                                          │    │
│  │   id, supply_point_22 (UNIQUE),                     │    │
│  │   pd_number, old_pd_numbers (jsonb 履歴),           │    │
│  │   phone_primary, name_kanji, name_kana,             │    │
│  │   is_outside_list, source_channel                   │    │
│  └────────────────────┬─────────────────────────────┘    │
└────────────────────────│──────────────────────────────────┘
                         │ 1:N（顧客 → 案件）
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Garden-Leaf 関電（商材案件 = ミラー、数千〜万件）           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ leaf_kanden_cases                                   │    │
│  │   id, soil_list_id (NOT NULL FK), case_type,        │    │
│  │   pd_number (現行) / old_pd_number (旧履歴)         │    │
│  │   case_type: 'latest' | 'replaced' | 'makinaoshi' | │    │
│  │              'outside'                              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

【ルール】
- 全ての Leaf 関電案件は必ず Soil に対応（soil_list_id NOT NULL）
- 「Leaf 関電に存在 / Soil 不在」は設計上発生しない（バグ）
- リスト外（Kintone App 55 管理外）も Soil に登録（is_outside_list=true）
```

#### データフロー図

```
[Kintone App 55]                [営業飛び込み・他経路]
  ↓ 日次差分同期                  ↓ 営業 UI 入力
  ↓ 深夜 3-4 時 cron               ↓
  ↓                                 ↓
[Soil リスト内取込]              [Soil リスト外取込]
  is_outside_list=false            is_outside_list=true
  source_channel='kintone_app55'   source_channel='walk_in'/'referral'/...
  ↓                                 ↓
  ▼                                 ▼
[soil_lists]   ←───────  master  ───────→
  ↓ 1:N
  ▼
[leaf_kanden_cases]   ← ミラー表示
  case_type に応じて latest / replaced / makinaoshi / outside
```

### 1.3 含めるもの

- supply_point_22 を中心とした 6 ラウンドマッチング戦略
- リスト外取込フロー（毎日深夜 3-4 時）
- Soil ↔ Leaf 関電の整合運用（Soil = master 前提）
- Kintone App 55 差分同期（日次）
- case_type 連動（pd_number 変更時の処理）
- Soil 不在 Leaf 案件の即警告（テストレコード除く）
- merge（重複統合）の Soil-Leaf 跨り処理

### 1.4 含めないもの

- リストインポート（一括）→ B-01
- コール履歴 → B-02
- 検索性能 → B-04
- 6 法人 Fruit 連携 → Sprout v0.2 §13 / Fruit F-01

---

## 2. Soil ↔ Leaf 関電の境界線（改訂版、Soil = master）

### 2.1 役割分担

| 軸 | Soil（顧客マスタ = master）| Leaf 関電（商材案件 = ミラー）|
|---|---|---|
| 役割 | 全商材横断の顧客 master | 関電商材の案件・契約のミラー表示 |
| 件数 | 30 万件（関電由来 + リスト外）| 数千〜万件（案件化済のみ）|
| 列の例 | name / phone / address / supply_point_22 / pd_number / industry_type / is_outside_list / source_channel | 関電契約番号 / 容量 / 囲込み実績 / case_type / pd_number 履歴 |
| 更新源 | Kintone App 55 差分同期 + リスト外取込 | Soil JOIN 参照（DB View 経由）|
| FK 制約 | — | `soil_list_id NOT NULL` |
| 削除パターン | 論理削除（merge 含む）| 論理削除（離脱 / 完了）|

### 2.2 「Leaf に存在 / Soil 不在」が発生してはいけない理由

設計上の不整合 = バグ。発生原因の典型:

1. Leaf 案件作成時の Soil INSERT 失敗
2. Soil 削除時の Leaf cascade 漏れ
3. 取込バッチの整合性検証漏れ
4. データ移行時の不整合

→ **§5.2 で 1 件でも即警告**（テストレコード除外）。

---

## 3. 段階的マッチング戦略（R1 = supply_point_22 を最優先）

### 3.1 マッチング ラウンド一覧（改訂版）

| ラウンド | 条件 | 信頼度 | 動作 |
|---|---|---|---|
| **R1** | `supply_point_22` 完全一致 | **1.00（最高）** | **自動 UPDATE**（不変 ID で確実） |
| **R2** | `phone` 完全一致 + `name_kanji` 完全一致 | 0.95 | 自動 UPDATE |
| **R3** | `phone` 完全一致 + `name_kana` 完全一致 | 0.90 | 自動 UPDATE |
| **R4** | `phone` 完全一致 のみ | 0.85 | 自動 UPDATE（UI で見直し可）|
| **R5** | `name_kanji` + 住所 完全一致（phone null）| 0.80 | admin レビュー |
| **R6** | 上記すべて失敗 | — | 警告 + 手動対応 / 新規 INSERT |

### 3.2 R1 = supply_point_22 採択理由

- `supply_point_22` = 関西電力の電力供給地点識別子（22 桁、不変 ID）
- 契約切替・名義変更・引越でも変わらない
- pd_number（需要番号）は契約切替時に変更されるが、supply_point_22 は据置
- 同一供給地点で名義 / 契約が変わっても、同一顧客（同一の物理場所）として追跡可能
- phone + name 照合だと「同居家族の契約名義変更」「店舗の運営者交代」で別人扱いされる問題あり

### 3.3 case_type 連動（同一 supply_point_22 で pd_number 変更時の処理）

```
[Kintone App 55] 同一 supply_point_22 で pd_number 変更受信
  ↓
[判定]
  既存 soil_lists.supply_point_22 に該当あり?
  ├─ Yes → R1 マッチ
  │   ↓
  │   既存 soil_lists.pd_number と新 pd_number 比較
  │   ├─ 同じ → 通常 UPDATE
  │   └─ 違う → 「契約切替」と判定、§6 handle_pd_number_change 実行
  │
  └─ No → R2〜R6 へ進む（phone / name 照合）
```

### 3.4 case_type 列挙

```sql
ALTER TABLE leaf_kanden_cases
  ADD COLUMN case_type text NOT NULL DEFAULT 'latest'
    CHECK (case_type IN ('latest', 'replaced', 'makinaoshi', 'outside')),
  ADD COLUMN old_pd_number text,           -- 履歴: 切替前の pd_number
  ADD COLUMN replaced_at timestamptz,       -- 切替日時
  ADD COLUMN replaced_by uuid;              -- 切替実行者

CREATE INDEX idx_leaf_kanden_cases_case_type
  ON leaf_kanden_cases (case_type, soil_list_id);
```

| case_type | 意味 |
|---|---|
| `latest` | 最新の有効案件（既定）|
| `replaced` | 契約切替で旧契約となった案件（参照のみ）|
| `makinaoshi` | 巻き直し（再申込・再契約）の旧案件 |
| `outside` | リスト外の案件 |

### 3.5 supply_point_22 / pd_number 列追加（soil_lists）

```sql
ALTER TABLE soil_lists
  ADD COLUMN supply_point_22 text,
  ADD COLUMN pd_number text,
  ADD COLUMN old_pd_numbers jsonb;          -- 履歴 ['old1', 'old2', ...]

-- 22 桁数字の制約
ALTER TABLE soil_lists
  ADD CONSTRAINT chk_supply_point_22_format
    CHECK (supply_point_22 IS NULL OR supply_point_22 ~ '^[0-9]{22}$');

-- supply_point_22 単独 UNIQUE（NULL 許容で部分 INDEX）
CREATE UNIQUE INDEX uq_soil_lists_supply_point_22
  ON soil_lists (supply_point_22)
  WHERE supply_point_22 IS NOT NULL AND deleted_at IS NULL;

-- pd_number は重複可（contract切替時に履歴あり）、検索用に通常 INDEX
CREATE INDEX idx_soil_lists_pd_number
  ON soil_lists (pd_number)
  WHERE pd_number IS NOT NULL;
```

### 3.6 マッチングロジック擬似コード

```typescript
async function matchKintoneRecord(record: KintoneApp55Record): Promise<MatchResult> {
  // R1: supply_point_22 完全一致（最高信頼度）
  if (record.supply_point_22) {
    const r1 = await findBySupplyPoint22(record.supply_point_22);
    if (r1) {
      if (record.pd_number !== r1.pd_number) {
        return { round: 'R1', confidence: 1.00, soil_id: r1.id, action: 'replace_pd_number' };
      }
      return { round: 'R1', confidence: 1.00, soil_id: r1.id, action: 'update' };
    }
  }

  // R2: phone + name_kanji
  if (record.phone && record.name_kanji) {
    const r2 = await findByPhoneAndKanji(record.phone, record.name_kanji);
    if (r2) return { round: 'R2', confidence: 0.95, soil_id: r2.id, action: 'update' };
  }

  // R3: phone + name_kana
  if (record.phone && record.name_kana) {
    const r3 = await findByPhoneAndKana(record.phone, record.name_kana);
    if (r3) return { round: 'R3', confidence: 0.90, soil_id: r3.id, action: 'update' };
  }

  // R4: phone のみ
  if (record.phone) {
    const r4 = await findByPhone(record.phone);
    if (r4) return { round: 'R4', confidence: 0.85, soil_id: r4.id, action: 'update' };
  }

  // R5: name_kanji + 住所
  if (record.name_kanji && record.postal_code) {
    const r5 = await findByNameAndAddress(record.name_kanji, record.postal_code);
    if (r5) return { round: 'R5', confidence: 0.80, soil_id: r5.id, action: 'admin_review' };
  }

  // R6: マッチなし（新規 INSERT）
  return { round: 'R6', confidence: 0, soil_id: null, action: 'insert_new' };
}
```

### 3.7 dry-run モード

```sql
-- ラウンド別件数集計（実行前に admin 確認）
WITH match_result AS (
  SELECT
    record_id,
    CASE
      WHEN matched_supply_point IS NOT NULL THEN 'R1'
      WHEN matched_phone_kanji IS NOT NULL THEN 'R2'
      WHEN matched_phone_kana IS NOT NULL THEN 'R3'
      WHEN matched_phone IS NOT NULL THEN 'R4'
      WHEN matched_name_address IS NOT NULL THEN 'R5'
      ELSE 'R6'
    END AS round
  FROM staging_kintone_app55
)
SELECT round, COUNT(*) FROM match_result GROUP BY round;
```

### 3.8 実行タイミング（毎日深夜、改訂）

- **毎日深夜 3:00 開始 / 朝 6-7 時完了**（B-02 と統一、夜間業務影響回避）
- 月初の旧月次バッチは廃止（後述 §4.5）

---

## 4. リスト外取込フロー（毎日深夜実行、改訂版）

### 4.1 「リスト外」概念

> 「飛び込み案件」用語は廃止。
> Garden では Kintone App 55 リスト管理外の顧客（営業飛び込み・他経路流入）を **「リスト外」** と呼ぶ。

| 概念 | 旧用語 | 新用語 |
|---|---|---|
| Kintone App 55 にあるリスト | 通常リスト | **リスト内** |
| Kintone App 55 にない顧客 | 飛び込み案件（誤）| **リスト外** |
| Leaf 案件として存在するが Soil 未登録 | 飛び込み補完（誤）| **発生してはいけない（バグ）** |

### 4.2 is_outside_list フラグ列追加

```sql
ALTER TABLE soil_lists
  ADD COLUMN is_outside_list boolean NOT NULL DEFAULT false,
  ADD COLUMN source_channel text          -- 'kintone_app55' | 'walk_in' | 'referral' | 'other'
    CHECK (source_channel IN ('kintone_app55', 'walk_in', 'referral', 'web_form', 'phone_inbound', 'other')),
  ADD COLUMN source_channel_note text,    -- 詳細メモ（営業飛び込み元の店舗名等）
  ADD COLUMN registered_outside_at timestamptz,  -- リスト外登録日時
  ADD COLUMN registered_outside_by uuid;          -- 登録者

CREATE INDEX idx_soil_lists_is_outside_list
  ON soil_lists (is_outside_list, source_channel)
  WHERE is_outside_list = true;
```

### 4.3 リスト外取込スケジュール（B-02 と統一）

```typescript
// /api/cron/soil-outside-list-import (毎日 03:00 JST)
export async function GET() {
  // 1. 営業 UI で前日中に登録された outside レコードを集約
  const outsideRecords = await fetchOutsideListRegistrations({ since: yesterday() });

  // 2. supply_point_22 が分かっている場合は R1 マッチ確認
  for (const r of outsideRecords) {
    if (r.supply_point_22) {
      const existing = await findBySupplyPoint22(r.supply_point_22);
      if (existing && !existing.is_outside_list) {
        // 既にリスト内に存在 → リスト外フラグ不要、通常 UPDATE
        await updateSoilList(existing.id, r);
        continue;
      }
    }
    // リスト外として INSERT
    await insertSoilListOutside(r);
  }

  // 3. 終了時に Bloom KPI 反映 + Chatwork 通知
  await reportOutsideImportSummary();
}
```

### 4.4 リスト外案件の Leaf 連動

リスト外で Soil 登録されると、対応する Leaf 関電案件は `case_type = 'outside'` で生成:

```sql
INSERT INTO leaf_kanden_cases (
  soil_list_id, case_type, pd_number, ...
) VALUES (
  $soil_list_id, 'outside', $pd_number, ...
);
```

### 4.5 旧「月次補完バッチ」廃止

- §3.4 / §4 / §9（旧 spec の「飛び込み補完バッチ」）は**完全廃止**
- 代替: 毎日深夜 3:00 のリスト外取込 + 即時 Soil INSERT
- 月次の総括レポートは Bloom KPI ダッシュボード（B-04 連動）で代替

---

## 5. orphan 警告（即警告、テストレコード除外）

### 5.1 設計の核心

> 「Leaf に存在 / Soil 不在」は**設計上発生しない**。発生 = バグ。
> **テストレコード以外で 1 件でも検出 → 即警告**。

### 5.2 警告閾値（改訂版）

| 状態 | 閾値 | 重大度 |
|---|---|---|
| **テストレコード以外で 1 件以上**の orphan Leaf | **即時** | **high** |
| テストレコードのみの orphan | 100 件超 | low（参考）|
| Soil active / Leaf 全 churned | 50 件超 | medium |
| Soil deleted / Leaf active | 1 件以上 | high（即時）|

### 5.3 テストレコード判定フィルタ

```sql
-- テストレコード判定（複数条件で OR）
CREATE OR REPLACE FUNCTION is_test_kanden_record(p_case leaf_kanden_cases)
RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT
    p_case.source_record_id LIKE 'TEST_%'
    OR p_case.source_record_id LIKE 'test-%'
    OR p_case.notes LIKE '%テストデータ%'
    OR p_case.customer_name = 'テスト太郎'
    OR p_case.phone_number = '000-0000-0000';
$$;
```

### 5.4 即警告 Cron

```typescript
// /api/cron/soil-leaf-orphan-detect (1 時間ごと、即時要件のため頻繁)
export async function GET() {
  const orphanCount = await supabaseAdmin.rpc('count_non_test_orphan_leaves');

  if (orphanCount > 0) {
    await recordMonitoringEvent({
      module: 'soil',
      category: 'consistency_violation',
      severity: 'high',
      message: `Leaf 関電案件に Soil 不在状態を ${orphanCount} 件検出（テストレコード除外）`,
      details: { orphan_count: orphanCount },
    });
    await sendChatworkDM(superAdminUserId,
      `⚠️ Soil 整合性違反: ${orphanCount} 件の Leaf 関電案件に Soil 不在状態を検出。設計上発生してはいけない状態のため、至急確認を依頼します。`);
  }
}
```

```sql
-- count_non_test_orphan_leaves 関数
CREATE OR REPLACE FUNCTION count_non_test_orphan_leaves()
RETURNS int
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COUNT(*)::int
  FROM leaf_kanden_cases lk
  WHERE lk.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM soil_lists sl WHERE sl.id = lk.soil_list_id
    )
    AND NOT is_test_kanden_record(lk);
$$;
```

### 5.5 違反時のオペレーション

```
1. Chatwork DM で super_admin に即時通知
2. admin 画面 /soil/admin/orphan-violations に表示
3. 違反レコードの調査:
   - Leaf 案件作成時の Soil INSERT が失敗していないか
   - Soil 削除時の cascade 漏れではないか
   - データ移行 / 取込バグの可能性
4. 復旧:
   - Soil 側に該当 supply_point_22 / pd_number を再登録（バックアップから）
   - or Leaf 側を論理削除（誤データの場合）
5. ポストモーテム作成（Cross Ops #03 連動）
```

---

## 6. case_type と pd_number 変更時の処理（新設）

### 6.1 シナリオ

```
[Kintone App 55] 同一 supply_point_22 で pd_number 変更受信
  ↓
[Soil] supply_point_22 で R1 マッチ
  ↓
[判定] pd_number 変更検出
  ↓
[Trx 内処理]
1. 旧 pd_number を soil_lists.old_pd_numbers (jsonb 配列) に追加
2. soil_lists.pd_number = 新 pd_number に UPDATE
3. 既存 leaf_kanden_cases (case_type='latest') を case_type='replaced' に変更
   - leaf_kanden_cases.old_pd_number = 旧 pd_number
   - leaf_kanden_cases.replaced_at = now()
4. 新規 leaf_kanden_cases を case_type='latest' で生成
5. 監査ログ記録
```

### 6.2 handle_pd_number_change Server Action

```typescript
async function handlePdNumberChange(input: {
  soil_list_id: string;
  old_pd_number: string;
  new_pd_number: string;
  new_kanden_data: KandenCaseData;
  performed_by: string;
}): Promise<{ ok: true; new_case_id: string } | { ok: false; error: string }> {
  return await supabase.rpc('handle_pd_number_change', {
    p_soil_list_id: input.soil_list_id,
    p_old_pd_number: input.old_pd_number,
    p_new_pd_number: input.new_pd_number,
    p_new_kanden_data: input.new_kanden_data,
    p_performed_by: input.performed_by,
  });
}
```

```sql
CREATE OR REPLACE FUNCTION handle_pd_number_change(
  p_soil_list_id uuid,
  p_old_pd_number text,
  p_new_pd_number text,
  p_new_kanden_data jsonb,
  p_performed_by uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_new_case_id uuid;
BEGIN
  -- 1. 旧 pd_number を履歴に追加 + Soil の pd_number 更新
  UPDATE soil_lists SET
    pd_number = p_new_pd_number,
    old_pd_numbers = COALESCE(old_pd_numbers, '[]'::jsonb) ||
                     jsonb_build_array(p_old_pd_number),
    updated_at = now()
  WHERE id = p_soil_list_id;

  -- 2. 既存 latest 案件を replaced に変更
  UPDATE leaf_kanden_cases SET
    case_type = 'replaced',
    old_pd_number = p_old_pd_number,
    replaced_at = now(),
    replaced_by = p_performed_by
  WHERE soil_list_id = p_soil_list_id
    AND case_type = 'latest'
    AND deleted_at IS NULL;

  -- 3. 新規 latest 案件を生成
  INSERT INTO leaf_kanden_cases (
    soil_list_id, case_type, pd_number,
    customer_name, phone_number, contract_type
  ) VALUES (
    p_soil_list_id, 'latest', p_new_pd_number,
    p_new_kanden_data->>'customer_name',
    p_new_kanden_data->>'phone_number',
    p_new_kanden_data->>'contract_type'
  ) RETURNING id INTO v_new_case_id;

  -- 4. 監査ログ
  INSERT INTO operation_logs (
    user_id, module, action, target_type, target_id, details
  ) VALUES (
    p_performed_by, 'soil', 'pd_number_change',
    'soil_lists', p_soil_list_id::text,
    jsonb_build_object(
      'old_pd_number', p_old_pd_number,
      'new_pd_number', p_new_pd_number,
      'new_case_id', v_new_case_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'new_case_id', v_new_case_id);
END $$;

REVOKE ALL ON FUNCTION handle_pd_number_change FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_pd_number_change TO authenticated;
```

### 6.3 makinaoshi（巻き直し）の扱い

`makinaoshi` = 同一供給地点で再申込・再契約。`replaced` と類似だが、**業務処理として明示区別**:

| case_type | 業務的意味 | 経理処理 |
|---|---|---|
| `latest` | 現行有効 | 通常請求 |
| `replaced` | 契約切替で旧契約 | 過去履歴のみ |
| `makinaoshi` | 再申込で旧契約（中断あり）| 中断期間の処理が別途必要 |
| `outside` | リスト外 | 通常請求（管理対象別）|

`makinaoshi` への変更は admin の手動操作（Server Action 別、監査ログ必須）。

### 6.4 月次整合チェック（pd_number 履歴の整合性）

```sql
-- pd_number 履歴の不整合検出
SELECT
  sl.id, sl.supply_point_22, sl.pd_number,
  jsonb_array_length(sl.old_pd_numbers) AS history_count,
  COUNT(lk.id) AS replaced_count
FROM soil_lists sl
LEFT JOIN leaf_kanden_cases lk
  ON lk.soil_list_id = sl.id AND lk.case_type = 'replaced'
WHERE sl.deleted_at IS NULL
GROUP BY sl.id
HAVING jsonb_array_length(sl.old_pd_numbers) != COUNT(lk.id);
-- → 履歴件数と replaced 件数が不一致なら警告
```

---

## 7. master 更新フロー

### 7.1 更新権限

| 列 | 真の master | 更新元 |
|---|---|---|
| supply_point_22 | **Soil**（Kintone App 55 経由）| Kintone 差分同期、admin 手動 |
| pd_number | **Soil**（Kintone App 55 経由）| Kintone 差分同期、§6 case_type 連動 |
| name / phone / address | **Soil** | Soil 編集 UI |
| 関電契約番号 / 契約種別 / 容量 | **Leaf** | Leaf 編集 UI |
| case_type | Leaf（Server Action 経由）| §6 |
| status | **Soil**（Leaf からトリガ更新）| Leaf イベント駆動 |

### 7.2 Soil → Leaf 反映

- Soil で名前変更 → Leaf 側は **VIEW 経由で都度参照**（同期遅延ゼロ）
- DB トリガでミラーするのではなく、**JOIN で表示時に取得**

### 7.3 Leaf → Soil 反映

- Leaf 案件作成 → `soil_lists.status = 'casecreated'`
- Leaf 案件離脱 → 他 Leaf 案件 active なし → `soil_lists.status = 'churned'`

---

## 8. Kintone App 55 差分同期（毎日深夜）

### 8.1 同期戦略

```
毎日 03:00 JST 起動
  ↓
Kintone API: 直近 24h 更新分を取得
  ↓
supply_point_22 で R1 マッチ → UPSERT
  ↓ pd_number 変更検出 → §6 handle_pd_number_change
  ↓
phone / name / address の差分を Soil に反映
  ↓
変更ログを soil_list_imports に記録
  ↓
朝 6-7 時に完了 + Bloom KPI 反映 + Chatwork サマリ通知
```

### 8.2 競合解消

- Soil 側で手動編集された行 vs Kintone 更新
- `soil_lists.updated_at > kintone.updated_at` かつ手動編集マーク（`manually_edited_at` 列）あれば Soil 優先
- ただし `supply_point_22` / `pd_number` だけは常に Kintone 優先（master データの一貫性）

### 8.3 削除検出

- Kintone 側で削除されたレコード = 取得対象に出てこない
- 月次で全件突合 → 消えた `source_record_id` を Soil で論理削除（admin 承認後）

---

## 9. status 自動更新トリガ

### 9.1 案件化トリガ

```sql
CREATE OR REPLACE FUNCTION update_soil_status_on_leaf_create()
RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Soil = master 前提のため、soil_list_id は NOT NULL（後付け不要）
  UPDATE soil_lists
  SET status = 'casecreated',
      primary_case_module = 'leaf_kanden',
      primary_case_id = NEW.id,
      case_count = case_count + 1,
      status_changed_at = now()
  WHERE id = NEW.soil_list_id
    AND status = 'active';
  RETURN NEW;
END $$;
```

### 9.2 離脱トリガ

§9.1 と同パターン、active 案件なしの場合 status='churned'。

### 9.3 トリガ vs Server Action

トリガは整合性保証用フェイルセーフ。通常は Server Action で明示更新。

---

## 10. merge（重複統合）の Soil-Leaf 跨り処理

### 10.1 シナリオ

```
soil_lists A（旧）と soil_lists B（新）が同一顧客と判明
  ↓
A.merged_into_id = B.id 設定
  ↓
A 側に紐付いていた leaf_kanden_cases を B に付け替え
（case_type は維持、soil_list_id のみ更新）
```

### 10.2 cascade UPDATE（Trx 内）

```sql
BEGIN;
  UPDATE soil_lists SET merged_into_id = $b_id, status = 'merged' WHERE id = $a_id;
  UPDATE leaf_kanden_cases SET soil_list_id = $b_id WHERE soil_list_id = $a_id;

  -- 他 Leaf 商材も同様
  -- ...

  INSERT INTO operation_logs (module, action, target_type, target_id, details)
  VALUES ('soil', 'merge', 'soil_lists', $a_id::text,
          jsonb_build_object('merged_into', $b_id, 'leaf_count', $count));
COMMIT;
```

### 10.3 merge 取消（24h 以内）

逆 cascade UPDATE で対応、24h 経過後は不可。

---

## 11. 法令対応チェックリスト

### 11.1 個人情報保護法

- [ ] 第 17 条: 利用目的（Soil 顧客 = 営業全般 / Leaf 関電 = 関電業務委託のみ）
- [ ] 第 25 条: データの内容の正確性（master 整合維持の根拠 = supply_point_22 不変 ID）

### 11.2 関電業務委託契約

- [ ] 関電とのデータ取扱契約に基づく整合範囲遵守
- [ ] supply_point_22 / pd_number の取扱は契約に明示

---

## 12. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | supply_point_22 / pd_number / old_pd_numbers 列追加 | a-soil | 0.5h |
| 2 | is_outside_list / source_channel 列追加 | a-soil | 0.5h |
| 3 | leaf_kanden_cases.case_type / old_pd_number 列追加 | a-leaf | 0.5h |
| 4 | 6 ラウンド マッチング Server Action 実装 | a-soil + a-leaf | 1.5h |
| 5 | リスト外取込 Cron（毎日 03:00）| a-soil | 1h |
| 6 | handle_pd_number_change DB 関数 | a-soil + a-leaf | 1h |
| 7 | orphan 即警告 Cron + テストレコード判定 | a-soil | 1h |
| 8 | Kintone App 55 差分同期（毎日深夜）| a-soil | 1h |
| 9 | status 自動更新トリガ更新（NOT NULL FK 対応）| a-soil | 0.5h |
| 10 | merge 操作の cascade UPDATE | a-soil | 0.5h |
| 11 | 単体 + 統合テスト | a-soil + a-leaf | 0.5h |

合計: 約 8.5h ≈ **1.0d**（旧見積維持）

---

## 13. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | R1 supply_point_22 が NULL の Kintone レコード | R2 以降にフォールバック、admin 警告 |
| 判 2 | Kintone 削除検知の頻度 | 月次（毎月 1 日）、削除確定は連続 2 月確認後 |
| 判 3 | リスト外の `source_channel` 既定値 | 'walk_in'、UI で変更可 |
| 判 4 | makinaoshi 判定基準 | admin 手動のみ、自動判定しない |
| 判 5 | orphan 警告の即時 DM 抑止 | 同種違反は 5 分集約、初回のみ即時 |
| 判 6 | テストレコード判定の追加条件 | TEST_ プレフィックス + 'テスト太郎' 名 + 000-0000-0000 電話 |
| 判 7 | merge 取消期限 | **24h** |
| 判 8 | リスト外取込開始時刻 | **03:00 JST**（B-02 と統一）|
| 判 9 | 旧月次バッチ（飛び込み補完）の cleanup | 既存実装あれば削除、未実装なら無視 |

---

## 14. 既知のリスクと対策

### 14.1 supply_point_22 入力ミス

- 22 桁数字の入力誤り → 別供給地点と誤マッチ
- 対策: format CHECK 制約 + UI バリデーション + admin レビュー

### 14.2 pd_number 変更時の case_type 設定漏れ

- §6 Server Action を経由しない直接 INSERT/UPDATE で case_type 不整合
- 対策: BEFORE UPDATE トリガで pd_number 変化検出 → Server Action 強制

### 14.3 リスト外の Source 偽装

- 営業が誤情報を source_channel に入力
- 対策: 月次で source_channel 別件数確認、異常値 admin レビュー

### 14.4 orphan 警告のノイズ

- テストレコードの誤判定で警告漏れ
- 対策: テストレコード判定関数のテストケース 10 件以上

### 14.5 Kintone 同期失敗で大量 orphan 検出

- API 障害で取込失敗 → 「Soil 側削除 / Leaf 側残存」と誤検知
- 対策: 取込失敗時の orphan 警告は重大度 medium に降格

### 14.6 Trx 内処理の長時間化

- handle_pd_number_change が大量 Leaf 案件を処理
- 対策: 1 supply_point_22 あたり最大 100 件まで、超過時は分割処理

---

## 15. 関連ドキュメント

- `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`（境界線定義 Batch 16）
- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md`（前提）
- `docs/specs/2026-04-26-soil-phase-b-02-call-history-import.md`（同スケジュール）
- `docs/specs/2026-04-26-soil-phase-b-04-search-optimization.md`（後続）
- `docs/specs/2026-04-26-soil-phase-b-06-rls-detailed.md`（権限）
- `docs/specs/2026-04-26-soil-phase-b-07-monitoring-alerting.md`（監視）
- `docs/specs/leaf/spec-leaf-kanden-phase-c-01-schema-migration.md`
- `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`（確定ログ）
- `C:\garden\_shared\decisions\spec-revision-followups-20260426.md` §1.2

---

## 16. 受入基準（Definition of Done）

- [ ] supply_point_22 / pd_number / old_pd_numbers 列が soil_lists に追加
- [ ] supply_point_22 UNIQUE 部分インデックス動作（NULL 許容）
- [ ] is_outside_list / source_channel 列が soil_lists に追加
- [ ] leaf_kanden_cases.case_type / old_pd_number / replaced_at / replaced_by 列追加
- [ ] 6 ラウンド マッチング（R1〜R6）が dev で動作確認
- [ ] R1 = supply_point_22 完全一致が最優先で動作（信頼度 1.00）
- [ ] handle_pd_number_change() DB 関数で case_type 連動動作
- [ ] リスト外取込 Cron（毎日 03:00）が稼働
- [ ] orphan 即警告 Cron が 1 時間粒度稼働、テストレコード除外
- [ ] テストレコード以外で 1 件検出 → high 通知 + super_admin DM
- [ ] Kintone App 55 差分同期（毎日深夜）動作
- [ ] status 自動更新トリガ動作（soil_list_id NOT NULL 前提）
- [ ] merge 操作の cascade UPDATE 動作（24h 以内取消可）
- [ ] 「Leaf 案件 / Soil 不在」が設計上発生しないことを統合テストで検証
- [ ] 旧月次補完バッチの cleanup 完了（実装あれば削除）
- [ ] Soil CLAUDE.md に「Soil = master / Leaf = ミラー」原則を追記
