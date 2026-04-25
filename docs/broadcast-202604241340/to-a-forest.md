# 【a-auto セッションからの周知】Batch 3 完成 — Forest F5/F6 実装 6 spec 着手可能

- 発信日時: 2026-04-24 13:40 発動 / 約 15:10 配布
- 対象セッション: **a-forest**
- 発動シーン: 集中別作業中（約90分、batch3 6 件）

---

## ■ 完了した作業（6 spec、合計 2,373 行）

Forest Phase A 完全移植に必要な F5 Tax Files + F6 Download 系タスクの実装指示書 6 件を生成。Batch 2（4.0d）と合わせて**計 7.0d の実装分**を a-forest にバトン渡し完了。

| # | ファイル | 行数 | 想定 | 依存関係 |
|---|---|---|---|---|
| T-F6-01 | [storage-buckets.md](docs/specs/2026-04-24-forest-t-f6-01-storage-buckets.md) | 279 | 0.25d | — |
| T-F5-01 | [tax-files-infrastructure.md](docs/specs/2026-04-24-forest-t-f5-01-tax-files-infrastructure.md) | 319 | 0.5d | — |
| T-F6-02 | [drive-to-storage-migration.md](docs/specs/2026-04-24-forest-t-f6-02-drive-to-storage-migration.md) | 373 | 0.5d | T-F6-01 |
| T-F5-02 | [tax-files-list-ui.md](docs/specs/2026-04-24-forest-t-f5-02-tax-files-list-ui.md) | 429 | 0.75d | T-F5-01 |
| T-F6-04 | [download-section-ui.md](docs/specs/2026-04-24-forest-t-f6-04-download-section-ui.md) | 456 | 0.5d | T-F6-03 (Batch 2), T-F7-01 (Batch 2) |
| T-F5-03 | [tax-files-upload-ui.md](docs/specs/2026-04-24-forest-t-f5-03-tax-files-upload-ui.md) | 517 | 0.5d | T-F5-02 |

---

## ■ あなた（a-forest）が実施すること

### 1. 事前準備チェックリスト（実装着手前）

#### Supabase Dashboard 操作（東海林さん協力が必要）
- [ ] bucket 作成: `forest-docs`（50MB、PDF のみ）
- [ ] bucket 作成: `forest-downloads`（200MB、無制限 MIME）
- [ ] bucket 作成: `forest-tax`（50MB、PDF/xlsx/csv/jpg/png）
- [ ] 3 bucket すべて **Public: OFF** 確認

#### SQL migration 投入（順次実行）
- [ ] Batch 2 `20260424_01_create_download_buckets.sql`（T-F6-03 Step 2）
- [ ] Batch 3 `20260424_01_forest_storage_buckets.sql`（T-F6-01）— **Batch 2 と 1 本化可**
- [ ] Batch 3 `20260424_02_forest_tax_files.sql`（T-F5-01）
- [ ] Batch 3 `20260424_03_forest_tax_storage.sql`（T-F5-01）
- [ ] Batch 3 `20260424_04_fiscal_periods_storage_path.sql`（T-F6-02）

#### npm パッケージ承認（東海林さん事前承認）
- [ ] `jszip` — T-F6-03 / T-F6-04 で必要（親 CLAUDE.md「npm 追加は事前相談」準拠）

#### データ移送バッチ（T-F6-02、dev 環境で先行実行）
- [ ] `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` 設定確認
- [ ] `node scripts/migrate-forest-pdfs.mjs --dry-run` で事前検証
- [ ] `node scripts/migrate-forest-pdfs.mjs` で本実行（dev → prod）
- [ ] JSON log で failed 件数が 0 であることを確認

### 2. 推奨実装順序

**Week 1（インフラ整備、1.25d）**:
1. T-F6-01 Storage buckets（0.25d）— Dashboard 操作 + migration
2. T-F5-01 Tax Files Infra（0.5d）— テーブル + bucket + RLS
3. T-F6-02 Drive→Storage migration（0.5d）— PDF 移送、本番投入

