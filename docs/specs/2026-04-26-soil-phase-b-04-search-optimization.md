# Soil Phase B-04: 検索性能最適化（300 万件級、FTS / pg_trgm / MV）

- 対象: Garden-Soil の検索性能（253 万件 + 335 万件規模、p95 < 1 秒目標）
- 優先度: **🔴 最高**（業務応答性、Tree / Bloom 利用の前提）
- 見積: **1.5d**
- 担当セッション: a-soil（実装）/ a-bloom（読込側ヒアリング）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-04）
- 前提:
  - **Batch 16 Soil 基盤**（特に `2026-04-25-soil-05-index-performance.md`）
  - **B-01 / B-02 完了**（実データ規模に到達）
  - PostgreSQL 15 系（Supabase 標準）

---

## 1. 目的とスコープ

### 1.1 目的

253 万件のリスト + 335 万件のコール履歴規模で、主要クエリを **p95 < 1 秒**で返す。Batch 16 のインデックス基本設計を踏まえ、Phase B 実装フェーズで **PostgreSQL FTS / pg_trgm / Materialized View** を統合実装する。

### 1.2 含めるもの

- インデックス戦略確定（B-tree / GIN / BRIN の使い分け）
- PostgreSQL Full Text Search（`pg_tsvector` + `tsquery`）
- pg_trgm 部分一致（漢字・カナ揺れ対応）の段階導入計画
- Materialized View 設計（業種別 / 地域別 / 月次集計）
- MV REFRESH スケジュール（Cron / on-demand / CONCURRENTLY）
- 検索 API パターンと性能目標
- EXPLAIN ANALYZE 定期計測
- pg_stat_statements 活用
- bloat 監視 + REINDEX 運用
- prepared statement 活用（Pooler 経由）

### 1.3 含めないもの

- インデックス基本設計 → Batch 16 既出
- バックアップ → B-05
- RLS → B-06
- 監視ダッシュボード → B-07

---

## 2. 性能目標（再掲 + 強化）

### 2.1 p95 応答時間

| クエリ種別 | 規模 | Batch 16 目標 | B-04 強化目標 |
|---|---|---|---|
| Soil 単件取得 | 253 万件 | 10ms | 5ms |
| Soil phone 重複検索 | 同 | 50ms | 20ms |
| Soil 複合フィルタ（業種 × 地域 × status）| 同 | 200ms | 100ms |
| Soil 全文検索（名前）| 同 | 500ms | 300ms |
| コール履歴 本日 | 335 万件 | 50ms | 30ms |
| コール履歴 案件全 | 同 | 100ms | 50ms |
| コール履歴 月次集計 | 同 | 500ms | **MV で 50ms** |
| コール履歴 コールバック | 同 | 即時 | 即時 |

### 2.2 INSERT 性能

- `soil_lists` 単件 INSERT: 5ms
- `soil_call_history` 単件 INSERT: 15ms（トリガ込み）
- `soil_call_history` バルク（1,000 件）: 0.5 秒

---

## 3. インデックス戦略確定（B-tree / GIN / BRIN）

### 3.1 使い分けマトリクス

| INDEX 種別 | 用途 | Soil での該当 |
|---|---|---|
| B-tree | 等価 / 範囲 | id / phone_primary / status / call_datetime |
| GIN | 配列 / JSONB / 全文 | name_kanji_tsv / pg_trgm（部分一致）|
| BRIN | 時系列大量 | （PG15 ではパーティション内で限定的）|
| Hash | 等価のみ（PG10+ 永続化）| 不採用（B-tree で十分）|

### 3.2 部分インデックス活用（Batch 16 既出を保持）

```sql
-- 例: status='active' のみ
CREATE INDEX idx_soil_lists_status_active
  ON soil_lists (id) WHERE status = 'active' AND deleted_at IS NULL;

-- カバリングインデックス（PG11+ INCLUDE 句）
CREATE INDEX idx_soil_lists_phone_covering
  ON soil_lists (phone_primary) INCLUDE (id, name_kanji, status)
  WHERE phone_primary IS NOT NULL;
```

INCLUDE 句で **index-only scan** を実現、テーブル本体を読まない。

### 3.3 不要 INDEX の判定

```sql
-- 過去 90 日に使われていない INDEX
SELECT
  schemaname, tablename, indexrelname,
  idx_scan, idx_tup_read,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'soil_%'
  AND idx_scan = 0
  AND pg_relation_size(indexrelid) > 1024 * 1024;  -- 1MB 超のみ
```

四半期に 1 回チェック、不要なら DROP。

---

## 4. PostgreSQL Full Text Search

