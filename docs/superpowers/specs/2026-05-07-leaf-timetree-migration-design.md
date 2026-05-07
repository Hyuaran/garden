# Garden-Leaf 関電業務委託: TimeTree → Garden 既存画像移行 設計書

- 優先度: 🟡 中（Phase B-2、A-1c v3 添付機能完成後）
- 見積: **2.5d**（CSV パーサ 0.5d + アップロード支援 UI 1.0d + 並行運用ガイド 0.3d + テスト 0.7d）
- 作成: 2026-05-07 起草（a-leaf-002、a-main-013 main- No. 86 全前倒し dispatch # 3）
- 関連 spec: A-1c v3.2（添付ファイル機能、PR #130）/ A-1c 将来拡張 設計指針（PR #131）
- 前提:
  - A-1c v3.2 Phase A Backoffice UI 完成（添付一覧・upload・削除 UI が稼働中）
  - A-1c 共通基盤（attachments.ts / kanden-storage-paths.ts / image-compression）が利用可能
  - 親 CLAUDE.md §11〜§18（横断調整・現場 FB 運用ルール）

---

## 1. Executive Summary

### 1.1 目的

関電業務委託案件の業務上必要な画像（電灯/動力/ガス/諸元/受領書）は、現状 **TimeTree（カレンダー型予定共有アプリ）** に蓄積されている。Garden-Leaf A-1c v3.2 で添付ファイル機能が完成した後、過去画像を Garden に移行することで:

- 一元管理（Garden Backoffice 上で全画像を検索・参照可能に）
- 検索性向上（案件 ID / カテゴリ / 日付で絞込）
- 将来の OCR 自動化の前提データ整備
- TimeTree からの段階的撤退

### 1.2 スコープ

| 項目 | 内容 |
|---|---|
| 移行戦略 | **B 半自動**（CSV エクスポート + 手動アップロード支援 UI） |
| Phase 配置 | **B-2**（A-1c v3.2 添付機能完成後、関電業務委託のみで先行） |
| import 範囲 | **関電業務委託のみ + 直近 2 年**（容量制限考慮） |
| カテゴリ自動判定 | **手動**（CSV 編集でアップロード前に整備） |
| 並行運用期間 | **1 ヶ月**（β版運用との重複期間） |
| 対象 bucket | `recent`（直近 1 年）+ `monthly`（13-24 ヶ月）の 2 階層振分 |

### 1.3 スコープ外（次フェーズ以降）

- TimeTree API 直接接続（API rate limit / 認証コスト考慮で不採用、半自動方式で十分）
- 全期間（2 年超）の移行（容量・実用性で再検討、Phase C 以降）
- 他商材（光回線・クレカ等）の移行（各商材で個別 spec 起草）
- 自動カテゴリ判定（OCR / ML、別 spec で OCR 機能完成後に検討）
- TimeTree からの完全切替（Phase C で再評価、移行完了後の業務 SOP 改訂と一体）

### 1.4 主な設計判断（6 論点、a-main-013 main- No. 93 全 OK）

| # | 論点 | 採択 | 理由 |
|---|---|---|---|
| 1 | 移行戦略 | B 半自動 | API 連携の認証コスト回避、手動レビューでデータ品質確保、β版運用と相性良 |
| 2 | Phase 配置 | B-2 | A-1c v3.2 添付機能の Backoffice UI 完成が前提、関電業務委託のみ先行で他商材展開時の知見蓄積 |
| 3 | TimeTree API 調査 | 不要 | 半自動方式（CSV エクスポート）なら API 不使用、TimeTree 公式エクスポート機能で十分 |
| 4 | import 範囲 | 関電業務委託 + 直近 2 年 | Storage 容量制限（recent + monthly 2 bucket）、業務上必要な参照頻度の高い期間 |
| 5 | カテゴリ自動判定 | 手動 | TimeTree タグの命名揺れがあり機械判定は誤分類リスク高、CSV 編集で人手整備が確実 |
| 6 | 並行運用期間 | 1 ヶ月 | β版運用（3-5 名）と重複させ、移行漏れを現場で検出、問題なしで TimeTree 撤退判断 |

