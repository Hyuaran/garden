# dispatch main- No. 332

- 発信日時: 2026-05-11(月) 21:55
- 発信元: a-main-024
- 投下先: **a-bud-002**
- 緊急度: 🔴（最緊急、MFC 解約路 critical path、5/11 中夜間着手 or 5/12 朝着手を Bud 側判断）
- 添付: なし
- 関連: handoff a-main-023→024 §3 / §4 / §5、a-main-023 期 # 327（RLS exists 縮退完走、最終 commit f8a52b1）

---

## 件名

Bud Phase D 全件 root_employees cross-check + 一括修正（5/12 中本番運用 → MFC 解約路 critical）

## ガンガン本質適用通知

handoff §11 で「5/12 朝着手」と書かれていたが、ガンガン本質「5h 枠フル活用 + 東海林作業時間無視」で **5/11 中夜間着手を歓迎**。Bud 側の context 余力に応じて以下のいずれか判断:

| 案 | 内容 |
|---|---|
| α | 5/11 中夜間着手（cross-check 開始 → 5/12 朝までに修正版起票完了想定）|
| β | 5/12 朝着手（plan 通り、Bud context 不足の場合）|

判断は Bud 側で OK。即着手可なら GO、不可なら 5/12 朝で OK。

## 背景（最重要）

a-main-023 期 Bud Phase D apply は **v2→v6 まで 5 回連続別エラー**でモグラ叩き状態:

| 版 | 修正 | 結果 |
|---|---|---|
| v2 | id → employee_id/company_id + uuid → text + RLS subquery + function body 26 箇所 | ❌ target.id 残存 |
| v3 | target.id 1 件追加 | ❌ viewer.department_id 残存 |
| v4 | Pattern 1+2 機械置換 | ❌ 残課題 |
| v5 | RLS exists 縮退 → has_role_at_least 採用 43 件 | ❌ **e.last_name 不在発覚** |
| v6+ | (未着手) | 本 dispatch で全件 cross-check |

**真因**: Bud Phase D 13 migration の root_employees 参照が **実 21 列と全件不整合**。1 件ずつ修正は時間切れ確実。

## タスク

### Step 1: root_employees 実列確認（既知）

a-main-024 が REST 経由で確認済（21 列）。以下リスト:

```
id (uuid PK)
employee_number (text UNIQUE、PR #157 で追加)
auth_user_id (uuid)
display_name (text)
employment_type
company_id (uuid)
hire_date
... (合計 21 列)
```

※ 完全列リストは Bud 側で `information_schema.columns WHERE table_name = 'root_employees'` 実行 or REST 確認お願いします。

### Step 2: Bud Phase D 13 migration の root_employees 参照を grep

以下パターンを 13 migration 全件で検出:

```
\.user_id
\.garden_role
\.deleted_at
\.department_id
\.last_name
\.first_name
\.id\b
```

検出結果を**不在列リスト**として確定。

### Step 3: 一括修正版起票

不在列ごとに修正方針確定:

| 不在列 | 想定修正 |
|---|---|
| user_id | auth_user_id |
| garden_role | role（root_user_roles 経由）|
| deleted_at | （論理削除なし、削除）|
| department_id | （該当列なし、別 join 経路）|
| last_name / first_name | display_name |
| id | 既存維持（PK）|

13 migration 全件を一括修正 → push。

### Step 4: a-main-024 が merged SQL v6 生成 → Supabase Run（1 回完走想定）→ REST 検証 + 仕訳帳動作確認 → 5/12 中本番運用着地

## 期待動作

a-bud-002 は:

- A. α 即着手判断 → Step 1-3 を夜間で実施 → 5/11 中 or 5/12 朝早朝に push 完了報告
- B. β 5/12 朝着手判断 → 5/12 朝 09:00 着手 → 午前中完走
- C. 詰まり / 判断仰ぎ → 即報告

## return 形式

a-main コピペ用 dispatch 形式（~~~ ラップ + 番号 + 発信日時 + 表形式中心）で返信お願いします。

## self-check

- [x] 冒頭 v5 ヘッダー
- [x] 既存実装把握済（a-main-023 期 v2-v5 全履歴 + f8a52b1 内容）
- [x] ガンガン本質適用通知（5/11 夜 / 5/12 朝 両許容）
- [x] return 形式明示
- [x] 緊急度 🔴 + MFC 解約路 critical 明示

---

投下完了したら『332投下済』で OK 返信ください。
