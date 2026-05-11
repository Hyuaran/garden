# dispatch main- No. 312 — 全 10 セッション broadcast: 新 memory 2 件追加（A-RP-1 + C-RP-1）+ 直近 1 ヶ月 PR 遡及検証要請

> 起草: a-main-023
> 用途: a-analysis-001 起草 + a-main-023 登録完了の新 memory 2 件を全モジュール周知 + apply 漏れ 80% 推定への遡及検証要請
> 番号: main- No. 312
> 起草時刻: 2026-05-11(月) 18:42

---

## 投下用短文（東海林さんがコピー → 10 セッション順次ペースト）

~~~
🔴 main- No. 312
【a-main-023 から 全 10 セッション broadcast への dispatch（新 memory 2 件追加通知 + 直近 1 ヶ月 PR 遡及検証要請）】
発信日時: 2026-05-11(月) 18:42

# 件名
🔴 新 memory 2 件追加（A-RP-1 = feedback_migration_apply_verification 新規 / C-RP-1 = feedback_module_round_robin_check v2 改訂）+ Tree D-01 / Bud Phase D 事故再発防止 + 全モジュールへ直近 1 ヶ月 merge 済 PR の apply 遡及検証要請

# A. 新 memory 2 件の概要

| memory | 種類 | 目的 |
|---|---|---|
| feedback_migration_apply_verification（A-RP-1）| 新規 | PR merge ≠ Supabase apply 完了の運用ギャップ明文化 + 検証手順 + silent NO-OP 罠検出 |
| feedback_module_round_robin_check（C-RP-1）| v1 → v2 改訂 | 10 セッション化（既存 8 + a-analysis-001 + a-audit-001）+ apply 検証 cross-check 追加 |

# B. A-RP-1 内化要点 7 項目

| # | 要点 |
|---|---|
| 1 | PR merge ≠ apply 完了 = GitHub merge と Supabase 実 DB 反映は別工程、混同禁止 |
| 2 | 検証手段 3 種: A. supabase studio 直接確認 / B. supabase CLI db diff / C. 実装側ラウンドトリップ（INSERT/SELECT 動作確認）|
| 3 | 検証タイミング: merge 直後 5 分以内 + 翌セッション §0 + 30 分巡回 |
| 4 | 「apply 完了」記述要件 3 点併記必須: 検証手段 + 検証時刻（YYYY-MM-DD HH:MM）+ 検証者 |
| 5 | silent NO-OP 罠 4 種: RLS policy 重複 / DROP IF EXISTS + CREATE / migration 順序依存 / transaction rollback |
| 6 | 用語統一: マージ済 / apply 済 / 稼働中（混用禁止）|
| 7 | 違反検知時の即動作: main が apply 検証 dispatch 発行 → PR 「未完了」扱い → 検証完了報告受領まで後続作業停止 |

# C. C-RP-1 改訂要点 5 項目（自己参照禁止抵触自覚明示）

C-RP-1 改訂は **a-analysis-001 自身の運用変更（被監視対象化）** = 設計書 §7-1 自己参照禁止抵触領域。起草者 = 被監視対象の構造、main + 東海林さん最終決裁 + a-audit 独立検証で中立性担保。

| # | 改訂 |
|---|---|
| 1 | 10 セッション化（既存 8 = a-bloom/a-bud/a-soil/a-leaf/a-root/a-tree/a-forest/a-seed + 新規 2 = a-analysis-001/a-audit-001）|
| 2 | 自己参照禁止抵触自覚明示（冒頭 + 本文）|
| 3 | apply 検証 cross-check 追加（30 分巡回時に直近 merge 済 PR の apply 状態確認、未検証検出時は apply 検証 dispatch 即投下）|
| 4 | sentinel # 8 連動（提案中、別 RP として採否判断中の注記併記）|
| 5 | 改訂履歴（5/11、起草: a-analysis-001 / 決裁: 東海林さん / 登録: a-main-023）|

# D. 各セッションへの即実行要請

