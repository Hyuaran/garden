# Soil #05: インデックス・パフォーマンス戦略（300 万件級）

- 対象: Garden-Soil の全テーブルのインデックス設計と性能目標
- 優先度: **🔴 高**（253 万件リスト + 335 万件コール履歴の応答性）
- 見積: **0.5d**（インデックス設計 + 計測スクリプト + チューニング）
- 担当セッション: a-soil（実装）/ a-bloom（読込側ヒアリング）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #05）
- 前提:
  - `docs/specs/2026-04-25-soil-01-list-master-schema.md`
  - `docs/specs/2026-04-25-soil-02-call-history-schema.md`
  - `docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md`
  - PostgreSQL 15 系（Supabase 標準）

---

## 1. 目的とスコープ

### 1.1 目的

Garden-Soil の主要クエリが **253 万件 / 335 万件規模で 1 秒以内**に応答することを担保する。インデックス設計を網羅し、運用上のチューニング指針（VACUUM / ANALYZE / REINDEX）を整備する。

### 1.2 含めるもの

- `soil_lists` の全インデックス
- `soil_call_history`（パーティション親）の全インデックス
- 補助テーブル（`soil_list_tags` / `soil_list_imports`）
- 部分インデックスの適用範囲
- 全文検索（pg_trgm）の段階導入
- VACUUM / ANALYZE / REINDEX の運用方針
- 性能目標と計測手順

### 1.3 含めないもの

- パーティション戦略 → #02
- RLS の評価コスト → #06
- 投入時のインデックス先付け / 後付け → #04

---

## 2. 性能目標

### 2.1 目標応答時間（p95）

| クエリ種別 | 規模 | 目標 |
|---|---|---|
| Soil リスト：単件取得（id）| 253 万件 | 10ms |
| Soil リスト：phone 重複検索 | 同 | 50ms |
| Soil リスト：複合フィルタ（業種 × 地域 × status）| 同 | 200ms |
| Soil リスト：全文検索（名前）| 同 | 500ms |
| コール履歴：本日コール一覧（user_id）| 335 万件 | 50ms |
| コール履歴：案件全履歴（case_id）| 同 | 100ms |
| コール履歴：月次集計 | 同 | 500ms |
| コール履歴：コールバック予定 | 同 | 即時（<10ms）|

### 2.2 INSERT 性能

| 操作 | 目標 |
|---|---|
| `soil_lists` 単件 INSERT | 10ms |
| `soil_call_history` 単件 INSERT | 20ms（トリガ込み）|
| `soil_call_history` バルク（1,000 件 / バッチ）| 1 秒 |

### 2.3 計測条件

- garden-dev で実データ規模相当（最低 100 万件）でのテスト
- Vercel Edge → Supabase Pooler 経由
- ウォームアップ後、3 回計測の中央値を採用

---

## 3. `soil_lists` のインデックス

### 3.1 必須インデックス

```sql
-- 1. 主キー（自動）
-- soil_lists_pkey on (id)

-- 2. 電話番号での重複検索（重要）
CREATE INDEX idx_soil_lists_phone_primary
  ON soil_lists (phone_primary)
  WHERE phone_primary IS NOT NULL;
-- 部分インデックスで NULL 行を除外、サイズ縮減

-- 3. ソース連携（Kintone 再インポート時の UPSERT）
CREATE UNIQUE INDEX idx_soil_lists_source
  ON soil_lists (source_system, source_record_id)
  WHERE source_record_id IS NOT NULL;

-- 4. 状態フィルタ（active を頻繁に絞る）
CREATE INDEX idx_soil_lists_status
  ON soil_lists (status)
  WHERE status = 'active';
-- 'casecreated' / 'churned' は集計用、頻度低いので index 不要

-- 5. 業種 × 地域での複合
CREATE INDEX idx_soil_lists_industry_pref
  ON soil_lists (industry_type, prefecture, status)
  WHERE status = 'active';

-- 6. 案件化済の判定（leaf からの逆参照）
CREATE INDEX idx_soil_lists_primary_case
  ON soil_lists (primary_case_module, primary_case_id)
  WHERE primary_case_id IS NOT NULL;

-- 7. 削除済除外（cross-history-delete に従い、deleted_at IS NULL を頻繁にフィルタ）
CREATE INDEX idx_soil_lists_active_records
  ON soil_lists (id)
  WHERE deleted_at IS NULL;

-- 8. リスト管理番号
CREATE INDEX idx_soil_lists_list_no
  ON soil_lists (list_no)
  WHERE list_no IS NOT NULL;
```

