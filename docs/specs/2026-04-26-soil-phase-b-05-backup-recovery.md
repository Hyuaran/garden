# Soil Phase B-05: バックアップ・リカバリ戦略（Soil 特化）

- 対象: Garden-Soil の大量データ特有のバックアップ・リカバリ
- 優先度: **🔴 高**（253 万件 + 335 万件のデータ消失防御）
- 見積: **0.75d**
- 担当セッション: a-soil + a-main（運用判断）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 007 / Batch 19 Soil Phase B-05）
- 前提:
  - **Cross Ops #02 backup-recovery**（汎用、`docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`）
  - **Batch 16 Soil 基盤**（特に `2026-04-25-soil-07-delete-pattern.md`）

---

## 1. 目的とスコープ

### 1.1 目的

Cross Ops #02（汎用 Garden 横断）を踏まえ、**Soil 大量データ特有の事情**（253 万件 + 335 万件 + 月次パーティション）を反映したバックアップ・リカバリ戦略の Phase B 実装着手版。

### 1.2 含めるもの

- Supabase PITR の Soil 特有制約
- 月次論理ダンプ（パーティション単位）
- Storage 退避（外部 S3 / Cloudflare R2）
- 論理削除パターン準拠の復元（deleted_at = NULL に戻す UI）
- パーティション単位の選択復元手順
- リストア演習（年 1-2 回）
- アーカイブテーブルからの逆復元
- 容量見積 + Supabase プラン
- 復元時の業務影響

### 1.3 含めないもの

- Cross Ops #02 の汎用設計 → 重複しない
- 検索性能 → B-04
- RLS → B-06
- 監視 → B-07

---

## 2. Soil 特有のバックアップ要件

### 2.1 Cross Ops #02 との差分

| 項目 | Cross Ops #02 | Soil B-05 |
|---|---|---|
| 対象 | Garden 全体 | Soil の `soil_lists` / `soil_call_history` 等 |
| 規模 | 全モジュール 9GB 程度 | Soil 単独で約 8-10GB（最大の比重）|
| パーティション | なし（汎用）| 月次 60+ パーティション |
| 復元単位 | DB 全体 / テーブル単位 | **パーティション単位**追加 |
| RPO | 5 分 | **5 分（PITR）** |
| RTO | 1-2h | **1-2h（パーティション単一なら 30 分）** |

### 2.2 Soil の致命データ

- 253 万件のリスト本体（顧客情報 = 個人情報保護法対象）
- 335 万件のコール履歴（業務記録 = 労基法 109 条 5 年保管）
- マージ統合（merged_into_id）チェーン
- インポート履歴（`soil_list_imports`）

これらは**全件保持**、物理削除は法定保存期間経過後のみ。

---

## 3. PITR の Soil 制約

### 3.1 Supabase PITR の単位

- **DB インスタンス全体のみ**（テーブル単位の指定不可）
- 復元先は新インスタンスへの restore（既存に上書きしない）
- 5 分粒度の WAL 保存

### 3.2 Soil 単独復元の戦略

```
1. PITR で過去時刻に新プロジェクト復元
   ↓
2. 新プロジェクトから soil_* テーブルだけ pg_dump
   ↓
3. 現本番に restore（該当テーブルを TRUNCATE 後）
```

時間的には新プロジェクト復元 30 分 + dump 10 分 + restore 10 分 = 約 50 分。

### 3.3 部分復元（テーブル単位）

```bash
# 新プロジェクトから soil_lists のみ抽出
pg_dump --table=public.soil_lists --data-only --format=custom \
  --host=new-project.xxx.supabase.co \
  --file=/tmp/soil_lists_restore.dump

# 本番に流す（事前に TRUNCATE）
TRUNCATE public.soil_lists CASCADE;
pg_restore --data-only --table=public.soil_lists --dbname=postgres /tmp/soil_lists_restore.dump
```

---

## 4. 月次論理ダンプ（パーティション単位）

### 4.1 戦略

- パーティション単位で `pg_dump --table=soil_call_history_YYYYMM`
- 月次バッチで前月分をダンプ → Storage 退避

### 4.2 自動化スクリプト

