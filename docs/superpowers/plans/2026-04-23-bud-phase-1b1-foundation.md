# Garden-Bud Phase 1b.1 — 振込管理 Foundation 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 振込管理（Kintone 置換）の**基盤**を作る：SQL スキーマ更新、TypeScript 型定義、ID 生成器、重複検出キー、データ層（クエリ・ミューテーション）。UI は Phase 1b.2 で実装。

**Architecture:**
- スキーマ変更は `scripts/bud-transfers-v2.sql` / `scripts/bud-rls-v2.sql` を別ファイルに新規追加（Phase 0 スキーマを破壊しない増分変更）
- TypeScript 型は既存 `src/app/bud/_constants/types.ts` を拡張
- ID 生成と重複キーは純関数として `src/app/bud/_lib/` 配下にユニットテスト付きで実装
- Supabase クエリ/ミューテーションは `src/app/bud/_lib/transfer-queries.ts` / `transfer-mutations.ts` に集約
- テストは vitest（Phase 1a で導入済み）を使用

**Tech Stack:**
- PostgreSQL 15 (Supabase)
- TypeScript 5 strict mode
- Next.js 16 App Router
- Vitest（単体テスト）
- iconv-lite（Phase 1a から流用）

**参照 Spec:** `docs/superpowers/specs/2026-04-22-bud-design-v2.md` §6（Phase 1b）

**前提 Phase:** Phase 0 認証基盤（完了済）、Phase 1a 全銀協 CSV ライブラリ（完了済、95 tests）

**見積工数:** 0.8d（Phase 1b 全体 2.2d のうち Foundation 分）

---

## 前提条件

- [x] Phase 0 完了・push 済み（bud_transfers 旧スキーマ適用済み）
- [x] Phase 1a 完了（`src/lib/zengin/` 利用可能）
- [ ] 東海林さんが Supabase SQL Editor で `scripts/bud-transfers-v2.sql` と `scripts/bud-rls-v2.sql` を適用（手動作業、Task 0/1 実装後）

---

## ファイル構成

### 新規追加（SQL）
```
scripts/
  ├─ bud-transfers-v2.sql         — ALTER bud_transfers（新カラム、生成列、UNIQUE INDEX）
  └─ bud-rls-v2.sql               — 既存ポリシーを DROP + 6段階遷移用ポリシー新設
```

### 新規追加（TypeScript）
```
src/app/bud/
  ├─ _constants/
  │   ├─ types.ts                 — [変更] TransferCategory、Cashback fields、4 date、new status
  │   └─ transfer-status.ts       — [新規] 6 段階ステータス型 + 遷移テーブル
  └─ _lib/
      ├─ transfer-id.ts           — [新規] FK-YYYYMMDD-NNNNNN / CB-YYYYMMDD-G-NNN の採番
      ├─ duplicate-key.ts         — [新規] 重複判定キー生成
      ├─ transfer-queries.ts      — [新規] 振込データ取得（fetchTransferList, fetchTransferById）
      ├─ transfer-mutations.ts    — [新規] 振込の作成・ステータス遷移
      └─ __tests__/
          ├─ transfer-id.test.ts
          ├─ duplicate-key.test.ts
          └─ transfer-status.test.ts  — 遷移ルール検証
```

---

## Task 0: SQL スキーマ移行（bud-transfers-v2.sql）

**Files:**
- Create: `scripts/bud-transfers-v2.sql`

### Step 1: SQL 移行ファイルを作成

- [ ] Create `scripts/bud-transfers-v2.sql` with EXACTLY:

```sql
-- ============================================================
-- Garden Bud — bud_transfers v2（Phase 1b 用スキーマ拡張）
-- ============================================================
-- 作成: 2026-04-23
-- 目的:
--   Phase 1b（振込管理 Kintone 置換）に必要なカラムを追加する。
--   既存 bud_transfers（Phase 0）を破壊せず、ALTER TABLE 増分変更のみ。
--
-- 変更概要:
--   1. 振込種別（通常/キャッシュバック）
--   2. 依頼会社・実行会社（社内立替対応）
--   3. キャッシュバック専用フィールド（申込者・商材等）
--   4. 受取人相違確認フラグ
--   5. 費用分類・勘定科目（Phase 2a/5 で使用）
--   6. キャッシュバック申請ステータス
--   7. 重複検出キー（GENERATED 列）と UNIQUE INDEX
--
-- 依存: scripts/bud-schema.sql（Phase 0）が先に適用済みであること
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
-- ============================================================

-- ============================================================
-- 1. 振込種別
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS transfer_category text
    CHECK (transfer_category IN ('regular', 'cashback'));

COMMENT ON COLUMN bud_transfers.transfer_category IS
  'regular=取引先への通常振込（FK-）、cashback=販促費キャッシュバック（CB-）';

-- ============================================================
-- 2. 依頼会社・実行会社（社内立替対応）
-- ============================================================
-- 既存 company_id は残し、後方互換のため廃止せず（将来的に execute_company_id へ統合予定）。
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS request_company_id text
    REFERENCES root_companies(company_id),
  ADD COLUMN IF NOT EXISTS execute_company_id text
    REFERENCES root_companies(company_id);

COMMENT ON COLUMN bud_transfers.request_company_id IS
  '依頼会社（費用計上先）。execute_company_id と異なる場合は社内立替。';
COMMENT ON COLUMN bud_transfers.execute_company_id IS
  '実行会社（振込元口座を持つ会社）。source_account_id の所属会社と一致する想定。';

-- ============================================================
-- 3. キャッシュバック専用フィールド
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS cashback_applicant_name_kana text,
  ADD COLUMN IF NOT EXISTS cashback_applicant_name text,
  ADD COLUMN IF NOT EXISTS cashback_applicant_phone text,
  ADD COLUMN IF NOT EXISTS cashback_customer_id text,
  ADD COLUMN IF NOT EXISTS cashback_order_date date,
  ADD COLUMN IF NOT EXISTS cashback_opened_date date,
  ADD COLUMN IF NOT EXISTS cashback_product_name text,
  ADD COLUMN IF NOT EXISTS cashback_channel_name text,
  ADD COLUMN IF NOT EXISTS cashback_partner_code text;

-- ============================================================
-- 4. キャッシュバック申請ステータス（Phase 1c Leaf 連携で使用）
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS cashback_application_status text
    CHECK (cashback_application_status IN (
      'pending',       -- 承認待ち
      'under_review',  -- 検討中
      'approved',      -- 承認済み
      'rejected',      -- 却下
      'returned'       -- 差戻し
    ));

COMMENT ON COLUMN bud_transfers.cashback_application_status IS
  'キャッシュバック申請のステータス（Phase 1c Leaf から申請が来るたびに更新）';

-- ============================================================
-- 5. 受取人相違確認フラグ
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS payee_mismatch_confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN bud_transfers.payee_mismatch_confirmed IS
  '受取人名（payee_name）と口座名義カナ（payee_account_holder_kana）が別人の場合、ユーザー確認済みフラグ';

-- ============================================================
-- 6. 費用分類・勘定科目（Phase 2a/5 で seed 後に利用）
-- ============================================================
-- 参照先テーブル（root_expense_categories / root_forest_accounts）は Phase 2c で作成予定。
-- ここでは外部キーなしで text カラムのみ追加（前方互換）。
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS expense_category_id text,
  ADD COLUMN IF NOT EXISTS forest_account_id text;

COMMENT ON COLUMN bud_transfers.expense_category_id IS
  'Phase 2c で作成する root_expense_categories への参照（現時点は text のみ、FK は将来追加）';
COMMENT ON COLUMN bud_transfers.forest_account_id IS
  'Phase 2c で作成する root_forest_accounts への参照（現時点は text のみ、FK は将来追加）';

-- ============================================================
-- 7. 重複検出キー（GENERATED 列）と UNIQUE INDEX
-- ============================================================
-- 支払期日 + 受取銀行・支店・口座 + 金額 を連結したキー。
-- 既存の同じ振込依頼を二重登録しようとした場合に DB レベルで弾く。
-- ただし duplicate_flag = true の場合（意図的な重複登録）は除外。

ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS duplicate_key text GENERATED ALWAYS AS (
    concat_ws(',',
      to_char(scheduled_date, 'YYYYMMDD'),
      payee_bank_code,
      payee_branch_code,
      payee_account_number,
      amount::text
    )
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bud_transfers_duplicate_key
  ON bud_transfers(duplicate_key)
  WHERE duplicate_flag = false AND duplicate_key IS NOT NULL;

COMMENT ON INDEX idx_bud_transfers_duplicate_key IS
  '重複振込防止用の部分ユニークインデックス。duplicate_flag=true の意図的重複は除外。';

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'bud_transfers'
--   ORDER BY ordinal_position;
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bud_transfers';
```

### Step 2: 変更内容を確認

- [ ] `git status` でファイルが追加されていることを確認

### Step 3: Commit

- [ ] Run:
```bash
git add scripts/bud-transfers-v2.sql
git commit -m "feat(bud): bud_transfers v2 スキーマ拡張（Phase 1b 振込管理用）"
```

### Step 4: 東海林さんに SQL 適用を依頼（**手動作業**）

- [ ] Supabase Dashboard → SQL Editor → `scripts/bud-transfers-v2.sql` をコピペして Run
- [ ] 確認クエリでカラム追加とインデックス作成を確認
- [ ] 完了したら Task 1（RLS）へ進む

---

## Task 1: RLS ポリシー v2（bud-rls-v2.sql）

**Files:**
- Create: `scripts/bud-rls-v2.sql`

Phase 0 の RLS は「approver 以上で UPDATE」で粗いため、6 段階遷移ごとに権限を分割し、CSV 出力・振込完了は super_admin のみに制限する。

### Step 1: RLS ファイルを作成

- [ ] Create `scripts/bud-rls-v2.sql` with EXACTLY:

```sql
-- ============================================================
-- Garden Bud — bud_transfers v2 RLS ポリシー
-- ============================================================
-- 作成: 2026-04-23
-- 目的:
--   Phase 1b で 6 段階ステータス遷移を導入するため、既存の粗い
--   bud_transfers_update_approver ポリシーを破棄し、遷移ごとに
--   権限を分割した複数のポリシーで置き換える。
--
-- 権限マッピング:
--   下書き作成・編集      → bud_has_access()
--   確認済みへ            → bud_is_admin() 以上（かつ起票者以外）
--   承認待ちへ            → 起票者本人 or admin 以上
--   承認済みへ            → bud_is_admin() 以上
--   差戻し                → bud_is_admin() 以上
--   super_admin スキップ → root_is_super_admin() AND 自起票
--   CSV 出力済みへ        → root_is_super_admin() のみ
--   振込完了へ            → root_is_super_admin() のみ
--
-- 依存:
--   scripts/bud-schema.sql（Phase 0）
--   scripts/bud-rls.sql（Phase 0）
--   scripts/bud-transfers-v2.sql（Task 0）
-- ============================================================

-- ============================================================
-- 1. 既存の粗い UPDATE ポリシーを削除
-- ============================================================
DROP POLICY IF EXISTS "bud_transfers_update_approver" ON bud_transfers;
DROP POLICY IF EXISTS "bud_transfers_delete_approver" ON bud_transfers;

-- SELECT と INSERT はそのまま維持（bud_has_access() で十分）

-- ============================================================
-- 2. 下書き編集（起票者本人 or admin 以上）
-- ============================================================
CREATE POLICY "bud_transfers_update_draft_self_or_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '下書き'
    AND (created_by = auth.uid() OR bud_is_admin())
  )
  WITH CHECK (
    status IN ('下書き', '確認済み')
    AND (created_by = auth.uid() OR bud_is_admin())
  );

-- ============================================================
-- 3. 確認済み → 承認待ち への遷移（admin 以上）
-- ============================================================
CREATE POLICY "bud_transfers_update_review_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '確認済み'
    AND bud_is_admin()
  )
  WITH CHECK (
    status IN ('確認済み', '承認待ち', '差戻し')
    AND bud_is_admin()
  );

-- ============================================================
-- 4. 承認待ち → 承認済み への遷移（admin 以上）
-- ============================================================
CREATE POLICY "bud_transfers_update_approval_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '承認待ち'
    AND bud_is_admin()
  )
  WITH CHECK (
    status IN ('承認済み', '差戻し')
    AND bud_is_admin()
  );

-- ============================================================
-- 5. super_admin 自起票スキップ（下書き → 承認済み 直接遷移）
-- ============================================================
CREATE POLICY "bud_transfers_update_self_approve_super_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '下書き'
    AND created_by = auth.uid()
    AND root_is_super_admin()
  )
  WITH CHECK (
    status = '承認済み'
    AND root_is_super_admin()
  );

-- ============================================================
-- 6. 承認済み → CSV出力済み（super_admin のみ）
-- ============================================================
CREATE POLICY "bud_transfers_update_csv_export_super_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '承認済み'
    AND root_is_super_admin()
  )
  WITH CHECK (
    status = 'CSV出力済み'
    AND root_is_super_admin()
  );

-- ============================================================
-- 7. CSV出力済み → 振込完了（super_admin のみ）
-- ============================================================
CREATE POLICY "bud_transfers_update_complete_super_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = 'CSV出力済み'
    AND root_is_super_admin()
  )
  WITH CHECK (
    status = '振込完了'
    AND root_is_super_admin()
  );

-- ============================================================
-- 8. DELETE（super_admin のみ、下書きのみ許可）
-- ============================================================
CREATE POLICY "bud_transfers_delete_draft_super_admin" ON bud_transfers
  FOR DELETE
  USING (
    status = '下書き'
    AND root_is_super_admin()
  );

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'bud_transfers'
--   ORDER BY policyname;
--
-- 期待（8 ポリシー）:
--   bud_transfers_select_all           (SELECT)
--   bud_transfers_insert_staff         (INSERT)
--   bud_transfers_update_approval_admin        (UPDATE)
--   bud_transfers_update_complete_super_admin  (UPDATE)
--   bud_transfers_update_csv_export_super_admin (UPDATE)
--   bud_transfers_update_draft_self_or_admin   (UPDATE)
--   bud_transfers_update_review_admin           (UPDATE)
--   bud_transfers_update_self_approve_super_admin (UPDATE)
--   bud_transfers_delete_draft_super_admin      (DELETE)
```

