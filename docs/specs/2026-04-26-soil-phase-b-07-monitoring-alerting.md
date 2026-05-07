# Soil Phase B-07: 監視・アラート（Soil 特化、Cross Ops #01 連動）

- 対象: Garden-Soil の運用監視（Cross Ops #01 を Soil 特化拡張）
- 優先度: **🟡 中**（Cross Ops #01 が汎用基盤、本 spec は Soil 固有強化）
- 見積: **0.75d**
- 担当セッション: a-soil + a-rill（Chatwork 通知）/ a-bloom（ダッシュボード）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-07）
- 前提:
  - **Cross Ops #01 monitoring-alerting**（`docs/specs/2026-04-26-cross-ops-01-monitoring-alerting.md`）
  - **Batch 16 Soil 基盤** 全 8 spec
  - Tree 架電アプリ（INSERT 連携）

---

## 1. 目的とスコープ

### 1.1 目的

Cross Ops #01（汎用 Garden 横断）を踏まえ、**Soil 特有の監視項目**（INSERT 量 / 性能劣化 / 容量逼迫 / Tree 架電中の信頼性）を Chatwork / Email 通知連携で実装する Phase B 着手版。

### 1.2 含めるもの

- Soil 特有の `monitoring_events` カテゴリ拡張
- INSERT / UPDATE 量の閾値監視（時間帯別）
- 性能劣化検知（pg_stat_statements）
- 容量逼迫アラート（80% / 90% / 95%）
- Tree 架電中 INSERT エラー監視（5 秒粒度）
- パーティション自動作成 Cron 失敗の即時アラート
- MV REFRESH 失敗の検知
- Chatwork / Email 通知経路
- 月次サマリレポート

### 1.3 含めないもの

- Cross Ops #01 の汎用設計
- インポート → B-01 / B-02
- バックアップ → B-05
- RLS → B-06

---

## 2. Soil 特有の監視カテゴリ

### 2.1 `monitoring_events.category` 拡張

| カテゴリ | 説明 | 重大度既定 |
|---|---|---|
| `list_import_failure` | リストインポート失敗 | high |
| `list_import_orphan_excess` | orphan Leaf が閾値超 | medium |
| `call_history_default_insert` | default パーティションへ誤 INSERT | high |
| `partition_rotate_failed` | 月初パーティション作成 Cron 失敗 | critical |
| `mv_refresh_failed` | MV REFRESH 失敗 | medium |
| `soil_capacity_warning` | テーブル容量逼迫 | medium → high → critical |
| `soil_perf_regression` | 主要クエリ p95 が目標超 | medium |
| `soil_consistency_violation` | Soil ↔ Leaf 整合性違反 | medium |
| `rls_access_pattern_anomaly` | 異常な RLS アクセスパターン | high |
| `tree_insert_failure_burst` | Tree 架電中 INSERT エラー連発 | critical |

### 2.2 重大度の調整ルール

```
medium が 30 分以内に 3 件以上 → high に昇格
high が 1 時間以内に解決しない → critical に昇格
critical は即時 + 30 分後リトライ通知
```

---

## 3. INSERT / UPDATE 量閾値（時間帯別）

### 3.1 ベースライン

```sql
-- 直近 30 日の時間帯別 INSERT 平均
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS inserts
FROM soil_call_history
WHERE created_at > now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
```

### 3.2 時間帯別の異常判定

| 時間帯 | 平均 / 時間 | 警告 | エラー |
|---|---|---|---|
| 平日 9-18 時（架電ピーク）| 5,000 件 | <2,500 or >10,000 | <500 or >20,000 |
| 平日 18-22 時 | 1,000 件 | <500 or >3,000 | <100 or >5,000 |
| 深夜（22-9 時）| 100 件 | >500（異常）| >2,000（攻撃疑い）|
| 土日 | 500 件 | <100 or >2,000 | >5,000 |

### 3.3 検出 Cron

