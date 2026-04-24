# 【a-auto セッションからの周知】

- 発信日時: 2026-04-24 12:02 発動 / 約 13:30 配布
- 対象セッション: **a-forest**
- 発動シーン: 集中別作業中（約90分、batch1 6 件一括）

---

## ■ 完了した Forest 関連の作業（3 件）

### 1. [docs/specs/2026-04-24-forest-hankanhi-migration.sql](docs/specs/2026-04-24-forest-hankanhi-migration.sql) — 247 行
- 判1 A 案（`forest_hankanhi` 別テーブル）準拠の**完全な migration SQL**
- 内容：テーブル定義 / インデックス / `updated_at` トリガ / RLS 4 本（forest_is_user/admin 前提）/ v9 HANKANHI 定数の実データ投入 / rollback SQL / 検証クエリ / 実装時の注意事項
- **そのまま Supabase で実行可能**（dry-run 推奨）

### 2. [docs/specs/2026-04-24-forest-nouzei-tables-design.md](docs/specs/2026-04-24-forest-nouzei-tables-design.md) — 441 行
- 判2 B 案（3 テーブル分割）準拠の納税カレンダー設計書
- 内容：Mermaid ER 図 / 3 テーブル定義（schedules / items / files）/ 原子性保証関数（`create_nouzei_schedule`, `mark_nouzei_paid`）/ RLS / インデックス戦略 / v9 NOUZEI サンプル投入 / TSX 側の期待クエリパターン
- F4（Tax Calendar）と F11（Tax Detail Modal）を同時実装する前提

### 3. [docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md](docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md) — 296 行
- 判1〜判5 確定後の v9 HTML × TSX 実装 **行対行対応表**
- 11 機能 × 全実装タスク（T-F2-01 〜 T-F11-02）分解
- 各機能に判断カラムを紐付け
- 推奨実装順序（9 段階、合計 9.8d、移植計画フル見積と整合）
- 各機能に §16 7 種テスト観点を紐付け

---

## ■ あなた（a-forest）が実施すること

### 1. 設計書の精読
```bash
git fetch origin feature/phase-a-prep-batch1-20260424-auto
```

### 2. Supabase への migration 投入（推奨順序）
1. **P08 HANKANHI**（低リスク・高インパクト、T-F10 系に直結）
   - dry-run → 本番 UPDATE（4 社分の HANKANHI データ投入）
   - TSX 側: `_lib/queries.ts` に `fetchHankanhi()` 追加 → DetailModal.tsx に販管費セクション追加
2. **P09 Nouzei**（F4 + F11 を同時実装）
   - dry-run → 本番 UPDATE（schedules / items / files の 3 テーブル + サンプルデータ 7 件）
   - TSX 側: `TaxCalendar.tsx` + `TaxDetailModal.tsx` を新規実装

### 3. 判断保留事項の確認（各ファイル末尾）
| ファイル | 判断保留件数 |
|---|---|
| P07（v9 vs TSX）| 3 件（F9 細部 / F5 Phase A 組込 / F6 ランタイム） |
| P08（HANKANHI）| 4 件（source 拡張 / 削除フラグ / 金額単位 / 監査ログ） |
| P09（Nouzei）| 5 件（税目マスタ化 / 月末自動計算 / 実振込突合 / extra 重複 / generated column） |

東海林さんと合意してから実装着手を推奨。

### 4. 推奨実装順序（P07 §6）
1. P08 実装 T-F10-01〜04（0.95d）
2. F2/F3 補完 T-F2-01, T-F3-01（0.35d）
3. P09 実装 T-F4-01〜04, T-F11-01〜02（2.2d）
4. F7 Info Tooltip T-F7-01（0.25d）
5. F5 Tax Files 閲覧 T-F5-01〜04（1.85d）
6. F5 アップロード UI（0.5d）
7. F6 Download T-F6-01〜05（2.85d）
8. F9 差分調査 T-F9-01（0.75d、auto 可）
9. F8 差分確認 T-F8-01（0.1d、auto 可）

**合計**: 約 **9.8d**（移植計画フル見積と一致）

### 5. effort-tracking.md への先行記入
各タスクを予定時間付きで `docs/effort-tracking.md` に追記（§12）。着手前でも問題なし。

### 6. 本ブランチの扱い
- **推奨**: PR 化して main マージ（設計書永続化）
- 代替: develop へマージ → M1 開始時に main 昇格

---

## ■ 判断保留事項（a-auto で止めた項目）

各ファイル末尾の「判断保留」セクション参照。a-auto はスタンスを提示しただけで、最終判断は a-forest + 東海林さんに委譲。

---

## ■ 参考
- 作業ブランチ: [`feature/phase-a-prep-batch1-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch1-20260424-auto)
- 本日の関連生成物: `docs/forest-v9-to-tsx-migration-plan.md`（移植計画、a-auto 生成済）/ `docs/garden-release-roadmap-20260424.md`（ロードマップ、a-auto 生成済）/ `docs/known-pitfalls.md`（batch1 で生成）
