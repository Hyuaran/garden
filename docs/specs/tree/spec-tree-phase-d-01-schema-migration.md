# Tree Phase D-01: DB スキーマ migration（架電アプリ基盤テーブル）

- 対象: `tree_calling_sessions` / `tree_call_records` / `tree_agent_assignments` の新規作成、Soil 連携の双方向パイプ
- 優先度: **🔴 最高**（Phase D 全機能の前提。02〜06 はすべてこのスキーマに依存）
- 見積: **0.9d**
- 担当セッション: a-tree
- 作成: 2026-04-25（a-auto / Batch 9 Tree Phase D #01）
- 前提:
  - `root_employees` / `garden_role` 7 階層（Root 既設）
  - Soil `soil_call_lists` / `soil_call_histories`（営業リスト 253 万件 / コール履歴 335 万件、Phase C で拡張予定）
  - spec-cross-rls-audit（Batch 7）
  - spec-cross-audit-log（Batch 7）
  - spec-leaf-kanden-phase-c-01-schema-migration（列制限 Trigger・論理削除パターン踏襲）

---

## 1. 目的とスコープ

### 目的

FileMaker で稼働中の架電業務（コールセンター中核業務）を Garden に**完全再現**するため、セッション集計・コール履歴・オペレーター割当の 3 テーブルを Supabase に新設し、既存 Soil（リスト・コール履歴 DB 基盤）との双方向同期を設計する。

### 含める

- 新設 3 テーブル（`tree_calling_sessions` / `tree_call_records` / `tree_agent_assignments`）
- Soil 連携のデータフロー（pull → call → push）
- RLS ポリシー 4 階層（オペレーター / マネージャー / admin / super_admin）
- 列制限 Trigger（Leaf C-01 パターン踏襲）
- 論理削除（`deleted_at`）の運用ルール
- FileMaker 既存データ移行バッチ設計（読み取り専用アーカイブ方式）
- migration 適用順序と rollback 手順

### 含めない

- UI 実装（D-02 / D-03）
- トスアップ連携詳細（D-04、ここではスキーマ接合点のみ）
- KPI ダッシュボードの集計 VIEW（D-05 で別途定義）
- 録音ファイル Storage 設計（§判断保留、Phase D-1.5 相当）

---

## 2. 既存実装との関係

### 2.1 既存 Tree（`src/app/tree/`）と新テーブルの接続点

| 既存箇所 | 新テーブルとの接続 |
|---|---|
| `TreeStateContext.TreeStats`（Phase C で Supabase 連携予定） | `tree_call_records` の集計値を置換 |
| `_constants/callButtons.ts`（Sprout 10 / Branch 11 ラベル） | `tree_call_records.result_code` の enum 値に転写 |
| `calling/sprout/page.tsx` / `calling/branch/page.tsx` | 結果入力時に `tree_call_records` INSERT |
| `alerts/page.tsx` | 関連通知は Rill 経由の Chatwork、本 spec ではメタのみ |
| Breeze（呼吸モード）/ QuadTimer | `tree_calling_sessions.mode = 'breeze'` で区別 |

### 2.2 Soil 連携（営業リスト × コール履歴）

既存 Soil テーブル（想定）:

```
soil_call_lists
  - list_id (pk)
  - campaign_code (関電 / 光 / クレカ 等)
  - customer_name, phone, address, ...
  - status (untouched / assigned / in_progress / done / ng / retry)
  - acquired_at / released_at
  - owner_employee_id (割当中オペレーター、未割当は null)

soil_call_histories
  - history_id (pk)
  - list_id (fk soil_call_lists)
  - called_at
  - result_code
  - employee_id
  - memo
```

Phase D では **Tree が上記 2 テーブルへ INSERT/UPDATE**、**Soil が集計・BI 参照のみ**を担う役割分担で運用する。同一テーブル重複ではなく、**Tree 側の新テーブルは Soil の summary を再集計した高速 VIEW 兼運用台帳**として位置付ける。

### 2.3 FileMaker 既存資産

- FM 稼働中: 営業リスト約 100 万件 / 月、コール履歴約 200 万件 / 月
- Soil への逐次投入スクリプトは既存（Python + FM ODBC）
- Garden Tree α版は **Soil にある既投入データ**を前提に、新規コール分のみ Garden Tree から書き込む