### Step 2: Commit

- [ ] Run:
```bash
git add scripts/bud-rls-v2.sql
git commit -m "feat(bud): bud_transfers v2 RLS ポリシー（6 段階遷移 + super_admin スキップ）"
```

### Step 3: 東海林さん SQL 適用

- [ ] Supabase SQL Editor で `scripts/bud-rls-v2.sql` を Run
- [ ] ポリシー確認クエリで 8 ポリシーがあることを確認

---

## Task 2: TypeScript 型定義の拡張

**Files:**
- Modify: `src/app/bud/_constants/types.ts`
- Create: `src/app/bud/_constants/transfer-status.ts`

### Step 1: `transfer-status.ts` を新規作成

- [ ] Create `src/app/bud/_constants/transfer-status.ts` with EXACTLY:

```typescript
/**
 * Garden-Bud / 振込ステータス定義
 *
 * Phase 1b で扱う 6 段階のステータスと、その遷移ルールを定義する。
 * Kintone の「二重チェック」は「確認済み」ステータスに対応。
 */

export const TRANSFER_STATUSES = [
  "下書き",
  "確認済み",
  "承認待ち",
  "承認済み",
  "CSV出力済み",
  "振込完了",
  "差戻し",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** キャッシュバック申請のサブステータス（Phase 1c で Leaf から流れ込む）*/
export const CASHBACK_APPLICATION_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "returned",
] as const;

export type CashbackApplicationStatus =
  (typeof CASHBACK_APPLICATION_STATUSES)[number];

/**
 * 状態遷移テーブル。
 * キー: 現ステータス
 * 値: そのステータスから許可される次ステータスの配列
 *
 * super_admin の自起票スキップ（下書き → 承認済み）は UI/RLS 側で制御。
 */
export const TRANSFER_STATUS_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  下書き: ["確認済み", "差戻し"],
  確認済み: ["承認待ち", "下書き"], // 下書きに戻せる（修正用）
  承認待ち: ["承認済み", "差戻し"],
  承認済み: ["CSV出力済み"],
  CSV出力済み: ["振込完了"],
  振込完了: [], // 終端
  差戻し: ["下書き"], // 起票者が修正して再提出
};

/**
 * 指定の遷移が許可されているか判定（純関数・テスト容易）。
 */
export function canTransition(
  from: TransferStatus,
  to: TransferStatus,
): boolean {
  return TRANSFER_STATUS_TRANSITIONS[from].includes(to);
}
```

### Step 2: 遷移ルールのテストを書く

- [ ] Create `src/app/bud/_lib/__tests__/transfer-status.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import {
  canTransition,
  TRANSFER_STATUSES,
  TRANSFER_STATUS_TRANSITIONS,
} from "../../_constants/transfer-status";

describe("TRANSFER_STATUSES", () => {
  it("7 つのステータス（6 段階 + 差戻し）", () => {
    expect(TRANSFER_STATUSES).toHaveLength(7);
  });

  it("全ステータスに遷移ルールが定義されている", () => {
    for (const status of TRANSFER_STATUSES) {
      expect(TRANSFER_STATUS_TRANSITIONS).toHaveProperty(status);
    }
  });
});

describe("canTransition", () => {
  it("下書き → 確認済みは許可", () => {
    expect(canTransition("下書き", "確認済み")).toBe(true);
  });

  it("下書き → 承認済み（直接）は不許可（super_admin スキップ専用）", () => {
    expect(canTransition("下書き", "承認済み")).toBe(false);
  });

  it("確認済み → 承認待ちは許可", () => {
    expect(canTransition("確認済み", "承認待ち")).toBe(true);
  });

  it("確認済み → 下書き（戻し）は許可", () => {
    expect(canTransition("確認済み", "下書き")).toBe(true);
  });

  it("承認待ち → 承認済みは許可", () => {
    expect(canTransition("承認待ち", "承認済み")).toBe(true);
  });

  it("承認待ち → 差戻しは許可", () => {
    expect(canTransition("承認待ち", "差戻し")).toBe(true);
  });

  it("承認済み → CSV出力済みは許可", () => {
    expect(canTransition("承認済み", "CSV出力済み")).toBe(true);
  });

  it("CSV出力済み → 振込完了は許可", () => {
    expect(canTransition("CSV出力済み", "振込完了")).toBe(true);
  });

  it("振込完了からはどこにも遷移不可（終端）", () => {
    for (const to of TRANSFER_STATUSES) {
      expect(canTransition("振込完了", to)).toBe(false);
    }
  });

  it("差戻し → 下書きは許可", () => {
    expect(canTransition("差戻し", "下書き")).toBe(true);
  });

  it("逆方向遷移（承認済み → 下書きなど）は不許可", () => {
    expect(canTransition("承認済み", "下書き")).toBe(false);
    expect(canTransition("CSV出力済み", "承認済み")).toBe(false);
  });
});
```