```typescript
// /api/cron/soil-monthly-dump (毎月 5 日 03:00、前月分)
const lastMonth = previousMonth();  // 'YYYYMM'

await execShell(`
  pg_dump --table=public.soil_call_history_${lastMonth} \
    --format=custom \
    --file=/tmp/soil_call_history_${lastMonth}.dump \
    "$DATABASE_URL"
`);

// Supabase Storage backups バケットに upload
await uploadToBackupBucket(`/tmp/soil_call_history_${lastMonth}.dump`,
  `soil/monthly/${lastMonth}.dump`);

// 外部 R2 にも複製
await replicateToR2(`soil/monthly/${lastMonth}.dump`);
```

### 4.3 サイズ見積

- 1 月分 = 5-10 万件 × 500B = 25-50MB
- 60 ヶ月分 = 1.5-3GB（外部 R2 に 12 ヶ月超を保管）

---

## 5. Storage 退避（外部 S3 / R2）

### 5.1 退避先

| Storage | 用途 | 保管期間 |
|---|---|---|
| Supabase Storage `backups/soil/` | 1 次保管 | 30 日 |
| Cloudflare R2 `garden-backup/soil/` | 2 次保管 | **12 ヶ月**（超過分は §5.5 で Google Drive 自動移管）|
| **Google Drive `Garden-Backup-Archive/`** | **3 次保管 / 永続** | **12 ヶ月超を永続保管** |
| (オフライン保管)| 重大事故後の最終保険 | 永続（年次のみ）|

### 5.2 R2 への複製

```typescript
async function replicateToR2(srcPath: string) {
  const file = await downloadFromSupabaseStorage(srcPath);
  await s3Client.putObject({
    Bucket: 'garden-backup',
    Key: `soil/${srcPath}`,
    Body: file,
    ServerSideEncryption: 'AES256',
  });
}
```

### 5.3 暗号化キー

- R2 暗号化キーは Vercel 環境変数 `BACKUP_ENCRYPTION_KEY`
- 1Password にもバックアップ
- 年 1 回ローテーション

### 5.4 R2 ライフサイクル（東海林さん指示 2026-04-26）

> **改訂背景**: a-main 006 確定後の東海林さん指示（follow-up §1.4）。R2 12 ヶ月超を削除せず Google Drive へ自動移管、永続保管。容量コスト圧縮 + 永続性両立。

- R2 保管: **12 ヶ月**（既定）
- 12 ヶ月超: **Google Drive 自動移管**（§5.5）
- 削除しない（永続保管）

### 5.5 Google Drive 自動移管プロセス（新設）

#### 5.5.1 アーキテクチャ

```
[R2: 12 ヶ月経過 dump]
  ↓ 月次 cron で抽出
[/api/cron/soil-backup-r2-to-gdrive] (毎月 1 日 04:00 JST)
  ↓ Google Drive API（service account）
[Google Drive: Garden-Backup-Archive/]
  ↓ R2 から削除（Drive 移管完了確認後）
[移管ログ → operation_logs]
```

#### 5.5.2 Google Drive 構造

```
Garden-Backup-Archive/
├─ 2025/
│  ├─ 01/
│  │  ├─ soil_call_history_202501.dump.gpg
│  │  ├─ soil_lists_dump_2025-01-01.dump.gpg
│  │  └─ ...
│  └─ ...
├─ 2024/
└─ ...
```

#### 5.5.3 認証と権限

- Google Cloud service account（専用、Garden-Backup-Service-Account）
- Drive API 権限: 専用フォルダ `Garden-Backup-Archive` のみ書込・削除可
- service account 鍵は Vercel 環境変数 `GDRIVE_SERVICE_ACCOUNT_KEY`（1Password バックアップ）
- 年 1 回鍵ローテーション

#### 5.5.4 移管 cron 実装例

