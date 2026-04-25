# a-review レビュー — Task D.2 src/lib/supabase/client.ts (横断共通 browser client)

## 概要

横断共通の Supabase ブラウザクライアントを `src/lib/supabase/client.ts` に新設する PR。spec-cross-rls-audit §2 パターン A 準拠で、`getSupabaseClient()` (singleton) と後方互換用 Proxy export を提供。既存 `src/lib/supabase/admin.ts`（service role 版）と対をなす設計で、Leaf を先頭バッターとして他モジュールへ横展開する位置付け。

## 良い点

1. **singleton + lazy 初期化**：`cached` 変数による once-only 生成 + 起動時 env 未設定の早期 throw が、`admin.ts` と一貫している。両ファイルが同じパターンで保守しやすい。
2. **JSDoc が充実、使用許可 / 禁止が明確**：「Route Handler / Cron では `admin.ts` 使用」「ブラウザ専用」が冒頭で明示されており、known-pitfalls #2 の anon 流用バグの再発防止策として効いている。
3. **既存 `admin.ts` との設計対称性**：env 名（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）も同じ命名で揃えており、認知コストが低い。
4. **エラーメッセージが実装者向けに親切**：`NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are required` の throw で、`.env.local` 設定漏れ時にすぐ気付ける。
5. **`@deprecated` マーク付き Proxy export で段階移行**：旧コードからの参照を切らずに `getSupabaseClient()` への移行を促す設計は、横断展開を始める「先頭バッター」として現実的。

## 指摘事項

### 推奨改善

#### 🟡 #1 既存 `@supabase/ssr` (^0.10.2) を活用しない選択の是非

`package.json` には既に `@supabase/ssr ^0.10.2` が入っており、`src/app/bloom/_lib/supabase-server.ts` も将来 ssr ベースに移行する旨コメントしている。Next.js App Router (Next 16.2.3) でブラウザ client を作る場合、**`createBrowserClient` from `@supabase/ssr`** が公式推奨パターン（Cookie ベースのセッション同期 / Server Component と整合）。本 PR は `@supabase/supabase-js` の **legacy `createClient`** を使っているため、Server Component との JWT セッション同期で食い違う可能性がある。

```typescript
// 推奨パターン
import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(url, anonKey);
  return cached;
}
```

ただし、**「Leaf を先頭バッター」「他モジュールは Phase B 以降」という段階移行方針** であれば、まずは legacy createClient で揃えて、ssr 移行は別 task で全モジュール一斉実施という設計判断もあり得る。spec-cross-rls-audit §2 パターン A の正本仕様を確認の上、東海林さん判断推奨。

該当: `src/lib/supabase/client.ts:33`

#### 🟡 #2 後方互換 Proxy の `Reflect.get(getSupabaseClient(), prop, getSupabaseClient())` が二重呼出

```typescript
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    return Reflect.get(getSupabaseClient(), prop, getSupabaseClient());
  },
});
```

`Reflect.get(target, prop, receiver)` の第3引数 `receiver` は `this` バインドに使われるが、ここでは **同じ `getSupabaseClient()` を 2 回呼んでいる**。singleton なので結果は同一だが意図が読みにくい。また、最初の access で getter が走るので「lazy だが副作用なし」という Proxy のセオリーから外れる。`@deprecated` で消える運命とはいえ、以下が望ましい：

```typescript
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    return Reflect.get(client, prop, client);
  },
});
```

singleton 化されているので 2 回呼んでも実害はないが、コードレビューの度に「ここ何で 2 回呼んでるの？」となる。実害なしなので 🟡。

該当: `src/lib/supabase/client.ts:62-65`

#### 🟡 #3 テストファイル未同梱

`getSupabaseClient()` の挙動確認テスト（env 未設定時の throw / singleton 検証 / Proxy 経由アクセス）がない。横断共通モジュールという位置付けなら、最低限 `__tests__/client.test.ts` を同梱して以下くらいはカバーしたい：

```typescript
describe("getSupabaseClient", () => {
  beforeEach(() => vi.resetModules());
  it("throws when env vars missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getSupabaseClient()).toThrow(/required/);
  });
  it("returns same instance on second call (singleton)", () => {
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
  });
});
```

