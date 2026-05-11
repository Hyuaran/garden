# dispatch main- No. 327 — a-bud-002 へ Bud Phase D RLS exists ブロック全体を has_role_at_least 採用に縮退（Tree D-01 cross_rls_helpers 同パターン踏襲、今夜中本番運用着地、20:30 目標）

> 起草: a-main-023
> 用途: Bud Phase D RLS が root_employees.user_id / garden_role / deleted_at / department_id を参照（全て不在列）、Tree D-01 同パターン (PR #154 cross_rls_helpers) で has_role_at_least helper 採用に縮退
> 番号: main- No. 327
> 起草時刻: 2026-05-11(月) 19:36

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 327
【a-main-023 から a-bud-002 への dispatch（RLS exists ブロック全体縮退、has_role_at_least 採用、今夜中本番運用着地）】
発信日時: 2026-05-11(月) 19:36

# 件名
🔴 Bud Phase D RLS exists ブロックが root_employees の不在列を参照（user_id 45 件 / garden_role 17 件 / deleted_at 27 件 / department_id 2 件）、Tree D-01 PR #154 cross_rls_helpers 同パターンで has_role_at_least helper 採用に縮退、今夜 20:30 本番運用着地

# A. 真因（最終）

| 不在列 | 件数 | 影響 |
|---|---|---|
| root_employees.user_id | RLS subquery 45 件 | 全 RLS exists でエラー |
| root_employees.garden_role | exists 内 17 件 | 役割判定が動かない |
| root_employees.deleted_at | exists 内 27 件 | 論理削除フィルタ不能 |
| root_employees.department_id | manager_dept policy 内 2 件 | 部署フィルタ不能 |

→ root_employees 実列（21 列）に user_id / garden_role / deleted_at / department_id すべて不在。Bud Phase D RLS 全 exists ブロックがエラー。

# B. 修正方針（Tree D-01 同パターン踏襲、設計判断不要）

Tree D-01 で PR #154 cross_rls_helpers で導入された `public.has_role_at_least()` helper を Bud Phase D 全 RLS に採用:

| Before | After |
|---|---|
| `exists ( select 1 from public.root_employees re where re.employee_number = public.auth_employee_number() and re.garden_role = 'admin' and re.deleted_at is null )` | `public.has_role_at_least('admin')` |
| 同 manager_dept (department_id 含む) | `public.has_role_at_least('manager')`（部署フィルタ縮退、Tree is_same_department 縮退と同パターン）|

# C. 修正対象パターン全件

| パターン | 件数 | 対象 migration |
|---|---|---|
| 1. `where re.user_id = auth.uid()` → 修正済 (a-main-023 v4) | 17 件 | （参考、b-1 で吸収）|
| 2. `where user_id = auth.uid() and deleted_at is null` → 修正済 (a-main-023 v4) | 27 件 | （参考、b-1 で吸収）|
| **3. exists ブロック全体 → has_role_at_least 採用** | **17 件 (garden_role 別) + 1 件 manager_dept = 18 件** | D-01 / D-02 / D-03 / D-04 / D-05 / D-06 / D-09 / D-10 |
| **4. deleted_at 参照削除** | **27 件**（exists 内に内包される）| 同上 |
| **5. department_id 条件削除** | **2 件**（同上）| D-01 |

→ パターン 3-5 を統一的に「exists ブロック全体置換 = has_role_at_least 採用」で対応可能。

# D. subagent 並列起票方針（前回 # 310 同パターン）

| 項目 | 内容 |
|---|---|
| 採用方式 | subagent-driven-development（前回 13 migration 6 分完走実績、bud # 51）|
| 並列数 | 13 並列（migration 1 件 = subagent 1 件）|
| 各 subagent prompt 必須要素 | (1) 対象 migration ファイル絶対 path / (2) exists (select 1 from public.root_employees re where ...) ブロック全体を public.has_role_at_least('XXX') 単純呼出に置換 / (3) garden_role の値 ('super_admin' / 'admin' / 'manager' / 'staff' / 'cs' / 'closer' / 'toss' / 'outsource') から has_role_at_least 引数を決定 / (4) manager_dept policy は has_role_at_least('manager') 単純化（department_id フィルタ削除）/ (5) 完了報告: 修正件数 + 残課題 |
| 禁止事項 | Tree D-01 cross_rls_helpers (PR #154) で導入された helper のシグネチャ変更禁止、新規 helper 関数追加禁止 |

# E. 着地スケジュール（今夜中本番運用、20:30 目標）

| 時刻 | 担当 | 内容 |
|---|---|---|
| 19:36 | 私 | # 327 起票・投下 |
| 19:40-20:05 | a-bud-002 (subagent 13 並列) | 13 migration RLS exists 縮退（前回 26 箇所 6 分実績 → 今回 44+ 件 20-30 分想定）|
| 20:05 | a-bud-002 | commit + push + bud-002- No. 53 報告 |
| 20:05-20:10 | a-main-023 (私) | git pull + 修正版 merged SQL v5 再生成 |
| 20:10-20:15 | a-main-023 (私) | Chrome MCP で SQL v5 Run（東海林さん権限委譲済）|
| 20:15-20:25 | 私 + 東海林さん | REST 検証 + 仕訳帳動作確認 |
| **20:25-20:30** | 東海林さん | **5/11 中本番運用開始判断** |

# F. 並行 task

# 306 Phase D-3/4/5 spec 起草は本残課題解消後に着手（前回 # 322 §F 通り）。

# G. ACK 形式（軽量、bud-002- No. 53）

| 項目 | 内容 |
|---|---|
| 修正完了時刻 | HH:MM |
| commit hash | 1 件 |
| 修正箇所件数 | exists ブロック N 件 / 残課題確認 |
| push 完了 | ✅ |

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 真因 / B 修正方針 / C 対象パターン / D subagent 並列 / E スケジュール / F 並行 / G ACK
- [x] 起草時刻 = 実時刻（19:36）
- [x] 番号 = main- No. 327
~~~

---

## 詳細（参考、投下対象外）

### 連動

- bud # 51（5/11 19:18、残課題 26 箇所 + 49 ack）
- bud # 52（5/11 19:19、26 箇所 push 完了）
- # 322（5/11 19:13、bud # 51 即承認）
- v3 Run (19:23) → 42703 target.id → v4 (修正済) → 42703 viewer.department_id → 真因確定 → 本 # 327

### Tree D-01 PR #154 cross_rls_helpers 参考

`supabase/migrations/20260511000001_cross_rls_helpers.sql` で導入された helper:
- `public.auth_employee_number()` - JWT claim から employee_number 取得
- `public.has_role_at_least(role text)` - ロール階層判定

Bud Phase D もこの helper 採用で root_employees.user_id / garden_role / deleted_at 不在問題を一掃可能。