```typescript
// /api/cron/soil-backup-r2-to-gdrive (毎月 1 日 04:00 JST)
export async function GET() {
  const candidates = await fetchR2Files({
    prefix: 'soil/',
    olderThan: monthsAgo(12),
  });

  for (const file of candidates) {
    try {
      // 1. R2 から Google Drive へ stream copy
      const stream = await r2.getObject(file.key).createReadStream();
      const gdriveResult = await gdrive.files.create({
        requestBody: {
          name: file.name,
          parents: [getYearMonthFolder(file.uploadedAt)],
        },
        media: {
          mimeType: 'application/octet-stream',
          body: stream,
        },
      });

      // 2. 整合性確認（SHA256 比較）
      const r2Hash = await r2.getObjectHash(file.key);
      const gdriveHash = await gdrive.files.get({ fileId: gdriveResult.data.id, fields: 'md5Checksum' });
      // ※ Drive は SHA256 提供しないため、別途比較ロジック

      // 3. R2 から削除（移管完了確認後）
      await r2.deleteObject(file.key);

      // 4. 移管ログ記録
      await recordMigrationLog({
        from: 'r2',
        to: 'gdrive',
        file_path: file.key,
        gdrive_file_id: gdriveResult.data.id,
        size_bytes: file.size,
      });
    } catch (e) {
      await recordMonitoringEvent({
        severity: 'medium',
        category: 'gdrive_migration_failure',
        message: `R2 → GDrive 移管失敗: ${file.key}`,
        details: { error: serializeError(e) },
      });
      // 失敗時は R2 に残す、次回再試行
    }
  }
}
```

#### 5.5.5 移管ログテーブル

```sql
CREATE TABLE soil_backup_migration_logs (
  id bigserial PRIMARY KEY,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  from_storage text NOT NULL,    -- 'r2' | 'supabase' | ...
  to_storage text NOT NULL,      -- 'gdrive' | ...
  file_path text NOT NULL,
  size_bytes bigint,
  source_id text,
  destination_id text,            -- gdrive file_id 等
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'failed', 'verifying')),
  error_message text,
  performed_by uuid               -- service_role の場合 NULL
);

CREATE INDEX idx_soil_backup_migration_status_time
  ON soil_backup_migration_logs (status, migrated_at DESC);
```

#### 5.5.6 復元時の検索（Drive → ローカル）

過去のバックアップを必要とするケース（年次監査 / インシデント調査）:

1. admin が `/admin/backup-archive-search` から年月指定検索
2. Drive API で該当ファイル取得
3. ローカルに一時 download（24h で削除）
4. 復号 → 検証 → 復元手順（既存 §5）

#### 5.5.7 容量コスト試算

| Storage | 月額単価（参考）| 1 年分の見積 |
|---|---|---|
| R2 | $0.015/GB | 60GB（12 ヶ月）= $0.9/月 |
| Google Drive | プラン内（Workspace）| **追加コストなし** |

Google Drive は Garden 法人 Workspace 契約内のため、**追加コストなしで永続保管**。

---

## 6. 論理削除復元 UI

### 6.1 削除パターン（再掲、Cross History #04 準拠）

| 段階 | 復元 | 権限 |
|---|---|---|
| 論理削除（deleted_at = now()）| `deleted_at = NULL` | manager+ |
| 物理削除 | バックアップから restore（admin+）| super_admin |

### 6.2 論理削除復元 UI `/soil/lists/deleted`

```
┌────────────────────────────────────┐
│ 削除済リスト一覧（admin / manager）│
├────────────────────────────────────┤
│ 検索: [____________] [削除日 ▼]    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 山田工務店 🗑️削除済             │ │
│ │ 削除: 2026-04-15 (manager)      │ │
│ │ 理由: 重複（merged_into=xxx）    │ │
│ │ [復元する]                       │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

### 6.3 一括復元（ロール: super_admin）

- インポート失敗時に大量論理削除した場合の復旧
- フィルタ条件（削除日 / 削除者 / source_system）で絞込
- 100 件 / 1000 件 / 全件 の段階確認

### 6.4 槙さん権限例外（B-06 §17.4 連携、東海林さん指示 2026-04-26）

> **改訂背景**: B-06 §17.4 で定義した module_owner_flags を本 spec のバックアップ復元時にも参照。

#### 復元時の権限境界

| ロール | 復元実行権限 | 対象範囲 |
|---|---|---|
| super_admin（東海林さん）| ✅ 全 Garden | 全モジュール |
| admin | ✅ 全 Garden | 全モジュール |
| **outsource + module_owner_flags['leaf_kanden']=true（槙さん）** | **✅ Leaf 関電のみ** | leaf_kanden_cases / 関連 storage |
| outsource（一般）| ❌ | — |
| その他 | ❌ | — |

#### 槙さん専用復元 UI

```
[Leaf 関電 復元] /soil/admin/restore-kanden  (槙さんのみ表示)

