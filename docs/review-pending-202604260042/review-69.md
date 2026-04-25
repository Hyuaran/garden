# a-review レビュー — Task D.5 leaf-supabase-mock.ts (Leaf 専用 mock 拡張)

## 概要

Leaf v3 用の Supabase mock factory `src/test-utils/leaf-supabase-mock.ts` を新設（214 行）+ mock 自体の動作検証テスト（142 行 / 11 アサーション）。既存 `src/test-utils/supabase-mock.ts`（汎用 query builder mock）は触らず、Leaf v3 で必要な Storage / auth / RPC mock を分離ファイルとして追加。`createStorageBucketMock` / `createStorageMock` / `createAuthMock` / `createLeafRpcMock` / `createLeafSupabaseMock` (composite) の 5 factory + helpers を export。

## 良い点

1. **既存 supabase-mock.ts への破壊的変更ゼロ**：plan v3 §4.4「Leaf 固有 mock は分離、JSDoc で分離理由を明記」を厳守し、Forest / Root / Bud の既存テストが安全。
2. **Vi Mock を生で返すので spy / override が自然**：テスト側で `bucket.upload.mockResolvedValueOnce({...})` のように 1 回だけ応答を変える操作が直感的。
3. **default 応答が「成功パス」想定の `super_admin` + `kanden 所属` + `is_user_active=true`**：Leaf テスト 9 割が「正常系の access 確認」なので、デフォルトを成功状態にして、エラーケースのみ helper で override する方針が test code の signal-to-noise を上げる。
4. **`storage.from()` が同じ bucket インスタンスを返す**：`b1 === b2` を保証し、テストが「2 回 from() 呼び出されたが同一 bucket spy」を検証可能。spy continuity を担保する重要な設計判断。
5. **mock 自体にテストを書いている（メタテスト）**：`createLeafSupabaseMock` の helpers が rpc に伝播することまで test で確認しているので、mock の挙動が暗黙的にバージョン違いで壊れる事故を防げる。
6. **JSDoc に使用例コードが豊富**：実装者が `vi.mock("@/lib/supabase/client", () => ({ supabase: client }))` のような典型パターンをすぐ写経できる。

## 指摘事項

### 推奨改善

#### 🟡 #1 `types.ts` を本 PR に含めている件（merge 順管理リスク）

PR description で「D.3 PR (#67) と D.5 PR が両方 types.ts を含む」と注意書きがあり、`PR description: "先に merge される方で develop に入り、後発は同一内容の commit を auto-resolve"` としている。理屈上は同一内容なので衝突しないが、**実運用で types.ts の中身が片方の PR で微変更されると merge 競合が発生** する可能性。

推奨アクション:
- a) Task D.3 (PR #67) を先に merge → 本 PR から types.ts を rebase で剥がす
- b) どちらの PR でも types.ts の修正を許可しないルールを徹底
- c) types.ts のみの commit を本 PR から `git revert` し、D.3 完全依存に変更

リスクは低いが、merge 順管理ミスで types.ts に予期しない diff が入ると追跡が大変。東海林さん帰宅後に merge 順を確定してから処理推奨。

該当: `src/app/leaf/_lib/types.ts` (PR #69 内の重複)

#### 🟡 #2 `createLeafSupabaseMock().client` が実 SupabaseClient と型互換ではない

```typescript
return {
  client: { storage, auth, rpc, from },  // 部分的なオブジェクト
  ...
};
```

戻り値の `client` は `{ storage, auth, rpc, from }` だけ持つアドホック型で、`SupabaseClient` 型ではない。`vi.mock("@/lib/supabase/client", () => ({ supabase: client }))` のように real client を mock 置換する場面で、import 側が `supabase.realtime` 等を呼ぶと **runtime undefined error**。型で防げない。

対策:
- a) `client` の戻り型を `Partial<SupabaseClient>` で明示（ただし `Partial` 経由の access は `undefined | T` になり呼び出し側で narrow が要る）
- b) JSDoc に「mock client は使う API のみ実装、`realtime` 等は別途 mock 必要」と明示
- c) `as unknown as SupabaseClient` の cast を提供しつつ「使ってない API を呼ぶと undefined」と注意

軽微なので 🟡。

該当: `src/test-utils/leaf-supabase-mock.ts:198-211`

#### 🟡 #3 `createLeafRpcMock` の `set_image_download_password` 用 setter 未提供

```typescript
const responses = {
  garden_role_of: "super_admin" as string | null,
  leaf_user_in_business: true,
  is_user_active: true,
  verify_image_download_password: true,
  set_image_download_password: null as unknown,  // ← setter なし
};
```

5 RPC のうち 4 つに setter (`setRoleResponse` 等) があるが `set_image_download_password` だけは default `null` 固定で setter 提供されていない。テスト上で「set_image_download_password がエラーを返すケース」を表現できない。

