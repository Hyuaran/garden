# Cross Ops #01: Garden 全体 監視・アラート設計

- 対象: Garden 全モジュールの監視・アラート基盤
- 優先度: **🔴 最高**（運用基盤の起点、Phase B-1 着手の前提）
- 見積: **0.5d**
- 担当セッション: a-main + a-root（一部実装は各モジュール）
- 作成: 2026-04-26（a-auto 003 / Batch 15 Cross Ops #01）
- 前提:
  - memory: project_chatwork_bot_ownership.md（Bot は a-rill 所有）
  - memory: feedback_external_integration_staging.md（外部連携は段階展開）
  - §13 自律実行モード / §16 リリース前バグ確認
  - Cross Cutting: spec-cross-error-handling.md / spec-cross-audit-log.md

---

## 1. 目的とスコープ

### 1.1 目的

Garden 全モジュールの**稼働状況・エラー・遅延を一元監視**し、業務影響のある障害を**即時検知 → 通知 → 対応着手**できる体制を構築する。Vercel / Supabase の標準機能を最大限活用し、追加コストを抑えて多層防御を実現。

### 1.2 含めるもの

- Vercel / Supabase 標準監視の有効化と閾値設定
- Garden 固有のカスタムアラート（Cron 失敗 / KoT 同期失敗 / PDF 生成失敗 等）
- Chatwork Bot 経由の通知経路（即時 / 集約）
- エスカレーションルール（重大度別、誰にいつ通知するか）
- ヘルスチェックエンドポイント設計

### 1.3 含めないもの

- インシデント発生後の対応手順 → #03 incident-response
- バックアップ系の監視 → #02 backup-recovery（被参照のみ）
- ログの長期保管 → #05 data-retention
- セキュリティ監視（侵入検知 等）→ Phase D 以降

---

## 2. 監視レイヤの全体像

### 2.1 4 レイヤ構成

| レイヤ | 監視対象 | 取得元 | 頻度 |
|---|---|---|---|
| **インフラ層** | Vercel デプロイ / Edge 稼働 / Supabase インスタンス | Vercel / Supabase ダッシュボード | リアルタイム |
| **アプリ層** | HTTP 5xx / API 応答時間 / コンソールエラー | Vercel Analytics / Sentry（後述） | 1 分粒度 |
| **業務層** | Cron 成否 / 同期件数異常 / PDF 生成失敗 | Garden 内部 `monitoring_events` テーブル | 即時 |
| **業務 KPI 層** | 振込実行件数 / 給与配信成功率 / 案件作成数 | Bloom ダッシュボード集計 | 日次 |

### 2.2 段階導入計画（Phase B-1 〜 D）

| Phase | 範囲 | 完了条件 |
|---|---|---|
| **B-1**（直近）| インフラ層 + 業務層（Cron 失敗のみ）| Vercel / Supabase アラート + Chatwork 通知が 1 経路で稼働 |
| **B-2** | アプリ層（Sentry 導入）| 5xx と未捕捉例外を Chatwork に流す |
| **C** | 業務層（PDF / 同期 全般）| `monitoring_events` 記録 + 集約通知 |
| **D**（Tree 投入後）| 業務 KPI 層 + SLO/SLA 定義 | 月次レポート自動生成 |

---

## 3. Vercel 標準監視

### 3.1 有効化する機能

| 機能 | プラン | 用途 |
|---|---|---|
| **Vercel Analytics** | 有料プランで Real Experience Score | ページ毎の Core Web Vitals |
| **Speed Insights** | 同上 | 95p/99p 応答時間 |
| **Log Drains** | Pro 以上 | 外部（後述：Supabase Storage / 任意の SIEM）へストリーミング |
| **Deployment Protection** | 全プラン | 失敗デプロイ時のロールバック自動化 |
| **Cron Jobs** | Pro 以上 | 失敗時 Webhook（後述）|

### 3.2 アラート閾値（暫定値）

| 項目 | 閾値 | 重大度 | 経路 |
|---|---|---|---|
| デプロイ失敗 | 1 回 | 🟡 中 | Chatwork（即時、東海林さん 1 名）|
| 5xx エラー率 | 連続 5 分 1% 超 | 🔴 高 | Chatwork（即時、東海林さん + a-main 担当）|
| API p95 応答時間 | 連続 5 分 3 秒超 | 🟡 中 | Chatwork（集約、翌朝）|
| Cron 失敗 | 1 回 | 🔴 高 | Chatwork（即時）|

### 3.3 Vercel Cron 失敗の通知

- Vercel Cron は失敗時に **WebHook URL** を呼ぶ機能あり（`vercel.json` に `cron.failureUrl`）
- Garden 側 `/api/internal/cron-failure` で受信 → `monitoring_events` 記録 → Chatwork 通知
- 検証は `?secret=...` を Vercel 環境変数 `CRON_FAILURE_SECRET` で照合

