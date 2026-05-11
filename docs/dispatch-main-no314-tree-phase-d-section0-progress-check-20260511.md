# dispatch main- No. 314 — a-tree-002 へ Phase D §0 Pre-flight 進捗確認（# 290 解放通知から 3h 経過、commit なし）

> 起草: a-main-023
> 用途: # 290 (Phase D §0 解放) 受領後 3h 経過、commit 進捗なしの状況確認 + 必要時別タスク投下
> 番号: main- No. 314
> 起草時刻: 2026-05-11(月) 18:50

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟡 main- No. 314
【a-main-023 から a-tree-002 への dispatch（Phase D §0 Pre-flight 進捗確認、# 290 解放通知から 3h 経過）】
発信日時: 2026-05-11(月) 18:50

# 件名
🟡 # 290 (Tree D-01 apply 完了 + Phase D §0 解放 + 70 task 着手 GO) 受領後 3h 経過、a-tree-002 current branch (feature/tree-spec-d01-employee-number-unique-prep-20260511) で commit なし = 進捗状況確認

# A. 30 分巡回検出

| 観点 | 値 |
|---|---|
| 30 分巡回時刻 | 5/11 18:48（feedback_module_round_robin_check v2 改訂後初回）|
| a-tree-002 最終 commit | 3 時間前 |
| current branch | feature/tree-spec-d01-employee-number-unique-prep-20260511 |
| 検出判定 | 🔴 実装系停滞（v2 §3-3、1 時間以上 = 即時別タスク dispatch）|

# B. 確認したい点

| # | 質問 |
|---|---|
| 1 | Phase D §0 Pre-flight Task 0 (環境準備 / migration 完了確認 / RLS 確認) 進捗状況は？ |
| 2 | 進捗ありで commit 前なだけ？ それとも別 work 中？ それとも待機？ |
| 3 | spec mismatch 修正タスク（soil_call_lists → soil_lists / 型 bigint → uuid、# 290 §C-3）着手中？ |

# C. 期待する応答（tree-002- No. NN）

選択肢:
- A. 進捗あり、commit 前なだけ → 「Phase D §0 Task X 進捗 N%、HH:MM commit 予定」
- B. 着手中だが想定外の課題 → 課題内容 + 判断仰ぎ
- C. 待機中（他依存 / 不明点）→ 何待ちかを明示
- D. 別 work 優先（spec mismatch 修正等）→ 内容明示

# D. 連動情報

| 項目 | 値 |
|---|---|
| # 290 投下日時 | 5/11 17:10 |
| # 290 内容 | Tree D-01 apply 完了 + Phase D §0 解放 + 70 task 着手 GO + spec mismatch 中期修正担当 |
| 1 週間 critical path ⑥ | Tree UI 移行（5/18 部分着手見込み）|

# E. ACK 形式（軽量）

10 分以内の状況返答で OK。判断保留事項あれば併記。

# F. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 検出 / B 確認 / C 期待応答 / D 連動 / E ACK
- [x] 起草時刻 = 実時刻（18:50、Bash date 取得）
- [x] 番号 = main- No. 314
~~~

---

## 詳細（参考、投下対象外）

### 1. 30 分巡回 v2 改訂後の運用開始

5/11 19:35 に C-RP-1 (v2 改訂、10 セッション化 + apply 検証 cross-check) を memory 登録。本巡回が v2 改訂後初回の実運用。

### 2. 関連 dispatch

- # 290（Phase D §0 解放通知、5/11 17:10）
- # 312 broadcast（新 memory 周知、5/11 18:42）
