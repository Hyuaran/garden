# Root Phase B-4: マスタ間整合性チェック 仕様書

- 対象: Garden-Root の 7 マスタ間における整合性の自動検証・不整合通知・解消 UI
- 見積: **1.25d**（内訳は §11）
- 担当セッション: a-root
- 作成: 2026-04-25（a-root-002 / Phase B-4 spec 起草）
- 元資料: `docs/specs/2026-04-24-root-master-definitions.md`, Phase A-3-g/h migration

---

## 1. 目的とスコープ

### 目的

7 つの Root マスタは相互に外部キーや業務ルールで結合している。  
FK 制約で参照整合性の一部は保護されているが、**業務整合性・状態整合性**はアプリ層での保証が弱い。本 Phase では：

1. 参照整合性 / 状態整合性 / 業務整合性の 3 カテゴリを網羅するチェック関数群を整備
2. 日次 cron で自動チェックを走らせ、不整合を `root_consistency_violations` に記録
3. admin UI で一覧確認・解消マークができるようにする
4. critical な不整合（振込・給与計算に直結）は即時 Chatwork 通知する

### 含める

- チェッククエリ群（PostgreSQL function / view）
- `root_consistency_violations` テーブル（結果格納）+ `root_consistency_check_log`（実行履歴）
- Vercel Cron による日次自動チェック（既存 `/api/root/cron/kot-sync` パターン踏襲）
- admin UI: 不整合一覧・解消マーク・手動実行ボタン
- Chatwork 通知（critical のみ即時、その他は日次サマリ）

### 含めない

- 不整合の**自動修正**（データ変更は人間の判断が必要 → 判断保留 §12 参照）
- Bud / Leaf / Tree テーブルへのクロスチェック（Root テーブル内に限定）
- MFクラウド給与 / キングオブタイム側データ検証

---

## 2. 既存実装との関係

### 7 マスタの相互参照（現状）

```
root_companies ←── root_bank_accounts.company_id
               ←── root_employees.company_id
               ←── root_vendors.company_id（nullable）

root_employees ←── root_attendance.employee_id
               ←── root_attendance_daily.employee_id（A-3-d）
               .salary_system_id ──► root_salary_systems
```

### Phase A-3-g/h で拡張済のフィールド（整合チェックに関わるもの）

| フィールド | migration | 整合チェックとの関係 |
|---|---|---|
| `employment_type` CHECK ('正社員'/'アルバイト'/'outsource') | A-3-g | 給与体系との整合（§4.3 BIZ-03/04/05） |
| `contract_end_on` | A-3-g | 外注の活性判定（STA-07） |
| `garden_role` CHECK（8 段階） | A-3-g | role と employment_type の整合 |
| `kou_otsu` CHECK ('kou'/'otsu'/null) | A-3-h | 現役社員の甲乙未設定検出（BIZ-06） |
| `deleted_at` | A-3-h | 論理削除と is_active の二重矛盾検出（STA-08） |

### 既存の監査インフラ

- `root_audit_log`: ユーザー操作ログ → 不整合起票時に `check_violation_detected` アクションで再利用
- `root_kot_sync_log`: システム同期履歴 → `root_consistency_check_log` 設計の参照パターン

---

## 3. root_partners の取扱い（重要、判断保留）

### 現状

Root マスタには `root_vendors`（取引先マスタ）のみ存在する。
仕様 brief の「root_partners」は現リポジトリに同名テーブルが存在しない。

### 意味候補（3 案）

| 案 | 意味 | 根拠 |
|---|---|---|
| **(a) root_vendors と同じ** | "partners" は "vendors" の別名・旧称 | マスタ定義書 v2 で「取引先マスタ = root_vendors」と明記 |
| **(b) 業務委託先（外注 employee の上位概念）** | 個人ではなく法人として契約する外注先を別テーブルで管理 | employment_type='outsource' が追加された文脈 |
| **(c) 提携法人（root_companies の外部版）** | 自社 6 法人以外のグループ会社・提携先を管理 | Forest の companies との連携を想定 |

### 本 spec での取扱い

**案 (a) と仮定して進める**。`root_vendors` を整合チェックの対象に含め、`root_partners` テーブルは参照しない。  
**東海林さんへの必須ヒアリング項目**: §13 未確認事項 U1。

