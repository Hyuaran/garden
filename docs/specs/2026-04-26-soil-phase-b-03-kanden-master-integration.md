# Soil Phase B-03: 関電リスト連携（master データ整合）

- 対象: Garden-Soil `soil_lists` と Garden-Leaf `leaf_kanden_cases` の master 整合運用
- 優先度: **🟡 中**（既存稼働中の Leaf 関電と整合維持、ミス時影響大）
- 見積: **1.0d**
- 担当セッション: a-soil + a-leaf（実装）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-03）
- 前提:
  - **Batch 16 Soil 基盤**（特に `2026-04-25-soil-03-kanden-list-integration.md` 境界線定義済）
  - **B-01 リストインポート Phase 1** 完了（Kintone 30 万件投入済）
  - 既存 Leaf 関電（`leaf_kanden_cases` 稼働中）

---

## 1. 目的とスコープ

### 1.1 目的

Batch 16 で**境界線定義**（Soil = 顧客マスタ / Leaf = 商材案件）は完了済。本 spec は **Phase B 実装着手版** として、後付け soil_list_id 紐付バッチの本実装、定期整合チェック、master 更新フローを定義する。

### 1.2 含めるもの

- 後付け `leaf_kanden_cases.soil_list_id` UPDATE バッチ実装
- マッチング失敗ケース（重複電話 / 名前不一致 / null 電話）の例外処理
- 月次整合チェック Cron
- master データ更新の優先順位（Soil ↔ Leaf）
- Kintone App 55 の差分同期フロー
- `soil_lists.status` 自動更新トリガ
- 飛び込み案件（`soil_list_id IS NULL`）の月次補完バッチ
- 重複統合（merge）の Soil-Leaf 跨り処理

### 1.3 含めないもの

- リストインポート（一括）→ B-01
- コール履歴 → B-02
- 検索性能 → B-04
- 6 法人 Fruit 連携 → Sprout v0.2 §13 / Fruit F-01

---

## 2. Soil ↔ Leaf 関電の境界線（再掲）

| 軸 | Soil（顧客マスタ）| Leaf 関電（商材案件）|
|---|---|---|
| 役割 | 全商材横断の顧客 | 関電商材の案件・契約 |
| 件数 | 30 万件（関電由来）| 数千〜万件（案件化済のみ）|
| 列の例 | name / phone / address / industry_type | 関電契約番号 / 容量 / 囲込み実績 |
| 更新源 | Soil = 真の値 | Leaf = 案件進捗 |
| 削除パターン | 論理削除（merge 含む）| 論理削除（離脱 / 完了）|

詳細は Batch 16 §3 / §5 / §6 参照。

---

## 3. 後付け soil_list_id UPDATE バッチ

### 3.1 マッチングルール

```sql
UPDATE leaf_kanden_cases lk
SET soil_list_id = sl.id
FROM soil_lists sl
WHERE lk.soil_list_id IS NULL
  AND lk.phone_number IS NOT NULL
  AND lk.phone_number = sl.phone_primary
  AND lk.customer_name = sl.name_kanji;
```

### 3.2 段階的マッチング戦略

| ラウンド | 条件 | 信頼度 |
|---|---|---|
| R1 | phone 完全一致 + name_kanji 完全一致 | 0.99 |
| R2 | phone 完全一致 + name_kana 完全一致 | 0.95 |
| R3 | phone 完全一致 のみ | 0.85 |
| R4 | name_kanji + 住所 完全一致（phone null）| 0.80 |
| R5 | 上記すべて失敗 → 警告 | — |

R1-R3 は自動 UPDATE、R4 は admin レビュー、R5 は警告 + 人手対応。

### 3.3 dry-run モード

```sql
-- dry-run: 件数のみ
SELECT
  COUNT(*) FILTER (WHERE round = 'R1') AS r1_count,
  COUNT(*) FILTER (WHERE round = 'R2') AS r2_count,
  -- ...
FROM (
  SELECT lk.id,
    CASE
      WHEN sl1.id IS NOT NULL THEN 'R1'
      WHEN sl2.id IS NOT NULL THEN 'R2'
      ELSE 'R5'
    END AS round
  FROM leaf_kanden_cases lk
  LEFT JOIN soil_lists sl1 ON lk.phone_number = sl1.phone_primary AND lk.customer_name = sl1.name_kanji
  LEFT JOIN soil_lists sl2 ON lk.phone_number = sl2.phone_primary AND lk.customer_name_kana = sl2.name_kana
  WHERE lk.soil_list_id IS NULL
) sub;
```

