# dispatch main- No. 269 — a-tree-002 へ Tree D-01 apply 失敗報告 + a-root-002 連携通知 + spec §3 改訂可否確認 + Phase D §0 着手保留継続

> 起草: a-main-022
> 用途: Tree D-01 apply Run 失敗（42830 invalid_foreign_key）報告 + 案 A 採択（root_employees.employee_number に UNIQUE 制約追加）+ a-root-002 migration 起草中通知 + Tree D-01 spec §3 前提誤り改訂可否
> 番号: main- No. 269
> 起草時刻: 2026-05-11(月) 15:50

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟡 main- No. 269
【a-main-022 から a-tree-002 への dispatch（Tree D-01 apply 失敗報告 + a-root-002 連携通知 + spec §3 改訂可否 + Phase D §0 着手保留継続）】
発信日時: 2026-05-11(月) 15:50

# 件名
Tree D-01 apply Run 失敗（42830 FK 一意制約エラー）+ 真因 = spec §3 前提誤り（employee_number = PK 想定 / 実際は employee_id が PK）+ **案 A 採択**（root_employees.employee_number に UNIQUE 制約追加、a-root-002 が migration 起草中）+ Tree D-01 spec §3 / §3.1 改訂可否確認 + Phase D §0 着手保留継続

# A. Tree D-01 apply 失敗の実態

a-main-021 期（5/11 14:30 頃）、Chrome MCP 経由で Supabase SQL Editor に Tree D-01 migration (30,993 chars) 貼付 → 東海林さん Run 押下 → 以下エラーで失敗:

エラーコード: 42830 invalid_foreign_key
エラーメッセージ: 「参照テーブル『root_employees』に対して、指定されたキーに一致する一意制約がありません」

# B. 真因（a-main-022 確定）

a-tree-002 が起草した spec D-01 §3（および migration SQL コメント）:

> root_employees(employee_number text PK) が存在すること（Garden Root Phase A 完了）

しかし scripts/root-schema.sql の実態 (L99-100):
- employee_id text PRIMARY KEY ← 実際の PK
- employee_number text NOT NULL ← UNIQUE 制約**なし**

→ **spec §3 の前提誤り**（PK = employee_number と想定したが、実際は employee_id が PK、employee_number は NOT NULL のみ）。

Tree D-01 migration の FK 参照 3 箇所:
- L87: tree_calling_sessions.employee_id text NOT NULL REFERENCES root_employees(employee_number)
- L124: tree_call_records.employee_id text NOT NULL REFERENCES root_employees(employee_number)
- L202: tree_agent_assignments.employee_id text NOT NULL REFERENCES root_employees(employee_number)

PostgreSQL は UNIQUE/PK 制約のないカラムへの FK 参照を許可しない → 42830 発生。

# C. 東海林さん採択結果（案 A、5/11 15:30 GO）

選択肢 2 案:
- 案 A（推奨、採択）: root_employees.employee_number に UNIQUE 制約追加 migration を a-root-002 が起草 → Tree D-01 schema 改訂不要、業務意図（社内管理番号で参照）維持、他モジュール（Bud / Leaf 等）の将来 FK も employee_number 参照可
- 案 B（不採択）: Tree D-01 schema の FK 参照先 3 箇所を employee_id (PK) に変更 + spec §3 改訂

→ Garden 全体で「employee_number ベース横断 FK」方針確定、Tree D-01 schema 改訂不要。

# D. a-root-002 連携状況（main- No. 268 で投下中）

a-root-002 への依頼事項（main- No. 268 投下中）:
1. 既存データ重複検証（SELECT employee_number, COUNT(*) FROM root_employees GROUP BY employee_number HAVING COUNT(*) > 1;）
2. migration 起草（supabase/migrations/20260511000002_root_employees_employee_number_unique.sql、冪等化 + comment）
3. rollback 状態確認（Tree D-01 失敗時の新規テーブル痕跡確認）
4. PR 起票（a-bloom-006 review 依頼可）

