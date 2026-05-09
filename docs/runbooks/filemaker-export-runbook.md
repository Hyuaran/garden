# FileMaker → Garden-Soil Phase 2 取込 運用 Runbook

対応 spec: `docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md`
作成: 2026-05-09（a-soil-002、Phase B-01 Phase 2 実装）

---

## 概要

FileMaker（旧 顧客管理システム）から CSV をエクスポートし、Garden-Soil の `soil_lists` テーブルへ約 200 万件を取り込む運用手順。Phase 1（Kintone API 30 万件、実装完了）に続く Phase 2。

**所要時間目安**: 一晩（~3-4 時間、INDEX 再構築含む）
**実施者**: 東海林さん（admin / super_admin 権限）
**実施頻度**: 初回 1 回（2026-05-13 統合テスト想定）+ 必要時の追加取込

---

## 0. 事前準備（実施前日まで）

### 0-1. 必須環境変数の確認

`.env.local` または PowerShell `$env:` に以下が設定されていること:

```
NEXT_PUBLIC_SUPABASE_URL=（garden-dev or garden-prod の URL）
SUPABASE_SERVICE_ROLE_KEY=（service role key、admin 専用）
```

### 0-2. migrations 適用済確認

Supabase Dashboard > SQL Editor で以下が実行済であること:

```sql
-- 既存 7 本（Phase 1 実装時に apply 想定）
-- 20260507000001_soil_lists.sql
-- 20260507000002_soil_call_history.sql
-- 20260507000003_soil_rls.sql
-- 20260507000004_leaf_kanden_soil_link.sql
-- 20260507000005_soil_indexes.sql
-- 20260507000006_soil_handle_pd_number_change.sql
-- 20260507000007_soil_imports_staging.sql

-- Phase 2 用追加
-- 20260509000001_soil_phase2_index_helpers.sql
```

確認クエリ（SQL Editor）:

```sql
-- INDEX ヘルパー関数が存在するか
select exists (
  select 1 from pg_proc
  where proname = 'soil_phase2_drop_bulk_load_indexes'
    and pronamespace = 'public'::regnamespace
);

-- staging テーブルが存在するか
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'soil_imports_staging'
);
```

両方 `true` なら OK。

### 0-3. ディスク空き容量の確認

- CSV 元ファイル: ~500MB-1GB
- staging テーブル: ~1-2GB（解凍 + 一時保持）
- soil_lists 増加: ~1-1.5GB（200 万件 INSERT）
- INDEX 再構築一時領域: ~500MB-1GB

→ Supabase ダッシュボードで現状ストレージ使用量 + 残容量を確認。Pro プラン 8GB 上限で 6GB 以上残っていれば安全。

---

## 1. FileMaker からの CSV エクスポート

### 1-1. FileMaker 操作手順

1. FileMaker Pro を起動、ログイン
2. 「リスト本体」レイアウト（または同等の顧客マスタ レイアウト）を開く
3. ナビゲーションメニュー > 「すべてのレコードを表示」
4. 検索条件:
   - 削除済除外（既定）
   - active / casecreated / churned / donotcall を含む
   - 廃棄レコードは除外
5. ファイル > エクスポート > **CSV (Comma-Separated Values)** 選択
6. 保存先: `C:\garden\imports\filemaker-list-export-YYYYMMDD-HHMM.csv`
7. エクスポートオプション:
   - 文字エンコーディング: **UTF-8**
   - BOM: **付ける**
   - 改行: **LF**（Unix 標準、PostgreSQL COPY 互換）
   - 区切り: **カンマ**
   - 引用: **ダブルクォート**（カンマ・改行を含むセル）
   - フィールド名を 1 行目に出力: **ON**
8. エクスポートする列を以下の順で選択:

#### 必須列（spec §3.2 準拠）

