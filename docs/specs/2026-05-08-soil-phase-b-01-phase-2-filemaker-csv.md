# Soil Phase B-01 Phase 2: FileMaker CSV インポート（約 200 万件）

- 対象: Soil モジュール / `soil_lists` への FileMaker エクスポート CSV からの大量取込
- 優先度: 🟡 中（Phase 1 完走 + 1 週間運用後に着手）
- 見積: **1.5d**（COPY パイプライン + 既存実装の再利用、TDD 拡張含む）
- 担当セッション: a-soil（実装）/ a-bloom（レビュー観点）
- 作成: 2026-05-08（a-soil / Batch 20 = Soil Phase B-01 Phase 2 拡張）
- 前提:
  - **Batch 16 Soil 基盤 8 spec**（merge 済）
  - **Batch 19 Phase B 7 spec**（PR #127 OPEN）
  - **B-01 Phase 1 実装完成**（feature/soil-batch16-impl、Kintone API 30 万件）
  - **Phase 1 完走後 1 週間運用** で本番安定確認
  - 既存 staging テーブル群（`soil_imports_staging` / `soil_imports_normalized` / `soil_imports_errors`）

---

## 1. 目的とスコープ

### 1.1 目的

FileMaker（旧 顧客管理システム）からエクスポートした CSV、約 **200 万件** のリストデータを `soil_lists` に取り込み、Phase 1（Kintone 関電 30 万件）に続く Soil の母リスト規模を確保する。Phase 2 完了で：
- Tree（架電）が参照する全商材横断の母集団 230 万件相当を整備
- Bloom KPI が Phase C で参照する集計母数を確保
- 旧 FileMaker からの段階的データ移行第 2 フェーズを完走

### 1.2 含めるもの

- FileMaker エクスポート CSV の形式定義（列マッピング、エンコーディング、行数）
- Phase 1 との重複検出 + マージ提案フロー
- COPY 経由の高速取込（cursor API でなく一括）
- 200 万件規模での chunked load（10,000 件 / 1 trx）
- インデックス**後付け戦略**（取込中は INDEX OFF、完了後に CREATE INDEX）
- 取込前後の整合性検証（件数 / 重複 / NULL 必須列）
- 進捗 UI 拡張（既存 `/soil/admin/imports` を Phase 2 用に拡張）

### 1.3 含めないもの

- Phase 1 Kintone API 取込 → **B-01（実装完了）**
- Phase 3 旧 CSV 商材別取込（光・クレカ等 20 万件） → **後続 spec（Phase 3、別途起草）**
- Phase 1 と Phase 2 の取込結果の集約レポート → **B-07 監視・アラート Phase B**
- スキーマ変更（`soil_lists` 列追加・変更）→ **対象外、既存スキーマで運用**

---

## 2. Phase 1 / Phase 2 / Phase 3 の整理（再掲 + 詳細化）

| Phase | データソース | 件数 | 取込方式 | 着手時期 | 状態 |
|---|---|---|---|---|---|
| Phase 1 | Kintone App 55 関電リスト | 約 30 万件 | REST API（cursor / 500件単位） | 即時 | ✅ 実装完了 |
| **Phase 2（本 spec）** | **FileMaker エクスポート CSV** | **約 200 万件** | **CSV 手動取込（COPY）** | **Phase 1 完走 + 1 週間** | ⏳ **本 spec で起草** |
| Phase 3 | 旧システム CSV（光・クレカ等） | 約 20 万件 | CSV 手動取込（COPY、商材別） | Phase 2 完走後 | 後続 spec |

### Phase 2 完走の定義（DoD §11 と整合）

1. FileMaker エクスポート CSV 200 万件（または提供された全件）が `soil_lists` に取り込み完了
2. Phase 1 既投入分（Kintone 由来）との重複は `soil_lists_merge_proposals` に提案登録済
3. 取込前後の件数差分 = 0（または明示的に判定済の除外件数のみ）
4. インデックス再構築完了 + EXPLAIN ANALYZE で主要クエリ p95 目標達成
5. admin ダッシュボードで Phase 2 ジョブの完了ステータス表示

---

## 3. データソース（FileMaker CSV）

### 3.1 エクスポート手順（運用側）

FileMaker 側で東海林さんが以下を手動実行（手順書を別途 docs/runbooks/filemaker-export-runbook.md に整備）:

1. FileMaker から「リスト本体」レイアウトを開く
2. 「すべてのレコード」検索（既定: 削除済除外、active + casecreated + churned 含む）
3. **CSV エクスポート** で UTF-8 BOM + LF 改行で出力
4. ファイル名規約: `filemaker-list-export-YYYYMMDD-HHMM.csv`
5. 暗号化 ZIP に圧縮（パスワード = 別途 Chatwork DM 通達）
6. Google Drive 共有フォルダ `Garden_Soil_Imports/Phase2/` にアップロード
7. admin が `/soil/admin/imports` の「Phase 2 取込」ボタンから取込ジョブを開始

### 3.2 CSV フォーマット仕様

#### 必須列（FileMaker 側カラム → soil_lists 列）

| FileMaker カラム | soil_lists 列 | 型 | NULL 許容 |
|---|---|---|---|
| 管理番号 | `list_no` | text | 必須 |
| 個人法人区分 | `customer_type` | text | 必須（'individual' / 'corporate'）|
| 漢字氏名 | `name_kanji` | text | 必須 |
| カナ氏名 | `name_kana` | text | 推奨（normalizeKana 適用） |
| 法人名 | (法人時 `name_kanji` で上書き) | text | 法人時必須 |
| 代表者名 | `representative_name_kanji` | text | 法人時推奨 |
| 電話番号 1 | `phone_primary` | text | 推奨（normalizePhone 適用、+81 形式に正規化）|
| 電話番号 2 | `phone_alternates[0]` | jsonb 要素 | 任意 |
| メール | `email_primary` | text | 任意 |
| 郵便番号 | `postal_code` | text | 推奨 |
| 都道府県 | `prefecture` | text | 推奨 |
| 市区町村 | `city` | text | 推奨 |
| 住所 | `address_line` | text | 推奨 |
| 業種 | `industry_type` | text | 任意 |
| 規模 | `business_size` | text | 任意（'micro'/'small'/'medium'/'large'）|
| ステータス | `status` | text | 既定 'active' |

#### 識別系列

- `source_system` = `'filemaker-list2024'`（Phase 2 取込ジョブで一括設定）
- `source_record_id` = FileMaker レコード ID（管理番号と別軸の Unique）
- `source_channel` = `'filemaker_export'`
- `is_outside_list` = `false`（FileMaker 由来 = リスト内）

#### エンコーディング・改行・区切り

- 文字エンコーディング: **UTF-8 BOM 付き**（Excel 互換性確保）
- 改行: **LF**（Unix 標準、PostgreSQL COPY のデフォルト）
- 区切り: **カンマ**
- 引用: ダブルクォート（カンマ・改行を含むセル）
- ヘッダー: 1 行目に列名（FileMaker 標準）

### 3.3 想定件数と分割

- 全件取込で約 200 万件（実件数は FileMaker エクスポート時に確定）
- ファイルサイズ: ~500MB-1GB（列数・住所長さに依存）
- 1 ファイルでアップロード可、ただし staging テーブルに 1 ファイル全量を一括 COPY する想定

---

## 4. 取込パイプライン（Phase 1 との差分）

### 4.1 全体フロー

```
[FileMaker CSV (UTF-8 BOM, LF, ~500MB)]
       ↓ admin が /soil/admin/imports/phase2 から開始
[ scripts/soil-import-csv-phase2.ts（Node.js + npx tsx 実行）]
       ↓ 1. CSV → soil_imports_staging に COPY（一括、~1 分）
[ soil_imports_staging (raw row JSONB, no constraints) ]
       ↓ 2. Transform（chunkSize=10,000、batched）
       ↓    既存 normalizePhone / normalizeKana 再利用
[ soil_imports_normalized ]
       ↓ 3. Phase 1 既投入分との重複検出 + マージ提案
       ↓    R1: phone_primary + name_kanji
       ↓    R2: source_system='filemaker-list2024' + source_record_id
[ soil_lists_merge_proposals（自動 R1/R2 検出）]
       ↓ 4. Load (chunkSize=10,000、ON CONFLICT)
       ↓    INDEX 一時 OFF → 全件 INSERT 後に REINDEX
[ soil_lists (200 万件追加) ]
```

### 4.2 Phase 1 との差分一覧

