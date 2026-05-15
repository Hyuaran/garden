# Soil Phase B-01 apply 運用 Runbook（rename + 8 migration 順次 apply）

対応 dispatch: main- No. 294（a-main-023、2026-05-11）
発見: audit-001- No. 15（a-audit-001、2026-05-11 17:15）silent NO-OP 罠 # 2
作成: 2026-05-11（a-soil-002）

---

## 概要

garden-dev に存在する旧 Tree D-01 残骸の `soil_call_history`（非 PARTITIONED、EMP-1324 等の実データ入り）を退避 rename し、Soil 仕様の 8 migration を順次 apply する手順。

**所要時間目安**: 30-45 分（rename 即時 + 8 migration apply + 各検証 SQL 確認）
**実施者**: 東海林さん（Supabase Dashboard SQL Editor から手動 Run）
**前提**: garden-dev 環境のみ。garden-prod 適用は東海林さん別途承認後。

---

## 1. 事前準備

### 1-1. 必要ファイル一覧

| # | ファイル | 役割 |
|---|---|---|
| 1 | supabase/migrations/20260511170000_rename_legacy_soil_call_history.sql | legacy table rename |
| 2 | scripts/soil-phase-b01-preflight.sql | rename 前後の状態把握（全 8 セクション） |
| 3 | scripts/soil-phase-b01-verify.sql | 各 migration 後の検証 SQL（9 セクション） |
| 4 | supabase/migrations/20260507000001_soil_lists.sql | リスト本体 + 補助 4 テーブル |
| 5 | supabase/migrations/20260507000002_soil_call_history.sql | コール履歴（PARTITIONED） |
| 6 | supabase/migrations/20260507000003_soil_rls.sql | RLS 7 ロール + helper 関数 |
| 7 | supabase/migrations/20260507000004_leaf_kanden_soil_link.sql | Leaf 関電列追加 |
| 8 | supabase/migrations/20260507000005_soil_indexes.sql | 性能 INDEX + pg_trgm |
| 9 | supabase/migrations/20260507000006_soil_handle_pd_number_change.sql | pd_number 履歴 DB 関数 |
| 10 | supabase/migrations/20260507000007_soil_imports_staging.sql | staging tables 3 件 |
| 11 | supabase/migrations/20260509000001_soil_phase2_index_helpers.sql | Phase 2 INDEX OFF/ON helper |

### 1-2. preflight 実行（必須、apply 開始前）

Supabase Dashboard > SQL Editor で `scripts/soil-phase-b01-preflight.sql` の各セクションを順次 Run し、結果を以下に転記:

| Section | 確認内容 | 結果 |
|---|---|---|
| 1 | Soil 関連テーブル現状 | （結果転記） |
| 2 | legacy soil_call_history 列構造 | （結果転記） |
| 3 | legacy soil_call_history 行数 | （結果転記） |
| 4 | inbound FK（Tree 等→legacy 参照）| （結果転記） |
| 5 | legacy INDEX 一覧 | （結果転記） |
| 6 | legacy トリガー一覧 | （結果転記） |
| 7 | Soil テーブル apply 状況 | （結果転記） |
| 8 | 既存 PostgreSQL 拡張 | （結果転記） |

これら結果を a-main-023 / a-tree-002 に共有（Tree D-01 spec 修正 # 290 の入力資料）。

---

## 2. apply 手順（11 ステップ、順序固定）

### Step 0. preflight 結果確認 + 退避 OK 判定

- legacy `soil_call_history` が **非 PARTITIONED** であることを §1-2 Section 2 で確認
- inbound FK が想定範囲内であることを §1-2 Section 4 で確認
- すでに `soil_call_history_legacy_tree_20260511` が存在しないことを §1-2 Section 1 で確認

**判定 OK** なら Step 1 へ。**判定 NG**（例: 既に PARTITIONED）なら a-main-023 にエスカレーション、apply 中止。

---

### Step 1. rename migration apply

- Supabase Dashboard > SQL Editor
- `supabase/migrations/20260511170000_rename_legacy_soil_call_history.sql` の全内容を貼付して Run
- 期待出力（NOTICE）:
  - `[rename-legacy] 既存 soil_call_history（非 PARTITIONED）の行数: NNN`
  - `[rename-legacy] ✅ ALTER TABLE soil_call_history RENAME TO soil_call_history_legacy_tree_20260511 完了`
  - `[rename-legacy] rename 後 soil_call_history_legacy_tree_20260511 の行数: NNN`
  - `[rename-legacy] ✅ soil_call_history 名が空きスロットになりました`
  - `[rename-legacy] テーブル comment 付与完了`

