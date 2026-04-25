# 【a-auto セッションからの周知】Batch 4 完成 — **Forest Phase A 全 spec 揃いました**

- 発信日時: 2026-04-24 16:17 発動 / 約 17:45 配布
- 対象セッション: **a-forest**
- 発動シーン: 集中別作業中（約 90 分、batch4 4 件完走）

---

## 🎉 Forest Phase A 完全制覇

**Batch 2 + 3 + 4 = 合計 12 spec + 9 実装ファイル、約 8.7d の実装指示書**が揃いました。移植計画フル見積 9.25-10.25d の **85-94%** に到達。**a-forest は Phase A を自律実行可能な状態**です。

---

## ■ Batch 4 完了作業（4 spec、合計 1,420 行）

| # | ファイル | 行数 | 想定 | 性質 |
|---|---|---|---|---|
| T-F9-01 | [microgrid-diff-audit.md](docs/specs/2026-04-24-forest-t-f9-01-microgrid-diff-audit.md) | 464 | 0.75d | **差分調査 + 修正指示**（10 点チェックリスト）|
| T-F10-02 | [fetch-hankanhi.md](docs/specs/2026-04-24-forest-t-f10-02-fetch-hankanhi.md) | 333 | 0.25d | データ取得関数 + ユニットテスト |
| T-F3-F8 | [summary-macro-polish.md](docs/specs/2026-04-24-forest-t-f3-f8-summary-macro-polish.md) | 253 | 0.2d | 既存実装の細部差分補正 |
| T-F-ui-link | [ui-linkage.md](docs/specs/2026-04-24-forest-t-ui-linkage.md) | 370 | 0.5d | **5 サブタスク統合**（dashboard 接続）|

---

## ■ Forest Phase A 全 spec 一覧（Batch 2 + 3 + 4）

### 📁 設計・基盤（Batch 1、develop マージ済）
- `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md`（P07）
- `docs/specs/2026-04-24-forest-hankanhi-migration.sql`（P08）
- `docs/specs/2026-04-24-forest-nouzei-tables-design.md`（P09）

### 🏗️ インフラ（Batch 3）
- T-F6-01 Storage buckets — 0.25d
- T-F5-01 Tax Files インフラ — 0.5d
- T-F6-02 Drive → Storage 移行 — 0.5d

### 🎨 UI 実装（Batch 2 + 3）
- T-F2-01 最終更新日（Batch 2）— 0.25d
- T-F7-01 InfoTooltip（Batch 2）— 0.25d
- T-F10-03 DetailModal HANKANHI（Batch 2）— 0.5d
- T-F11-01 TaxDetailModal（Batch 2）— 0.5d
- T-F4-02 TaxCalendar（Batch 2）— 1.0d
- T-F6-03 Download ZIP API（Batch 2）— 1.5d
- T-F5-02 TaxFilesList UI（Batch 3）— 0.75d
- T-F5-03 Tax Files Upload UI（Batch 3）— 0.5d
- T-F6-04 Download Section UI（Batch 3）— 0.5d

### 🔧 仕上げ・接続（Batch 4）
- T-F10-02 fetchHankanhi（Batch 4）— 0.25d
- T-F3-F8 polish（Batch 4）— 0.2d
- T-F9-01 MicroGrid 差分調査（Batch 4）— 0.75d（採用次第で圧縮可）
- T-F-ui-link UI 連携統合（Batch 4）— 0.5d

**総計: 12 spec + 9 実装タスク = 約 8.7d**

---

## ■ あなた（a-forest）が実施すること

### 1. Batch 2/3/4 spec 全件の精読（2 時間程度）
```bash
git fetch origin feature/phase-a-prep-batch4-20260424-auto
```

### 2. T-F-ui-link §13 の 3 Week 実装順序に従って着手

#### Week 1（インフラ整備、約 2.0d）
1. **T-F6-01** Storage buckets — Dashboard GUI 操作 + migration 5 本
2. **T-F5-01** Tax Files インフラ — テーブル + bucket + RLS
3. **T-F6-02** Drive → Storage 移行 — Node.js バッチ、dev → prod
4. **T-F10-02** fetchHankanhi — queries.ts 関数追加 + テスト
5. **T-F2-01** 最終更新日 — ForestShell 改修
6. **T-F7-01** InfoTooltip — 共通コンポーネント

#### Week 2（主機能実装、約 3.25d）
7. **T-F10-03** DetailModal HANKANHI
8. **T-F11-01** TaxDetailModal
9. **T-F4-02** TaxCalendar（最大ボリューム 1.0d）
10. **T-F5-02** TaxFilesList UI
11. **T-F5-03** Tax Files Upload UI

#### Week 3（接続 + 仕上げ、約 3.45d）
12. **T-F6-03** Download ZIP API
13. **T-F6-04** Download Section UI
14. **T-F-ui-link** UI 連携統合
15. **T-F3-F8** polish
16. **T-F9-01** MicroGrid 差分補正

### 3. 事前準備チェックリスト（Week 1 着手前）

#### Supabase Dashboard（東海林さん協力）
- [ ] bucket 作成: `forest-docs`（50MB、PDF のみ）
- [ ] bucket 作成: `forest-downloads`（200MB、無制限 MIME）
- [ ] bucket 作成: `forest-tax`（50MB、PDF/xlsx/csv/jpg/png）
- [ ] 3 bucket すべて **Public: OFF** 確認