| 観点 | Phase 1 (Kintone API) | Phase 2 (FileMaker CSV) |
|---|---|---|
| データソース | REST API cursor | CSV ファイル（暗号化 ZIP 解凍後） |
| 件数 | 約 30 万件 | 約 200 万件 |
| 取込方式 | cursor で 500 件 / req | COPY で一括 staging 投入 |
| chunk size | 5,000 件 / trx | **10,000 件 / trx**（規模拡大） |
| 進捗 UI | 既存 `/soil/admin/imports` | 同 UI で `source_system='filemaker-list2024'` でフィルタ |
| インデックス | 先付け（30 万件は許容範囲） | **後付け**（200 万件超は INDEX 一時 OFF 推奨、§7 参照） |
| マージ提案 | Phase 1 単独取込のため重複なし | **Phase 1 と Phase 2 の跨り重複を検出、merge_proposals 自動登録** |
| 取込時間 | 30 分〜1 時間（API レート制限依存） | **2-4 時間**（COPY 一括 + Transform/Load） |
| エラーリトライ | API 5xx で指数バックオフ | CSV パース失敗 / NOT NULL 制約違反 → soil_imports_errors |
| 着手時期 | 即時 | Phase 1 完走 + 1 週間運用後 |

### 4.3 chunkSize = 10,000 の根拠

- Phase 1（5,000）は API レート制限考慮の上限
- Phase 2 は API 不在、DB 一括 INSERT で trx granularity 重視
- 200 万件 ÷ 10,000 = 200 chunks（resumable な単位）
- 1 chunk = 1 trx で失敗時の rollback 影響範囲を抑制
- 1 chunk あたり所要時間 ~3-5 秒目安（Supabase Pro プランで実績見込み）

### 4.4 既存実装の再利用

Phase 1 で実装した以下を Phase 2 でも再利用:
- `src/lib/db/soil-helpers.ts`（normalizePhone / normalizeKana / buildSoftDeletePayload）
- `src/lib/db/soil-import-load.ts`（loadNormalizedToSoilLists、ON CONFLICT 上書き挙動も同じ）
- `src/lib/db/soil-importer.ts`（runSoilImport の chunk pipeline、source 切替で再利用）
- `src/lib/db/soil-import-actions.ts`（start / pause / resume / retry / cancel、既存通り）
- `src/app/soil/admin/imports/page.tsx`（既存 UI、source_system フィルタで Phase 2 対応）

### 4.5 Phase 2 固有の新規実装

#### 新規ファイル（実装フェーズで作成）

| ファイル | 役割 |
|---|---|
| `scripts/soil-import-csv-phase2.ts` | Node.js script、CSV → staging COPY を実行 |
| `src/lib/db/soil-import-csv-source.ts` | CSV 行を KintoneApp55Record 互換形に変換する Adapter |
| `src/lib/db/__tests__/soil-import-csv-source.test.ts` | TDD（CSV パース / 列マッピング） |
| `src/lib/db/soil-merge-detector.ts` | Phase 1 既投入分との重複検出 + merge_proposals 登録 |
| `src/lib/db/__tests__/soil-merge-detector.test.ts` | TDD（R1/R2 検出ロジック） |

#### COPY コマンド（PostgreSQL 経由）

```sql
-- staging への COPY（admin スクリプトが psql で実行 or supabase service_role で発火）
COPY public.soil_imports_staging (raw_payload, source_system, source_record_id, import_job_id, chunk_id, fetched_at)
FROM PROGRAM 'cat /tmp/filemaker-list-export-YYYYMMDD.csv | csv-to-jsonb-converter'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8', DELIMITER ',', QUOTE '"');
```

実装上は Node.js script で CSV を 1 行ずつ読み、jsonb 変換しつつ INSERT が現実的（Supabase の COPY 直叩きは制約あり）:

```typescript
// scripts/soil-import-csv-phase2.ts（擬似コード）
import { parse } from "csv-parse";
import { createReadStream } from "fs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function importCsvToStaging(
  filePath: string,
  importJobId: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const parser = createReadStream(filePath, { encoding: "utf8" })
    .pipe(parse({ columns: true, bom: true }));

  let chunkId = 0;
  let buffer: { raw_payload: Record<string, string>; source_record_id: string }[] = [];
  const BUFFER_SIZE = 1000; // staging への INSERT batch

  for await (const row of parser) {
    buffer.push({
      raw_payload: row,
      source_record_id: row["管理番号"] ?? row["FileMakerレコードID"],
    });
    if (buffer.length >= BUFFER_SIZE) {
      chunkId += 1;
      await supabase.from("soil_imports_staging").insert(
        buffer.map((b) => ({
          ...b,
          source_system: "filemaker-list2024",
          import_job_id: importJobId,
          chunk_id: chunkId,
        })),
      );
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    chunkId += 1;
    // 残り flush
  }
}
```

> **注**: `csv-parse` は **既存 npm 依存に含まれているか要確認**。なければ自前パース（Node.js 標準 readline + 簡易 CSV パース）で代替可。本 spec 着手時に判断。

### 4.6 Adapter（CsvRecord → KintoneApp55Record 互換）

Phase 1 の Transform は KintoneApp55Record 前提で書かれているため、CSV 行を同型に変換する Adapter を新設:

```typescript
// src/lib/db/soil-import-csv-source.ts
import type { KintoneApp55Record } from "./soil-import-transform";

export type FileMakerCsvRow = {
  管理番号?: string;
  個人法人区分?: string;
  漢字氏名?: string;
  カナ氏名?: string;
  法人名?: string;
  代表者名?: string;
  電話番号1?: string;
  // ...
};

export function csvRowToKintoneRecord(row: FileMakerCsvRow): KintoneApp55Record {
  return {
    $id: { value: row.管理番号 ?? "" },
    漢字: { value: row.漢字氏名 ?? "" },
    カナ: { value: row.カナ氏名 ?? "" },
    法人名: { value: row.法人名 ?? "" },
    代表者名: { value: row.代表者名 ?? "" },
    電話番号: { value: row.電話番号1 ?? "" },
    // ... 他列マッピング
  };
}
```

→ 既存 `transformKintoneApp55ToSoilList` を変更せずに Phase 2 に対応可能。

---

## 5. Phase 1 / Phase 2 跨り重複処理

### 5.1 重複の発生源

- 同一顧客が Kintone App 55（関電）と FileMaker（汎用リスト）の両方に登録されている
- Phase 1 で Kintone から取込済の顧客が Phase 2 の FileMaker CSV にも含まれる
- 想定重複率: **5-15%**（事業重複度に依存、運用で見極め）

### 5.2 マッチング戦略（Phase 2 取込時に検出）

| ラウンド | 条件 | 判定 |
|---|---|---|
| **R1** | `phone_primary` + `name_kanji` 完全一致 | 自動 merge_proposal 登録（confidence 0.95） |
| **R2** | `source_record_id` 一致（FileMaker → Kintone の手動紐付け列が CSV にある場合） | 自動 merge_proposal 登録（confidence 0.99）|
| **R3** | `phone_primary` のみ完全一致 | manual review、merge_proposal 登録（confidence 0.80）|

> **注**: B-03 の supply_point_22 R1 マッチングは関電固有のため、Phase 2 では `phone + name` を主軸とする。

### 5.3 merge_proposals 自動登録

```sql
-- Phase 2 Load 後に実行（chunk 単位 or 全件完了後の bulk）
INSERT INTO public.soil_lists_merge_proposals
  (primary_list_id, duplicate_list_id, match_round, confidence, proposed_by)
SELECT
  s1.id AS primary_list_id,        -- Phase 1（Kintone 由来）= 残す側
  s2.id AS duplicate_list_id,      -- Phase 2（FileMaker 由来）= 統合される側
  'R1' AS match_round,
  0.95 AS confidence,
  'phase2_csv_import_cron' AS proposed_by
FROM public.soil_lists s1
JOIN public.soil_lists s2 ON
  s1.phone_primary = s2.phone_primary
  AND s1.name_kanji = s2.name_kanji
  AND s1.source_system = 'kintone-app-55'
  AND s2.source_system = 'filemaker-list2024'
  AND s1.deleted_at IS NULL
  AND s2.deleted_at IS NULL
ON CONFLICT (primary_list_id, duplicate_list_id) DO NOTHING;
```

### 5.4 Merge 確定フロー（admin 操作）

