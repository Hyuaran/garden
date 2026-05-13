# Handoff a-main-024 → a-main-025 — 2026-05-13(水) 10:49 JST

> 引越し理由: Gemini 第三者目線レビュー `dispatch #main-024-final` で「司令部リセット + a-writer 分業体制移行」命令、context 80%+ 帯 + 違反 30 件累積 = 構造的限界。Opus 脳リフレッシュ目的、ノイズ排除版。

---

## §1 Garden 現状 State（12 モジュール、5/13 10:49 時点）

| モジュール | 状態 | 直近 |
|---|---|---|
| Root | 🟢 Phase B-5 完成（PR #174 OPEN）+ cross_rls deleted_at filter（PR #173 OPEN）| 5 PR 全件 bloom 採用推奨済（review timestamp 01:45 UTC） |
| Bud | 🟢 Phase D 13 migration apply 完了（5/11 22:07、本番運用着地路ゴール）+ bank rename（PR #171 OPEN）+ Phase B 給与処理本格実装 即着手準備 | bud_* 38 テーブル + 各 4 policies 整合 |
| Forest | 🟡 B-min Phase 1 全 5 タスク完成（PR #172 OPEN、**CONFLICTING、rebase 必要**）+ forest-9 + forest.md 完成 | 5/13 仕訳帳本番運用準備 |
| Tree | 🟢 Phase D §0 完走、§1 D-01 spec mismatch fix（PR #170 OPEN）+ types gen 進行中（Task 2 即着手） | β 採用、§17 最厳格、5/13 15:15 §1 全完走 ETA |
| Bloom | 🟢 累計 24 PR review 完走 + plan 6/6 全件採用推奨 | Phase A-2.2 着手判断待ち |
| Soil / Leaf / Seed / Rill / Fruit / Sprout / Calendar | ⏳ 待機 | Phase 後期 |
| Garden unified auth plan 6/6 | ✅ **100% 完成**（5/11 21:22、PR #169 admin merge、約 1.87 倍圧縮、3 日前倒し）| Critical path ③ 完成 |

---

## §2 Next Action（025 起動直後の優先順位）

| 順 | アクション | 担当 | 緊急 |
|---|---|---|---|
| 1 | **5 PR 連続 admin merge**（#170/#171/#173/#174、024 で本日試行、status 確認）| 025 + 東海林さん | 🔴 |
| 2 | **PR #172 forest CONFLICTING 対処**（rebase 依頼 → forest-002 へ dispatch）| 025 → forest | 🔴 |
| 3 | apply 順次（#171 → #173 → #174）+ Chrome MCP 経由 Supabase Studio | 025 + 東海林さん | 🔴 |
| 4 | **Bud UI 動作確認 4 項目**（`/bud/journal`、仕訳帳 INSERT、RLS、後道さん残高）| 025 + 東海林さん（Chrome 操作） | 🔴 |
| 5 | a-writer-001 への初期化指示（[a-writer-001 掟](C:/garden/a-writer-001/AGENTS.md) 参照 → セッション起動）| 025 + 東海林さん | 🟡 |
| 6 | **memory 強化 6 件採用判断**（analysis-001 No. 17、sentinel v5.3 + §0 ロック v1.2 + 新規 2 件 + 既存強化 2 件）| 025 + 東海林さん最終決裁 | 🟡 |
| 7 | 5/12 朝 audit review 残（議題 12-15）| 025 + audit-001 | 🟡 |
| 8 | Phase B 給与処理 8 subagent 並列実装着手（UI 動作確認後） | bud-002 → 025 経由 | 🟢 |
| 9 | Tree Task 2-5 完走（types gen / Vitest / RLS、ETA 5/13 15:15） | tree-002 | 🟢 |

---

## §3 最重要 物理パス（判断に不可欠）

| 用途 | パス |
|---|---|
| **a-main-025 本 worktree** | `C:/garden/a-main-025/`（origin/develop ベース、本 handoff 配置先） |
| **a-writer-001 worktree** | `C:/garden/a-writer-001/`（清書専門、コード実装なし） |
| **a-main-024 旧 worktree** | `C:/garden/a-main-024/`（参照のみ、書込禁止） |
| dispatch counter | `docs/dispatch-counter.txt`（024 期最終 345、025 期は **# 345** から起票） |
| 違反集計 | `C:/garden/a-main-024/docs/violations-a-main-024-20260511.md`（5/11-5/13 期 30 件） |
| 違反 30 件構造分析 | `C:/garden/a-analysis-001/docs/proposal-violation-30-structural-analysis-20260513.md` |
| Gemini consultation | `C:/garden/a-main-024/docs/chat-gemini-rule-improvement-consultation-20260513.md` |
| 給与処理 spec | `docs/specs/`（PR #74 merged 後、Phase B 給与 8 件） |
| root_employees 実 32 列 | `C:/Users/shoji/Downloads/Supabase Snippet Inspect Root Employees Table Columns.csv`（5/11 21:18 受領） |
| memory 全件 | `C:/Users/shoji/.claude/projects/C--garden-a-main/memory/`（70 件、MEMORY.md 索引） |

---

## §4 反省と戒め（直近 30 件違反の真因、3 行警告）

1. **時刻取得**: dispatch 起草前 `powershell.exe Get-Date` を **必ず** 実行、自己推測「N 分後だから」絶対禁止（# 23/25/29 の 3h ドリフト連鎖）。
2. **既存実装把握**: handoff 記述（§11「明日着手」等）+ system reminder（Today's date）を機械踏襲せず、`gh pr view` / Supabase Studio / git log で **客観検証**必須（# 21/24/27/29/30 = 機械踏襲が違反の半数）。
3. **dispatch 命名 +1 厳守**: a-main 起源は単純 +1、`-ack` / `-rep` / `-N` 派生命名一切禁止（# 28、v6 規格）。モジュール起源のみ `-ack3` 等可。

---

## §5 a-writer-001 起動指示（東海林さん操作）

1. 別 PowerShell ウィンドウで `cd C:\garden\a-writer-001`
2. `claude` で Claude Code 起動
3. 起動直後に `AGENTS.md を読んで掟を内化してください` と入力
4. 以降、a-main-025 から「清書依頼」を受けて dispatch / handoff / memory 整形を担当

---

## §6 dispatch counter 引継ぎ

024 期最終: **# 345**（345 まで起票準備、344 で 5 PR batch review 投下完了）。
025 期: **# 345 から起票継続**（counter ファイル `docs/dispatch-counter.txt` を 025 worktree に複製する初期作業必要）。

---

## §7 引越し直後の最初の応答（025 起動時）

東海林さんへ:
1. 「025 起動完了、handoff-025.md 読了、Garden 現状 State + Next Action + 物理パス + 戒め 内化」
2. 「最優先タスク 1-4（5 PR merge + #172 rebase + apply + Bud UI 確認）の即着手 GO 仰ぎ」
3. powershell.exe Get-Date で実時刻取得 + 冒頭 [稼働中、ガンガンモード継続] 明示

---

## 連動

- a-main-024 最終応答（5/13 10:41 # 344 起票 + bloom No. 29 受領 + Gemini 指示転送）
- analysis-001 No. 17（違反 30 件構造分析、memory 強化 6 件提案）
- Gemini `dispatch #main-024-final`（司令部リセット命令、本 handoff の起源）
