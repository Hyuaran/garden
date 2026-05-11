~~~
🟡 main- No. 210
【a-main-020 から a-audit-001 への dispatch】
発信日時: 2026-05-10(日) 00:48

# 件名
判断保留 6 件 全件 GO + audit-001- No. 5 起動指示（# 1 script 実装着手）

# 1. 判断保留 6 件 全件採用 GO（東海林さん決裁済）

東海林さん決裁: 全件推奨で GO（2026-05-10 00:46 受領）。

| # | 論点 | GO 内容 |
|---|---|---|
| 1 | 過去 audit-001- No. 1-3 訂正方針 | 認識のみ（内容受領済、業務影響ゼロ、再発行は冗長）。a-audit 内で認識記録のみ |
| 2 | commit 戦略 | A 案採用: a-audit 自身の worktree で main 報告後即 commit（早期 commit、他セッション同期可、戻し容易）|
| 3 | 違反 9 記録方針 | 統合カテゴリ「v5.1 形式違反群」+ 独立番号 9 付与（同根可視化 + 履歴明示の両立）|
| 4 | 検出 protocol 改善案 4 軸 + メタ情報フォーマット | ✅ 採用（東海林さん GO 済方針具体化、機械集計標準化）|
| 5 | 実装計画 # 1-4 優先順位 + スケジュール | ✅ 採用（# 1 違反 8 直接対策最優先 → # 2 → # 3 違反 7+9 → # 4）|
| 6 | audit-001- No. 5 起動指示 | ✅ GO（template 確定済、本 dispatch で着手指示）|

# 2. audit-001- No. 5 起動指示（# 1 script 実装着手）

## 2-1. 実装対象
docs/scripts/audit-memory-index-coverage.py（MEMORY.md 索引完全性検証）

## 2-2. 仕様

### 2-2-1. 入力
C:\Users\shoji\.claude\projects\C--garden-a-main\memory\MEMORY.md
C:\Users\shoji\.claude\projects\C--garden-a-main\memory\*.md（実ファイル全件）

### 2-2-2. 機械集計項目