a-root-002 完走 → 東海林さん apply → 完了通知後、a-tree-002 へ Tree D-01 再 apply 指示（main- No. 271+ 候補）。

# E. Tree D-01 spec §3 改訂可否確認（a-tree-002 判断要請）

spec §3 / §3.1 の前提記述:

> root_employees(employee_number text PK) が存在すること（Garden Root Phase A 完了）

→ この記述は**事実誤認**。修正候補:
- 候補 1: 「root_employees の employee_number 列（NOT NULL + UNIQUE 制約、別 migration で追加）が存在すること」
- 候補 2: PK 記述削除 + 「Garden Root Phase A-3-i (新規) で UNIQUE 制約追加完了」を併記
- 候補 3: 「Tree D-01 schema は employee_number 参照 = root_employees 側に UNIQUE 制約必須、別 migration (20260511000002_root_employees_employee_number_unique.sql) で先行投入」明記

判断: 候補 1 / 候補 2 / 候補 3 / その他 a-tree-002 推奨案 / 改訂不要（PR 履歴で trace されているので spec 直し不要）から a-tree-002 推奨案を選定 + 改訂可否を main 経由で東海林さんへ報告。

# F. Phase D §0 着手保留継続

| 順 | アクション | 状態 |
|---|---|---|
| 1 | a-root-002 重複検証 + UNIQUE migration 起草 + PR 起票 | ⏳ 進行中（main- No. 268 投下中）|
| 2 | a-bloom-006 review + PR merge | ⏳ |
| 3 | 東海林さん Chrome MCP で UNIQUE migration apply | ⏳ |
| 4 | Tree D-01 再 apply（東海林さん Chrome MCP）| ⏳ |
| 5 | a-tree-002 Phase D §0 Pre-flight Task 0 着手 GO（main- No. 272+ 候補）| ⏳ |

→ a-tree-002 は Phase D §0 着手を Step 5 GO 受領まで継続待機。並行で plan v3.1 (PR #153) review コメント検出時 即対応 + spec §3 改訂可否報告。

# G. 緊急度

🟡 中（apply failure は critical path だが、a-root-002 起草中で a-tree-002 即時アクションは spec §3 改訂可否確認のみ）

# H. 報告フォーマット（tree-002- No. 29 以降）

冒頭 3 行（🟡 tree-002- No. 29 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

軽量 ACK で済む場合（受領 + 待機継続）は tree-002- No. 29-ack 表記。

# I. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: apply 失敗の実態（コード + メッセージ）
- [x] B: 真因（spec §3 前提誤り + scripts/root-schema.sql 実態）
- [x] C: 案 A 採択結果
- [x] D: a-root-002 連携状況（main- No. 268 投下中）
- [x] E: spec §3 改訂可否確認（候補 3 + a-tree-002 推奨案歓迎）
- [x] F: Phase D §0 着手保留継続 + 5 step trace
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 269（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 採択判定の経緯（東海林さん発言タイムライン）

| 時刻 | 発信元 | 内容 |
|---|---|---|
| 5/11 14:30 頃 | 東海林さん（Chrome MCP Run）| Tree D-01 apply Run 押下 → 42830 エラー受領 |
| 5/11 15:10 | a-main-021 → 022 引越し | handoff §5 真因推定 |
| 5/11 15:50 | a-main-022 | 真因確定 + 案 A 推奨提示 |
| 5/11 15:55 | 東海林さん | 「A GO」明示 |

### 2. a-tree-002 への期待アクション（軽量）

- spec §3 改訂可否報告（候補 1-3 から選定 or 改訂不要判定）
- 受領 ACK（tree-002- No. 29-ack 形式 OK）
- Phase D §0 着手は Step 5 GO 待ち

### 3. 投下後の流れ（参考）

1. a-tree-002 受領 → spec §3 改訂可否判定（軽量 ACK or 改訂提案）
2. a-root-002 完走（UNIQUE migration apply）→ Tree D-01 再 apply → Tree D-01 schema 完成
3. Phase D §0 着手 GO → Phase D 70 task 着手