実行前に件数確認、規模感を admin に提示してから本実行。

### 3.4 実行タイミング

- B-01 完了直後（30 万件投入後）に 1 回実行
- その後は **月次 Cron**（毎月 1 日 03:00 JST）で増分対応

---

## 4. マッチング失敗の例外処理

### 4.1 失敗パターン分類

| パターン | 件数想定 | 対応 |
|---|---|---|
| `phone_number IS NULL` の Leaf 案件 | <100 | name + 住所で再マッチング（R4）|
| 重複電話（同 phone で複数 Soil） | 数十〜100 | admin レビュー、最新の 1 件を優先 |
| Soil 側に該当なし（Kintone 未取込）| 数十 | Soil 側に手動追加 or Phase 2 で解消 |
| 名前表記揺れ | 数百 | 部分一致（pg_trgm）でのマッチング、admin レビュー |

### 4.2 警告テーブル

```sql
CREATE TABLE leaf_kanden_cases_orphan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaf_case_id uuid NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,  -- 'phone_null' | 'multiple_match' | 'no_soil' | 'name_mismatch'
  candidate_soil_ids uuid[],
  resolved_at timestamptz,
  resolved_by uuid,
  resolution text  -- 'matched' | 'created_new' | 'kept_orphan'
);
```

### 4.3 admin 補完 UI `/soil/orphans/[id]`

- orphan の Leaf 案件詳細表示
- 候補 Soil リスト（信頼度順）
- マージ / 新規作成 / 保留 ボタン
- 残件数を月次 Bloom KPI に反映

---

## 5. 月次整合チェック Cron

### 5.1 Cron 設定

```typescript
// src/app/api/cron/soil-leaf-consistency/route.ts
// 毎月 1 日 03:00 JST 実行

export async function GET() {
  const issues = [];

  // 1. soil_list_id IS NULL の Leaf 件数
  const orphanCount = await countOrphanLeaf();
  if (orphanCount > 100) issues.push(...);

  // 2. Soil active だが Leaf 全 churned
  const inconsistentStatus = await detectStatusInconsistency();

  // 3. Soil deleted だが Leaf active
  const deletedSoilWithActiveLeaf = await detectDeletedSoilWithActive();

  if (issues.length > 0) {
    await recordMonitoringEvent({
      module: 'soil',
      category: 'consistency_violation',
      severity: 'medium',
      message: `${issues.length} 件の整合性違反検出`,
      details: issues,
    });
  }
  return Response.json({ ok: true, issues: issues.length });
}
```

### 5.2 検査項目

| 項目 | クエリ | 警告閾値 |
|---|---|---|
| orphan Leaf 案件数 | `WHERE soil_list_id IS NULL` | 100 件超 |
| Soil active / Leaf 全 churned | JOIN + GROUP BY | 50 件超 |
| Soil deleted / Leaf active | JOIN | 1 件超（即警告）|
| status 'casecreated' だが Leaf 不在 | EXISTS | 1 件超（即警告）|

---

## 6. master 更新フロー

### 6.1 更新権限

| 列 | 真の master | 更新元 |
|---|---|---|
| name / phone / address | **Soil** | Soil 編集 UI |
| 関電契約番号 / 契約種別 / 容量 | **Leaf** | Leaf 編集 UI |
| status (active/casecreated/churned) | **Soil**（Leaf からトリガ更新）| Leaf イベント駆動 |
| Kintone source_record_id | Kintone | 差分同期で UPDATE |

### 6.2 Soil 側の更新が Leaf にどう反映するか

- Soil で名前変更 → Leaf 側は **read-only ミラー**（DB トリガで反映）or 都度 JOIN
- 推奨: **都度 JOIN**（DB View でミラー風に見せる）→ 同期遅延ゼロ

### 6.3 Leaf 側の更新が Soil に反映する例

- Leaf 案件作成 → `soil_lists.status = 'casecreated'`、`primary_case_module = 'leaf_kanden'`、`primary_case_id` 設定
- Leaf 案件離脱 → 他 Leaf 案件 active なし → `soil_lists.status = 'churned'`

---

## 7. Kintone App 55 差分同期

### 7.1 同期戦略

```
週次 Cron（毎週月曜 06:00 JST）
  ↓
Kintone API: 直近 7 日更新分を取得（query: 更新日時 > 先週月曜）
  ↓
source_record_id 一致で UPSERT
  ↓
phone / name / address の差分を Soil に反映
  ↓
変更ログを soil_list_imports に記録
```

### 7.2 競合解消