```typescript
// /api/cron/soil-traffic-monitor (1 時間ごと)
const lastHourCount = await getInsertsLastHour();
const baseline = await getBaselineForCurrentHour();

if (lastHourCount < baseline * 0.5) {
  await recordMonitoringEvent({
    severity: 'medium', category: 'soil_traffic_anomaly',
    message: `INSERT 量が平均の 50% 未満: ${lastHourCount}（平均 ${baseline}）`,
  });
}

if (lastHourCount > baseline * 3) {
  await recordMonitoringEvent({
    severity: 'high', category: 'soil_traffic_anomaly',
    message: `INSERT 量が平均の 300% 超: ${lastHourCount}（平均 ${baseline}）`,
  });
}
```

---

## 4. 性能劣化検知（pg_stat_statements）

### 4.1 主要クエリの p95 監視

```sql
-- pg_stat_statements から Soil 主要クエリを抽出
SELECT
  queryid,
  query,
  calls,
  mean_exec_time,
  -- p95 相当: max_exec_time（簡易）
  max_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%soil_%'
  AND calls > 100
ORDER BY mean_exec_time DESC;
```

### 4.2 アラート閾値

| クエリパターン | 目標 p95 | 警告 | エラー |
|---|---|---|---|
| `soil_lists` 単件取得 | 5ms | 20ms | 100ms |
| `soil_lists` phone 検索 | 20ms | 100ms | 500ms |
| `soil_call_history` 月次集計（MV）| 50ms | 200ms | 1000ms |
| `soil_call_history` 全件集計（MV なし）| 5000ms | 10000ms | 30000ms |

### 4.3 自動 Cron

```typescript
// /api/cron/soil-perf-check (1 時間ごと)
const stats = await fetchPgStatStatements();
for (const stat of stats) {
  if (stat.mean_exec_time > getThreshold(stat.queryid)) {
    await recordMonitoringEvent({
      severity: 'medium', category: 'soil_perf_regression',
      message: `${stat.queryid} p95 ${stat.max_exec_time}ms（目標 ${getThreshold(stat.queryid)}ms）`,
    });
  }
}
```

---

## 5. 容量逼迫アラート（段階通知）

### 5.1 監視対象

| 項目 | 閾値 80% | 閾値 90% | 閾値 95% |
|---|---|---|---|
| Supabase 全 DB 容量 | medium | high | critical |
| `soil_lists` テーブル + INDEX | medium | high | critical |
| `soil_call_history` 全パーティション計 | medium | high | critical |
| Storage（バックアップ）| medium | high | critical |

### 5.2 容量取得クエリ

```sql
-- DB 全体
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Soil 関連テーブル
SELECT
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total,
  pg_total_relation_size(schemaname || '.' || tablename) AS total_bytes
FROM pg_tables
WHERE tablename LIKE 'soil_%'
ORDER BY total_bytes DESC;
```

### 5.3 アラート Cron

```typescript
// /api/cron/soil-capacity-monitor (毎日 02:00)
const dbSize = await getDbSize();
const planLimit = await getSupabasePlanLimit();
const usage = dbSize / planLimit;

let severity = null;
if (usage > 0.95) severity = 'critical';
else if (usage > 0.90) severity = 'high';
else if (usage > 0.80) severity = 'medium';

if (severity) {
  await recordMonitoringEvent({
    severity, category: 'soil_capacity_warning',
    message: `DB 容量 ${(usage * 100).toFixed(1)}%（${formatBytes(dbSize)} / ${formatBytes(planLimit)}）`,
    details: { usage_ratio: usage, db_size: dbSize, plan_limit: planLimit },
  });
}
```

---

## 6. Tree 架電中 INSERT エラー（5 秒粒度）

### 6.1 重要性

- Tree 架電中の INSERT 失敗 = 業務ロス（コール記録欠落）
- リアルタイム性必須、5 秒粒度で監視

### 6.2 検出機構

```typescript
// Tree 側 /api/tree/calls/start で INSERT 失敗時
await recordMonitoringEvent({
  severity: 'high',
  category: 'tree_insert_failure',
  source: '/api/tree/calls/start',
  message: 'Tree 架電中のコール記録 INSERT 失敗',
  details: { error: serializeError(e), user_id, list_id },
});
```

### 6.3 連発検知

