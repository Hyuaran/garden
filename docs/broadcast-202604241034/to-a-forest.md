# 【a-auto セッションからの周知】

- 発信日時: 2026-04-24 10:34 発動 / 約 11:15 配布
- 対象セッション: **a-forest**
- 発動シーン: 集中別作業中（約45分）

---

## ■ 完了した作業

- `main` から `feature/forest-v9-migration-plan-auto` を派生
- 以下 3 ファイルを新規作成し commit + push
  - `docs/forest-v9-to-tsx-migration-plan.md`（移植計画本体、全 8 章）
  - `docs/autonomous-report-202604241034-a-auto-v9plan.md`（本作業のレポート）
  - `docs/broadcast-202604241034/to-a-forest.md`（本ファイル）
- **src/app/forest/ 配下のコードには一切触れていません**

---

## ■ あなた（a-forest）が実施すること

### 1. 計画本体の精読
```bash
git fetch origin feature/forest-v9-migration-plan-auto
git show origin/feature/forest-v9-migration-plan-auto:docs/forest-v9-to-tsx-migration-plan.md
```
または GitHub 上で直接閲覧。

### 2. 東海林さんと設計判断 5 項目を合意
**判1**: 販管費テーブルの正規化（別テーブル A案 / 既存テーブル列追加 B案）
**判2**: 納税スケジュールの構造（単テーブル+jsonb A案 / 3テーブル分割 B案）
**判3**: 決算書 PDF の格納（Drive継続 A / Storage ミラー B / 完全移行 C）
**判4**: F6 ZIP 生成方式（Edge+Drive API A / Edge+Storage B / クライアント JSZip C）
**判5**: Tax Files アップロード主体（税理士直 A / 社内代理 B）

合意できたら `docs/superpowers/specs/2026-04-XX-forest-vX-migration.md` 等で**正式仕様化**を推奨。

### 3. Phase 着手順序の決定
a-auto の推奨: **P0 → P1 → P2 → P4 → P5 → P6**（計 4.75d で v9 相当の機能カバレッジ達成）
異論があれば順序変更。決定内容は `docs/effort-tracking.md` に先行記入（§12）。

### 4. 本ブランチの扱い
- **採用**: `feature/forest-v9-migration-plan-auto` を PR 化して main / develop にマージ（計画ドキュメントとして永続化）
- **保留**: ブランチは残したまま、ドキュメントとして参照
- **破棄**: `git push origin --delete feature/forest-v9-migration-plan-auto`（非推奨：計画ごと消える）

---

## ■ 判断保留事項（a-auto 側で止めた項目）

- **判1〜判5 の 5 設計判断**は a-auto では結論を出さず、推定スタンスのみ併記。**最終判断は東海林さん**。
- 本計画の「未調査」範囲: `ForestShell.tsx` / `MicroGrid.tsx` / `SummaryCards.tsx` / `MacroChart.tsx` / `NumberUpdateForm.tsx` / `PeriodRolloverForm.tsx` の細部実装差分は、v9 スタイル/挙動との突合調査を a-forest 側で行う必要。

---

## ■ 観察サマリ（参考）

v9 HTML の 11 機能ブロックのうち TSX 実装状況：

| 状態 | 機能 |
|---|---|
| ✅ 実装済 | Login / Header / Summary Cards / Macro Chart / Micro Grid |
| 🟡 部分実装 | Detail Modal（販管費内訳 8 項目が未実装） |
| ❌ **未実装** | **Tax Calendar / Tax Files / Download Section / Tax Detail Modal / Info Tooltip** |

加えて、v9 には無い管理者機能（Shinkouki編集 / PdfUploader / NumberUpdateForm / PeriodRolloverForm）は TSX で新設済。v9 移植とは**独立軸**。

---

## ■ 参考

- 見積範囲: 最小 **4.75d**（v9 相当） / フル **9.25〜10.25d**（Storage 連携 + ZIP 生成まで）
- 🔴 最優先 Phase: **P0**（設計判断、0.5d） / **P1**（販管費内訳、1.0d） / **P2**（納税カレンダー、2.0d）
- 本計画は a-auto 次回発動時の候補タスクとしても採用可能（例: P1 は「判定が不要な純追加」なので就寝前シーンに適合）
