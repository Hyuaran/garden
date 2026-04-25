/**
 * Garden-Leaf 関電業務委託 — テスト用 Supabase mock 拡張
 *
 * 既存 src/test-utils/supabase-mock.ts (汎用 query builder mock) に対し、
 * Leaf v3 要件で追加で必要な mock を本ファイルに集約:
 *
 * - Storage API (storage.from(bucket).upload / createSignedUrl(s) / remove / list)
 * - 認証関連 (auth.getUser / auth.signInWithPassword)
 * - RPC mock (rpc('garden_role_of', ...) / rpc('leaf_user_in_business', ...) /
 *             rpc('is_user_active') / rpc('verify_image_download_password', ...) /
 *             rpc('set_image_download_password', ...))
 *
 * 設計方針:
 * - 既存 supabase-mock.ts は破壊的変更なし。Leaf 固有要件のため新ファイルで分離（plan v3 §4.4）
 * - 各 mock は呼出回数 / 引数を spy できる Vi Mock として返却
 * - テスト側で `mockResolvedValue(...)` を仕込んで応答を制御
 *
 * see:
 *   - docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §4 (テスト戦略)
 *   - docs/superpowers/plans/2026-04-25-leaf-a1c-attachment.md Task D.5
 */

import { vi, type Mock } from "vitest";

// ─── Storage API mock ──────────────────────────────────────────────────────────
export type StorageBucketMock = {
  upload: Mock;
  createSignedUrl: Mock;
  createSignedUrls: Mock;
  remove: Mock;
  list: Mock;
};

/**
 * `supabase.storage.from(bucket)` の戻り値モック（連鎖可能）。
 *
 * 各メソッドはデフォルトで `{ data: null, error: null }` を返す Promise を返却。
 * テスト側で `bucketMock.upload.mockResolvedValue({ data: { path: 'x' }, error: null })`
 * のように仕込んで応答を制御する。
 */
export function createStorageBucketMock(): StorageBucketMock {
  return {
    upload: vi.fn().mockResolvedValue({ data: null, error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
    createSignedUrls: vi.fn().mockResolvedValue({ data: null, error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    list: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

/**
 * `supabase.storage` 全体のモック。`from(bucket)` が共通の `bucket` を返すので、
 * テスト側で同じ `bucket` インスタンスのメソッド呼出を spy できる。
 *
 * ```typescript
 * const { storage, bucket } = createStorageMock();
 * (supabase.storage.from as unknown as Mock).mockImplementation(storage.from);
 * bucket.upload.mockResolvedValue({ data: { path: 'a.jpg' }, error: null });
 * await uploadAttachments(...);
 * expect(bucket.upload).toHaveBeenCalledWith('case/a.jpg', expect.any(Blob), expect.anything());
 * ```
 */
export function createStorageMock(): {
  storage: { from: Mock };
  bucket: StorageBucketMock;
} {
  const bucket = createStorageBucketMock();
  const from = vi.fn().mockReturnValue(bucket);
  return { storage: { from }, bucket };
}

// ─── auth API mock ─────────────────────────────────────────────────────────────
export type AuthMock = {
  getUser: Mock;
  signInWithPassword: Mock;
  signOut: Mock;
  getSession: Mock;
};

/**
 * `supabase.auth.*` モック。
 *
 * デフォルト: getUser は `{ data: { user: null }, error: null }` を返す（未認証）。
 * テスト側で `auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })`
 * を仕込んで認証済みユーザーを表現。
 */
export function createAuthMock(): AuthMock {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi
      .fn()
      .mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null }),
  };
}

// ─── RPC mock (Leaf v3 用) ─────────────────────────────────────────────────────
export type LeafRpcMock = {
  /**
   * 汎用 rpc。テスト側で `rpc.mockImplementation((name, args) => ...)` で
   * 関数別に応答を返す。`createLeafRpcMock` のヘルパで頻出パターンを設定可能。
   */
  rpc: Mock;
};

/**
 * Leaf v3 で使う RPC 群のモック。
 *
 * デフォルトで以下の関数を定義済（テスト側で個別 override 可能）:
 * - `garden_role_of(uid)` → `{ data: 'super_admin', error: null }`
 * - `leaf_user_in_business({ biz_id })` → `{ data: true, error: null }`
 * - `is_user_active()` → `{ data: true, error: null }`
 * - `verify_image_download_password({ input_password })` → `{ data: true, error: null }`
 * - `set_image_download_password({ new_hash })` → `{ data: null, error: null }`
 *
 * 設定したい場合:
 * ```typescript
 * const { rpc, setRoleResponse } = createLeafRpcMock();
 * setRoleResponse('toss');  // garden_role_of の応答を 'toss' に
 * (supabase.rpc as Mock).mockImplementation(rpc);
 * ```
 */
export function createLeafRpcMock(): {
  rpc: Mock;
  setRoleResponse: (role: string | null) => void;
  setBusinessResponse: (inBusiness: boolean) => void;
  setUserActiveResponse: (active: boolean) => void;
  setVerifyPasswordResponse: (ok: boolean) => void;
} {
  const responses = {
    garden_role_of: "super_admin" as string | null,
    leaf_user_in_business: true,
    is_user_active: true,
    verify_image_download_password: true,
    set_image_download_password: null as unknown,
  };

  const rpc = vi.fn(
    async (
      fnName: string,
      _args?: Record<string, unknown>,
    ): Promise<{ data: unknown; error: unknown }> => {
      if (fnName in responses) {
        return {
          data: responses[fnName as keyof typeof responses],
          error: null,
        };
      }
      return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
    },
  );

  return {
    rpc,
    setRoleResponse: (role) => {
      responses.garden_role_of = role;
    },
    setBusinessResponse: (inBusiness) => {
      responses.leaf_user_in_business = inBusiness;
    },
    setUserActiveResponse: (active) => {
      responses.is_user_active = active;
    },
    setVerifyPasswordResponse: (ok) => {
      responses.verify_image_download_password = ok;
    },
  };
}

// ─── Composite mock ────────────────────────────────────────────────────────────
/**
 * Leaf テスト用の Supabase クライアント完全 mock。
 *
 * 通常は個別の `createStorageMock` / `createAuthMock` / `createLeafRpcMock` を
 * 組み合わせて使うが、Leaf テストの 90% で同じ構成のため、ヘルパとして提供。
 *
 * ```typescript
 * const { client, bucket, auth, rpc, helpers } = createLeafSupabaseMock();
 * vi.mock('@/lib/supabase/client', () => ({ supabase: client }));
 * helpers.setRoleResponse('admin');
 * bucket.upload.mockResolvedValue({ data: { path: 'x' }, error: null });
 * ```
 */
export function createLeafSupabaseMock() {
  const { storage, bucket } = createStorageMock();
  const auth = createAuthMock();
  const {
    rpc,
    setRoleResponse,
    setBusinessResponse,
    setUserActiveResponse,
    setVerifyPasswordResponse,
  } = createLeafRpcMock();

  // from() は外部の supabase-mock.ts (createSupabaseFromMock) と組み合わせる想定。
  // ここでは骨組みのみ提供。テスト側で必要なら createSupabaseFromMock() を併用。
  const from = vi.fn();

  return {
    client: { storage, auth, rpc, from },
    bucket,
    auth,
    rpc,
    helpers: {
      setRoleResponse,
      setBusinessResponse,
      setUserActiveResponse,
      setVerifyPasswordResponse,
    },
  };
}
