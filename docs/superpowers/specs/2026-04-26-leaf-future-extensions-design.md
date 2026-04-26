# Garden-Leaf 将来拡張 設計指針

- 作成: 2026-04-26（a-leaf、a-main 006 Kintone 解析確定 #22 反映）
- 優先度: 🟢 低（着手は Phase B-1 以降）
- 対象モジュール: Garden-Leaf（関電業務委託 + 将来の他事業）
- 関連 decisions: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md` §3.5
- 関連 Kintone アプリ: App 95（経費一覧、26 fields）
- 関連 memory: `feedback_kintone_app_reference_format.md` / `project_garden_change_request_pattern.md`

---

## 1. 目的

a-main 006 Kintone 解析判断 **#22 App 95（経費一覧）他事業展開** で確定した「**当面は関電専用、新事業展開時に列追加なしで拡張可能な設計**」を、Leaf 配下の将来 spec が一貫して採用するための指針を定める。

A-1c v3（添付ファイル機能、PR #58 / 関連 PR #65 〜 #73）は本指針の**先行実装例**であり、`leaf_businesses` / `leaf_user_businesses` テーブル + `leaf_user_in_business(biz_id)` 関数 + `business_id = 'kanden'` 初期データという構造で本指針を満たしている。本ファイルはそれを Leaf 全体に展開する。

---

## 2. 拡張可能設計の原則（Leaf 全テーブル共通）

### 2.1 必須 2 列パターン

Leaf 配下で**事業横断的に使う可能性のあるテーブル**には、新規作成時に以下の 2 列を含める:

| 列名 | 型 | 役割 | 既定値の指針 |
|---|---|---|---|
| `business_id` | text NOT NULL REFERENCES leaf_businesses(business_id) | 事業スコープ識別子 | `'kanden'` 固定で開始 |
| `type` | text | 同事業内の分類（任意、必要時のみ）| NULL 許容、enum で制約 |

`business_id` は `leaf_businesses` テーブルへの FK。RLS では `leaf_user_in_business(business_id)` 関数で所属判定するパターンを Leaf 全体で統一する（A-1c v3 で確立済み）。

### 2.2 将来 business_id 値の例

a-main 006 #22 で示された拡張時の例:

| business_id | 表示名 | 状態 |
|---|---|---|
| `kanden` | 関西電力業務委託 | ✅ A-1c v3 で初期登録済み（`leaf_businesses` 行）|
| `sb` | ソフトバンク（仮）| 🟡 将来追加候補 |
| `docomo` | NTT ドコモ（仮）| 🟡 将来追加候補 |
| `sonet` | So-net（仮）| 🟡 将来追加候補 |

新事業追加時は `INSERT INTO leaf_businesses (business_id, display_name, ...) VALUES (...)` で 1 行追加するだけで、既存テーブルの構造変更（ALTER TABLE 等）は不要。

### 2.3 既存テーブルへの後付け方針（Phase B-1 以降）

Leaf 配下で既に作成された個別事業特化テーブル（命名: `leaf_kanden_*` 等）が将来横断化する場合:

1. 既存テーブルはそのまま維持（破壊的変更なし）
2. 新事業展開時に汎用テーブル（`leaf_<purpose>` のように事業 prefix なし）を新規作成
3. 既存 `leaf_kanden_*` から汎用テーブルへの段階的データ移行は別途 spec
4. UI / API は当面両方を読む（dual-read）→ 全件移行完了後に旧テーブル廃止

A-1c v3 の `leaf_kanden_attachments` テーブルは事業スコープを `case_id` の親 `soil_kanden_cases` 経由で表現しており（A-1c は関電固有スコープの spec）、横断化は Phase B-1 以降の検討事項。

---

## 3. 経費テーブル設計指針（App 95 反映、Phase B-1 着手予定）

### 3.1 配置先モジュール（**Bud + Leaf 両参照**）

decisions §1 で「App 95 経費一覧 → Garden Bud + Leaf 関電」と明記されている通り、経費テーブルは:

- **Bud** が会計・支払の master（テーブル本体は Bud 管轄、命名は `bud_expenses` 等）
- **Leaf** は事業別 view / 集計を提供（事業所属者の権限制御で関電以外の経費は隠す）

実装上のテーブル名候補（Phase B-1 起草時に確定）:

```
bud_expenses                  -- 横断テーブル（business_id 列で事業判定）
├─ business_id: 'kanden' （初期、A-1c v3 と整合）
└─ type: 'gas' / 'denki' / 'travel' / 'office' 等（App 95 26 fields の分類）
```

旧（誤り）の構想: `bud_expenses_kanden` 単体テーブル → ❌ 拡張時に `bud_expenses_sb` 等が必要となり ALTER TABLE スキーマ変更不可避

新（採択）の構想: `bud_expenses` + `business_id` 列 → ✅ INSERT のみで他事業対応

### 3.2 必須列（Phase B-1 spec で確定）

```sql
CREATE TABLE bud_expenses (
  expense_id      text PRIMARY KEY,
  business_id     text NOT NULL REFERENCES leaf_businesses(business_id),
  type            text,                                    -- 経費種別 enum、root_settings で値管理
  amount          numeric(12,2) NOT NULL,
  expense_date    date NOT NULL,
  description     text,
  receipt_url     text,                                    -- Storage path（recent / archive）
  approved_by     uuid REFERENCES root_employees(user_id),
  approved_at     timestamptz,
  paid_at         timestamptz,
  created_by      uuid NOT NULL REFERENCES root_employees(user_id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,                             -- 論理削除（A-1c v3 と同パターン）
  deleted_by      uuid REFERENCES root_employees(user_id)
);

-- 初期データ: 関電のみ
-- INSERT INTO bud_expenses (...) VALUES (..., 'kanden', ...);
```

### 3.3 RLS（A-1c v3 と同パターン）

```sql
-- SELECT: 事業所属者 + admin
CREATE POLICY bud_expenses_select ON bud_expenses
  FOR SELECT USING (
    leaf_user_in_business(business_id)
    OR garden_role_of((SELECT auth.uid())) IN ('admin', 'super_admin')
  );

-- INSERT / UPDATE: 事業所属者
-- DELETE: admin / super_admin のみ
```

### 3.4 移行戦略（Kintone App 95 → Garden）

decisions §6「Kintone 段階的解約」に従い:

1. **Phase 1**: Kintone と Garden 並行運用（dual-write、1-2 ヶ月）
2. **Phase 2**: Kintone 読取専用化、Garden 主運用（1 ヶ月）
3. **Phase 3**: Kintone 解約

経費データの初期投入時、すべて `business_id = 'kanden'` として import。新事業展開時は `business_id` を切替えて INSERT。

---

## 4. 既存 Leaf テーブル状況（参考）

A-1c v3 (PR #58 merge 済 + 関連 PR 群) で導入済みの事業スコープ関連:

| テーブル | business_id 列 | 備考 |
|---|---|---|
| `leaf_businesses` | 主 PK | 事業マスタ（A-1c v3 で新設、kanden のみ初期登録）|
| `leaf_user_businesses` | FK | ユーザー × 事業 所属（A-1c v3 で新設）|
| `leaf_kanden_attachments` | なし（事業 prefix で固定）| A-1c v3 添付ファイル、kanden 固有 |
| `leaf_kanden_attachments_history` | なし（同上）| 変更履歴 trigger（A-1c v3 で新設）|

A-1c の `leaf_kanden_attachments` は事業 prefix で kanden 固定設計（spec v3 §2.6 で確定）。将来横断化が必要になった場合は §2.3 の後付け方針に従う。

---

## 5. 関連 Garden 全体パターン

### 5.1 root_settings（Tree / Leaf / 横断）

`root_settings` テーブル（A-1c v3 migration §3 で新設）は `key LIKE '<module>.<setting>'` パターンで横断利用。経費 type の enum 値は `bud.expense_types` 等のキーで管理することが推奨（Phase B-1 で確定）。

### 5.2 申請承認パターン（decisions §26）

App 95 経費の承認フローは Garden 共通の **申請 → admin 承認パターン**（`project_garden_change_request_pattern.md`）に準拠。`approved_by` / `approved_at` 列は本パターンの実装。

### 5.3 削除パターン（decisions 関連 memory）

論理削除は事業所属者全員可、物理削除は admin / super_admin のみ（`project_delete_pattern_garden_wide.md`）。A-1c v3 で確立済みパターンを Leaf / Bud 全体で踏襲。

---

## 6. 実装スケジュール（Phase B-1 以降）

| Phase | task | 担当 | 着手時期 |
|---|---|---|---|
| Phase B-1 | bud_expenses spec 起草 | a-bud | A-1c 完走後 |
| Phase B-1 | App 95 → bud_expenses migration spec | a-bud + a-leaf | Phase B-1 中 |
| Phase B-1 | Leaf UI 経費画面（kanden 固定）| a-leaf | spec 完成後 |
| Phase B-2 | 他事業展開時の `leaf_businesses` 行追加 | a-leaf + a-main | 実需発生時 |

本 spec はあくまで指針で、実装着手は Phase B-1 以降。A-1c v3 の Phase A / B / F 完走を優先。

---

## 7. 改訂履歴

| 日付 | 変更 | 実施者 |
|---|---|---|
| 2026-04-26 | 初版作成（a-main 006 Kintone 解析確定 #22 反映、Leaf 拡張可能設計の方針集約）| a-leaf |
