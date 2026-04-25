# a-review レビュー — Task D.3 types.ts (新規作成 + v3 拡張型)

## 概要

Garden-Leaf 関電業務委託の TypeScript 型定義 `src/app/leaf/_lib/types.ts` を新規作成（282 行）。既存 `feature/leaf-kanden-supabase-connect` の types.ts に v3 拡張（`GardenRole` / `DELETABLE_ROLES` / `ADMIN_ROLES` / `LeafBusiness` / `LeafUserBusiness` / `AttachmentHistory` / `ImageDownloadPasswordSetting` + `KandenAttachment` の `deleted_at` / `deleted_by`）を加えた完全版。develop に Leaf 未マージのため 1 commit で起票。

## 良い点

1. **8 ロール定義が Root A-3-g の CHECK 制約と完全一致**：known-pitfalls #6 の garden_role が ENUM ではなく CHECK 制約で実装されている件と TypeScript 型を同期させており、一貫性あり。
2. **STATUS_FLOW がランタイム + コンパイル時の二重保証**：`dateField: keyof KandenCase` で型レベル整合性を確保し、配列に label / num / dateLabel も同梱して UI 側が再定義不要にしている（DRY）。
3. **JSDoc コメントが各構造体の意図を明示**：`LeafUserBusiness` の `removed_at` 判定ロジック / `AttachmentHistory` の trigger 経路 / `ImageDownloadPasswordSetting` の bcrypt 規約 など、SQL 側の挙動と型の対応関係が読み取りやすい。
4. **`isAdminRole` ヘルパで Client ガードを集約**：`ADMIN_ROLES.includes(role)` を直接書くと `readonly string[]` 型推論で誤判定する罠を回避している。
5. **v3 改訂事項（論理削除 deleted_at + 全員可化 / 事業スコープ / 履歴 / DL PW）が型レベルで整理**されており、spec §2.6.6 v3 の参照も明示されている。

## 指摘事項

### 推奨改善

#### 🟡 #1 `DELETABLE_ROLES` が全 8 ロール ＝ガードとして機能しない

```typescript
export const DELETABLE_ROLES: readonly GardenRole[] = [
  "toss", "closer", "cs", "staff", "outsource", "manager", "admin", "super_admin",
] as const;
```

JSDoc に「v3 で全員可能化のため全 8 ロール、後方互換のため定数として維持」「将来のロール強化時に備えて定義として残す」とあるが、この定数を import する Client 側コードは事実上 `if (DELETABLE_ROLES.includes(role))` を書くだけで `true` 確定になる（unreachable code 的）。死コードか、`DELETABLE_ROLES = GARDEN_ROLE_ALL` のような alias の方が意図が伝わる。

選択肢:
- a) 削除して JSDoc コメントだけ残す（v3 で論理削除は全員可、ガード不要）
- b) `export const DELETABLE_ROLES = "*all*" as const;` のような sentinel
- c) 名前を `GARDEN_ROLES_ALL` にしてガードではなく一覧として位置付ける

該当: `src/app/leaf/_lib/types.ts:166-175`

#### 🟡 #2 `isAdminRole` の型キャストが不必要に緩い

```typescript
export function isAdminRole(role: GardenRole | null): boolean {
  return role !== null && (ADMIN_ROLES as readonly string[]).includes(role);
}
```

`(ADMIN_ROLES as readonly string[]).includes(role)` は型の幅を広げてから `includes` する pattern だが、より厳密に型を保つなら：

```typescript
export function isAdminRole(role: GardenRole | null): role is "admin" | "super_admin" {
  return role !== null && ADMIN_ROLES.includes(role);
}
```

戻り型を **type guard** にすれば、`if (isAdminRole(role)) { /* role は "admin" | "super_admin" */ }` と narrow できて呼び出し側で typecast 不要になる。`readonly GardenRole[]` でも `includes(role: GardenRole)` は受け取れるので cast 自体不要。

該当: `src/app/leaf/_lib/types.ts:194-196`

#### 🟡 #3 `STATUS_FLOW` の型注釈が冗長

```typescript
export const STATUS_FLOW: {
  key: KandenStatus;
  label: string;
  ...
}[] = [ ... ];
```

これだと配列要素が `{ key: KandenStatus; ... }` 型になり、`STATUS_FLOW[0].key === "ordered"` のような literal narrowing ができない。`as const` を付けて読み取り専用化 + literal 推論を効かせると、UI 側で switch 文を書く際に exhaustive check が効く：

```typescript
export const STATUS_FLOW = [
  { key: "ordered" as const, label: "受注", ... dateField: "ordered_at" as const, ... },
  ...
] as const;
```

