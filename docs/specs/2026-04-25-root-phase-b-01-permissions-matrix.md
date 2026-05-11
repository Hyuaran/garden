# Root B-1: 権限詳細設計（DB 駆動権限マトリックス）仕様書

- 対象: Garden-Root の権限管理基盤（root_settings テーブル + 8 ロール × 機能マトリックス）
- 見積: **2.25d**（内訳は §10 参照）
- 担当セッション: a-root
- 作成: 2026-04-25（a-root / Phase B-1）
- 前提 spec: Phase 1 認証スキーマ（scripts/root-auth-schema.sql）、Phase A-3-g outsource 拡張

---

## 1. 目的とスコープ

### 目的

現状の `root_can_access()` / `root_can_write()` 等の**ハードコード型ロール判定**を、
データベースで管理するマトリックスへ段階的に移行し、**SQL 関数の改修なしで権限を動的変更**できる基盤を整備する。
これにより admin が管理画面から権限の付与・剥奪を即時反映でき、モジュール横断（Bud・Leaf・Tree 等）の権限チェックを一元化する。

### 含める

- `root_settings` テーブル設計（module × feature × role → permission の三項関係）
- 既存 SQL 関数の**後方互換維持**（root_settings に登録なし → 従来関数で判定）
- 汎用 helper 関数 `has_permission(module, feature)` の追加
- TypeScript 型定義・定数ファイル `src/app/root/_constants/permissions.ts`（実装時作成）
- admin UI のマトリックスエディタ（管理画面から設定変更）
- 8 ロール × 機能マトリックスの初期データ投入
- RLS ポリシー（root_settings 自体の保護）

### 含めない

- 既存ハードコード関数（root_can_access / root_can_write 等）の**削除・非推奨化**（Phase C で段階移行）
- 各モジュールの既存 RLS ポリシーの一括書き換え（個別モジュール側の責務）
- ロール自体の追加・削除（root_employees.garden_role の変更は別 migration）
- 監査ログの UI（B-2 spec に委ねる）
- 2FA / IP 制限等の認証強度変更

---

## 2. 既存実装との関係

### 2.1 Phase 1 整備済み（scripts/root-auth-schema.sql）

| 対象 | 内容 |
|---|---|
| `root_employees.garden_role` | text, CHECK 制約で 7 値（Phase A-3-g 以前） |
| `current_garden_role()` | 現ログインユーザーの role を返す SECURITY DEFINER 関数 |
| `root_can_access()` | manager 以上なら true（Root 画面閲覧） |
| `root_can_write()` | admin 以上なら true（Root データ編集） |
| `root_is_super_admin()` | super_admin か否か |
| `tree_can_view_confirm()` | cs 以上なら true（Tree 前確/後確） |
| `root_audit_log` | 監査ログテーブル（actor / action / target / payload） |

### 2.2 Phase A-3-g 追加（supabase/migrations/20260425000002）

| 対象 | 内容 |
|---|---|
| `garden_role` CHECK 制約 | **outsource** が staff と manager の間に追加 → **8 ロール確定** |
| `root_employees.contract_end_on` | 外注契約終了日（nullable） |
| `is_user_active()` | 退職・外注契約終了を考慮した活性判定 |
| `garden_role_of(uid)` | 指定 user_id の role を返す（Leaf/Bud/Forest 横断利用） |

### 2.3 ロール数の経緯と現状

**重要**: CLAUDE.md 等のドキュメントに「7 ロール」という記述が残存しているが、
Phase A-3-g の migration で `outsource` が正式追加され、**現在は 8 ロール**が正式値。
本 spec はこの 8 ロールを前提として設計する。
（ロール順: toss → closer → cs → staff → outsource → manager → admin → super_admin）

### 2.4 現状の課題

- 機能ごとの権限が SQL 関数内にハードコード → ビジネスルール変更のたびに migration 必要
- モジュール横断の権限チェックに統一 API がない（各モジュールが独自判定）
- admin が権限をリアルタイム調整できる仕組みがない

---

## 3. データモデル提案

### 3.1 `root_settings` テーブル（新規）