**検証**: `scripts/soil-phase-b01-verify.sql` の Section 0 を Run。

---

### Step 2. 20260507000001_soil_lists.sql apply

- Supabase Dashboard > SQL Editor で全内容を貼付して Run
- 期待: soil_lists + 補助 3 テーブル（soil_list_imports / soil_list_tags / soil_lists_merge_proposals）が作成

**検証**: verify.sql の Section 1 を Run。

---

### Step 3. 20260507000002_soil_call_history.sql apply

- Supabase Dashboard > SQL Editor で全内容を貼付して Run
- 期待:
  - soil_call_history が **PARTITIONED** で作成（PARTITION BY RANGE (call_datetime)）
  - 16 月次パーティション（2025-05〜2026-08）+ default パーティション計 17 件
  - compute_duration トリガー登録

**検証**: verify.sql の Section 2 を Run。特に partition_status = ✅ PARTITIONED を確認。

---

### Step 4. 20260507000003_soil_rls.sql apply

- Supabase Dashboard > SQL Editor で全内容を貼付して Run
- 期待:
  - 全 Soil テーブルで RLS 有効化
  - helper 関数（current_garden_role / current_department_id）作成
  - Materialized View（soil_lists_assignments）作成
  - refresh_soil_lists_assignments 関数作成

**検証**: verify.sql の Section 3 を Run。

---

### Step 5. 20260507000004_leaf_kanden_soil_link.sql apply

- 注: leaf_kanden_cases テーブル既存なら ALTER ADD COLUMN（列追加のみ）、未存在なら CREATE 含む。
- Supabase Dashboard > SQL Editor で全内容を貼付して Run

**検証**: verify.sql の Section 4 を Run。

---

### Step 6. 20260507000005_soil_indexes.sql apply

- Supabase Dashboard > SQL Editor で全内容を貼付して Run
- 期待:
  - pg_trgm 拡張有効化
  - trigram GIN INDEX 2 件（name / address）
  - 業種×地域複合 INDEX 等

**検証**: verify.sql の Section 5 を Run。空テーブルなので INDEX 作成は瞬時。

---

### Step 7. 20260507000006_soil_handle_pd_number_change.sql apply

- Supabase Dashboard > SQL Editor で全内容を貼付して Run
- 期待: handle_pd_number_change DB 関数作成

**検証**: verify.sql の Section 6 を Run。

---

### Step 8. 20260507000007_soil_imports_staging.sql apply

- Supabase Dashboard > SQL Editor で全内容を貼付して Run
- 期待: staging tables 3 件（soil_imports_staging / soil_imports_normalized / soil_imports_errors）

**検証**: verify.sql の Section 7 を Run。

---

### Step 9. 20260509000001_soil_phase2_index_helpers.sql apply

- Supabase Dashboard > SQL Editor で全内容を貼付して Run
- 期待: Phase 2 INDEX helper 関数 2 件（drop / count）

**検証**: verify.sql の Section 8 を Run。

---

### Step 10. 最終総合確認

verify.sql の Section 9 を Run:
- Soil 関連テーブル約 25 件存在
- Soil 関連関数約 9 件存在
- legacy table の行数が preflight §3 結果と完全一致（データ保護）

---

## 3. 実行結果記録欄（apply 当日に記入）

| Step | 実行日時 | 結果 | 想定外 NOTICE / エラー |
|---|---|---|---|
| 0 (preflight) | | | |
| 1 (rename) | | | |
| 2 (soil_lists) | | | |
| 3 (soil_call_history) | | | |
| 4 (soil_rls) | | | |
| 5 (leaf_kanden_soil_link) | | | |
| 6 (soil_indexes) | | | |
| 7 (handle_pd_number_change) | | | |
| 8 (soil_imports_staging) | | | |
| 9 (soil_phase2_index_helpers) | | | |
| 10 (最終確認) | | | |

---

## 4. トラブルシューティング

### 4-1. Step 1 (rename) で "既に PARTITIONED" 判定

→ Soil 仕様の soil_call_history がすでに apply 済の可能性。preflight Section 2 の partition_status と比較し、想定外なら apply 中止 + a-main-023 にエスカレーション。

### 4-2. Step 2-9 で "column does not exist" エラー

→ Step 1 が未実行 or 未完了の可能性。Step 0 から再確認。
→ または migration 内の依存列が前 Step で作成されていない。verify.sql の前 Step Section を再 Run して必要列・テーブル存在を確認。

### 4-3. Step 3 で "PARTITION key already in use" エラー

→ Step 1 (rename) で legacy が空きスロットにならず（先行 PARTITIONED で残存）の可能性。
→ `drop table if exists public.soil_call_history;` で空きスロット化（**legacy 退避済なら安全**）後、Step 3 を再 Run。

