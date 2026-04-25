# 【a-auto セッションからの周知】Batch 2 全体サマリ + PR 化依頼

- 発信日時: 2026-04-24 12:58 発動 / 約 14:28 配布
- 対象セッション: **a-main**
- 発動シーン: 集中別作業中（約90分、batch2 6 件計画通り完走）

---

## ■ 完了した作業（6 spec、合計 2,106 行）

Forest v9 vs TSX 対比（P07）で細分化された実装タスクから、**a-forest が即着手できる個別実装指示書 6 件**を生成。各 spec に 12 必須項目（Scope / 前提 / ファイル構成 / 型定義 / 実装 Step / データソース / UI / エラー / 権限 / テスト / 関連参照 / 判断保留）を完備。

| # | ファイル | 行数 | 想定 |
|---|---|---|---|
| T-F2-01 | ForestShell 最終更新日 | 234 | 0.25d |
| T-F7-01 | InfoTooltip 共通 | 263 | 0.25d |
| T-F10-03 | HANKANHI DetailModal | 290 | 0.5d |
| T-F11-01 | TaxDetailModal | 409 | 0.5d |
| T-F4-02 | TaxCalendar ローリング12ヶ月 | 471 | 1.0d |
| T-F6-03 | /api/forest/download-zip Edge | 439 | 1.5d |

**実装合計 4.0d 分**を a-forest にバトン渡し完了。

---

## ■ PR 化依頼

**ブランチ**: [`feature/phase-a-prep-batch2-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch2-20260424-auto) → **develop**

- **Batch 1 と同じフロー**で develop 向け PR を作成いただけるとありがたいです（Batch 2 は develop 派生なので cherry-pick 不要）
- フィードバックいただいた「派生元ルール」通り develop から派生したため、**このままマージ可能**です

### 周知配布（東海林さん運用）
- [`to-a-forest.md`](docs/broadcast-202604241258/to-a-forest.md) を a-forest セッションへコピペ配布
- 本ファイル（to-a-main.md）は参考情報

---

## ■ 注目ポイント

### 1. 派生元ルール遵守
Batch 1 で指摘された派生元ルール（docs 系 / develop マージ想定は develop 派生）を適用。最初 uncommitted changes で `git checkout develop` が abort したが、`git stash -u` → 古いブランチ rename で回避し、クリーンに develop 派生を実現。約 4 分のロスに留めました。

### 2. 判断保留 29 件は a-forest に委譲
合計 29 件の判断保留は各 spec 末尾 §12 に集約。a-forest + 東海林さんで合意してから実装着手する前提。**特に重要なのは**:
- **T-F6-03 判1**: Edge vs Node ランタイム → a-auto は **Node 固定**を推奨（JSZip 互換性・日本語ファイル名・Buffer 依存）
- **T-F6-03 判4**: PDF Drive → Storage ミラーバッチは別 spec、本 T-F6-03 着手前に完了必須
- **T-F10-03 判5**: `CellData.reflected` フィールドの所在 → MicroGrid.tsx で値渡しているか要確認

### 3. 事前準備が必要な項目
実装着手前に以下を完了する必要があります（a-main / a-forest 協調）:
- [ ] P08 migration（`forest_hankanhi`）投入 → T-F10-03 着手可
- [ ] P09 migration（`forest_nouzei_*`）投入 → T-F11-01 / T-F4-02 着手可
- [ ] `jszip` npm 導入の**東海林さん事前承認** → T-F6-03 着手可
- [ ] Storage bucket `forest-docs` + `forest-downloads` 作成 → T-F6-03 着手可
- [ ] PDF Drive → Storage ミラーバッチ完了 → T-F6-03 実装可

---

## ■ 次 Batch 候補（a-main での判断材料）

Batch 2 完了を受け、M1 Phase A の残 auto タスクとして以下が候補（ロードマップ §3 並列化タスクリスト参照）:

| # | タスク | 見込 | 備考 |
|---|---|---|---|
| T-F5-01〜04 | Tax Files 閲覧 UI + Storage bucket | 1.85d | P3 Tax Files |
| T-F3-01 | SummaryCards 注記文言整合 | 0.1d | 実装実読で差分抽出 |
| T-F9-01 | MicroGrid 細部差分調査 | 0.75d | auto 可、scroll-sync 等 |
| T-F8-01 | MacroChart 細部整合 | 0.1d | auto 可 |
| Bud A-03 | 振込 6 段階遷移仕様書 | 0.5d | auto 可 |
| Bud A-04 | 振込新規作成フォーム設計 | 0.5d | auto 可（UI 仕様書）|
| Root R1 | `root_kot_sync_log` 投入 SQL | 0.25d | P12 準拠 |

Batch 3 として 6 件束ねる場合の候補: T-F5（P3）関連 + Bud A-03 + T-F9-01 + T-F3-01 + T-F8-01 あたりが「低リスク・設計のみ」で 90 分に収まる粒度。

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/app/` 未改変、docs のみ）
- ✅ main / develop 直接作業なし
- ✅ **develop 派生**（派生元ルール遵守）
- ✅ 90 分枠内で 6 件計画通り完走
- ✅ `[a-auto]` タグを commit メッセージに付与
- ✅ 判断保留は各ファイル末尾に集約
- ✅ Batch 1 フォーマット踏襲（粒度維持）

---

## ■ 参考

- **作業ブランチ**: [`feature/phase-a-prep-batch2-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch2-20260424-auto)
- **Batch 1 親仕様**（develop マージ済）:
  - `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md`（P07）
  - `docs/specs/2026-04-24-forest-hankanhi-migration.sql`（P08）
  - `docs/specs/2026-04-24-forest-nouzei-tables-design.md`（P09）
- **Batch 2 周知**: `docs/broadcast-202604241258/to-a-forest.md`（Forest 向け詳細）
