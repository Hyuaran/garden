~~~
🟡 main- No. 238
【a-main-020 から a-tree-002 への dispatch】
発信日時: 2026-05-11(月) 11:37

# 件名
Batch 7 関数 PR #154 起票完了 + Tree D-01 spec §4.1 改訂依頼（is_same_department 縮退 → 「自分担当 only」）

# 1. 経緯

a-root-002 が main- No. 233 受領 → root-002-38（2026-05-11 12:05）で Batch 7 cross-rls-helpers migration + spec 改訂 + PR #154 起票完了:

| 関数 | 実装 |
|---|---|
| auth_employee_number() | ✅ 実装、SECURITY DEFINER + root_employees join |
| has_role_at_least(role_min text) | ✅ 実装、8 段階ロール階層判定（toss < closer < cs < staff < outsource < manager < admin < super_admin）|
| is_same_department(...) | ❌ 縮退（Q2 (b) 採用、root_employees.department_id 列なし + マスタなしのため別 Phase）|

# 2. Tree D-01 spec §4.1 改訂依頼

is_same_department 縮退に伴い、Tree D-01 spec を改訂:

## 2-1. 改訂対象ファイル
`docs/specs/tree/spec-tree-phase-d-01-schema-migration.md`

## 2-2. 改訂内容

| 旧（is_same_department 使用） | 新（縮退、「自分担当 only」） |
|---|---|
| USING (has_role_at_least('manager') AND is_same_department(employee_id)) | USING (has_role_at_least('manager') AND employee_id = auth_employee_number()) |
| マネージャー部署絞込 | 「自分担当 only」（auth.uid() = assigned_employee_id 等、Tree 用途固有のキー指定）|

将来の再導入条件:
- root_employees.department_id 列追加（schema 拡張）
- root_departments マスタテーブル新規作成
- department 運用ルール確定（異動 / 複数所属 等）

→ 上記が満たされた段階で `is_same_department` 再実装、Tree D-01 spec §4.1 を「自分担当 only」→「マネージャー部署絞込」に戻す。

## 2-3. 改訂タイミング

a-tree-002 自走で plan v3.1 既起票 PR #153 と同 PR or 別 PR で実施可:
- 同 PR: PR #153 base / head 変更で D-01 spec 改訂を含める
- 別 PR: PR #155 候補で D-01 spec 単独改訂

a-tree-002 の判断で決定。

# 3. PR #154 a-bloom-006 レビュー依頼（main 経由、main- No. 241 候補）

a-bloom-006 に PR #154 (Batch 7 cross-rls-helpers migration) レビュー依頼を main- No. 241 で発行予定。

a-tree-002 は PR #154 レビュー + merge 完了後、garden-dev / garden-prod に apply 反映 → Tree D-01 schema apply 可能化。

# 4. Phase D §0 着手前提条件 更新

| 前提 | 状態 |
|---|---|
| Phase D plan v3.1 確定 | ✅ PR #153 起票済 |
| 急務 3 件判断保留 | ✅ 確定（D-02-判2 / D-04-判4 / D-06-判6）|
| 残り 36 件判断保留 | 🟡 実装着手と並行で順次解消 |
| worktree 環境 | ✅ B 案復帰完了 |
| PR #31（Phase D 6 spec）develop merge | ✅ 既 merge（root-002-38 確認）|
| Batch 7 cross-cutting 関数 Supabase apply | 🟡 PR #154 起票済、merge + apply 後解消予定 |
| Tree D-01 spec §4.1 改訂（is_same_department 縮退） | 🟡 本 dispatch で改訂依頼 |

→ Tree D-01 spec 改訂 + Batch 7 関数 apply 完了で、Phase D §0 Pre-flight Task 0 着手可能。

# 5. 報告フォーマット（tree-002- No. 22）

冒頭 3 行（🟢 tree-002- No. 22 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
Tree D-01 spec §4.1 改訂完了 + PR 起票（or PR #153 統合）+ Phase D §0 着手準備状況

### 改訂内容
- 改訂前 / 改訂後 対比
- 改訂方針: 同 PR #153 or 別 PR #155

### PR 起票
- PR 番号 / URL / branch / base / title

### Phase D §0 Pre-flight 着手準備
- Batch 7 関数 apply 完了確認 → 着手 OK 報告予定

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用

# 6. 緊急度

🟡 中（Tree Phase D 着手前提条件解消、PR #154 apply と並行進行可）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] PR #154 状況 + spec 改訂内容明示
- [x] 改訂タイミング選択肢（同 PR vs 別 PR）明示
- [x] Phase D §0 着手前提条件 状態表明示
- [x] 報告フォーマット雛形提示
- [x] 番号 = main- No. 238（counter 継続）
~~~
