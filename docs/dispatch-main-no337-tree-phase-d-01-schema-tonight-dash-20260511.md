# dispatch main- No. 337 — a-tree-002 Phase D §1 D-01 Schema migrations 着手 GO (ガンガン本質 5/11 中夜間着手歓迎)

> 起草: a-main-024
> 用途: handoff §3 で「Phase D §1 D-01 Schema 5/12 朝着手 5.6h + spec mismatch 修正並行」と書かれていたが、ガンガン本質「5h フル + 東海林作業時間無視」適用で 5/11 中夜間着手歓迎。Tree 側 context 余力次第で α/β 判断。
> 番号: main- No. 337
> 起草時刻: 2026-05-11(月) 21:22（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟡 main- No. 337
【a-main-024 から a-tree-002 への dispatch（Phase D §1 D-01 Schema migrations、ガンガン本質 5/11 中夜間着手歓迎）】
発信日時: 2026-05-11(月) 21:22

# 件名
🟡 a-tree-002 Phase D §1 D-01 Schema migrations 着手 GO（handoff §3「5/12 朝着手 5.6h」予定 → ガンガン本質適用で 5/11 中夜間着手歓迎、Tree 側 context 余力次第で判断）

# A. ガンガン本質適用通知（# 332 / # 333 / # 336 と同パターン）
handoff §3 で「Tree §1 D-01 Schema 5/12 朝着手（5.6h）+ spec mismatch 修正並行」と書かれていたが、ガンガン本質「5h フル + 東海林作業時間無視」で **5/11 中夜間着手歓迎**。

| 案 | 内容 |
|---|---|
| α | 5/11 中夜間着手（D-01 Schema 5.6h、5/12 朝までに push 完了想定 = α 即着手で plan 5/12 朝前倒し）|
| β | 5/12 朝着手（plan 通り、Tree context 不足の場合）|

即着手可なら GO、不可なら 5/12 朝 OK。

# B. 直近状態
| 項目 | 値 |
|---|---|
| 直近 commit | Phase D 必要パッケージ追加（sonner / user-event / axe / lhci / k6、73 min 前）|
| Phase D §0 | ✅ 完全完走（npm install 5 種 + Task 2 effort 完了）|
| §1 D-01 Schema | 🟡 5.6h 想定（migration + types + Vitest + RLS template 適用）|
| spec mismatch 修正 | 🟡 並行進行（Tree D-01 plan v3 = PR #71 merge 済）|

# C. D-01 タスク内訳（plan §1 参照、α 採用時の夜間想定）
| Step | 内容 | 想定 |
|---|---|---|
| D-01 Schema migration | tree_calling_* テーブル群 + RLS（PR #163 統一 template 適用）| 2-3h |
| TypeScript types 生成 | supabase gen types → src/types/database.ts 更新 | 30 分 |
| Vitest 単体テスト | RLS 動作確認 + migration 関数 unit test | 1-2h |
| spec mismatch 修正並行 | Tree D-01 plan v3 + 実 root_employees 31 列との突合せ（Bud # 332-rep と同種、確認）| 1h |

→ α 採用時の合計: 約 5-7h（5/11 中夜間 + 5/12 早朝の組合せ可）。

# D. spec mismatch 注意点（Bud Phase D 教訓継承）
Bud Phase D で v2-v5 モグラ叩き発生原因 = root_employees 実列との不整合。Tree D-01 でも同種問題発生回避のため、Schema 起票前に **root_employees 実 31 列リストとの突合せ**推奨:

| 列名 | 実存 |
|---|---|
| employee_id (text PK) | ✅ 1 列目 |
| employee_number (text UNIQUE) | ✅ 2 列目（PR #157）|
| user_id (uuid) | ✅ 26 列目 |
| garden_role (text) | ✅ 27 列目 |
| deleted_at (timestamptz) | ✅ 32 列目 |
| last_name / first_name | ❌ 不在（name + name_kana に統合）|
| department_id | ❌ 不在（別 join 経路）|

→ Tree D-01 migration で root_employees 参照する場合、上記実列に整合性確認。

# E. ACK 形式（tree-002- No. 33）
| 項目 | 内容 |
|---|---|
| 1 | # 337 受領確認 |
| 2 | α / β 判断 + 着手 ETA |
| 3 | spec mismatch 突合せ結果（既知 or 新規発見）|
| 4 | Step 1-4 完走 ETA（5/12 朝想定 or 早朝想定）|

# F. PR 起票方針
| 項目 | 内容 |
|---|---|
| base | develop |
| head | feature/tree-phase-d-01-schema-{date} |
| 起票タイミング | Step 1-4 完走後 |
| review 経路 | a-bloom-006 (累計 19 PR review 完走、軽量 review 担当) → admin merge |

# G. 緊急度
🟡 通常（Phase D §1 着手 = Tree UI 移行 critical path ⑥ 進行）

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 21:22（powershell.exe Get-Date 取得済）
- [x] 番号 = main- No. 337（counter 337 → 338）
- [x] A ガンガン本質適用 / B 直近状態 / C D-01 タスク / D spec mismatch / E ACK / F PR / G 緊急度
~~~

---

## 詳細（参考、投下対象外）

### 連動
- handoff a-main-023→024 §3 / §4 (⑥ Tree UI 移行)
- a-tree-002 最新 commit (Phase D 必要パッケージ追加、73 min 前)
- main- No. 325 / 326 (Tree §1 5/12 朝採用 + plan 精読任意)
- 東海林さん Supabase Studio SQL Run 結果 CSV (root_employees 実 31 列、5/11 21:18 受領)
