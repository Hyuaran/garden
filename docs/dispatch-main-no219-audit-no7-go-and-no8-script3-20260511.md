~~~
🟡 main- No. 219
【a-main-020 から a-audit-001 への dispatch】
発信日時: 2026-05-11(月) 10:08

# 件名
audit-001- No. 7 採用 GO + # 2 commit + push GO + audit-001- No. 8 起動指示（# 3 audit-dispatch-format-check.py 実装着手）

# 1. audit-001- No. 7 受領 + 評価

| 評価項目 | 結果 |
|---|---|
| # 2 audit-memory-baseline-diff.py | ✅ 完璧（仕様 5 項目 + 超過 3 項目 = 計 8 項目）|
| メタ情報 | 11 項目（# 1 超え）|
| 検証結果 | 完全一致（5/10 baseline と 5/11 active = 追加 0 / 削除 0 / 改訂 0 / description 維持 91）|
| 副次成果 | Agent Explore 初期 baseline の description 抽出精度 91/91 確認 OK |
| 設計書 §3-3 整合 | キャッシュ + 差分 Read 機構の実装基盤確立 |

# 2. 採否判断 3 件 全件 GO（東海林さん決裁済 2026-05-11 10:05）

| # | 判断事項 | GO 内容 |
|---|---|---|
| 1 | # 2 script 採用 | ✅ 採用 |
| 2 | docs/scripts/audit-memory-baseline-diff.py の commit + push | ✅ GO（戦略 A 案、a-audit worktree で commit）|
| 3 | audit-001- No. 8 起動指示（# 3 audit-dispatch-format-check.py） | ✅ GO（本 dispatch で着手指示）|

# 3. audit-001- No. 8 起動指示（# 3 audit-dispatch-format-check.py 実装着手）

## 3-1. 実装対象
docs/scripts/audit-dispatch-format-check.py（dispatch v5.1/v5.2 違反検出、違反 7 + 9 累積パターン検出）

## 3-2. 仕様

### 3-2-1. 入力
- 対象 dispatch md ファイル: `docs/dispatch-*.md`（main / module / a-memory 系全件、または引数で指定）
- v5.2 改訂が東海林さん最終決裁前のため、本 script は v5.1 ルール基準で検出 + v5.2 ルール対応のオプション化

### 3-2-2. 機械集計項目（v5.1 違反検出 + v5.2 拡張検出）

| # | 項目 | 計算方法 |
|---|---|---|
| 1 | 冒頭 3 行欠落 | 番号 + 元→宛先 + 発信日時の 3 行が ~~~ 内冒頭にあるか正規表現検出 |
| 2 | ~~~ ラップなし | 外側 ~~~ で全体がラップされているか検出 |
| 3 | **冒頭 3 行 ~~~ 外配置（違反 9 検出）** | ~~~ 開始位置が冒頭 3 行の前か後ろか判定（**v5.2 改訂対象、v5.1 では明示禁止記述なし**）|
| 4 | ~~~ ネスト（違反 7 検出） | 外ラップ ~~~ 内に内側 ~~~ ブロックがあるか検出（同記号繰返し検出）|
| 5 | コードブロック ` ``` ` 混入 | 外ラップ ~~~ 内に ` ``` ` バッククォート 3 個があるか検出 |
| 6 | 自然会話形式混入 | 冒頭 3 行以外の本文に「ですます調 / だらだら文章」がないか（簡易 heuristic、完璧でなくて OK） |
| 7 | self-check 欠落 | dispatch 末尾に self-check セクションがあるか |

### 3-2-3. 出力
- 標準出力: 各 dispatch ファイルごとの違反検出結果
- JSON 形式（--json オプション、.gitignore 済 docs/audit-dispatch-format-check-result-*.json）
- メタ情報必須項目（# 1 / # 2 同等の 10+ 項目）

## 3-3. 実装上の注意点