### Step 3: `types.ts` を更新

- [ ] 既存 `src/app/bud/_constants/types.ts` を読み、次の修正を加える:

修正内容：
1. **行 53-60（既存 `TransferStatus` 型）を削除**し、`transfer-status.ts` からの re-export に置き換える
2. **`BudTransfer` interface に新カラムを追加**

具体的な edit：

既存行（types.ts 行 53-65 付近、型定義部分）:
```typescript
// ============================================================
// bud_transfers（振込管理・Phase 1で使用）
// ============================================================
export type TransferStatus =
  | "下書き"
  | "確認済み"
  | "承認待ち"
  | "承認済み"
  | "CSV出力済み"
  | "振込完了"
  | "差戻し";

export type TransferType = "給与" | "外注費" | "経費精算" | "その他";
export type DataSource = "紙スキャン" | "デジタル入力" | "CSVインポート";
export type FeeBearer = "当方負担" | "先方負担";
```

これを以下に置き換え:
```typescript
// ============================================================
// bud_transfers（振込管理・Phase 1で使用）
// ============================================================
export type {
  TransferStatus,
  CashbackApplicationStatus,
} from "./transfer-status";
export { TRANSFER_STATUSES, canTransition } from "./transfer-status";

export type TransferCategory = "regular" | "cashback";
export type TransferType = "給与" | "外注費" | "経費精算" | "その他";
export type DataSource = "紙スキャン" | "デジタル入力" | "CSVインポート";
export type FeeBearer = "当方負担" | "先方負担";
```

次に既存 `BudTransfer` interface（行 66-105 付近）の末尾に以下フィールドを追加：

```typescript
  // ===== Phase 1b で追加（v2 schema） =====
  transfer_category: TransferCategory | null;
  request_company_id: string | null;
  execute_company_id: string | null;
  cashback_applicant_name_kana: string | null;
  cashback_applicant_name: string | null;
  cashback_applicant_phone: string | null;
  cashback_customer_id: string | null;
  cashback_order_date: string | null;
  cashback_opened_date: string | null;
  cashback_product_name: string | null;
  cashback_channel_name: string | null;
  cashback_partner_code: string | null;
  cashback_application_status: CashbackApplicationStatus | null;
  payee_mismatch_confirmed: boolean;
  expense_category_id: string | null;
  forest_account_id: string | null;
  duplicate_key: string | null; // GENERATED 列
```

### Step 4: テストと型チェック

- [ ] Run:
```bash
cd C:/garden/b-main/.claude/worktrees/romantic-robinson-657015
npm test -- transfer-status
```
- [ ] Expected: 11 tests PASS

- [ ] Run:
```bash
npx tsc --noEmit
```
- [ ] Expected: no errors

### Step 5: Commit

- [ ] Run:
```bash
git add src/app/bud/_constants/transfer-status.ts \
        src/app/bud/_constants/types.ts \
        src/app/bud/_lib/__tests__/transfer-status.test.ts
git commit -m "feat(bud): 振込ステータス遷移型と v2 カラムの型定義を追加"
```

---

## Task 3: 振込 ID ジェネレータ（TDD）

**Files:**
- Create: `src/app/bud/_lib/transfer-id.ts`
- Test: `src/app/bud/_lib/__tests__/transfer-id.test.ts`

### Step 1: テスト作成

- [ ] Create `src/app/bud/_lib/__tests__/transfer-id.test.ts` with EXACTLY:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildRegularTransferId,
  buildCashbackTransferId,
  parseTransferId,
} from "../transfer-id";

describe("buildRegularTransferId", () => {
  it("FK-YYYYMMDD-NNNNNN 形式を生成", () => {
    const id = buildRegularTransferId(new Date(2026, 3, 25), 1);
    expect(id).toBe("FK-20260425-000001");
  });

  it("連番が 6 桁の 0 埋め", () => {
    const id = buildRegularTransferId(new Date(2026, 3, 25), 123456);
    expect(id).toBe("FK-20260425-123456");
  });

  it("連番が 1,000,000 以上はエラー", () => {
    expect(() =>
      buildRegularTransferId(new Date(2026, 3, 25), 1_000_000),
    ).toThrow(/6 桁を超え/);
  });

  it("連番が 0 以下はエラー", () => {
    expect(() =>
      buildRegularTransferId(new Date(2026, 3, 25), 0),
    ).toThrow(/1 以上/);
  });
});

describe("buildCashbackTransferId", () => {
  it("CB-YYYYMMDD-G-NNN 形式を生成", () => {
    const id = buildCashbackTransferId(new Date(2026, 3, 25), 1);
    expect(id).toBe("CB-20260425-G-001");
  });

  it("連番が 3 桁の 0 埋め", () => {
    const id = buildCashbackTransferId(new Date(2026, 3, 25), 999);
    expect(id).toBe("CB-20260425-G-999");
  });

  it("連番が 1,000 以上はエラー", () => {
    expect(() =>
      buildCashbackTransferId(new Date(2026, 3, 25), 1000),
    ).toThrow(/3 桁を超え/);
  });
});