---

## 3. データモデル: migration SQL

### 3.1 `tree_calling_sessions`（セッション単位のコール集計）

```sql
-- supabase/migrations/20260601_01_tree_calling_sessions.sql
BEGIN;

CREATE TABLE tree_calling_sessions (
  session_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          text NOT NULL REFERENCES root_employees(employee_number),
  campaign_code        text NOT NULL,   -- 関電 / 光回線 / クレカ 等（Soil と同軸）
  mode                 text NOT NULL CHECK (mode IN ('sprout', 'branch', 'breeze', 'aporan', 'confirm')),
  started_at           timestamptz NOT NULL DEFAULT now(),
  ended_at             timestamptz,
  total_calls          int NOT NULL DEFAULT 0,
  total_connected      int NOT NULL DEFAULT 0,
  total_toss           int NOT NULL DEFAULT 0,
  total_orders         int NOT NULL DEFAULT 0,
  total_ng             int NOT NULL DEFAULT 0,
  total_retry          int NOT NULL DEFAULT 0,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT chk_time_ok CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_tcs_employee_started ON tree_calling_sessions (employee_id, started_at DESC);
CREATE INDEX idx_tcs_campaign_started ON tree_calling_sessions (campaign_code, started_at DESC);
CREATE INDEX idx_tcs_active ON tree_calling_sessions (employee_id) WHERE ended_at IS NULL AND deleted_at IS NULL;
```

- `mode` は既存 Tree の 5 画面種別（Sprout / Branch / Breeze / Aporan / Confirm）に合わせる
- 同一オペレーターは **同時アクティブセッション 1 本**のみ（`idx_tcs_active` unique 相当、アプリ層で強制）
- 集計カウンタ（`total_*`）は結果入力時の Trigger で更新（後述 §3.5）

### 3.2 `tree_call_records`（1 コール 1 レコード、ステータス遷移履歴）

```sql
CREATE TABLE tree_call_records (
  call_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL REFERENCES tree_calling_sessions(session_id),
  list_id              bigint REFERENCES soil_call_lists(list_id),  -- Soil 連携
  employee_id          text NOT NULL REFERENCES root_employees(employee_number),
  campaign_code        text NOT NULL,
  result_code          text NOT NULL,   -- 'toss', 'order', 'sight_A', 'sight_B', 'sight_C', 'unreach', 'ng_refuse', 'ng_claim', 'ng_contracted', 'ng_other', 'coin' 等
  result_group         text NOT NULL CHECK (result_group IN ('positive', 'pending', 'negative', 'neutral')),
  called_at            timestamptz NOT NULL DEFAULT now(),
  duration_sec         int,             -- 通話秒数（Breeze の自動計測から）
  memo                 text,
  agreement_confirmed  boolean NOT NULL DEFAULT false,  -- 同意確認取得済か
  tossed_leaf_case_id  uuid,            -- D-04 トスアップ先 Leaf 案件
  rollback_reason      text,            -- ステータス巻き戻し時の理由
  prev_result_code     text,            -- 直前の result_code（巻き戻し追跡）
  recording_storage_key text,           -- Storage の録音 Key（§判断保留）
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX idx_tcr_session ON tree_call_records (session_id);
CREATE INDEX idx_tcr_list ON tree_call_records (list_id) WHERE list_id IS NOT NULL;
CREATE INDEX idx_tcr_employee_called ON tree_call_records (employee_id, called_at DESC);
CREATE INDEX idx_tcr_result ON tree_call_records (result_code, called_at DESC);
CREATE INDEX idx_tcr_toss ON tree_call_records (tossed_leaf_case_id) WHERE tossed_leaf_case_id IS NOT NULL;
```

- `result_code` は `_constants/callButtons.ts` と完全一致させる（Sprout 10 種 + Branch 11 種 = 15 種を string enum）
- `result_group` は KPI 集計用の 4 分類（positive = toss/order/coin、pending = sight_A-C、negative = ng_*、neutral = unreach）
- `list_id` は null 可（FM 時代の無リスト架電・手入力番号を許容）。ただしリスト連携キャンペーンでは NOT NULL をアプリ層で強制

### 3.3 `tree_agent_assignments`（オペレーター ↔ リスト割当）