1. admin が `/soil/admin/merge-proposals` で R1/R2 提案を一覧
2. 1 件ずつまたは bulk で「承認」/ 「却下」/ 「保留」
3. 承認時:
   - `s2.merged_into_id = s1.id` を UPDATE
   - `s2.status = 'merged'`
   - 関連 Leaf 案件があれば `leaf_*_cases.soil_list_id` を s1.id に cascade UPDATE（spec B-03 §10 に従う）

> **注**: マージ確定 UI は Phase 2 完走後の別 spec で実装（本 spec ではプロポーザル登録までを範囲）。

---

## 6. インデックス戦略（200万件 = 後付け）

### 6.1 取込中は INDEX 一時 OFF

200万件規模で INDEX 付けたまま COPY すると、INSERT ごとに INDEX 更新が発生し取込時間が 5-10 倍に膨張する。よって:

```sql
-- Phase 2 取込開始前
ALTER INDEX idx_soil_lists_phone_primary RENAME TO idx_soil_lists_phone_primary_old;
DROP INDEX IF EXISTS idx_soil_lists_phone_primary_old;

-- 同様に主要 INDEX を一旦 DROP（trigram 含む）
DROP INDEX IF EXISTS idx_soil_lists_name_kanji;
DROP INDEX IF EXISTS idx_soil_lists_industry_pref;
DROP INDEX IF EXISTS idx_soil_lists_name_trgm;
DROP INDEX IF EXISTS idx_soil_lists_address_trgm;
-- 但し UNIQUE INDEX は維持（重複防止のため）
-- idx_soil_lists_source(unique), uq_soil_lists_supply_point_22 は keep
```

### 6.2 取込完了後の再 CREATE

```sql
-- Phase 2 完走後、CONCURRENTLY で再構築（読込ブロックなし）
CREATE INDEX CONCURRENTLY idx_soil_lists_phone_primary
  ON public.soil_lists (phone_primary)
  WHERE phone_primary IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_soil_lists_name_kanji
  ON public.soil_lists (name_kanji)
  WHERE deleted_at IS NULL;

-- pg_trgm は重い、Phase 2 完了の翌深夜帯に実行
CREATE INDEX CONCURRENTLY idx_soil_lists_name_trgm
  ON public.soil_lists USING gin (name_kanji gin_trgm_ops, name_kana gin_trgm_ops);

CREATE INDEX CONCURRENTLY idx_soil_lists_address_trgm
  ON public.soil_lists USING gin (address_line gin_trgm_ops);
```

### 6.3 想定再構築時間（230 万件想定）

| INDEX | 想定時間 |
|---|---|
| `idx_soil_lists_phone_primary`（部分） | ~2 分 |
| `idx_soil_lists_name_kanji`（部分） | ~3 分 |
| `idx_soil_lists_industry_pref`（複合 + active 部分） | ~5 分 |
| `idx_soil_lists_name_trgm`（GIN trigram） | **~30-60 分** |
| `idx_soil_lists_address_trgm`（GIN trigram） | **~20-40 分** |

→ trigram は重いため夜間帯（0-6時）の実行推奨。CONCURRENTLY で読込ブロックなし。

### 6.4 ANALYZE 必須

INDEX 再構築完了後、必ず `ANALYZE public.soil_lists;` を実行して統計情報を更新（クエリプランナーが新 INDEX を使うため）。

---

## 7. エラー処理 / リトライ

### 7.1 エラー種別と対応

| 段階 | エラー種別 | 動作 |
|---|---|---|
| Extract（CSV → staging） | CSV パース失敗（不正なクォート / BOM 不一致） | scripts 即停止、admin 通知、CSV 修正後 retry |
| Extract | エンコーディング誤り（Shift-JIS 等） | scripts 即停止、UTF-8 変換後 retry |
| Transform | 必須列 NULL（name_kanji 等） | 該当行を `soil_imports_errors` に記録、chunk 内で skip |
| Transform | 電話番号正規化失敗 | warning として記録、phone_primary = NULL で続行 |
| Load | UNIQUE 制約違反（source_system + source_record_id） | ON CONFLICT で UPDATE、エラー扱いせず |
| Load | NOT NULL 制約違反 | trx rollback、該当 chunk 全行を errors に記録 |
| Load | 同一 chunk 3 回連続失敗 | ジョブ全体を `failed` に遷移、admin 判断待ち |

### 7.2 既存 Phase 1 リトライ機構の再利用

