import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

function sessionClient(role = "staff", user: { id: string } | null = { id: "U1" }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { garden_role: role }, error: null }),
    })),
  };
}

function adminClient(download = vi.fn().mockResolvedValue({ data: new Blob(["manual"]), error: null })) {
  return {
    storage: {
      from: vi.fn(() => ({ download })),
    },
  };
}

function ctx(file = "1_operation.html") {
  return { params: Promise.resolve({ module: "system", slug: "kot-attendance", file }) };
}

describe("system manuals route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createServerClient.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("serves a staff-visible html manual from the private bucket", async () => {
    const admin = adminClient();
    mocks.createServerClient.mockResolvedValue(sessionClient("staff"));
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/manuals/system/kot-attendance/1_operation.html"), ctx());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(admin.storage.from).toHaveBeenCalledWith("system-manuals");
    expect(admin.storage.from.mock.results[0].value.download).toHaveBeenCalledWith("system/kot-attendance/1_operation.html");
    expect(await response.text()).toBe("manual");
  });

  it("rejects a staff user for super admin tabs without downloading content", async () => {
    const download = vi.fn();
    mocks.createServerClient.mockResolvedValue(sessionClient("staff"));
    mocks.getSupabaseAdmin.mockReturnValue(adminClient(download));
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/manuals/system/kot-attendance/0_summary.html"), ctx("0_summary.html"));

    expect(response.status).toBe(403);
    expect(download).not.toHaveBeenCalled();
  });

  it("serves super admin markdown with the markdown content type", async () => {
    mocks.createServerClient.mockResolvedValue(sessionClient("super_admin"));
    mocks.getSupabaseAdmin.mockReturnValue(adminClient(vi.fn().mockResolvedValue({ data: new Blob(["# title"]), error: null })));
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/manuals/system/kot-attendance/4_claude.md"), ctx("4_claude.md"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(await response.text()).toBe("# title");
  });

  it("returns 404 for unregistered files and storage misses", async () => {
    mocks.createServerClient.mockResolvedValue(sessionClient("super_admin"));
    mocks.getSupabaseAdmin.mockReturnValue(adminClient(vi.fn().mockResolvedValue({ data: null, error: new Error("missing") })));
    const { GET } = await import("./route");

    expect((await GET(new Request("http://localhost/api/system/manuals/system/kot-attendance/unknown.html"), ctx("unknown.html"))).status).toBe(404);
    expect((await GET(new Request("http://localhost/api/system/manuals/system/kot-attendance/1_operation.html"), ctx("1_operation.html"))).status).toBe(404);
  });

  it("returns 401 without a login session", async () => {
    mocks.createServerClient.mockResolvedValue(sessionClient("staff", null));
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/manuals/system/kot-attendance/1_operation.html"), ctx());

    expect(response.status).toBe(401);
  });
});