横断モジュールはテストでバグを早期検出するのが正解。Phase B 以降で他モジュールが import する前にテストだけは入れておきたい。

#### 🟡 #4 Proxy export の型注釈が `SupabaseClient` だが実体は空オブジェクト

```typescript
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, { ... });
```

型注釈上は `SupabaseClient` だが Proxy target は `{} as SupabaseClient`（嘘の型）。trap で getSupabaseClient() に委譲するので実害はないが、型体系の正しさとしては `new Proxy({} as unknown as SupabaseClient, ...)` の方が誠実。これは趣味の範囲なので 🟢 寄りの 🟡。

#### 🟡 #5 `cached` のテスト用リセット手段なし

singleton は単体テスト時の cross-test pollution の温床。export `__resetForTesting()` のような escape hatch を `__tests__` 限定で出すか、`vi.resetModules()` 前提でテストを書くか、運用ルールを明示したい。

### 軽微

#### 🟢 #6 横展開の re-export パターンが JSDoc に書かれている

```typescript
// src/app/<module>/_lib/supabase.ts
export { getSupabaseClient as getSupabase } from '@/lib/supabase/client';
```

この移行レシピがコメントに書かれているのは、後続モジュール担当者にとって有用。

#### 🟢 #7 `import type { SupabaseClient }` の型のみ import で副作用なし

#### 🟢 #8 npm 5 個追加（D.2 とは無関係）が PR 差分に含まれている件は #65 と同じ問題（後述 known-pitfalls 外）

PR description で「`3d6e9d5`: chore(leaf): A-1c v3 npm 5 個追加」と分離されている記述だが、changedFiles 上は `package.json` / `package-lock.json` が含まれている。`bcryptjs` / `heic2any` / `msw` / `@testing-library/user-event` / `@types/bcryptjs` は本 PR の動作に必要な依存ではない（client.ts 単体は `@supabase/supabase-js` だけで動く）。

→ 5 PR (#65-#69) すべてに同じ npm 差分が入っているので、東海林さんの方で chore 用 PR を 1 本切って先行 merge → 残り 5 PR を rebase することを推奨。

## known-pitfalls.md 横断チェック

| # | 関連有無 | コメント |
|---|---|---|
| #1 timestamptz 空文字 | ✅ N/A | DDL なし |
| #2 RLS anon 流用 | ✅ **本 PR の核心** | JSDoc で「Route Handler では使用禁止」を明文化、anon クライアントを RLS 経由でブラウザから使う前提が正しく設計されている。known-pitfalls #2 の再発防止策として有効 |
| #3 空 payload insert | ✅ N/A | UI 層なし |
| #6 garden_role CHECK 制約 | ✅ N/A | RLS 関連なし |
| #8 deleted_at vs is_active | ✅ N/A | UI 層なし |

特に **#2 への対策**として、`admin.ts` (service_role) と `client.ts` (anon + RLS) の二極化を JSDoc で明示している点は、過去の Bloom PDF 404 事件のような事故を防ぐ意味で有効。横断展開の標準モデルとして良い起点。

## spec / plan 整合

- spec-cross-rls-audit §2 パターン A (browser anon) ✅
- spec-cross-rls-audit §8 W1「client.ts 新設」✅
- plan v3 Task D.2 のうち「`src/app/leaf/_lib/supabase.ts` を re-export に縮小」は別 task に分離した旨が PR description に明記 → 段階展開として妥当。

## 判定

**LGTM (条件付き)**

**理由**:
- 重大な問題なし。設計方針は spec-cross-rls-audit と整合し、known-pitfalls #2 への対策として効果的。
- 🟡 #1 (`@supabase/ssr` 採用要否) は段階移行方針として現状の legacy createClient 採用も合理的だが、Server Component と組み合わせた際の挙動を Phase B で必ず再確認すること。
- 🟡 #2 (Proxy 二重呼出) は実害なしだが可読性のため次回修正時に整理推奨。
- 🟡 #3 (テスト未同梱) は他モジュール展開前に追加してほしい（後続 PR で OK）。

npm 差分の混入は他 4 PR (#65/#67/#68/#69) と共通の話なので、まとめて chore 1 本に切り出す運用判断が東海林さんからあれば対応。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
