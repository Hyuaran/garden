# Root B-03: 退職者扱い運用ルール 仕様書

- 対象: Garden-Root の退職者データ管理、各モジュールへの参照ルール統一
- 見積: **0.5d**（約 4 時間）
- 担当セッション: a-root
- 作成: 2026-04-25（a-root / Phase B spec 起草）
- 元資料: `docs/known-pitfalls.md` #8、Phase A-3-g / A-3-h migration コメント

---

## 1. 目的とスコープ

### 目的

`root_employees` の退職・削除関連フィールドが 4 本（`is_active` / `termination_date` / `contract_end_on` / `deleted_at`）に増えた結果、**どのフィールドをどの業務クエリで使うか**が各モジュール実装者に共有されていない。本 spec はその運用ルールを明文化し、Bud / Tree / Leaf / Forest の実装者が迷わず一貫したクエリを書けるようにする。

### 含める

- 4 フィールドの定義・軸の違い
- 既存関数 `is_user_active()` / `garden_role_of()` の挙動と用途
- 状態定義表（フィールド組み合わせ × 業務シナリオ）
- モジュール別クエリパターン（Bud / Tree / Leaf / Forest）
- RLS ポリシー統一方針
- 退職処理フロー（admin 操作手順）
- 完全削除フロー（super_admin 操作手順）
- 新規 helper 関数の仕様

### 含めない

- 従業員マスタ UI の変更（Root フェーズ B UI 別タスク）
- 個人情報保管ポリシーの法的解釈（東海林さんに確認が必要）
- 退職金計算ロジック（Bud 別タスク）

---

## 2. 既存実装との関係

### 2.1 4 フィールドの定義

| フィールド | 型 | デフォルト | 軸 | 意味 |
|---|---|---|---|---|
| `is_active` | `boolean` | `true` | **業務活性** | 現時点でアクティブな業務対象か（一時的な無効化含む、復帰可） |
| `termination_date` | `date \| null` | `null` | **退職日** | 正式退職日（給与計算の打切り日）。null なら在籍中 |
| `contract_end_on` | `date \| null` | `null` | **外注契約終了日** | `employment_type='outsource'` のみ利用。null なら継続中 |
| `deleted_at` | `timestamptz \| null` | `null` | **論理削除** | DB 上の存在フラグ。値ありは通常戻さない。監査・集計目的で行は残す |

#### 重要: is_active と deleted_at は独立した別軸

```
is_active = false → 業務上の非対象（退職済み・育休中等）だが DB には通常通り存在
deleted_at 有値  → レコードを全クエリから除外（個人情報保管期限切れ等の最終手段）
```

中途退職者は `is_active=false AND deleted_at=null` が正常状態。年末調整など履歴参照が必要なため `deleted_at` に値を入れてはならない。（known-pitfalls.md #8 参照）

### 2.2 既存関数の挙動

#### `is_user_active()` — Phase A-3-g で追加

```sql
-- ログインユーザーが「活動中」か否かを boolean で返す
-- RLS ポリシーから SECURITY DEFINER で安全に呼び出せる
SELECT EXISTS (
  SELECT 1 FROM root_employees e
  WHERE e.user_id = auth.uid()
    AND e.is_active = true
    AND (e.termination_date IS NULL OR e.termination_date > current_date)
    AND (
      e.employment_type <> 'outsource'
      OR e.contract_end_on IS NULL
      OR e.contract_end_on > current_date
    )
);
```

**注意**: 現バージョンは `deleted_at` を参照していない。本 spec で更新を提案する（§3 参照）。

#### `garden_role_of(uid uuid)` — Phase A-3-g で追加

```sql
-- 指定ユーザーの garden_role を返す（is_active=true のみ対象）
-- deleted_at は現バージョンで未参照（§3 で改修を提案）
SELECT garden_role FROM root_employees
  WHERE user_id = uid AND is_active = true
  LIMIT 1;
```