### 4.1 tsvector 列追加

```sql
ALTER TABLE soil_lists
  ADD COLUMN search_tsv tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(name_kanji, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(name_kana, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(address_line, '')), 'C') ||
      setweight(to_tsvector('simple', coalesce(phone_primary, '')), 'D')
    ) STORED;

CREATE INDEX idx_soil_lists_search_tsv
  ON soil_lists USING gin (search_tsv);
```

### 4.2 検索 API

```sql
-- "ヤマダ" で検索
SELECT * FROM soil_lists
WHERE search_tsv @@ to_tsquery('simple', 'ヤマダ:*')
  AND status = 'active'
  AND deleted_at IS NULL
ORDER BY ts_rank(search_tsv, to_tsquery('simple', 'ヤマダ:*')) DESC
LIMIT 100;
```

### 4.3 日本語形態素解析

- PostgreSQL 標準は日本語非対応（`'simple'` で文字単位）
- 拡張: `pgroonga` or `textsearch_ja`（Supabase で要動作確認）
- **Phase B 段階は `'simple'`** で運用、Phase C 後期に拡張検討

### 4.4 性能想定

- 100 万件で 50-100ms
- 部分インデックス併用で 30-50ms

---

## 5. pg_trgm 部分一致

### 5.1 トリグラム索引

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_soil_lists_name_trgm
  ON soil_lists USING gin (name_kanji gin_trgm_ops, name_kana gin_trgm_ops)
  WHERE status != 'merged' AND deleted_at IS NULL;

CREATE INDEX idx_soil_lists_address_trgm
  ON soil_lists USING gin (address_line gin_trgm_ops)
  WHERE address_line IS NOT NULL;
```

### 5.2 部分一致 LIKE

```sql
SELECT * FROM soil_lists
WHERE name_kanji ILIKE '%山田%'
  OR name_kana ILIKE '%ヤマダ%'
ORDER BY similarity(name_kanji, '山田') DESC
LIMIT 100;
```

### 5.3 段階導入計画

| 段階 | 適用範囲 | 時期 |
|---|---|---|
| 1 | name のみ trgm | Phase B-04 |
| 2 | + address | Phase B-04 後半（容量見積後）|
| 3 | + memo（コール履歴）| Phase C 後期 |

memo は 335 万件で容量 5GB 程度想定 → 慎重判断。

---

## 6. Materialized View 設計

### 6.1 月次集計 MV

```sql
CREATE MATERIALIZED VIEW soil_call_history_monthly_summary AS
SELECT
  date_trunc('month', call_datetime) AS month,
  user_id,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE is_billable) AS billable_calls,
  COUNT(*) FILTER (WHERE outcome = 'appointment_set') AS appointments,
  COUNT(*) FILTER (WHERE outcome = 'sale_done') AS sales
FROM soil_call_history
GROUP BY 1, 2;

CREATE UNIQUE INDEX idx_soil_call_monthly_summary_pk
  ON soil_call_history_monthly_summary (month, user_id);
```

### 6.2 業種別 MV

```sql
CREATE MATERIALIZED VIEW soil_lists_industry_summary AS
SELECT
  industry_type,
  prefecture,
  status,
  COUNT(*) AS count
FROM soil_lists
WHERE deleted_at IS NULL
GROUP BY 1, 2, 3;
```

### 6.3 担当案件 MV（Batch 16 §5.2 の再掲）

```sql
CREATE MATERIALIZED VIEW soil_lists_assignments AS
SELECT soil_list_id, assigned_to, 'leaf_kanden' AS module FROM leaf_kanden_cases WHERE assigned_to IS NOT NULL
UNION ALL
SELECT soil_list_id, assigned_to, 'leaf_hikari' AS module FROM leaf_hikari_cases WHERE assigned_to IS NOT NULL
-- ...
;