論理削除 復元:
  ☑ leaf_kanden_cases の削除済を一括復元
  ☐ 過去 30 日のみ
  ☐ 全期間
  [復元実行]

部分復元（Storage）:
  対象: 関電案件添付ファイル
  バケット: bud-furikomi-receipts (関電関連のみ)
  [Storage 復元 UI へ]
```

#### RLS で復元クエリにも制約

```sql
-- 復元 Server Action 内で権限チェック
CREATE OR REPLACE FUNCTION can_restore_leaf_kanden(p_user_id uuid)
RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    -- super_admin / admin
    current_garden_role() IN ('admin', 'super_admin')
    OR
    -- outsource + module_owner
    (current_garden_role() = 'outsource'
     AND EXISTS (
       SELECT 1 FROM root_employees
       WHERE user_id = p_user_id
         AND module_owner_flags->>'leaf_kanden' = 'true'
     ));
$$;
```

#### 監査ログ強化

槙さんの復元実行は **特に詳細監査**:

```sql
INSERT INTO operation_logs (
  user_id, module, action, target_type, target_id, details
) VALUES (
  $maki_user_id, 'soil', 'leaf_kanden_restore_by_module_owner',
  'leaf_kanden_cases', $target_id::text,
  jsonb_build_object(
    'restore_type', 'logical_delete_undo',
    'affected_count', $count,
    'reason', $reason,
    'super_admin_notified', true  -- 東海林さんへ Chatwork DM 通知済
  )
);
```

槙さんの復元は **super_admin に Chatwork DM で即時通知**（東海林さんが知らない復元実行を防止）。

---

## 7. パーティション単位の選択復元

### 7.1 シナリオ

```
2026-03 のコール履歴に誤更新発生
  ↓
PITR で 1 時間前に新プロジェクト復元
  ↓
新プロジェクトから soil_call_history_202603 のみ pg_dump
  ↓
本番の soil_call_history_202603 を TRUNCATE
  ↓
pg_restore で書き戻し
```

### 7.2 注意点

- TRUNCATE は他パーティションに影響なし
- ただし `soil_call_history` 親テーブルからの SELECT は一時的に該当月が空になる
- 業務影響を Chatwork 通知（5 分程度）

### 7.3 RTO 短縮案

- 月次論理ダンプから直接 restore（PITR 不要）
- 25-50MB × 数分 = **30 分以内に復旧可**

---

## 8. リストア演習（YAGNI 降格、東海林さん指示 2026-04-26）

> **改訂背景**: a-main 006 確定後の東海林さん指示（follow-up §1.4 #5）。実作業者が槙さん or 東海林さんの 1-2 名のみのため、年次訓練を**必須化しない**。**手順書整備 + 演習レポート**を主軸に。

### 8.1 主軸方針（YAGNI 適用）

- **演習レポート + 手順書更新が最優先**（実訓練より文書化）
- 訓練頻度は柔軟（実作業者が 1-2 名のみのため、人的余力次第）
- 年次訓練は推奨だが**必須化しない**

### 8.2 推奨頻度（参考、必須ではない）

| 訓練 | 推奨頻度 | 必須? |
|---|---|---|
| パーティション単位復元 | 年 1-2 回 | **任意** |
| Soil 全体 PITR 復元 | 年 1 回 | **任意** |
| 外部 R2 / Google Drive 最終復旧 | 障害発生時のみ実演 | **任意** |
| **手順書セルフレビュー** | **年 4 回（四半期）** | **必須**（更新実態確認のみ）|

### 8.3 訓練実施時のレポート

実施した場合は `docs/dr-soil-drill-YYYYMMDD.md` に:

- シナリオ
- 計測 RTO
- 改善点
- known-pitfalls 追記

### 8.4 手順書整備の優先順位

実訓練より以下の文書化を優先:

1. 部分復元手順（パーティション単位）→ `docs/runbooks/soil-restore-partition.md`
2. 全体 PITR 復元手順 → `docs/runbooks/soil-restore-pitr.md`
3. R2 → ローカル復元手順 → `docs/runbooks/soil-restore-r2.md`
4. Google Drive → ローカル復元手順 → `docs/runbooks/soil-restore-gdrive.md`
5. 暗号化キーローテーション手順 → `docs/runbooks/backup-key-rotation.md`

### 8.5 トリガベース演習の代替

形式的な定期訓練の代替として:

- **インシデント発生時の実復旧**を実訓練として記録
- そのまま `docs/dr-soil-incident-YYYYMMDD.md` として残す
- ポストモーテム（Cross Ops #03）と兼用

---

## 9. アーカイブテーブルからの逆復元

### 9.1 シナリオ

24 ヶ月超のコール履歴を別 tablespace にアーカイブ → 監査要請で必要 → 元に戻す。

### 9.2 手順

```sql
-- アーカイブから本体に逆移動
ALTER TABLE soil_call_history_202401 SET TABLESPACE pg_default;