---

## 4. 整合性チェック対象（カテゴリ別）

### 4.1 参照整合性チェック（REF）

| チェック ID | チェック内容 | 対象 | 重要度 |
|---|---|---|---|
| REF-01 | `root_employees.company_id` → `root_companies` 存在確認 | employees → companies | critical |
| REF-02 | `root_employees.salary_system_id` → `root_salary_systems` 存在確認 | employees → salary_systems | critical |
| REF-03 | `root_bank_accounts.company_id` → `root_companies` 存在確認 | bank_accounts → companies | high |
| REF-04 | `root_attendance.employee_id` → `root_employees` 存在確認 | attendance → employees | high |
| REF-05 | `root_vendors.company_id`（nullable）が設定済の場合の存在確認 | vendors → companies | medium |
| REF-06 | `root_attendance_daily.employee_id` → `root_employees` 存在確認 | attendance_daily → employees | medium |

### 4.2 状態整合性チェック（STA）

| チェック ID | チェック内容 | 対象 | 重要度 |
|---|---|---|---|
| STA-01 | 退職済 employee（`termination_date` 過去日）に未来月の attendance が存在しないか | employees + attendance | critical |
| STA-02 | `is_active = false` の employee に当月以降の attendance が存在しないか | employees + attendance | high |
| STA-03 | `deleted_at` 設定済の employee に未来月 attendance が存在しないか | employees + attendance | high |
| STA-04 | `is_active = false` の `root_vendors` への参照が Bud 側に残っていないか（§8 連携ポイント） | vendors | critical |
| STA-05 | `is_active = false` の `root_companies` に紐付く新規 bank_account が存在しないか | companies + bank_accounts | high |
| STA-06 | `is_active = false` の salary_system を参照する `is_active = true` の employee がいないか | salary_systems + employees | high |
| STA-07 | 外注 (`employment_type = 'outsource'`) で `contract_end_on` が過去日なのに `is_active = true` のままの employee | employees | medium |
| STA-08 | `deleted_at` 設定済 + `is_active = true` の矛盾レコード | employees | medium |

### 4.3 業務整合性チェック（BIZ）

| チェック ID | チェック内容 | 対象 | 重要度 |
|---|---|---|---|
| BIZ-01 | 同一法人内での `employee_number` の重複 | employees | critical |
| BIZ-02 | 同一法人内での同一銀行口座番号（`bank_code + branch_code + account_number`）の重複 | bank_accounts | high |
| BIZ-03 | `employment_type = 'アルバイト'` に `base_salary_type = '月給'` の salary_system が割当されていないか | employees + salary_systems | high |
| BIZ-04 | `employment_type = '正社員'` に `base_salary_type = '時給'` の salary_system が割当されていないか | employees + salary_systems | medium |
| BIZ-05 | `employment_type = 'outsource'` に正社員向け salary_system が割当されていないか | employees + salary_systems | medium |
| BIZ-06 | `kou_otsu = null` で `is_active = true`（甲乙区分未設定の現役社員） | employees | low |
| BIZ-07 | `insurance_type = '加入'` だが有効な `root_insurance` レコードが存在しない | employees + insurance | high |
| BIZ-08 | 同一法人内で `vendor_name_kana` が完全一致する重複取引先 | vendors | medium |
| BIZ-09 | `hire_date` が `termination_date` より後の矛盾レコード | employees | critical |
| BIZ-10 | `root_attendance.target_month` が `hire_date` より前 or `termination_date` より後 | employees + attendance | medium |

---

## 5. データフロー

```
Vercel Cron（毎日 02:00 JST）
  → POST /api/root/cron/consistency-check
  → run_consistency_checks()（PostgreSQL function）
  → 不整合あり → root_consistency_violations に INSERT（ON CONFLICT DO NOTHING で重複防止）
              → severity=critical → Chatwork 即時通知
              → その他 → 日次 09:00 サマリ通知
  → root_consistency_check_log に実行履歴記録
  → root_audit_log に check_violation_detected 起票

admin UI（/root/consistency）
  → 未解消一覧取得（v_root_violations_active VIEW）
  → 手動実行ボタン → 上記 cron エンドポイントを呼出
  → 解消マーク → resolved_at / resolved_by / resolution_note を UPDATE
```