---

## 3. データモデル提案

### 3.1 既存スキーマの評価

現行スキーマは概ね十分。新規テーブルは不要。以下の 2 点のみ対応する：

1. **`is_user_active()` に `deleted_at IS NULL` を追加**（現バージョンの漏れを修正）
2. **新規 helper 関数 `is_employee_payroll_target()`** を追加（Bud 給与計算専用）

### 3.2 `is_user_active()` 更新案

```sql
-- Phase B-3 更新: deleted_at IS NULL を追加
CREATE OR REPLACE FUNCTION public.is_user_active()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.root_employees e
    WHERE e.user_id = auth.uid()
      AND e.is_active = true
      AND e.deleted_at IS NULL                    -- ★ 追加
      AND (e.termination_date IS NULL OR e.termination_date > current_date)
      AND (
        e.employment_type <> 'outsource'
        OR e.contract_end_on IS NULL
        OR e.contract_end_on > current_date
      )
  );
$$;
```

### 3.3 新規 helper: `is_employee_payroll_target(emp_id, target_month)`

Bud 給与計算用。`target_month` は集計月の初日（例: `'2026-05-01'`）。

条件: `deleted_at IS NULL AND is_active = true AND termination_date >= target_month（または null）AND contract_end_on >= target_month（外注のみ、または null）`

```sql
CREATE OR REPLACE FUNCTION public.is_employee_payroll_target(emp_id text, target_month date)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.root_employees e
    WHERE e.employee_id = emp_id
      AND e.deleted_at IS NULL AND e.is_active = true
      AND (e.termination_date IS NULL OR e.termination_date >= target_month)
      AND (e.employment_type <> 'outsource' OR e.contract_end_on IS NULL OR e.contract_end_on >= target_month)
  );
$$;
```

### 3.4 新規 helper: `get_nencho_targets(target_year)`

Bud 年末調整用。当年に在籍実績のある全従業員（中途退職者含む）を返す。`deleted_at IS NULL` のみ。

```sql
CREATE OR REPLACE FUNCTION public.get_nencho_targets(target_year int)
  RETURNS SETOF public.root_employees LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT * FROM public.root_employees e
  WHERE e.deleted_at IS NULL
    AND e.hire_date <= make_date(target_year, 12, 31)
    AND (e.termination_date IS NULL OR e.termination_date >= make_date(target_year, 1, 1))
    AND (e.employment_type <> 'outsource' OR e.contract_end_on IS NULL
         OR e.contract_end_on >= make_date(target_year, 1, 1));
$$;
```

---

## 4. 状態定義表

| 状態 | is_active | termination_date | contract_end_on | deleted_at | 該当ケース | 業務クエリでの扱い |
|---|---|---|---|---|---|---|
| 在籍中（正社員） | true | null | null | null | 通常社員 | 全画面で表示 |
| 在籍中（外注・継続） | true | null | 未来日 | null | 外注（契約継続中） | 全画面で表示（アクセス範囲はロール依存） |
| 在籍中（外注・期限なし） | true | null | null | null | 外注（期限未設定） | 全画面で表示 |
| 育休・休職中 | false | null | null | null | 一時的な無効化 | 業務一覧: 除外 / 給与: 休業期間は別計算 |
| 中途退職（当年） | false | 当年日付 | null | null | 年末調整対象あり | 給与計算: 退職日まで対象 / 年末調整: 含む |
| 中途退職（前年以前） | false | 前年日付 | null | null | 年末調整対象なし | 給与計算: 除外 / 年末調整: 当年は除外 / 履歴: 参照可 |
| 外注契約満了 | false | null | 過去日 | null | 外注の契約終了 | 業務一覧: 除外 / 履歴参照: 含む |
| 退職＋外注満了（両方） | false | 過去日 | 過去日 | null | 外注が退職日も設定 | 業務一覧: 除外 / 履歴: 含む |
| 完全削除（論理削除） | false | * | * | 値あり | 個人情報保管期限切れ | **全クエリで除外**（UI から見えない） |
| 完全削除（在籍中から） | true | null | null | 値あり | 誤登録等の削除 | **全クエリで除外** |

