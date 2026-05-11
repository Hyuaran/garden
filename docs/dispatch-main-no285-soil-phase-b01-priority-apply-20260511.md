# dispatch main- No. 285 — a-soil-002 へ Soil Phase B-01 migration 先行 apply 緊急依頼（Tree D-01 apply ブロッカー解消、5/12-13 予定の前倒し）

> 起草: a-main-022
> 用途: Tree D-01 再 apply 失敗（同 42830 エラー）= soil_call_lists(list_id) FK 参照解消のため、Soil Phase B-01 migration を 5/12-13 予定から前倒し apply 必要
> 番号: main- No. 285
> 起草時刻: 2026-05-11(月) 18:10

---

## 投下用短文（東海林さんがコピー → a-soil-002 にペースト）

~~~
🔴 main- No. 285
【a-main-022 から a-soil-002 への dispatch（Soil Phase B-01 migration 緊急先行 apply 依頼、Tree D-01 ブロッカー解消）】
発信日時: 2026-05-11(月) 18:10

# 件名
🔴 Tree D-01 再 apply Run = 同 42830 エラー再発、真因 = **soil_call_lists(list_id) FK 参照未解決**（PR #157 の root_employees.employee_number UNIQUE 解消後も発生）+ **Soil Phase B-01 migration を 5/12-13 予定から前倒し apply** 必要 = a-soil-002 に作業移管要請

# A. 状況

a-main-022 が Chrome MCP で Tree D-01 再 apply 試行（5/11 18:00 頃）= 同 42830 エラー再発:
- Step 1 ✅ D-1 重複検証（root_employees.employee_number 重複 0 件）
- Step 2 ✅ 本体 UNIQUE migration（root_employees_employee_number_unique 追加成功）
- Step 3 ✅ D-3 rollback 検証（tree_calling%/tree_call_records/tree_agent% 0 件）
- Step 4 🔴 Tree D-01 再 Run = **42830: there is no unique constraint matching given keys for**

# B. 真因新仮説（コード調査結果）

Tree D-01 schema の FK 参照一覧:

| 行 | FK 参照 | 状態 |
|---|---|---|
| L87 / L124 / L202 | root_employees(employee_number) | ✅ PR #157 で UNIQUE 追加済 |
| L122 / L261 | tree_calling_sessions(session_id) | ✅ 同 migration 内、PK |
| L270 | tree_call_records(call_id) | ✅ 同 migration 内、PK |
| **L191 / L236** | **soil_call_lists(list_id)** | 🔴 **未解決最有力**（テーブル未存在 or list_id UNIQUE/PK なし）|

→ Tree D-01 の `ALTER TABLE soil_call_lists ADD FOREIGN KEY (list_id) REFERENCES ...` が、**soil_call_lists 自体が garden-dev に未存在** or PK/UNIQUE 不足で失敗。

# C. 案 A 採択（東海林さん採択、5/11 18:00 GO）

**Soil Phase B-01 migration を a-soil-002 で前倒し apply** → Tree D-01 再 Run。

# D. 依頼事項

## D-1. Soil Phase B-01 migration 確認

a-soil-002 で Soil Phase B-01 migration 7 件の現状確認:
- 起草済か（前期 handoff §3「a-soil-002 待機（前期 Phase 2 完走）」「5/12-13 migrations apply 予定」より起草済想定）
- 内容に soil_call_lists テーブル CREATE 含むか
- list_id が PK or UNIQUE 制約済か

## D-2. apply 戦略起案

a-soil-002 で apply 戦略を起案:
- 7 件 migration を Supabase で順次 apply
- Tree D-01 の前提条件として soil_call_lists 完成必須
- sample α / 本番 200 万件投入は後回し OK（**今回は schema のみ apply**）

## D-3. Chrome MCP apply（a-main-022 経由 or 東海林さん）

- a-soil-002 が apply 用 SQL を起草・PR 起票
- a-main-022 が Chrome MCP 経由で順次 apply（Step 1: schema → Step 2: 検証 SQL）
- 完了確認後、Tree D-01 再 Run

## D-4. soil_call_lists list_id 制約確認

特に重要: soil_call_lists テーブルの list_id 列に **PRIMARY KEY or UNIQUE 制約**があるか。なければ Tree D-01 FK 参照は引き続き失敗する。

# E. 緊急度

🔴 **最緊急**（Tree D-01 critical path、5/12 後道さんデモ前、Phase D §0 解放のための最終ブロッカー）

# F. 1 週間 critical path 影響

| 目標 | 影響 |
|---|---|
| ⑥ Tree UI 移行 | Tree D-01 apply ブロック = Phase D §0 着手不可 |
| ① 仕訳帳（5/13 本番運用想定）| Soil 連動なし、本件影響なし |
| ② 口座残高 UI | 同上 |
| ③ ログイン→Home→モジュール | Soil 関係なし |

→ Tree D-01 解放優先、他 critical path への影響は軽微。

# G. 報告フォーマット（soil-002- No. NN 以降）

冒頭 3 行（🔴 soil-002- No. NN / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + migration ファイル list + apply 結果 + Tree D-01 再 Run の前提条件解消確認。

# H. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 状況（Step 1-4 trace）
- [x] B: 真因新仮説（FK 参照一覧）
- [x] C: 案 A 採択明示
- [x] D: 依頼事項 4 件
- [x] E: 最緊急度 🔴 明示
- [x] F: 1 週間 critical path 影響
- [x] 番号 = main- No. 285（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 投下後の流れ

1. a-soil-002 受領 → Soil Phase B-01 migration 確認
2. apply 戦略起案 → a-main-022 経由報告
3. a-main-022 Chrome MCP で apply 順次実行
4. soil_call_lists 完成確認後、Tree D-01 再 Run
5. Tree D-01 成功 → a-tree-002 Phase D §0 解放通知

### 2. Tree D-01 schema の改訂候補（万一 Soil apply 不可時の代替）

- Tree D-01 L191/L236 の soil_call_lists FK を nullable + 後日追加 migration で FK 追加
- a-tree-002 連携必要
- → 案 A（Soil 先行 apply）優先、代替は別途判断