`runSoilImport` の retry / resume / cancel 機能はそのまま Phase 2 でも有効:
- chunk 失敗時の continue 動作
- chunks_completed の段階的更新で resume 可能
- staging データ保持で resume 時の再 extract 不要

---

## 8. 進捗 UI 拡張

### 8.1 既存 `/soil/admin/imports` の拡張

現行 page は `source_system` 横断の一覧表示。Phase 2 開始ジョブが追加されると同テーブルに `source_system='filemaker-list2024'` で 1 行表示される。**変更不要**。

### 8.2 新規追加検討（次セッション以降）

| 機能 | 説明 |
|---|---|
| source_system フィルタ | Kintone / FileMaker / 旧 CSV を切替表示 |
| Phase 2 開始ボタン | アップロードフォーム + 「Phase 2 取込開始」 |
| Merge proposal 件数表示 | Phase 2 完了後に R1/R2 検出件数を表示 |
| エラーログ詳細パネル | chunk 単位の error_summary を展開表示 |

→ 上記は本 spec のスコープ外、Phase 2 実装後の改善 spec として後続。

---

## 9. 監査ログ

### 9.1 admin 操作の記録

Phase 2 取込ジョブの operation を `cross_history_admin_actions`（横断テーブル、Batch 14）に記録:

```sql
INSERT INTO public.cross_history_admin_actions
  (action, actor_user_id, target_type, target_id, details, created_at)
VALUES
  ('soil.phase2_import_start', auth.uid(), 'soil_list_imports', :job_id::text,
   jsonb_build_object('source_system', 'filemaker-list2024', 'file_name', :csv_filename),
   now());
```

操作対象:
- `phase2_import_start` - 開始
- `phase2_import_pause` / `phase2_import_resume` / `phase2_import_retry` / `phase2_import_cancel` - 状態変更
- `phase2_index_rebuild_start` / `phase2_index_rebuild_complete` - INDEX 再構築

### 9.2 監査クエリ例

