# Garden RLS 設計ガイド（統一テンプレート運用）

- 優先度: **🔴 高**
- 作成: 2026-05-11
- 関連 PR: PR #154 (cross_rls_helpers — has_role_at_least / auth_employee_number)
- 関連 plan: `docs/specs/plans/2026-05-11-garden-unified-auth-plan.md` Task 4
- 関連 spec: `docs/specs/cross-cutting/spec-cross-rls-audit.md`
- 関連 script: `scripts/garden-rls-unified-template.sql`

---

## 1. 目的

### 1.1 本ガイドのスコープ

Garden 全 12 モジュール（Soil / Root / Tree / Leaf / Bud / Bloom / Seed / Forest / Rill / Fruit / Sprout / Calendar）で **RLS ポリシーの記述方法を統一** することを目的とする。

具体的には：

1. PR #154 で merged された helper（`has_role_at_least` / `auth_employee_number`）を **新規テーブルのデフォルト** として運用
2. 各モジュール固有 helper（`root_can_access` / `bloom_has_access` / `tree_can_view_confirm` 等）を **段階的に wrapper 化** して整理
3. 新規テーブル追加時に **コピペで RLS が完成する雛形** を提供
4. RLS 関連バグの再発防止（Bloom PDF 事件 PR #17 のような事故の予防）

### 1.2 非スコープ（本ガイドではやらない）

- 既存テーブルの実マイグレーション（**別 PR / 別 Phase**）
- module ごとの個別 RLS 改訂（spec 改訂タイミングで個別実施）
- root_can_access / root_can_write を has_role_at_least wrapper で置換する実 SQL（Phase B-5）

### 1.3 想定読者

- 新規モジュール / テーブルを追加する各セッション（a-soil / a-root / a-tree 等）
- RLS 修正 PR をレビューする横断調整セッション（a-main）

---

## 2. helper 関数対応表（既存 ↔ 新）

| 既存 helper | 新 helper（PR #154）| 等価条件 | 廃止予定 |
|---|---|---|---|
| `root_can_access()` | `has_role_at_least('manager')` | manager / admin / super_admin で true | Phase B-5（wrapper 化） |
| `root_can_write()` | `has_role_at_least('admin')` | admin / super_admin で true | Phase B-5（wrapper 化） |
| `root_is_super_admin()` | `has_role_at_least('super_admin')` | super_admin のみ true | Phase B-5（wrapper 化） |
| `tree_can_view_confirm()` | `has_role_at_least('cs')` | cs / staff / manager / admin / super_admin で true | Phase D-α（wrapper 化） |
| `bloom_has_access(role_min)` | `has_role_at_least(role_min)` | 同等（bloom_has_access は bloom 専用 wrapper） | Phase A-2 で統合検討 |
| `current_garden_role()` | （継続利用）| 現ログインユーザーの garden_role を text で返す | 廃止しない |
| （N/A） | `auth_employee_number()` | 現ユーザの employee_number (text) | 新規 |

### 2.1 段階的置換方針

- **Phase 1**（本 Task 4、2026-05-11）: 統一テンプレート + 設計ガイドのみ起草、既存運用は維持
- **Phase 2**（Phase B-5、2026-05〜06）: `root_can_*` を `has_role_at_least` の wrapper として再定義
  ```sql
  CREATE OR REPLACE FUNCTION root_can_access() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER STABLE
  AS $$ SELECT has_role_at_least('manager'); $$;
  ```
- **Phase 3**（module spec 改訂タイミング）: 各 module 固有 helper（`bloom_has_access` 等）も同様に wrapper 化
- **Phase 4**（全 module 移行後）: 旧 helper を deprecated marker でアナウンス、新規利用禁止

### 2.2 既存利用の安全性

`root_can_access()` を Phase B-5 で wrapper 化しても、内部実装が変わるだけで戻り値は等価。既存の policy / 呼出側は無修正で動作する。

---

## 3. RLS pattern 選択フローチャート

新規テーブルに RLS を追加する際、以下のフローで pattern を選択する：

