# MEMORY.md 索引完全性監査結果（生データ、analysis-001 起草用）

生成日時: 2026-05-10 (Python script)
対象 MEMORY.md: C:\Users\shoji\.claude\projects\C--garden-a-main\memory\MEMORY.md

## 集計サマリ

| 項目 | 件数 |
|---|---|
| active 実ファイル | 91 |
| archive 実ファイル | 12 |
| MEMORY.md 索引リンク総数 | 92 |
| MEMORY.md 索引 unique 数 | 91 |
| 索引 entry 行数（- [ で始まる）| 92 |
| カテゴリ見出し（##） | 10 |

## 観点 1: 索引未収載検出
件数: 0

（なし）

## 観点 2: 索引重複検出
件数: 1

- user_shoji_profile.md (x2)
  - 出現カテゴリ: 🔴 最重要（毎回必ず参照、ループ防止のコア）
  - 出現カテゴリ: 🟢 ユーザー基本情報

## 観点 3: リンク死活
件数: 0

（なし）

## 観点 4a: 一行 150 文字超
件数: 3

- L59 (164 chars): - [dispatch 一括投下時 PowerShell rate limit 回避](feedback_dispatch_powershell_rate_limit.md) — 3-5 セッションごとに 30-60 秒間隔、API "Server is temporarily limiting requests" エラー予防
- L65 (168 chars): - [ChatGPT mock 画像は claude.ai に直接添付（Claude Code text 化を経由しない）](feedback_chatgpt_mock_to_claude_ai_direct_attach.md) — Claude Code 画像→text 変換が不得意で劣化、claude.ai 画像読み取りは信頼可
- L122 (155 chars): - [claude.ai → Claude Code の Drive コネクタ連携 / _chat_workspace 運用](project_claude_chat_drive_connector.md) — Queue Processor v2（バックグラウンド処理完全撤去、send_report 統合）

## 観点 4b: hook 区切り — / - 不在
件数: 0


## 観点 5: type 分布
- 'feedback': 54 件
- 'project': 34 件
- 'reference': 1 件
- 'user': 2 件

## 観点 5b: frontmatter type 未明記
件数: 0


## カテゴリ別 entry 数

- L3 🔴 最重要（毎回必ず参照、ループ防止のコア）: 27 entry
- L33 🟢 ユーザー基本情報: 3 entry
- L39 🟢 コミュニケーション・報告スタイル: 9 entry
- L51 🟢 セッション運用・並列化: 7 entry
- L61 🟢 視覚・UI 開発フロー: 4 entry
- L68 🟢 後道さん / 現場対応: 5 entry
- L76 🟢 外部連携・GitHub・トークン: 11 entry
- L90 🟢 Garden プロジェクト基盤: 15 entry
- L108 🟢 Garden モジュール固有: 7 entry
- L118 🟢 プロジェクト進行・現状: 4 entry

## 観点 7 補助: 名前類似（同 prefix 3 部品以上）

- feedback_main_session: ['feedback_main_session_50_60_handoff.md', 'feedback_main_session_lessons_005.md']

## 参考: archive 内ファイル一覧

- _archive/feedback_auto_continuous.md
- _archive/feedback_cross_session_instruction_format.md
- _archive/feedback_dispatch_file_first_format.md
- _archive/feedback_dispatch_md_copy_button.md
- _archive/feedback_dispatch_time_must_be_real.md
- _archive/feedback_do_not_prematurely_wrap_up.md
- _archive/feedback_multi_session_worktree_protocol.md
- _archive/feedback_parallelization_preference.md
- _archive/feedback_self_reference.md
- _archive/feedback_shoji_visual_judgment_required.md
- _archive/feedback_status_report_format.md
- _archive/feedback_token_leak_policy.md