| # | 項目 | 計算方法 |
|---|---|---|
| 1 | 索引 entry 行数 | grep -c '^- \[' MEMORY.md と同等の Python 実装 |
| 2 | 索引 unique filename 数 | 索引内 [name](file.md) の file.md を sort -u で unique 取得 |
| 3 | 実 active memory 数 | memory/*.md の総数（MEMORY.md / _archive 配下を除外）|
| 4 | 未収載差分 | 実 active で索引未収載のファイル一覧 |
| 5 | 死活リンク | 索引内 link 先で実存しないファイル一覧 |
| 6 | 重複記載 | 索引内で同一ファイルが複数行に記載されている件数 |

### 2-2-3. 出力
- 標準出力: 各項目の数値 + 詳細リスト
- JSON 形式（オプション）: docs/audit-memory-index-coverage-result-YYYYMMDD-HHMM.json
- メタ情報必須項目（critique 内採用、本 dispatch で承認済）:
  - 集計方法 / サンプル数 / 実行コマンド / 検出日時 / 信頼性メモ

## 2-3. 実装上の注意点

| # | 注意 |
|---|---|
| 1 | エンコード: utf-8（BOM の有無検証 + utf-8-sig 対応推奨）|
| 2 | path: Windows 形式 + Unix 形式両対応推奨（pathlib 利用）|
| 3 | _archive 配下除外（active 91 件のみカウント）|
| 4 | 索引パターンの正規表現: `^- \[([^\]]+)\]\(([^)]+\.md)\)` で name + file 両方抽出 |
| 5 | 検出値根拠を出力に明示（「機械集計（grep + wc 同等の Python 実装）」「全件 91 / 91」等）|

## 2-4. 段階的 main 報告（暴走防止）

| 段階 | タイミング | 内容 |
|---|---|---|
| 1 | 実装完了直後 | audit-001- No. 5 で main 報告（実装内容 + テスト結果 + 検証ログ）|
| 2 | main 採否 GO 受領 | 確定版 commit（a-audit worktree、commit 戦略 A 案）|
| 3 | 採用後 | audit-001- No. 6 起動指示（# 2 script 実装）を main 経由で受領 |

# 3. commit 指示（緊急 bypass §4-4 範囲、commit 戦略 A 案）

## 3-1. 対象ファイル（a-audit worktree 内）

| # | ファイル | 内容 |
|---|---|---|
| 1 | docs/incident-pattern-log.md | v1.1 追補（§3 違反 7 + §3 違反 8 + §4-2 dispatch 形式拡張 + §4-2 検出値根拠シグナル新設 + §5 改訂履歴）|
| 2 | docs/a-audit-cache-20260510.json | memory_index_entries: 51 → 92 訂正、memory_index_unique_filenames: 91 追加、memory_index_correction_log 追加 |
| 3 | docs/scripts/audit-memory-index-coverage.py | # 1 script 実装版（audit-001- No. 5 で報告予定）|

## 3-2. commit メッセージ提案

audit/incident-log: [a-audit-001] 違反 7+8+9 + protocol 改善 + # 1 script 実装

- incident-pattern-log v1.1 追補（§3 違反 7/8 + §4-2 シグナル拡張）
- a-audit-cache 検出値訂正（51→92, unique 91）
- docs/scripts/audit-memory-index-coverage.py 新規（機械集計標準化、違反 8 対策）

ただし # 3 script は audit-001- No. 5 報告 + main 採否 GO 後に commit、本段階では # 1 + # 2 のみ commit でも可。a-audit の判断で。

# 4. 報告フォーマット（audit-001- No. 5）

冒頭 3 行（🟢 audit-001- No. 5 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、**冒頭 3 行 ~~~ 内配置**（v5.1 完全準拠、違反 9 訂正反映）。

### 件名
audit-memory-index-coverage.py 実装完了 + 検証ログ報告

### 実装内容サマリ
- ファイル: docs/scripts/audit-memory-index-coverage.py
- 行数: NN 行
- 機械集計項目: 6 件（仕様 §2-2-2 通り）
- 出力形式: 標準出力 + JSON（オプション）
- メタ情報: 集計方法 / サンプル数 / 実行コマンド / 検出日時 / 信頼性メモ 全て出力

### テスト実行結果（メタ情報必須項目）
- 集計方法: 機械集計（Python pathlib + 正規表現）
- サンプル数: 全件 91 / 91
- 実行コマンド: python docs/scripts/audit-memory-index-coverage.py
- 検出日時: YYYY-MM-DD HH:MM
- 信頼性メモ: utf-8-sig 対応 / Windows 環境 PowerShell 5.1 で動作確認

### 検証結果サマリ表
- 索引 entry 行数: 92
- 索引 unique filename 数: 91
- 実 active memory 数: 91
- 未収載差分: 0
- 死活リンク: 0
- 重複記載: 1（user_shoji_profile、既知）

### main 採否仰ぎ事項
- # 1 script 採用 / 不採用 / 改善要求
- commit 実行可否（commit 戦略 A 案）
- audit-001- No. 6 起動指示（# 2 script 実装）の準備可否

### self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠、違反 9 訂正反映）
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] 報告内に ~~~ ネスト不使用（v5.1 違反防止）
- [x] コードブロック不使用（v5.1 違反防止）
- [x] メタ情報必須項目 5 件全件記載

# 5. 緊急度

🟡（標準フロー、template 確定済 = §5-1 完走済、Garden 開発再開と並行進行可）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠、違反 9 訂正反映）
- [x] ~~~ ラップ
- [x] 中身は通常テキスト（バッククォート不使用）
- [x] ~~~ ネスト不使用（v5.1 準拠）
- [x] 判断保留 6 件 全件 GO 通知明示
- [x] # 1 script 実装仕様 + メタ情報フォーマット明示
- [x] 段階的 main 報告（暴走防止）明示
- [x] commit 指示（A 案、緊急 bypass §4-4 範囲）明示
- [x] 報告フォーマット (audit-001- No. 5) 雛形提示（v5.1 完全準拠）
- [x] 番号 = main- No. 210（counter 継続）
~~~
