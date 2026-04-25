# Soil #03: 関電リスト Leaf 連携設計

- 対象: Garden-Soil の `soil_lists` と Garden-Leaf 関電 `leaf_kanden_cases` の連携設計
- 優先度: **🔴 高**（Phase B-1 で関電業務委託が現場投入、Soil 構築先行のため）
- 見積: **0.5d**
- 担当セッション: a-soil（Soil 側）/ a-leaf（Leaf 側）/ a-bloom（横断レビュー）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #03）
- 前提:
  - `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md`（Kintone App 55 の 74 フィールド分析）
  - `docs/specs/2026-04-25-soil-01-list-master-schema.md`
  - 既存 `leaf_kanden_cases`（稼働中）
  - `docs/specs/leaf/spec-leaf-kanden-phase-c-*.md`

---

## 1. 目的とスコープ

### 1.1 目的

関電業務委託は Phase B-1 で現場投入される **Garden 最初の量産業務**。Soil（顧客マスタ）と Leaf（関電案件マスタ）の役割を**明確に分離**し、データ整合性を保ちながら**両側で必要な情報を過不足なく持つ**設計を確定する。

### 1.2 含めるもの

- Soil `soil_lists` ↔ Leaf `leaf_kanden_cases` の境界線（どの列がどちらに属するか）
- 案件化時の Leaf 作成フロー（Soil から Leaf へ）
- 案件離脱時の Soil 状態変化
- Kintone App 55 の 74 フィールドの **Soil / Leaf 振り分けマップ**
- 移行時の整合性チェック

### 1.3 含めないもの

- Soil 全体スキーマ → #01
- Kintone から Soil への移行手順 → #04
- Leaf 関電の既存仕様 → 既存 spec
- 他商材（光・クレカ等）→ Phase C

---

## 2. 役割分離の原則

### 2.1 1 リスト = 1 顧客（商材横断）

`soil_lists.id`（uuid）は **顧客ベース**。同じ顧客が関電 + 光の 2 商材で案件化したら:

```
soil_lists (1 件)
  ├─ leaf_kanden_cases (1 件、関電案件)
  └─ leaf_hikari_cases (1 件、光案件)
```

`leaf_kanden_cases.soil_list_id` は両方とも同じ `soil_lists.id`。

### 2.2 Soil に置く列の判断基準

> **「商材を問わず使う情報」「将来別商材でも使い回せる情報」は Soil**

- 名前 / 住所 / 電話 / 業種 / 法人個人区分 → Soil
- 関電固有の契約番号・契約種別・容量 → Leaf
- 営業の囲込み実績（電気使用量等）→ Leaf（関電商談固有）

### 2.3 Leaf に置く列の判断基準

> **「商材依存」「商談・契約・進捗に関わる情報」は Leaf**

- お客様番号（関電内部 ID）→ Leaf
- 契約種別（なっトクでんき / 従量電灯 等）→ Leaf
- 月間使用量・年間使用量（営業数値）→ Leaf
- 囲込みフロー（DM 発送日・架電日等）→ Leaf

---

## 3. Kintone App 55 の 74 フィールド振り分けマップ

### 3.1 Soil（顧客マスタ）に行く列

| Kintone | Soil カラム | 備考 |
|---|---|---|
| 管理番号 1 | `soil_lists.list_no` | UNIQUE 制約 |
| リスト名 | `soil_lists.source_label` 経由（imports テーブル） | 「2024 春季リスト」等 |
| 現契約名義_漢字 | `soil_lists.name_kanji` | |
| 現契約名義_カナ | `soil_lists.name_kana` | |
| 現使用場所住所_郵便/1/2 | `soil_lists.addresses_jsonb.usage` | |
| 現請求先住所_郵便/1/2 | `soil_lists.addresses_jsonb.billing` | + ミラー列 |
| 電話番号 1 / 2 | `soil_lists.phone_primary` / `phone_alternates` | 重複は alternates へ |
| 業種 | `soil_lists.industry_type` | 正規化辞書経由 |
| 重複 | `soil_lists.phone_alternates` の type | フラグとして alternates に格納 |