### 4.1 フィールド組み合わせの制約

| ルール | 内容 |
|---|---|
| R1 | `deleted_at` に値を設定するのは super_admin のみ（完全削除フロー §9 参照） |
| R2 | 退職処理時は `termination_date` を設定後、`is_active = false` に変更する（順序重要） |
| R3 | `contract_end_on` は `employment_type = 'outsource'` のときのみ設定する |
| R4 | `deleted_at` に値があるレコードは `is_active = false` であるべき（整合性制約）|
| R5 | `termination_date` と `contract_end_on` は同一レコードに共存できる（外注が退職日も登録） |

---

## 5. 業務クエリパターン（モジュール別）

### 5.1 Bud — 給与計算（毎月）

**対象**: `is_active = true AND deleted_at IS NULL`（退職月の従業員は退職日が当月以降であれば含む）

```sql
-- helper 使用（推奨）
SELECT * FROM root_employees
WHERE public.is_employee_payroll_target(employee_id, '2026-05-01');

-- または直接クエリ
SELECT * FROM root_employees
WHERE is_active = true AND deleted_at IS NULL
  AND (termination_date IS NULL OR termination_date >= :target_month)
  AND (employment_type <> 'outsource' OR contract_end_on IS NULL OR contract_end_on >= :target_month);
```

### 5.2 Bud — 年末調整（年 1 回、12 月）

**対象**: `deleted_at IS NULL` かつ当年に在籍実績のある全従業員（中途退職者含む）

```sql
SELECT * FROM public.get_nencho_targets(2026);
```

### 5.3 Tree — 架電アプリ（担当者セレクト等）

**セレクト選択肢**: `is_active = true AND deleted_at IS NULL`  
**過去履歴の表示**: 退職者の紐付けは保持し、名前に `（退職）` プレフィックスを付与して表示する

```sql
-- 新規架電担当者候補（退職者除外）
SELECT employee_id, name FROM root_employees
WHERE is_active = true AND deleted_at IS NULL ORDER BY name;
```

### 5.4 Leaf — 案件登録（案件オーナーの設定）

**新規案件のオーナー候補**: `is_active = true AND deleted_at IS NULL`  
**退職者担当の既存案件**: 読み取りは可（履歴保持）、編集は admin 以上のみ可

### 5.5 Forest — 経営ダッシュボード（人員数・給与集計）

**在籍人員数（月次）**: `is_active = true AND deleted_at IS NULL AND (termination_date IS NULL OR termination_date >= CURRENT_DATE)`  
**給与総額（月次）**: Bud の給与計算結果を参照（root_employees の直接集計は行わない）

---

## 6. RLS ポリシー

### 6.1 基本方針

- **SELECT（全従業員）**: `manager` 以上のロール + `deleted_at IS NULL` を原則とする
- **SELECT（自分のレコード）**: `is_user_active()` で判定（全ロールに許可）
- **INSERT**: `admin` 以上
- **UPDATE（退職処理）**: `admin` 以上（`termination_date` / `is_active` / `contract_end_on` の変更）
- **UPDATE（完全削除 = deleted_at 設定）**: `super_admin` のみ

### 6.2 RLS ポリシー定義案