---

## 2. データ変換（TimeTree → Garden）

### 2.1 TimeTree エクスポート CSV 仕様（想定）

TimeTree 公式エクスポート機能で取得できる CSV 列（要実機確認、初版仮定）:

| 列名 | 型 | 用途 |
|---|---|---|
| `event_id` | string | TimeTree 内部 ID |
| `start_at` | datetime | 予定日時 → 撮影日として利用 |
| `title` | string | 案件名（K-YYYYMMDD-NNN を含む想定）|
| `description` | text | 備考（撮影内容のメモ）|
| `attachments` | string[] | 添付画像 URL 群（カンマ区切り or JSON） |
| `tags` | string[] | TimeTree タグ（電灯/動力/ガス/諸元/受領書 等）|
| `created_by` | string | 撮影者（TimeTree ユーザー名）|

### 2.2 Garden 添付テーブルへのマッピング

| TimeTree CSV 列 | Garden `leaf_kanden_attachments` 列 | 変換ルール |
|---|---|---|
| `start_at` | `created_at` | TimeTree 予定日時を撮影日として利用 |
| `title` | `case_id`（FK） | 正規表現 `K-\d{8}-\d{3}` で `case_id` 抽出、紐付かない場合は移行スキップ + 別途レポート |
| `description` | （新規列）`migration_note` | 移行データであることを明示するために新規列を追加（v3.2 既存スキーマに ALTER）|
| `attachments` 各 URL | 1 行ずつ作成 → `storage_url` / `thumbnail_url` | 画像を ダウンロード → 圧縮（1500px JPEG85% + 300px サムネ）→ Storage PUT |
| `tags`（手動編集後）| `category` | CSV 編集段階で `denki` / `douryoku` / `gas` / `shogen` / `juryo` のいずれかに正規化 |
| `created_by` | `created_by`（FK to root_employees）| TimeTree ユーザー名 → 社員番号 mapping テーブル参照（移行用一時テーブル）|

### 2.3 新規 column

A-1c v3.2 既存スキーマに以下を ALTER で追加:

```sql
-- Phase B-2 移行用列追加（migration `scripts/leaf-schema-patch-b2-timetree-migration.sql`）
ALTER TABLE leaf_kanden_attachments
  ADD COLUMN IF NOT EXISTS migration_source text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS migration_note text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS migration_event_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_leaf_attachments_migration_source
  ON leaf_kanden_attachments (migration_source) WHERE migration_source IS NOT NULL;

COMMENT ON COLUMN leaf_kanden_attachments.migration_source IS
  '移行元（''timetree'' 等）。NULL は Garden 直接アップロード分';
COMMENT ON COLUMN leaf_kanden_attachments.migration_note IS
  '移行時の備考（TimeTree description 等）';
COMMENT ON COLUMN leaf_kanden_attachments.migration_event_id IS
  '移行元の元 ID（TimeTree event_id 等、重複検出用）';
```

### 2.4 重複排除

`migration_source = 'timetree'` AND `migration_event_id = X` の組合せで UNIQUE。同じ TimeTree event を 2 回アップロードしようとした場合は skip + レポート。

---

## 3. アーキテクチャ

### 3.1 半自動方式の処理フロー

```
[管理者作業（東海林さん）]
   1. TimeTree 公式エクスポートで CSV 取得（手動）
   2. CSV 編集 (Excel)
      - title 列から case_id を確認、不一致は手動修正
      - tags 列を category 値に正規化（denki / douryoku / gas / shogen / juryo）
      - 不要行（移行対象外）を削除
      - 移行用一時表「TimeTree ユーザー名 → 社員番号」を別シートに整備
   3. 添付画像を一括 DL（TimeTree から / 別途）→ ローカルフォルダに格納
   4. Garden Backoffice の「TimeTree 一括移行」画面（新規 UI）にアクセス
   5. CSV ファイル + 画像フォルダを drag&drop
   6. プレビュー画面で件数 / マッピング結果確認
   7. [移行実行] クリック
      → バックグラウンドで 1 件ずつ:
         a. 画像 DL（ローカルフォルダから読込、または事前 PUT 済 Storage から fetch）
         b. 圧縮（1500px + 300px サムネ）
         c. Storage PUT（recent / monthly bucket）
         d. leaf_kanden_attachments INSERT
         e. 進捗表示
   8. 完了レポート表示（成功 / 失敗 / skip 件数 + エラーログ DL）
```