### 3.2 Leaf 関電（商材マスタ）に行く列

| Kintone | Leaf カラム | 備考 |
|---|---|---|
| 管理番号 2 / 3 | `leaf_kanden_cases.case_no_2 / _3` | 関電社内別運用 |
| ブレーカー_管理番号 | `leaf_kanden_cases.breaker_case_no` | 別商材連携 |
| D_電気 ID | `leaf_kanden_cases.kepco_electricity_id` | 関電内部 |
| お客様番号 | `leaf_kanden_cases.customer_no` | |
| ブレーカー_お客様番号 | `leaf_kanden_cases.breaker_customer_no` | |
| 契約種別 | `leaf_kanden_cases.contract_type` | enum |
| 動力契約 | `leaf_kanden_cases.dynamic_contract` | enum |
| 関電ガス契約 | `leaf_kanden_cases.kanden_gas_contract` | enum |
| 契約容量_従 B / 動力 | `leaf_kanden_cases.contract_capacity_jb / _dynamic` | |
| ブレーカー_動力契約容量 / 提案契約 | `leaf_kanden_cases.breaker_dynamic_capacity / _proposal_kw` | |
| 月間平均使用量_電灯 / 動力 | `leaf_kanden_cases.monthly_avg_usage_lighting / _dynamic` | |
| 年間合計使用量_電灯 | `leaf_kanden_cases.annual_total_usage_lighting` | |
| 囲込_電気使用量 1〜12 | `leaf_kanden_cases.enclosure_usage_m1 〜 m12` | 12 列 |
| 囲込_デマンド | `leaf_kanden_cases.enclosure_demand` | |
| 囲込_現料金 | `leaf_kanden_cases.enclosure_current_fee` | |
| 囲込_なっトクでんき変更後 / メリット額 | `leaf_kanden_cases.enclosure_after_change / _merit_amount` | |
| 囲込_電気単独変更後 / メリット額 | `leaf_kanden_cases.enclosure_solo_after / _merit` | |
| 需要開始年月日 | `leaf_kanden_cases.service_start_date` | |
| 離脱時期 | `leaf_kanden_cases.churn_date` | |
| 囲込_DM 発送日 | `leaf_kanden_cases.enclosure_dm_sent_date` | |

### 3.3 営業活動・進捗系（残り約 30 フィールド、すべて Leaf）

- ステータス・担当者・期限・コメント等は **すべて `leaf_kanden_cases`** に格納
- Soil 側は「案件化されたかどうか」だけを `status='casecreated'` で表現

---

## 4. リレーション設計

### 4.1 ER 図

```
soil_lists (1) ───┬─── (0..n) leaf_kanden_cases.soil_list_id
                  │
                  ├─── (0..n) leaf_hikari_cases.soil_list_id
                  │
                  └─── (0..n) leaf_*.soil_list_id
```

- `leaf_kanden_cases.soil_list_id` は **NULL 許容**（飛び込み案件で list 不在を許容）
- ただし Phase B-1 では「案件は必ず Soil 経由」を運用ルールにし、NULL を例外扱い

### 4.2 整合性制約

```sql
-- leaf_kanden_cases に Soil 不在を許容するが、後付け補完の余地を残す
ALTER TABLE leaf_kanden_cases ADD COLUMN soil_list_id uuid REFERENCES soil_lists(id);

-- 飛び込み案件の Soil 補完支援用
CREATE INDEX idx_leaf_kanden_cases_soil_list_null
  ON leaf_kanden_cases (created_at)
  WHERE soil_list_id IS NULL;
```

`soil_list_id IS NULL` の Leaf は **管理画面で警告表示**、月次で Soil への補完作業を促す。

### 4.3 案件化時のフロー