```typescript
// /api/cron/soil-burst-detect (5 分ごと)
const recent = await fetchEvents({
  category: 'tree_insert_failure',
  since: minutesAgo(5),
});

if (recent.length >= 5) {
  await recordMonitoringEvent({
    severity: 'critical',
    category: 'tree_insert_failure_burst',
    message: `Tree INSERT 失敗が 5 分間に ${recent.length} 件`,
    details: { sample: recent.slice(0, 3) },
  });
  // 即時 Chatwork DM
}
```

---

## 7. パーティション Cron 失敗の即時アラート

### 7.1 検出

```typescript
// /api/cron/soil-partition-rotate (毎月 25 日 03:00)
try {
  await createNextMonthPartition();
} catch (e) {
  await recordMonitoringEvent({
    severity: 'critical',  // 翌月の INSERT が default に流れる前に対応必須
    category: 'partition_rotate_failed',
    source: '/api/cron/soil-partition-rotate',
    message: '月初パーティション作成失敗',
    details: { error: serializeError(e) },
  });
  return Response.json({ ok: false }, { status: 500 });
}
```

### 7.2 default パーティション監視

```sql
-- default に件数が入ったら異常
SELECT COUNT(*) FROM soil_call_history_default;
```

```typescript
// /api/cron/soil-default-check (毎日 06:00)
const defaultCount = await countInDefault();
if (defaultCount > 0) {
  await recordMonitoringEvent({
    severity: 'critical',
    category: 'call_history_default_insert',
    message: `default パーティションに ${defaultCount} 件`,
    details: { count: defaultCount },
  });
}
```

---

## 8. MV REFRESH 失敗の検知

### 8.1 検出

```typescript
// MV REFRESH ヘルパー内
async function refreshMV(name: string) {
  try {
    await supabaseAdmin.rpc(`refresh_${name}`);
    await recordSuccess(name);
  } catch (e) {
    await recordMonitoringEvent({
      severity: 'medium',
      category: 'mv_refresh_failed',
      source: `refresh_${name}`,
      message: `MV ${name} REFRESH 失敗`,
      details: { error: serializeError(e) },
    });
  }
}
```

### 8.2 連続失敗検知

3 回連続失敗で **high** に昇格 → admin 即時通知。

---

## 9. Chatwork / Email 通知経路

### 9.1 ルーム命名

| ルーム | 用途 |
|---|---|
| `Garden-監視-soil` | Soil 全 high 以上 + 月次サマリ |
| `Garden-監視-DM-shoji` | critical のみ DM |
| `Garden-監視-soil-perf` | 性能関連 medium 集約（週次月曜朝）|

### 9.2 通知ルール

| severity | チャネル | タイミング |
|---|---|---|
| critical | DM + ルーム | 即時 + 30 分後リトライ |
| high | ルーム | 即時 |
| medium | ルーム集約 | 翌朝 8:30 |
| low | dev ルーム | 月曜朝 |

### 9.3 Email フォールバック

Chatwork ダウン時、critical のみ Email（東海林さん個人アドレス）。

---

## 10. 月次サマリレポート

### 10.1 内容

```
🌱 Soil 月次レポート（2026-04）

■ データ規模
- soil_lists: 28万件（前月比 +5,000）
- soil_call_history: 320万件（前月比 +8万）

■ 性能
- 主要クエリ p95: 80ms（先月 75ms、許容範囲内）
- MV REFRESH 平均: 4.2 分（target 5 分以内）

■ 監視イベント
- critical: 1 件（解決済）
- high: 8 件（解決済）
- medium: 42 件
- low: 89 件

■ 容量
- soil_lists: 1.2GB（前月 +50MB）
- soil_call_history: 800MB（前月 +30MB）
- 全 Soil: 2GB（前月 +100MB）→ プラン上限まで余裕

■ 改善アクション
- パーティション 202607 自動作成 OK
- MV REFRESH 平均 改善傾向（5.0 → 4.2 分）
- orphan Leaf 案件: 月初 120 件 → 月末 23 件
```

### 10.2 配信

毎月 1 日 09:00 JST に `Garden-監視-soil` + 東海林さん DM。

---

## 11. 法令対応チェックリスト

### 11.1 個人情報保護法

- [ ] 監視ログに個人情報を含めない（user_id は OK、name は NG）
- [ ] アラートの保管期間（1 年、Cross Ops #05 連動）