### 3.2 全文検索（Phase C 後期）

```sql
-- 名前（漢字・カナ）の trigram GIN
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_soil_lists_name_trgm
  ON soil_lists USING gin (name_kanji gin_trgm_ops, name_kana gin_trgm_ops);

-- 住所の trigram
CREATE INDEX idx_soil_lists_address_trgm
  ON soil_lists USING gin (address_line gin_trgm_ops);
```

### 3.3 不要なインデックス

- `customer_type` 単独 → カーディナリティ低（2 値）、フルスキャンの方が速い
- `addresses_jsonb` 全体への GIN → サイズ膨張、ミラー列で対応
- `email_*` → 業務ニーズ低（必要時に後付け）

---

## 4. `soil_call_history` のインデックス

### 4.1 親テーブルに定義（PG15 で子に自動継承）

```sql
-- 1. 主要クエリ Q-A: 個人 × 日付
CREATE INDEX idx_soil_call_history_user_dt
  ON soil_call_history (user_id, call_datetime DESC);

-- 2. 主要クエリ Q-B: 案件全履歴
CREATE INDEX idx_soil_call_history_case
  ON soil_call_history (case_id, call_datetime DESC)
  WHERE case_id IS NOT NULL;

-- 3. 主要クエリ Q-C: 月次集計（KPI）
CREATE INDEX idx_soil_call_history_billable_mode
  ON soil_call_history (call_mode, call_datetime DESC)
  WHERE is_billable = true
    AND call_mode IN ('sprout', 'branch', 'leaf', 'bloom');

-- 4. 主要クエリ Q-D: コールバック予定
CREATE INDEX idx_soil_call_history_callback
  ON soil_call_history (callback_target_at)
  WHERE callback_target_at IS NOT NULL;
-- 過去のコールバックは消えていく → 部分インデックス自動縮減

-- 5. リスト × 日付（リスト詳細画面で利用）
CREATE INDEX idx_soil_call_history_list_dt
  ON soil_call_history (list_id, call_datetime DESC);
```

### 4.2 子パーティション固有のインデックス

通常は親で十分だが、以下のケースで子固有を検討:

- 直近 1 ヶ月のみ高頻度アクセス → 当月パーティションに**追加カラム index**
- 過去パーティションは使わないので index を削除して空間節約

### 4.3 全文検索（memo）— Phase C 後期

```sql
CREATE INDEX idx_soil_call_history_memo_trgm
  ON soil_call_history USING gin (memo gin_trgm_ops)
  WHERE memo IS NOT NULL AND length(memo) > 5;
```

memo 全体への GIN は重いので、5 文字超のみ対象。

---

## 5. 補助テーブルのインデックス

### 5.1 `soil_list_tags`

```sql
CREATE INDEX idx_soil_list_tags_list_id ON soil_list_tags (list_id);
CREATE INDEX idx_soil_list_tags_tag ON soil_list_tags (tag);
CREATE UNIQUE INDEX idx_soil_list_tags_unique ON soil_list_tags (list_id, tag);
```

### 5.2 `soil_list_imports`

```sql
CREATE INDEX idx_soil_list_imports_source ON soil_list_imports (source_system, imported_at DESC);
```

### 5.3 `soil_lists_merge_proposals`

```sql
CREATE INDEX idx_merge_proposals_pending
  ON soil_lists_merge_proposals (created_at DESC)
  WHERE status = 'pending';
```

---

## 6. 部分インデックス活用のガイドライン

### 6.1 部分インデックスを使う場面