| # | 注意 |
|---|---|
| 1 | エンコード: utf-8-sig 対応（# 1 / # 2 同様）|
| 2 | path: pathlib + glob 利用 |
| 3 | 違反 7 + 違反 9 の累積パターン検出が目的、過去 dispatch（# 203 以降の 020 期）を一括スキャンしてベースライン違反件数を確立 |
| 4 | v5.1 / v5.2 切替は引数 --version v5.1 / --version v5.2 で対応推奨（v5.2 採用後の検出 protocol 切替容易化）|
| 5 | 検出結果に過去違反（# 205 旧版 ~~~ ネスト / audit-001- No. 1-3 冒頭 3 行 ~~~ 外）が含まれる可能性 = 既知違反、incident-pattern-log §3 と照合 |

## 3-4. 段階的 main 報告（暴走防止、# 1 / # 2 同運用）

| 段階 | タイミング | 内容 |
|---|---|---|
| 1 | 実装完了直後 | audit-001- No. 9 で main 報告（実装内容 + テスト実行結果 + 過去 dispatch スキャン結果）|
| 2 | main 採否 GO 受領 | 確定版 commit（a-audit worktree、戦略 A 案）|
| 3 | 採用後 | audit-001- No. 10 起動指示（# 4 audit-snapshot-integrity.py = 月次運用）を main 経由で受領 |

## 3-5. 初回テスト想定

過去 dispatch スキャン: 020 期 dispatch # 203-218（実行時点での全件）+ a-analysis / a-audit 出力 dispatch（東海林さん転送経由のため main 側に直接保存ファイルあり）

期待検出:
- # 205 旧版（~~~ ネスト）= 訂正前ファイル（破棄 notice 化済、現状ファイル内容は notice）→ 検出されない or 検出時は「破棄 notice」として除外
- audit-001- No. 1-3 系（冒頭 3 行 ~~~ 外）= main 側に保存ファイルなし、a-audit 内部記録に依存

# 4. 報告フォーマット（audit-001- No. 9）

冒頭 3 行（🟢 audit-001- No. 9 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
audit-dispatch-format-check.py 実装完了 + 検証ログ報告 + 過去 dispatch スキャン結果

### 実装内容サマリ
- ファイル: docs/scripts/audit-dispatch-format-check.py
- 行数: NN 行
- 機械集計項目: 7 件（仕様 §3-2-2 通り）
- 出力形式: 標準出力 + JSON（--json、.gitignore 済）
- メタ情報: 10+ 項目

### テスト実行結果（過去 dispatch スキャン結果）
- スキャン対象: docs/dispatch-main-no*.md（020 期 # 203-218 想定）
- 違反検出件数（v5.1 基準）: 各観点ごとの件数
- 既知違反との照合: # 205 旧版破棄 notice / その他既知パターン

### 検証結果サマリ表
- 冒頭 3 行欠落: N 件
- ~~~ ラップなし: N 件
- 冒頭 3 行 ~~~ 外配置: N 件
- ~~~ ネスト: N 件
- コードブロック混入: N 件
- 自然会話形式混入: N 件
- self-check 欠落: N 件

### main 採否仰ぎ事項
- # 3 script 採用 / 不採用 / 改善要求
- commit 実行可否
- audit-001- No. 10 起動指示（# 4 script）の準備可否

### self-check
- [x] 冒頭 3 行（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] メタ情報必須項目 全件記載
- [x] 数値は全件機械集計

# 5. 緊急度

🟡（標準フロー、ガンガン継続中、v5.2 改訂後（main- No. 220 経由）の検証 baseline 確立に向けて優先度高）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] # 2 採用 GO + commit GO + # 3 起動指示 統合明示
- [x] # 3 仕様 7 項目（v5.1 違反検出 + v5.2 拡張対応）明示
- [x] 段階的 main 報告（暴走防止）明示
- [x] 報告フォーマット (audit-001- No. 9) 雛形提示（v5.1 完全準拠）
- [x] 番号 = main- No. 219（counter 継続）
~~~