**Week 2（UI 実装、1.75d）+ Batch 2 接続**:
4. T-F5-02 TaxFilesList（0.75d）
5. T-F5-03 Upload UI（0.5d、admin 向け）
6. T-F6-04 Download Section UI（0.5d）— T-F6-03 API 呼出
7. **Batch 2 のタスク**（T-F2-01 / T-F7-01 / T-F10-03 / T-F11-01 / T-F4-02 / T-F6-03）と並行実施可

### 3. 判断保留事項の合意（合計 34 件）

| Spec | 件数 | 主要論点 |
|---|---|---|
| T-F6-01 | 5 | ファイルサイズ上限 / Cron 掃除時期 / 版管理 / Dashboard vs SQL / バックアップ |
| T-F5-01 | 5 | 論理削除 / archived 状態 / tags / uploaded_by NULL / 版管理 |
| T-F6-02 | 6 | Node vs Python / Drive API vs 公開 URL / doc_url 残置 / 大容量対応 / 本番時期 / 日本語ファイル名 |
| T-F5-02 | 6 | collapsed デフォルト / 件数制限 / 検索 UI / signedURL 期限 / 順序 / 法人色ドット |
| T-F5-03 | 6 | 孤立 Storage 掃除 / 複数同時 / ZIP 展開 / upsert リトライ / 基準日必須化 / 確定化の再編集 |
| T-F6-04 | 6 | 進捗粒度 / 連続押下抑止 / 完了後 state 保持 / 履歴可視化 / モバイル / animation 実装 |

東海林さんと合意してから着手推奨。

### 4. Batch 2 と Batch 3 の接続ポイント

| Batch 3 spec | 接続先（Batch 2）|
|---|---|
| T-F6-04 | **T-F6-03** `POST /api/forest/download-zip` API |
| T-F6-04 | **T-F7-01** `InfoTooltip` 使い方説明 |
| T-F5-03 | **T-F7-01**（将来、任意 Tooltip で注釈追加可）|

T-F6-04 実装時は Batch 2 の T-F6-03 / T-F7-01 の完了が前提。並行実装する場合は dev 環境で単独テスト可能（API モック）。

### 5. effort-tracking.md への先行記入
Batch 2 と同様、各 T タスクを予定時間付きで追記（§12 準拠）。

### 6. 本ブランチの扱い
- **推奨**: PR 化して develop マージ（Batch 2 と同じフロー、派生元ルール遵守で conflict なし想定）
- develop マージ後、各 T タスクは個別ブランチ（例: `feature/forest-t-f6-01-storage-buckets`）で実装

---

## ■ 特筆すべき設計判断

### T-F6-02 PDF 移送方式
**Node.js + Drive 公開 URL fetch を採用**（Drive API Service Account ではなく）。理由:
- T-F6-03 / T-F6-04 との技術統一
- 既存 PDF は全て「リンクを知っている全員が閲覧可」で公開済
- Service Account 追加の認証管理コストを回避

### T-F5-03 アトミック性
Storage upload + DB INSERT が**単一の mutation 関数**で処理され、DB 失敗時は Storage を `.remove()` でロールバック。孤立オブジェクトは Phase A 末の掃除バッチで回収。

### T-F5-02 アコーディオンデフォルト
データありなら `open`、なしなら `collapsed`（v9 準拠）。全法人一覧性と視覚的ノイズのバランス。

### T-F6-04 進捗表示
**ポーリングではなく CSS animation + 経過秒**で表現。API 側の進捗通知が不要で、シンプルな UX を優先。

---

## ■ 参考

- **作業ブランチ**: [`feature/phase-a-prep-batch3-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch3-20260424-auto)
- **Batch 1 成果物（develop マージ済、前提）**:
  - `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md`（P07）
  - `docs/specs/2026-04-24-forest-hankanhi-migration.sql`（P08）
  - `docs/specs/2026-04-24-forest-nouzei-tables-design.md`（P09）
- **Batch 2 成果物（`feature/phase-a-prep-batch2-20260424-auto`、PR 化予定）**:
  - T-F2-01 / T-F7-01 / T-F10-03 / T-F11-01 / T-F4-02 / T-F6-03
- **known-pitfalls.md**: §4.3（Supabase Storage 署名 URL）/ §6.1（Service Role Key 境界）
