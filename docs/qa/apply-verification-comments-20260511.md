# Apply 検証 補完コメント案（PR #154 / #157 / #162）

> 起草: a-root-003 (root-003- No. 60-ack → No. 61)
> 起草日時: 2026-05-11(月) 21:15
> 目的: A-RP-1 §4「apply 完了」3 点併記要件への遡及補完
> 関連: main- No. 312 broadcast / root-003- No. 56（遡及検証レポート）/ main- No. 329（補完起草 GO）
> 実行: main 承認後、a-root-003 が `gh pr comment <N> --body-file ...` で投下

---

## A. 補完コメントの共通書式

各 PR で以下の構造で投下:

````markdown
## 📌 Apply 完了履歴（A-RP-1 §4 遡及補完）

main- No. 312 broadcast「feedback_migration_apply_verification (A-RP-1) 7 項目」内化に伴い、本 PR の **apply 完了時の 3 点併記（検証手段 + 検証時刻 + 検証者）** を遡及補完します。

### 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | <Method A/B/C 該当> |
| 検証時刻 | <YYYY-MM-DD HH:MM JST> |
| 検証者 | <氏名 or session> |

### 補足

- **記録源泉**: <main- No. NNN / handoff / 他根拠>
- **記録の精度**: <時刻精度 / 推定の度合い>
- **補完起草経緯**: A-RP-1 (memory `feedback_migration_apply_verification`) 5/11 制定、PR merge 時には未制定だったため遡及補完。今後の Root PR では merge 直後 5 分以内の 3 点併記を厳守。

🤖 起草: a-root-003 (Claude Code) / 承認: a-main-023 / 投下: a-root-003 (gh pr comment)
````

---

## B. PR #154 — cross-cutting RLS helpers (auth_employee_number + has_role_at_least)

### 補完コメント案

````markdown
## 📌 Apply 完了履歴（A-RP-1 §4 遡及補完）

main- No. 312 broadcast「feedback_migration_apply_verification (A-RP-1) 7 項目」内化に伴い、本 PR の **apply 完了時の 3 点併記（検証手段 + 検証時刻 + 検証者）** を遡及補完します。

### 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | **Method A 推定**（Supabase Dashboard SQL Editor 直接実行 + `SELECT auth_employee_number();` / `SELECT has_role_at_least('staff');` の動作確認）|
| 検証時刻 | **2026-05-11 13:00 頃 JST**（main- No. 259 起票 5/11 13:02 以前、具体時刻未記録）|
| 検証者 | **東海林さん**（Supabase Studio 実行者）|

### 補足