CREATE UNIQUE INDEX idx_assignments_unique ON soil_lists_assignments (soil_list_id, assigned_to, module);
CREATE INDEX idx_assignments_user ON soil_lists_assignments (assigned_to);
```

---

## 7. MV REFRESH スケジュール

### 7.1 戦略

| MV | REFRESH 戦略 | 頻度 |
|---|---|---|
| 月次集計 | CONCURRENTLY | 日次 03:00 + on-demand |
| 業種別集計 | CONCURRENTLY | 4 時間ごと |
| 担当案件 | トリガ即時 + 補助 Cron | 即時 + 1h Cron |

### 7.2 CONCURRENTLY の必須条件

- 一意インデックスが必須（PK 相当）
- ロックなしで更新（読み取り中も継続）
- 時間は 2 倍程度かかる

### 7.3 REFRESH 実装

```typescript
// /api/cron/soil-refresh-mv (毎日 03:00)
export async function GET() {
  await supabaseAdmin.rpc('refresh_soil_mvs');
  return Response.json({ ok: true });
}
```

```sql
CREATE OR REPLACE FUNCTION refresh_soil_mvs()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY soil_call_history_monthly_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY soil_lists_industry_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY soil_lists_assignments;
END $$;
```

---

## 8. 検索 API パターン

### 8.1 主要 5 パターン（Batch 16 §6.1 拡張）

| Q# | クエリ | INDEX | MV | 目標 |
|---|---|---|---|---|
| Q1 | 単件取得 | id PK | — | 5ms |
| Q2 | phone 重複検索 | phone_primary | — | 20ms |
| Q3 | 業種 × 地域 × status | 部分複合 | industry_summary | 100ms |
| Q4 | 名前全文検索 | search_tsv GIN | — | 300ms |
| Q5 | 名前部分一致 | name_kanji trgm | — | 500ms |
| Q6 | 月次集計（個人）| — | monthly_summary | 50ms |
| Q7 | コールバック予定 | callback_target_at 部分 | — | 即時 |

### 8.2 helper 関数化（src/lib/soil/）

Batch 16 §3.1 既出の helper を活用、本 spec で速度監視を追加。

---

## 9. EXPLAIN ANALYZE 定期計測

### 9.1 計測対象クエリ

```typescript
const PERF_QUERIES = [
  { id: 'q1-list-by-id', sql: 'SELECT * FROM soil_lists WHERE id = $1', target_p95_ms: 5 },
  { id: 'q2-phone', sql: '...', target_p95_ms: 20 },
  // ... Q1-Q7
];
```

### 9.2 自動計測 Cron

```typescript
// /api/cron/soil-perf-test (毎日 04:00)
for (const q of PERF_QUERIES) {
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await supabase.rpc('explain_analyze', { sql: q.sql });
    samples.push(performance.now() - t0);
  }
  const p95 = percentile(samples, 95);
  if (p95 > q.target_p95_ms * 1.5) {
    await recordMonitoringEvent({
      severity: 'medium',
      category: 'perf_regression',
      message: `${q.id}: p95 ${p95}ms (target ${q.target_p95_ms}ms)`,
    });
  }
}
```

### 9.3 結果保存

```sql
CREATE TABLE soil_perf_history (
  id bigserial PRIMARY KEY,
  measured_at timestamptz NOT NULL DEFAULT now(),
  query_id text NOT NULL,
  p50_ms numeric,
  p95_ms numeric,
  p99_ms numeric,
  sample_count int
);
```

Bloom KPI ダッシュボードで時系列表示。

---

## 10. pg_stat_statements 活用

### 10.1 有効化

Supabase で標準有効。閲覧:

```sql
SELECT
  query, calls,
  total_exec_time::int AS total_ms,
  mean_exec_time::int AS mean_ms,
  rows
FROM pg_stat_statements
WHERE query ILIKE '%soil_%'
  AND calls > 100
ORDER BY mean_exec_time DESC
LIMIT 30;
```

### 10.2 週次レポート Cron

```typescript
// /api/cron/soil-stat-statements (毎週月曜 06:00)
const slowQueries = await fetchSlowQueries();  // mean > 500ms
await sendChatworkSummary('Garden-監視-soil', { slow_queries: slowQueries });
```

### 10.3 アラート閾値

| 項目 | 警告 | エラー |
|---|---|---|
| mean_exec_time | >500ms | >2000ms |
| total_exec_time（週合計）| >1h | >5h |
| calls 急増（前週比）| +200% | +500% |

---

## 11. bloat 監視 + REINDEX

### 11.1 bloat 計測

```sql
-- 拡張 pgstattuple で正確に計測
CREATE EXTENSION IF NOT EXISTS pgstattuple;

