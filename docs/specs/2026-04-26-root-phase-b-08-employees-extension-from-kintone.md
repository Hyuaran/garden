# Root Phase B-8: 従業員マスタ拡張（Kintone App 56 確定 #23 / #24 / #31 統合）

- 対象: Garden-Root `root_employees` スキーマ拡張 + チーム配属 history / 助成金 / 休業履歴テーブル新規設計
- 見積: **2.5d**（内訳は §11）
- 担当セッション: a-root
- 作成: 2026-04-26（a-root-002 / Phase B-8 spec 起草）
- 前提 spec:
  - `2026-04-25-root-phase-b-01-permissions-matrix.md`（権限基盤）
  - `2026-04-25-root-phase-b-02-audit-log-extension.md`（監査ログ、§8 参照）
  - `2026-04-25-root-phase-b-07-migration-tools.md`（移行ツール基盤）
- 確定ログ: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`

---

## 1. 目的とスコープ

### 1.1 目的

Kintone App 56「従業員名簿 ヒュアラングループ」（105 フィールド + 4 SUBTABLE）の解析で
2026-04-26 a-main 006 セッションにて確定した **32 件のうち Root 担当 3 件（#23 / #24 / #31）**
を Garden-Root のデータモデルに反映する。

本 spec の統合対象：

| 確定 # | 内容 | 本 spec での対応 |
|---|---|---|
| **#23** | 「打刻 ID」と「KOTID」が App 56 で別フィールド管理 | `root_employees` に `attendance_punch_id` 追加、`kot_employee_id` と並列保持。将来統合候補（Phase C 以降） |
| **#24** | チーム名 3 種（◆最終 / ●旧 / SUBTABLE 在籍チーム）を履歴構造に | `current_team_id` カラム追加 + `root_employee_team_history` 新規 + trigger |
| **#31** | 助成金・休業履歴の保管期間 初期 10 年 → 安定後 7 年 | `root_employee_subsidies` / `root_employee_leaves` 新規 + `retention_until` 列 + cron 削除 |

**確定ログ参照**:
`C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md` §2.4 (#23, #24) / §2.6 (#31)

### 1.2 含める

- `root_employees` への非破壊 ALTER（`ADD COLUMN IF NOT EXISTS` のみ）
- `root_employee_team_history` テーブル + trigger（チーム変更時の自動追記）
- `root_employee_subsidies` テーブル（助成金履歴）
- `root_employee_leaves` テーブル（休業履歴）
- `retention_until` 自動削除 cron 関数
- Kintone App 56 SUBTABLE からの一括 import 方針
- RLS ポリシー（人事情報として manager+ 制限）

### 1.3 含めない

- `root_employees` の既存カラム変更・削除（破壊的変更なし）
- `root_teams` マスタテーブルの設計（判断保留 §12 判1 参照）
- 助成金・休業に関する Bud 給与計算への直接統合（連携ポイントのみ §7 で定義）
- チーム history を用いたレポート UI の実装（Phase C 以降）
- 保管期間 7 年への切り替え運用（安定後の対応、§9 移行注記参照）

---

## 2. 既存実装との関係

### 2.1 root_employees の現状

`scripts/root-auth-schema.sql` および Phase A-3g/h 拡張分より：

```
root_employees
  employee_id       text PK
  display_name      text
  email             text
  hire_date         date
  department        text
  position          text
  role              text
  kot_employee_id   text NULLABLE       -- Phase A-3g で追加済み（KoT 打刻 ID）
  is_active         boolean
  created_at        timestamptz
  updated_at        timestamptz
  ... (その他フィールド)
```

### 2.2 Phase A-3g / A-3h での拡張済みフィールド

- `kot_employee_id`: KoT（King of Time）との連携 ID として Phase A-3g で追加済み。
  今回 #23 で判明した「打刻 ID」は KoT とは**別系統**であるため、新規に `attendance_punch_id` を追加して並列保持する。
- `kot_employee_id` は変更せず維持（破壊的変更なし）。

### 2.3 本 spec の位置づけ

```
root_employees（既存 + #23 ALTER） ─────────── kot_employee_id（既存）
                                   └────────── attendance_punch_id（#23 追加）
                                   └────────── current_team_id（#24 追加）
                                                     │
                                           root_employee_team_history（#24 新規）
                                           ← trigger 自動追記 ←