-- INDEX 再構築
REINDEX TABLE soil_call_history_202401;

-- ANALYZE
ANALYZE soil_call_history_202401;
```

数十 GB なら 30 分〜1 時間。

### 9.3 アーカイブ先別の手順

| アーカイブ先 | 復元手順 |
|---|---|
| 別 tablespace | `ALTER TABLE SET TABLESPACE` 即時 |
| 論理レプリケーション別 DB | pg_dump + pg_restore |
| 外部 R2 dump | dump download + pg_restore |

---

## 10. 容量見積と Supabase プラン

### 10.1 Soil 容量試算

| 項目 | サイズ |
|---|---|
| `soil_lists` 本体 | 4GB |
| `soil_lists` インデックス | 2GB |
| `soil_call_history` 本体 | 1.7GB |
| `soil_call_history` インデックス | 1GB |
| MV / staging / 補助 | 0.3GB |
| **Soil 小計** | **約 9GB** |

### 10.2 全 Garden での容量

- Soil + Forest + Bud + Tree + Leaf 等で約 12-15GB

### 10.3 プラン推奨（東海林さん指示 2026-04-26 改訂）

> **改訂背景**: a-main 006 確定後の東海林さん指示（follow-up §1.4 #8）。**当面 Pro 維持**、Team 昇格は将来コスト面で検討。

| プラン | 容量 | 月額 | 採択 |
|---|---|---|---|
| **Pro** | **8GB**（拡張可）| **$25** | **✅ 当面維持**（Phase B 進行中）|
| Pro Plus | 50GB | $25 + 容量超過費 | 🟡 容量超過時の自動拡張で対応 |
| Team | 100GB | $599 | 🟡 将来検討（Phase B-1 完了 + 業務影響評価後）|

#### 採択方針

- **Pro 維持で Phase B 進行**
- 容量逼迫（Cross Ops #02 §10 監視）80% 超で Pro Plus 自動拡張
- Team 昇格判断: **Phase B-1 完了後 + 業務影響評価後**
  - 評価基準: 業務時間帯の DB レイテンシ / Pro Plus 月額の安定性 / PITR 14 日が必要か

### 10.4 Pro での運用上の制約

| 制約 | 影響 | 対策 |
|---|---|---|
| PITR 7 日 | 8 日前は遡れない | 月次 dump を R2 / GDrive で永続保管（§5.5） |
| 同時接続上限 60 | 業務時間帯のピーク制限 | Pooler transaction mode で実効 60 → 数百 |
| 自動 backup 7 日 | 同上 | 月次 dump で代替 |

---

## 11. 復元時の業務影響

### 11.1 全体停止 vs Soil のみ read-only

| パターン | 業務影響 | 手順 | 入力禁止 UX |
|---|---|---|---|
| Soil 全体停止 | 全モジュール影響 | feature flag 経由で全 Garden 停止 | **全画面ポップアップ + 全モジュール書込ブロック**（§11.3 詳述）|
| Soil read-only | Tree / Leaf 参照可、INSERT 不可 | RLS で SELECT のみ許可 | **該当モジュールのみポップアップ + 書込ブロック** |
| パーティション 1 つのみ TRUNCATE | 該当月のクエリのみ空 | 通常運用継続 | 通知のみ、強制ブロックなし |

### 11.3 復元中の入力禁止 UX（東海林さん指示 2026-04-26、follow-up §1.4 #7 反映）

#### 全画面ポップアップ強制入力禁止

復元中は以下の UX で**強制的に入力禁止**:

```
┌─────────────────────────────────────────┐
│  ⚠️ システム復元中                        │
│                                          │
│  Garden は現在、データ復元処理を実行中です。 │
│  業務データの整合性確保のため、              │
│  入力 / 編集操作を一時停止しています。       │
│                                          │
│  ─────────────────────────────────       │
│  対象モジュール: Soil（コール履歴 2026-03）│
│  開始時刻: 2026-04-27 14:00:00 JST       │
│  所要時間（見込み）: 約 30 分              │
│  復旧予定: 14:30 JST                     │
│                                          │
│  ─────────────────────────────────       │
│  問合せ: 東海林さん（社内 PC: 内線 XXX）  │
│  Chatwork: Garden-運用-soil ルーム        │
│                                          │
│  [画面を閉じる] (閲覧のみ可)              │
└─────────────────────────────────────────┘
```

#### DB レベル + UI レベル両方ブロック

| レベル | 実装 |
|---|---|
| **DB レベル** | feature_flags / RLS で書込操作 REJECT（22023 / 42501 ERRCODE）|
| **UI レベル** | アプリ全体で `RestoreInProgressModal` を最前面表示、入力フォームは disabled |

#### feature_flags 連携

```sql
-- 復元開始時に super_admin が設定
UPDATE feature_flags
SET enabled = true,
    rollout_strategy = 'all',
    description = 'Soil コール履歴 2026-03 復元中、書込ブロック'
