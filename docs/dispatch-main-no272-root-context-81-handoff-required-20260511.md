# dispatch main- No. 272 — a-root-002 へ context 81% 引越し帯超過 + a-root-002 → a-root-003 即引越し指示

> 起草: a-main-022
> 用途: a-root-002 context 81% = modules 引越し帯（80%）超過、PR #157 起票完了で区切り良し、即引越し指示
> 番号: main- No. 272
> 起草時刻: 2026-05-11(月) 16:10

---

## 投下用短文（東海林さんがコピー → a-root-002 にペースト）

~~~
🔴 main- No. 272
【a-main-022 から a-root-002 への dispatch（context 81% 引越し帯超過 + 即引越し指示）】
発信日時: 2026-05-11(月) 16:10

# 件名
🔴 a-root-002 context 81% 引越し帯（modules 80% ライン）超過 + PR #157 起票完了で区切り良し + **a-root-003 への即引越し指示**

# A. PR #157 起票完了 ACK（root-002- No. 40 受領）

| 項目 | 状態 |
|---|---|
| migration ファイル | supabase/migrations/20260511000002_root_employees_employee_number_unique.sql ✅ |
| PR | #157 起票完了 ✅（base=develop, head=feature/root-employee-number-unique）|
| D-1/D-3 SQL ヘッダー明示 | ✅（東海林さん Run 時の事前/事後検証 SQL 内包）|
| 適用フロー §「適用方法」 | ✅（5 step 案内: D-1 → 本体 Run → D-3 → Tree D-01 再 Run → Phase D §0 解放）|
| 所要時間 | 約 10 分 完走 |

→ 完璧な完走、ありがとうございます。

# B. context 81% 引越し帯超過

memory `feedback_main_session_50_60_handoff` 帯運用:

| 帯 | a-main | **modules / auto** |
|---|---|---|
| 50-60% | 先行引越し | 通常 |
| 70% | 注意 | 注意 |
| **80%** | 最終ライン | **引越しライン** ← 該当 |
| 95% | 強制終了 | 強制終了 |

a-root-002 = **81% 達成、引越しライン超過** → 即引越し必須。

# C. 引越しタイミング判断

| 観点 | 判断 |
|---|---|
| 進行中タスク区切り | ✅ PR #157 起票完了 = 区切り良し |
| 次タスク重さ | 🟢 軽量（PR review 待機 + 軽微改善 # 1 起草準備のみ）|
| 緊急性 | 🔴 80% 超過は最終ライン |
| 結論 | **即引越し実行**（緊急、新規タスク着手前）|

# D. 引越し手順（a-root-002 → a-root-003）

memory `feedback_session_handoff_checklist` §A 準拠 8 項目チェック:

| Step | 内容 |
|---|---|
| 1 | git 実態確認（pwd / status / branch --show-current / log --oneline -10）|
| 2 | dispatch counter 確認（次番号、軽量 ACK ルール準拠）|
| 3 | 各 PR 進行状況（PR #154 ✅ merged / PR #157 OPEN / 待機 PR） |
| 4 | memory 棚卸し（前期 root-002 期で気付いた事項あれば）|
| 5 | セッション内 違反 / 忘れ 集計（東海林さんに「§7 違反追記」依頼）|
| 6 | 厳しい目で再確認 3 ラウンド |
| 7 | 三点セット同期テキスト発行（必要時のみ）|
| 8 | RTK gain 報告 |

handoff ファイル名: `docs/handoff-a-root-002-to-003-20260511.md`

# E. a-root-003 worktree 作成手順

```
# 東海林さんが C:\garden\ で実行（PowerShell）
git -C C:\garden\a-main-022 worktree add C:\garden\a-root-003 -b workspace/a-root-003 origin/develop
```

→ a-root-003 起動 → handoff 読込 → 続行（PR #157 review コメント受領待機 + 軽微改善 # 1 起草準備等）。

# F. 引越し後の次タスク（待機項目、a-root-003 起動後）

| # | タスク | タイミング |
|---|---|---|
| 1 | PR #157 a-bloom-006 review コメント受領時 即対応 | ⏳ |
| 2 | PR #157 merge 後 apply 完了通知受領（main 経由）| ⏳ |
| 3 | Tree D-01 再 apply 完了通知受領 + Phase D §0 解放 ACK | ⏳ |
| 4 | 軽微改善 # 1（SECURITY DEFINER search_path）起草準備 | 🟢 5/13 以降 |
| 5 | Phase B 7 spec（既起草済、PR #75）の実装着手判断 | 🟢 後道さんデモ後 |

# G. 報告フォーマット（root-002- No. 41 = 引越し完了 final）

冒頭 3 行（🔴 root-002- No. 41 / 元→宛先 / 発信日時）+ ~~~ ラップ + handoff ファイル markdown link 明示 + a-root-003 起動指示。

# 緊急度

🔴 高（context 81% 引越し帯超過、即引越し必須、5/12 デモ前 critical path）

# H. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用（手順案内は ~~~ 内例外として最小化）
- [x] A: PR #157 起票完了 ACK
- [x] B: 81% 引越し帯超過明示
- [x] C: 引越しタイミング判断
- [x] D: 引越し手順 8 項目（§A 準拠）
- [x] E: a-root-003 worktree 作成手順
- [x] F: 引越し後の待機タスク 5 件
- [x] G: 完了報告フォーマット
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 272（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. a-root-002 期の主要成果（参考、handoff §A 起草時の素材）

- Batch 7 cross-rls-helpers (auth_employee_number / has_role_at_least) PR #154 起票・merge・apply 完走
- main- No. 230 横断調査結果報告（root-002- No. 38）
- main- No. 233 完了報告（root-002- No. 38、PR #154 trace 確立）
- main- No. 259 ACK（PR #154 apply 完了確認）
- main- No. 268 受領 + PR #157 起票完了（10 分完走、本期最終成果）

### 2. 引越し後の handoff チェックポイント

- handoff §5 違反集計欄 = 東海林さんに「§7 違反追記」依頼必須
- handoff §6 N ラウンド = 3 ラウンド連続 0 件で終了
- handoff §10 三点セット = 本期は memory 改訂少（PR #154 / #157 系のみ）、簡易記述で可

### 3. 引越し失敗時のフォールバック

- a-root-003 起動失敗 = a-main-022 で git worktree list 確認 + 必要なら東海林さんへ再起動依頼
- handoff 起草中の context 枯渇 = 不完全 handoff でも push + a-root-003 で補完起草