```sql
-- 1. manager 以上: deleted_at IS NULL の全従業員を参照可
CREATE POLICY root_emp_select_manager ON root_employees FOR SELECT
  USING (garden_role_of(auth.uid()) IN ('manager','admin','super_admin') AND deleted_at IS NULL);

-- 2. 自分のレコード: is_user_active() = true であれば閲覧可（全ロール）
CREATE POLICY root_emp_select_self ON root_employees FOR SELECT
  USING (user_id = auth.uid() AND is_user_active());

-- 3. super_admin: deleted_at 有値も含め全件参照可（監査・完全削除処理用）
CREATE POLICY root_emp_select_super ON root_employees FOR SELECT
  USING (garden_role_of(auth.uid()) = 'super_admin');

-- 4. INSERT: admin 以上
CREATE POLICY root_emp_insert ON root_employees FOR INSERT
  WITH CHECK (garden_role_of(auth.uid()) IN ('admin','super_admin'));

-- 5. UPDATE: admin 以上
--    deleted_at の設定（super_admin 専用）はアプリ層（Server Action）で制御する
CREATE POLICY root_emp_update ON root_employees FOR UPDATE
  USING (garden_role_of(auth.uid()) IN ('admin','super_admin'))
  WITH CHECK (garden_role_of(auth.uid()) IN ('admin','super_admin'));
```

**注意**: `deleted_at` の設定権限は列単位 RLS 制御が困難なため、Server Action 内の super_admin チェックで担保する。

---

## 7. a-bud / a-leaf / a-tree との連携ポイント

### 7.1 a-bud（給与計算・年末調整）

| 処理 | クエリ条件 | 根拠 |
|---|---|---|
| 月次給与計算の対象者リスト取得 | `is_active = true AND deleted_at IS NULL` | 現役のみ計算 |
| 退職日がある従業員の月次給与 | 退職日が当月以降なら対象月に含む | 月の途中退職は日割り計算（Bud 別タスク） |
| 年末調整の対象者リスト取得 | `deleted_at IS NULL`（is_active 問わず） | 中途退職者も当年在籍なら対象 |
| 年末調整の kou_otsu 参照 | `root_employees.kou_otsu` を直接参照 | null の場合は Bud 側でデフォルト扱い要確認 |
| 扶養控除の計算 | `root_employees.dependents_count` を参照 | 0 がデフォルト |

**Bud への要求**:
- 退職処理時に経理担当者へ Chatwork 通知を送る（退職月の給与計算締め処理を促す）
- 年末調整実行前に `get_nencho_targets()` の返却件数を確認するバリデーションを設ける

### 7.2 a-tree（架電アプリ）

| 処理 | クエリ条件 | 根拠 |
|---|---|---|
| 担当者セレクトボックスの選択肢 | `is_active = true AND deleted_at IS NULL` | 退職者を新規架電担当から除外 |
| 過去架電履歴の担当者表示 | 担当者名を JOIN（`deleted_at IS NULL` 条件は外す） | 履歴として存在維持 |
| 退職者の名前表示 | `（退職）` プレフィックスを付与 | 現役と区別 |

**Tree への要求**:
- 担当者を外部キー参照しているクエリで、退職者を含む JOIN と除外する JOIN を用途に応じて使い分ける
- `is_active = false` かつ `deleted_at IS NULL` の従業員は「退職済み担当者」として名前のみ表示

### 7.3 a-leaf（案件管理）

| 処理 | クエリ条件 | 根拠 |
|---|---|---|
| 案件オーナー候補の選択肢 | `is_active = true AND deleted_at IS NULL` | 退職者を新規オーナーに設定不可 |
| 退職者が担当の既存案件 | 読み取り: 制限なし / 編集: admin 以上 | 過去案件の履歴を保持 |
| 案件一覧の担当者フィルタ | `deleted_at IS NULL` で絞り込み | 完全削除者は除外 |

**Leaf への要求**:
- 退職者担当案件は「アーカイブ」扱いで表示（編集ボタンを非表示、または admin 限定）
- 案件の担当者変更機能で、変更後の担当者は `is_active = true` のみ選択可

---

## 8. 退職処理フロー（admin が UI から 1 名退職処理する手順）

### 8.1 処理ステップ

