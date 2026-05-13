# dispatch main- No. 339 — a-bud-002 UI 動作確認 + Phase B 給与処理本格実装着手 GO

> 起草: a-main-024
> 用途: Bud Phase D apply 完了 (5/11 22:07) から 2 日経過、5/13 朝に UI 動作確認 + Phase B 給与処理本格実装着手 GO 通知、デモ延期 = 「全完走後デモ」モード
> 番号: main- No. 339（counter 339、v6 規格 +1 厳守）
> 起草時刻: 2026-05-13(水) 10:15（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 339
【a-main-024 から a-bud-002 への dispatch（UI 動作確認 + Phase B 給与処理本格実装着手 GO + 銀行 CSV Root rename 連動）】
発信日時: 2026-05-13(水) 10:15

# 件名
🔴 a-bud-002 UI 動作確認 4 項目 5/13 朝即実施 + Phase B 給与処理本格実装着手 GO + 銀行 CSV bud_bank_* → root_bank_* rename 別 PR 起票（α 採用、東海林さん 5/11 21:30 GO 受領済）

# A. 至急モード通知
東海林さん 5/13 10:14 明示: 「デモ予定は延期、全完走後デモ」「至急進めましょう」= ガンガン本質完全適用、5/11→5/13 で 2 日滞留 解消最優先。

# B. UI 動作確認 4 項目（main- No. 338 §E、5/12 朝予定 → 5/13 朝即実施）
| # | 内容 | 担当 | 所要 |
|---|---|---|---|
| 1 | Garden Bud `/bud/journal` UI 表示確認 | 東海林さん + a-main-024（Chrome MCP）| 10 分 |
| 2 | 仕訳帳 1 行 INSERT 動作確認 | 東海林さん | 10 分 |
| 3 | RLS 動作確認（別ロール login で自分のデータのみ表示）| 東海林さん | 10 分 |
| 4 | 後道さん残高 UI 動作確認 | 東海林さん + a-bloom-006 連動 | 10 分 |

→ 合計 30-45 分、本日 10:30-11:30 完了想定。

# C. Phase B 給与処理本格実装着手 GO（bud # 58 推奨第 1 位採用）
| 項目 | 内容 |
|---|---|
| spec | PR #74（A-07 採択結果反映済、8 spec）|
| 実装範囲 | 勤怠取込 + 計算 + 配信（給与明細 Y 案 + フォールバック）|
| 想定工数 | Phase D 同等規模、5-7 日 |
| 着手 | UI 動作確認完走後（11:30 以降）即着手 GO |
| 並行 | 銀行 CSV rename PR 起票（下記 §D）|

# D. 銀行 CSV bud_bank_* → root_bank_* rename 別 PR（α 採用、5/11 21:30 GO）
| 項目 | 内容 |
|---|---|
| 採用案 | α: bud_bank_accounts / bud_bank_balances / bud_bank_transactions → root_bank_* rename |
| 影響 | PR #159 alpha = mock data のみ、本番影響なし、即対応可 |
| 別 PR | feature/bud-root-bank-tables-rename-20260513（base: develop）|
| 連動 | a-root-003 連携（root_* 配下に責任移管）|
| 想定工数 | 30 分-1h |
| 着手 | UI 動作確認 + Phase B 着手と並行可（Bud worktree 内で完結）|

# E. cross_rls_helpers deleted_at filter 強化（P1、後回し）
| 項目 | 内容 |
|---|---|
| 内容 | auth_employee_number() / has_role_at_least() に deleted_at filter 追加 |
| 担当 | a-root-003（cross_rls_helpers PR #154 起源、root 担当）|
| タイミング | Phase B 給与処理着手後の中期、5/14 以降想定 |
| 優先 | 🟢 P1（軽微、急務でない）|

# F. ACK 形式（bud-002- No. 59）
| 項目 | 内容 |
|---|---|
| 1 | # 339 受領確認 |
| 2 | UI 動作確認 4 項目 即実施 ETA |
| 3 | Phase B 給与処理着手 ETA + subagent 並列計画 |
| 4 | 銀行 CSV rename PR 起票 ETA |

# G. 緊急度
🔴 最緊急（5/11→5/13 で 2 日滞留、ガンガン本質完全適用、本日中完走目標）

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 10:15（powershell.exe Get-Date 取得済、2026-05-13 水曜）
- [x] 番号 = main- No. 339（v6 規格 +1 厳守）
- [x] A 至急 / B UI 確認 / C Phase B / D 銀行 CSV / E P1 / F ACK / G 緊急度
~~~

---

## 詳細（参考、投下対象外）

### 連動
- bud-002 No. 58（次タスク候補 4 件、Phase B 給与処理本格実装を 🟢 推奨第 1 位）
- main- No. 338（Bud Phase D apply 完了）
- 東海林さん 5/11 21:30 「テーブル名 Bud → Root に変えるで OK」（銀行 CSV α 採用）
- 東海林さん 5/13 10:14 「デモ延期 + 至急進めましょう」（ガンガン完全適用）

### 違反集計（5/11-5/13 期、累計 30 件）
- 5/11 期 # 21-28（handoff §11 機械踏襲 / v5 規格違反 / 時刻自己推測 / PR 番号 / root 連鎖時刻 / 説明スタイル / ガンガン「明日」再違反 / dispatch 命名 -rep 違反）
- 5/13 朝 # 29-30（日付認知違反 / デモ前マイルストーン記述）