```sql
CREATE TABLE tree_agent_assignments (
  assignment_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          text NOT NULL REFERENCES root_employees(employee_number),
  campaign_code        text NOT NULL,
  list_id              bigint NOT NULL REFERENCES soil_call_lists(list_id),
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  released_at          timestamptz,
  release_reason       text CHECK (release_reason IN ('done', 'passed', 'timeout', 'reassigned', 'manual')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT chk_release_after_assign CHECK (released_at IS NULL OR released_at >= assigned_at)
);

CREATE UNIQUE INDEX idx_taa_active ON tree_agent_assignments (list_id)
  WHERE released_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_taa_employee_active ON tree_agent_assignments (employee_id)
  WHERE released_at IS NULL AND deleted_at IS NULL;
```

- **1 リスト 1 アクティブ割当**（部分 unique index）で同時並行架電を防止
- 割当解除理由（`release_reason`）で FM のハンドオフ文化を再現

### 3.4 Soil 側の最小追加列

```sql
ALTER TABLE soil_call_lists
  ADD COLUMN IF NOT EXISTS last_tree_session_id uuid REFERENCES tree_calling_sessions(session_id),
  ADD COLUMN IF NOT EXISTS last_tree_call_id    uuid REFERENCES tree_call_records(call_id),
  ADD COLUMN IF NOT EXISTS last_tree_touched_at timestamptz;
```

- Tree から Soil を直接 UPDATE する代わりに、Tree 側で集計済のキーのみを Soil に逆反映。BI 集計の高速化が目的

### 3.5 集計 Trigger（結果入力のたびに session 集計を更新）

```sql
CREATE OR REPLACE FUNCTION trg_tcr_update_session_totals() RETURNS trigger AS $$
BEGIN
  UPDATE tree_calling_sessions
  SET total_calls     = total_calls + 1,
      total_connected = total_connected + CASE WHEN NEW.result_code <> 'unreach' THEN 1 ELSE 0 END,
      total_toss      = total_toss + CASE WHEN NEW.result_code = 'toss' THEN 1 ELSE 0 END,
      total_orders    = total_orders + CASE WHEN NEW.result_code = 'order' THEN 1 ELSE 0 END,
      total_ng        = total_ng + CASE WHEN NEW.result_code LIKE 'ng_%' THEN 1 ELSE 0 END,
      total_retry     = total_retry + CASE WHEN NEW.result_code LIKE 'sight_%' THEN 1 ELSE 0 END,
      updated_at      = now()
  WHERE session_id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tcr_after_insert
  AFTER INSERT ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION trg_tcr_update_session_totals();
```

### 3.6 列制限 Trigger（Leaf C-01 パターン踏襲）

誤って `employee_id` や `campaign_code` を UPDATE しないよう、Trigger で弾く：

```sql
CREATE OR REPLACE FUNCTION trg_tcr_guard_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.session_id   IS DISTINCT FROM NEW.session_id   THEN RAISE EXCEPTION 'session_id is immutable'; END IF;
  IF OLD.list_id      IS DISTINCT FROM NEW.list_id      THEN RAISE EXCEPTION 'list_id is immutable'; END IF;
  IF OLD.employee_id  IS DISTINCT FROM NEW.employee_id  THEN RAISE EXCEPTION 'employee_id is immutable'; END IF;
  IF OLD.campaign_code IS DISTINCT FROM NEW.campaign_code THEN RAISE EXCEPTION 'campaign_code is immutable'; END IF;
  IF OLD.called_at    IS DISTINCT FROM NEW.called_at    THEN RAISE EXCEPTION 'called_at is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tcr_before_update
  BEFORE UPDATE ON tree_call_records
  FOR EACH ROW EXECUTE FUNCTION trg_tcr_guard_immutable();
```

- 許容する UPDATE は `result_code` / `memo` / `agreement_confirmed` / `tossed_leaf_case_id` / `rollback_reason` / `prev_result_code` / `deleted_at` のみ

---

## 4. RLS ポリシー（4 階層）

spec-cross-rls-audit §4「garden_role 判定ヘルパ」を前提に、以下を適用：

### 4.1 `tree_calling_sessions`