WHERE module = 'soil'
  AND flag_name = 'restore_in_progress';

-- RLS ポリシーが flag を参照
CREATE OR REPLACE FUNCTION is_module_in_restore(p_module text)
RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM feature_flags
    WHERE module = p_module
      AND flag_name = 'restore_in_progress'
      AND enabled = true
  );
$$;
```

#### UI 側のグローバルチェック

```typescript
// src/components/RestoreInProgressGuard.tsx
async function RestoreInProgressGuard({ module, children }: Props) {
  const inRestore = await isModuleInRestore(module);
  if (inRestore) {
    return (
      <FullScreenModal>
        <RestoreNotification module={module} />
      </FullScreenModal>
    );
  }
  return <>{children}</>;
}
```

主要ページ（dashboard / list / edit）の最上位に配置、復元中は強制ポップアップ。

#### Chatwork 通知テンプレ（§11.4 と統合）

```
🚨 Garden 復元実行中

時刻: 2026-04-27 14:00 〜 14:30 JST
影響: Soil コール履歴 2026-03 月分の閲覧不可
業務: Tree 架電 OK、月次集計のみ一時停止
完了予定: 14:30 JST
担当: 東海林さん

復元中は対象モジュールの書込が自動ブロックされます。
画面に表示される情報をご確認の上、復旧をお待ちください。
```

#### ロール別の挙動

| ロール | 復元中の動作 |
|---|---|
| super_admin（東海林さん）| ポップアップ表示、ただし**復元実行者は閉じれる**（操作必要のため）|
| admin | ポップアップ表示、閉じれる（モニタリング用）|
| その他 | ポップアップ表示、**閉じれない**（書込ブロック解除まで）|

### 11.4 Chatwork 通知テンプレ

```
🚨 Soil 復元作業のお知らせ

