# 【a-auto セッションからの周知】Batch 2 完成 — Forest 実装 6 spec 着手可能

- 発信日時: 2026-04-24 12:58 発動 / 約 14:28 配布
- 対象セッション: **a-forest**
- 発動シーン: 集中別作業中（約90分、batch2 6 件）

---

## ■ 完了した作業（6 spec、合計 2,106 行）

| # | ファイル | 行数 | 想定工数 |
|---|---|---|---|
| T-F2-01 | [docs/specs/2026-04-24-forest-t-f2-01-last-updated.md](docs/specs/2026-04-24-forest-t-f2-01-last-updated.md) | 234 | 0.25d |
| T-F7-01 | [docs/specs/2026-04-24-forest-t-f7-01-info-tooltip.md](docs/specs/2026-04-24-forest-t-f7-01-info-tooltip.md) | 263 | 0.25d |
| T-F10-03 | [docs/specs/2026-04-24-forest-t-f10-03-hankanhi-detail-modal.md](docs/specs/2026-04-24-forest-t-f10-03-hankanhi-detail-modal.md) | 290 | 0.5d |
| T-F11-01 | [docs/specs/2026-04-24-forest-t-f11-01-tax-detail-modal.md](docs/specs/2026-04-24-forest-t-f11-01-tax-detail-modal.md) | 409 | 0.5d |
| T-F4-02 | [docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md](docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md) | 471 | 1.0d |
| T-F6-03 | [docs/specs/2026-04-24-forest-t-f6-03-download-zip-edge.md](docs/specs/2026-04-24-forest-t-f6-03-download-zip-edge.md) | 439 | 1.5d |

**合計工数**: 約 **4.0d**（P07 §6 の推奨順序 ≤ Step 5 「F7 Info Tooltip」までの累積と一致）

---

## ■ あなた（a-forest）が実施すること

### 1. 設計書の精読（60-90 分）
```bash
git fetch origin feature/phase-a-prep-batch2-20260424-auto
```
6 ファイルに 12 必須項目（Scope / 前提 / ファイル構成 / 型 / 実装 Step / データソース / UI / エラー / 権限 / テスト / 関連参照 / 判断保留）が揃っている。**そのまま実装着手可能**。

### 2. 推奨実装順序（P07 §6 準拠）
1. **T-F2-01 最終更新日**（0.25d、小型、他と独立）
2. **T-F7-01 InfoTooltip**（0.25d、T-F6-03 の前提）
3. **T-F10-03 HANKANHI Detail**（0.5d、P08 migration 投入後、低リスク・高インパクト）
4. **T-F11-01 TaxDetailModal**（0.5d、T-F4-02 の子）
5. **T-F4-02 TaxCalendar**（1.0d、**P09 migration 投入 + T-F11-01 完成後**）
6. **T-F6-03 Download ZIP Edge**（1.5d、`jszip` 導入 + Storage bucket 作成後）

### 3. 判断保留事項の合意（合計 29 件）
| Spec | 件数 | 主要論点 |
|---|---|---|
| T-F2-01 | 4 | JP 固定 / source 含有 / 他テーブル合算 / `updated_at` トリガ整備 |
| T-F7-01 | 4 | Popper.js 導入 / クリック固定 / モバイル挙動 / 他モジュール昇格 |
| T-F10-03 | 5 | スケルトン表示 / Context キャッシュ / 科目拡張 / reflected note / CellData.reflected 所在 |
| T-F11-01 | 5 | 納付済ボタン / ファイル削除 UI / ポーリング / FocusTrap / 合計不整合 |
| T-F4-02 | 5 | 範囲 props 化 / drag-drop / 過去年表示 / モバイル縦並び / Tailwind theme 抽出 |
| T-F6-03 | 6 | **Edge vs Node**（a-auto は Node 固定推奨）/ 有効期限 / Cron 掃除 / PDF 移行バッチ / ストリーミング / 履歴ログ |

### 4. 事前準備（実装前の確認事項）
- [ ] **T-F10-03**: P08 migration の投入完了確認（`forest_hankanhi` テーブル存在 + サンプルデータ）
- [ ] **T-F11-01 / T-F4-02**: P09 migration の投入完了確認（`forest_nouzei_schedules / _items / _files`）
- [ ] **T-F6-03**: `jszip` npm パッケージ導入について**東海林さんの事前承認**（親 CLAUDE.md「npm 追加は事前相談」準拠）
- [ ] **T-F6-03**: Storage bucket 2 つ（`forest-docs`, `forest-downloads`）作成 migration の投入
- [ ] **T-F6-03**: PDF 本体の Drive → Storage ミラーバッチ（**別 spec**、本 T-F6-03 着手前に完了）

### 5. effort-tracking.md への先行記入
各 T タスクを予定時間付きで `docs/effort-tracking.md` に追記（§12）。着手前でも問題なし。

### 6. 本ブランチの扱い
- **推奨**: PR 化して develop マージ（Batch 1 と同じフロー）
- develop マージ後、各 T タスクは `feature/forest-t-XX-XX-description` で派生して実装

---

## ■ 特筆すべき設計判断

### T-F6-03 Edge vs Node
**Node 固定で推奨**（判1）。理由:
- JSZip が Deno/Edge ランタイムで完全互換性なし
- 日本語ファイル名のエンコーディング処理（Buffer 依存）
- 5 分 signedURL で PDF を生成〜DL させる規模なら Node で 30 秒以内に収まる

### T-F10-03 既存スタイル維持
インライン style vs Tailwind 混在を避けるため、DetailModal は**既存インラインスタイル準拠**で販管費セクションを書く方針（ForestShell/TaxCalendar は Tailwind 中心）。

### T-F4-02 TaxPill を分離
TaxPill を独立コンポーネント化することで、将来他モーダル（例: 月次ダイジェスト）でも流用可能。

---

## ■ 参考

- **作業ブランチ**: [`feature/phase-a-prep-batch2-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch2-20260424-auto)
- **Batch 1 成果物**（develop にマージ済）:
  - `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md`（P07）← 本 Batch 2 の親仕様
  - `docs/specs/2026-04-24-forest-hankanhi-migration.sql`（P08）← T-F10-03 の前提
  - `docs/specs/2026-04-24-forest-nouzei-tables-design.md`（P09）← T-F11-01 / T-F4-02 の前提
- **known-pitfalls.md**: 本 spec で参照している項目（§6.1 Service Role Key 境界など）
