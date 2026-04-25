# Root Phase A-3-f: 7マスタ新規作成時バグ横展開 Fix

- 作成: 2026-04-24（a-main）
- 対象モジュール: Garden-Root
- 見込み時間: **0.6d（約 5h）**
- 先行依存: Root Phase A-1（7 マスタ一括実装）／ PR #15 のバグ fix（KoT sync の timestamptz 空文字）
- 後続依存: 現場投入前の信頼性担保として必須
- 担当: a-root セッション

---

## 1. 目的

Root Phase A-1 で実装した 7 マスタの**新規作成時に発生する 3 種類のバグ**を**7 マスタ全てに横展開して修正**する。

### 発見経緯
- PR #15（KoT Phase A-2）の §16 7 種テストで発覚
- Bloom セッションが `_components/KotSyncModal.tsx` の `toAttendanceRow` で修正（commit 6f07eef）
- 同パターンが 7 マスタ新規作成 UI にも存在する可能性大 → 予防的修正

### 対象バグ 3 種

#### バグ 1: `timestamptz` 列に空文字列が入る
- 症状: 新規作成時に `created_at: ""` / `updated_at: ""` が payload に含まれ、Postgres が `invalid input syntax for type timestamp with time zone: ""` エラー
- 根本原因: フォームから `new Date().toISOString()` を流し込むが、空フォームで未入力時に空文字列が入る
- 修正方針: payload から `created_at` / `updated_at` を**明示除外**し、Postgres の DEFAULT now() + trigger に任せる

#### バグ 2: `emptyCompany` 系 — 空オブジェクト insert
- 症状: 会社マスタで「新規作成」ボタンを押した直後、未入力の空オブジェクト `{}` を送信し、NOT NULL 制約違反
- 根本原因: initial state の `emptyCompany` オブジェクトが全フィールド空文字列で、submit 時に未検証
- 修正方針: 必須フィールドのクライアント側 validation / submit 時の空オブジェクト検出

#### バグ 3: `emptySystem` 系 — 給与体系マスタの同様問題
- 症状: 給与体系マスタ（`salary-systems`）の新規作成で同パターン
- 修正方針: バグ 2 と同じ

---

## 2. 前提

### 既存ファイル
```
src/app/root/
├─ bank-accounts/page.tsx
├─ companies/page.tsx
├─ employees/page.tsx
├─ insurance/page.tsx
├─ salary-systems/page.tsx
├─ vendors/page.tsx
└─ attendance/page.tsx
```

### 既存 helper
- `src/app/root/_lib/validators.ts` — バリデーション
- `src/app/root/_lib/queries.ts` — fetch / mutation

### 参照修正
- commit `6f07eef`: KoT sync の timestamptz fix（同じパターン）
- `_components/KotSyncModal.tsx` の `toAttendanceRow` 関数

---

## 3. 修正手順

### Step 1: 共通 helper の新設

- パス: `src/app/root/_lib/sanitize-payload.ts`（新規）

```ts
/**
 * Root モジュール共通: DB insert/upsert 前に payload を clean する
 *
 * 1. 空文字列を undefined に変換（特に timestamptz / date 列）
 * 2. created_at / updated_at を除外（Postgres DEFAULT + trigger に任せる）
 * 3. id が空文字なら除外（自動採番の邪魔をしない）
 */
export function sanitizeInsertPayload<T extends Record<string, unknown>>(
  payload: T,
  options: {
    excludeKeys?: string[];
    stringToUndefinedKeys?: string[];
  } = {}
): Partial<T> {
  const excluded = new Set([
    "created_at",
    "updated_at",
    ...(options.excludeKeys ?? []),
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (excluded.has(key)) continue;
    if (value === "") {
      // 空文字列は undefined に（date / timestamptz / int で問題になる）
      continue;
    }
    if (key === "id" && (value === "" || value === null || value === undefined)) {
      continue;
    }
    result[key] = value;
  }
  return result as Partial<T>;
}

/**
 * 空オブジェクト検出: 必須フィールドが全て未入力ならエラー
 */
export function isEmptyPayload(
  payload: Record<string, unknown>,
  requiredKeys: string[]
): boolean {
  return requiredKeys.every(key => {
    const v = payload[key];
    return v === undefined || v === null || v === "";
  });
}
```

### Step 2: 7 マスタで共通適用

各 page.tsx の `handleCreate` / `handleUpdate` ハンドラで：

```tsx
// Before
const { error } = await supabase.from("root_companies").insert({
  ...formState,
  created_at: new Date().toISOString(),  // ❌ 空フォームで "" になる
  updated_at: new Date().toISOString(),
});

// After
import { sanitizeInsertPayload, isEmptyPayload } from "../_lib/sanitize-payload";

// 空オブジェクト検出
if (isEmptyPayload(formState, ["name", "company_id"])) {
  toast.error("会社名と会社IDは必須です");
  return;
}

const payload = sanitizeInsertPayload(formState, {
  stringToUndefinedKeys: ["hired_on", "retired_on"],  // date 列
});

const { error } = await supabase.from("root_companies").insert(payload);
```

