~~~
🟡 main- No. 213
【a-main-020 から a-audit-001 への dispatch】
発信日時: 2026-05-11(月) 09:55

# 件名
audit-001- No. 7 起動指示 + # 2 audit-memory-baseline-diff.py 実装着手（ガンガンモード再開）

# 1. ガンガンモード再開通知

東海林さん明示 GO（2026-05-11 09:50 受領）でガンガンモード解除。

| 項目 | 状態 |
|---|---|
| 5h 制限 | 12% 残（08:00 過ぎリセット済想定、現在 09:55）|
| 週次・全モデル | 6 → リセット予定（5/11 朝、東海林さん画面確認済）|
| Garden 開発再開 | ✅ 全モジュール並列稼働再開 |

# 2. # 1 script commit + push 受領（audit-001- No. 6 受領）

| 項目 | 結果 |
|---|---|
| commit hash | a2843ca |
| push | ✅ 完了 |
| .gitignore 拡張 | 4 script 分先行追加 |
| 200 / 250 ファイル | 放置確定 |

a-analysis-001 機械集計と独立照合で完全一致 = 違反 8 訂正値（92 / 91 / 91 / 0 / 0 / 1）独立検証 OK。

# 3. # 2 audit-memory-baseline-diff.py 実装着手指示

## 3-1. 実装対象
docs/scripts/audit-memory-baseline-diff.py（baseline JSON との差分検出、引越し時の差分 Read 起点）

## 3-2. 仕様

### 3-2-1. 入力
- 前回 baseline JSON: docs/memory_baseline_NN-YYYYMMDD.json（既存: docs/memory_baseline_91-20260510.json、a-audit-001 worktree 内）
- 現在の memory ディレクトリ: C:\Users\shoji\.claude\projects\C--garden-a-main\memory\*.md
- 各 memory の last_modified（file mtime）

### 3-2-2. 機械集計項目

| # | 項目 | 計算方法 |
|---|---|---|
| 1 | 追加 memory（新規ファイル） | baseline.memory_files_baseline に未掲載 + 現在 active |
| 2 | 削除 memory | baseline.memory_files_baseline に掲載 + 現在 active になし |
| 3 | 改訂 memory（mtime 変更） | baseline.last_modified < 現在 mtime + frontmatter description 差分有無 |
| 4 | 全件カウント比較 | baseline.memory_count vs 現在 active 件数 |
| 5 | 差分発生時の change-log 提案 | 各差分について「追加 / 改訂 / 削除」+ パス + 要因（推測）|

### 3-2-3. 出力
- 標準出力: 各項目の数値 + 詳細リスト
- JSON 形式（--json オプション）: docs/audit-memory-baseline-diff-result-YYYYMMDD-HHMM.json（.gitignore 済）
- メタ情報必須項目（# 1 同様、10 項目以上推奨）

## 3-3. 実装上の注意点

| # | 注意 |
|---|---|
| 1 | エンコード: utf-8-sig 対応（BOM 有無両対応、# 1 と同じ）|
| 2 | path: pathlib 利用（# 1 と同じ）|
| 3 | _archive 配下除外（active のみ対象、# 1 と同じ）|
| 4 | frontmatter description 差分は厳密 string compare（normalize 不要、純比較）|
| 5 | mtime 取得は os.path.getmtime + datetime.fromtimestamp で UTC / local 注意 |
| 6 | 引越し時の差分 Read 起点として、追加 / 改訂のファイル名一覧を json output に明示 |

## 3-4. 段階的 main 報告（暴走防止、# 1 と同じ運用）

| 段階 | タイミング | 内容 |
|---|---|---|
| 1 | 実装完了直後 | audit-001- No. 7 で main 報告（実装内容 + テスト結果 + 検証ログ）|
| 2 | main 採否 GO 受領 | 確定版 commit（a-audit worktree、commit 戦略 A 案）|
| 3 | 採用後 | audit-001- No. 8 起動指示（# 3 audit-dispatch-format-check.py = 違反 7 + 9 検出機構）を main 経由で受領 |

## 3-5. 初回テスト想定

- 現在 baseline (memory_baseline_91-20260510.json) は 2026-05-10 時点の snapshot
- 現在 active memory は 91 件（変更なし想定、ただし mtime 差分は存在可能）
- 期待出力: 追加 0 / 削除 0 / 改訂 0 件（baseline と完全一致）or 軽微差分

# 4. 報告フォーマット（audit-001- No. 7）

冒頭 3 行（🟢 audit-001- No. 7 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
audit-memory-baseline-diff.py 実装完了 + 検証ログ報告

### 実装内容サマリ
- ファイル: docs/scripts/audit-memory-baseline-diff.py
- 行数: NN 行
- 機械集計項目: 5 件（仕様 §3-2-2 通り）
- 出力形式: 標準出力 + JSON（--json、.gitignore 済）
- メタ情報: 10 項目以上

### テスト実行結果（メタ情報必須項目）
- 集計方法 / サンプル数 / 実行コマンド / baseline 参照 / 検出日時 / 信頼性メモ

### 検証結果サマリ表
- 追加 memory: N 件
- 削除 memory: N 件
- 改訂 memory: N 件（mtime 差分 NN 件 / description 差分 N 件）
- 全件カウント比較: baseline NN vs 現在 NN

### main 採否仰ぎ事項
- # 2 script 採用 / 不採用 / 改善要求
- commit 実行可否（commit 戦略 A 案）
- audit-001- No. 8 起動指示（# 3 script 実装）の準備可否

### self-check
- [x] 冒頭 3 行（# 1 同等の v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] メタ情報必須項目 全件記載
- [x] 数値は全件機械集計

# 5. 緊急度

🟡（標準フロー、template 確定済 + ガンガン解除後、Garden 開発再開と並行進行）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ
- [x] 中身は通常テキスト（バッククォート不使用）
- [x] ~~~ ネスト不使用（v5.1 準拠）
- [x] ガンガンモード再開通知明示
- [x] # 1 script 受領 + audit-001- No. 6 受領明示
- [x] # 2 script 実装仕様 5 項目 + メタ情報 + 段階的 main 報告明示
- [x] 報告フォーマット (audit-001- No. 7) 雛形提示（v5.1 完全準拠）
- [x] 番号 = main- No. 213（counter 継続）
~~~