時刻: 2026-04-26 14:00 〜 15:00 JST
影響: コール履歴 2026-03 月分の参照不可
業務: Tree 架電 OK、月次集計のみ一時停止
完了予定: 15:00 JST
```

---

## 12. 法令対応チェックリスト

### 12.1 個人情報保護法

- [ ] バックアップの暗号化（保管時 + 転送時）
- [ ] 第 23 条: 安全管理措置（外部 R2 の権限制御）
- [ ] バックアップアクセス権限の最小化（super_admin のみ）

### 12.2 労基法

- [ ] 第 109 条: 業務記録 5 年保管 → コール履歴を消失させない
- [ ] バックアップ自体も 5 年保管対象

---

## 13. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | 月次ダンプ Cron + Storage upload | a-soil | 1.5h |
| 2 | R2 複製スクリプト | a-soil | 1h |
| 3 | 論理削除復元 UI（個別 + 一括）| a-soil | 1.5h |
| 4 | パーティション単位復元手順書 | a-soil + a-main | 0.5h |
| 5 | リストア演習計画 + 訓練レポート | a-main | 0.5h |
| 6 | Supabase プラン提案資料 | a-main | 0.5h |
| 7 | 業務影響通知テンプレ整備 | a-soil | 0.25h |
| 8 | 暗号化キー管理 + ローテーション運用 | a-main | 0.25h |

合計: 約 6h ≈ **0.75d**

---

## 14. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | Supabase プラン昇格 | **Team 推奨**、Phase B-1 並行で判断 |
| 判 2 | R2 保管期間 | 12 ヶ月（最終 12 ヶ月分のみ）|
| 判 3 | 月次ダンプ実施日 | 毎月 5 日 03:00 JST（前月分）|
| 判 4 | 暗号化キー保管箇所 | Vercel 環境変数 + 1Password 二重保管 |
| 判 5 | リストア訓練の頻度 | パーティション単位 = 年 4 回、全体 = 年 2 回 |
| 判 6 | 論理削除復元の権限境界 | manager+（個別）/ super_admin（一括）|
| 判 7 | 復元時の業務停止判断 | パーティション単位なら通知のみ、全体は事前合意必須 |

---

## 15. 既知のリスクと対策

### 15.1 PITR 7 日制限（Pro プラン）

- 8 日前のデータは PITR で戻せない
- 対策: 月次ダンプで 12 ヶ月遡及可能、Team プランで 14 日 PITR

### 15.2 R2 暗号化キー紛失

- 全バックアップが復号不能
- 対策: 1Password + 物理金庫の二重保管

### 15.3 月次ダンプ Cron 失敗

- 1 ヶ月分の論理ダンプが取れない
- 対策: 失敗監視（B-07）、翌日リトライ、Chatwork 即時通知

### 15.4 Supabase アカウント凍結

- 全アクセス不可
- 対策: 月次外部 R2 が最終防衛、決済方法 2 つ登録

### 15.5 復元中の Tree INSERT 失敗

- パーティション TRUNCATE 中に Tree が INSERT
- 対策: feature flag で Tree INSERT を一時停止、復元後再開

### 15.6 容量逼迫で Cron 失敗

- Storage 容量超過
- 対策: B-07 容量監視、80% 超で警告 → 古い R2 dump を 12 ヶ月超は削除

---

## 16. 関連ドキュメント

- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`（汎用基盤）
- `docs/specs/2026-04-25-soil-07-delete-pattern.md`（削除規格）
- `docs/specs/2026-04-26-soil-phase-b-02-call-history-import.md`（パーティション）
- `docs/specs/2026-04-26-soil-phase-b-07-monitoring-alerting.md`（容量監視）
- `docs/specs/2026-04-26-cross-ops-05-data-retention.md`（保持期間）

---

## 17. 受入基準（Definition of Done）

- [ ] 月次ダンプ Cron が稼働、毎月 5 日に前月分実施
- [ ] R2 複製が連動稼働
- [ ] 論理削除復元 UI（個別 + 一括）動作
- [ ] パーティション単位復元手順書が `docs/runbooks/soil-restore.md` に転記
- [ ] リストア演習を 1 回完走（パーティション単位、dev）
- [ ] 演習レポート `docs/dr-soil-drill-*.md` 作成
- [ ] Supabase プラン提案を東海林さんに提示
- [ ] 業務影響通知テンプレが Chatwork で利用可能
- [ ] 暗号化キーが二重保管済
- [ ] Cross Ops #02 と整合（重複なし、補完関係）