### Step 3: 各マスタの必須フィールド洗い出し

| マスタ | 必須フィールド |
|---|---|
| companies | `name`, `company_id` |
| employees | `name`, `employee_number`, `company_id` |
| bank-accounts | `bank_name`, `branch_name`, `account_number`, `account_holder` |
| insurance | `insurance_type`, `company_id` |
| salary-systems | `system_name`, `company_id` |
| vendors | `vendor_name`, `vendor_code` |
| attendance | （既存月次同期で担保、本 spec 対象外の可能性あり）|

※ 実装時に Supabase スキーマの NOT NULL 制約と照合

### Step 4: 型定義の見直し

- 各マスタの型定義で `created_at` / `updated_at` は **Insert 型から exclude**
- `Database` 型（Supabase 生成）の `Insert` と `Update` を使い分け
```ts
type RootCompanyInsert = Omit<Database["public"]["Tables"]["root_companies"]["Insert"], "id" | "created_at" | "updated_at">;
```

### Step 5: 統合テスト（§16 7 種テスト）

各マスタで：
- 空フォームで「新規作成」→ エラーメッセージ表示（insert しない）
- 必須フィールド入力 → 成功 insert
- date 系フィールドを空のまま → Postgres 受理（DEFAULT 適用）
- 更新操作 → updated_at が trigger で自動更新

---

## 4. テスト観点（§16 7 種テスト該当）

| # | 種別 | 観点 | 対象 |
|---|---|---|---|
| 1 | 機能網羅 | 7 マスタ × 新規/編集/削除 = 21 ケース全 pass | 全マスタ |
| 2 | エッジケース | 空フォーム submit / date 空文字 / emoji 入力 / 最大文字数 | 全マスタ |
| 3 | 権限 | admin 以外は編集不可 / 閲覧のみ manager+ | 全マスタ |
| 4 | データ境界 | NOT NULL 違反・check 制約違反のメッセージ確認 | 全マスタ |
| 5 | パフォーマンス | （本 spec 対象外） | - |
| 6 | コンソール | Postgres エラーログ / RLS 警告ゼロ | 全マスタ |
| 7 | a11y | エラーメッセージの aria-live | 全マスタ |

### 特に確認
- **timestamptz 空文字バグ再現テスト**: 日付系フィールド未入力で submit → 「invalid input syntax」が出ないこと
- **空オブジェクト insert バグ**: 何も入力せず「登録」ボタン → クライアント側で止まる
- **横展開漏れ**: 新機能の マスタ実装時にも同 helper を使うルールを MEMORY.md に反映

---

## 5. 完了条件 (DoD)

- [ ] `src/app/root/_lib/sanitize-payload.ts` 新規実装
- [ ] 7 マスタ全てで helper 適用
- [ ] 各マスタの必須フィールド validation 実装
- [ ] 型定義で Insert 型から `created_at` / `updated_at` を exclude
- [ ] §16 7 種テストで 21 ケース pass
- [ ] commit + push + PR 発行
- [ ] PR 本文に「PR #15 で発見された timestamptz 空文字バグの横展開 fix」と明記

---

## 6. 注意事項

### 既存 `KotSyncModal.tsx` との整合
- commit 6f07eef で `toAttendanceRow` がすでに同じ fix をしている
- 可能なら **そちらの関数も `sanitize-payload.ts` helper を使う形にリファクタ**（今回 spec のついで）
- ただし、§a-auto 禁止事項「勝手な仕様変更」に注意。リファクタ範囲は helper 使用への置換のみ

### memory / known-pitfalls への反映
- 本 fix の知見を `docs/known-pitfalls.md` に追記（§17）
- 今後のマスタ実装で同バグを繰り返さないための予防策ナレッジ化

### a-main 側の対応
- fix 完了後、MEMORY.md の `feedback_root_master_payload_sanitize` として登録（pattern の再利用）
- 他モジュール（Bud / Leaf）でも同パターン採用

### 横断 spec との関係
- a-auto Batch 7 案 A（RLS 監査等）の「spec-cross-error-handling」と連動
- 本 spec は具体的な fix、cross-cutting spec は横断規約の明文化

---

## 7. 関連コミット・PR

- commit `6f07eef`: `fix(root): KoT sync で timestamptz 列に空文字列が入らないよう payload から除外`
- PR #15: Root Phase A-2（KoT API 連携）— バグ発見の PR
- PR #14: Root Phase A-1（7 マスタ一括）— fix 対象の PR