describe("parseTransferId", () => {
  it("通常振込 ID を分解", () => {
    const r = parseTransferId("FK-20260425-000042");
    expect(r).toEqual({
      category: "regular",
      datePart: "20260425",
      sequence: 42,
    });
  });

  it("キャッシュバック ID を分解", () => {
    const r = parseTransferId("CB-20260425-G-007");
    expect(r).toEqual({
      category: "cashback",
      datePart: "20260425",
      sequence: 7,
    });
  });

  it("不正な形式は null を返す", () => {
    expect(parseTransferId("INVALID")).toBeNull();
    expect(parseTransferId("FK-2026-04-25")).toBeNull();
    expect(parseTransferId("")).toBeNull();
  });

  it("旧形式 FRK-YYYY-MM-NNNN は null（非対応）", () => {
    expect(parseTransferId("FRK-2026-04-0001")).toBeNull();
  });
});
```

### Step 2: テスト失敗を確認

- [ ] Run: `npm test -- transfer-id`
- [ ] Expected: FAIL（module not found）

### Step 3: 実装

- [ ] Create `src/app/bud/_lib/transfer-id.ts` with EXACTLY:

```typescript
/**
 * Garden-Bud / 振込 ID 生成・パース
 *
 * Kintone 既存運用を継承する ID 形式:
 *   - 通常振込（regular）: FK-YYYYMMDD-NNNNNN（連番 6 桁）
 *   - キャッシュバック（cashback）: CB-YYYYMMDD-G-NNN（連番 3 桁）
 *
 * 連番は DB 側で「その日その種別の最大連番+1」で採番する想定
 * （別ファイルの transfer-mutations.ts で実装）。本ファイルは
 * 純関数的な組立・分解のみ提供。
 */

import type { TransferCategory } from "../_constants/types";

function formatDate(date: Date): string {
  const y = date.getFullYear().toString();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function padSequence(seq: number, width: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`連番は 1 以上の整数である必要があります: ${seq}`);
  }
  const s = seq.toString();
  if (s.length > width) {
    throw new Error(`連番が ${width} 桁を超えています: ${seq}`);
  }
  return s.padStart(width, "0");
}

/** 通常振込 ID を組立: FK-YYYYMMDD-NNNNNN */
export function buildRegularTransferId(date: Date, sequence: number): string {
  return `FK-${formatDate(date)}-${padSequence(sequence, 6)}`;
}

/** キャッシュバック振込 ID を組立: CB-YYYYMMDD-G-NNN */
export function buildCashbackTransferId(date: Date, sequence: number): string {
  return `CB-${formatDate(date)}-G-${padSequence(sequence, 3)}`;
}

export interface ParsedTransferId {
  category: TransferCategory;
  datePart: string; // YYYYMMDD
  sequence: number;
}

/** 振込 ID を分解（不正な形式なら null） */
export function parseTransferId(id: string): ParsedTransferId | null {
  const regularMatch = /^FK-(\d{8})-(\d{6})$/.exec(id);
  if (regularMatch) {
    return {
      category: "regular",
      datePart: regularMatch[1],
      sequence: parseInt(regularMatch[2], 10),
    };
  }

  const cashbackMatch = /^CB-(\d{8})-G-(\d{3})$/.exec(id);
  if (cashbackMatch) {
    return {
      category: "cashback",
      datePart: cashbackMatch[1],
      sequence: parseInt(cashbackMatch[2], 10),
    };
  }

  return null;
}
```

### Step 4: テスト実行して全部 PASS

- [ ] Run: `npm test -- transfer-id`
- [ ] Expected: 13 tests PASS

### Step 5: Commit

- [ ] Run:
```bash
git add src/app/bud/_lib/transfer-id.ts src/app/bud/_lib/__tests__/transfer-id.test.ts
git commit -m "feat(bud): 振込 ID 生成・パース関数を追加（FK-/CB- 形式）"
```

---

## Task 4: 重複検出キービルダー（TDD）

**Files:**
- Create: `src/app/bud/_lib/duplicate-key.ts`
- Test: `src/app/bud/_lib/__tests__/duplicate-key.test.ts`

PostgreSQL の GENERATED 列と同じロジックを TypeScript 側でも提供し、プレビュー画面で「この振込は重複判定されます」と事前警告を出せるようにする。

### Step 1: テスト作成

- [ ] Create `src/app/bud/_lib/__tests__/duplicate-key.test.ts` with EXACTLY:

```typescript
import { describe, it, expect } from "vitest";
import { buildDuplicateKey } from "../duplicate-key";

describe("buildDuplicateKey", () => {
  it("全フィールド揃えば連結キーを返す", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBe("20260425,0179,685,1207991,24980");
  });

  it("scheduled_date が null なら null を返す", () => {
    const key = buildDuplicateKey({
      scheduled_date: null,
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBeNull();
  });

  it("いずれかのフィールドが空文字なら null を返す", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBeNull();
  });

  it("金額が 0 でもキーは生成される（重複判定は一致性のみ）", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 0,
    });
    expect(key).toBe("20260425,0179,685,1207991,0");
  });

  it("日付の / を除去して YYYYMMDD 形式に", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026/04/25",
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBe("20260425,0179,685,1207991,24980");
  });

  it("日付の - を除去して YYYYMMDD 形式に", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "0001",
      payee_branch_code: "100",
      payee_account_number: "1234567",
      amount: 100,
    });
    expect(key).toBe("20260425,0001,100,1234567,100");
  });
});
```

### Step 2: テスト失敗を確認

- [ ] Run: `npm test -- duplicate-key`
- [ ] Expected: FAIL

### Step 3: 実装

- [ ] Create `src/app/bud/_lib/duplicate-key.ts` with EXACTLY:

```typescript
/**
 * Garden-Bud / 振込の重複検出キー生成
 *
 * PostgreSQL の bud_transfers.duplicate_key（GENERATED 列）と同じロジック。
 * UI 側で「このデータで登録すると重複扱いになります」と事前警告を出すため。
 *
 * フォーマット: YYYYMMDD,銀行コード,支店コード,口座番号,金額
 * 例: "20260425,0179,685,1207991,24980"
 *
 * 必須フィールドがいずれか欠けている場合は null を返し、UI 側で
 * 「まだ重複判定できません」として扱う。
 */

