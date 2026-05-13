# Gemini Consultation — Garden プロジェクト運用 + ルール忘れ改善案 第三者目線レビュー

> 発信: 東海林美琴（経営者、非エンジニア）via a-main-024（Claude Code セッション）
> 発信日時: 2026-05-13(水) 10:27 JST
> 投下先: Google Gemini Chat
> 用途: Garden プロジェクト運用方法 + Claude セッションで発生したルール忘れ（違反 30 件）の構造的改善案を **Claude 以外の LLM** の第三者目線で評価依頼

---

## 投下用テキスト（Gemini にコピペでペースト）

~~~
# Gemini への相談 — Garden プロジェクト Claude 運用のルール忘れ改善

私（東海林）は Garden という社内 Web アプリ群を Claude（Anthropic）で開発しています。Claude にいくつかの運用ルールを設定しているのですが、Claude 自身が定期的にルールを忘れる / 違反する問題が累積しており、**Claude 以外の LLM の第三者目線**で改善案を聞きたいです。

# A. Garden プロジェクト概要

- 開発者: 私 1 人（非エンジニア、経営者）+ Claude が実装担当
- スケジュール: 6 ヶ月で 12 モジュール完成目標
- 技術スタック: Next.js (App Router) / Supabase / Vercel / TypeScript / Tailwind
- 12 モジュール: Soil（DB）/ Root（認証 + 従業員マスタ）/ Tree（架電）/ Leaf（商材）/ Bud（経理）/ Bloom（ダッシュボード）/ Seed（新事業）/ Forest（経営）/ Rill（メッセージ）/ Fruit（法人マスタ）/ Sprout（採用）/ Calendar

# B. 現在の運用方法（セッション構成）

私は Claude Code（Claude のローカル CLI 版）を **複数セッション並列**で動かしています。各セッションが独立した Git worktree で作業:

| セッション | 役割 |
|---|---|
| **a-main**（横断調整、本セッション） | 司令塔、各モジュールへの dispatch 起草、巡回チェック、memory 管理 |
| a-bloom / a-bud / a-soil / a-leaf / a-root / a-tree / a-forest 等 | 各モジュールの実装担当 |
| a-auto | 夜間 / 会議中の自律実行専用 |
| a-analysis（最近追加）| 構造分析 / memory 改訂起草 |
| a-audit（最近追加）| 監査 / 違反パターン蓄積 |
| a-memory（最近追加、未起動）| memory 判断専門の別セッション |

**通信方法**: a-main → モジュールへの指示は「dispatch」という名前の Markdown ファイルを起票、私（東海林）が手動で各セッションにコピペ投下。返信も同様。

# C. memory システム

Claude Code には永続 memory 機能があり、`~/.claude/projects/<proj>/memory/*.md` に蓄積。a-main が memory ファイルを起票 + 改訂、MEMORY.md（索引）で参照。各 memory はセッション開始時に自動読込。

現在 memory は **約 70 件**（feedback / project / reference / user の 4 種類）。最重要 memory（毎回必ず参照）に 30 件以上指定。

# D. 確立済の運用ルール（主要）

1. **ガンガンモード（デフォルト動作）**: 全モジュール並列稼働 + 5h 使用枠フル活用 + 東海林作業時間無視
2. **dispatch ヘッダー v6 規格**: 単純 +1 連番、ack / rep 派生命名禁止、~~~ ラップ、緊急度マーク
3. **厳しい目で再確認 3 ラウンド**: 提案 / 報告 / dispatch 起草前に必ず発動、抜けが見つからなくなるまで
4. **応答出力前 sentinel 5 項目**: 状態 / 提案 / dispatch / ファイル / 既存実装 の self-check
5. **起動時 §0 必読 docs ロック 8 項目**: handoff + governance + memory + 三点セット + critical path + 違反 + sentinel + 最終 GO
6. **時刻取得徹底**: dispatch 起草前 PowerShell Get-Date 取得、自己推測禁止
7. **既存実装把握 3 トリガー**: 議論前 / 修正前 / 外部依頼前で grep + Read + git log
8. **判断仰ぎ 4 列テーブル**: 論点 / 推奨 / 論点要約 / 推奨要約（東海林は非エンジニアなので平易表現必須）
9. **PR merge ≠ apply 完了**: 検証手段 + 時刻 + 検証者 3 点併記必須
10. **モジュール巡回**: 30 分おき stagnation 検出、停滞時に別タスク dispatch

# E. 直近 session（2026-05-11 → 5/13）で発生した違反 30 件

本セッション（a-main-024、12 時間+）で以下の違反が累積:

| # | 違反 | 該当ルール |
|---|---|---|
| 21 | handoff §11「5/12 朝着手」機械踏襲 = ガンガン本質「5h フル」違反 | ガンガンモード |
| 22 | dispatch # 331-333 ヘッダー v5 規格違反（ファイル名 / 構成すべて崩し）| v5 規格 |
| 23 | dispatch 起草時刻 50 分先取りで自己推測 | 時刻取得徹底 |
| 24 | dispatch # 333 §B 表 PR 番号 + Task 名 transcription error（5 行全件誤）| 既存実装把握 |
| 25 | モジュール（root）が私の時刻自己推測を連鎖して 3h ドリフト | 時刻取得徹底 |
| 26 | 判断仰ぎ説明スタイル違反（専門用語多用 + 全体像なし、2 回指摘）| 4 列テーブル / 平易表現 |
| 27 | ガンガン本質「5/12 朝着手」機械踏襲再違反（# 21 と同型）| ガンガンモード |
| 28 | dispatch 命名規則違反（a-main で派生命名「-rep」「-rep-2」を独自創出、6 件起票）| v6 規格 |
| 29 | 日付認知違反（5/11 起草の handoff を 5/12 朝想定、実は 5/13 朝の 2 日経過、system reminder の日付見落とし）| 既存実装把握 |
| 30 | 「5/13 後道さんデモ前マイルストーン」記述（東海林の延期通知見落とし、memory + dispatch 多用）| 既存実装把握 |
| 1-20 | 前セッション（a-main-023）でも 20 件違反 | 各種 |

→ **5/11-5/13 で累計 30 件**、これは多発と認識。

# F. これまでの改善試行（6 重防御層）

| 層 | 仕組み |
|---|---|
| 1 | 応答出力前 sentinel 5 項目（毎応答前 self-check）|
| 2 | 厳しい目で再確認 N ラウンド焦点別（提案 / 報告 / dispatch 前）|
| 3 | 完了報告 + 東海林の最終チェック |
| 4 | §0 必読 docs ロック（起動時自動 8 項目）|
| 5 | 東海林の定期チェックテンプレ（外部観測）|
| 6 | a-memory 別セッション視点 |

→ 6 重防御層を確立したが、それでも違反が累積。

# G. Gemini への相談ポイント

Claude 自身は「memory 強化」「sentinel 追加」「ルール文書化強化」を改善案として提案しがちですが、これらは過去 6 重防御層で既に実施済で、それでも違反が累積しています。

**Claude 以外の LLM の第三者目線で、以下を聞きたいです**:

## 質問 1: 構造的真因の診断
Claude のルール忘れ 30 件パターンを見て、**根本原因は何だと診断しますか**？
- Claude のアーキテクチャ的限界（context window / attention / memory recall）？
- 運用設計（複数セッション並列 / memory システム）の問題？
- 私（東海林）の指示出し方の問題？
- それ以外？

## 質問 2: 6 重防御層の評価
私が確立した 6 重防御層は妥当ですか？
- 過剰 / 不足 / 設計欠陥 のいずれかある？
- 6 層構造そのものに問題（例: 層が多すぎて Claude が混乱）はある？

## 質問 3: 改善案
Claude 以外の視点で、**根本的に違うアプローチ**を提案できますか？
- 例: ルールを減らす / 役割を変える / セッション構成を変える 等
- 「Claude をルールで縛る」発想から離れた選択肢

## 質問 4: Gemini 自身の運用知見
Gemini や他の LLM を使ったプロジェクト運用で、ルール遵守を実現する工夫を知っていれば共有してください。

# H. 補足情報

- 私（東海林）は非エンジニア、開発全体を Claude に任せている
- Claude セッションは **同時 10+ 並列**で動かしている（context 共有なし、各 worktree 独立）
- dispatch 通信は手動コピペ（自動化未実装）
- 1 ヶ月以上の運用、複数の major マイルストーン達成済（Garden 認証統一 plan 6/6 完成、Bud 経理 Phase D 完成等）
- Claude 自身は優秀（実装速度 1.87 倍圧縮等）、ただしルール忘れが繰り返し発生

---

回答は **構造分析を重視**、Claude の弱点を遠慮なく指摘してください。「Claude を変える」改善案も「Claude を使う運用を変える」改善案も両方歓迎です。
~~~

---

## 詳細（参考、投下対象外）

### 連動
- handoff a-main-023→024 §5（前セッション違反 20 件）
- docs/violations-a-main-024-20260511.md（本セッション違反 # 21-30）
- memory `feedback_gangan_mode_default` v3
- memory `feedback_dispatch_header_format` v6
- memory `feedback_self_memory_audit_in_session`
- memory `feedback_explanation_style`
- memory `feedback_a_memory_session_collaboration`（a-memory 設計）

### 期待 Gemini 回答
- Claude のアーキテクチャ的限界（attention / context window）の指摘
- 6 重防御層の構造的問題（層が多すぎて逆効果の可能性）
- 「Claude を縛る」発想から「運用を変える」発想への転換案
- 具体的な代替アプローチ（例: タスクスコープを狭める / セッション役割を統合 / 自動化拡大 等）

### 期待効果
- 第三者目線で 6 重防御層の妥当性検証
- Claude のルール忘れに対する根本対処案
- 5/11 期 30 件累積を構造的に減らす指針
