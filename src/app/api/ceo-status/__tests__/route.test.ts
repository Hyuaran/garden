/**
 * Garden-Bloom — /api/ceo-status route ハンドラ regression test
 *
 * 配置目的:
 *   ShojiStatusWidget MVP（Bloom-002 Phase 4）が src/app/api/ceo-status/route.ts を
 *   実装した時点で、本テストが GET / PUT の振る舞いを「先行 spec」として固定する。
 *
 * 前提（実装側に対する要求）:
 *   - GET  /api/ceo-status: 認証ユーザーの bloom_ceo_status を返す
 *       - 未認証 → 401
 *       - 行不在 → 200 + デフォルト ('available' / '初期化')
 *       - 行有り → 200 + { status, summary, updated_at }
 *   - PUT  /api/ceo-status: super_admin のみが更新可能
 *       - super_admin → 200 + 更新後 body
 *       - 他ロール   → 403
 *       - summary > 200 字 → 400
 *       - status が enum 外 → 400
 *
 * mock 戦略:
 *   - Supabase の SSR client (`@/lib/supabase/server` 想定) を vi.mock で差し替え
 *   - auth.getUser() / from('bloom_ceo_status') / from('root_employees') の各 chain を必要分だけ stub
 *   - import path はテスト先行のため仮置き、Bloom-002 実装側で一致させる前提
 *
 * 注意:
 *   - 本ファイルは spec 先行配置。Bloom-002 実装ファイル完成後に import path / レスポンス形状の最終調整あり
 *   - 既存 `src/app/api/tree/update-password/route.ts` の Authorization Bearer / NextResponse パターンを参考にしている
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// -------------------------------------------------------------------------
// Supabase mock セットアップ（Bloom-002 実装側の使用クライアントに合わせて要調整）
// -------------------------------------------------------------------------

type AuthGetUserResult = {
  data: { user: { id: string; email?: string } | null };
  error: { message: string } | null;
};

type CeoStatusRow = {
  status: "available" | "busy" | "offline";
  summary: string;
  updated_at: string;
};

type EmployeeRow = {
  garden_role: "super_admin" | "admin" | "manager" | "staff" | "cs" | "closer" | "toss";
};

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn<[], Promise<AuthGetUserResult>>(),
  ceoStatusSelectMaybeSingle: vi.fn<[], Promise<{ data: CeoStatusRow | null; error: null | { message: string } }>>(),
  ceoStatusUpsertSelectSingle: vi.fn<[], Promise<{ data: CeoStatusRow | null; error: null | { message: string } }>>(),
  rootEmployeesSelectMaybeSingle: vi.fn<[], Promise<{ data: EmployeeRow | null; error: null | { message: string } }>>(),
  upsertSpy: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => {
  function buildCeoStatusBuilder() {
    // GET 系: from('bloom_ceo_status').select('*').maybeSingle()
    const selectChain = {
      maybeSingle: mocks.ceoStatusSelectMaybeSingle,
    };
    // PUT 系: from('bloom_ceo_status').upsert(...).select().single()
    const upsertChain = {
      select: () => ({
        single: mocks.ceoStatusUpsertSelectSingle,
      }),
    };
    return {
      select: () => selectChain,
      upsert: (...args: unknown[]) => {
        mocks.upsertSpy(...args);
        return upsertChain;
      },
    };
  }

  function buildRootEmployeesBuilder() {
    // root_employees.select('garden_role').eq('user_id', ...).maybeSingle()
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: mocks.rootEmployeesSelectMaybeSingle,
        }),
      }),
    };
  }

  return {
    createSupabaseServerClient: () =>
      Promise.resolve({
        auth: {
          getUser: mocks.authGetUser,
        },
        from: (table: string) => {
          if (table === "bloom_ceo_status") return buildCeoStatusBuilder();
          if (table === "root_employees") return buildRootEmployeesBuilder();
          throw new Error(`unexpected table in test mock: ${table}`);
        },
      }),
  };
});

// 実装側で createSupabaseServerClient を別パスから export している場合の保険:
// vi.mock("@/lib/supabase/admin", ...) も Bloom-002 実装に合わせて追加するかは判断保留。

// -------------------------------------------------------------------------
// テスト対象 import — 実装ファイルが存在しない時点では skip 同等となるよう動的 import
// -------------------------------------------------------------------------

// 実装が完成するまでは import に失敗する想定。Bloom-002 で route.ts が出来た時点で
// 下記の dynamic import が解決し、各テストが実行される。
async function loadRoute() {
  // 仮 path。Bloom-002 実装側で `src/app/api/ceo-status/route.ts` を作成する前提。
  return await import("@/app/api/ceo-status/route");
}

// helper: Request を組み立てる
function makeRequest(init?: RequestInit & { body?: unknown }) {
  const { body, ...rest } = init ?? {};
  return new Request("http://localhost/api/ceo-status", {
    ...rest,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      "content-type": "application/json",
      ...(rest.headers ?? {}),
    },
  });
}

// -------------------------------------------------------------------------
// 共通セットアップ
// -------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルトは認証成功・super_admin・行あり、で組んでおく。
  mocks.authGetUser.mockResolvedValue({
    data: { user: { id: "user-shoji-1", email: "shoji@hyuaran.com" } },
    error: null,
  });
  mocks.ceoStatusSelectMaybeSingle.mockResolvedValue({
    data: {
      status: "available",
      summary: "通常稼働",
      updated_at: "2026-04-26T03:00:00.000Z",
    },
    error: null,
  });
  mocks.ceoStatusUpsertSelectSingle.mockResolvedValue({
    data: {
      status: "busy",
      summary: "会議中",
      updated_at: "2026-04-26T04:00:00.000Z",
    },
    error: null,
  });
  mocks.rootEmployeesSelectMaybeSingle.mockResolvedValue({
    data: { garden_role: "super_admin" },
    error: null,
  });
});

// -------------------------------------------------------------------------
// GET /api/ceo-status — 3 ケース
// -------------------------------------------------------------------------

describe("GET /api/ceo-status", () => {
  it("認証成功時、ステータス取得して 200 を返す", async () => {
    const route = await loadRoute();
    const res = await route.GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        status: "available",
        summary: "通常稼働",
        updated_at: "2026-04-26T03:00:00.000Z",
      }),
    );
  });

  it("未認証時、401 を返す", async () => {
    mocks.authGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const route = await loadRoute();
    const res = await route.GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("行不在時、デフォルト値で 200 を返す", async () => {
    mocks.ceoStatusSelectMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const route = await loadRoute();
    const res = await route.GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // デフォルト: status='available', summary='初期化'
    expect(body.status).toBe("available");
    expect(body.summary).toBe("初期化");
  });
});

// -------------------------------------------------------------------------
// PUT /api/ceo-status — 4 ケース
// -------------------------------------------------------------------------

describe("PUT /api/ceo-status", () => {
  it("super_admin 成功時、status 更新して 200 を返す", async () => {
    const route = await loadRoute();
    const res = await route.PUT(
      makeRequest({
        method: "PUT",
        body: { status: "busy", summary: "会議中" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        status: "busy",
        summary: "会議中",
      }),
    );
    expect(mocks.upsertSpy).toHaveBeenCalledTimes(1);
  });

  it("一般ユーザー（staff）が更新を試みた場合、403 を返す", async () => {
    mocks.rootEmployeesSelectMaybeSingle.mockResolvedValueOnce({
      data: { garden_role: "staff" },
      error: null,
    });
    const route = await loadRoute();
    const res = await route.PUT(
      makeRequest({
        method: "PUT",
        body: { status: "busy", summary: "会議中" },
      }),
    );
    expect(res.status).toBe(403);
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });

  it("summary が 200 字を超えた場合、400 を返す", async () => {
    const route = await loadRoute();
    const res = await route.PUT(
      makeRequest({
        method: "PUT",
        body: { status: "busy", summary: "a".repeat(201) },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });

  it("不正な status 値の場合、400 を返す", async () => {
    const route = await loadRoute();
    const res = await route.PUT(
      makeRequest({
        method: "PUT",
        body: { status: "invalid_value", summary: "会議中" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });
});