```sql
CREATE TABLE root_settings (
  module      text NOT NULL,   -- 'root' | 'bud' | 'leaf' | 'tree' | 'bloom' | 'forest' | 'soil' | 'rill'
  feature     text NOT NULL,   -- 機能識別子（§4 マトリックスの feature_key、英小文字スネークケース）
  role        text NOT NULL,   -- garden_role の 8 値いずれか
  permission  text NOT NULL DEFAULT 'denied'
    CHECK (permission IN ('allowed', 'denied', 'readonly')),
    -- readonly: 将来拡張用。初版では allowed / denied の 2 値で運用
  note        text,            -- 管理者メモ（変更理由など）
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (module, feature, role)
);

ALTER TABLE root_settings
  ADD CONSTRAINT root_settings_role_check
  CHECK (role IN (
    'toss', 'closer', 'cs', 'staff', 'outsource',
    'manager', 'admin', 'super_admin'
  ));

ALTER TABLE root_settings
  ADD CONSTRAINT root_settings_module_check
  CHECK (module IN (
    'root', 'bud', 'leaf', 'tree', 'bloom', 'forest', 'soil', 'rill'
  ));

COMMENT ON TABLE root_settings IS
  'Garden 全モジュールの権限マトリックス。(module, feature, role) → permission の三項関係。'
  '登録なし = 従来の SQL 関数（root_can_access 等）で fallback 判定（後方互換）。';
```

### 3.2 インデックス

```sql
-- 権限チェックのホットパス: (module, feature) での全 role 取得
CREATE INDEX root_settings_module_feature_idx
  ON root_settings (module, feature);

-- admin UI 用: module 単位での一覧表示
CREATE INDEX root_settings_module_idx
  ON root_settings (module);

-- 監査: 誰が変更したか追跡
CREATE INDEX root_settings_updated_by_idx
  ON root_settings (updated_by)
  WHERE updated_by IS NOT NULL;

-- 更新日時での絞り込み（最近の変更をモニタリング）
CREATE INDEX root_settings_updated_at_idx
  ON root_settings (updated_at DESC);
```

### 3.3 汎用 helper 関数

動作:
1. root_settings に `(module, feature, current_role)` の行が存在すれば、`permission` を返す（boolean 変換）
2. 行が存在しなければ従来 helper 関数で fallback 判定（後方互換）
3. 未ログイン / role 未設定 → false

```sql
CREATE OR REPLACE FUNCTION has_permission(
  p_module  text,
  p_feature text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  STABLE
AS $$
DECLARE
  v_role       text;
  v_permission text;
BEGIN
  -- 1. 現在のロールを取得
  v_role := current_garden_role();
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- 2. root_settings から明示的な設定を検索
  SELECT permission INTO v_permission
    FROM root_settings
    WHERE module   = p_module
      AND feature  = p_feature
      AND role     = v_role;

  IF FOUND THEN
    RETURN v_permission = 'allowed';
    -- NOTE: readonly は将来 tristate が必要になった時点で signature 変更。
    --       Phase B では allowed/denied のみ運用。
  END IF;

  -- 3. root_settings に未登録 → 従来の helper 関数で fallback
  RETURN CASE
    WHEN p_module = 'root' THEN
      CASE p_feature
        WHEN 'master_view'  THEN root_can_access()
        WHEN 'master_edit'  THEN root_can_write()
        WHEN 'settings_edit' THEN root_is_super_admin()
        ELSE false
      END
    WHEN p_module = 'tree' THEN
      CASE p_feature
        WHEN 'call_confirm_view' THEN tree_can_view_confirm()
        ELSE false
      END
    ELSE false
  END;
END;
$$;

COMMENT ON FUNCTION has_permission(text, text) IS
  'Phase B-1: 現ログインユーザーが (module, feature) の操作を許可されているか。'
  'root_settings に登録なければ従来関数で fallback（後方互換）。';
```

---

## 4. 8 ロール × 機能マトリックス

凡例: **○** = allowed / **×** = denied / **△** = readonly（初版では allowed と同等、UI 上で区別表示のみ）

### 4.1 Root モジュール（module = 'root'）

| feature_key | 機能名 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| master_view | マスタ閲覧（従業員・法人等） | × | × | × | × | × | ○ | ○ | ○ |
| master_edit | マスタ編集 | × | × | × | × | × | × | ○ | ○ |
| kot_sync_run | KoT 同期実行 | × | × | × | × | × | × | ○ | ○ |
| kot_sync_history | KoT 同期履歴閲覧 | × | × | × | × | × | ○ | ○ | ○ |
| settings_view | Root 設定閲覧（権限マトリックス確認） | × | × | × | × | × | ○ | ○ | ○ |
| settings_edit | Root 設定編集（権限マトリックス変更） | × | × | × | × | × | × | × | ○ |
| employee_role_change | 従業員ロール変更 | × | × | × | × | × | × | ○ | ○ |
| audit_log_view | 監査ログ閲覧 | × | × | × | × | × | ○ | ○ | ○ |