```sql
ALTER TABLE tree_calling_sessions ENABLE ROW LEVEL SECURITY;

-- 営業（toss/closer）: 自分のセッションのみ SELECT/INSERT/UPDATE
CREATE POLICY tcs_select_self ON tree_calling_sessions FOR SELECT
  USING (employee_id = auth_employee_number());
CREATE POLICY tcs_insert_self ON tree_calling_sessions FOR INSERT
  WITH CHECK (employee_id = auth_employee_number());
CREATE POLICY tcs_update_self_open ON tree_calling_sessions FOR UPDATE
  USING (employee_id = auth_employee_number() AND ended_at IS NULL)
  WITH CHECK (employee_id = auth_employee_number());

-- マネージャー（manager）: v3.1 改訂で「自分担当 only」に縮退
-- 旧: USING (has_role_at_least('manager') AND is_same_department(employee_id))
-- 新: USING (has_role_at_least('manager') AND employee_id = auth_employee_number())
-- 理由: Batch 7 (root-002-38 / PR #154) で is_same_department が縮退
--        （root_employees.department_id 列なし + root_departments マスタなし）
-- 将来の再導入: department 運用ルール確定後に「自部署絞込」へ復帰、本 spec §4.1 を再改訂
CREATE POLICY tcs_select_manager ON tree_calling_sessions FOR SELECT
  USING (has_role_at_least('manager') AND employee_id = auth_employee_number());

-- admin / super_admin: 全件 SELECT/UPDATE（削除は super_admin のみ）
CREATE POLICY tcs_all_admin ON tree_calling_sessions FOR ALL
  USING (has_role_at_least('admin'))
  WITH CHECK (has_role_at_least('admin'));
```