| 順 | 列名（CSV ヘッダー）| FileMaker フィールド | soil_lists 列 |
|---|---|---|---|
| 1 | `管理番号` | 管理番号 | list_no + source_record_id |
| 2 | `個人法人区分` | 顧客区分 | customer_type |
| 3 | `漢字氏名` | 顧客氏名（漢字）| name_kanji |
| 4 | `カナ氏名` | 顧客氏名（カナ）| name_kana |
| 5 | `法人名` | 法人名（法人時のみ）| name_kanji（法人時優先） |
| 6 | `代表者名` | 代表者名（法人時のみ）| representative_name_kanji |
| 7 | `電話番号1` | 電話番号 1 | phone_primary |
| 8 | `電話番号2` | 電話番号 2 | phone_alternates[0] |
| 9 | `メール` | メールアドレス | email_primary |
| 10 | `郵便番号` | 郵便番号 | postal_code |
| 11 | `都道府県` | 都道府県 | prefecture |
| 12 | `市区町村` | 市区町村 | city |
| 13 | `住所` | 番地・建物名 | address_line |
| 14 | `業種` | 業種分類 | industry_type |
| 15 | `規模` | 法人規模（極小/小/中/大）| business_size |
| 16 | `ステータス` | active / churned 等 | status |

> **重要**: 列名は **厳守**。Adapter が日本語列名を直接マッピングするため、列名揺れがあると取込失敗。

### 1-2. CSV 検証（簡易）

PowerShell で:

```powershell
# 1. 件数確認（ヘッダー行 + データ行）
(Get-Content "C:\garden\imports\filemaker-list-export-YYYYMMDD-HHMM.csv" -Encoding UTF8 | Measure-Object -Line).Lines

# 2. ヘッダー確認
Get-Content "C:\garden\imports\filemaker-list-export-YYYYMMDD-HHMM.csv" -Encoding UTF8 -TotalCount 1
```

期待値:
- 件数: 約 200 万件 + 1（ヘッダー）
- ヘッダー: `管理番号,個人法人区分,漢字氏名,...` の順で 16 列

---

## 2. 取込前準備（DB 側）

### 2-1. INDEX OFF（Supabase Dashboard SQL Editor）

```sql
select * from public.soil_phase2_drop_bulk_load_indexes();
```

返却（12 行）:

| dropped_index | sql_executed |
|---|---|
| idx_soil_lists_phone_primary | drop index if exists public."idx_soil_lists_phone_primary" |
| ... | ... |

確認:

```sql
select * from public.soil_phase2_count_bulk_load_indexes();
-- 全 false（drop 済）であれば OK
-- UNIQUE INDEX（idx_soil_lists_source / uq_soil_lists_supply_point_22）は残ること
```

### 2-2. import job レコード作成

Garden Web UI（推奨）:
1. ブラウザで `https://<garden-domain>/soil/admin/imports` を開く（admin 権限必要）
2. 右上の **「+ Phase 2 取込ジョブ作成」** ボタンをクリック
3. CSV ファイル名を入力（例: `filemaker-list-export-20260513-2200.csv`）
4. メモ（任意）: 「α テスト本番取込」等
5. **「ジョブ作成」** をクリック
6. 表示される **Job ID（UUID）** をコピー

または SQL Editor で:

```sql
insert into public.soil_list_imports (
  source_system, source_label, job_status, notes
) values (
  'filemaker-list2024',
  'filemaker-list-export-20260513-2200.csv',
  'queued',
  'α テスト本番取込'
)
returning id;
```

→ 返却 UUID をメモ。

---

## 3. 取込実行

### 3-1. PowerShell から実行

```powershell
cd C:\garden\a-soil-002
npx tsx scripts/soil-import-csv-phase2.ts `
  "C:\garden\imports\filemaker-list-export-20260513-2200.csv" `
  "<job-id-uuid>" `
  10000