---

## 12. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `monitoring_events.category` 列挙拡張 | a-soil | 0.25h |
| 2 | INSERT 量監視 Cron | a-soil | 1h |
| 3 | 性能劣化検知 Cron | a-soil | 1h |
| 4 | 容量逼迫 Cron + 段階通知 | a-soil | 0.75h |
| 5 | Tree INSERT エラー検出 + burst 検知 | a-soil + a-tree | 1h |
| 6 | パーティション失敗 + default 監視 | a-soil | 0.5h |
| 7 | MV REFRESH 失敗検知 | a-soil | 0.5h |
| 8 | Chatwork / Email 通知統合 | a-rill | 0.75h |
| 9 | 月次サマリレポート | a-soil + a-bloom | 0.5h |
| 10 | Bloom 監視ダッシュボード Soil 拡張 | a-bloom | 0.75h |

合計: 約 6.5h ≈ **0.75d**

---

## 13. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | INSERT 量ベースライン更新頻度 | 月次再計算（業務拡大時の自動追従）|
| 判 2 | critical 通知の DM 連打 | 30 分間隔で 3 回まで（連打回避）|
| 判 3 | default パーティション監視頻度 | 毎日 06:00、件数 0 確認 |
| 判 4 | 容量警告 80% の閾値 | 80% 既定、Team プラン昇格後は 70% に下げる |
| 判 5 | Tree burst 判定（5 分 5 件）| 既定、業務拡大で再評価 |
| 判 6 | 性能劣化の連続判定 | 1 時間継続で warn、6 時間継続で error |
| 判 7 | 月次レポートの配信時刻 | 毎月 1 日 09:00 JST |

---

## 14. 既知のリスクと対策

### 14.1 監視ストーム

- 同種イベント連発で Chatwork に何百通
- 対策: 5 分粒度で集約、1 通目に集約数を記載

### 14.2 ベースライン誤学習

- 初回投入時の異常値をベースラインに含めると以降の判定が壊れる
- 対策: ベースライン算出時は外れ値除去（IQR 法）

### 14.3 容量警告の誤検知

- バックアップ取得中の一時的増加
- 対策: 30 分継続で確定、瞬間値はスキップ

### 14.4 監視 Cron 自体の失敗

- 監視が動かないと何も検知できない
- 対策: 別系統の UptimeRobot で監視 Cron のヘルスチェック

### 14.5 Chatwork API 制限

- 大量通知でレート超過
- 対策: 集約 + bulk message API + critical 優先

### 14.6 監視データの肥大化

- 1 年で `monitoring_events` が 100 万件超
- 対策: 24 ヶ月超を archive（Cross Ops #05 連動）

---

## 15. 関連ドキュメント

- `docs/specs/2026-04-26-cross-ops-01-monitoring-alerting.md`（汎用基盤）
- `docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md`
- `docs/specs/2026-04-26-soil-phase-b-02-call-history-import.md`
- `docs/specs/2026-04-26-soil-phase-b-04-search-optimization.md`
- `docs/specs/2026-04-26-soil-phase-b-05-backup-recovery.md`
- `docs/specs/2026-04-26-soil-phase-b-06-rls-detailed.md`
- `docs/specs/cross-cutting/spec-cross-chatwork.md`

---

## 16. 受入基準（Definition of Done）

- [ ] `monitoring_events.category` に Soil カテゴリ 10 種追加
- [ ] INSERT 量監視 Cron が 1 時間粒度稼働
- [ ] 性能劣化検知 Cron が稼働、§4.2 閾値で動作
- [ ] 容量逼迫 80/90/95% の段階通知動作
- [ ] Tree INSERT 連発検知（5 分 5 件）動作
- [ ] パーティション失敗 + default 監視 稼働
- [ ] MV REFRESH 失敗検知（連続 3 回で昇格）
- [ ] Chatwork ルーム `Garden-監視-soil` 開設 + 通知到達
- [ ] critical 時の DM フォールバック動作
- [ ] 月次サマリレポート Cron 稼働、毎月 1 日配信
- [ ] Bloom 監視ダッシュボードに Soil タブ追加
- [ ] 監視 Cron 自体の UptimeRobot 監視済