```
┌─ Q1: super_admin（東海林さん本人）のみ閲覧 / 編集？
│   YES → Pattern E（super_admin only）
│   NO  → Q2
│
├─ Q2: 機密情報 / 監査ログで admin 以上のみ閲覧？
│   YES → Pattern D（admin only）
│   NO  → Q3
│
├─ Q3: 業務上「自分担当の行」だけ操作する？（営業 / 架電 / 担当案件）
│   YES → Pattern C（自分担当 only + manager 全件閲覧）
│   NO  → Q4
│
├─ Q4: 「本人 only」閲覧 + manager 以上は全件閲覧？（個人属性 / 給与 / 勤怠）
│   YES → Pattern B（本人 only + manager 全件閲覧 + admin 書込）
│   NO  → Q5
│
└─ Q5: 全員閲覧 / admin 編集？（マスタデータ）
    YES → Pattern A（全員閲覧 + admin 書込）
    NO  → 設計再考（複合 pattern が必要、別途設計）
```

### 3.1 Pattern サマリ

| Pattern | SELECT | INSERT / UPDATE | 適用例 |
|---|---|---|---|
| **A**（マスタ） | staff 以上全員 | admin のみ | 法人 / 給与体系 / バンク / 取引先 |
| **B**（個人情報） | 本人 + manager 全件 | admin のみ | 従業員 / 給与明細 / 個人勤怠 |
| **C**（担当案件） | 自分担当 + manager 全件 | 自分担当 + admin 全件 | 架電案件 / Leaf 案件 / 通話セッション |
| **D**（機密） | admin のみ | admin のみ | 監査ログ / 同期ログ / 承認ログ |
| **E**（極秘） | super_admin のみ | super_admin のみ | 役員報酬 / super_admin 履歴 |

### 3.2 複合 pattern が必要なケース

- 同一テーブルで「列ごとに表示 / 非表示が異なる」（例: bloom_worker_status の "忙しさ指標のみ" 制限）
  → 行レベル RLS では対応不能。**view + クライアント側の列制限** で実装（spec: `bloom-rls.sql` §10.3 判4）

- 期間限定で「自分行のみ編集可」（例: tree_calling_sessions の ended_at IS NULL の間）
  → Pattern C の USING に追加条件を AND（例: `AND ended_at IS NULL`）

---

## 4. 既存テーブル RLS 現状監査表

本章では既存テーブルの RLS 現状を **テーブル名リストアップのみ** で示す。詳細な現状 RLS と移行計画は別 spec（各モジュールの module spec）で扱う。

### 4.1 Root モジュール（`scripts/root-rls-phase1.sql`, `root-rls-employees.sql` 適用済）

| テーブル | 現 pattern 相当 | 使用 helper | 想定統一後 |
|---|---|---|---|
| root_companies | A | root_can_access / root_can_write | Pattern A（has_role_at_least 化） |
| root_bank_accounts | A | 同上 | Pattern A |
| root_vendors | A | 同上 | Pattern A |
| root_salary_systems | A | 同上 | Pattern A |
| root_insurance | A | 同上 | Pattern A |
| root_attendance | A → B 検討 | 同上 | Pattern B（個人勤怠は本人 only に縮退検討） |
| root_employees | B | root_can_access / root_can_write + employee_number 直接比較 | Pattern B（has_role_at_least + auth_employee_number 化） |
| root_audit_log | D | 未設定（adminのみアクセス想定）| Pattern D |
| root_kot_sync_log | D | 未設定 | Pattern D |

### 4.2 Tree モジュール（`docs/specs/tree/spec-tree-phase-d-01-schema-migration.md`）

| テーブル | 現 pattern 相当 | 想定統一後 |
|---|---|---|
| tree_prospects | C | Pattern C（既に has_role_at_least 採用） |
| tree_calling_sessions | C（v3.1 縮退済）| Pattern C |
| tree_call_results | C | Pattern C |

### 4.3 Bloom モジュール（`scripts/bloom-rls.sql` 適用済）

| テーブル | 現 pattern 相当 | 想定統一後 |
|---|---|---|
| bloom_worker_status | C 変形（行は共有 / 列制限）| Pattern C + view |
| bloom_daily_logs | B | Pattern B |
| bloom_roadmap_items | A | Pattern A |
| bloom_kpi_metrics | A | Pattern A |
| bloom_monthly_digest | A | Pattern A |
| bloom_chatwork_log | D | Pattern D |
| bloom_pdf_export_log | D | Pattern D |