ただし `dateField: keyof KandenCase` の制約は別途欲しいので、型をやや工夫する必要あり。優先度低、🟡。

該当: `src/app/leaf/_lib/types.ts:25-46`

#### 🟡 #4 `KandenCase.case_type` が複数 union だが `acquisition_type` も同様で、両者の組み合わせ制約が型で表現されていない

```typescript
case_type: "latest" | "replaced" | "makinaoshi" | "outside";
acquisition_type: "dakkan" | "kakoi";
```

仕様上「`outside` の場合は `acquisition_type` が無関係」「`replaced` のみ `acquisition_type=kakoi` が許可」のような関係があれば discriminated union にした方が安全。spec を未読なので推測だが、もし関係性があれば型で表現を推奨。なければ無視してください 🟢。

#### 🟡 #5 timestamptz 列が string 型で来る前提（known-pitfalls #1 関連）

`KandenCase.created_at: string` 等の timestamptz 列はすべて `string`（読み取り）として定義されており、これは Supabase の挙動と整合。**書込時に `created_at: ""` を送らない** ことを型で防ぐには：

```typescript
export type KandenCaseInsert = Omit<KandenCase, "created_at" | "updated_at" | "case_id">;
export type KandenCaseUpdate = Partial<KandenCaseInsert>;
```

のような Insert/Update 型を別途用意して、known-pitfalls #1 の sanitize-payload との連携を型レベルで補強できる。今回は不要かもしれないが、後続 task A.3-c (CRUD) で必要になる想定。

#### 🟡 #6 npm 5 個追加が本 PR に含まれている

#65 / #66 / #68 / #69 と同じ問題。`@types/bcryptjs` は型定義として欲しいが、本 PR (types.ts) 単体は他の 4 個（bcryptjs / heic2any / msw / user-event）を必要としない。chore 1 本に切り出して先行 merge する運用に変更を推奨。

### 軽微

#### 🟢 #7 `AttachmentCategory` / `ATTACHMENT_LABELS` のペアが綺麗

`STATUS_LABELS` も含めて、`Record<UnionType, string>` パターンで欠落カテゴリがあれば型エラーになる設計が良い（exhaustive check が効く）。

#### 🟢 #8 `KandenAttachment` の `deleted_at: string | null` / `deleted_by: string | null` で **null 許容を明示**

known-pitfalls #8 の deleted_at 二層設計が型レベルでも維持されており、「null = 未削除」の運用が明確。

#### 🟢 #9 `LeafUserBusiness` の `removed_at: string | null` も同パターンで一貫している。

#### 🟢 #10 `STATUS_FLOW` の num フィールドで 1〜8 の連番化が UI のステッパー描画で便利。

## known-pitfalls.md 横断チェック

| # | 関連有無 | コメント |
|---|---|---|
| #1 timestamptz 空文字 | 🟡 後続注意 | 読み取り型は `string` で OK だが、Insert/Update 型を別途用意して空文字 send を型で防げると尚良い（#5 参照） |
| #2 RLS anon 流用 | ✅ N/A | 型のみ |
| #3 空 payload insert | 🟡 後続注意 | 必須フィールド `REQUIRED_KANDEN_FIELDS` のような定数を types.ts に置くと後続 UI で活用可能 |
| #6 garden_role CHECK 制約 | ✅ 整合 | 8 ロール `GardenRole` union が migration の CHECK 制約と完全一致 |
| #8 deleted_at vs is_active | ✅ 整合 | `KandenAttachment.deleted_at: string \| null` で論理削除を表現、`LeafBusiness.is_active: boolean` と別軸で定義 |

## spec / plan 整合

- PR description で「既存 Leaf A-FMK1 ベース」「v3 拡張型」と区分が明示
- spec §2.6.6 v3 への参照リンクあり
- Task D.5 (PR #69) が同じ types.ts を含む → merge 競合の運用が PR description に書かれている（最初に merge される方で develop に入る）
- develop に Leaf 未マージという前提が明記されており、影響範囲（既存コード破壊なし）も妥当

## 判定

**LGTM (条件付き)**

**理由**:
- 型定義として致命的な問題なし。spec / migration SQL との整合性も取れている。
- 🟡 #1-#5 は将来的な改善ポイント。本 PR で対応するか後続 task で対応するかは東海林さん判断。特に #2 (type guard 化) は後続 UI 実装で恩恵が大きい。
- 🟡 #6 (npm 差分) は他 4 PR と共通の問題で、chore 1 本に切り出す運用判断推奨。

types.ts は他の Leaf ファイルから依存される基盤型なので、merge は後続 task より先に通したい優先度の高い PR。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