---

## 4. Supabase 標準監視

### 4.1 有効化する機能

| 機能 | プラン | 用途 |
|---|---|---|
| **Database Health** | 全プラン | CPU / メモリ / Disk I/O |
| **Slow Query Logs** | Pro 以上 | 1 秒超クエリの自動記録 |
| **Connection Pooler 監視** | 全プラン | 同時接続数（pgbouncer）|
| **Auth ログ** | 全プラン | サインイン失敗 / 攻撃検知の起点 |
| **Storage 容量** | 全プラン | 1 GB 単位で警告 |

### 4.2 アラート閾値

| 項目 | 閾値 | 重大度 | 経路 |
|---|---|---|---|
| DB CPU | 5 分平均 80% 超 | 🟡 中 | Chatwork（集約）|
| DB Disk 使用率 | 75% 超 | 🟡 中 | Chatwork（集約、翌朝）|
| DB Disk 使用率 | 90% 超 | 🔴 高 | Chatwork（即時、夜間も）|
| Auth 失敗連続 | 1 分間 10 回超（同一 IP）| 🔴 高 | Chatwork（即時、潜在攻撃）|
| Storage 容量 | 80% 超 | 🟡 中 | Chatwork（集約）|

### 4.3 Supabase Webhook（Database Webhook）

- Supabase は **Database Webhook** で `INSERT/UPDATE/DELETE` を外部に通知できる
- Garden 用の用途:
  - `furikomi_requests`（金額大、承認状態変化）→ Chatwork 通知
  - `monitoring_events`（重大度 high）→ 即時 Chatwork
- Webhook 失敗時の retry は Supabase 側の標準動作（最大 3 回、指数バックオフ）

---

## 5. Garden 固有のカスタム監視

### 5.1 `monitoring_events` テーブル

```sql
CREATE TABLE public.monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  module text NOT NULL,           -- 'bud' | 'tree' | 'leaf' | ...
  category text NOT NULL,         -- 'cron_failure' | 'sync_failure' | 'pdf_failure' | ...
  severity text NOT NULL,         -- 'low' | 'medium' | 'high' | 'critical'
  source text NOT NULL,           -- '/api/cron/kot-sync' 等
  message text NOT NULL,          -- 人間可読
  details jsonb,                  -- 例外スタック、入力等
  notified_at timestamptz,        -- Chatwork 通知済日時（NULL なら未通知）
  resolved_at timestamptz,        -- 解決日時
  resolved_by text,               -- 解決者（手動 or 自動）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_monitoring_events_severity_unresolved
  ON public.monitoring_events (severity, occurred_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX idx_monitoring_events_module_occurred
  ON public.monitoring_events (module, occurred_at DESC);
```

### 5.2 記録ヘルパー

```typescript
// src/lib/monitoring/record.ts
import { createServiceClient } from '@/lib/supabase/service';

export type MonitoringSeverity = 'low' | 'medium' | 'high' | 'critical';
export type MonitoringCategory =
  | 'cron_failure'
  | 'sync_failure'
  | 'pdf_failure'
  | 'webhook_failure'
  | 'rls_violation'
  | 'business_rule_violation';

export async function recordMonitoringEvent(input: {
  module: string;
  category: MonitoringCategory;
  severity: MonitoringSeverity;
  source: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('monitoring_events').insert(input);
  if (error) console.error('[monitoring] failed to record event', error);
}
```

### 5.3 利用例（Cron 失敗時）

```typescript
// src/app/api/cron/kot-sync/route.ts
export async function GET() {
  try {
    const result = await syncKotAttendance();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    await recordMonitoringEvent({
      module: 'root',
      category: 'cron_failure',
      severity: 'high',
      source: '/api/cron/kot-sync',
      message: 'KoT 勤怠同期が失敗しました',
      details: { error: serializeError(e) },
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
```

---

## 6. 通知経路（Chatwork Bot）

### 6.1 全体フロー

```
monitoring_events INSERT
  ↓
Supabase Database Webhook
  ↓
/api/internal/monitoring-webhook (Garden 側 Edge)
  ↓
重大度 + 集約ルール判定
  ↓
[即時通知] Chatwork Bot → 個別ルーム
[集約通知] queue (notified_at = NULL のまま) → 翌朝バッチで送信
```

### 6.2 即時 vs 集約の判定

| severity | 通知タイミング | 配信先 |
|---|---|---|
| `critical` | **即時**（業務停止級）| 東海林さん DM + 該当モジュールルーム + 当日担当 |
| `high` | **即時** | 東海林さん DM + 該当モジュールルーム |
| `medium` | **集約**（翌朝 8:30）| 該当モジュールルームのみ |
| `low` | **集約**（週次月曜朝）| dev ルームのみ |