### 4.4 Bud モジュール（`scripts/bud-rls.sql`, `bud-rls-v2.sql`, `bud-rls-v3-review-fixes.sql`）

詳細監査は Phase B 実装時に別 spec で実施。想定 pattern：
- bud_furikomi_* → Pattern D（経理機密、admin 以上）
- bud_payslips → Pattern B（本人 + manager 全件）
- bud_payment_master 系 → Pattern A（全員参照、admin 編集）

### 4.5 Forest / Leaf / Soil / Seed / Rill / Fruit / Sprout / Calendar

- Forest: Phase A 仕上げ 7 タスク中 6 完走、本番稼働中（RLS 適用済、現状監査は別 spec）
- Leaf: 商材ごとに別テーブル、現状は 001_関西電力委託のみ実装
- Soil: spec `docs/specs/2026-04-25-soil-06-rls-design.md` で別途設計済
- Seed / Rill / Fruit / Sprout / Calendar: 未着手 or skeleton 段階

---

## 5. 段階的移行ロードマップ

統一テンプレートへの移行は **4 phase** で段階的に進める。各 phase は前段の完了が前提。

### Phase 1: テンプレート整備（本 Task 4、2026-05-11） ✅ 本 PR

- `scripts/garden-rls-unified-template.sql` 起草（5 pattern + アンチパターン集）
- `docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md` 起草（本ファイル）
- `scripts/root-rls-phase1.sql` 末尾に将来計画コメント追加
- **既存テーブルの実マイグレーションは行わない**
- Acceptance: 既存 RLS 動作不変、PR merged

### Phase 2: wrapper 化（Root Phase B-5、2026-05〜06）

- `root_can_access` / `root_can_write` / `root_is_super_admin` を `has_role_at_least` の wrapper として再定義
- Tree 固有 helper `tree_can_view_confirm` も wrapper 化
- 既存 policy は無修正で動作（wrapper 内部置換のみ）
- Acceptance: 既存テスト全緑、policy 一覧（pg_policies）に変化なし

### Phase 3: モジュール別 RLS 改訂（各 module spec 改訂タイミング、2026-06〜）

- module spec の RLS 章を統一テンプレートに合わせて改訂
- 順序: Root → Tree → Bloom → Bud → Leaf → Forest → Soil → 残り
- module ごとに別 PR で漸進的に実施
- 各 PR で acceptance:
  - pg_policies 差分が想定通り
  - 既存 module test 全緑
  - β投入時に現場 FB 受付

### Phase 4: 旧 helper deprecated（全 module 移行完了後、2026-07〜）

- `bloom_has_access` 等の module 固有 helper に DEPRECATED コメント追加
- 新規 PR では `has_role_at_least` のみ使用
- 旧 helper の物理削除は **1 quarter 移行猶予** 後（少なくとも 3 ヶ月）

---

## 6. アンチパターン集（やってはいけない RLS）

memory `project_rls_server_client_audit.md` + 本 Task 4 で発見した実例から抽出。

### ❌ ① Route Handler でブラウザ用 anon supabase singleton を流用

**発生事例**: Bloom PDF 事件（PR #17、2026-04-24）

**症状**: 月次ダイジェスト PDF エクスポートが「データあるのに 404 not found」

**根本原因**:
- `src/app/bloom/monthly-digest/[month]/export/route.ts` が Node ランタイムでサーバー実行
- DB 取得で `src/app/bloom/_lib/supabase.ts` のブラウザ用 anon singleton を流用
- サーバーには auth セッションが無いため `auth.uid()` が NULL
- RLS `bloom_has_access('staff')` が全行ブロック → データ無しと誤認

**対策**:
- サーバー側 DB アクセスは **JWT 転送パターン** を使用
- `src/lib/supabase/server.ts` の `createAuthenticatedSupabase(request)` で Authorization ヘッダから JWT を転送
- 詳細: `docs/specs/cross-cutting/spec-cross-rls-audit.md` §2 パターンB

### ❌ ② INSERT / UPDATE 時に WITH CHECK 書き忘れ