```

第 3 引数 `chunkSize` は省略可（既定 10,000）。

### 3-2. 進捗監視

別タブのブラウザで `/soil/admin/imports` を開いておく:
- 5 秒間隔で自動更新
- 状態バッジ: 🟦 実行中 → 🟢 完了
- 進捗 %: chunks_completed / chunks_total
- 成功/失敗件数: リアルタイム更新

### 3-3. 想定所要時間

| 段階 | 200 万件想定 |
|---|---|
| CSV ストリーミング読込 | ~30 分 |
| Transform | ~20 分（chunk 内処理） |
| Load（INDEX OFF 状態） | ~60 分 |
| **合計（取込のみ）** | **~2 時間** |

→ chunk 失敗があれば後続継続、最終集計に反映。

---

## 4. 取込後処理

### 4-1. 件数確認

```sql
select source_system, count(*) as cnt
from public.soil_lists
where deleted_at is null
group by source_system;
```

期待:
- `kintone-app-55`: 約 30 万件（Phase 1 既投入）
- `filemaker-list2024`: 約 200 万件（Phase 2 新規）
- 合計: 約 230 万件

### 4-2. INDEX 再構築（Supabase Dashboard SQL Editor）

`scripts/soil-phase2-recreate-indexes.sql` の内容を SQL Editor に貼付して Run:

- 12 INDEX を `CREATE INDEX CONCURRENTLY` で再作成
- 最後に `ANALYZE public.soil_lists;` で統計情報更新
- 確認: `select * from public.soil_phase2_count_bulk_load_indexes();` で全 `true`

想定所要時間（230 万件想定）:
- 通常 INDEX 7 本: 各 1-5 分
- GIN trigram 2 本: **30-60 分 each**（重い、夜間推奨）
- **合計**: 1.5-2 時間

### 4-3. Merge proposal 検出（Phase 1 / Phase 2 跨り重複）

soil-merge-detector の R1/R2/R3 検出を bulk SQL で実行（spec §5.3 の SQL を参照、または別途 admin script で実装）:

```sql
-- R1: phone_primary + name_kanji 完全一致
insert into public.soil_lists_merge_proposals
  (primary_list_id, duplicate_list_id, match_round, confidence, proposed_by)
select
  s1.id, s2.id, 'R1', 0.95, 'phase2_csv_import'
from public.soil_lists s1
join public.soil_lists s2 on
  s1.phone_primary = s2.phone_primary
  and s1.name_kanji = s2.name_kanji
  and s1.source_system = 'kintone-app-55'
  and s2.source_system = 'filemaker-list2024'
  and s1.deleted_at is null
  and s2.deleted_at is null
on conflict (primary_list_id, duplicate_list_id) do nothing;
```

想定検出件数: 5-15%（=10,000〜30,000 件）

### 4-4. EXPLAIN ANALYZE で主要クエリ確認

```sql
explain (analyze, buffers)
select count(*) from public.soil_lists
where phone_primary = '+81612345678' and deleted_at is null;
-- → INDEX scan が使われていれば OK（Seq Scan は ANALYZE 漏れ）