```
Tree 架電中、商談確定（call_mode='leaf' / outcome='appointment_set'）
  ↓
Tree → /api/leaf/kanden/cases [POST] で案件作成
  ↓
Server Action:
  1. soil_lists.status を 'casecreated' に更新
  2. soil_lists.primary_case_module = 'leaf_kanden'
     soil_lists.primary_case_id = (新 leaf_kanden_cases.id)
     soil_lists.case_count += 1
  3. leaf_kanden_cases に新規 INSERT、soil_list_id 紐付け
  4. 監査ログ
```

トランザクション 1 つで完結（Postgres の `BEGIN ... COMMIT`）。

### 4.4 案件離脱時のフロー

```
Leaf で「離脱」操作（leaf_kanden_cases.churn_date 設定）
  ↓
Server Action:
  1. leaf_kanden_cases.status を 'churned' に更新
  2. soil_lists の他に active な leaf 案件がなければ、soil_lists.status を 'churned' に
     （他の Leaf 商材で active があれば soil_lists は active のまま）
  3. soil_lists.case_count は減らさない（履歴として）
```

---

## 5. 既存 `leaf_kanden_cases` への影響

### 5.1 既存スキーマとの差分

既存 spec（`docs/specs/leaf/spec-leaf-kanden-phase-c-01-schema-migration.md`）に既に多くのフィールドあり。本 spec では:

- `soil_list_id` カラムを**新規追加**
- 既存レコードは **soil 移行時に紐付け**（NULL のまま放置 → 段階的補完）
- 一部営業数値カラム（enclosure_*）は既に `leaf_kanden_cases` 側で実装済 → スキーマ変更なし

### 5.2 移行時の注意

- 既存 Leaf 関電稼働中のため、**`leaf_kanden_cases` の破壊的変更は禁止**
- `soil_list_id` 追加は ADD COLUMN（NULL 許容）で互換性維持
- 既存の Kintone 移行データを Soil に流し、後から `soil_list_id` を後付け UPDATE

### 5.3 後付け UPDATE のロジック

```sql
-- 電話番号 + 名前一致でマッチング
UPDATE leaf_kanden_cases lk
SET soil_list_id = sl.id
FROM soil_lists sl
WHERE lk.soil_list_id IS NULL
  AND lk.phone_number = sl.phone_primary
  AND lk.customer_name = sl.name_kanji;

-- 結果を確認、未マッチを管理画面で表示 → 手動補完
```

---

## 6. 業務シーンの整合性

### 6.1 シーン A: 同じ顧客に光と関電の 2 商材

```
soil_lists (山田太郎、電話番号 080-...)
  ├─ leaf_kanden_cases (関電契約)
  └─ leaf_hikari_cases (光契約)
```

- Soil 側で「関連案件 2 件」と表示
- どちらかが離脱しても Soil の status は active

### 6.2 シーン B: 関電案件中に飛び込み追加

```
sale 担当が訪問先で別顧客（リストにない）に新規契約
  ↓
leaf_kanden_cases.soil_list_id = NULL のまま作成
  ↓
管理画面で警告 → 月次で Soil 補完
```

### 6.3 シーン C: 重複統合

```
soil_lists A (旧) と soil_lists B (新) が同一顧客と判明
  ↓
A.merged_into_id = B.id 設定
A.status = 'merged' 設定
  ↓
A に紐付いていた leaf_kanden_cases.soil_list_id を B に付け替え
  ↓
A は表示から除外（削除しない）
```

---

## 7. RLS（要点、詳細 #06）

### 7.1 案件化済リストの参照

- staff（関電担当営業）は自分が担当している `leaf_kanden_cases.assigned_to = auth.uid()` の `soil_list_id` のみ参照可
- manager+ は全件
- これは #06 の RLS 設計と整合

### 7.2 Tree 架電時の参照

- 架電中は `soil_lists.status = 'active' AND donotcall_reason IS NULL` のみ参照
- 担当者割当は Tree 側のセグメントロジックで決定

---

## 8. 監査ログとの連動

### 8.1 案件化のログ

