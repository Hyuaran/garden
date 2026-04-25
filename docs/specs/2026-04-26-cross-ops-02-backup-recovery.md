# Cross Ops #02: Garden 全体 バックアップ・リカバリ設計

- 対象: Garden 全モジュールのデータ保全・復旧
- 優先度: **🔴 最高**（業務停止リスクの直接防御）
- 見積: **0.5d**
- 担当セッション: a-main + a-root（DB） / a-main + a-leaf（Storage）
- 作成: 2026-04-26（a-auto 003 / Batch 15 Cross Ops #02）
- 前提:
  - memory: project_delete_pattern_garden_wide.md（論理 / 物理削除）
  - memory: project_chatwork_bot_ownership.md
  - Cross Ops #01 monitoring-alerting
  - Cross History #04 delete-pattern

---

## 1. 目的とスコープ

### 1.1 目的

Garden の**全データ資産を消失リスクから守り**、万一の事故時には業務影響を最小化する形で復旧できる体制を整える。Supabase 標準の PITR（Point-In-Time Recovery）を中核に、Storage バケットの定期バックアップ、リストア手順書、DR 訓練計画を含む。

### 1.2 含めるもの

- DB バックアップ（PITR / 日次 / 週次 / 月次）
- Storage バケット バックアップ（決算書 PDF 等の重要ファイル）
- リストア手順書（部分 / 全体 / 時刻指定）
- DR 訓練計画（年 1〜2 回）
- バックアップ自体の整合性検査

### 1.3 含めないもの

- 論理削除されたレコードの「復元 UI」 → Cross History #04
- 監査ログ → spec-cross-audit-log
- Drive / Google Workspace のバックアップ（Forest 等は別管理）
- インシデント発生時の対応プレイブック → #03

---

## 2. データ資産の分類と RPO/RTO

### 2.1 RPO/RTO 用語

- **RPO (Recovery Point Objective)**: 許容できるデータ損失時間
- **RTO (Recovery Time Objective)**: 復旧完了までの目標時間

### 2.2 Garden データ資産の分類

| 分類 | 例 | 業務影響 | RPO | RTO |
|---|---|---|---|---|
| **致命** | 給与・振込・取引履歴・案件マスタ | 業務停止 | 5 分 | 1h |
| **重要** | 従業員マスタ・操作ログ・KPI 集計 | 業務遅延 | 1h | 4h |
| **通常** | 設定値・通知履歴・UI 状態 | 一時不便 | 24h | 24h |
| **軽量** | キャッシュ・一時計算結果 | 影響小 | — | 自動再生成 |

### 2.3 RPO 達成のためのバックアップ戦略

| 戦略 | 対応 RPO | 対象 |
|---|---|---|
| **Supabase PITR**（5 分単位）| 5 分 | 致命 / 重要 |
| **日次論理ダンプ**（pg_dump）| 24h | 全テーブル |
| **週次フル**（Supabase Snapshot）| 7d | 全 DB |
| **月次保管**（外部 Storage コピー）| 30d | 致命のみ |

---

## 3. Supabase DB バックアップ

### 3.1 PITR（Point-In-Time Recovery）

- **Pro プラン以上で有効化**
- 過去 7 日間（プラン依存、Pro=7d / Team=14d / Enterprise=30d）の任意時刻に復元可能
- WAL（Write-Ahead Log）を 5 分粒度で保持

#### 復元単位

- **インスタンス全体のみ**（テーブル単位指定は不可）
- 復元は新しいインスタンスにリストア → Garden 切り替え or データ抽出

### 3.2 日次論理ダンプ

```bash
# Vercel Cron 経由で /api/cron/db-dump（毎日 03:00 JST）
# 実装は Supabase Functions または別 worker でも可

pg_dump \
  --host=db.xxx.supabase.co \
  --username=postgres \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=/tmp/garden-$(date +%Y%m%d).dump

# Storage（バックアップ専用バケット）に upload
supabase storage cp /tmp/garden-*.dump backups/db/
```

**保管期間**: 30 日間（Storage のライフサイクルで自動削除）

### 3.3 週次フルスナップショット

- Supabase ダッシュボードから手動で **Project Snapshot** を週 1 回取得
- 自動化したい場合は Management API（`POST /v1/projects/{ref}/database/backups`）
- 保管期間: 90 日

### 3.4 月次外部コピー

- 月初に最新の `pg_dump` を **外部 S3 互換 Storage**（Cloudflare R2 等）にコピー
- Supabase 障害時の最終防衛線
- 保管期間: 12 ヶ月（年次のみ永続保管）

---

## 4. Storage バケット バックアップ

