# dispatch main- No. 290 — a-tree-002 へ Tree D-01 apply 完全成功 + Phase D §0 解放 + Phase D §0 Pre-flight Task 0 着手 GO

> 起草: a-main-023
> 用途: Tree D-01 critical path 解放完了通知、Phase D 70 task 着手 GO、5/18 ⑥ Tree UI 移行 critical path 進行
> 番号: main- No. 290
> 起草時刻: 2026-05-11(月) 17:10

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟢 main- No. 290
【a-main-023 から a-tree-002 への dispatch（Tree D-01 apply 完全成功 + Phase D §0 解放 + Phase D 70 task 着手 GO）】
発信日時: 2026-05-11(月) 17:10

# 件名
🟢 Tree D-01 (`20260427000001_tree_phase_d_01.sql`) apply 完全成功（5/11 17:00 東海林さん Run）、Phase D §0 Pre-flight critical path 解放完了。Phase D 70 task / 5 週間予定 着手 GO

# A. Tree D-01 apply 完全成功確認

| 項目 | 状態 | 検証方法 |
|---|---|---|
| root_employees.employee_number UNIQUE 制約 | ✅ 適用済 | 重複 INSERT 試行 → 23505 root_employees_employee_number_unique 違反確認 |
| tree_calling_sessions テーブル | ✅ 存在 | REST 200 |
| tree_call_records テーブル | ✅ 存在 | REST 200 |
| tree_agent_assignments テーブル | ✅ 存在 | REST 200 |
| 42830 エラー | ✅ 解消 | inline FK が UNIQUE 制約解消で通過 |

# B. 真因の二層構造 (handoff §5 と異なる確定結果)

| 層 | 障害 | 解消 |
|---|---|---|
| 直接真因 | inline FK `REFERENCES root_employees(employee_number)` が UNIQUE 未存在で 42830 | ✅ 5/11 17:00 migration `20260511000002` apply 完了 |
| 潜在問題 | Tree D-01 spec の soil_call_lists が real soil migration に存在せず（real = soil_lists, uuid PK）| 🟡 IF EXISTS guard で skip（apply は通過）+ 中期で spec 修正必要 |

→ **Tree D-01 apply は IF EXISTS guard で soil_call_lists 不存在を吸収**して成功。soil 連携 FK は将来 soil_call_lists が（別名で）存在するようになった時点で ALTER 追加。

# C. a-tree-002 着手 GO

## C-1. 即着手可能
- Phase D §0 Pre-flight Task 0（環境準備 / migration 完了確認 等）即着手 OK
- Phase D 70 task / 5 週間予定 全体着手 GO
- spec mismatch (soil_call_lists → soil_lists) は中期タスクとして並行進行（Phase D §1 以降の作業と並行可）

## C-2. Phase D §0 → §1 → §X 進行
- §0: Pre-flight（環境 / migration / RLS 確認）
- §1: 認証統合（a-root-003 auth plan v1.0 #289 GO 済、5/12-14 完成想定）
- §X: 70 task 順次（5/12 - 5/30 想定、5/18 ⑥ Tree UI 移行 部分着手）

## C-3. Tree D-01 spec 修正タスク（並行、中期）

soil-62 で a-soil-002 が提起した spec mismatch 解消:
- spec L56-74 / L129 / L165 / L187 / L191 / L236 で soil_call_lists → soil_lists、soil_call_histories → soil_call_history、bigint → uuid 修正
- migration 修正版を別 PR で起票
- 5/12-13 で着手推奨（緊急ではないが、Phase D §1+ 進む前に整合させる）

# D. 1 週間 critical path 影響

| # | 目標 | 影響 |
|---|---|---|
| ⑥ Tree UI 移行 | 🟢 解放完了、5/12 Phase D §0 着手、5/18 部分着手 達成想定 |
| ③ ログイン → Series Home → 各モジュール | a-root-003 auth plan v1.0 GO 済、Tree も対象モジュール |

# E. 期待する応答（tree-002- No. NN）

| 順 | 内容 |
|---|---|
| 1 | tree-002- No. N-ack: 「290 受領、Phase D §0 即着手」（軽量 ack）|
| 2 | tree-002- No. N+1+: Phase D §0 Task 0 完成報告 |
| 3 | 以降 Phase D 70 task の節目で随時報告 |

# F. 参考資料

- migration: supabase/migrations/20260427000001_tree_phase_d_01.sql (apply 完了)
- 連動 migration: supabase/migrations/20260511000002_root_employees_employee_number_unique.sql (apply 完了)
- Phase D plan v3: docs/specs/plans/tree-phase-d-plan-v3.md (PR #71 merged 済)
- 関連 dispatch: # 286 (analysis 事故分析) / # 287 (audit PR≠apply 監査) / # 288 (soil # 285 撤回) / # 289 (root auth plan GO)

# G. 緊急度

🟢 解放通知（軽量、即着手可能）

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A apply 完全成功確認（5 項目）
- [x] B 真因二層構造明示
- [x] C 着手 GO (C-1 即着手 / C-2 §0→§1→§X / C-3 spec 修正中期)
- [x] D 1 週間 critical path 影響
- [x] E 期待する応答
- [x] F 参考資料 + 関連 dispatch
- [x] 番号 = main- No. 290
~~~

---

## 詳細（参考、投下対象外）

### 1. apply 完了の経緯

- 5/11 14:30 a-main-022 が Tree D-01 apply 試行 → 42830 エラー
- 5/11 15:50 仮説 1 (root_employees UNIQUE 不足) で PR #157 起票・merge
- 5/11 16:00 再 apply → 同 42830 再発
- 5/11 16:24 a-soil-002 (soil-62) で spec mismatch 発覚（soil_call_lists vs soil_lists 等）
- 5/11 16:40 a-main-023 が REST 直接検証で root_employees UNIQUE 未適用 立証（PR #157 が GitHub merge のみで Supabase apply 漏れ）
- 5/11 17:00 東海林さん Supabase Dashboard で UNIQUE migration + Tree D-01 を順次 Run → 成功

### 2. 教訓

- PR merge ≠ Supabase apply 完了 = audit-001 # 287 で全モジュール横断監査依頼中
- 仮説検証プロセスの欠陥 = analysis-001 # 286 で構造分析依頼中

### 3. 関連 dispatch

- dispatch # 286（a-analysis-001 事故構造分析）
- dispatch # 287（a-audit-001 PR merge ≠ apply 監査）
- dispatch # 288（a-soil-002 # 285 撤回 + Phase B-01 別途進行）
- dispatch # 289（a-root-003 auth plan v1.0 GO）
- dispatch # 291（a-root-003 へ Tree D-01 解放ステータス通知、本件と同時投下）