explain (analyze, buffers)
select count(*) from public.soil_lists
where name_kanji like '%山田%' and deleted_at is null;
-- → trigram GIN が使われていれば OK
```

p95 目標（spec #05 §2.1）:
- リスト一覧: 250ms 以内
- 名前部分一致: 500ms 以内

---

## 5. トラブルシューティング

### 5-1. CSV パースエラー（不正なクォート / BOM 不一致）

症状: スクリプトが途中停止 + `[soil-import-csv-phase2] fatal: ...`

対応:
1. CSV を再エクスポート（FileMaker 側でエンコーディング = UTF-8 BOM 確認）
2. PowerShell で `Get-FileEncoding` で UTF-8 確認
3. 該当行の特殊文字（混入する Shift-JIS 等）を確認
4. 修正後、`retry` ボタンで staging データ削除 + 再開

### 5-2. UNIQUE 制約違反（source_system + source_record_id 重複）

症状: 一部 chunk が失敗、`soil_imports_errors` に記録

対応:
- 既に Phase 1 取込で同じ FileMaker レコード ID が登録されているケース
- ON CONFLICT で UPDATE されるはず（spec §4.5）→ 通常はエラーにならない
- もしエラーが出たら CSV 側に重複行がある可能性 → CSV を調査

### 5-3. 取込中断（PC スリープ / ネットワーク断）

症状: スクリプトが途中で止まる

対応:
1. UI で `paused` または `failed` 状態を確認
2. 「再開」または「リトライ」ボタンを押下
3. スクリプトを再実行（同じ job_id を渡す）
4. chunks_completed が記録されているため、完了済 chunk はスキップして続きから実行

### 5-4. INDEX 再構築の CONCURRENTLY 失敗

症状: `ERROR:  could not create unique index ...` または `INDEX is INVALID`

対応:
1. SQL Editor で:
   ```sql
   drop index if exists public.<failed_index_name>;
   ```
2. `scripts/soil-phase2-recreate-indexes.sql` の該当行を再実行（CONCURRENTLY）
3. 失敗が再発する場合、`CONCURRENTLY` を外して通常 CREATE で実行（短時間ロック発生、Tree 営業時間外のみ）

### 5-5. 取込時間が想定の 3 倍以上

考えられる原因:
- INDEX OFF を忘れている → §2-1 を実行
- chunk_size が小さすぎる（既定 10,000、5,000 以下にしない）
- Supabase Pro プラン以下 → 一時的にプラン格上げ要

---

## 6. ロールバック手順

万一、取込後に致命的問題が判明した場合:

```sql
-- Phase 2 由来の全行を soft delete（hard delete は破壊的、避ける）
update public.soil_lists
set deleted_at = now(),
    deleted_by = auth.uid()::text,
    deleted_reason = 'phase2_rollback'
where source_system = 'filemaker-list2024'
  and deleted_at is null;

-- merge_proposals も soft delete
update public.soil_lists_merge_proposals
set deleted_at = now(),
    deleted_by = auth.uid()::text
where proposed_by = 'phase2_csv_import_cron'
  and deleted_at is null;

-- import job をキャンセル状態に
update public.soil_list_imports
set job_status = 'cancelled',
    completed_at = now(),
    notes = coalesce(notes, '') || ' [ROLLBACK ' || now() || ']'
where id = '<job-id>';
```

---

## 7. チェックリスト（実施前 / 実施後）

### 実施前
- [ ] migrations 7 + 1（Phase 2 helper）apply 済
- [ ] CSV エクスポート完了、件数確認、ヘッダー確認
- [ ] PowerShell から `npx tsx --version` で実行可能確認
- [ ] Supabase Dashboard で空き容量 6GB 以上
- [ ] Tree 営業時間外（22:00 以降推奨）

### 実施中
- [ ] INDEX DROP 実行（12 件 drop 確認）
- [ ] import job 作成 + Job ID 取得
- [ ] スクリプト実行開始、UI 進捗監視

### 実施後
- [ ] 件数確認（230 万件想定）
- [ ] INDEX 再構築（CONCURRENTLY、12 INDEX）
- [ ] ANALYZE 実行
- [ ] Merge proposal 検出（R1 5-15%）
- [ ] EXPLAIN ANALYZE で p95 確認
- [ ] cross_history_admin_actions 監査ログ確認

---

## 8. 関連ドキュメント

- `docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md` — Phase 2 spec 本体
- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md` — Phase 1（Kintone API）
- `docs/specs/2026-04-25-soil-04-import-strategy.md` — インポート戦略親書
- `docs/specs/2026-04-25-soil-05-index-performance.md` — INDEX 戦略
- `supabase/migrations/20260509000001_soil_phase2_index_helpers.sql` — INDEX helper 関数
- `scripts/soil-import-csv-phase2.ts` — 取込スクリプト本体
- `scripts/soil-phase2-recreate-indexes.sql` — INDEX 再構築スクリプト
- `src/lib/db/soil-import-csv-source.ts` — Adapter（CSV → SoilListInsert）
- `src/lib/db/soil-csv-parser.ts` — 自前 CSV パーサ
- `src/lib/db/soil-csv-importer.ts` — orchestrator
- `src/lib/db/soil-merge-detector.ts` — 重複検出ロジック

---

## 9. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-09 | v1.0 | 初版起草、Phase 2 実装と同時に作成 | a-soil-002 |