### 3.2 UI コンポーネント

```
src/app/leaf/admin/timetree-migration/
├─ page.tsx                          # admin+ 限定の移行画面
└─ _components/
   ├─ CsvUploader.tsx                # CSV ファイル選択 + パース
   ├─ ImageFolderPicker.tsx          # 画像フォルダ選択（File API directory）
   ├─ MigrationPreview.tsx           # マッピング結果のプレビューテーブル
   ├─ MigrationProgress.tsx          # 進捗バー + ライブログ
   ├─ MigrationReport.tsx            # 完了レポート + エラーログ DL
   └─ __tests__/
      └─ ...
```

### 3.3 ロジック層

```
src/app/leaf/_lib/timetree-migration/
├─ csv-parser.ts                     # CSV パース + 列マッピング検証
├─ image-loader.ts                   # ローカル画像 DL + 圧縮 + Storage PUT
├─ migration-runner.ts               # バックグラウンド実行 + 進捗イベント発行
├─ migration-report.ts               # レポート生成 + CSV エクスポート
└─ __tests__/
   └─ ...
```

### 3.4 権限設計

| 操作 | 権限 |
|---|---|
| 移行画面アクセス | **admin / super_admin のみ**（manager 以下は不可、誤実行リスク回避）|
| 移行実行 | **admin / super_admin のみ** |
| 移行レポート閲覧 | **admin / super_admin のみ** |
| 移行履歴削除 | **super_admin のみ**（誤実行時のロールバック用）|

---

## 4. 実装ステップ

### Phase B-2 D 共通基盤拡張（0.3d）

1. ALTER TABLE migration（§2.3）→ `scripts/leaf-schema-patch-b2-timetree-migration.sql`
2. 既存 `attachments.ts` に `bulkInsertAttachments` 関数追加（複数画像を 1 トランザクションで INSERT）
3. 既存 `kanden-storage-paths.ts` に `migrationPath()` 関数追加（移行データ専用 path 命名）

### Phase B-2 ロジック層（1.0d）

4. `csv-parser.ts` 実装 + Vitest（PapaParse 採用想定、新規 npm 要承認）
5. `image-loader.ts` 実装 + Vitest（既存 `image-compression.ts` 再利用）
6. `migration-runner.ts` 実装 + Vitest（並列数 3、リトライ 3 回）
7. `migration-report.ts` 実装 + Vitest

### Phase B-2 UI 層（1.0d）

8. `page.tsx`（admin+ ガード + Tab 構成）
9. `CsvUploader.tsx` + RTL test
10. `ImageFolderPicker.tsx` + RTL test
11. `MigrationPreview.tsx` + RTL test
12. `MigrationProgress.tsx` + RTL test
13. `MigrationReport.tsx` + RTL test

### Phase B-2 統合 + 運用ガイド（0.2d）

14. 統合テスト（Vitest E2E、CSV → 画像 → Storage → DB の一連 flow）
15. 運用ガイド `docs/runbooks/leaf-timetree-migration-runbook.md` 起票
16. β版運用での移行検証（東海林さん 1 名で 50-100 件移行 → 結果確認）

合計: **2.5d**

---

## 5. 移行運用 / 並行運用

### 5.1 並行運用 1 ヶ月の運用ルール

移行完了後 1 ヶ月間、TimeTree と Garden の **両方に新規画像を登録** する：

- **新規撮影**: 営業はまず Garden Input UI（A-1c Phase B Input）で撮影 + アップロード
- **TimeTree 二重登録**: 撮影者が手動で TimeTree にも同じ画像を登録（撤退前の保険）
- **検索**: 主に Garden Backoffice で検索（Garden が信頼できる単一情報源かを検証）
- **問題発生時**: TimeTree から再取得可能な期間として 1 ヶ月確保

