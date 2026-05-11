# dispatch main- No. 268 — a-root-002 へ Tree D-01 apply エラー診断 + employee_number UNIQUE 制約追加 migration 起草依頼（案 A 採択）

> 起草: a-main-022
> 用途: Tree D-01 apply エラー（42830 invalid_foreign_key）の構造的修正、root_employees.employee_number への UNIQUE 制約追加 migration 起草 + PR 起票依頼
> 番号: main- No. 268
> 起草時刻: 2026-05-11(月) 15:50

---

## 投下用短文（東海林さんがコピー → a-root-002 にペースト）

~~~
🔴 main- No. 268
【a-main-022 から a-root-002 への dispatch（Tree D-01 apply エラー診断 + employee_number UNIQUE 制約追加 migration 起草依頼、案 A 採択）】
発信日時: 2026-05-11(月) 15:50

# 件名
Tree D-01 apply Run 失敗（42830 FK 一意制約エラー）真因確定 + 東海林さん **案 A 採択** = root_employees.employee_number に UNIQUE 制約追加 migration 起草依頼 + 既存データ重複検証 + rollback 状態確認 + PR 起票

# A. Tree D-01 apply 失敗の実態

a-main-021 期（5/11 14:30 頃）、Chrome MCP 経由で Supabase SQL Editor に `supabase/migrations/20260427000001_tree_phase_d_01.sql` (30,993 chars) 貼付 → 東海林さん Run 押下 → 以下エラーで失敗:

エラーコード: 42830 invalid_foreign_key
エラーメッセージ: 「参照テーブル『root_employees』に対して、指定されたキーに一致する一意制約がありません」

# B. 真因（a-main-022 確定）

scripts/root-schema.sql L99-100:
- employee_id text PRIMARY KEY ← 実際の PK
- employee_number text NOT NULL ← UNIQUE 制約**なし**

Tree D-01 schema は FK 参照先を employee_number にしている（コメントは「root_employees(employee_number text PK) が存在すること」と前提誤認）:
- L87: tree_calling_sessions.employee_id text NOT NULL REFERENCES root_employees(employee_number)
- L124: tree_call_records.employee_id text NOT NULL REFERENCES root_employees(employee_number)
- L202: tree_agent_assignments.employee_id text NOT NULL REFERENCES root_employees(employee_number)

PostgreSQL は UNIQUE/PK 制約のないカラムへの FK 参照を許可しない → 42830 発生。

# C. 東海林さん採択結果（案 A、5/11 15:30 GO）

選択肢 2 案:
- 案 A（推奨、採択）: root_employees.employee_number に UNIQUE 制約追加 → Tree spec 改訂不要、業務意図（社内管理番号で参照）維持、他モジュール（Bud / Leaf 等）の将来 FK も employee_number 参照可
- 案 B（不採択）: Tree D-01 schema の FK 参照先を employee_id (PK) に変更

→ Garden 全体で「employee_number ベース横断 FK」方針確定。

# D. 依頼事項（4 件）

## D-1. 既存データ重複検証（migration 起草前）

実行 SQL:
- SELECT employee_number, COUNT(*) FROM root_employees GROUP BY employee_number HAVING COUNT(*) > 1;

結果 0 件 = UNIQUE 制約追加可能。重複あり = 重複データの手当て必要（東海林さんへ判断仰ぎ）。

## D-2. migration 起草

ファイル: supabase/migrations/20260511000002_root_employees_employee_number_unique.sql

内容（冪等化）:
1. ALTER TABLE public.root_employees DROP CONSTRAINT IF EXISTS root_employees_employee_number_unique;
2. ALTER TABLE public.root_employees ADD CONSTRAINT root_employees_employee_number_unique UNIQUE (employee_number);
3. COMMENT ON CONSTRAINT root_employees_employee_number_unique ON public.root_employees IS '社内管理番号は重複不可。Tree D-01 / 他モジュール横断 FK 参照のための前提。';

確認クエリ（手動実行用、コメントで添付）:
- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.root_employees'::regclass AND conname LIKE '%employee_number%';

## D-3. rollback 状態確認

