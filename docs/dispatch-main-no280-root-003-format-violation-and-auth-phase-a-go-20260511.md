# dispatch main- No. 280 — a-root-003 へ コピペ形式違反訂正 + 認証統一 Phase A Task 1-6 即着手 GO + 1 週間 critical path ③ ログイン→Home→モジュール 集約並行進行

> 起草: a-main-022
> 用途: a-root-003 起動報告がコピペ形式違反（~~~ ラップ + 冒頭 3 行未遵守）→ 訂正指示 + 認証統一 Phase A Task 1-6 即着手 GO（1 週間 critical path ③、5/13-14 完成目標）+ root 集約並行進行
> 番号: main- No. 280
> 起草時刻: 2026-05-11(月) 16:50

---

## 投下用短文（東海林さんがコピー → a-root-003 にペースト）

~~~
🔴 main- No. 280
【a-main-022 から a-root-003 への dispatch（コピペ形式違反訂正 + 認証統一 Phase A Task 1-6 即着手 GO + root 集約並行進行）】
発信日時: 2026-05-11(月) 16:50

# 件名
a-root-003 起動報告 ACK + 🚨 **コピペ形式違反訂正**（~~~ ラップ + 冒頭 3 行未遵守）+ **認証統一 Phase A Task 1-6 即着手 GO**（1 週間 critical path ③、5/13-14 完成目標）+ root 集約並行進行（①-⑤ 共通基盤）

# A. a-root-003 起動報告 ACK

handoff 読込完了 + 最優先タスク 6 件確認 + worktree clean 確認 + dispatch counter 42 から再開 OK、ありがとうございます。

# B. 🚨 コピペ形式違反訂正（5/11 16:45 東海林さん指摘）

a-root-003 の起動報告が以下違反:

| 違反項目 | 内容 |
|---|---|
| ~~~ ラップ | ❌ 不在 |
| 冒頭 3 行（番号 + 元→宛先 + 発信日時）| ❌ 不在 |
| ネスト不使用 | ❌ 自然会話形式混在 |
| コードブロック不使用 | ❌ |

→ memory `feedback_dispatch_header_format` v5.1/v5.2 + `feedback_reply_as_main_dispatch` 違反。

**次回からの厳守事項**:
- 冒頭 3 行: `🟢 root-003- No. 42` / `【a-root-003 から a-main-022 への [件名]】` / `発信日時: ...`
- ~~~ ラップ全体（HTML 全文 ```html ~ ``` を除き、~~~ 外にコードブロック禁止）
- ネスト不使用（多重インデント禁止）
- 自然会話形式禁止（「私は...」「結果は...」等の散文 NG、表形式 + 短文）
- 末尾 self-check 必須

軽量 ACK で済む場合（受領のみ）は `root-003- No. 42-ack` 表記 OK。

# C. 認証統一 Phase A Task 1-6 即着手 GO（1 週間 critical path ③）

東海林さん 5/11 16:30 発言: 「ログイン画面→シリーズ Home 画面→各モジュールアプリ画の流れ」を 5/18 までに完了 + root 集約情報並行進行。

a-root-002 期で起草済 plan:
- `docs/specs/plans/garden-unified-auth-plan-...md`（1,429 行、subagent prompts 内包、5/9 着手準備完了）

→ a-root-003 で **即着手 GO**:

| Task | 内容 | 担当 | 想定工数 |
|---|---|---|---|
| Task 1 | login 統一画面（Forest 既 LoginGate + Bloom GardenHomeGate 統合）| a-root-003 | 0.5d |
| Task 2 | Series Home 画面（12 モジュール grid + 権限別表示）| a-root-003 + Bloom 連携 | 0.5d |
| Task 3 | 各モジュール aplication 画面 entry（Bud / Forest / Tree / Bloom 等）| a-root-003 | 0.5d |
| Task 4 | RLS 統一 + has_role_at_least 関数活用（Batch 7 PR #154 既 merged）| a-root-003 | 0.3d |
| Task 5 | super_admin 権限固定 + 東海林さん本人専任（既 memory `project_super_admin_operation`）| a-root-003 | 0.2d |
| Task 6 | 動作テスト + Vitest（既存 helpers 再利用）| a-root-003 | 0.5d |

合計想定 = **2.5d**、subagent-driven 並列で **1-1.5d 圧縮可**。

着手方針: ガンガン本質で 5/12-13 完成目標、5/14 動作テスト + a-bloom-006 review、5/18 余裕。

# D. root 集約並行進行（1 週間 critical path ①-⑤ 共通基盤）

東海林さん発言「①-⑤ に必要な root に集約すべき情報は並行して進める」= 以下並行タスク:

| 集約対象 | 担当 | 関連目標 |
|---|---|---|
| 法人マスタ（6 法人）+ FK 連携 | a-root-003 + a-fruit 連携 | ① 仕訳帳 + ② 口座残高 |
| 従業員マスタ + 給与関連列（既 Phase A-3 完走）| a-root-003 | ① 仕訳帳 + ④ Bloom 進捗 |
| 銀行口座マスタ（新規 spec 起草候補）| a-root-003 | ② 口座残高 |
| 認証統一（Task 1-6、上記 §C）| a-root-003 | ③ ログイン→Home→モジュール |
| Forest → Root ミラー（既設計 v1.1、a-analysis-001 # 9）| a-root-003 + a-forest-002 連携 | ⑤ Forest UI 完了 |

→ Task 1-6 と並行して、銀行口座マスタ spec 起草 + 法人 FK 整理を進める（subagent-driven 推奨）。

# E. PR #157 review コメント受領後の対応継続

| 順 | アクション | 状態 |
|---|---|---|
| 1 | a-bloom-006 review (bloom-006- No. 14、採用推奨)| ✅ 完走 |
| 2 | 東海林さん最終決裁 + PR #157 merge | ⏳ |
| 3 | Chrome MCP D-1 → 本体 → D-3 → Tree D-01 再 Run | ⏳ 東海林さん操作 |
| 4 | Tree D-01 再 apply 完了通知 受領 | ⏳ |
| 5 | a-tree-002 Phase D §0 着手解放 通知 | ⏳ main 経由 |

→ a-root-003 は PR #157 review コメント検出時 即対応（main 経由）+ 上記 §C/§D 並行進行。

# F. 軽微改善 # 1（search_path）起草準備

handoff §「a-root-003 起動後の最優先タスク」# 6: 「軽微改善 #1 (search_path) main 起動指示待ち (5/13 以降)」

→ §C 認証統一 Phase A 着手後の余力で起草準備 OK、起草指示は 5/13 以降に別 dispatch で。

# G. 完了報告フォーマット（root-003- No. 42 以降、厳守）

冒頭 3 行（🔴 root-003- No. 42 / 【元 → 宛先 への [件名]】/ 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + PR URL + commit hash + 段階完走報告。

軽量 ACK で済む場合（受領 + 着手宣言）は `root-003- No. 42-ack` 表記。

# H. 緊急度

🔴 高（1 週間 critical path ③、5/12-13 完成目標、後道さんデモ前）

# I. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 起動報告 ACK
- [x] B: コピペ形式違反訂正（次回厳守事項明示）
- [x] C: 認証統一 Phase A Task 1-6 即着手 GO（2.5d / 1-1.5d 圧縮想定）
- [x] D: root 集約並行進行 5 件
- [x] E: PR #157 連動継続
- [x] F: 軽微改善 # 1 5/13 以降
- [x] G: 報告フォーマット厳守
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 280（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. コピペ形式違反の経緯

a-root-003 起動報告（5/11 16:40 頃）が以下:
- 自然会話形式（「読込完了しました」「現状」等の散文）
- 表形式は使用したが、~~~ ラップ + 冒頭 3 行 + ネスト/コードブロック判定なし
- → 東海林さん 5/11 16:45 指摘「コピペ形式でなかったため違反あり」

memory 該当:
- `feedback_dispatch_header_format` v5.1/v5.2: ~~~ 内コードブロック禁止 + 冒頭 3 行明示
- `feedback_reply_as_main_dispatch`: モジュールセッション返信は ~~~ ラップ + 番号 + 発信日時、会話形式禁止

### 2. 認証統一 Phase A 経緯

| 時期 | 状態 |
|---|---|
| 5/7 | a-root-002 が plan 1,429 行起草（subagent-driven、main- No. 83 経由）|
| 5/9 | 着手準備完了 |
| 5/10-11 | a-root-002 期で持ち越し（Batch 7 / PR #157 等の急務に集中）|
| 5/11 16:30 | 東海林さん発言「③ ログイン→Home→モジュール の流れ 5/18 完了」 |
| 5/12-13 | 本 dispatch # 280 で着手 GO |

### 3. subagent-driven 推奨

Task 1-6 並列可能タスクの組合せ:
- Task 1 + Task 2 = 同 subagent（login → home の流れ）
- Task 3 = 独立 subagent（モジュール entry）
- Task 4 + Task 5 = 同 subagent（RLS + super_admin）
- Task 6 = 全 Task 完成後

→ 3-4 subagent 並列で 1d 圧縮可能。

### 4. 投下後の流れ

1. a-root-003 受領 → §C Task 1-6 + §D 並行 集約 即着手判断
2. PR #157 review コメント検出時 即対応（main 経由）
3. 5/12-13 認証統一 alpha → a-bloom-006 review → 5/14 完成
4. 5/18 まで余裕、軽微改善 # 1 起草準備可