- Soil 側で手動編集された行 vs Kintone 更新
- `soil_lists.updated_at > kintone.updated_at` なら Soil 優先（手動優先）
- ただし `phone_primary` だけは常に Kintone 優先（master データの一貫性）

### 7.3 削除検出

- Kintone 側で削除されたレコード = 取得対象に出てこない
- 月次で全件突合 → 消えた `source_record_id` を Soil で論理削除（admin 承認後）

---

## 8. status 自動更新トリガ

### 8.1 案件化トリガ

```sql
CREATE OR REPLACE FUNCTION update_soil_status_on_leaf_create()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.soil_list_id IS NOT NULL THEN
    UPDATE soil_lists
    SET status = 'casecreated',
        primary_case_module = 'leaf_kanden',
        primary_case_id = NEW.id,
        case_count = case_count + 1,
        status_changed_at = now()
    WHERE id = NEW.soil_list_id
      AND status = 'active';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_soil_status_on_leaf_kanden_create
AFTER INSERT ON leaf_kanden_cases
FOR EACH ROW EXECUTE FUNCTION update_soil_status_on_leaf_create();
```

### 8.2 離脱トリガ

```sql
CREATE OR REPLACE FUNCTION update_soil_status_on_leaf_churn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_count int;
BEGIN
  IF NEW.churn_date IS NOT NULL AND OLD.churn_date IS NULL THEN
    -- 他の active な Leaf 案件があるか
    SELECT COUNT(*) INTO active_count FROM leaf_kanden_cases
    WHERE soil_list_id = NEW.soil_list_id
      AND churn_date IS NULL
      AND id != NEW.id;

    -- 他商材も同様に確認（leaf_hikari_cases 等）
    -- ... 省略

    IF active_count = 0 THEN
      UPDATE soil_lists SET status = 'churned' WHERE id = NEW.soil_list_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
```

### 8.3 トリガの代替案

トリガが重い場合、**Server Action 内で明示的に UPDATE**（推奨）。トリガは整合性保証用のフェイルセーフ。

---

## 9. 飛び込み案件の月次補完バッチ

### 9.1 補完シナリオ

- 訪問先で新規契約獲得 → Leaf 案件作成、Soil 不在
- `soil_list_id IS NULL` の orphan として残る
- 月次バッチで Soil への自動補完を試みる

### 9.2 補完ロジック

```sql
-- 月次バッチ
INSERT INTO soil_lists (
  source_system, source_record_id,
  customer_type, name_kanji, name_kana,
  phone_primary, postal_code, prefecture, city, address_line,
  status, primary_case_module, primary_case_id, case_count
)
SELECT
  'leaf-kanden-orphan-backfill',
  lk.id::text,
  CASE WHEN lk.customer_name LIKE '%株式会社%' THEN 'corporate' ELSE 'individual' END,
  lk.customer_name,
  lk.customer_name_kana,
  lk.phone_number,
  ...
  'casecreated',
  'leaf_kanden',
  lk.id,
  1
FROM leaf_kanden_cases lk
WHERE lk.soil_list_id IS NULL
  AND lk.created_at < now() - interval '30 days';  -- 30 日経過分

-- 続けて soil_list_id を Leaf に紐付
UPDATE leaf_kanden_cases lk
SET soil_list_id = sl.id
FROM soil_lists sl
WHERE sl.source_record_id = lk.id::text
  AND sl.source_system = 'leaf-kanden-orphan-backfill';
```

### 9.3 補完件数の管理

- 月次レポート（Bloom）に「飛び込み案件補完 N 件」を表示
- 異常な件数増加（前月比 +50%）でアラート

---

## 10. merge（重複統合）の Soil-Leaf 跨り処理

### 10.1 シナリオ

```
soil_lists A（旧）と soil_lists B（新）が同一顧客と判明
  ↓
A.merged_into_id = B.id 設定
  ↓
A 側に紐付いていた leaf_kanden_cases を B に付け替え
```

### 10.2 cascade UPDATE

```sql
-- merge 操作時の Server Action 内で
BEGIN;
  -- Soil A をマージ済に
  UPDATE soil_lists SET merged_into_id = $b_id, status = 'merged' WHERE id = $a_id;

  -- Leaf 関電を B に付け替え
  UPDATE leaf_kanden_cases SET soil_list_id = $b_id WHERE soil_list_id = $a_id;

  -- 他 Leaf 商材も同様
  UPDATE leaf_hikari_cases SET soil_list_id = $b_id WHERE soil_list_id = $a_id;
  -- ...

  -- 監査ログ
  INSERT INTO operation_logs (module, action, target_type, target_id, details)
  VALUES ('soil', 'merge', 'soil_lists', $a_id::text,
          jsonb_build_object('merged_into', $b_id, 'leaf_count', $count));
COMMIT;
```