```
1. admin が従業員マスタ画面で対象従業員を選択
2. 「退職処理」ボタンをクリック（admin 以上のロールにのみ表示）
3. モーダルで以下を入力:
   - termination_date: 退職日（YYYY-MM-DD、必須）
   - employment_type が 'outsource' の場合: contract_end_on も合わせて入力（任意）
   - 退職理由（任意、notes フィールドに追記）
4. 「確認」ボタンで確定
5. Server Action が以下をアトミックに実行（トランザクション）:
   a. termination_date を設定
   b. is_active = false に変更
   c. root_audit_log にイベントを記録（後述）
   d. Chatwork で経理担当者に通知（後述）
6. 完了モーダルを表示（「退職処理が完了しました」）
```

### 8.2 自動: is_active の変更タイミング

- `termination_date` が**過去日または当日**の場合: 即時 `is_active = false`
- `termination_date` が**未来日**の場合: 現在は `is_active = true` のまま保持し、Vercel Cron ジョブで退職日当日に `is_active = false` を設定する（判断保留 #5 参照）

### 8.3 Chatwork 通知

経理担当者へ以下の内容で即時送信:
- 退職者名・employee_id・退職日・処理者名
- 依頼事項: 当月給与の日割り計算確認、社会保険の資格喪失手続き

### 8.4 監査ログ

`root_audit_log`（既存テーブル or 新規追加）に記録。フォーマット:

```json
{
  "event_type": "employee_termination",
  "employee_id": "EMP-0001",
  "changed_by": "<user_id>",
  "changed_at": "<timestamptz>",
  "before": { "is_active": true, "termination_date": null },
  "after":  { "is_active": false, "termination_date": "2026-08-31" }
}
```

---

## 9. 完全削除フロー（個人情報保管期限切れ等）

### 9.1 処理ステップ

```
1. super_admin が従業員マスタ画面（アーカイブ一覧）で対象従業員を選択
   ※ is_active=false かつ deleted_at IS NULL の一覧から選択
2. 「完全削除（論理削除）」ボタンをクリック（super_admin のみ表示）
3. 警告モーダル:
   - 「この操作は通常の業務画面から当該従業員を完全に除外します」
   - 「給与計算・年末調整・案件一覧の全クエリから除外されます」
   - 「DB には記録が残りますが、アプリからは参照できなくなります」
   - 確認テキスト入力「削除」を要求
4. Server Action が実行:
   a. deleted_at = now() を設定
   b. is_active = false を確認（既に false でなければ false に変更）
   c. root_audit_log にイベントを記録
5. 完了通知
```

### 9.2 完全削除後の挙動

| クエリ | 動作 |
|---|---|
| 通常の SELECT（`deleted_at IS NULL`） | 除外される |
| 年末調整対象（`get_nencho_targets()`） | 除外される |
| 過去給与計算の履歴 | `bud_salary_*` テーブルには記録が残る（employee_id のみ参照） |
| 過去案件の担当者 | Leaf 案件テーブルの `employee_id` は残るが、JOIN で名前は取得不可 |
| super_admin による管理画面 | 参照・確認可（復元はスコープ外） |

### 9.3 監査ログ

```json
{
  "event_type": "employee_soft_delete",
  "employee_id": "EMP-0001",
  "changed_by": "<super_admin_user_id>",
  "changed_at": "<timestamptz>",
  "reason": "個人情報保管期限切れ（退職から5年経過）"
}
```

### 9.4 物理削除は行わない

- 本フローは `deleted_at` にタイムスタンプを設定する**論理削除**である
- 物理削除（DELETE FROM root_employees）は禁止（`.claude/settings.json` deny ルールで保護済み）
- 物理削除が必要な場合は Supabase Dashboard から super_admin が手動で行う（要別途フロー策定、判断保留 #4 参照）

---

## 10. 受入基準