export interface DuplicateKeyInput {
  scheduled_date: string | null; // ISO 日付（"2026-04-25"）or "/" 区切り or null
  payee_bank_code: string;
  payee_branch_code: string;
  payee_account_number: string;
  amount: number;
}

function normalizeDate(dateStr: string): string {
  // "2026-04-25" or "2026/04/25" → "20260425"
  return dateStr.replace(/[-/]/g, "");
}

export function buildDuplicateKey(input: DuplicateKeyInput): string | null {
  if (
    !input.scheduled_date ||
    !input.payee_bank_code ||
    !input.payee_branch_code ||
    !input.payee_account_number
  ) {
    return null;
  }

  const datePart = normalizeDate(input.scheduled_date);

  return [
    datePart,
    input.payee_bank_code,
    input.payee_branch_code,
    input.payee_account_number,
    input.amount.toString(),
  ].join(",");
}
```

### Step 4: テスト PASS 確認

- [ ] Run: `npm test -- duplicate-key`
- [ ] Expected: 6 tests PASS

### Step 5: Commit

- [ ] Run:
```bash
git add src/app/bud/_lib/duplicate-key.ts src/app/bud/_lib/__tests__/duplicate-key.test.ts
git commit -m "feat(bud): 振込の重複検出キー生成関数を追加（DB 側と同ロジック）"
```

---

## Task 5: 振込取得クエリ（fetchTransferList, fetchTransferById）

**Files:**
- Create: `src/app/bud/_lib/transfer-queries.ts`

これらはデータベース呼び出しなのでユニットテストではなく実環境動作確認にする（Supabase モックはメンテ負荷が高い）。型が通ることを最優先で実装。

### Step 1: クエリファイルを作成

- [ ] Create `src/app/bud/_lib/transfer-queries.ts` with EXACTLY:

```typescript
/**
 * Garden-Bud / 振込データ取得クエリ
 *
 * 一覧・詳細・重複チェック用のクエリをまとめる。
 * ミューテーション（作成・更新）は transfer-mutations.ts を参照。
 *
 * RLS:
 *   - SELECT は bud_has_access() が許可する全行（Phase 0 RLS）
 *   - 実際の表示制御は UI 側で garden_role / bud_role に応じた行フィルタ
 */

import { supabase } from "./supabase";
import type { BudTransfer, TransferCategory } from "../_constants/types";
import type { TransferStatus } from "../_constants/transfer-status";

export interface TransferListFilter {
  /** 振込種別（null/undefined=両方） */
  category?: TransferCategory | null;
  /** ステータス絞り込み（未指定=全て） */
  statuses?: TransferStatus[];
  /** 実行会社（振込元会社） */
  execute_company_id?: string | null;
  /** 依頼会社（費用計上先） */
  request_company_id?: string | null;
  /** 起票者 */
  created_by?: string | null;
  /** 期間（以上） */
  scheduled_date_from?: string | null;
  /** 期間（以下） */
  scheduled_date_to?: string | null;
  /** テキスト検索（受取人名 / 金額 / 備考） */
  search?: string | null;
  /** ページサイズ */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * 振込一覧を取得。フィルタは AND 条件で絞り込み。
 * 既定の並び順: scheduled_date DESC, created_at DESC
 */
export async function fetchTransferList(
  filter: TransferListFilter = {},
): Promise<{ rows: BudTransfer[]; total: number }> {
  let query = supabase
    .from("bud_transfers")
    .select("*", { count: "exact" })
    .order("scheduled_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filter.category) {
    query = query.eq("transfer_category", filter.category);
  }
  if (filter.statuses && filter.statuses.length > 0) {
    query = query.in("status", filter.statuses);
  }
  if (filter.execute_company_id) {
    query = query.eq("execute_company_id", filter.execute_company_id);
  }
  if (filter.request_company_id) {
    query = query.eq("request_company_id", filter.request_company_id);
  }
  if (filter.created_by) {
    query = query.eq("created_by", filter.created_by);
  }
  if (filter.scheduled_date_from) {
    query = query.gte("scheduled_date", filter.scheduled_date_from);
  }
  if (filter.scheduled_date_to) {
    query = query.lte("scheduled_date", filter.scheduled_date_to);
  }
  if (filter.search) {
    // OR 条件: payee_name ILIKE or description ILIKE
    const s = `%${filter.search}%`;
    query = query.or(`payee_name.ilike.${s},description.ilike.${s}`);
  }
  if (typeof filter.limit === "number") {
    query = query.limit(filter.limit);
  }
  if (typeof filter.offset === "number") {
    query = query.range(
      filter.offset,
      filter.offset + (filter.limit ?? 100) - 1,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`振込一覧取得に失敗: ${error.message}`);
  }

  return {
    rows: (data ?? []) as BudTransfer[],
    total: count ?? 0,
  };
}

/**
 * 振込 1 件を ID で取得。存在しない場合は null。
 */
export async function fetchTransferById(
  transferId: string,
): Promise<BudTransfer | null> {
  const { data, error } = await supabase
    .from("bud_transfers")
    .select("*")
    .eq("transfer_id", transferId)
    .maybeSingle<BudTransfer>();

  if (error) {
    throw new Error(`振込詳細取得に失敗: ${error.message}`);
  }

  return data;
}

/**
 * 重複判定キーで既存レコードを検索。
 * UI 側で「重複の可能性あり」警告を出すのに使用。
 * duplicate_flag=true（意図的重複）は除外。
 */
export async function fetchTransferByDuplicateKey(
  duplicateKey: string,
): Promise<BudTransfer | null> {
  const { data, error } = await supabase
    .from("bud_transfers")
    .select("*")
    .eq("duplicate_key", duplicateKey)
    .eq("duplicate_flag", false)
    .maybeSingle<BudTransfer>();

  if (error) {
    throw new Error(`重複検索に失敗: ${error.message}`);
  }

  return data;
}

/**
 * 当日の次の連番（最大連番+1）を返す。ID 生成用。
 */
export async function fetchNextSequence(
  category: TransferCategory,
  date: Date,
): Promise<number> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const datePrefix = `${y}${m}${d}`;

  const idPrefix = category === "regular" ? `FK-${datePrefix}-` : `CB-${datePrefix}-G-`;