SELECT
  schemaname, indexrelname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  (pgstattuple(indexrelid::regclass)).avg_leaf_density
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'soil_%';
```

### 11.2 REINDEX 判断

| avg_leaf_density | 判断 |
|---|---|
| > 80% | 健全、REINDEX 不要 |
| 60-80% | 監視継続 |
| < 60% | REINDEX CONCURRENTLY 推奨 |

### 11.3 REINDEX CONCURRENTLY

```sql
REINDEX INDEX CONCURRENTLY idx_soil_lists_phone_primary;
```

ロックなしだが時間 2 倍。月次 Cron で自動化。

---

## 12. prepared statement 活用

### 12.1 Pooler 経由の制約

- Supabase Pooler は **transaction mode** が既定
- prepared statement は session 単位 → transaction mode で使えない場合あり
- **session mode** に切替（接続枠減るがプレペアド可）

### 12.2 主要 helper の prepared 化

```typescript
// 主要クエリは prepared statement 化
const stmt = await client.prepare('soil_get_by_id', 'SELECT * FROM soil_lists WHERE id = $1');
const result = await stmt.execute([id]);
```

### 12.3 効果

- パース時間削減: 10-20%
- N+1 抑制（同一 stmt の再利用）

---

## 13. 法令対応チェックリスト

### 13.1 個人情報保護法

- [ ] 第 23 条: 検索パラメータの監査ログ（誰が誰を検索したか）
- [ ] アクセス制御の網羅（B-06 連動）

---

## 14. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | tsvector 列追加 + GIN インデックス | a-soil | 1h |
| 2 | pg_trgm GIN（name 段階）| a-soil | 1h |
| 3 | MV 3 種（月次 / 業種別 / 担当案件）| a-soil | 2h |
| 4 | MV REFRESH Cron + CONCURRENTLY | a-soil | 1h |
| 5 | helper 関数の prepared 化 | a-soil | 1h |
| 6 | EXPLAIN ANALYZE 定期計測 | a-soil | 1.5h |
| 7 | pg_stat_statements 週次レポート | a-soil | 1h |
| 8 | bloat 監視 + REINDEX 自動化 | a-soil | 1h |
| 9 | 性能リグレッション CI 統合 | a-soil | 1h |
| 10 | Bloom 性能ダッシュボード追加 | a-bloom | 1.5h |

合計: 約 12h ≈ **1.5d**

---

## 15. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 日本語形態素解析の導入時期 | **Phase C 後期**、`'simple'` で開始 |
| 判 2 | pg_trgm address 適用 | Phase B 後半（容量見積後）|
| 判 3 | memo trgm 適用 | Phase C 後期、容量 5GB 想定 |
| 判 4 | MV REFRESH 頻度（業種別）| 4 時間ごと、業務影響なら 1h に短縮 |
| 判 5 | session mode 切替 | 主要 helper のみ session mode、他は transaction mode 維持 |
| 判 6 | bloat REINDEX 自動化 | 月次 Cron、bloat 60% 未満で自動 |
| 判 7 | 性能リグレッション 警告閾値 | 目標 +50% で warn、+200% で error |

---

## 16. 既知のリスクと対策

### 16.1 GIN インデックスの容量

- 100 万件 trgm で 500MB-1GB
- 対策: 部分インデックス（status filter）で縮小

### 16.2 MV REFRESH の長時間化

- 月次集計が 30 分以上かかると業務時間にかぶる
- 対策: CONCURRENTLY 使用、深夜時間帯固定

### 16.3 INSERT 性能劣化

- INDEX 多数で INSERT が遅い
- 対策: 不要 INDEX を四半期に整理、INSERT バルクは COPY

### 16.4 prepared statement の memory leak

- session mode で接続が長時間維持
- 対策: 接続プール上限 + idle timeout

### 16.5 全文検索の誤ヒット

- `'simple'` 解析で誤マッチ多発
- 対策: ts_rank で並び替え、上位 100 件に限定

### 16.6 MV の不整合

- REFRESH 中の状態が見える
- 対策: CONCURRENTLY 必須、UNIQUE INDEX 維持

---

## 17. 関連ドキュメント

- `docs/specs/2026-04-25-soil-05-index-performance.md`（基本設計）
- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md`
- `docs/specs/2026-04-26-soil-phase-b-02-call-history-import.md`
- `docs/specs/2026-04-26-soil-phase-b-06-rls-detailed.md`
- `docs/specs/2026-04-26-soil-phase-b-07-monitoring-alerting.md`

---

## 18. 受入基準（Definition of Done）

- [ ] tsvector 列 + GIN インデックス実装、Q4 で 300ms 以内
- [ ] pg_trgm name 適用、Q5 で 500ms 以内
- [ ] MV 3 種（月次 / 業種 / 担当案件）作成 + CONCURRENTLY REFRESH
- [ ] REFRESH Cron が深夜稼働
- [ ] 主要 helper の prepared 化完了
- [ ] EXPLAIN ANALYZE Cron が日次稼働 + soil_perf_history に記録
- [ ] pg_stat_statements 週次レポート Chatwork 配信
- [ ] bloat 月次自動 REINDEX
- [ ] 性能リグレッション CI 統合
- [ ] Bloom ダッシュボードに p95 時系列表示
- [ ] 全 Q1-Q7 が §2.1 強化目標達成