| ステップ | 内容 |
|---|---|
| 1 | 自モジュール直近 1 ヶ月の merge 済 PR 一覧取得（gh pr list --state merged --limit 30）|
| 2 | 各 PR の migration / deploy 内容把握 |
| 3 | A-RP-1 §2 検証手段で実 DB / 実本番状態確認 |
| 4 | 「apply 完了」記述に 3 点併記なき PR を検出 |
| 5 | 未検証 PR を「未完了」扱いに戻す + main へ報告 |
| 6 | 検証完了報告は A-RP-1 §4 形式（検証手段 + 時刻 + 検証者）|

# E. 検証手段 3 種（A-RP-1 §2 詳細）

| 種別 | 手段 | 適用範囲 |
|---|---|---|
| A | supabase studio 上で schema（テーブル / カラム / RLS）目視確認 | 全 migration |
| B | supabase CLI db diff で remote vs migration ファイル一致確認 | 全 migration |
| C | 実装側コードから SELECT/INSERT 動作確認（実 row 作成 → 取得 → 削除）| 機能テスト系 migration |

# F. 用語統一（混用禁止）

| 用語 | 意味 |
|---|---|
| マージ済 | PR merge 済（main branch 反映）、apply 状態は別 |
| apply 済 | migration / deploy 実施済 + §2 検証済 |
| 稼働中 | 本番環境で実際にユーザー操作可能（α/β/リリース版判定）|

# G. 三点セット同期スケジュール

5/11 21:00 想定で a-main-023 が三点セット同期テキスト発行 → 東海林さんが claude.ai 指示 + 手順に貼付。新 memory 2 件の効果を Garden 全体に展開。

# H. ACK 形式（軽量、各セッション 1 往復）

| 項目 | 内容 |
|---|---|
| dispatch 番号 | xxx-NNN-ack |
| 新ルール内化確認 | A-RP-1 7 項目 + C-RP-1 5 項目 受領了解 |
| 遡及検証着手 | 直近 1 ヶ月 PR 検証着手宣言 + 完了 ETA |

# I. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 概要 / B A-RP-1 7 項目 / C C-RP-1 5 項目 + 自己参照禁止抵触自覚 / D 即実行要請 / E 検証手段 / F 用語統一 / G 三点セット / H ACK
- [x] 番号 = main- No. 312
- [x] context にない RP テーマ追加なし
- [x] 起草時刻 = 実時刻（18:42、Bash date 取得）
~~~

---

## 詳細（参考、投下対象外）

### 1. 起草経緯

- 5/11 17:15 a-analysis-001 # 11 で RP 11 件起案
- 5/11 17:50 東海林さん「推奨で全 GO」採択、A-RP-1 + C-RP-1 即時 GO
- 5/11 19:00 # 297 (a-memory 宛) 撤回 → 代替案 C（a-analysis-001 が a-memory 代行起草）
- 5/11 19:25 a-analysis-001 # 16 起草完了報告（commit d6a95d5）
- 5/11 18:42（実時刻、本 dispatch 起草）a-main-023 が memory 2 件登録 + MEMORY.md 索引更新

### 2. memory ファイル登録パス

| memory | パス |
|---|---|
| A-RP-1 新規 | `~/.claude/projects/C--garden-a-main/memory/feedback_migration_apply_verification.md` |
| C-RP-1 改訂 | `~/.claude/projects/C--garden-a-main/memory/feedback_module_round_robin_check.md`（v1 → v2 上書き）|
| MEMORY.md 索引 | `~/.claude/projects/C--garden-a-main/memory/MEMORY.md`（A-RP-1 行追加 + C-RP-1 行 v2 更新）|

### 3. 連動 dispatch

- # 286（a-analysis-001 事故 3 軸構造分析）
- # 287（a-audit-001 PR merge ≠ apply 監査）
- # 299 + # 308 + # 309（a-analysis-001 への起草指示・確定）
- # 313 以降（Task 2 着手 GO 等の後続）