  const { data, error } = await supabase
    .from("bud_transfers")
    .select("transfer_id")
    .like("transfer_id", `${idPrefix}%`)
    .order("transfer_id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`連番取得に失敗: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return 1;
  }

  const lastId = data[0].transfer_id as string;
  const seqStr = lastId.substring(idPrefix.length);
  const seq = parseInt(seqStr, 10);
  if (isNaN(seq)) {
    return 1;
  }
  return seq + 1;
}
```

### Step 2: 型チェック

- [ ] Run:
```bash
cd C:/garden/b-main/.claude/worktrees/romantic-robinson-657015
npx tsc --noEmit
```
- [ ] Expected: no errors

### Step 3: Commit

- [ ] Run:
```bash
git add src/app/bud/_lib/transfer-queries.ts
git commit -m "feat(bud): 振込データ取得クエリ関数を追加"
```

---

## Task 6: 振込ミューテーション（createTransfer, updateTransferStatus）

**Files:**
- Create: `src/app/bud/_lib/transfer-mutations.ts`

### Step 1: ミューテーションファイル作成

- [ ] Create `src/app/bud/_lib/transfer-mutations.ts` with EXACTLY:

```typescript
/**
 * Garden-Bud / 振込データミューテーション
 *
 * 作成・更新・ステータス遷移のビジネスロジックを含む。
 * RLS（scripts/bud-rls-v2.sql）によって権限違反は DB 側で弾かれるが、
 * UI 体験向上のためここでも事前チェックを行う。
 */

import { supabase } from "./supabase";
import type {
  BudTransfer,
  TransferCategory,
  TransferStatus,
} from "../_constants/types";
import { canTransition } from "../_constants/transfer-status";
import {
  buildRegularTransferId,
  buildCashbackTransferId,
} from "./transfer-id";
import { fetchNextSequence } from "./transfer-queries";

export interface CreateTransferInput {
  transfer_category: TransferCategory;
  request_company_id: string;
  execute_company_id: string;
  source_account_id: string;
  vendor_id?: string | null;
  payee_name: string;
  payee_bank_name?: string | null;
  payee_bank_code: string;
  payee_branch_name?: string | null;
  payee_branch_code: string;
  payee_account_type: string;
  payee_account_number: string;
  payee_account_holder_kana: string;
  fee_bearer?: string | null;
  amount: number;
  description?: string | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  payee_mismatch_confirmed?: boolean;

  // キャッシュバック時のみ
  cashback_applicant_name_kana?: string | null;
  cashback_applicant_name?: string | null;
  cashback_applicant_phone?: string | null;
  cashback_customer_id?: string | null;
  cashback_order_date?: string | null;
  cashback_opened_date?: string | null;
  cashback_product_name?: string | null;
  cashback_channel_name?: string | null;
  cashback_partner_code?: string | null;

  // 添付
  invoice_pdf_url?: string | null;
  scan_image_url?: string | null;
}

/**
 * 新規振込を作成（ステータス = 下書き）。
 *
 * @returns 作成された BudTransfer（採番された transfer_id 付き）
 */
export async function createTransfer(
  input: CreateTransferInput,
  currentUserId: string,
): Promise<BudTransfer> {
  const today = new Date();
  const sequence = await fetchNextSequence(input.transfer_category, today);
  const transferId =
    input.transfer_category === "regular"
      ? buildRegularTransferId(today, sequence)
      : buildCashbackTransferId(today, sequence);

  const { data, error } = await supabase
    .from("bud_transfers")
    .insert({
      transfer_id: transferId,
      status: "下書き" as TransferStatus,
      data_source: "デジタル入力",
      transfer_category: input.transfer_category,
      transfer_type: input.transfer_category === "cashback" ? null : null, // Phase 1b では未使用
      request_date: today.toISOString().substring(0, 10),
      due_date: input.due_date ?? null,
      scheduled_date: input.scheduled_date ?? null,
      company_id: input.execute_company_id, // 後方互換
      request_company_id: input.request_company_id,
      execute_company_id: input.execute_company_id,
      source_account_id: input.source_account_id,
      vendor_id: input.vendor_id ?? null,
      payee_name: input.payee_name,
      payee_bank_name: input.payee_bank_name ?? null,
      payee_bank_code: input.payee_bank_code,
      payee_branch_name: input.payee_branch_name ?? null,
      payee_branch_code: input.payee_branch_code,
      payee_account_type: input.payee_account_type,
      payee_account_number: input.payee_account_number,
      payee_account_holder_kana: input.payee_account_holder_kana,
      fee_bearer: input.fee_bearer ?? "当方負担",
      amount: input.amount,
      description: input.description ?? null,
      payee_mismatch_confirmed: input.payee_mismatch_confirmed ?? false,
      cashback_applicant_name_kana: input.cashback_applicant_name_kana ?? null,
      cashback_applicant_name: input.cashback_applicant_name ?? null,
      cashback_applicant_phone: input.cashback_applicant_phone ?? null,
      cashback_customer_id: input.cashback_customer_id ?? null,
      cashback_order_date: input.cashback_order_date ?? null,
      cashback_opened_date: input.cashback_opened_date ?? null,
      cashback_product_name: input.cashback_product_name ?? null,
      cashback_channel_name: input.cashback_channel_name ?? null,
      cashback_partner_code: input.cashback_partner_code ?? null,
      invoice_pdf_url: input.invoice_pdf_url ?? null,
      scan_image_url: input.scan_image_url ?? null,
      created_by: currentUserId,
    })
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(`振込作成に失敗: ${error?.message ?? "unknown"}`);
  }

  return data;
}

/**
 * ステータス遷移を実行。
 * - 遷移ルール（transfer-status.ts の canTransition）で事前チェック
 * - 差戻し・却下時は reason 必須
 */