- **記録源泉**: a-root-002 期 dispatch chain（main- No. 259 = 「PR #154 apply 完了通知受領」）+ a-root-002 → a-root-003 handoff §3「PR #154 merge 後 Supabase apply 完了通知受領（main 経由）」
- **記録の精度**: 時刻精度は **±30 min 程度の推定**（main- No. 259 起票時刻 13:02 から逆算）、具体的な実行時刻は記録不在
- **動作確認の根拠**: PR #154 description Test plan 内「SELECT auth_employee_number(); で employee_number 取得 / SELECT has_role_at_least('staff'); で role 比較」（東海林さんが起票後に実行）
- **追跡性**: 本コメント以降、`auth_employee_number()` / `has_role_at_least()` は Tree D-01 RLS (PR #156 reissue + PR #128) / Garden RLS template (PR #163) 等で活用されており、apply 不在では成立しない既存実装が存在
- **補完起草経緯**: A-RP-1 (memory `feedback_migration_apply_verification`) 5/11 制定、PR merge 時 (5/11 13:02) には未制定だったため遡及補完。今後の Root PR では merge 直後 5 分以内の 3 点併記を厳守。

🤖 起草: a-root-003 (Claude Code) / 承認: a-main-023 / 投下: a-root-003 (gh pr comment)
````

---

## C. PR #157 — root_employees.employee_number UNIQUE 制約

### 補完コメント案

````markdown
## 📌 Apply 完了履歴（A-RP-1 §4 遡及補完）

main- No. 312 broadcast「feedback_migration_apply_verification (A-RP-1) 7 項目」内化に伴い、本 PR の **apply 完了時の 3 点併記（検証手段 + 検証時刻 + 検証者）** を遡及補完します。

### 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | **Method C（functional roundtrip）**: Tree D-01 schema 再 Run（`20260427000001_tree_phase_d_01.sql`）成功 = `root_employees.employee_number` への FK 参照が成立 → 本 PR の UNIQUE 制約が確実に apply 済を実証 |
| 検証時刻 | **2026-05-11 17:00 JST**（main- No. 291 報告「Tree D-01 apply ✅ 完了（5/11 17:00）」）|
| 検証者 | **東海林さん**（Tree D-01 再 Run 実施者、main- No. 291 経由）|

### 補足

- **記録源泉**: main- No. 291（5/11 17:10、a-main-023 起票）「Tree D-01 apply 完全成功、真因 = root_employees.employee_number UNIQUE 未適用、解消手段 = migration 20260511000002 即 apply（5 分）」
- **記録の精度**: 時刻精度は **5/11 17:00 ちょうど**（main- No. 291 §A 明示）
- **検証の確実性**: Method C により functional roundtrip 成功（Tree D-01 schema apply が FK 制約「FK 参照先は UNIQUE/PK 必須」を満たして成立）、本 PR の SQL 適用が事実上不可避
- **事前確認 SQL**:
  - D-1（重複 0 件確認）: SELECT employee_number, COUNT(*) FROM public.root_employees GROUP BY employee_number HAVING COUNT(*) > 1; → 0 行
  - D-3（Tree D-01 rollback 痕跡 0 件確認）: 同 main- No. 291 で実施済
- **補完起草経緯**: A-RP-1 (memory `feedback_migration_apply_verification`) は **本 PR の apply 漏れ事故が契機で制定された**（Tree D-01 が 14:30 に 42830 invalid_foreign_key で失敗 → 17:00 解消）。本 PR は事故の「真因」であり、今後の apply 検証ルールの源流。

🤖 起草: a-root-003 (Claude Code) / 承認: a-main-023 / 投下: a-root-003 (gh pr comment)
````

---

## D. PR #162 — super_admin 権限を東海林さん本人専任に固定 (Task 5)

### 補完コメント案

````markdown
## 📌 Apply 完了履歴（A-RP-1 §4 遡及補完）

main- No. 312 broadcast「feedback_migration_apply_verification (A-RP-1) 7 項目」内化に伴い、本 PR の **apply 完了時の 3 点併記（検証手段 + 検証時刻 + 検証者）** を遡及補完します。

### 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | **Method A 推定**（Supabase Dashboard SQL Editor で `scripts/garden-super-admin-lockdown.sql` 直接実行 + 同ファイル末尾の確認クエリ `SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_prevent_super_admin_role_change','trg_prevent_super_admin_insert');` で trigger 2 件作成確認）|
| 検証時刻 | **2026-05-11 18:00 頃 JST**（main- No. 313 §E 報告「SQL apply 完了（5/11 18:00 頃 東海林さん Run）」、精度 ±10 min）|
| 検証者 | **東海林さん**（Supabase Studio 実行者、main- No. 313 経由）|

### 補足

- **記録源泉**: main- No. 313（5/11 18:42、a-main-023 起票）§E「Task 5 (super_admin) ✅ #162 merged + SQL apply 完了（5/11 18:00 頃 東海林さん Run）」
- **記録の精度**: 時刻精度は **18:00 頃 ±10 min**（main- No. 313 表記、具体時刻未記録）
- **動作確認の根拠（本 PR description Test plan 内）**:
  - garden-dev で authenticated session UPDATE で SQLSTATE 42501 確認
  - service_role バイパスが成功すること
  - 既存 super_admin (employee_number=0008、東海林さん本人) が変更されていないこと
- **追加検証推奨（Method C）**: 本コメント以降、新規 garden_role UPDATE / INSERT の動作テスト（authenticated session で `UPDATE root_employees SET garden_role='super_admin' WHERE employee_number='9999';` → 42501 確認）を実施することで **Method A + Method C のクロス検証** が可能。Task 6 (Vitest + E2E) で本検証を含める方向で検討中
- **補完起草経緯**: A-RP-1 (memory `feedback_migration_apply_verification`) 5/11 制定、PR merge (5/11 18:32) と apply (5/11 18:00 頃) のタイミング前後関係から PR description に 3 点併記が未記録だったため遡及補完。今後の Root PR では merge 直後 5 分以内の 3 点併記を厳守。

🤖 起草: a-root-003 (Claude Code) / 承認: a-main-023 / 投下: a-root-003 (gh pr comment)
````

---

## E. 投下手順（main 承認後の実行）

### Step 1: 3 PR それぞれに対応する body 抜粋ファイルを作成

```bash
# 1) PR #154 用 body 抜粋
awk '/^### 補完コメント案/{flag=NR+2; next}flag && NR<=flag+50' \
  docs/qa/apply-verification-comments-20260511.md > /tmp/pr-154-comment.md

# 同様に #157 / #162 用も作成
```

(実際は md 内の各セクションの「補完コメント案」`````markdown` ブロック内容のみを抽出して body ファイル化、または手動で 3 ファイルにコピー)

### Step 2: 3 PR に gh pr comment で投下

```bash
gh pr comment 154 --body-file /tmp/pr-154-comment.md
gh pr comment 157 --body-file /tmp/pr-157-comment.md
gh pr comment 162 --body-file /tmp/pr-162-comment.md
```

### Step 3: 投下結果確認 + 完了報告

```bash
# 各 PR の comment URL を取得して main へ完了報告
gh pr view 154 --json comments --jq '.comments[-1].url'
gh pr view 157 --json comments --jq '.comments[-1].url'
gh pr view 162 --json comments --jq '.comments[-1].url'
```

main へ root-003- No. NN で投下完了 + 3 comment URL 報告。

---

## F. 承認判断ポイント（main へ）

| # | 論点 | 推奨 |
|---|---|---|
| 1 | 3 PR の補完コメント文言レビュー | 全文採用 GO（時刻精度の「推定」「±10 min」表記が誠実で A-RP-1 §4 準拠）|
| 2 | 「検証手段の推定」記述許容範囲 | Method A 推定 / 必要に応じて Method C クロス検証提案 = 採用 OK（実態に即した記述）|
| 3 | 投下タイミング | 5/11 中（Task 6 着手前）or 5/12 朝（Task 6 並行）、推奨 = **5/11 中**（A-RP-1 補完を Task 6 検証範囲に含めるため）|
| 4 | 投下後の sentinel 効果 | 今後の Root PR では merge 直後 5 分以内の 3 点併記を厳守する旨を本コメントに明記 |

→ main 承認受領 → a-root-003 が gh pr comment 実行。

---

## G. 改訂履歴

- 2026-05-11 21:15 v1.0 起草（a-root-003、root-003- No. 60-ack → No. 61）
