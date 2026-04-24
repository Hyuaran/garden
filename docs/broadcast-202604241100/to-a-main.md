# 【a-auto セッションからの周知】

- 発信日時: 2026-04-24 11:00 発動 / 約 12:25 配布
- 対象セッション: **a-main**（横断調整セッション）
- 発動シーン: 集中別作業中（約90分）

---

## ■ 完了した作業

- `main` から `feature/garden-roadmap-20260424-auto` を派生
- 以下 3 ファイルを新規作成し commit + push
  - `docs/garden-release-roadmap-20260424.md`（ロードマップ本体、全 5 章・510 行超）
  - `docs/autonomous-report-202604241100-a-auto-roadmap.md`（自律実行レポート）
  - `docs/broadcast-202604241100/to-a-main.md`（本ファイル）
- **コードには一切触れていません**（`src/app/*` 未改変）

---

## ■ あなた（a-main）が実施すること

### 1. 計画本体の精読
```bash
git fetch origin feature/garden-roadmap-20260424-auto
```
GitHub または以下で閲覧：
- `docs/garden-release-roadmap-20260424.md`

### 2. 東海林さんと合意すべきポイント
ロードマップ中の **意思決定事項**：

| # | 論点 | a-auto の推定スタンス |
|---|---|---|
| 合1 | Phase A の開始日（M1 = 2026-05 スタート前提） | 2026-05 第1週から着手 |
| 合2 | 月次レビュー体制の立ち上げ時期 | M1 末（2026-05-31）から開始 |
| 合3 | 並列化タスク 40 件のうち M1 で auto 投入する初期 6 件 | P07 / P08 / P09 / P12 / P22 / P38（低リスク・高価値） |
| 合4 | Leaf 30 テーブル問題への対処方針 | P21 で auto スケルトン大量生成・テンプレ化 |
| 合5 | Tree 切替日の目標 | M8 W4（2026-12 最終週）、ただし延長可・短縮不可 |
| 合6 | 通常業務との競合対策 | Phase A で経理自動化を先行し、M2 末で 1〜2 日/週の Garden 作業時間を捻出 |

### 3. 各モジュールセッションへの周知配布
Phase A 対応モジュール（**Bud / Forest / Root**）に §11 テンプレートで配布：
- a-bud: Phase A 中の役割（A-01〜A-07、P01〜P06）
- a-forest: Phase A 中の役割（A-08〜A-13、P07〜P11）
- a-root: Phase A 中の役割（A-14〜A-16、P12〜P16）

Phase B/C/D 対応モジュールには、**着手月の前月末**に段階的に周知配布する段取り。

### 4. `docs/effort-tracking.md` への事前記入
合意済の Phase A タスク（A-01 〜 A-16）を**予定時間付きで先行記入**（§12）。
各行のフォーマット:
```
| Module | Phase A task name | estimated_days | | | session | | | notes |
```

### 5. 本ブランチの扱い
- **推奨**: `main` への **PR 化してマージ**（ロードマップを永続化）
- 代替: develop へマージ → main へは M1 開始時に昇格
- 非推奨: 保留（ロードマップが feature ブランチに閉じ込められる）

---

## ■ 判断保留事項（a-auto 側で止めた項目）

- 工数見積は a-auto 経験則ベース。**東海林さんの実体感で ±30% 調整**される前提
- Seed モジュールは着手時点で仕様再定義の想定のため、計画上は最小限バッファ
- 子 CLAUDE.md の深部仕様（Tree 作業メモ 20260420 / Leaf 残課題一覧 / Bud 設計書 v1 等）は未読 → 各セッションで精読推奨
- 人事・採用 / SaaS 契約更新 / BCP は本計画では対象外（別計画で扱う）

---

## ■ ハイライト（a-main が東海林さんに素早く伝えるための要点）

### 残工数サマリ（モジュール別）
- 全合計: **77.75 〜 121.25 d**（約 4 〜 6 ヶ月、1ヶ月=20稼働日換算）
- 並列 auto で圧縮可（40件・計 17.5d 分）

### Phase 別の月次目標
| 月 | 目標 |
|---|---|
| M1 | Bud 振込 α、Forest v9 相当、Root 7マスタ UI |
| M2 | Bud 明細 α、Forest フル、Root KoT/MF 連携 |
| M3 | Leaf 関電 α内部、Bud 給与 Phase 0 |
| M4 | Leaf 関電 β（3-5名）、Bud 給与 α |
| M5 | Soil + Bloom + Rill 基礎 |
| M6 | Bloom / Rill / Leaf 他商材 α |
| M7 | Tree §16 7種テスト + α版 |
| M8 | Tree 1人 → 2-3人 → 半数 → 全員、FileMaker 切替 |

### 🔴 最重要リスク 3 つ
1. **Tree 現場投入失敗 = 業務停止**（R-02） → §17 段階テストを絶対に短縮しない
2. **Leaf 30 テーブル問題**（R-01） → auto スケルトン大量生成で時間圧縮
3. **通常業務との競合**（R-03） → Phase A で経理自動化を最優先にし、業務時間を捻出

### M1 で即着手できる auto タスク（低リスク・高価値）
- P07 Forest P0 比較資料 / P08 HANKANHI SQL / P09 Tax Calendar テーブル設計
- P12 Root KoT 要件 / P22 Soil コール履歴分割戦略 / P38 known-pitfalls 初版
（計 6 件、合計 約 2.5d 分を auto で夜間バッチ化可能）

---

## ■ 参考

- ロードマップ全文: `docs/garden-release-roadmap-20260424.md`
- 作業ブランチ: [`feature/garden-roadmap-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/garden-roadmap-20260424-auto)
- Forest 関連の詳細計画: `docs/forest-v9-to-tsx-migration-plan.md`（本日同時生成）
- Tree / Bud レビュー: `feature/tree-review-20260424-auto`（1a1c806）/ `feature/bud-review-20260424-auto`（b371ed5）
