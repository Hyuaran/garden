~~~
🟢 main- No. 232
【a-main-020 から a-analysis-001 への dispatch】
発信日時: 2026-05-11(月) 11:12

# 件名
新規 memory 起草依頼: Garden Root → Forest ミラー仕様 + 既存 Forest 実データ Root 移行必要

# 1. 背景

2026-05-11 11:02 東海林さんから tab-3 cashflow 修正依頼時に明示された仕様情報を memory 化:

| # | 仕様 |
|---|---|
| 1 | Forest UI 数値（tab-2 KPI / tab-3 銀行残高・売掛買掛・入出金予定 等）は **mock 段階のダミー** |
| 2 | 本番実装時は **Garden Root → Forest ミラー仕様**（Forest UI は独自データを持たず、Root から取得した実データを表示するのみ）|
| 3 | 既存 Garden Forest 内（garden-forest_v9.html 等）の **実データは Root に移行保管必要** |

これは Garden 全体設計の重要仕様、memory 化で永続化 + 全モジュールセッション共有が必要。

# 2. 起草対象

新規 memory ファイル: `project_garden_forest_data_mirror_from_root.md`（仮、a-analysis 命名適切性検討可）

## 2-1. 起草内容案（main 起草、a-analysis 改訂可）

| セクション | 内容 |
|---|---|
| name / description | 「Garden Forest UI = Garden Root ミラー仕様（数値ダミー / 本番 Root → Forest ミラー / 既存実データ Root 移行）」 |
| type | project |
| ## 仕様 | 上記 §1 の 3 点を構造化 |
| ## 既存 Forest 実データの移行 | garden-forest_v9.html 等の実データ一覧 + Root 移行計画の方向性（具体スケジュールは別途検討）|
| ## tab 別状態 | tab-1〜tab-8 の各 mock データ vs 実データ状態 |
| ## 本番実装フェーズ | Root 連携実装の想定タイミング（Phase A 完走後の Forest 統合タイミング想定）|
| ## 関連 memory | project_garden_3layer_visual_model / 他 Root 関連 memory |
| ## 改訂履歴 | 2026-05-11 a-analysis-001 起草、main- No. 232、東海林さん明示仕様情報 |

# 3. 起草フロー（標準フロー §4-1）

1. **a-analysis-001 起草**: 上記 §2 ベースに新規 memory ドラフト起草、`docs/proposal-memory-garden-forest-data-mirror-20260511.md` として保存 + commit + push
2. **a-audit-001 critique**: main 経由で main- No. 後続候補に依頼、整合性検証
3. **main 決裁**: 採用 / 改善 / 却下、必要なら a-analysis 修正
4. **東海林さん最終決裁**: 採用確定
5. **main が memory ファイル登録**: `~/.claude/projects/C--garden-a-main/memory/project_garden_forest_data_mirror_from_root.md` 上書き + MEMORY.md 索引追記

# 4. 自己参照禁止 抵触検証

- a-analysis 自身の運用変更ではない（全 Garden 共通仕様 memory）
- 抵触なし
- 当事者性: Forest UI 起草は a-forest-002 / claude.ai が担当、a-analysis は memory 起草担当 = 機能本旨内

# 5. 起草スコープ + 報告フォーマット（analysis-001- No. 後続）

冒頭 3 行（🟢 analysis-001- No. NN / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠、v5.2 sentinel # 6 通過）。

### 件名
project_garden_forest_data_mirror_from_root memory v1 起草完了

### 起草成果物
- ファイル: docs/proposal-memory-garden-forest-data-mirror-20260511.md
- 行数: NN 行 / NN K
- commit hash: ...
- push: ✅ origin/workspace/a-analysis-001

### 起草内容概要
- name / description / type / 各セクション要約

### 自己参照禁止 抵触検証
- 抵触なし（全 Garden 共通仕様）

### main / a-audit 採否仰ぎ事項
- 採用 / 改善 / 却下
- a-audit critique フローへの移行可否

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 新規 memory 全文起草
- [x] 自己参照禁止検証実施

# 6. 緊急度

🟢 軽微（仕様の永続化、即時影響なし、Forest UI シフト構造修正と並行可）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 背景 + 仕様 3 点明示
- [x] 起草スコープ + 起草フロー（標準 §4-1）明示
- [x] 自己参照禁止検証明示
- [x] 報告フォーマット雛形提示
- [x] 番号 = main- No. 232（counter 継続）
~~~
