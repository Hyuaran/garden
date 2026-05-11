~~~
🟡 main- No. 207
【a-main-020 から a-analysis-001 への dispatch】
発信日時: 2026-05-10(日) 00:22

# 件名
MEMORY.md 索引完全性監査依頼（§5-2 違反検出フロー動作確認テスト兼）

# 1. 背景

a-audit-001 初期化時の critique 候補 2（audit-001- No. 1）で以下を検出:

- MEMORY.md 索引のエントリ数 = 51 行
- 実 unique memory ファイル数 = 91 件
- 差分 40 件が索引未収載 or 別カテゴリ重複

main 評価: 既知の重複（user_shoji_profile 等が複数カテゴリで重複記載）+ 索引未収載の可能性あり、棚卸し対象として妥当。

設計書 §2-1 a-analysis 担当業務「memory 棚卸し」に該当 → a-analysis に索引完全性監査を依頼。

# 2. 監査観点（7 項目）

## 観点 1: 索引未収載の memory 検出
MEMORY.md 索引に記載されていないが、memory ディレクトリに実在する .md ファイルを検出。
- 検出方法: ls C:\Users\shoji\.claude\projects\C--garden-a-main\memory\*.md → MEMORY.md grep 突合
- 結果: 未収載ファイル一覧 + ファイル内 frontmatter description（type 別）

## 観点 2: 索引重複記載の memory 検出
複数カテゴリ（🔴最重要 / 🟢ユーザー基本情報 等）で重複記載されている memory を検出。
- 例: user_shoji_profile が 🔴最重要 + 🟢ユーザー基本情報 で 2 回記載
- 結果: 重複ファイル一覧 + 各重複の意図確認（意図的 or 整理漏れ）

## 観点 3: 索引のリンク死活確認
索引内の [name](file.md) リンクで file.md が実在しないものを検出。
- 検出方法: grep -oP で path 抽出 → ls で存在確認
- 結果: 死活ファイル一覧

## 観点 4: 索引フォーマットの一貫性
- 全エントリが「- [Title](file.md) — one-line hook」形式に準拠しているか
- 一行 150 文字以内ルール遵守状況
- カテゴリ見出し階層の一貫性

## 観点 5: type 分布の妥当性
a-audit 報告では type 分布 feedback:54 / project:34 / user:2 / reference:1 = 91 件。
- type が frontmatter に明記されているか
- 索引のカテゴリ分け（🔴/🟢）と type の対応関係

## 観点 6: archive 化候補の memory 検出
- 内容が古く / 解消済 / 統合済の memory が active のまま残っていないか
- _archive 移動の妥当性

## 観点 7: 統合候補の memory 検出
- 類似内容の memory が複数並立 → 統合可能性
- 例: feedback_strict_recheck_iteration v1 と v2 等のバージョン整理

# 3. 報告フォーマット（analysis-001- No. 3）

冒頭 3 行（🟢 analysis-001- No. 3 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用（v5.1 違反防止）。

### 件名
MEMORY.md 索引完全性監査結果

### 監査結果サマリ（表形式）

| 観点 | 検出件数 | 重大度（🔴緊急 / 🟡推奨 / 🟢軽微）|
|---|---|---|
| 1 索引未収載 | N 件 | ... |
| 2 索引重複 | N 件 | ... |
| 3 リンク死活 | N 件 | ... |
| 4 フォーマット一貫性 | N 件 | ... |
| 5 type 分布妥当性 | N 件 | ... |
| 6 archive 候補 | N 件 | ... |
| 7 統合候補 | N 件 | ... |

### 観点ごとの詳細

各観点について以下構造:
- 検出ファイル一覧
- 改善提案
- 重大度判定理由

### 索引改訂提案（main 採否仰ぎ）
- 改訂 1: ... （重大度 🔴 / 🟡 / 🟢）
- 改訂 2: ...

### 自己参照禁止に該当した論点（除外）
- ... （あれば、main 経由で東海林さんに上げる候補として明示）

### self-check
- [x] 冒頭 3 行
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] 7 観点全件監査実施
- [x] 重大度判定根拠明示
- [x] 報告内に ~~~ ネスト不使用（v5.1 違反防止）

# 4. §5-2 違反検出フロー動作確認テスト兼

procedure §5-2「020 → a-audit-001 単独 dispatch（例: 既存 memory 群の整合性 critique）→ a-audit-001 が監査 → 020 報告」の動作確認テスト。

ただし本依頼は棚卸し系（§2-1 a-analysis 担当業務）のため a-analysis 主導とし、結果は a-audit が critique 担当。a-analysis の起草 → a-audit critique → main 決裁 のフローで進める。

監査結果（analysis-001- No. 3）受領後、main から a-audit に critique 依頼を別 dispatch で発行予定。

# 5. 緊急度

🟡（標準フロー、template critique（main- No. 205）と並行可、優先度同等）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ
- [x] 中身は通常テキスト（バッククォート不使用）
- [x] ~~~ ネスト不使用（v5.1 準拠）
- [x] 監査観点 7 項目明示
- [x] 報告フォーマット (analysis-001- No. 3) 雛形提示
- [x] §5-2 動作確認テスト兼任宣言
- [x] 自己参照禁止抵触の除外指示明示
- [x] 番号 = main- No. 207（counter 継続）
~~~