---

## 6. データモデル提案

### 6.1 `root_consistency_violations`（不整合記録テーブル）

```sql
CREATE TABLE IF NOT EXISTS public.root_consistency_violations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id            text NOT NULL,          -- 'REF-01', 'STA-01', 'BIZ-01' 等
  check_category      text NOT NULL
    CHECK (check_category IN ('referential', 'state', 'business')),
  severity            text NOT NULL
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  target_table        text NOT NULL,
  target_id           text NOT NULL,          -- レコードの主キー値（文字列統一）
  target_display      text,                   -- 例: '田中 太郎 (EMP-0012)'
  violation_message   text NOT NULL,
  detail              jsonb,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES auth.users(id),
  resolution_note     text,
  CONSTRAINT uq_violation_unresolved
    UNIQUE NULLS NOT DISTINCT (check_id, target_table, target_id, resolved_at),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rcv_unresolved ON public.root_consistency_violations (detected_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_rcv_severity   ON public.root_consistency_violations (severity, detected_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_rcv_check_id   ON public.root_consistency_violations (check_id, detected_at DESC);
```

### 6.2 `root_consistency_check_log`（実行履歴）

```sql
CREATE TABLE IF NOT EXISTS public.root_consistency_check_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by     text NOT NULL,             -- user_id or 'cron'
  triggered_at     timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  duration_ms      integer,
  status           text NOT NULL CHECK (status IN ('running', 'success', 'failure')),
  checks_run       integer NOT NULL DEFAULT 0,
  violations_new   integer NOT NULL DEFAULT 0,
  violations_total integer NOT NULL DEFAULT 0,
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### 6.3 `v_root_violations_active`（管理 VIEW）

```sql
CREATE OR REPLACE VIEW public.v_root_violations_active AS
SELECT
  v.*,
  EXTRACT(DAY FROM now() - v.detected_at)::int AS days_open
FROM public.root_consistency_violations v
WHERE v.resolved_at IS NULL
ORDER BY
  CASE v.severity
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4
  END,
  v.detected_at DESC;
```

### 6.4 `run_consistency_checks()`（チェック実行関数・骨格）

```sql
CREATE OR REPLACE FUNCTION public.run_consistency_checks()
  RETURNS TABLE (check_id text, violations_found int)
  LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_log_id uuid;
BEGIN
  INSERT INTO public.root_consistency_check_log (triggered_by, status)
    VALUES ('cron', 'running') RETURNING id INTO v_log_id;

  -- REF-01: employee → company 孤立チェック（他チェックも同パターン）
  INSERT INTO public.root_consistency_violations
    (check_id, check_category, severity, target_table, target_id, target_display, violation_message)
  SELECT 'REF-01', 'referential', 'critical', 'root_employees',
    e.employee_id, e.name || ' (' || e.employee_id || ')',
    'company_id ' || e.company_id || ' が root_companies に存在しない'
  FROM public.root_employees e
  LEFT JOIN public.root_companies c ON c.company_id = e.company_id
  WHERE c.company_id IS NULL
  ON CONFLICT (check_id, target_table, target_id, resolved_at) DO NOTHING;

  -- BIZ-01: 同一法人内 employee_number 重複（detail に件数を格納する例）
  INSERT INTO public.root_consistency_violations
    (check_id, check_category, severity, target_table, target_id, target_display, violation_message, detail)
  SELECT 'BIZ-01', 'business', 'critical', 'root_employees',
    e.employee_id, e.name || ' (' || e.employee_id || ')',
    '従業員番号 ' || e.employee_number || ' が法人 ' || e.company_id || ' 内で重複',
    jsonb_build_object('duplicate_count', cnt.dup_count)
  FROM public.root_employees e
  INNER JOIN (
    SELECT company_id, employee_number, COUNT(*) AS dup_count
    FROM public.root_employees WHERE is_active = true
    GROUP BY company_id, employee_number HAVING COUNT(*) > 1
  ) cnt ON cnt.company_id = e.company_id AND cnt.employee_number = e.employee_number
  WHERE e.is_active = true
  ON CONFLICT (check_id, target_table, target_id, resolved_at) DO NOTHING;

  -- （§4 の全 20 チェックを同パターンで実装）

  UPDATE public.root_consistency_check_log
    SET status = 'success', completed_at = now(),
        duration_ms = EXTRACT(MILLISECONDS FROM now() - triggered_at)::int
    WHERE id = v_log_id;

  RETURN QUERY
    SELECT v.check_id, COUNT(*)::int
    FROM public.root_consistency_violations v WHERE v.resolved_at IS NULL
    GROUP BY v.check_id;