```sql
INSERT INTO operation_logs (
  user_id, module, action, target_type, target_id, details
) VALUES (
  auth.uid(),
  'leaf_kanden',
  'create',
  'leaf_kanden_cases',
  (新 leaf_kanden_cases.id),
  jsonb_build_object(
    'soil_list_id', $soil_list_id,
    'from_call_id', $call_id  -- どのコールから案件化したか
  )
);
```

### 8.2 離脱のログ

```sql
INSERT INTO operation_logs (...) VALUES (
  ..., 'churn', ..., jsonb_build_object('churn_date', ..., 'reason', ...)
);
```

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `leaf_kanden_cases.soil_list_id` ADD COLUMN | a-leaf | 0.25h |
| 2 | 案件化時の Server Action（Soil 状態更新 + Leaf 作成）| a-leaf + a-soil | 1h |
| 3 | 離脱時の Server Action（Soil 状態判定）| a-leaf + a-soil | 0.5h |
| 4 | 後付け soil_list_id UPDATE バッチ | a-soil | 0.5h |
| 5 | 管理画面の警告表示（soil_list_id IS NULL）| a-leaf | 0.5h |
| 6 | 重複統合フロー（merge）UI + ロジック | a-soil | 1h |
| 7 | 単体 + 統合テスト | a-soil + a-leaf | 1h |

合計: 約 4.75h ≈ 0.5d

---

## 10. 既知のリスクと対策

### 10.1 既存 `leaf_kanden_cases` データの大量 NULL

- 既存案件は全て `soil_list_id IS NULL`
- 対策: Soil インポート完了後、後付け UPDATE バッチを実行 → 残りは手動補完

### 10.2 Soil と Leaf で重複する列

- 名前・住所・電話番号は両方に持ちうる
- 対策: **Soil が真の値**、Leaf 側はキャッシュ（DB View で同期表示も可）。更新は Soil 側のみ可

### 10.3 飛び込み案件の Soil 補完忘れ

- `soil_list_id IS NULL` の Leaf が放置 → 月次集計で漏れ
- 対策: 管理画面で警告 + 月次 Cron で東海林さんに件数通知

### 10.4 重複統合時の参照切り替え漏れ

- A → B にマージ後、A を参照する Leaf が残る
- 対策: マージ時に**全 Leaf テーブルの soil_list_id を一括 UPDATE**（cascade like、Server Action で）

### 10.5 商材間で「同じ顧客」の判定がぶれる

- 関電は法人名で、光は代表者名で登録 → 別顧客扱い
- 対策: 重複検出は `phone_primary` 一致を最優先、名前は補助。マージ判断は人手

### 10.6 他商材の追加時のマップ修正

- Phase C で光・クレカ等が来たら Soil 側のマッピングを再考
- 対策: 本 spec を Phase C 着手時に**再レビュー**

---

## 11. 関連ドキュメント

- `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md`
- `docs/specs/2026-04-25-soil-01-list-master-schema.md`
- `docs/specs/2026-04-25-soil-04-import-strategy.md`
- `docs/specs/2026-04-25-soil-06-rls-design.md`
- `docs/specs/2026-04-25-soil-08-api-contracts.md`
- `docs/specs/leaf/spec-leaf-kanden-phase-c-01-schema-migration.md`
- 既存 Leaf 関電仕様

---

## 12. 受入基準（Definition of Done）

- [ ] `leaf_kanden_cases.soil_list_id` カラム追加済（既存データへの影響なし）
- [ ] Kintone 74 フィールドの Soil / Leaf 振り分けマップが東海林さんレビュー済
- [ ] 案件化 Server Action（Soil 状態更新 + Leaf 作成）が Trx 内で動作
- [ ] 離脱 Server Action（複数 Leaf の集約判定）が動作
- [ ] 後付け UPDATE バッチで既存 `leaf_kanden_cases` の少なくとも 80% に `soil_list_id` 紐付け
- [ ] `soil_list_id IS NULL` の警告 UI（admin 向け）動作
- [ ] 重複統合フロー（merge UI + cascade UPDATE）動作
- [ ] 単体 + 統合テスト pass
- [ ] Soil CLAUDE.md と Leaf CLAUDE.md にこの境界線を明記