### 6.3 集約フォーマット（翌朝 8:30 / 月曜 8:30）

```
📊 Garden 監視サマリ (2026-04-26 集約)

■ 昨日の medium イベント
- 09:42 [bud] PDF 生成失敗（ID: xxx）
- 14:18 [tree] KoT 同期遅延（基準値超 2.3s）

■ 未解決の high 以上
- 2026-04-25 22:11 [root] cron_failure /api/cron/kot-sync 経過 10h ⚠️

■ 24h 内のイベント数
| module | low | medium | high | critical |
|---|---|---|---|---|
| bud | 3 | 1 | 0 | 0 |
| tree | 5 | 2 | 0 | 0 |
| ...

詳細: monitoring_events テーブル
```

### 6.4 Chatwork ルーム命名規則

| ルーム | 用途 |
|---|---|
| `Garden-監視-全体` | 全 medium 以上集約 + 月曜朝サマリ |
| `Garden-監視-bud` | Bud 個別 high 以上 |
| `Garden-監視-tree` | Tree 個別 high 以上 |
| `Garden-監視-DM-shoji` | 東海林さん DM（critical のみ）|

---

## 7. エスカレーションルール

### 7.1 時間帯別

| 重大度 | 平日 9:00-22:00 | 平日 22:00-9:00 / 土日 |
|---|---|---|
| `critical` | 即時通知 + 電話（手動）| 即時通知（東海林さん DM 連打）|
| `high` | 即時通知 | 翌朝 8:30 に集約 + DM |
| `medium` | 集約（翌朝）| 集約（翌朝）|
| `low` | 集約（月曜朝）| 集約（月曜朝）|

### 7.2 未解決時のエスカレーション

```
high 発生 → 30 分経過 resolved_at IS NULL
  ↓
通知 retry（同じ宛先、「未解決」プレフィックス）
  ↓
さらに 30 分経過
  ↓
東海林さん DM に再送（夜間でも）
```

実装は Cron 5 分粒度で `monitoring_events` を走査、`notified_at` と `resolved_at` を比較。

### 7.3 critical 発生時の追加対応

- **Chatwork 通知に加え**、同時に下記を実施:
  - 該当 Cron の **自動停止**（`feature_flags.cron_kot_sync_enabled = false`）
  - Garden トップ画面に **障害バナー**（管理者のみ手動でも出せる）
  - インシデント Slack/Chatwork チャンネル自動作成（#03 で詳細）

---

## 8. ヘルスチェックエンドポイント

### 8.1 `/api/health`

```typescript
// src/app/api/health/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION,
    region: process.env.VERCEL_REGION,
  });
}
```

- 認証不要（誰でも叩ける）
- 30 秒間隔で外部 uptime monitor（UptimeRobot 等、無料枠で十分）が叩く
- 5xx or タイムアウト 3 回連続で Chatwork 即時通知

### 8.2 `/api/health/deep`（管理者のみ）

```typescript
// 認証必須、admin+
// DB 接続 / Storage 接続 / 外部 API 接続を実際に確認
{
  status: 'degraded' | 'ok' | 'down',
  checks: {
    db: { ok: true, latency_ms: 12 },
    storage: { ok: true, latency_ms: 45 },
    kot_api: { ok: false, latency_ms: null, error: 'IP 制限により拒否' },
    chatwork_api: { ok: true, latency_ms: 230 },
  },
  timestamp: '2026-04-26T08:30:00Z'
}
```

### 8.3 外部 uptime monitor の選定

| サービス | 無料枠 | 推奨度 | 備考 |
|---|---|---|---|
| **UptimeRobot** | 50 monitor / 5 分間隔 | ★★★ | 最有力、Chatwork 通知も Webhook 経由可 |
| **Better Uptime** | 10 monitor / 3 分間隔 | ★★ | UI 良いが無料枠狭い |
| **Vercel Analytics** | 含む | — | 既に契約中ならこちらだけでもよい |

---

## 9. ダッシュボード設計

### 9.1 Garden 内部ダッシュボード（Bloom 配下）

`/bloom/monitoring` に以下を配置:

- 直近 24h の重大度別グラフ（Chart.js）
- 未解決イベント一覧（severity desc）
- モジュール別 / カテゴリ別ヒートマップ
- Cron 一覧と直近実行結果（成功 / 失敗バッジ）

### 9.2 アクセス権限

| ロール | 閲覧 | 解決操作 |
|---|---|---|
| `super_admin` | ✅ 全件 | ✅ |
| `admin` | ✅ 全件 | ✅ |
| `manager` | ✅ 自モジュール分のみ | ❌ |
| その他 | ❌ | ❌ |