### 4.2 Bud モジュール（module = 'bud'）

| feature_key | 機能名 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| meisai_view | 振込・支払明細閲覧 | × | × | × | △ | × | ○ | ○ | ○ |
| meisai_edit | 振込・支払明細編集 | × | × | × | × | × | × | ○ | ○ |
| transfer_approve | 振込承認 | × | × | × | × | × | ○ | ○ | ○ |
| salary_view | 給与明細閲覧（自分のみ） | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| salary_revision | 給与改定（全員） | × | × | × | × | × | × | ○ | ○ |
| cc_meisai_view | CC 明細閲覧 | × | × | × | △ | × | ○ | ○ | ○ |
| cc_meisai_edit | CC 明細編集・費目修正 | × | × | × | × | × | × | ○ | ○ |
| nenmatsu_chousei | 年末調整処理 | × | × | × | × | × | × | ○ | ○ |
| bank_account_view | 銀行口座マスタ閲覧 | × | × | × | × | × | ○ | ○ | ○ |
| bank_account_edit | 銀行口座マスタ編集 | × | × | × | × | × | × | ○ | ○ |

### 4.3 Leaf モジュール（module = 'leaf'）

| feature_key | 機能名 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| case_view | 案件閲覧 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| case_edit | 案件編集 | × | ○ | × | ○ | ○ | ○ | ○ | ○ |
| toss_up | トスアップ（案件化操作） | ○ | × | × | × | × | × | ○ | ○ |
| backoffice_view | バックオフィス UI 閲覧 | × | × | × | ○ | ○ | ○ | ○ | ○ |
| backoffice_edit | バックオフィス UI 編集 | × | × | × | ○ | ○ | ○ | ○ | ○ |
| commodity_settings | 商材設定変更 | × | × | × | × | × | × | ○ | ○ |
| case_delete | 案件削除 | × | × | × | × | × | × | ○ | ○ |

### 4.4 Tree モジュール（module = 'tree'）

| feature_key | 機能名 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| call_start | 架電開始 | ○ | ○ | × | × | × | × | ○ | ○ |
| call_confirm_view | 前確/後確画面閲覧 | × | × | ○ | ○ | × | ○ | ○ | ○ |
| call_confirm_edit | 前確/後確内容編集 | × | × | ○ | ○ | × | ○ | ○ | ○ |
| kpi_view | KPI 閲覧（自分） | ○ | ○ | ○ | ○ | × | ○ | ○ | ○ |
| kpi_all_view | KPI 閲覧（全員） | × | × | × | × | × | ○ | ○ | ○ |
| call_history_view | コール履歴閲覧 | △ | ○ | ○ | ○ | × | ○ | ○ | ○ |
| list_import | 架電リスト取込 | × | × | × | ○ | × | ○ | ○ | ○ |

### 4.5 Bloom モジュール（module = 'bloom'）

| feature_key | 機能名 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| dashboard_view | ダッシュボード閲覧 | × | × | × | ○ | ○ | ○ | ○ | ○ |
| monthly_digest | 月次ダイジェスト閲覧 | × | × | × | ○ | × | ○ | ○ | ○ |
| daily_report_own | 自分の日報閲覧・編集 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| daily_report_all | 全員日報閲覧 | × | × | × | × | × | ○ | ○ | ○ |
| chatwork_settings | Chatwork 設定変更 | × | × | × | × | × | × | ○ | ○ |

### 4.6 Forest モジュール（module = 'forest'）

| feature_key | 機能名 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| financial_view | 決算書閲覧 | × | × | × | × | × | ○ | ○ | ○ |
| tax_calendar_view | 納税カレンダー閲覧 | × | × | × | × | × | ○ | ○ | ○ |
| tax_calendar_edit | 納税カレンダー編集 | × | × | × | × | × | × | ○ | ○ |
| fiscal_period_edit | 進行期編集 | × | × | × | × | × | × | × | ○ |
| storage_zip_download | 決算書 ZIP ダウンロード | × | × | × | × | × | ○ | ○ | ○ |

### 4.7 Soil モジュール（module = 'soil'）