root_employee_subsidies（#31 新規）─── retention_until（10年保管）
root_employee_leaves（#31 新規）────── retention_until（10年保管）
                                          ↑
                              root_cleanup_expired_retention()（日次 cron）
```

---

## 3. データモデル提案

### 3.1 root_employees への ALTER

```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS attendance_punch_id text,  -- 打刻 ID（KoT とは別系統、#23）
  ADD COLUMN IF NOT EXISTS current_team_id     text;  -- 現在所属チーム（FK or 文字列キー、#24）

COMMENT ON COLUMN root_employees.attendance_punch_id
  IS '#23: Kintone App 56「打刻 ID」からの移行。kot_employee_id（KoT）とは別系統。将来統合候補（Phase C 以降）';
COMMENT ON COLUMN root_employees.current_team_id
  IS '#24: 現在所属チーム。変更時に trigger が root_employee_team_history へ自動追記';

CREATE INDEX IF NOT EXISTS root_employees_current_team_idx
  ON root_employees (current_team_id);

CREATE INDEX IF NOT EXISTS root_employees_punch_id_idx
  ON root_employees (attendance_punch_id)
  WHERE attendance_punch_id IS NOT NULL;
```

> **将来統合候補（Phase C 以降）**:
> `attendance_punch_id` と `kot_employee_id` は Garden 安定後に同一か否かを確認した上で統合判断する。
> 確定ログ #23 では「おそらく統合可」とされているが、実データ照合が必要なため本 spec では保留。

### 3.2 root_employee_team_history（新規）

```sql
CREATE TABLE root_employee_team_history (
  history_id      bigserial PRIMARY KEY,
  employee_id     text          NOT NULL REFERENCES root_employees(employee_id),
  team_id         text          NOT NULL,
  team_name       text,                          -- スナップショット（team master 削除時の保全）
  started_at      date          NOT NULL,
  ended_at        date,                          -- NULL = 現在所属
  change_reason   text,                          -- 'transfer' / 'promotion' / 'initial' / 'import' 等
  changed_by      uuid          REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX root_employee_team_history_emp_idx
  ON root_employee_team_history (employee_id, started_at DESC);

CREATE INDEX root_employee_team_history_active_idx
  ON root_employee_team_history (employee_id)
  WHERE ended_at IS NULL;

COMMENT ON TABLE root_employee_team_history
  IS 'Phase B-08 #24: チーム配属履歴。root_employees.current_team_id 変更時に trigger で自動追記';
COMMENT ON COLUMN root_employee_team_history.team_name
  IS 'team master が削除された場合でも名称を保全するためのスナップショット';
COMMENT ON COLUMN root_employee_team_history.change_reason
  IS 'transfer（異動）/ promotion（昇格）/ initial（初期配属）/ import（Kintone 移行）/ correction（管理者修正）';
```

### 3.3 root_employee_subsidies（新規）

```sql
CREATE TABLE root_employee_subsidies (
  subsidy_id        bigserial   PRIMARY KEY,
  employee_id       text        NOT NULL REFERENCES root_employees(employee_id),
  subsidy_type      text        NOT NULL,
    -- '雇用調整助成金' / '業務改善助成金' / 'その他'（未確認事項 §13 U2 参照）
  applied_at        date        NOT NULL,
  amount_jpy        bigint,                -- NULL 可（申請のみで未確定額の場合、§13 U6）
  status            text        NOT NULL
    CHECK (status IN ('applied', 'approved', 'received', 'rejected')),
  received_at       date,
  notes             text,
  retention_until   date        NOT NULL,  -- 保管期限（applied_at + 10 年、安定後 +7 年）
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX root_employee_subsidies_emp_idx
  ON root_employee_subsidies (employee_id, applied_at DESC);

CREATE INDEX root_employee_subsidies_retention_idx
  ON root_employee_subsidies (retention_until)
  WHERE retention_until IS NOT NULL;

COMMENT ON TABLE root_employee_subsidies
  IS 'Phase B-08 #31: 助成金履歴。retention_until = applied_at + 10 年（安定後 +7 年に降格）';
COMMENT ON COLUMN root_employee_subsidies.retention_until
  IS '初期: applied_at + 10 年。Phase 安定後に新規登録分から +7 年へ変更（既存レコードは遡及しない）';
COMMENT ON COLUMN root_employee_subsidies.amount_jpy
  IS 'NULL 可。申請直後など金額未確定の場合は NULL で登録し、confirmed 時に更新';
```

### 3.4 root_employee_leaves（新規）

```sql
CREATE TABLE root_employee_leaves (
  leave_id          bigserial   PRIMARY KEY,
  employee_id       text        NOT NULL REFERENCES root_employees(employee_id),
  leave_type        text        NOT NULL
    CHECK (leave_type IN ('maternity', 'childcare', 'caregiving', 'medical', 'other')),
    -- §13 U3 でリスト確定が必要
  started_on        date        NOT NULL,
  ended_on          date,                     -- NULL = 復職未確定
  planned_end_on    date,
  status            text        NOT NULL
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  reason            text,
  retention_until   date        NOT NULL,     -- 保管期限（started_on + 10 年）
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX root_employee_leaves_emp_idx
  ON root_employee_leaves (employee_id, started_on DESC);

CREATE INDEX root_employee_leaves_retention_idx
  ON root_employee_leaves (retention_until);

CREATE INDEX root_employee_leaves_active_idx
  ON root_employee_leaves (employee_id)
  WHERE status IN ('planned', 'active');

COMMENT ON TABLE root_employee_leaves
  IS 'Phase B-08 #31: 休業履歴（産休/育休/介護休/病休等）。retention_until = started_on + 10 年';
COMMENT ON COLUMN root_employee_leaves.leave_type
  IS 'maternity=産休 / childcare=育休 / caregiving=介護休 / medical=病休 / other=その他。§13 U3 で確定';
```

### 3.5 trigger（チーム変更時 history 追記）

```sql
CREATE OR REPLACE FUNCTION root_log_team_change() RETURNS trigger AS $$
BEGIN
  -- INSERT 時 = 初期所属（current_team_id が NULL でなければ history を作成）
  IF TG_OP = 'INSERT' AND NEW.current_team_id IS NOT NULL THEN
    INSERT INTO root_employee_team_history
      (employee_id, team_id, started_at, change_reason)
    VALUES
      (NEW.employee_id, NEW.current_team_id,
       COALESCE(NEW.hire_date, CURRENT_DATE),
       'initial');
  END IF;

  -- UPDATE 時 = 配属変更（NULL 変化も含む、DISTINCT で判定）
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.current_team_id, '') IS DISTINCT FROM COALESCE(NEW.current_team_id, '')
  THEN
    -- 旧 history レコードを閉じる
    UPDATE root_employee_team_history
      SET ended_at = CURRENT_DATE
      WHERE employee_id = NEW.employee_id AND ended_at IS NULL;

    -- 新 history レコードを開く（NULL への変更時は INSERT しない）
    IF NEW.current_team_id IS NOT NULL THEN
      INSERT INTO root_employee_team_history
        (employee_id, team_id, started_at, change_reason)
      VALUES
        (NEW.employee_id, NEW.current_team_id, CURRENT_DATE, 'transfer');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_root_employees_team_change
  AFTER INSERT OR UPDATE OF current_team_id ON root_employees
  FOR EACH ROW EXECUTE FUNCTION root_log_team_change();

COMMENT ON FUNCTION root_log_team_change()
  IS 'AFTER INSERT/UPDATE OF current_team_id。changed_by は Server Action 側で直接 INSERT して補完する';
```

> **設計注記（AFTER タイミング採用理由）**:
> trigger は AFTER で動作させる。NEW の employee_id が既に確定している状態で
> `root_employee_team_history` の FK 制約が満たされるため、参照エラーを回避できる。
> 判断保留 §12 判2 参照。

### 3.6 retention 自動削除 cron 関数

```sql
CREATE OR REPLACE FUNCTION root_cleanup_expired_retention(
  dry_run boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
  deleted_subsidies int := 0;
  deleted_leaves    int := 0;
  preview_subsidies int := 0;
  preview_leaves    int := 0;
BEGIN
  -- dry_run モード: 件数のみ返す
  IF dry_run THEN
    SELECT COUNT(*) INTO preview_subsidies
      FROM root_employee_subsidies WHERE retention_until < CURRENT_DATE;
    SELECT COUNT(*) INTO preview_leaves
      FROM root_employee_leaves WHERE retention_until < CURRENT_DATE;

    RETURN jsonb_build_object(
      'dry_run',            true,
      'would_delete_subsidies', preview_subsidies,
      'would_delete_leaves',    preview_leaves,
      'checked_at',         now()
    );
  END IF;

  -- 物理削除（retention_until < 本日）
  DELETE FROM root_employee_subsidies WHERE retention_until < CURRENT_DATE;
  GET DIAGNOSTICS deleted_subsidies = ROW_COUNT;

  DELETE FROM root_employee_leaves WHERE retention_until < CURRENT_DATE;
  GET DIAGNOSTICS deleted_leaves = ROW_COUNT;

  RETURN jsonb_build_object(
    'dry_run',             false,
    'deleted_subsidies',   deleted_subsidies,
    'deleted_leaves',      deleted_leaves,
    'executed_at',         now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION root_cleanup_expired_retention(boolean)
  IS 'Phase B-08 #31: 保管期限超過レコードを物理削除。dry_run=true で件数プレビューのみ。日次 cron で実行推奨';
```

> **cron スケジュール**: `pg_cron` または Supabase Scheduled Functions で日次実行。
> 本番適用前に必ず `dry_run=true` で対象件数を確認すること。
> 実行頻度の判断保留は §12 判4 参照。

---

## 4. データフロー

```mermaid
flowchart TB
  subgraph Kintone App 56 SUBTABLE
    ST1[在籍チーム\n（team_id / period）]
    ST2[助成金\n（type / applied_at / amount）]
    ST3[休業履歴\n（type / started / ended）]
  end

  subgraph 移行ツール（B-7 基盤）
    MT[root_migration_staging\n→ commit]
  end

  subgraph Garden Root
    RE[root_employees\ncurrent_team_id / attendance_punch_id]
    TH[root_employee_team_history]
    SB[root_employee_subsidies]
    LV[root_employee_leaves]
    CR[root_cleanup_expired_retention\n日次 cron]
  end

  ST1 --> MT
  ST2 --> MT
  ST3 --> MT

  MT -->|import + change_reason='import'| TH
  MT -->|INSERT| SB
  MT -->|INSERT| LV

  RE -->|AFTER INSERT / UPDATE OF current_team_id\n  trigger 自動追記| TH

  CR -->|retention_until < CURRENT_DATE\n  物理削除| SB
  CR -->|retention_until < CURRENT_DATE\n  物理削除| LV
```

**移行フロー詳細**:

1. **Kintone → 移行ツール**: App 56 SUBTABLE 3 種を B-7 の `kintoneFetch` で取得、staging へ投入。
2. **staging → root_employee_team_history**: `change_reason = 'import'` を設定し、`started_at` / `ended_at` を Kintone の期間データからマッピング。trigger は **迂回せず**、直接 INSERT（trigger は通常運用の `current_team_id` 変更時のみ発火）。
3. **◆最終チーム名 → root_employees.current_team_id**: import スクリプト内で `UPDATE root_employees SET current_team_id = ...` を実行。trigger が発火し、history に `change_reason = 'initial'` で 1 行追記される（import 後に重複しないよう、import 側で trigger を無効化するか SUBTABLE 分は先に直接 INSERT すること）。
4. **通常運用**: UI から `assignTeam()` を呼び出すと `root_employees.current_team_id` が更新され、trigger が自動で history を追記する。
5. **日次 cron**: `root_cleanup_expired_retention()` を実行し、10 年経過レコードを物理削除。

---

## 5. API / Server Action 契約

```typescript
// src/app/root/_actions/employees-extension.ts

/**
 * チーム配属変更
 * current_team_id を更新 → trigger が root_employee_team_history を自動追記
 */
export async function assignTeam(params: {
  employee_id: string;
  new_team_id: string | null;    // null = チームなしへの変更
  change_reason?: string;        // 'transfer' / 'promotion' / 'correction'（省略時 'transfer'）
  team_name_snapshot?: string;   // trigger 側で補完できない場合に history へ直書き
}): Promise<{ success: boolean; history_id?: number; error?: string }>;

/**
 * 助成金登録
 */
export async function recordSubsidy(params: {
  employee_id: string;
  subsidy_type: string;
  applied_at: string;           // ISO date string
  amount_jpy?: number | null;   // 未確定の場合は null
  notes?: string;
}): Promise<{ success: boolean; subsidy_id?: number; retention_until?: string; error?: string }>;

/**
 * 休業登録
 */
export async function recordLeave(params: {
  employee_id: string;
  leave_type: string;           // 'maternity' | 'childcare' | 'caregiving' | 'medical' | 'other'
  started_on: string;           // ISO date string
  planned_end_on?: string;
  reason?: string;
}): Promise<{ success: boolean; leave_id?: number; retention_until?: string; error?: string }>;

/**
 * チーム配属履歴取得
 */
export async function getEmployeeTeamHistory(params: {
  employee_id: string;
  include_closed?: boolean;     // false = 現在所属のみ（ended_at IS NULL）
}): Promise<{ history: TeamHistoryRow[]; error?: string }>;

/**
 * 保管期間設定変更（admin 専用）
 * 10 年 → 7 年への降格時に実行。既存レコードへの遡及は行わない（§12 判3）
 */
export async function manageRetentionPeriod(params: {
  table: 'subsidies' | 'leaves';
  new_years: 7 | 10;
  effective_from?: string;      // ISO date string、省略時は即時適用（新規のみ）
}): Promise<{ success: boolean; message?: string; error?: string }>;
```

---

## 6. RLS ポリシー

```sql
-- root_employee_team_history
-- 業務上チーム構成の確認が全員に必要なため、閲覧は全認証ユーザーに開放
ALTER TABLE root_employee_team_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY reth_select ON root_employee_team_history
  FOR SELECT USING (root_is_authenticated());

-- INSERT は trigger 経由のみ（SECURITY DEFINER 関数が実行）、直接 INSERT は admin / super_admin
CREATE POLICY reth_insert ON root_employee_team_history
  FOR INSERT WITH CHECK (root_has_role_any(ARRAY['admin', 'super_admin']));

-- UPDATE / DELETE は admin / super_admin のみ（history 改ざん防止）
CREATE POLICY reth_update ON root_employee_team_history
  FOR UPDATE USING (root_has_role_any(ARRAY['admin', 'super_admin']));

CREATE POLICY reth_delete ON root_employee_team_history
  FOR DELETE USING (root_has_role_any(ARRAY['admin', 'super_admin']));

-- root_employee_subsidies
-- 助成金情報は機微情報：manager 以上が閲覧、admin 以上が編集
ALTER TABLE root_employee_subsidies ENABLE ROW LEVEL SECURITY;

CREATE POLICY resub_select ON root_employee_subsidies
  FOR SELECT USING (root_has_role_any(ARRAY['manager', 'admin', 'super_admin']));

CREATE POLICY resub_insert ON root_employee_subsidies
  FOR INSERT WITH CHECK (root_has_role_any(ARRAY['admin', 'super_admin']));

CREATE POLICY resub_update ON root_employee_subsidies
  FOR UPDATE USING (root_has_role_any(ARRAY['admin', 'super_admin']));

-- 物理削除は cron（SECURITY DEFINER）のみ。UI からの個別削除は admin / super_admin
CREATE POLICY resub_delete ON root_employee_subsidies
  FOR DELETE USING (root_has_role_any(ARRAY['admin', 'super_admin']));

-- root_employee_leaves
-- 休業情報は機微情報（健康・育児等）：manager 以上が閲覧、admin 以上が編集
ALTER TABLE root_employee_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY relv_select ON root_employee_leaves
  FOR SELECT USING (root_has_role_any(ARRAY['manager', 'admin', 'super_admin']));

CREATE POLICY relv_insert ON root_employee_leaves
  FOR INSERT WITH CHECK (root_has_role_any(ARRAY['admin', 'super_admin']));

CREATE POLICY relv_update ON root_employee_leaves
  FOR UPDATE USING (root_has_role_any(ARRAY['admin', 'super_admin']));

CREATE POLICY relv_delete ON root_employee_leaves
  FOR DELETE USING (root_has_role_any(ARRAY['admin', 'super_admin']));
```

---

## 7. 他モジュールとの連携ポイント

### 7.1 a-bud（給与計算・経費）

- **休業 → 給与計算への影響**: `root_employee_leaves` で `status = 'active'` の従業員は給与 0 円処理が必要。
  Bud Phase D（給与計算 engine）の `is_employee_payroll_target()` 関数に、leaves テーブルの状態参照を追加する。
  確定ログ #17 で「Excel 給与計算排除」が確定済みのため、このロジックも Bud Phase D に統合する。
- **助成金**: 助成金は経理計上（Bud 側の `bud_entries` と紐付く可能性）だが、給与計算には直接影響しない。
  連携方式は Bud Phase D spec 確定後に改めて定義。

### 7.2 a-leaf（案件管理）

- `root_employee_team_history` のチーム所属履歴と、Leaf 案件の担当者変更履歴を時系列で突合可能。
  例: 「2026-02-01 にチーム異動した担当者が担当していた案件一覧」の抽出。
  現状は連携仕様なし、Phase C 以降で検討。

### 7.3 a-tree（架電アプリ）

- `root_employees.current_team_id` を基準に架電画面の担当者絞込フィルタを実装可能。
  Tree Phase B/C での「チーム別案件割当」機能の前提データとなる。
  Tree 側が参照する際は、`root_employee_team_history` の `ended_at IS NULL` 行を最新所属として使用する。

### 7.4 a-auto / Sprout（採用後 Root 移管）

- 採用内定後、Sprout から Root への移管フローで `root_employees` を INSERT する際、
  `current_team_id` に初期配属チームを設定する。
  trigger が自動的に `root_employee_team_history` に `change_reason = 'initial'` で 1 行目を作成する。
  確定ログ #4（採用後 Root 移管）との整合性を要確認。

---

## 8. 監査ログ要件

Phase B-2 spec（`2026-04-25-root-phase-b-02-audit-log-extension.md`）に定義された
`root_audit_log` への記録が本 spec の以下のオペレーションで必須となる。

| オペレーション | action_type | severity | 対象 |
|---|---|---|---|
| `assignTeam()` | `employee_team_change` | `info` | root_employee_team_history |
| `recordSubsidy()` INSERT | `employee_subsidy_register` | `warning` | root_employee_subsidies（人事操作）|
| `recordLeave()` INSERT | `employee_leave_register` | `warning` | root_employee_leaves（人事操作）|
| `recordSubsidy()` UPDATE | `employee_subsidy_update` | `warning` | root_employee_subsidies |
| `recordLeave()` UPDATE status=completed | `employee_leave_complete` | `info` | root_employee_leaves |
| `root_cleanup_expired_retention()` | `retention_cleanup` | `info` | 削除件数を jsonb で記録 |
| `manageRetentionPeriod()` | `retention_policy_change` | `critical` | 設定変更は要記録 |

---

## 9. 移行注記（Kintone App 56 → root_employees）

確定ログ `decisions-kintone-batch-20260426-a-main-006.md` の #23 / #24 / #31 に基づく移行方針：

### 9.1 #23: 打刻 ID + KOTID 並列保持

| Kintone App 56 フィールド | Garden 移行先 | 備考 |
|---|---|---|
| 打刻 ID | `root_employees.attendance_punch_id` | 新規追加カラム |
| KOTID | `root_employees.kot_employee_id` | 既存カラム（変更なし） |

- **将来統合候補（Phase C 以降）**: 両フィールドが同一値を指すか実データで照合後に統合判断。
  照合スクリプト例: `SELECT employee_id FROM root_employees WHERE attendance_punch_id != kot_employee_id`。
  相違があれば東海林さんに確認の上、どちらを正とするかを決定してから統合。

### 9.2 #24: チーム名 3 種

| Kintone App 56 データ | Garden 移行先 | 移行方法 |
|---|---|---|
| ◆最終チーム名（現在所属） | `root_employees.current_team_id` | `UPDATE root_employees SET current_team_id = ...` |
| ●チーム名（直近の旧所属） | `root_employee_team_history`（直近 history 行） | 直接 INSERT（`change_reason = 'import'`） |
| SUBTABLE「在籍チーム」（全履歴） | `root_employee_team_history`（全行） | SUBTABLE を全行 INSERT（`started_at` / `ended_at` マッピング） |

**import 時の trigger 制御**:
SUBTABLE の全行を直接 `root_employee_team_history` に INSERT するため、
◆最終チーム名の `root_employees.current_team_id` 更新後に trigger が発火して history を
重複作成しないよう、import スクリプト内で以下のいずれかを採用する：

1. **trigger 一時無効化**: `ALTER TABLE root_employees DISABLE TRIGGER trg_root_employees_team_change;` → import → 再有効化（admin 権限必須）
2. **import 順序制御**: SUBTABLE を先に全行 INSERT してから、◆最終チーム名を UPDATE。trigger の発火より SUBTABLE の import を先行させ、`ended_at IS NULL` の最新行が存在する場合は trigger 側で重複しない処理を追加。

判断保留なしで **方式 1（trigger 一時無効化）を推奨**。import は1回限りのバッチ操作のため。

### 9.3 #31: 助成金 / 休業履歴

| 対象 | Kintone App 56 データ | Garden 移行先 |
|---|---|---|
| 助成金 | SUBTABLE「助成金」 | `root_employee_subsidies` |
| 休業履歴 | SUBTABLE「休業履歴」 | `root_employee_leaves` |

- **retention_until の初期化**: `applied_at + 10 年`（助成金）/ `started_on + 10 年`（休業）で設定。
- **Kintone データの保管期間**: import 時点で Kintone 側の既存データが何年前か確認し、
  すでに 10 年を超えているレコードは import 対象外とする（または import 後に `retention_until` を過去日にして即削除）。

---

## 10. 受入基準

1. `root_employees` に `attendance_punch_id` / `current_team_id` カラムが追加されている（`ADD COLUMN IF NOT EXISTS`）
2. `root_employee_team_history` テーブルが存在し、trigger が動作する
   - 新規 INSERT 時: `current_team_id` が設定されれば history に `change_reason='initial'` で 1 行作成
   - UPDATE 時: `current_team_id` 変更で旧 history の `ended_at` が設定され、新 history が追記される
3. `root_employee_subsidies` テーブルが存在し、`retention_until` が必須である
4. `root_employee_leaves` テーブルが存在し、`retention_until` が必須である
5. `root_cleanup_expired_retention(dry_run := true)` が対象件数を返し、物理削除は実行しない
6. `root_cleanup_expired_retention()` が実行後に削除件数を jsonb で返す
7. Kintone App 56 SUBTABLE 3 種からの一括 import スクリプトが B-7 基盤を経由して動作する
8. RLS が正しく適用される
   - `root_employee_team_history`: 全認証ユーザーが閲覧可、admin / super_admin のみ直接変更可
   - `root_employee_subsidies` / `root_employee_leaves`: manager+ 閲覧、admin+ 編集
9. 監査ログが §8 の対象オペレーションに対して `root_audit_log` に記録される
10. vitest で trigger・retention 関数の動作を検証するテストが存在する

---

## 11. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | root_employees ALTER（attendance_punch_id / current_team_id）migration | 0.25d |
| W2 | root_employee_team_history テーブル + trigger migration | 0.5d |
| W3 | root_employee_subsidies テーブル migration | 0.25d |
| W4 | root_employee_leaves テーブル migration | 0.25d |
| W5 | retention 自動削除 cron + dry-run 機能 | 0.25d |
| W6 | Kintone App 56 SUBTABLE → 各テーブル import スクリプト（B-7 基盤利用） | 0.5d |
| W7 | Server Actions（assignTeam / recordSubsidy / recordLeave / getEmployeeTeamHistory） | 0.25d |
| W8 | RLS + テスト（vitest 含む） | 0.25d |
| **合計** | | **2.5d** |

---

## 12. 判断保留

| # | 論点 | 現状スタンス |
|---|---|---|
| 判1 | root_teams テーブルを別途定義するか、`current_team_id` を text 文字列キーで運用するか | **text 文字列キー案を推奨**（Kintone データ移行容易、FK 制約なし）。root_teams を別途定義する場合は B-9 相当の spec が必要 |
| 判2 | trigger タイミング（AFTER vs BEFORE） | **AFTER を採用**（AFTER は NEW.employee_id が確定済みで FK 制約が安全）。BEFORE にする理由が生じた場合は実装時に再確認 |
| 判3 | retention 期間切替（10 → 7 年）の既存レコードへの遡及適用 vs 新規のみ降格 | **新規のみ案を採用**（遡及変更は既存記録の整合性リスク、東海林さん確認済み「以前同様の運用」）。遡及変更が必要なら admin 操作 + 監査ログ必須 |
| 判4 | 自動削除 cron の実行頻度 | **日次案を採用**（月次でも実業務に支障なし、頻度変更は cron 設定のみ）。10 年後まで対象が発生しないため月次でも許容可 |
| 判5 | 助成金 / 休業履歴の論理削除（deleted_at）vs 物理削除のみ | **物理削除のみ採用**（retention_until が法的保管期限の意味を持つため、期限後は保持不要。論理削除は retention の意図と矛盾）。ただし削除前の cron で監査ログに件数記録必須 |
| 判6 | Kintone import 時の重複検知ルール | 暫定: `employee_id × started_at` の組合せで重複判定（exact match）。同従業員の同日配属が複数存在する場合の優先ルールは import 前に東海林さん確認が必要 |

---

## 13. 未確認事項（東海林さんへの確認）

| # | 確認事項 |
|---|---|
| U1 | root_teams マスタの存在有無（別途テーブル化が必要か、text 文字列キーで十分か） |
| U2 | 助成金種別の正式リスト（「雇用調整助成金」「業務改善助成金」以外の種別があれば列挙） |
| U3 | 休業種別 leave_type の正式リスト（産休 / 育休 / 介護 / 病休 以外に社内で運用している種別） |
| U4 | 「安定後」の定義（Phase B 完了後 / Phase C 完了後 / 1 年運用後 等、保管期間降格のトリガー時期） |
| U5 | 物理削除前の事前通知の必要性（誰に / 何日前に通知するか。現状 cron 実行後に監査ログのみ） |
| U6 | 助成金の amount_jpy が NULL 可か（申請直後など未確定額の場合の運用ルール） |

— end of Phase B-8 spec —
