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
| Cloudflare R2 `garden-backup/soil/` | 2 次保管 | 12 ヶ月 |
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

## 8. リストア演習

### 8.1 年次訓練

| 訓練 | 頻度 | 内容 |
|---|---|---|
| パーティション単位復元 | 年 4 回（四半期）| 1 月分を別 DB に restore + 整合性確認 |
| Soil 全体 PITR 復元 | 年 2 回 | 別プロジェクトに復元 + 切替リハーサル |
| 外部 R2 からの最終復旧 | 年 1 回 | Supabase 不在を想定、ローカル PG に restore |

### 8.2 演習レポート

`docs/dr-soil-drill-YYYYMMDD.md` に:

- シナリオ
- 計測 RTO
- 改善点
- known-pitfalls 追記

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

### 10.3 プラン推奨

| プラン | 容量 | 月額 | 推奨度 |
|---|---|---|---|
| Pro | 8GB | $25 | ❌ 不足 |
| Pro Plus | 50GB | $25 + 容量超過費 | 🟡 経過観察 |
| Team | 100GB | $599 | 🟢 推奨（PITR 14 日も付帯）|

Phase B-1 段階で **Team 検討必須**。

---

## 11. 復元時の業務影響

### 11.1 全体停止 vs Soil のみ read-only

| パターン | 業務影響 | 手順 |
|---|---|---|
| Soil 全体停止 | 全モジュール影響 | feature flag 経由で全 Garden 停止 |
| Soil read-only | Tree / Leaf 参照可、INSERT 不可 | RLS で SELECT のみ許可 |
| パーティション 1 つのみ TRUNCATE | 該当月のクエリのみ空 | 通常運用継続 |

### 11.2 Chatwork 通知テンプレ

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
