import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
const authGetUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: authGetUserMock },
    from: fromMock,
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    remove: vi.fn(),
  })),
}));

// Import AFTER mocks are set up
import { GET, PUT } from "../route";

// ---- Helpers ----
type Result = { data: unknown; error: { message: string } | null };

function chainSelectMaybeSingle(result: Result) {
  return {
    select: () => ({
      order: () => ({
        limit: () => ({
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
      eq: () => ({
        maybeSingle: () => Promise.resolve(result),
      }),
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve(result),
            }),
          }),
        }),
      }),
    }),
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://x/api/ceo-status", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  authGetUserMock.mockReset();
  fromMock.mockReset();
});

// =============================================================
// GET
// =============================================================

describe("GET /api/ceo-status", () => {
  it("returns 200 with status payload + JOIN'd updated_by_name", async () => {
    const row = {
      status: "busy",
      summary: "Root Phase B",
      updated_at: "2026-04-26T05:00:00Z",
      updated_by: "u1",
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "bloom_ceo_status") {
        return chainSelectMaybeSingle({ data: row, error: null });
      }
      if (table === "root_employees") {
        return chainSelectMaybeSingle({ data: { name: "東海林" }, error: null });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("busy");
    expect(body.summary).toBe("Root Phase B");
    expect(body.updated_at).toBe("2026-04-26T05:00:00Z");
    expect(body.updated_by_name).toBe("東海林");
  });

  it("returns 200 with default 'available' payload when no row exists", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "bloom_ceo_status") {
        return chainSelectMaybeSingle({ data: null, error: null });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("available");
    expect(body.summary).toBeNull();
    expect(body.updated_at).toBeNull();
    expect(body.updated_by_name).toBeNull();
  });

  it("returns 500 when supabase returns error", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "bloom_ceo_status") {
        return chainSelectMaybeSingle({ data: null, error: { message: "db down" } });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("db down");
  });

  // ---- edge cases (review feedback) ----
  it("returns 200 with updated_by_name=null when updated_by is null (no JOIN call)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "bloom_ceo_status") {
        return chainSelectMaybeSingle({
          data: {
            status: "available",
            summary: "初期化",
            updated_at: "2026-04-26T00:00:00Z",
            updated_by: null,
          },
          error: null,
        });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_by_name).toBeNull();
    // root_employees に JOIN クエリ発行されない（updated_by=null のため early return）
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 with updated_by_name=null when employee record not found", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "bloom_ceo_status") {
        return chainSelectMaybeSingle({
          data: {
            status: "busy",
            summary: "test",
            updated_at: "2026-04-26T05:00:00Z",
            updated_by: "u_missing",
          },
          error: null,
        });
      }
      if (table === "root_employees") {
        // 退職等で root_employees 不在 → name 取得失敗
        return chainSelectMaybeSingle({ data: null, error: null });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_by_name).toBeNull();
  });
});

// =============================================================
// PUT
// =============================================================

describe("PUT /api/ceo-status", () => {
  it("returns 401 when unauthenticated", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: null } });

    const res = await PUT(makeRequest({ status: "busy" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not super_admin", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return chainSelectMaybeSingle({
          data: { garden_role: "manager", name: "Manager-san" },
          error: null,
        });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await PUT(makeRequest({ status: "busy" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when status is not in enum", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return chainSelectMaybeSingle({
          data: { garden_role: "super_admin", name: "東海林" },
          error: null,
        });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await PUT(makeRequest({ status: "invalid_value" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when summary > 200 chars", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return chainSelectMaybeSingle({
          data: { garden_role: "super_admin", name: "東海林" },
          error: null,
        });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await PUT(makeRequest({ status: "busy", summary: "a".repeat(201) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return chainSelectMaybeSingle({
          data: { garden_role: "super_admin", name: "東海林" },
          error: null,
        });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await PUT(makeRequest("{not-json"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when bloom_ceo_status row is missing (seed not run)", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return chainSelectMaybeSingle({
          data: { garden_role: "super_admin", name: "東海林" },
          error: null,
        });
      }
      if (table === "bloom_ceo_status") {
        // existing row lookup returns null (no id) → 500
        return chainSelectMaybeSingle({ data: null, error: null });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await PUT(makeRequest({ status: "busy", summary: "test" }));
    expect(res.status).toBe(500);
  });

  it("returns 200 on valid super_admin update (full happy path)", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return chainSelectMaybeSingle({
          data: { garden_role: "super_admin", name: "東海林" },
          error: null,
        });
      }
      if (table === "bloom_ceo_status") {
        // First call returns row { id }; subsequent update returns updated row
        return {
          ...chainSelectMaybeSingle({
            data: { id: "row1", status: "focused", summary: "updated", updated_at: "2026-04-26T06:00:00Z", updated_by: "u1" },
            error: null,
          }),
        };
      }
      throw new Error("unexpected table " + table);
    });

    const res = await PUT(makeRequest({ status: "focused", summary: "updated" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("focused");
    expect(body.summary).toBe("updated");
    expect(body.updated_by_name).toBe("東海林");
  });

  // ---- edge cases (review feedback) ----
  it("returns 200 when summary field is omitted from PUT body", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return chainSelectMaybeSingle({
          data: { garden_role: "super_admin", name: "東海林" },
          error: null,
        });
      }
      if (table === "bloom_ceo_status") {
        return chainSelectMaybeSingle({
          data: { id: "row1", status: "available", summary: null, updated_at: "2026-04-26T07:00:00Z", updated_by: "u1" },
          error: null,
        });
      }
      throw new Error("unexpected table " + table);
    });

    // body に summary なし → null として update に渡る → 200
    const res = await PUT(makeRequest({ status: "available" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBeNull();
  });

  it("returns 403 when authenticated user has no employee record (orphan)", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u_orphan" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "root_employees") {
        // 認証は通るが root_employees に行なし（孤立 auth user）→ garden_role 取得不可 → 403
        return chainSelectMaybeSingle({ data: null, error: null });
      }
      throw new Error("unexpected table " + table);
    });

    const res = await PUT(makeRequest({ status: "busy" }));
    expect(res.status).toBe(403);
  });
});