- WHERE 条件が高頻度で、対象行が**全体の 30% 以下**
- 例: `status = 'active'`（90% が active なら全件 index で OK）/ `deleted_at IS NULL`（90% が NULL → 部分の意味薄）

### 6.2 部分インデックスのメリット

- サイズ削減（10〜30% に縮小）
- INSERT / UPDATE 時のオーバーヘッド軽減
- 該当クエリで **index-only scan** が効きやすい

### 6.3 部分インデックスの注意

- WHERE 条件が**プランナに伝わる必要**あり（クエリ側で同じ条件を書く）
- 条件外のクエリでは利用されない → 別 index 必要

---

## 7. JSONB インデックス戦略

### 7.1 `addresses_jsonb`

- ミラー列（`postal_code` / `prefecture` / `city`）に B-tree → これで十分
- jsonb 全体への GIN は**作らない**（サイズ膨張）

### 7.2 `phone_alternates` / `email_alternates`

- 副連絡先で検索する頻度は低い（必要時のみ）
- Phase C 以降で要件が明確になってから検討

### 7.3 `error_summary`（imports）

- 検索対象ではない → index 不要

---

## 8. VACUUM / ANALYZE / REINDEX 運用

### 8.1 自動 VACUUM

Supabase は自動 VACUUM 有効。以下を**手動でも実施**:

| タイミング | 対象 | コマンド |
|---|---|---|
| 200 万件投入直後 | `soil_lists` | `VACUUM ANALYZE soil_lists;` |
| 月次集計前 | `soil_call_history`（当月パーティション）| `VACUUM ANALYZE soil_call_history_YYYYMM;` |
| マージ提案大量処理後 | `soil_lists_merge_proposals` | `VACUUM ANALYZE` |

### 8.2 ANALYZE の重要性

- 統計情報が古いと**プランナが誤った判断**
- 大量 INSERT 後は必ず ANALYZE

### 8.3 REINDEX の判断

- B-tree は更新で bloat（肥大化）する
- 月次で `pg_stat_user_indexes` を確認、bloat 30% 超なら REINDEX
- パーティションごとに REINDEX 可能（停止時間最小化）

```sql
-- bloat 確認
SELECT
  schemaname, tablename, indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'soil_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 8.4 REINDEX のコスト

- `REINDEX TABLE soil_lists` は数分間ロック → 業務時間外に実施
- 代わりに **`REINDEX CONCURRENTLY`** を推奨（PG12+、ロックなし、時間 2 倍）

---

## 9. 計測スクリプト

### 9.1 主要クエリの EXPLAIN ANALYZE

```sql
-- Q-A: Soil 単件取得
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM soil_lists WHERE id = $1;

-- Q-B: phone 重複検索
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM soil_lists WHERE phone_primary = '0901234XXXX';

-- Q-C: 業種 × 地域
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM soil_lists
WHERE industry_type = '工場照明' AND prefecture = '大阪府' AND status = 'active'
LIMIT 100;

-- Q-D: 全文検索
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM soil_lists WHERE name_kana LIKE '%ヤマダ%' LIMIT 100;
```

### 9.2 自動化（性能リグレッション検知）

```typescript
// scripts/soil-perf-test.ts
const queries = [
  { name: 'q-list-by-id', sql: 'SELECT * FROM soil_lists WHERE id = $1', target_ms: 10 },
  { name: 'q-phone-lookup', sql: '...', target_ms: 50 },
  // ...
];