---

## 10. 実装計画とタスク分解

### 10.1 タスク一覧

| # | タスク | 担当 | 見積 | 依存 |
|---|---|---|---|---|
| 1 | `monitoring_events` migration | a-root | 0.5h | — |
| 2 | `recordMonitoringEvent` ヘルパー | a-root | 0.5h | 1 |
| 3 | `/api/internal/monitoring-webhook` | a-root | 1h | 1 |
| 4 | Chatwork 通知ヘルパー（即時 / 集約）| a-rill | 1.5h | spec-cross-chatwork |
| 5 | Vercel Cron failureUrl 設定 | a-main | 0.5h | 3 |
| 6 | Supabase Database Webhook 設定 | a-root | 0.5h | 3 |
| 7 | `/api/health` `/api/health/deep` | a-main | 1h | — |
| 8 | UptimeRobot 設定 | a-main | 0.5h | 7 |
| 9 | Bloom 監視ダッシュボード | a-bloom | 2h | 1 |
| 10 | エスカレーション Cron（5 分）| a-rill | 1h | 4 |

合計: 約 9h（0.5d で済むのは並列前提、直列なら 1.5d）

### 10.2 段階リリース

| 段階 | スコープ | 期間 |
|---|---|---|
| **α**（東海林さん 1 人）| 1〜6（DB + Webhook + Chatwork 即時のみ）| 1 週間 |
| **β**（3-5 名管理者）| + 7〜10（ヘルスチェック + ダッシュボード）| 2 週間 |
| **リリース** | 全モジュール導入完了 | — |

---

## 11. テスト戦略

### 11.1 単体テスト

- `recordMonitoringEvent` の各 severity 分岐
- 通知判定ロジック（即時 / 集約）の境界値
- エスカレーション 30 分判定（タイマーモック）

### 11.2 統合テスト

- Cron 失敗 → `monitoring_events` 記録 → Chatwork 通知到達
- Database Webhook → `/api/internal/monitoring-webhook` → 重大度判定
- ヘルスチェック故意失敗 → UptimeRobot 通知

### 11.3 演習（Drill）

月 1 回、本番に**疑似 critical イベント**を 1 件 INSERT し、エスカレーション動作を確認。

```sql
-- drill 用（深夜に実行）
INSERT INTO monitoring_events
  (module, category, severity, source, message, details)
VALUES
  ('drill', 'cron_failure', 'critical', '/drill',
   '[DRILL] エスカレーション訓練', '{"drill": true}'::jsonb);
```

訓練判定は `details->>'drill' = 'true'` で識別、Chatwork 通知は同じ経路を辿るが文面に **[DRILL]** を付与。

---

## 12. 既知のリスクと対策

### 12.1 通知ストーム

- 同じエラーが連続発生 → Chatwork に何百通も流れる
- 対策: 同 module + 同 category + 同 source の連続発生は **5 分間 1 通に集約**（DB トリガで `notified_at` を 1 通目に集約）

### 12.2 Supabase Webhook の遅延

- 大量 INSERT 時、Supabase Webhook がキュー詰まり → 通知遅延
- 対策: critical のみは Garden アプリ側でも直接 Chatwork に送る冗長経路（Webhook が動いていなくても流れる）

### 12.3 Chatwork API 制限

- 5 分 300 通の API 制限あり
- 対策: 集約パスは bulk message API を活用、即時パスは critical / high のみに絞る

### 12.4 監視のための監視

- 監視基盤自体が落ちたら誰も気づかない
- 対策: 別系統の UptimeRobot で `/api/health` を 5 分間隔監視、UptimeRobot 自身が Chatwork に直接通知（Garden を経由しない）

---

## 13. 関連ドキュメント

- `docs/specs/cross-cutting/spec-cross-error-handling.md`
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- `docs/specs/cross-cutting/spec-cross-chatwork.md`
- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`
- `docs/specs/2026-04-26-cross-ops-03-incident-response.md`
- `docs/specs/2026-04-26-cross-ops-06-runbook.md`

---

## 14. 受入基準（Definition of Done）

- [ ] `monitoring_events` テーブル作成済 + RLS（admin+ のみ参照）
- [ ] Vercel Cron 失敗が Chatwork 通知到達（手動失敗 → 1 分以内に届く）
- [ ] Supabase DB Webhook が `/api/internal/monitoring-webhook` を叩く
- [ ] `/api/health` が UptimeRobot から監視されている
- [ ] critical 疑似イベント Drill が成功（30 分以内に通知 + 30 分後 retry）
- [ ] Bloom ダッシュボードで未解決一覧が見える
- [ ] エスカレーション Cron が 5 分粒度で稼働
- [ ] 通知ストーム抑制（5 分集約）が動作