1. `is_user_active()` 関数が `deleted_at IS NULL` を含む条件で動作する（§3.2 の更新案適用済み）
2. `is_employee_payroll_target()` ヘルパーが正しく動作する（退職月の従業員を含む、前月退職者を除く）
3. `get_nencho_targets(year)` が中途退職者を含み、完全削除者を除いた件数を返す
4. 退職処理フロー（§8）が admin ロールで動作し、non-admin では「退職処理」ボタンが非表示
5. 完全削除フロー（§9）が super_admin のみ実行でき、admin では「完全削除」ボタンが非表示
6. 退職処理後、対象従業員が Tree の担当者セレクトから除外される
7. 退職処理後、対象従業員が Leaf の案件オーナー候補から除外される
8. 退職処理後、Chatwork に経理担当者への通知が飛ぶ
9. 退職処理・完全削除の両フローで `root_audit_log` にイベントが記録される
10. RLS ポリシーが §6 の定義通りに機能する（manager 以上は `deleted_at IS NULL` の全従業員を見られる）

---

## 11. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | `is_user_active()` 関数更新（`deleted_at IS NULL` 追加）migration | 0.05d |
| W2 | `is_employee_payroll_target()` / `get_nencho_targets()` helper 追加 migration | 0.1d |
| W3 | RLS ポリシー定義（§6）の migration + テスト | 0.1d |
| W4 | 退職処理 Server Action（トランザクション + 監査ログ + Chatwork 通知） | 0.1d |
| W5 | 完全削除 Server Action + モーダル UI | 0.1d |
| W6 | 従業員マスタ画面に「退職処理」「完全削除」ボタン追加（ロール制御） | 0.05d |
| W7 | `root_audit_log` テーブルの新規作成 or 既存確認 | 0.05d |
| W8 | Tree / Leaf / Bud との連携確認（実装はモジュール担当セッション） | 0.05d |
| **合計** | | **0.5d** |

---

## 12. 判断保留

| # | 論点 | 現状スタンス |
|---|---|---|
| 判1 | `termination_date` が未来日の場合に `is_active` を即時 false にするか、当日に変更するか | 当日変更を推奨（Vercel Cron）。Cron 実装前は即時 false でも業務上問題なし。東海林さんに確認が望ましい |
| 判2 | 退職処理の「退職理由」を notes に追記するか、専用フィールドを設けるか | 現状は notes に追記。専用フィールドは Phase C 以降で検討 |
| 判3 | `root_audit_log` テーブルが既存かどうか不明 | migration で CREATE TABLE IF NOT EXISTS で対応 |
| 判4 | 物理削除フローの必要性（GDPR 等の完全消去要求への対応） | 現状は論理削除のみ。法的要求が発生したら別途フロー策定 |
| 判5 | 未来日の `termination_date` 設定時、`is_active` を true のまま保持する Cron ジョブの実装 | Phase B-3 のスコープ外とし、専用タスクで実装 |
| 判6 | 過去架電・案件履歴に紐付く退職者の表示名（「（退職）山田太郎」案）の UI 確定 | a-tree / a-leaf セッションで UI 実装時に決定。本 spec では `（退職）` プレフィックスを提案とする |
| 判7 | 外注（outsource）の `contract_end_on` 設定なしの場合の扱い（無期限か要確認か） | `is_user_active()` では null = 継続中として扱う。UI で「未設定」を警告表示するか要確認 |

---

## 13. 未確認事項

| # | 未確認 |
|---|---|
| U1 | 個人情報保管の法定期限（退職後何年で完全削除可か）。労務担当者に確認 |
| U2 | 退職者データを Bud 給与 PDF 等で参照する際、`deleted_at IS NULL` をどちらのクエリ（Root / Bud）で担保するか |
| U3 | `root_audit_log` の保管期間と閲覧権限（super_admin のみか、admin も可か） |
| U4 | 退職処理通知の Chatwork チャンネル（経理担当専用ルームか、全体グループか） |
| U5 | 外注契約の `contract_end_on` を未来日で登録した従業員が期日前に解約した場合の処理（即時 false vs 日付更新） |

— end of B-03 spec —