### 4.1 バケット重要度分類

| バケット | 重要度 | バックアップ戦略 |
|---|---|---|
| `forest-tax-files`（決算書）| 致命 | 日次フル + 月次外部コピー |
| `bud-furikomi-receipts`（振込控）| 致命 | 同上 |
| `bud-salary-statements`（給与明細 PDF）| 致命 | 同上 |
| `tree-call-records`（通話録音）| 重要 | 日次差分 + 90d 外部 |
| `leaf-uploads`（業務委託書類）| 重要 | 日次差分 |
| `bloom-exports`（KPI レポート）| 通常 | 再生成可能、バックアップ不要 |

### 4.2 日次バックアップ実装

```typescript
// src/app/api/cron/storage-backup/route.ts
// 毎日 04:00 JST 実行（DB ダンプの 1h 後）

export async function GET() {
  const buckets = ['forest-tax-files', 'bud-furikomi-receipts', 'bud-salary-statements'];
  for (const bucket of buckets) {
    await rsyncBucketToBackup(bucket);
  }
  return Response.json({ ok: true });
}
```

### 4.3 rsync 相当の差分バックアップ

- **新規ファイル**: バックアップバケットに COPY
- **更新ファイル**: タイムスタンプ比較で差分のみ COPY
- **削除ファイル**: バックアップ側は **保持**（誤削除復旧のため）
- 90 日後にバックアップ側を物理削除（保持期間ポリシーに従う）

### 4.4 バックアップ専用バケット

```
Supabase Storage:
├─ backups/
│  ├─ db/
│  │  ├─ garden-20260426.dump
│  │  └─ ...
│  └─ storage/
│     ├─ forest-tax-files/2026-04-26/...
│     ├─ bud-furikomi-receipts/2026-04-26/...
│     └─ ...
```

- バックアップバケット自体は **public=false**, RLS で `super_admin` のみアクセス可
- 暗号化: Supabase Storage のサーバー側暗号化（既定で有効）

---

## 5. リストア手順

### 5.1 シナリオ別の判断フロー

```
事故発生
  ↓
影響範囲の特定（部分 / 全体）
  ↓
┌─────────────────────────────┐
│ 部分（特定テーブル / レコード） │ → §5.2 部分復元
├─────────────────────────────┤
│ 全体（DB 全部）              │ → §5.3 PITR 復元
├─────────────────────────────┤
│ Storage ファイル消失         │ → §5.4 Storage 復元
├─────────────────────────────┤
│ Supabase 自体が停止          │ → §5.5 外部 dump からの全面復旧
└─────────────────────────────┘
```

### 5.2 部分復元（特定テーブル / レコード）

#### 軽微（誤更新数件）

```sql
-- 1. PITR で 1 時間前のデータを別スキーマに復元
-- → Supabase ダッシュボードで Restore to new project

-- 2. 該当レコードを抽出
SELECT * FROM new_project.public.salaries
WHERE employee_id = 'xxx' AND year_month = '2026-03';

-- 3. 現プロジェクトに反映
UPDATE public.salaries SET ... WHERE id = 'xxx';

-- 4. 監査ログ追記
INSERT INTO operation_logs (...) VALUES (...'手動復元', ...);
```

#### テーブル丸ごと

```sql
-- 1. PITR で別プロジェクトに復元
-- 2. pg_dump で該当テーブルだけ抽出
pg_dump --table=public.salaries --data-only --format=custom \
  --host=new-project.xxx.supabase.co \
  --file=/tmp/salaries-restore.dump

-- 3. 現プロジェクトに restore（該当テーブルを TRUNCATE 後）
TRUNCATE public.salaries CASCADE;
pg_restore --data-only --table=public.salaries \
  --host=current-project.xxx.supabase.co \
  /tmp/salaries-restore.dump
```

### 5.3 全体復元（PITR）

```
1. Supabase ダッシュボード → Database → Backups
2. PITR から目標時刻を選択（例：2026-04-26 14:30 JST）
3. "Restore to new project" を実行
   → 新プロジェクト xxx-restored が作成される
4. Garden の DATABASE_URL を新プロジェクトに切替（Vercel 環境変数）
5. 動作確認 → ユーザーに再ログイン依頼
6. 旧プロジェクトは 30 日後にアーカイブ
```

**RTO 目安**: 1〜2 時間（Supabase 復元は 30〜60 分、切替 30 分、確認 30 分）

### 5.4 Storage ファイル復元

```bash
# 単一ファイル
supabase storage cp \
  backups/storage/forest-tax-files/2026-04-26/2025-1Q.pdf \
  forest-tax-files/2025-1Q.pdf

# バケット丸ごと（致命的事故時）
supabase storage rsync \
  backups/storage/forest-tax-files/2026-04-26 \
  forest-tax-files/
```