export async function updateTransferStatus(params: {
  transfer_id: string;
  current_status: TransferStatus;
  next_status: TransferStatus;
  actor_user_id: string;
  rejection_reason?: string | null;
}): Promise<BudTransfer> {
  // 1. 遷移ルール事前チェック
  if (!canTransition(params.current_status, params.next_status)) {
    throw new Error(
      `許可されない遷移: ${params.current_status} → ${params.next_status}`,
    );
  }

  // 2. 差戻し時は理由必須
  if (params.next_status === "差戻し" && !params.rejection_reason) {
    throw new Error("差戻し時は rejection_reason が必須です");
  }

  // 3. 更新フィールドをステータス別に用意
  type Updates = Record<string, unknown>;
  const updates: Updates = { status: params.next_status };

  switch (params.next_status) {
    case "確認済み":
      updates.confirmed_by = params.actor_user_id;
      updates.confirmed_at = new Date().toISOString();
      break;
    case "承認済み":
      updates.approved_by = params.actor_user_id;
      updates.approved_at = new Date().toISOString();
      break;
    case "CSV出力済み":
      updates.csv_exported_by = params.actor_user_id;
      updates.csv_exported_at = new Date().toISOString();
      break;
    case "振込完了":
      updates.executed_by = params.actor_user_id;
      updates.executed_date = new Date().toISOString().substring(0, 10);
      break;
    case "差戻し":
      updates.rejection_reason = params.rejection_reason;
      break;
  }

  // 4. DB 更新（RLS がダブルチェック）
  const { data, error } = await supabase
    .from("bud_transfers")
    .update(updates)
    .eq("transfer_id", params.transfer_id)
    .eq("status", params.current_status) // 楽観ロック
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(
      `ステータス更新に失敗: ${error?.message ?? "レコードが見つからないか、ステータスが既に変更されています"}`,
    );
  }

  return data;
}

/**
 * super_admin による自起票の即承認スキップ。
 * 下書き → 承認済み へ 1 ステップで遷移。
 * RLS の bud_transfers_update_self_approve_super_admin ポリシーで保護。
 */
export async function selfApproveAsSuperAdmin(
  transferId: string,
  actorUserId: string,
): Promise<BudTransfer> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("bud_transfers")
    .update({
      status: "承認済み",
      confirmed_by: actorUserId,
      confirmed_at: now,
      approved_by: actorUserId,
      approved_at: now,
    })
    .eq("transfer_id", transferId)
    .eq("status", "下書き")
    .eq("created_by", actorUserId)
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(
      `自己承認に失敗: ${error?.message ?? "権限不足またはステータス不一致"}`,
    );
  }

  return data;
}

/**
 * 振込 1 件を更新（編集、下書きステータス時のみ有効）。
 */
export async function updateDraftTransfer(
  transferId: string,
  updates: Partial<CreateTransferInput>,
): Promise<BudTransfer> {
  const { data, error } = await supabase
    .from("bud_transfers")
    .update(updates)
    .eq("transfer_id", transferId)
    .eq("status", "下書き")
    .select("*")
    .single<BudTransfer>();

  if (error || !data) {
    throw new Error(`下書き更新に失敗: ${error?.message ?? "unknown"}`);
  }

  return data;
}
```

### Step 2: 型チェック

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: no errors

### Step 3: Commit

- [ ] Run:
```bash
git add src/app/bud/_lib/transfer-mutations.ts
git commit -m "feat(bud): 振込ミューテーション関数を追加（作成/ステータス遷移/自承認）"
```

---

## Task 7: 全テスト回帰＋ TypeScript 通し検証

Phase 1a の 95 tests と Phase 1b.1 で追加した 30 tests（ステータス遷移 11 + ID 13 + 重複キー 6）すべてが通ることを確認。

### Step 1: 全 test 実行

- [ ] Run:
```bash
cd C:/garden/b-main/.claude/worktrees/romantic-robinson-657015
npm test
```
- [ ] Expected: **125 tests pass**（95 + 30 新規、11 + 3 testファイル追加で合計 14 test files）

### Step 2: TypeScript 通しチェック

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: no errors

### Step 3: Lint

- [ ] Run: `npm run lint`
- [ ] Expected: エラー 0（警告は既存のもの以外増えていないこと）

### Step 4: （必要なら）修正してコミット

- [ ] 何らかの回帰があれば修正し、修正内容を個別コミット

---

## Task 8: 工数実績の記録

**Files:**
- Modify: `docs/effort-tracking.md`

### Step 1: effort-tracking に Phase 1b.1 行を追加

- [ ] `docs/effort-tracking.md` のログ表に以下を追加（Phase 1a 行の直下）:

```markdown
| 2026-04-23 | 2026-04-XX | Bud | Phase 1b.1 振込管理 Foundation | 0.8 | X.X | ±X.X | b-main (B) | Claude | スキーマv2 + RLS + 型 + ID生成 + 重複検出 + queries + mutations。UIはPhase 1b.2。 |
```

完了後、実績を記入。

### Step 2: Commit

- [ ] Run:
```bash
git add docs/effort-tracking.md
git commit -m "docs(bud): Phase 1b.1 工数実績を記録"
```

---

## 完了チェックリスト

- [ ] Task 0: bud-transfers-v2.sql（スキーマ拡張）
- [ ] Task 0 後処理: 東海林さんが Supabase で SQL 適用
- [ ] Task 1: bud-rls-v2.sql（RLS 6 段階）
- [ ] Task 1 後処理: 東海林さんが Supabase で RLS 適用
- [ ] Task 2: transfer-status.ts + 型定義更新（11 tests）
- [ ] Task 3: transfer-id.ts（13 tests）
- [ ] Task 4: duplicate-key.ts（6 tests）
- [ ] Task 5: transfer-queries.ts
- [ ] Task 6: transfer-mutations.ts
- [ ] Task 7: 回帰確認（125 tests green）
- [ ] Task 8: 工数実績記録
- [ ] 全テスト緑
- [ ] TypeScript チェック通過

## 次の Phase

Phase 1b.1 完了後、**Phase 1b.2（UI）** のプランを `writing-plans` で作成する:
- 振込一覧画面（/bud/transfers）
- 通常振込 新規作成画面（/bud/transfers/new-regular）
- キャッシュバック 新規作成画面（/bud/transfers/new-cashback）
- 振込詳細画面（/bud/transfers/[id]）
- CSV 出力画面（/bud/transfers/csv-export）

Phase 1a の `generateZenginCsv` を CSV 出力画面から呼ぶ。