Tree D-01 apply 失敗時、PostgreSQL は CREATE TABLE 失敗で transaction 単位の自動 rollback 想定だが、念のため新規テーブル痕跡確認:

実行 SQL:
- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE 'tree_calling%' OR tablename = 'tree_call_records' OR tablename LIKE 'tree_agent%');

結果 0 件 = 完全 rollback、Tree D-01 再 apply 可能。痕跡あり = DROP TABLE 必要（要 root-002 判断 + dispatch 経由報告）。

## D-4. PR 起票

migration 起票 + push 後、PR 起票:
- PR title: feat(root): root_employees.employee_number UNIQUE 制約追加（Tree D-01 / 横断 FK 参照基盤）
- branch: feature/root-employee-number-unique
- base: develop
- a-bloom-006 へ review 依頼可（migration + spec 整合性 + 既存データ影響）

# E. Phase D 待機状況

a-tree-002 は Phase D §0 Pre-flight Task 0 着手を本 migration apply 完了まで保留中（main- No. 269 で通知済）。

# F. 緊急度

🔴 高（コールセンター Tree Phase D 着手の critical path、後道さんデモ前 5/12 までに完走目標）

# G. 報告フォーマット（root-002- No. 40 以降）

冒頭 3 行（🔴 root-002- No. 40 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

軽量 ACK で済む場合（受領のみ）は root-002- No. 40-ack 表記。

# H. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: apply 失敗の実態（コード + メッセージ）
- [x] B: 真因（scripts/root-schema.sql L99-100 root cause 特定）
- [x] C: 東海林さん採択結果 = 案 A
- [x] D-1: 既存データ重複検証 SQL 明示
- [x] D-2: migration 起草仕様（冪等化 + comment + 確認クエリ）
- [x] D-3: rollback 状態確認 SQL 明示
- [x] D-4: PR 起票仕様
- [x] E: Phase D 待機状況 明示
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 268（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 採択判定の経緯（東海林さん発言タイムライン）

| 時刻 | 発信元 | 内容 |
|---|---|---|
| 5/11 14:30 頃 | 東海林さん（Chrome MCP Run）| Tree D-01 apply Run 押下 → 42830 エラー受領 |
| 5/11 15:10 | a-main-021 → 022 引越し | handoff §5 真因推定（root_employees 側の UNIQUE 制約欠落） |
| 5/11 15:50 | a-main-022 | 真因確定（scripts/root-schema.sql 確認、employee_id が PK、employee_number に UNIQUE なし） |
| 5/11 15:55 | 東海林さん | 「A GO」明示 |

### 2. 案 A の業務的メリット（参考）

- 「社内管理番号」（employee_number）は人間が読みやすい識別子（例: 0001 / 0042 等）
- 業務担当者は社内管理番号で本人特定するため、FK 参照も社内管理番号ベースが自然
- 他モジュール（Bud 給与処理 / Leaf 案件管理 / Forest 経営指標）の将来 FK 参照も同一ルールで横展開可
- PK = employee_id (EMP-XXXX) は内部識別子、UI / 業務的可視性は employee_number

### 3. リスク確認

| リスク | 対処 |
|---|---|
| 既存データに重複 | D-1 の検証 SQL で事前確認、重複あり = 東海林さん判断仰ぎ |
| 既存 RLS / VIEW / FK で employee_number に依存する箇所 | 既存 grep で確認、影響あり = 改訂方針併記 |
| 本番 (garden-prod) 適用順序 | 現状 garden-dev のみ、本番適用は Phase A 全完了後にまとめて（既ルール）|

### 4. 投下後の流れ（参考）

1. a-root-002 受領 → D-1 重複検証実行 → 結果 a-main へ報告（root-002- No. 40 候補）
2. 重複 0 件 = migration 起草 + PR 起票 → a-bloom-006 review 依頼可
3. PR merge → 東海林さん Chrome MCP で apply → 完了報告
4. 完了通知後 a-tree-002 へ Tree D-01 再 apply 指示（main- No. 271+ 候補）
5. Tree D-01 apply 完了 → a-tree-002 Phase D §0 Pre-flight Task 0 着手 GO（main- No. 272+ 候補）