| feature_key | 機能名 | toss | closer | cs | staff | outsource | manager | admin | super_admin |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| list_view | 架電リスト閲覧 | △ | ○ | × | × | × | ○ | ○ | ○ |
| list_edit | 架電リスト編集 | × | × | × | ○ | × | ○ | ○ | ○ |
| call_history_view | コール履歴閲覧（全体） | × | △ | ○ | ○ | × | ○ | ○ | ○ |
| bulk_import | 大量インポート | × | × | × | × | × | × | ○ | ○ |

---

## 5. API / Server Action 契約

### 5.1 権限読み取り（`src/app/root/_actions/permissions.ts`）

```typescript
// 型定義 — src/app/root/_constants/permissions.ts
export type GardenModule = 'root' | 'bud' | 'leaf' | 'tree' | 'bloom' | 'forest' | 'soil' | 'rill';
export type Permission   = 'allowed' | 'denied' | 'readonly';
export type GardenRole   = 'toss' | 'closer' | 'cs' | 'staff' | 'outsource' | 'manager' | 'admin' | 'super_admin';

export interface PermissionRow {
  module: GardenModule; feature: string; role: GardenRole;
  permission: Permission; note?: string; updatedAt: string;
}
export interface UserPermissions {
  role: GardenRole;
  allowed: Record<GardenModule, string[]>;  // module → 許可 feature 名リスト
}

// Supabase RPC 経由で has_permission() を呼ぶ
export async function checkPermission(module: GardenModule, feature: string): Promise<boolean>;

// module 単位で全行取得（admin UI 初期表示）
export async function getModulePermissions(module: GardenModule): Promise<PermissionRow[]>;

// 現ユーザーの全許可を一括取得（React Context / SWR でキャッシュ、TTL: 5 分推奨）
export async function getUserPermissions(): Promise<UserPermissions>;
```

### 5.2 権限変更・admin UI（super_admin 専用）

```typescript
// 1 行 upsert（変更は root_audit_log に自動記録 — §8 参照）
export async function upsertPermission(params: {
  module: GardenModule; feature: string; role: GardenRole;
  permission: Permission; note?: string;
}): Promise<{ success: boolean; error?: string }>;

// 一括更新（マトリックスエディタから。失敗時は全件ロールバック）
export async function bulkUpsertPermissions(params: {
  rows: Array<{ module: GardenModule; feature: string; role: GardenRole; permission: Permission; note?: string }>;
}): Promise<{ success: boolean; updatedCount: number; error?: string }>;

// 全マトリックス取得（admin UI 初期表示、module 別グルーピング）
export async function getAllPermissions(): Promise<Record<GardenModule, PermissionRow[]>>;

// 機能定義リスト（permissions.ts から返す、DB 参照なし）
export interface FeatureDefinition {
  key: string; label: string; description: string; defaultRole: GardenRole;
}
export function getFeatureDefinitions(module: GardenModule): FeatureDefinition[];
```

---

## 6. RLS ポリシー案

### 6.1 root_settings テーブルの RLS

```sql
ALTER TABLE root_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: manager 以上は閲覧可（設定確認のため）
CREATE POLICY root_settings_select ON root_settings
  FOR SELECT
  USING (root_can_access());
  -- root_can_access() = manager 以上

-- INSERT / UPDATE / DELETE: super_admin のみ
CREATE POLICY root_settings_write ON root_settings
  FOR ALL
  USING (root_is_super_admin())
  WITH CHECK (root_is_super_admin());

-- NOTE: upsert 時は updated_by を auth.uid() に自動設定するため
--       BEFORE trigger を実装する（§6.3 参照）
```

### 6.2 参照する側のテーブルへの新 helper 関数の利用方針

各モジュールの RLS ポリシーは、以下のパターンで `has_permission()` を参照する：

```sql
-- 例: bud_transfers テーブルの閲覧 RLS
CREATE POLICY bud_transfers_select ON bud_transfers
  FOR SELECT
  USING (
    has_permission('bud', 'meisai_view')
    OR has_permission('bud', 'transfer_approve')
  );

-- 例: root_employees テーブルの編集 RLS
CREATE POLICY root_employees_update ON root_employees
  FOR UPDATE
  USING (has_permission('root', 'master_edit'))
  WITH CHECK (has_permission('root', 'master_edit'));
```

**移行タイミング**: 各モジュールの RLS を `has_permission()` に切り替える作業は、
各モジュールセッション（a-bud / a-leaf / a-tree 等）が対象 spec のタイミングで行う。
Phase B-1 時点では `has_permission()` を**提供するだけ**で、既存 RLS の一括書き換えはしない。