- `auth_employee_number()` / `has_role_at_least()` は spec-cross-rls-audit / Batch 7 (PR #154) で実装済
- `is_same_department()` は **Batch 7 で縮退** （root_employees.department_id 列なし + root_departments マスタなし）。本 spec §4.1 では「マネージャー = 自分担当 only」に縮退対応。
- 縮退方針確定経緯: main- No. 233（a-main-020 → a-root-002）→ root-002-38（is_same_department Q2 (b) 採用、Batch 7 で省略）→ main- No. 238（a-main-020 → a-tree-002、本 spec 改訂依頼）
- 将来の再導入条件:
  - `root_employees.department_id` 列追加（schema 拡張）
  - `root_departments` マスタテーブル新規作成
  - department 運用ルール確定（異動 / 複数所属 等）
- 上記が満たされた段階で `is_same_department()` 再実装 → 本 spec §4.1 を「自分担当 only」→「マネージャー自部署絞込」に再改訂（管理者向け広範囲 SELECT を復活）
- 現状（縮退中）の管理者横断 SELECT は admin / super_admin のみ可（§4.1 末尾の `tcs_all_admin` ポリシー）

### 4.2 `tree_call_records`

- SELECT: 自分のコールのみ（manager+ も同様、is_same_department 縮退中）、全件は admin+
- INSERT: 自分の session_id に対してのみ
- UPDATE: **本人は同日分（called_at >= now()::date）のみ**、admin+ は全件（manager+ も縮退中は自分の同日分のみ）
- DELETE 直接禁止（論理削除のみ、`deleted_at` の UPDATE で実現）

v3.1 縮退注記: is_same_department が Batch 7 で縮退したため、現状は「manager 権限でも自部署横断不可」（自分担当 only）。将来 department 運用確定で再導入時に「マネージャー = 自部署全コール」へ復活。

### 4.3 `tree_agent_assignments`

- SELECT: 営業は自分の割当のみ（manager+ も同様、is_same_department 縮退中）、admin+ は全件
- INSERT/UPDATE: **manager 以上のみ**（営業が自分で割当を引くのは spec-tree-d-02 の pull モードで別途 RLS バイパス経由）
- DELETE 禁止（論理削除）

v3.1 縮退注記: is_same_department が Batch 7 で縮退したため、現状は「manager 権限でも自部署全オペレーターの割当閲覧不可」（自分の割当 only）。将来 department 運用確定で再導入時に「マネージャー = 自部署全オペレーター」へ復活。

### 4.4 SELECT ビュー: 通常オペレーター向けサマリ（Soil + Tree 結合）

```sql
CREATE OR REPLACE VIEW v_tree_operator_today AS
SELECT
  s.employee_id,
  s.campaign_code,
  s.session_id,
  s.started_at,
  s.total_calls,
  s.total_toss,
  s.total_orders,
  s.total_ng,
  (SELECT count(*) FROM tree_agent_assignments a
   WHERE a.employee_id = s.employee_id AND a.released_at IS NULL) AS active_assignments
FROM tree_calling_sessions s
WHERE s.started_at >= (now() AT TIME ZONE 'Asia/Tokyo')::date
  AND s.deleted_at IS NULL;
```

- VIEW は `SECURITY INVOKER`（既定）で発行、呼び出し元の RLS を継承

---

## 5. 監査ログ連携

spec-cross-audit-log の `audit_logs` テーブルに以下イベントを INSERT：

| イベント | 発生契機 | データ |
|---|---|---|
| `tree.session.open` | INSERT `tree_calling_sessions` | `{ session_id, mode, campaign_code }` |
| `tree.session.close` | UPDATE `ended_at` not null | `{ session_id, total_calls, duration_min }` |
| `tree.call.record` | INSERT `tree_call_records` | `{ call_id, result_code }` |
| `tree.call.rollback` | UPDATE `result_code` かつ `prev_result_code` set | `{ call_id, from, to, reason }` |
| `tree.assignment.allocate` | INSERT/UPDATE `tree_agent_assignments` | `{ assignment_id, employee_id, list_id }` |
| `tree.assignment.release` | UPDATE `released_at` not null | `{ assignment_id, release_reason }` |

---

## 6. FileMaker 既存データ移行

### 6.1 方針

**既存 FM データは Garden Tree に INSERT せず、Soil に投入済のものだけを利用**。

- FM → Soil の既存バッチ（Python + ODBC）は稼働継続
- Garden Tree α版の β前ベースライン: 「Soil 既投入 100 万件 + Garden Tree 新規コール分」
- FM 側の履歴データを遡って INSERT しない（ID 衝突リスク・性能リスク回避）

### 6.2 読み取り専用アーカイブ VIEW（情報参照用）

FM 時代のコール履歴を Tree 側から参照できる VIEW を定義（新規書き込みはしない）：

```sql
CREATE OR REPLACE VIEW v_tree_legacy_history AS
SELECT
  h.history_id AS legacy_id,
  h.list_id,
  h.called_at,
  h.result_code   AS legacy_result_code,
  h.employee_id,
  h.memo
FROM soil_call_histories h
WHERE h.source = 'filemaker';  -- Soil 側で source 列を追加、FM 投入時に 'filemaker' を入れる
```

### 6.3 切替スケジュール

| 段階 | FM | Garden Tree |
|---|---|---|
| α版（東海林さん 1 人） | 通常稼働 | 並行書込、結果比較 |
| β版 1 人（1 週間） | 通常稼働 | 当該 1 名のみ Garden |
| β版 2-3 人（1 週間） | 通常稼働 | 3 名のみ Garden |
| 半数（1-2 週間） | 通常稼働 | 半数 Garden、残り FM |
| 全員切替 | **読み取り専用**に降格 | 本番 |
| 切替後 30 日 | 参照のみ、差分確認期間 | 本番 |
| +30 日以降 | アーカイブフォルダに退避 | 本番 |

詳細は D-06 §5 Tree 特例。

---

## 7. migration 順序と rollback

### 7.1 適用順序

1. `20260601_01_tree_calling_sessions.sql`（Sessions）
2. `20260601_02_tree_call_records.sql`（Records + Trigger）
3. `20260601_03_tree_agent_assignments.sql`（Assignments + unique index）
4. `20260601_04_soil_link_columns.sql`（Soil 側の追加列）
5. `20260601_05_tree_rls_policies.sql`（RLS 有効化 + 全ポリシー）
6. `20260601_06_tree_views.sql`（`v_tree_operator_today` / `v_tree_legacy_history`）
7. `20260601_07_audit_triggers.sql`（監査ログ連携）

### 7.2 rollback（逆順）

- 全 migration に `BEGIN; ... COMMIT;` を徹底
- rollback 用 `down.sql` を各 migration の隣に配置
- 本番適用前に **dev で 3 往復**（up → down → up → down → up）で冪等性確認

---

## 8. 性能見積

| 指標 | 目標 | 計算根拠 |
|---|---|---|
| 1 コール INSERT 時の応答 | < 50ms | Trigger 集計込、部分 index の恩恵で高速 |
| `v_tree_operator_today` 参照 | < 100ms | 当日分のみ + 部分 index |
| マネージャーダッシュボード（§D-03）全セッション | < 300ms | 自部署 max 50 人 × 当日 session 1 本 |
| 月次 KPI 集計（§D-05） | < 5s | 月次 50 万コール想定、pre-aggregate VIEW 併用 |

---

## 9. テスト観点

- ユニット（PG 関数）: Trigger の集計更新、列制限、rollback 差分
- 統合（RLS）: 4 階層ユーザーでの SELECT/INSERT/UPDATE 許容範囲
- E2E: D-02 オペレーター UI 経由の 1 コール往復、session open/close 挙動
- 負荷: 1 日 10 万コール想定で INSERT 集中時の応答劣化検証
- 詳細は D-06 §3-4 を参照

---

## 10. 判断保留事項（a-auto では決めない）

- **判1: 録音ファイル Storage 設計**
  - 録音は現状 FM 外部（別 PBX / クラウド PBX）に依存
  - `tree_call_records.recording_storage_key` を Storage `call-recordings/` に置くか、別ベンダー URL を格納するか
  - **推定スタンス**: Phase D-1 では PBX URL 格納のみ、Storage 統合は D-1.5 で別途検討
- **判2: `result_code` の enum 化**
  - 現在の `_constants/callButtons.ts` は TypeScript constant
  - DB CHECK 制約で hard-code すべきか、別テーブル `tree_result_codes` で柔軟化すべきか
  - **推定スタンス**: CHECK 制約で hard-code（営業ロジック変更は年 1-2 回、migration で耐えられる）
- **判3: リスト割当アルゴリズム**
  - 現在 FM では手動割当が多い。自動化するか（FIFO / round-robin / skill-based）
  - **推定スタンス**: Phase D-1 は手動維持、D-2 以降で round-robin を検討
- **判4: Soil との整合性チェック頻度**
  - 夜間バッチで整合性確認（Tree 集計 vs Soil 集計）すべきか
  - **推定スタンス**: 日次 23:00 に整合性 SQL を走らせ、差分 > 0.1% で Chatwork アラート
- **判5: 監査ログの保存期間**
  - 架電の法定保存は 3 年（景表法準拠）/ 7 年（税務関連時）
  - **推定スタンス**: **7 年固定**（Leaf C-01 の「解約後データ永続」方針と統一）
- **判6: `tree_call_records` パーティショニング**
  - 月間 50 万件 × 12 = 年 600 万件。2 年で 1,200 万件
  - **推定スタンス**: 初期は単一テーブル、3,000 万件到達時に `called_at` 月次パーティション化

---

## 11. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| migration SQL 7 本（新規 + rollback）| 3h |
| Trigger + VIEW 作成・テスト | 2h |
| RLS ポリシー + ヘルパ関数の動作確認 | 2h |
| Soil 既存構造調査と Tree 側接続点整備 | 1h |
| migration を dev で 3 往復 + seed データ投入 | 1h |
| **合計** | **0.9d**（約 9h）|

---

## 12. 改訂履歴

| 日付 | 版 | 改訂内容 | 担当セッション |
|---|---|---|---|
| 2026-04-25 | v1.0（初版）| Phase D-01 schema migration spec 起草（テーブル 3 / RLS 4 階層 / Trigger 6 / VIEW 2）| a-auto / Batch 9 |
| 2026-05-11 | v1.1 | §4.1 / §4.2 / §4.3 RLS ポリシー改訂: `is_same_department()` 縮退対応で「マネージャー = 自部署絞込」を「自分担当 only」に縮退。Batch 7 (PR #154) 採用に伴う措置。将来 department 運用確定で再導入時に「自部署絞込」へ復活予定。確定経緯: main- No. 233（→ a-root-002）→ root-002-38（Batch 7 縮退）→ main- No. 238（→ a-tree-002、本 spec 改訂依頼）| a-tree-002 |

---

— spec-tree-phase-d-01 end —