### 4-4. RLS が原因で SELECT が空になる（Step 4 後）

→ 期待動作（admin / super_admin のみ閲覧可、それ以外は空配列）。
→ Supabase Dashboard で role を切替して動作確認。詳細は spec docs/specs/2026-04-25-soil-06-rls.md 参照。

---

## 5. ロールバック手順

### 5-1. Step 1 (rename) だけのロールバック

```sql
-- 元に戻す（Step 2 以降が未実行の場合）
alter table public.soil_call_history_legacy_tree_20260511
  rename to soil_call_history;
```

### 5-2. Step 2-9 のロールバック

migration 個別の DROP SQL を手動で書く。Soil 系全テーブルを一気に DROP する場合は破壊的:
```sql
-- 危険、慎重に
drop table if exists public.soil_imports_errors cascade;
drop table if exists public.soil_imports_normalized cascade;
drop table if exists public.soil_imports_staging cascade;
drop table if exists public.soil_lists_merge_proposals cascade;
drop table if exists public.soil_list_tags cascade;
drop table if exists public.soil_list_imports cascade;
drop table if exists public.soil_call_history cascade;  -- 全パーティション cascade で削除
drop table if exists public.soil_lists cascade;
drop function if exists public.current_garden_role() cascade;
drop function if exists public.current_department_id() cascade;
drop function if exists public.handle_pd_number_change(uuid, jsonb, jsonb, text) cascade;
drop function if exists public.soil_phase2_drop_bulk_load_indexes() cascade;
drop function if exists public.soil_phase2_count_bulk_load_indexes() cascade;
-- pg_trgm は他モジュールが使うため drop しない
```

→ legacy 退避テーブル `soil_call_history_legacy_tree_20260511` はロールバック対象外（保護維持）。

---

## 6. apply 後の連携

### 6-1. a-tree-002 への通知

- Tree D-01 spec 修正（# 290）の入力資料として:
  - preflight §1-2 の Section 2 (legacy 列構造) を提示
  - preflight §1-2 の Section 4 (inbound FK) を提示
  - 新 Soil 仕様の soil_call_history 列構造（migration 000002 §1 参照）を提示
- 修正後の Tree D-01 spec で参照先を `soil_call_history`（Soil 仕様）に切替
- legacy テーブルのデータ移行は別 migration で a-tree-002 主導

### 6-2. a-main-023 への報告

- apply 完走後、soil-64 以降の dispatch で報告:
  - 各 Step の実行結果（§3 表）
  - preflight 結果サマリ
  - verify.sql の最終 Section 9 結果

### 6-3. 5/12-13 Phase 2 取込との接続

- 本 runbook の apply は **schema のみ**、データ投入なし
- 5/12 sample 200 件 α テスト / 5/13 本番 200 万件投入は別 runbook
  - 参照: docs/runbooks/filemaker-export-runbook.md（Phase 2 取込手順）
- INDEX OFF/ON の運用は本 runbook Step 9 で apply 済 helper 関数を使う

---

## 7. チェックリスト（apply 当日）

### 開始前
- [ ] 本ファイル + verify.sql + preflight.sql + 8 migration が手元に揃っている
- [ ] preflight 実行 + §1-2 結果転記完了
- [ ] preflight §1-2 Section 2 で legacy soil_call_history が **非 PARTITIONED** 確認
- [ ] preflight §1-2 Section 4 の inbound FK を a-tree-002 に共有
- [ ] garden-dev 環境であることを確認（garden-prod ではない）

### 進行中
- [ ] Step 1 NOTICE で "✅ 完了" 確認
- [ ] Step 2-9 で各 verify.sql Section を Run、期待値と一致
- [ ] エラー / 想定外 NOTICE は §3 表に記録 + §4 トラブルシューティング参照

### 完了後
- [ ] Step 10 verify.sql Section 9 で全テーブル + 関数存在確認
- [ ] legacy table の行数が preflight §3 と一致（データ保護）
- [ ] a-main-023 / a-tree-002 に結果共有 dispatch 送信
- [ ] 5/12 Phase 2 α テスト準備（filemaker-export-runbook.md §0-2）

---

## 8. 関連ドキュメント

- docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（Phase 1 spec）
- docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md（Phase 2 spec）
- docs/runbooks/filemaker-export-runbook.md（Phase 2 取込 runbook、本 runbook 完了後に使う）
- 全 8 migration ファイル（supabase/migrations/2026050[7-9]*.sql）

---

## 9. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-11 | v1.0 | 初版起草（main- No. 294 受領 + audit-001- No. 15 罠 # 2 解消） | a-soil-002 |