修正案:
```typescript
setSetPasswordResponse: (result: { data: unknown; error: unknown }) => {
  responses.set_image_download_password_result = result;
}
```

または「setter のない RPC は `rpc.mockImplementation` で個別 override してください」と JSDoc に明記。`super_admin` の権限で誰が呼ぶかを試すテストが書きにくくなる。

該当: `src/test-utils/leaf-supabase-mock.ts:135-180`

#### 🟡 #4 unknown RPC の error 形状が `{ message: ... }` で Supabase 実体と微妙にズレる

```typescript
return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
```

実 Supabase の error は `PostgrestError` 型で `{ message, details, hint, code }` 等を持つ。テスト側で `result.error?.code === "PGRST..."` のような検査をすると mock では undefined。完全一致は不要だが、JSDoc に「mock の error は最小限」と明示するか、最低限 `code: "MOCK_UNKNOWN_RPC"` を入れておくと将来の拡張で困らない。

該当: `src/test-utils/leaf-supabase-mock.ts:153`

#### 🟡 #5 `getSession` mock の戻り値構造が `auth.getSession` 公式応答と微妙に違う可能性

```typescript
getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
```

実 Supabase `auth.getSession()` は `{ data: { session: Session | null }, error: AuthError | null }` を返すので **概ね正しい**。ただし `Session` 型は `access_token` / `refresh_token` / `expires_in` / `expires_at` / `token_type` / `user` を含む。テスト側で `session?.access_token` を見るコードがあると mock で undefined になる。Bloom の JWT 転送パターン（known-pitfalls #2）を mock テストで検証する場合に効いてくる。

軽微で実害なし、🟡。

#### 🟡 #6 npm 5 個追加が本 PR に含まれている

#65 / #66 / #67 / #68 と同じ問題。本 PR (`leaf-supabase-mock.ts`) は **vitest のみで動く**ので、bcryptjs / heic2any / msw / user-event / @types/bcryptjs は不要。chore 1 本に切り出す運用推奨。

### 軽微

#### 🟢 #7 5 RPC の default 応答が migration SQL の挙動と整合

- `garden_role_of(uid) → 'super_admin'`
- `leaf_user_in_business(biz_id) → true`
- `is_user_active() → true`
- `verify_image_download_password(input_password) → true`
- `set_image_download_password(new_hash) → null`

migration SQL の関数戻り型 (boolean / text / void) と一致しており、テストで `data` を取り出した時に型違反にならない。

#### 🟢 #8 createStorageBucketMock の 5 メソッド (upload / createSignedUrl(s) / remove / list) は Supabase Storage の主要 API を網羅

#### 🟢 #9 `Mock` 型を `vitest` から import している点が型安全

#### 🟢 #10 mock 自体のテスト 11 アサーションで「default 応答」「override 反映」「helpers 伝播」「unknown RPC error」を検証

## known-pitfalls.md 横断チェック

| # | 関連有無 | コメント |
|---|---|---|
| #1 timestamptz 空文字 | ✅ N/A | mock 関連なし |
| #2 RLS anon 流用 | 🟡 後続注意 | `createAuthMock().getSession` の応答形状が JWT 転送テストで使えるか要確認（#5 参照） |
| #3 空 payload insert | ✅ N/A | mock 関連なし |
| #6 garden_role CHECK 制約 | ✅ 整合 | `setRoleResponse('toss' \| 'closer' \| ...)` で 8 ロール全部のシナリオを mock 可能 |
| #8 deleted_at vs is_active | ✅ N/A | RPC mock の `is_user_active` で `setUserActiveResponse(false)` の切替が可能 → 退職者シナリオを test 可能 |

## spec / plan 整合

- plan v3 §4.4 「Leaf 固有 mock は分離、JSDoc で分離理由を明記」 ✅
- spec §4 (テスト戦略) ✅
- 既存 `supabase-mock.ts` の `createSupabaseChain` / `createSupabaseFromMock` と組み合わせ可能、と JSDoc で明示
- composite mock のヘルパ伝播がテストで担保されている

## 判定

**LGTM (条件付き)**

**理由**:
- mock factory の品質は良く、メタテストも 11 アサーションで十分。
- 🟡 #1 (types.ts 重複) は merge 順管理の運用論なので、東海林さん側で D.3 → D.5 の順 merge を確定してから処理を確定。
- 🟡 #2-#5 は将来テストを書く時に気付く類のミスマッチで、本 PR で対応するか後続で対応するかは余力次第。
- 🟡 #6 (npm 差分) は他 4 PR と共通、chore 1 本に切り出す運用推奨。

Leaf テスト基盤としての価値は高く、後続の D.6 以降の実装テストで効果を発揮する。merge 順だけ気をつければ問題なし。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