### 5.2 並行運用終了判定（1 ヶ月後）

| 判定基準 | 合格条件 |
|---|---|
| Garden 検索の精度 | 過去 30 日間の検索で「TimeTree でしか見つからない」事例 0 件 |
| アップロード成功率 | 過去 30 日間の Garden upload エラー率 < 1% |
| ユーザー満足度 | β版ユーザー 3-5 名から「Garden で十分」の合意 |
| 容量逼迫 | recent bucket 使用率 < 80% |

すべて合格 → TimeTree 撤退（業務 SOP 改訂、新規撮影は Garden のみ）。
1 つでも不合格 → 並行運用を 2 週間延長 + 原因調査。

### 5.3 移行失敗時のロールバック

- 移行レポートで失敗した行は `migration_event_id` で特定可能
- super_admin のみ「移行履歴削除」UI で `migration_source = 'timetree'` 行を bulk delete 可能（v3 共通の論理削除 + 復元パターンを踏襲）
- 物理削除は Storage の orphan cleanup（A-1c v3 Phase B 未実装）に委ねる

---

## 6. テスト戦略

### 6.1 ユニットテスト（Vitest、カバレッジ目標）

| ファイル | カバレッジ目標 |
|---|---|
| `csv-parser.ts` | 90%+ |
| `image-loader.ts` | 80%+ |
| `migration-runner.ts` | 75%+ |
| `migration-report.ts` | 85%+ |

### 6.2 RTL + MSW（UI 検証）

- `CsvUploader.tsx`: 正常 CSV / 不正 CSV / 列不足 / マッピング失敗
- `MigrationPreview.tsx`: 件数表示 / case_id 不一致行のハイライト / カテゴリ正規化結果
- `MigrationProgress.tsx`: 進捗イベント受信 / エラー表示 / 中断ボタン
- `MigrationReport.tsx`: 成功 / 失敗 / skip 件数表示 / CSV DL

### 6.3 統合テスト

- 50 件の test CSV + dummy 画像 50 枚で migration-runner 実行
- Storage PUT が 50 件成功、DB INSERT が 50 件成功
- 進捗イベントが 50 回発行される

### 6.4 手動 RLS 検証

- admin が移行画面アクセス可能、移行実行可能
- manager が移行画面アクセス不可（403）
- staff / outsource も 403
- 移行された行が `migration_source = 'timetree'` で識別可能

---

## 7. 関連 spec との整合

| spec | 関係 |
|---|---|
| A-1c v3.2（添付ファイル機能、PR #130）| 本 spec の前提。Backoffice UI 完成後に着手 |
| A-1c 将来拡張 設計指針（PR #131）| 事業スコープ設計の参照（business_id = 'kanden'）|
| Phase A Backoffice UI 着手前 準備ガイド（PR #132）| Phase A 完成判定後に Phase B-2 着手 |
| 横断 履歴 UI（Batch 14）| 移行行も history trigger で自動記録される |
| OCR spec（# 4 起草予定）| 移行データを OCR の入力として活用、移行後に OCR Phase 着手 |

---

## 8. 残課題 / 次フェーズ検討事項

- TimeTree 公式エクスポート CSV の **実列名 / 形式 確認**（実機で 1 件試行 → §2.1 確定）
- TimeTree 添付画像の **DL 方法**（CSV 内 URL 経由 or 別エクスポート機能 or 手動 DL）
- 移行用一時表「TimeTree ユーザー名 → 社員番号」の **整備方法**（Garden Root 側で User mapping UI 起票検討）
- 全期間（2 年超）移行の **再検討タイミング**（Phase C 以降、容量逼迫時）
- 他商材（光回線等）の TimeTree 移行 **横展開** 可否（事業ごとに利用形態が異なる場合は個別 spec）

---

## 9. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-07 | v1.0 | 初版起草、a-main-013 main- No. 86 全前倒し dispatch # 3 対応、6 論点全 OK 採用版（main- No. 93）| a-leaf-002 |

---

— end of spec —