### 6.3 updated_by 自動設定トリガー

BEFORE INSERT OR UPDATE で `NEW.updated_by := auth.uid(); NEW.updated_at := now();` を設定する SECURITY DEFINER トリガーを実装する（詳細は migration SQL に記述）。

---

## 7. a-bud / a-leaf / a-tree との連携ポイント

### 7.1 Garden-Bud との連携（振込承認・給与改定）

- **Bud 振込承認**: `has_permission('bud', 'transfer_approve')` を Bud の承認フローで参照
  - 現状: bud_transfers の承認は `root_can_write()` 相当（admin 以上）でハードコード
  - B-1 後: `transfer_approve` を manager にも付与する場合、root_settings の 1 行変更で即反映
  - **連携 API**: Bud 側 Server Action で `checkPermission('bud', 'transfer_approve')` を呼ぶ

- **給与改定**: `has_permission('bud', 'salary_revision')` を給与改定 Server Action に組み込む
  - 給与改定は金銭影響大のため、初期値は admin 以上のみ（マトリックス §4.2 参照）

### 7.2 Garden-Leaf との連携（案件登録・トスアップ）

- **案件登録（case_edit）**: toss は案件の新規作成（トスアップ）のみ、編集は closer/staff/manager 以上
  - `has_permission('leaf', 'toss_up')` と `has_permission('leaf', 'case_edit')` を区別
- **Leaf 商材設定変更**: admin 以上に限定（誤操作防止）
- **Leaf 側への通知**: Leaf RLS を `has_permission()` に移行する際、a-leaf が a-root の B-1 完了を確認してから実施

### 7.3 Garden-Tree との連携（架電画面の権限統合）

- **架電開始**: `has_permission('tree', 'call_start')` — toss / closer に限定
- **前確/後確**: 現在 `tree_can_view_confirm()` でハードコード → B-1 後は `has_permission('tree', 'call_confirm_view')` で代替可能
  - `tree_can_view_confirm()` は後方互換のため **削除しない**（has_permission のフォールバックとして機能継続）
- **KPI 閲覧**: 自分のみ vs 全員の 2 段階（`kpi_view` / `kpi_all_view`）

### 7.4 横断利用の優先順位

1. **Phase B-1**: `has_permission()` を提供、マトリックス初期データを投入
2. **Phase B-2 〜 C**: 各モジュールが対応 spec のタイミングで RLS を `has_permission()` に段階移行
3. **Phase C 完了後**: ハードコード関数（root_can_access 等）を非推奨化、最終的に削除

---

## 8. 監査ログ要件

### 8.1 root_settings の変更記録

`root_settings` の INSERT / UPDATE / DELETE はすべて `root_audit_log` に記録する。
記録は AFTER trigger（SECURITY DEFINER）で実装し、RLS より後段で確実に動作させる。

記録内容:
- `action`: `permission_created` / `permission_changed` / `permission_deleted`
- `target_type`: `'root_settings'`
- `target_id`: `'<module>/<feature>/<role>'`
- `payload`: `{ before: { permission, note }, after: { permission, note } }`（変更前後）

### 8.2 B-2 spec との分担

- 監査ログの **UI 実装**（`/root/audit`）、検索・エクスポート等は B-2 spec に委ねる
- B-1 では `root_audit_log` への書き込みのみ保証し、閲覧 UI は対象外

---

## 9. 受入基準

| # | チェック項目 |
|---|---|
| AC-01 | `root_settings` テーブルが (module, feature, role) の PK で作成されている |
| AC-02 | 初期データ投入後、§4 のマトリックスが全行 INSERT されている |
| AC-03 | `has_permission('root', 'master_view')` が manager では true、staff では false を返す |
| AC-04 | `has_permission('bud', 'transfer_approve')` が manager では true、closer では false を返す |
| AC-05 | root_settings に登録なし → 従来の helper 関数（root_can_access 等）で fallback される |
| AC-06 | super_admin のみが root_settings を INSERT / UPDATE / DELETE できる（RLS 検証） |
| AC-07 | manager 以上は root_settings を SELECT できる（閲覧のみ） |
| AC-08 | root_settings の変更が root_audit_log に記録される（INSERT/UPDATE/DELETE 各3件確認） |
| AC-09 | TypeScript の `GardenRole` 型が 8 値（outsource 含む）を網羅している |
| AC-10 | admin UI のマトリックスエディタで 1 行の permission 変更ができる |
| AC-11 | 一括更新（bulkUpsertPermissions）が失敗時にロールバックされる |
| AC-12 | `updated_by` が変更したユーザーの auth.users.id を正しく記録している |