### 5.5 外部 dump からの全面復旧

Supabase 自体が長期障害の場合のみ。**最後の手段**。

```bash
# 1. 月次外部 Storage（Cloudflare R2 等）から最新 dump を取得
aws s3 cp s3://garden-backup/db/2026-04-01.dump ./latest.dump --endpoint-url=https://xxx.r2.cloudflarestorage.com

# 2. 新規 Supabase プロジェクト作成 or 別 PostgreSQL に restore
pg_restore --no-owner --no-acl --dbname=postgres latest.dump

# 3. Garden を新環境に向け直し
# 4. 月次の dump 以降のデータは消失（業務影響説明）
```

---

## 6. バックアップ整合性検査

### 6.1 自動検査（毎日）

```typescript
// /api/cron/backup-verify (毎日 05:00)
export async function GET() {
  // 1. 直近の dump ファイルが存在するか
  const latest = await getLatestBackup();
  if (!latest || daysSince(latest.created_at) > 1) {
    await recordMonitoringEvent({
      module: 'ops',
      category: 'backup_failure',
      severity: 'critical',
      source: '/api/cron/backup-verify',
      message: 'DB バックアップが 24h 以上更新されていません',
      details: { latest },
    });
    return Response.json({ ok: false }, { status: 500 });
  }

  // 2. ファイルサイズが極端に小さくないか（前日比 50% 未満なら異常）
  const previousSize = await getPreviousBackupSize();
  if (latest.size < previousSize * 0.5) {
    await recordMonitoringEvent({ severity: 'high', /* ... */ });
  }

  // 3. ヘッダー検証（pg_restore --list で読めるか）
  const ok = await verifyDumpHeader(latest);
  if (!ok) await recordMonitoringEvent({ severity: 'critical', /* ... */ });

  return Response.json({ ok });
}
```

### 6.2 月次検査（リストアテスト）

毎月 1 日、**実際にリストアしてみる**:

1. 最新 dump を別 Postgres インスタンス（ローカル or Docker）に restore
2. 主要テーブルのレコード数チェック（前月比 ±20% 以内）
3. ランダム 10 レコードを SHA256 ハッシュで本番と照合
4. 結果を `docs/dr-monthly-YYYYMM.md` に記録

---

## 7. DR（Disaster Recovery）訓練

### 7.1 年次訓練（必須）

| 訓練種別 | 頻度 | 内容 |
|---|---|---|
| **PITR 復元演習** | 年 2 回 | 任意時刻に復元 → 切替 → 確認 |
| **外部 dump 復旧演習** | 年 1 回 | Supabase 不在を想定、別 PostgreSQL に復元 |
| **Storage 復旧演習** | 年 2 回 | バケット丸ごとリストア |
| **テーブル誤削除復旧** | 年 4 回 | 特定テーブル削除 → 復元 |

### 7.2 訓練実施時の注意

- **本番環境ではなくステージング環境**で実施
- 各訓練を `docs/dr-drill-YYYYMMDD.md` に記録
- **計測項目**: 開始から復旧完了までの実時間（RTO 検証）
- 失敗時は手順書を改訂

### 7.3 訓練レポートのフォーマット

```markdown
# DR 訓練 - 2026-06-15 - PITR 復元演習

## 想定シナリオ
- 14:00 に salaries テーブル全件 DELETE が誤実行された

## 実施手順
1. 14:00 直前にスナップショット取得（Drill 用）
2. 14:00:30 に DELETE 実行
3. PITR で 13:55 に復元 → 別プロジェクト
4. salaries テーブルを pg_dump で抽出
5. 本番に pg_restore

## 計測
- 検知 → 復元決定: 12 分
- 復元実施: 47 分
- 切替・確認: 18 分
- 合計 RTO: 77 分（目標 60 分、+17 分）

## 改善点
- PITR の対象時刻選択 UI が分かりにくい → 手順書に画面例追加
- 復元中 Garden を read-only にする手順が抜けていた → §5.3 に追記
```

---

## 8. 操作ログとバックアップの関係

### 8.1 操作ログ自体のバックアップ

- `operation_logs` も DB の一部 → PITR で復元可能
- ただし**復元時刻以降のログは消える** → Garden 側で `audit_chain.parent_hash` の連続性検証で改ざん検知

### 8.2 復元後の整合性

- 復元時刻以降に行われた操作は**消える**（業務側の記憶と DB が乖離）
- 復元実施後は **Chatwork で全社通知**:
  > 「14:30 に DB 復元を実施しました。13:00〜14:30 の間に行った操作は反映されていません。
  > 該当時間に振込・給与処理・案件作成等を行った方は再操作をお願いします。」