END; $$;
```

### 6.5 RLS

```sql
ALTER TABLE public.root_consistency_violations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.root_consistency_check_log     ENABLE ROW LEVEL SECURITY;

-- 閲覧: admin / super_admin のみ
CREATE POLICY rcv_select ON public.root_consistency_violations FOR SELECT
  USING (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- 解消マーク: admin / super_admin のみ
CREATE POLICY rcv_update ON public.root_consistency_violations FOR UPDATE
  USING  (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'));

-- INSERT は service_role のみ（cron / server action 経由）
CREATE POLICY rcl_select ON public.root_consistency_check_log FOR SELECT
  USING (public.garden_role_of(auth.uid()) IN ('admin', 'super_admin'));
```

---

## 7. API / Server Action 契約

### 7.1 手動チェック実行

```typescript
// POST /api/root/cron/consistency-check  または  Server Action
export async function runConsistencyCheck(params: {
  triggeredBy: string;  // userId or 'manual'
}): Promise<{
  success: boolean; logId: string; checksRun: number;
  violationsNew: number; violationsTotal: number; durationMs: number; error?: string;
}>;
```

### 7.2 不整合一覧取得

```typescript
export async function listViolations(params: {
  severity?: 'critical' | 'high' | 'medium' | 'low';
  checkCategory?: 'referential' | 'state' | 'business';
  resolved?: boolean;   // false = 未解消のみ（デフォルト）
  limit?: number;       // デフォルト 50
  offset?: number;
}): Promise<{ items: ConsistencyViolation[]; total: number }>;

interface ConsistencyViolation {
  id: string; checkId: string; checkCategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  targetTable: string; targetId: string; targetDisplay: string | null;
  violationMessage: string; detail: Record<string, unknown> | null;
  detectedAt: string; daysOpen: number;
  resolvedAt: string | null; resolvedBy: string | null; resolutionNote: string | null;
}
```

### 7.3 個別不整合の解消マーク

```typescript
export async function resolveViolation(params: {
  violationId: string; resolutionNote: string;
}): Promise<{ success: boolean; error?: string }>;

// 同一 checkId 全件一括解消
export async function resolveViolationsByCheckId(params: {
  checkId: string; resolutionNote: string;
}): Promise<{ success: boolean; resolvedCount: number; error?: string }>;
```

---

## 8. a-bud / a-leaf / a-tree との連携ポイント

### 8.1 a-bud（振込実行前の vendor 整合確認）

- 振込 CSV 作成前に `root_vendors.is_active = true` を確認。`false` なら**エラーで停止**（critical）
- 実装場所: `bud/_actions/create-furikomi.ts`
- Root 側提供ユーティリティ: `assertVendorActive(vendorId: string): Promise<void>`（`VENDOR_INACTIVE` を throw）

### 8.2 a-leaf（案件登録時の employee 在籍確認）

- 案件作成時に担当者の `is_active = true` + `termination_date` 未来日 or null を確認
- A-3-g で実装済の `is_user_active()` 関数を流用可

### 8.3 a-tree（架電セレクト前の employee 在籍確認）

- シフト・架電割当の担当者候補リストから退職済 / 外注契約終了の employee を除外
- `is_user_active()` または `is_active = true AND (termination_date IS NULL OR termination_date > current_date)` でフィルタ

---

## 9. Chatwork 通知

| トリガー | タイミング | 内容 |
|---|---|---|
| critical 不整合検出 | 即時（cron 完了直後） | check_id / 対象 / メッセージを列挙 |
| 日次サマリ（high 以下） | 毎日 09:00 JST | 未解消件数（severity 別）と上位 5 件 |
| critical が 3 日以上未解消 | 毎日 09:00 JST | エスカレーション通知 |

通知先チャンネルは未確認事項 U4 参照。既存 Chatwork 通知実装に準拠。

---

## 10. 受入基準

1. `root_consistency_violations` + `root_consistency_check_log` が migration で作成され RLS 設定済
2. `run_consistency_checks()` が §4 の全 20 チェック（REF-01〜06, STA-01〜08, BIZ-01〜10）を実行し INSERT できること
3. Vercel Cron（毎日 02:00 JST）で自動チェックが走り実行ログが記録されること
4. admin UI（`/root/consistency`）で未解消一覧が severity 順に表示されること
5. 手動実行ボタンで即時チェックが走ること
6. 解消マーク（`resolved_at` / `resolved_by` / `resolution_note`）が保存され一覧から消えること
7. critical 不整合検出時に Chatwork へ即時通知されること
8. RLS: admin / super_admin のみ閲覧・更新、INSERT は service_role のみ
9. `garden_role_of()`（A-3-g 実装済）を RLS ポリシーで再利用していること
10. 既存マスタテーブルへの**破壊的変更なし**

---

## 11. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | `root_consistency_violations` + `root_consistency_check_log` migration + RLS | 0.1d |
| W2 | `v_root_violations_active` VIEW + `run_consistency_checks()` 関数（全 20 チェック） | 0.25d |
| W3 | Vercel Cron エンドポイント（`/api/root/cron/consistency-check`） | 0.1d |
| W4 | Server Actions（runConsistencyCheck / listViolations / resolveViolation） | 0.1d |
| W5 | admin UI — 不整合一覧画面（`/root/consistency`）+ 手動実行ボタン | 0.25d |
| W6 | admin UI — 解消マークモーダル + 実行ログ一覧タブ | 0.1d |
| W7 | Chatwork 通知（critical 即時 + 日次サマリ） | 0.1d |
| W8 | 動作確認・テスト（dev 環境でサンプル不整合を意図的に作成して確認） | 0.25d |
| **合計** | | **1.25d** |

---

## 12. 判断保留

| # | 論点 | 本 spec のスタンス |
|---|---|---|
| 判1 | **root_partners の意味**（最重要） | root_vendors の別名（案 a）と仮定。東海林さんに要ヒアリング（U1） |
| 判2 | **自動修正の可否** | 禁止。解消マークのみ提供。将来の許可は U5 で確認 |
| 判3 | **チェック頻度** | 日次 02:00 JST を既定値。Vercel Cron 設定変更で調整可能 |
| 判4 | **STA-04（Bud 側振込参照）の実装場所** | Root 外のチェックは a-bud 担当（§8.1 参照） |
| 判5 | **BIZ-03/04 の重要度** | 現状 high だが給与計算誤りに繋がるため critical への格上げを東海林さんに確認 |
| 判6 | **BIZ-08 の重複判定基準** | `vendor_name_kana` 完全一致。部分一致は誤検知リスクがあるため保留 |
| 判7 | **解消マークの権限** | admin / super_admin 限定。manager への開放の可否は要確認 |
| 判8 | **3 日超過エスカレーション先** | Chatwork 通知先チャンネルを東海林さんに確認（U4） |
| 判9 | **outsource の担当 vendor との紐付け** | 現状 employee に vendor_id フィールドなし。追加時は整合チェック対象に追加 |
| 判10 | **attendance vs attendance_daily の月次合計一致チェック** | 本 Phase の対象外。Phase C で検討 |

---

## 13. 未確認事項（東海林さんに要ヒアリング）

| # | 未確認事項 |
|---|---|
| U1 | **root_partners の意味**：(a) root_vendors と同義 / (b) 法人外注先の新テーブル / (c) 提携法人テーブル、のどれか。本 spec の最重要前提 |
| U2 | BIZ-03/04 を critical に格上げしてよいか |
| U3 | 解消マークの権限を manager にも開放するか（現状 admin 限定） |
| U4 | Chatwork 通知の送信先チャンネル ID（critical 即時・日次サマリ） |
| U5 | 自動修正（例: STA-07 で contract_end_on 過去日の outsource を is_active=false に自動更新）を将来的に許可するか |
| U6 | `root_insurance` に有効レコードがない場合（BIZ-07）のフォールバック動作（エラー vs 警告） |

— end of Root Phase B-4 spec —