**症状**: 既存行に対する USING は通るが、INSERT で書き忘れ列が混入

**根本原因**:
- `FOR ALL` policy で USING のみ書くと INSERT 時に評価される行が無い
- → INSERT は素通り（admin 以外でも INSERT 可能になる）

**例（NG）**:
```sql
CREATE POLICY xxx ON tbl FOR ALL
  USING (has_role_at_least('admin'));
-- WITH CHECK 無し → admin でないユーザーも INSERT 可
```

**対策**:
- `FOR ALL` / `FOR INSERT` / `FOR UPDATE` では **WITH CHECK を必ず併記**
- レビュー時に `with_check IS NULL` の policy を pg_policies で検出

```sql
SELECT tablename, policyname, cmd, with_check
  FROM pg_policies
  WHERE cmd IN ('INSERT', 'UPDATE', 'ALL') AND with_check IS NULL;
```

### ❌ ③ 巨大テーブル WHERE で has_role_at_least() を多用 → index lost

**発生想定**: Soil call_history（335 万件）/ list_master（253 万件）

**根本原因**:
- 行単位に `has_role_at_least('manager')` 評価 → PostgreSQL が index を捨てて seq scan
- 大量行に対して数百ミリ秒〜数秒のクエリ劣化

**対策**:
- 大量行テーブルは **view 経由で role check を集約**
- materialized view + cron 更新 で再計算頻度を抑制
- 詳細: `docs/specs/2026-04-25-soil-06-rls-design.md`

### ❌ ④ super_admin への昇格を UI から許可

**症状**: admin ユーザーが他人を super_admin に昇格、権限固定原則違反

**対策**:
- `scripts/garden-super-admin-lockdown.sql`（Task 5）で UI + DB trigger の二重防御
- DB trigger で super_admin への変更を block（service_role 以外）
- UI 側で `GARDEN_ROLE_SELECTABLE_OPTIONS` から super_admin 除外
- memory `project_super_admin_operation.md` 参照

### ❌ ⑤ helper 関数を SECURITY INVOKER で定義

**症状**: RLS ポリシー内で helper 呼出 → 再帰評価ループ → エラー or 性能劣化

**根本原因**:
- SECURITY INVOKER は呼出ユーザの権限で実行
- helper 内で root_employees を SELECT する場合、root_employees の RLS が再度評価される
- 再帰ループ or 「権限なし」エラー

**対策**:
- 全 helper は **SECURITY DEFINER + STABLE** で定義
- 定義者権限で実行 → RLS をバイパス可能
- 既存実装の参考: `scripts/root-auth-schema.sql` の `current_garden_role` / `root_can_access`

### ❌ ⑥ employee_number カラム dtype が int → text の auth_employee_number() と比較不可

**症状**: `WHERE employee_number = auth_employee_number()` がエラー or 常に false

**根本原因**:
- `auth_employee_number()` は text を返す（root_employees.employee_number に倣う）
- テーブル設計時に employee_number を int / bigint で作ると比較不可

**対策**:
- 業務キー employee_number は **全テーブル text** で統一（root_employees に倣う）
- マイグレーション前に dtype 確認:
  ```sql
  SELECT column_name, data_type
    FROM information_schema.columns
    WHERE column_name = 'employee_number';
  ```
- text 統一の理由: 「0001」「0008」のような **先頭ゼロ保持** が必須（int では 1 / 8 になる）

---

## 関連ドキュメント

- `scripts/garden-rls-unified-template.sql` — 本ガイドの SQL 雛形（コピペ用）
- `scripts/root-rls-phase1.sql` — Root Phase 1 適用済 RLS
- `scripts/root-auth-schema.sql` — root_can_access / root_can_write の定義元
- `docs/specs/cross-cutting/spec-cross-rls-audit.md` — Supabase クライアント 3 パターン + Bloom PDF 事件詳細
- `docs/specs/plans/2026-05-11-garden-unified-auth-plan.md` Task 4 — 本 PR のスコープ定義
- memory `project_rls_server_client_audit.md` — Bloom PDF 事件の根本原因と再発防止
- memory `project_super_admin_operation.md` — super_admin 権限固定運用