```sql
-- 過去 30 日の Phase 2 関連 admin 操作
SELECT created_at, action, actor_user_id, details->>'source_system' AS source
FROM public.cross_history_admin_actions
WHERE action LIKE 'soil.phase2_%'
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

---

## 10. パフォーマンス目標

### 10.1 取込速度目標

| 段階 | 200 万件想定時間 | 備考 |
|---|---|---|
| CSV → staging | ~30 分 | CSV パース + INSERT 1,000 件 batch |
| Transform | ~20 分 | 純粋関数 + chunk batch |
| Load | ~60 分 | INDEX OFF 状態で COPY 互換 |
| INDEX 再構築 | ~1.5-2 時間 | trigram 含む、夜間帯 |
| **合計** | **~3-4 時間** | 一晩で完走見込み |

### 10.2 取込中の Tree 影響

Phase 2 取込中は `soil_lists` への大量 INSERT が走るため:
- **Tree からの SELECT** は読込専用、INDEX OFF で遅延の可能性（既存 INDEX が DROP されるため）
- **対策**: Tree が参照する `soil_lists_search_recent` 等の MV を Phase 2 取込開始前に REFRESH しておく
- **運用**: Phase 2 取込は Tree 営業時間外（22:00-7:00）に開始推奨

---

## 11. 受入基準（Definition of Done）

- [ ] FileMaker エクスポート CSV が `soil_lists` に取り込み完了（200 万件 or 提供全件）
- [ ] Phase 1 既投入分との重複が `soil_lists_merge_proposals` に R1/R2 で登録済
- [ ] 取込前後の件数差分 = 0（または明示的に判定済の除外件数のみ）
- [ ] CSV パースエラー / 制約違反は `soil_imports_errors` に記録、件数は admin に通知
- [ ] INDEX 再構築完了 + EXPLAIN ANALYZE で主要クエリ（電話番号検索 / 名前 trigram）p95 達成
- [ ] admin ダッシュボードで Phase 2 ジョブの完了ステータス + Merge proposal 件数表示
- [ ] 監査ログ（cross_history_admin_actions）に Phase 2 操作が記録
- [ ] runbook（docs/runbooks/filemaker-export-runbook.md）整備完了
- [ ] α 版テスト（東海林さん 1 人）で 1 ファイル取込完走確認

---

## 12. 実装タスク分解（次セッション以降）

| # | タスク | 工数 | 依存 |
|---|---|---|---|
| 1 | `scripts/soil-import-csv-phase2.ts` | 0.3d | csv-parse 既存有無確認 |
| 2 | `src/lib/db/soil-import-csv-source.ts` + TDD | 0.3d | Phase 1 完成済 |
| 3 | `src/lib/db/soil-merge-detector.ts` + TDD（R1/R2 検出） | 0.3d | Phase 1 完成済 |
| 4 | INDEX OFF / ON migration（admin 専用） | 0.2d | spec #05 連動 |
| 5 | 既存 `/soil/admin/imports` の Phase 2 開始 UI 拡張 | 0.3d | Phase 1 UI 完成済 |
| 6 | runbook 整備 | 0.2d | 東海林さん運用ヒアリング |
| 7 | α 版テスト（200 件 sample → 200 万件本番） | 0.2d | 上記すべて完了後 |
| **合計** | | **1.8d** | |

---

## 13. 判断保留事項

| # | 論点 | a-soil スタンス（暫定） |
|---|---|---|
| 判 1 | csv-parse npm パッケージの追加可否 | 既存 package.json にあれば利用、なければ自前 readline パース（npm install 回避） |
| 判 2 | INDEX OFF/ON のタイミング | 本 spec §6 通り、取込開始前 DROP / 完了後 CONCURRENTLY CREATE |
| 判 3 | Merge proposal の自動承認 | confidence >= 0.99（R2）のみ自動承認可、R1（0.95）は admin manual review |
| 判 4 | Phase 2 取込時間帯 | 22:00-7:00 推奨、Tree 営業時間外 |
| 判 5 | 取込結果通知 | Chatwork DM + Garden 内 admin ページ通知（B-07 連動） |
| 判 6 | csv-parse 自前実装範囲 | RFC 4180 準拠、ダブルクォート + カンマ + 改行のみ対応で十分 |
| 判 7 | FileMaker エクスポート列名揺れ | runbook で「列名厳守」明記 + Adapter で fallback（部分一致）対応 |

---

## 14. 既知のリスクと対策

### 14.1 CSV エンコーディング誤り
- 対策: scripts で BOM 検出 + UTF-8 強制、Shift-JIS 検出時は即停止 + admin 通知

### 14.2 大量 INSERT による DB 負荷
- 対策: chunkSize 10,000 + 取込時間帯 22:00-7:00 + Supabase Pro プラン維持（spec #05 連動）

### 14.3 INDEX 再構築失敗
- 対策: CONCURRENTLY 失敗時は通常 CREATE にフォールバック（短時間ロックを許容）+ admin 通知

### 14.4 Merge proposal の誤判定
- 対策: R1 (phone+name) のみ自動登録、R2 (source_record_id) は manual review、誤判定は admin で却下可能

### 14.5 Phase 1 既投入分との conflict
- 対策: ON CONFLICT (source_system, source_record_id) で別 system は別レコード扱い、merge_proposals で後追い統合

### 14.6 取込中断時の再開困難
- 対策: chunks_completed 単位で resume 可、staging データは job 単位保持（retry で truncate）

---

## 15. 関連ドキュメント

- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md`（B-01 Phase 1）
- `docs/specs/2026-04-25-soil-04-import-strategy.md`（インポート戦略親書）
- `docs/specs/2026-04-25-soil-05-index-performance.md`（INDEX 戦略連動）
- `docs/specs/2026-04-26-soil-phase-b-03-kanden-master-integration.md`（Phase 1 関電マスタ）
- `docs/specs/2026-04-26-soil-phase-b-07-monitoring-alerting.md`（監視）
- `docs/runbooks/filemaker-export-runbook.md`（実装フェーズで起草）
- `supabase/migrations/20260507000007_soil_imports_staging.sql`（staging テーブル既存）
- `src/lib/db/soil-importer.ts`（Phase 1 orchestrator、Phase 2 で再利用）
- `src/app/soil/admin/imports/page.tsx`（Phase 1 UI、Phase 2 で拡張）

---

## 16. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-08 | v1.0 | 初版起草、a-main-014 main- No. 134 dispatch 対応、B-01 Phase 1 実装完成後の論理的次手として Phase 2 を起草 | a-soil |

— end of B-01 Phase 2 spec —
