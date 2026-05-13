# dispatch main- No. 341 — a-tree-002 Phase D §1 D-01 Schema 即着手 GO (5/12 朝予定 → 5/13 朝即着手)

> 起草: a-main-024
> 用途: tree-002 No. 33 で β 採用（5/12 朝着手）申し入れ、5/12 朝予定が 5/13 朝に滞留 = 即着手 GO、デモ延期 = 全完走後モード
> 番号: main- No. 341（counter 341、v6 規格 +1 厳守）
> 起草時刻: 2026-05-13(水) 10:15（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟡 main- No. 341
【a-main-024 から a-tree-002 への dispatch（Phase D §1 D-01 即着手 GO + spec mismatch 修正並行 + 5/13 至急モード）】
発信日時: 2026-05-13(水) 10:15

# 件名
🟡 a-tree-002 Phase D §1 D-01 Schema migrations 即着手 GO（5/12 朝予定が 5/13 朝に 1 日滞留、デモ延期 = 全完走後モード、至急進める）

# A. 至急モード通知
東海林さん 5/13 10:14 明示: 「デモ延期、全完走後デモ」「至急進めましょう」。tree-002 No. 33 β 採用（5/12 朝着手）が 5/13 朝に滞留 = 即着手 GO。

# B. tree-002 No. 33 §F 想定タスク順序（再掲、5/13 朝-午前で完走想定）
| 順 | タスク | 工数 | 5/13 ETA |
|---|---|---|---|
| 1 | spec D-01 soil 参照修正 別 PR 起票（feature/tree-spec-d01-soil-mismatch-fix-20260513）| 0.5h | 10:30-11:00 |
| 2 | §1 D-01 schema types generation | 0.5h | 11:00-11:30（要 supabase CLI、東海林さん経由可能性）|
| 3 | §1 D-01 Vitest unit test 設計 + 実装 | 2-3h | 11:30-14:30 |
| 4 | §1 D-01 RLS 動作確認 | 0.5h | 14:30-15:00 |
| 5 | §1 完走報告 + §2 D-06 Test scaffolding 着手 | 0.25h | 15:00-15:15 |

# C. spec mismatch 注意点（再掲、Bud Phase D 教訓継承）
root_employees 実 32 列確定（東海林さん Supabase Studio Run 結果 CSV 5/11 21:18 受領）:
- employee_id (text PK) / employee_number (text UNIQUE PR #157) / user_id (uuid 26 列目) / garden_role (text 27 列目) / deleted_at (timestamptz 32 列目) / is_active (boolean 22 列目) 全て存在
- last_name / first_name / department_id は **不在**
- Bud Phase D で発覚した列混同（employee_id "EMP-NNNN" ≠ employee_number "NNNN"）に注意、Tree D-01 でも cross_rls_helpers 経由 RLS で同パターン回避

# D. PR 起票方針
| 項目 | 内容 |
|---|---|
| base | develop |
| head 1 | feature/tree-phase-d-01-types-vitest-20260513（types gen + Vitest 主体）|
| head 2 | feature/tree-spec-d01-soil-mismatch-fix-20260513（soil 参照修正、別 PR）|
| 起票タイミング | 各 task 完走後 |
| review 経路 | a-bloom-006 → admin merge |

# E. ACK 形式（tree-002- No. 34）
| 項目 | 内容 |
|---|---|
| 1 | # 341 受領確認 |
| 2 | 5/13 朝-午前で完走 ETA 承認 or 修正提案 |
| 3 | spec mismatch 修正 別 PR 起票 ETA |
| 4 | §1 完走報告 + §2 D-06 着手 ETA |

# F. 緊急度
🟡 通常（Tree §17 最厳格 + 品質要件、ただし 1 日滞留解消優先）

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 10:15（powershell.exe Get-Date 取得済、2026-05-13 水曜）
- [x] 番号 = main- No. 341（v6 規格 +1 厳守）
- [x] A 至急 / B タスク順 / C spec mismatch / D PR / E ACK / F 緊急度
~~~

---

## 詳細（参考、投下対象外）

### 連動
- tree-002 No. 33（β 採用 + spec mismatch 突合せ + 5/12 朝着手 ETA）
- main- No. 337（Tree Phase D §1 D-01 ガンガン本質 5/11 中夜間着手歓迎）
- main- No. 326（Tree §1 5/12 朝採用 + plan 精読任意）
- 東海林さん 5/13 10:14 「至急進めましょう」
