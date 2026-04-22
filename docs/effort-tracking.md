# Garden Effort Tracking

各 Phase / タスクの **見積 (estimated)** と **実績 (actual)** を蓄積するファイル。見積精度を上げ、将来の計画立案を精緻化するのが目的。A / B 両アカウントから共通で書き込む（git 管理）。

## 運用ルール

- **単位**: 1 日 = 8 時間。動作確認・レビュー対応含む実稼働ベース。
- **対象**: Garden 9 モジュール（Soil / Root / Tree / Leaf / Bud / Bloom / Seed / Forest / Rill）すべて
- **タイミング**:
  - Phase 着手時: 見積行を追加（Actual 欄は空で pending）
  - Phase 完了時: Actual と Notes を記入
  - 大幅超過の兆候時: Notes にアラート追記
- **spec / plan を書いた際は同時に行を追加**する（書き忘れ防止）
- **見積は後から書き換えない**: 乖離した理由は Notes に記録
- **動作確認・レビュー対応時間を除外しない**: 実質工数を記録
- **些細な修正は対象外**: typo 修正・小さなスタイル調整は記録不要

## 記録ルール

| カラム | 説明 |
|---|---|
| Phase | サブフェーズ識別子（例: `A-FMK1`, `A-1c`, `B Step 1-3`） |
| 内容 | 要約（1 行） |
| Estimated (d) | 事前見積。日単位（例: `0.5`, `1.5`, `0.02`） |
| Actual (d) | 実測工数。完了時に記入 |
| Diff | Actual − Estimated の符号付き数値（超過は `+`、短縮は `-`） |
| Session | 担当セッション（`a-leaf`, `b-main` など） |
| Notes | 乖離理由・特記事項 |

---

## Leaf（関電業務委託）

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|
| A-FMK1 | FileMaker風キーボードショートカット（再実装: Ctrl+F/N/↑↓, Esc + 前後ナビ） | 0.02 | 0.06 | +0.04 | b-main | 元handoffで「約10分」と見積。dev server起動・実機動作確認・Esc/境界テストを含めた実測は約30分弱（0.06d）。消失した `e168896` の再実装のため、コード内容は既知だった |

## Root

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

## Tree

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

## Bud

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

## Forest

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

## Bloom

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

## Soil

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

## Seed

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

## Rill

| Phase | 内容 | Estimated (d) | Actual (d) | Diff | Session | Notes |
|---|---|---|---|---|---|---|

---

## 集計（随時更新）

| モジュール | 完了 Phase 数 | 見積合計 (d) | 実績合計 (d) | 累積超過 (d) |
|---|---|---|---|---|
| Leaf | 1 | 0.02 | 0.06 | +0.04 |
| Root | 0 | 0 | 0 | 0 |
| Tree | 0 | 0 | 0 | 0 |
| Bud | 0 | 0 | 0 | 0 |
| Forest | 0 | 0 | 0 | 0 |
| Bloom | 0 | 0 | 0 | 0 |
| Soil | 0 | 0 | 0 | 0 |
| Seed | 0 | 0 | 0 | 0 |
| Rill | 0 | 0 | 0 | 0 |
| **全体** | **1** | **0.02** | **0.06** | **+0.04** |