#### SQL migration 投入
- [ ] P08 `forest_hankanhi`（既存）
- [ ] P09 `forest_nouzei_*`（既存）
- [ ] Batch 3 `20260424_01_forest_storage_buckets.sql`
- [ ] Batch 3 `20260424_02_forest_tax_files.sql`
- [ ] Batch 3 `20260424_03_forest_tax_storage.sql`
- [ ] Batch 3 `20260424_04_fiscal_periods_storage_path.sql`

#### npm パッケージ事前承認（東海林さん）
- [ ] `jszip`（T-F6-03 / T-F6-04 で必要）
- [ ] Vitest（T-F10-02 ユニットテスト用、既に Bud で導入済なら流用）

#### データ移送バッチ（T-F6-02、dev → prod）
- [ ] `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` 確認
- [ ] `node scripts/migrate-forest-pdfs.mjs --dry-run` dev 環境
- [ ] `node scripts/migrate-forest-pdfs.mjs` dev 本実行
- [ ] 検証成功後、prod で実行

### 4. 判断保留事項（Batch 4 のみ、合計 24 件）
- **T-F9-01**（10 件）: D1-D10 差分採否 — **auto 推奨は必須 4 件**（D2/D4/D8/D10）
- **T-F10-02**（4 件）: Batch 実装 / source フィルタ / キャッシュ / テスト環境
- **T-F3-F8**（5 件）: sub 文言方針 / タイトル変更 / 高さ / a11y / 他セクション波及
- **T-F-ui-link**（6 件）: modal stack / URL 同期 / 順序 / 位置 / page.tsx 肥大化 / reflected 色

**Batch 2 + 3 の判断保留 63 件**と合わせて**合計 87 件**。着手前に東海林さんと優先度 🔴 のものから順次合意していく流れを推奨。

### 5. effort-tracking.md への先行記入（§12）
全 16 タスクを予定時間付きで追記。着手順に actual 値も追記。

---

## ■ 特筆すべき設計判断

### T-F9-01 MicroGrid 差分 10 件のハイライト

**auto 推奨の必須 4 件**（0.5d 分）:
- **D2 sticky col-company**: 年度が増えると法人名が見えなくなる（v9 の UX の核）
- **D4 進行期 glow animation**: 進行期セルを視覚的に目立たせる（v9 デザインの核）
- **D8 初期スクロール最右端**: 最新年度を最初に見せる（現状は最古年度から見える）
- **D10 zantei 専用スタイル**: 進行期でも「確定前」と「暫定」を区別（業務的に重要）

**スタンス表**: 採用推奨 ✅3 / 採用推奨 🔴1 / 判断保留 🟡3 / 不要 🟢3 / 差分なし 1

### T-F10-02 v9 比改善点
- **入力検証**（`companyId` 空 / `ki` 非整数 / 0 以下）を追加 — v9 には無い堅牢性
- **Vitest mock 雛形 7 ケース**で初期 QA コスト削減

### T-F3-F8 "改善版" 認定
TSX 現行の動的カウント実装（`${countWithData}社合算`）は v9 の固定文言（`'壱を除く5社'`）より改善されており、**現状維持を推奨**。MacroChart のタイトルだけ v9 の「〜 森の視界 〜」表現に戻すことを推奨。

### T-F-ui-link 5 サブタスクの相互依存
- **ST-F4-03 + ST-F11-02** が最も密結合（TaxCalendar pill クリック → TaxDetailModal 起動）
- **ST-F4-04 + ST-F6-05** はセクション追加のみ、単純
- **ST-F10-04** は main の MicroGrid L183 で既に `reflected` を渡しているため、DetailModal 側の表示追加のみ（T-F10-03 §Step 4 で指示済）

---

## ■ 本ブランチの扱い

- **推奨**: PR 化して develop マージ
- **マージ順序**: Batch 2 → Batch 3 → Batch 4（本ブランチ）
  - Batch 3 の T-F6-04 は Batch 2 の T-F6-03 に依存
  - Batch 4 は全バッチに依存するが、新規ファイルのみなので**conflict なし想定**
- **並行 PR 作成可**: 本ブランチは develop 派生で独立しているため、Batch 2/3 のマージを待たずに PR 作成可

---

## ■ 参考

- **作業ブランチ**: [`feature/phase-a-prep-batch4-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch4-20260424-auto)
- **Batch 1 成果物**（develop マージ済、PR #12）: P07 / P08 / P09
- **Batch 2 成果物**（PR 化予定）: T-F2-01 / T-F7-01 / T-F10-03 / T-F11-01 / T-F4-02 / T-F6-03
- **Batch 3 成果物**（PR 化予定）: T-F6-01 / T-F5-01 / T-F6-02 / T-F5-02 / T-F5-03 / T-F6-04
- **Batch 4 成果物**（本 push）: T-F9-01 / T-F10-02 / T-F3-F8 / T-F-ui-link
- **共通ドキュメント**: `docs/known-pitfalls.md`（§4.3 Storage 署名 URL / §6.1 Service Role Key 境界）