### 10.3 merge 取消（24h 以内）

- Server Action 内で逆 cascade UPDATE
- 24h 経過後は不可（凍結）

---

## 11. 法令対応チェックリスト

### 11.1 個人情報保護法

- [ ] 第 17 条: 利用目的（Soil 顧客 = 営業全般 / Leaf 関電 = 関電業務委託のみ）
- [ ] 第 25 条: データの内容の正確性（master 整合維持の根拠）

### 11.2 関電業務委託契約

- [ ] 関電とのデータ取扱契約に基づく整合範囲遵守
- [ ] Kintone 側との同期で個人情報の漏洩なし

---

## 12. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | 後付け UPDATE バッチ（5 ラウンド）| a-soil + a-leaf | 1.5h |
| 2 | dry-run モード + 件数レポート | a-soil | 0.5h |
| 3 | orphan 警告テーブル + admin UI | a-soil | 1.5h |
| 4 | 月次整合チェック Cron | a-soil | 1h |
| 5 | status 自動更新トリガ + Server Action | a-soil + a-leaf | 1h |
| 6 | Kintone 差分同期（週次 Cron）| a-soil | 1.5h |
| 7 | 飛び込み案件補完バッチ | a-soil | 0.5h |
| 8 | merge 操作の cascade UPDATE | a-soil | 1h |
| 9 | 単体 + 統合テスト | a-soil | 0.5h |

合計: 約 9h ≈ **1.0d**

---

## 13. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | R3 phone 一致のみ自動 UPDATE | **自動**（信頼度 0.85）、UI で見直し可 |
| 判 2 | Kintone vs Soil 競合解消 | 手動編集（updated_at 比較）優先、phone のみ Kintone 優先 |
| 判 3 | 飛び込み補完の経過日数 | **30 日**、短すぎ / 長すぎなら admin で調整 |
| 判 4 | merge 取消期限 | **24h** |
| 判 5 | orphan 警告の閾値 | 100 件超で medium、500 件超で high |
| 判 6 | Kintone 削除検知の頻度 | 月次（毎月 1 日）|
| 判 7 | status トリガ vs Server Action | **両方**（Server Action 主、トリガはフェイルセーフ）|

---

## 14. 既知のリスクと対策

### 14.1 後付け UPDATE の誤マッチ

- 別人を同一視 → 個人情報漏洩
- 対策: 信頼度 0.85 未満は admin レビュー必須

### 14.2 トリガ無限ループ

- soil_lists UPDATE → trigger → soil_lists UPDATE
- 対策: 既存 status と比較して同値なら何もしない

### 14.3 Kintone 同期の差分漏れ

- 週次 7 日前以前の更新が漏れる
- 対策: 月次全件突合で補完

### 14.4 merge 取消後の不整合

- merge 後に B 側に新規 Leaf 追加 → 取消で A に戻すと整合崩れ
- 対策: 24h 以内のみ取消、UI で警告

### 14.5 飛び込み補完の暴発

- バグで全 Leaf 案件を Soil に複製
- 対策: 月次バッチに上限（1,000 件 / 月）+ admin 承認

### 14.6 Kintone 削除検知の誤検知

- API 取得失敗で「消えた」と誤判定
- 対策: 連続 2 月確認で削除確定

---

## 15. 関連ドキュメント

- `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`（境界線定義）
- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md`（前提）
- `docs/specs/2026-04-26-soil-phase-b-06-rls-detailed.md`（権限）
- `docs/specs/2026-04-26-soil-phase-b-07-monitoring-alerting.md`（監視）
- `docs/specs/leaf/spec-leaf-kanden-phase-c-01-schema-migration.md`

---

## 16. 受入基準（Definition of Done）

- [ ] 後付け UPDATE バッチが dry-run + 本実行で動作
- [ ] R1〜R5 マッチング統計が admin レポートに表示
- [ ] orphan 警告テーブル + admin UI 動作
- [ ] 月次整合チェック Cron が稼働
- [ ] status 自動更新トリガが整合維持（Server Action 主）
- [ ] Kintone 差分同期 Cron が週次稼働
- [ ] 飛び込み案件補完バッチが月次動作
- [ ] merge 操作の cascade UPDATE が dev で動作
- [ ] 24h 以内の merge 取消が動作
- [ ] 既存 Leaf 関電が破壊的変更なし（互換性維持）
- [ ] Soil CLAUDE.md に整合運用を追記