---

## 9. 暗号化とセキュリティ

### 9.1 バックアップの暗号化

| 層 | 暗号化方式 |
|---|---|
| Supabase 内部 | サーバー側暗号化（AES-256、既定）|
| 外部 Storage（R2 等）| クライアント側暗号化（GPG / age）+ サーバー側暗号化 |
| ローカル dump 一時ファイル | 5 分以内に削除、`/tmp` のみ使用 |

### 9.2 鍵管理

- 外部 Storage 用の暗号化鍵は **Vercel 環境変数**（`BACKUP_ENCRYPTION_KEY`）
- バックアップ復元時のみ復号
- 鍵ローテーション: 年 1 回（鍵更新時は前 1 年分の dump を再暗号化）

### 9.3 バックアップへのアクセス制限

- Supabase Storage `backups/` バケット: super_admin のみ
- 外部 Storage: 専用 IAM ロール（`garden-backup-restore`）、東海林さんのみ

---

## 10. コスト試算

### 10.1 Supabase 関連

| 項目 | 月額 | 備考 |
|---|---|---|
| Pro プラン（PITR 7d）| $25 | 既に契約中 |
| 追加 Storage（dump 保管 30d × 5GB）| $1 | 1GB あたり $0.02 |
| **小計** | **$26** | |

### 10.2 外部 Storage（Cloudflare R2）

| 項目 | 月額 | 備考 |
|---|---|---|
| Storage（12 ヶ月 × 月初 dump 5GB）| $1 | 60GB × $0.015 |
| 帯域（復元時のみ、月平均 1GB）| $0 | egress 無料 |
| **小計** | **$1** | |

### 10.3 合計

**月額 $27（約 4,000 円）** で RPO 5 分 / RTO 1〜2h を達成できる見込み。

---

## 11. 段階導入計画

| Phase | スコープ | 完了条件 |
|---|---|---|
| **Phase A**（既に有効）| Supabase PITR 7 日 | ダッシュボード確認のみ |
| **Phase B-1**（直近）| 日次 dump + Storage バックアップ | Cron 稼働 + 整合性検査 |
| **Phase B-2** | 月次外部コピー（R2）| 鍵管理整備後 |
| **Phase C** | DR 訓練年 2 回 | 訓練レポート 1 件以上 |
| **Phase D**（Tree 投入後）| RPO/RTO の SLA 化 | 月次レビュー定例化 |

---

## 12. 既知のリスクと対策

### 12.1 PITR の保持期間制限

- Pro プラン 7 日間のみ
- 7 日超の遡及が必要 → 日次 dump or 週次スナップショットを使用

### 12.2 Storage バケットの差分検知失敗

- ファイル更新がタイムスタンプ更新を伴わないケース（メタデータのみ更新等）
- 対策: SHA256 ハッシュも保存、ハッシュ差分でも検知

### 12.3 復元中の業務影響

- Garden 全体の停止が必要（書込競合防止）
- 対策: 復元時刻を**業務閑散時（土日朝 6:00 等）**に決定、事前 Chatwork 通知

### 12.4 バックアップが暗号化キー紛失で開けない

- 対策: 暗号化キーを **2 箇所**に保管（Vercel 環境変数 + 1Password 等の物理金庫的場所）

### 12.5 Supabase アカウント自体の凍結

- 支払い遅延等でアカウント凍結 → 全データアクセス不可
- 対策: 月次外部 dump（R2）で最終防衛、決済方法を 2 つ登録

---

## 13. 関連ドキュメント

- `docs/specs/2026-04-26-cross-ops-01-monitoring-alerting.md`
- `docs/specs/2026-04-26-cross-ops-03-incident-response.md`
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- `docs/specs/cross-cutting/spec-cross-storage.md`

---

## 14. 受入基準（Definition of Done）

- [ ] Supabase Pro プラン PITR 7 日有効化済
- [ ] 日次 `/api/cron/db-dump` が稼働、Storage に保存
- [ ] 日次 `/api/cron/storage-backup` が主要バケットを差分バックアップ
- [ ] 月次外部 R2 コピー Cron が稼働
- [ ] `/api/cron/backup-verify` が日次で整合性検査
- [ ] リストア手順書（§5）を東海林さんが**手順通りに 1 回実施成功**
- [ ] DR 訓練 1 回以上実施 → `docs/dr-drill-*.md` 作成
- [ ] バックアップ自体の監視（#01）と連動
- [ ] 暗号化キーが 2 箇所に保管済
