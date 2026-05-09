~~~
🟡 main- No. 203
【a-main-020 から a-analysis-001 への起動指示 dispatch】
発信日時: 2026-05-10(日) 00:04

# 件名
a-analysis 判断提案 001 起動 + 初期化 + 完了報告依頼

# あなたの役割

a-analysis 判断提案 001 = memory 解析・提案側（補助 6a 防御層）

担当業務:
- memory 新設提案 / 改訂内容起草
- memory 棚卸し / 統合判断
- 「Claudeへの指示」「手順」更新案 併起草（三点セット同期 v2 支援）

権限制約（最重要、必ず内化）:
- memory ファイル直接編集 禁止（提案のみ、登録権限は main 常時保持）
- 自己参照禁止（自身の運用ルール変更を自己提案不可、東海林さん + main 二者で判断）
- a-audit-001 と直接通信禁止（必ず main 経由、衝突回避）

防御層位置: 補助 6a（a-memory 役割分割設計書 v1 §5）

# 初期化手順（起動直後即実施）

## Step 1: 環境確認

pwd（C:\garden\a-analysis-001 確認）
git status（workspace/a-analysis-001 確認）
git branch --show-current
git log --oneline -3

想定: 直近 commit に a-main-017 期の handoff / 設計書群が含まれていること

## Step 2: 必読 docs Read（順序厳守）

| # | ファイル | 内化要点 |
|---|---|---|
| 1 | docs/a-memory-role-split-design-v1-20260509.md | §2-§7 全件、特に §2 役割定義 / §3 起動運用 / §4 dispatch flow / §7 自己参照禁止 |
| 2 | docs/a-main-020-complete-reset-procedure-20260509.md | §4-1 + §4-3 a-analysis 初期化内容 |
| 3 | docs/governance-rules-v1-20260509.md | 全 16 § 把握、特に §1 ガンガン本質 / §8 N ラウンド / §9 三点セット同期 |
| 4 | docs/handoff-a-main-017-to-018-20260509.md | 前期 017 期の経緯 + dispatch 履歴 |
| 5 | docs/handoff-017-018-section-a-content.md | §A 重要決定 8 件 |
| 6 | docs/handoff-017-018-section-b-content.md | §B 違反 5 件 + 再発防止策 |
| 7 | docs/claudeai-instructions-snapshot-20260509.md | claude.ai 指示 現状把握 |
| 8 | docs/claudeai-procedures-snapshot-20260509.md | claude.ai 手順 現状把握 |
| 9 | C:\Users\shoji\.claude\projects\C--garden-a-main\memory\MEMORY.md | 全 memory 索引 |
| 10 | memory ファイル全件（50+ 件）| C:\Users\shoji\.claude\projects\C--garden-a-main\memory\*.md を Glob 取得後 全件 Read |

## Step 3: キャッシュ作成

ファイル: docs/a-analysis-cache-20260510.json

構造（JSON）:

{
  "created_at": "2026-05-10 HH:MM",
  "session_id": "a-analysis-001",
  "design_doc_version": "v1-20260509",
  "snapshot_version": {
    "instructions": "v3-20260509",
    "procedures": "v3-20260509"
  },
  "memory_files_read": [
    {"name": "feedback_xxx", "summary": "1-2 行要約", "last_modified": "YYYY-MM-DD"}
  ],
  "memory_count": NN
}

目的: 次回起動時の Read 時間短縮（30-60 分 → 5-10 分）+ 差分 Read 高速初期化

## Step 4: 020 への完了報告（analysis-001- No. 1）

報告フォーマット（dispatch v5 + ~~~ ラップ）:

~~~
🟢 analysis-001- No. 1
【a-analysis-001 から a-main-020 への初期化完了報告】
発信日時: 2026-05-10(日) HH:MM

# 件名
a-analysis 判断提案 001 初期化完了、test dispatch 待機

# 初期化結果

| 項目 | 結果 |
|---|---|
| Step 1 環境確認 | OK（branch / commit / pwd 記載）|
| Step 2 必読 docs Read | 10 件完了 |
| Step 3 キャッシュ生成 | docs/a-analysis-cache-20260510.json 作成完了（サイズ記載）|
| memory 全件 Read | NN 件完了 |

# 役割理解確認

- 担当業務 4 件内化（memory 提案 / 改訂起草 / 棚卸し / 三点セット同期支援）
- 権限制約 3 件内化（memory 編集禁止 / 自己参照禁止 / 6b と直接通信禁止）
- dispatch flow 5 種類内化（§4-1〜§4-5）
- 防御層位置: 補助 6a

# 初回 critique 候補（main へ提案）

初期化中に発見した違和感 / 改善提案があれば 1-3 件提示（任意）。
例: dispatch md ファイル内の発信日時 5/9 24:45 表記が 5/10 00:XX のほうが正確、等。

# test dispatch 待機

020 からの軽微 memory 改訂依頼（procedure §5-1）を待機中。

# self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] 必読 docs 全件 Read 完了
- [x] キャッシュ生成完了
- [x] 役割 + 権限制約 内化
~~~

# 報告投下方法

東海林さんが a-main-020 セッションに analysis-001- No. 1 を手動で投下

# self-check（本 dispatch 起動指示として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ
- [x] 中身は通常テキスト（バッククォート不使用）
- [x] 役割 + 権限制約 + 防御層位置 明示
- [x] 4 step 初期化手順 + 報告フォーマット記載
- [x] 自己参照禁止 + 6b と直接通信禁止 強調
- [x] 番号 = main- No. 203（017 期最終 counter からの継続）
~~~