for (const q of queries) {
  const t0 = performance.now();
  await supabase.rpc('explain_analyze', { sql: q.sql });
  const elapsed = performance.now() - t0;
  if (elapsed > q.target_ms * 1.5) {
    console.warn(`[perf-regression] ${q.name}: ${elapsed}ms (target ${q.target_ms}ms)`);
  }
}
```

CI / 月次で自動実行。

### 9.3 pg_stat_statements 活用

- Supabase で有効化（拡張機能）
- 直近 1 週間の slow query を週次で確認

```sql
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%soil_%'
ORDER BY mean_exec_time DESC LIMIT 20;
```

---

## 10. ストレージ容量見積

### 10.1 `soil_lists` の見積

- 1 行あたり概算 1〜2KB（住所 jsonb + 連絡先 jsonb 含む）
- 253 万件 × 1.5KB = **約 4GB**（テーブル本体）
- インデックス計 約 2GB（メイン table の半分）
- **合計約 6GB**

### 10.2 `soil_call_history` の見積

- 1 行あたり概算 500B（コンパクト）
- 335 万件 × 500B = **約 1.7GB**（テーブル本体）
- パーティション数 60 個 × インデックス 5 種 → 約 1GB
- **合計約 2.7GB**

### 10.3 Supabase 標準容量

- Pro プラン: 8GB（含む既存使用量）
- 上記 Soil で 9GB → 増量必要 → Pro Plus or Storage 追加
- 月次 $0.125/GB 程度の追加コスト

---

## 11. 既知のリスクと対策

### 11.1 部分インデックスの利用漏れ

- アプリ側で WHERE 条件が部分 index と一致しないと使われない
- 対策: 主要クエリは EXPLAIN で必ず index 利用を確認、ESLint ルールで主要 WHERE 必須化（不可なら ORM レイヤで保証）

### 11.2 INSERT 性能の劣化

- インデックスが多いほど INSERT が遅い
- 対策: 部分 index 活用、不要 index は削除、batch INSERT 時は index 後付け

### 11.3 パーティションごとの index bloat

- 過去パーティションも徐々に肥大化
- 対策: 24 ヶ月超の古いパーティションは index を一部削除

### 11.4 全文検索の遅さ

- pg_trgm GIN は 100 万件超で 1〜2 秒
- 対策: 結果上限 100 件、必要時のみ実行、Phase C 後期に追加

### 11.5 統計情報の陳腐化

- 大量変更後 ANALYZE 忘れ → プランナ誤判断
- 対策: バッチ処理スクリプトに `ANALYZE` を必ず含める

### 11.6 Supabase Pooler のコネクション枯渇

- 大量並列クエリでコネクション不足
- 対策: 主要クエリは `prepared statement` 化、N+1 を避ける（Server Action でまとめ取得）

---

## 12. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `soil_lists` 全インデックス migration | a-soil | 0.5h |
| 2 | `soil_call_history` 全インデックス migration | a-soil | 0.5h |
| 3 | 補助テーブルインデックス | a-soil | 0.25h |
| 4 | EXPLAIN ANALYZE スクリプト | a-soil | 0.5h |
| 5 | 性能計測自動化（perf-test.ts）| a-soil | 1h |
| 6 | pg_stat_statements 週次レポート Cron | a-soil | 0.5h |
| 7 | VACUUM / ANALYZE / REINDEX 運用書 | a-soil + a-main | 0.5h |
| 8 | ストレージ容量見積 → Supabase プラン調整提案 | a-main | 0.25h |

合計: 約 4h ≈ 0.5d

---

## 13. 関連ドキュメント

- `docs/specs/2026-04-25-soil-01-list-master-schema.md`
- `docs/specs/2026-04-25-soil-02-call-history-schema.md`
- `docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md`
- `docs/specs/2026-04-25-soil-04-import-strategy.md`
- `docs/specs/2026-04-25-soil-06-rls-design.md`
- `docs/specs/2026-04-26-cross-ops-01-monitoring-alerting.md`（Slow query 監視）

---

## 14. 受入基準（Definition of Done）

- [ ] `soil_lists` 全インデックス（8 個 + 全文検索 2 個）作成
- [ ] `soil_call_history` 全インデックス（5 個）作成、子パーティションへの継承確認
- [ ] 補助テーブルのインデックス整備
- [ ] サンプル 100 万件で EXPLAIN ANALYZE 実施 → 主要クエリ §2.1 目標を達成
- [ ] 性能計測自動化スクリプト + CI 連携
- [ ] pg_stat_statements 週次レポート Cron 稼働
- [ ] VACUUM / ANALYZE / REINDEX 運用書を `docs/runbooks/soil-perf.md` に転記
- [ ] ストレージ容量見積を東海林さんに提示、プラン判断
- [ ] Supabase plan 調整（必要なら Pro Plus 等）