---

## 10. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | `root_settings` テーブル + index + RLS + trigger migration | 0.25d |
| W2 | TypeScript 型定義 + 定数化（`permissions.ts`、FEATURE_DEFINITIONS 含む）| 0.25d |
| W3 | 8 ロール × 機能マトリックス 初期データ投入（seed SQL）| 0.25d |
| W4 | `has_permission(module, feature)` helper 関数実装 + 単体テスト | 0.25d |
| W5 | admin UI（マトリックスエディタ、`/root/settings/permissions`）| 0.5d |
| W6 | 既存モジュール連携調整（bud/leaf/tree の RLS への `has_permission()` 案内、実移行は各モジュール担当）| 0.5d |
| W7 | テスト（vitest + RLS pg_tap 相当の SQL テスト）| 0.25d |
| **合計** | | **2.25d** |

---

## 11. 判断保留

| # | 論点 | 現時点のスタンス |
|---|---|---|
| 判1 | `readonly` permission 値の初版運用 | 初版は `allowed` / `denied` の 2 値で運用。`readonly` は DB に定義するが UI 上は「閲覧専用」バッジ表示のみ、機能制御は has_permission が `allowed` 扱い返す。将来 tristate が必要になった時点で sig 変更 |
| 判2 | `salary_view`（自分の給与のみ）の実現方法 | has_permission は「種別の許可」のみ判定、「自分のレコードのみ」は RLS の WHERE 句で実装（owner check と組み合わせ）。has_permission の責務を超えないよう注意 |
| 判3 | toss の `call_history_view` = △（readonly）の扱い | toss は自分のコール履歴のみ閲覧可。全体履歴は denied。§4.7 Soil と合わせて「自分のみ」をどこで制限するか決定必要（RLS owner check か feature を分けるか） |
| 判4 | outsource ロールの Leaf case_edit 権限 | 外注先が案件編集できるか否かは業務フロー依存。初版 allowed にしているが、業務委託の種別によっては denied が適切な場合あり |
| 判5 | admin UI での一括リセット（全 module）機能 | 誤操作リスク大。Phase B-1 では実装せず、B-2 以降で操作ログ確認 UI とセットで検討 |
| 判6 | `has_permission()` のキャッシュ戦略 | RLS 内から呼ぶと毎クエリ実行。STABLE 宣言でトランザクション内はキャッシュされるが、クライアント側の SWR キャッシュ TTL は別途決定必要（推奨: 5 分） |
| 判7 | 機能識別子（feature_key）の名前体系 | 英小文字スネークケースで統一方針を明記したが、Bud spec 等の既存 feature 名との整合は各モジュール実装時に都度確認 |
| 判8 | `root_is_super_admin()` の有効範囲 | settings_edit は super_admin のみ。admin が settings を変更したい場合は super_admin への昇格依頼フロー or 判断事項として東海林さんに確認 |

---

## 12. 未確認事項（東海林さん要ヒアリング）

| # | 未確認事項 |
|---|---|
| U1 | outsource（外注）ロールに与える権限の業務的な範囲。現マトリックスは staff に近い設定だが、案件閲覧 / 編集を実際に許可するか確認が必要 |
| U2 | toss ロールのコール履歴・リスト閲覧の範囲。自分のコール分のみか、チーム全体か |
| U3 | 給与改定（`salary_revision`）は admin のみか、manager にも委譲するか |
| U4 | 振込承認（`transfer_approve`）を manager に開放することへの承認。現状は admin 以上で運用中 |
| U5 | Forest 決算書の閲覧を manager まで開放する予定か（現マトリックスは manager 以上で ○ としている） |
| U6 | admin UI（マトリックスエディタ）の操作者を super_admin に限定するか、admin にも開放するか。現設計は super_admin 専用 |

---

— end of Root B-1 spec —

---

## 追記: super_admin 編集 UI 禁止 (2026-05-11)

garden_role 編集 UI を実装する際は `GARDEN_ROLE_SELECTABLE_OPTIONS` を使用し、
super_admin を selectable から除外すること。
DB 側でも `scripts/garden-super-admin-lockdown.sql` で block 済。
詳細: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md Task 5
