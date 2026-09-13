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
      maybeSingle: vi.fn().mockResolvedValue({ data: { name: "東海林", garden_role: role }, error: null }),
    })),
  };
}

function versionQuery(rows: unknown[] = []) {
  type Query = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
  const query: Query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
    single: vi.fn().mockResolvedValue({ data: rows[0] ?? { id: "V1" }, error: null }),
  };
  return query;
}

function adminClient(download = vi.fn().mockResolvedValue({ data: new Blob(["manual"]), error: null }), rows: unknown[] = []) {
  const query = versionQuery(rows);
  const bucket = { download, copy: vi.fn().mockResolvedValue({ data: {}, error: null }), upload: vi.fn().mockResolvedValue({ data: {}, error: null }) };
  return {
    from: vi.fn(() => ({
      select: query.select,
      insert: vi.fn(() => ({ select: query.select })),
    })),
    storage: {
      from: vi.fn(() => bucket),
    },
    _query: query,
    _bucket: bucket,
  };
}

function ctx(file = "1_operation.html") {
  return { params: Promise.resolve({ module: "system", slug: "kot-attendance", file }) };
}

function requestWithManualFile(file: Blob & { name: string; size: number }) {
  return { formData: vi.fn().mockResolvedValue({ get: vi.fn(() => file) }) } as unknown as Request;
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

  it("replaces a manual by copying the current file, uploading the new file, and recording versions", async () => {
    const admin = adminClient(vi.fn().mockResolvedValue({ data: new Blob(["old"]), error: null }), [{ id: "V1" }, { id: "V2" }]);
    mocks.createServerClient.mockResolvedValue(sessionClient("super_admin"));
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { POST } = await import("./replace/route");
    const file = new Blob(["new"], { type: "text/html" }) as Blob & { name: string };
    file.name = "manual.html";

    const response = await POST(requestWithManualFile(file), ctx());

    expect(response.status).toBe(200);
    expect(admin._bucket.copy).toHaveBeenCalledWith("system/kot-attendance/1_operation.html", expect.stringMatching(/^system\/kot-attendance\/_versions\/1_operation\.html\.\d{8}-\d{6}$/));
    expect(admin._bucket.upload).toHaveBeenCalledWith("system/kot-attendance/1_operation.html", expect.any(ArrayBuffer), expect.objectContaining({ upsert: true }));
    expect(admin.from).toHaveBeenCalledWith("system_manual_versions");
  });

  it("rejects replace for non super admin users", async () => {
    const admin = adminClient();
    mocks.createServerClient.mockResolvedValue(sessionClient("staff"));
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { POST } = await import("./replace/route");
    const file = new Blob(["new"], { type: "text/html" }) as Blob & { name: string };
    file.name = "manual.html";

    const response = await POST(requestWithManualFile(file), ctx());

    expect(response.status).toBe(403);
    expect(admin._bucket.upload).not.toHaveBeenCalled();
  });

  it("returns current and old manual versions", async () => {
    const rows = [
      { id: "C1", module: "system", slug: "kot-attendance", file: "1_operation.html", storage_path: "system/kot-attendance/1_operation.html", size: 3, uploaded_by: "東海林", uploaded_at: "2026-09-13T12:30:00.000Z" },
      { id: "O1", module: "system", slug: "kot-attendance", file: "1_operation.html", storage_path: "system/kot-attendance/_versions/1_operation.html.20260913-213000", size: 4, uploaded_by: "東海林", uploaded_at: "2026-09-13T12:20:00.000Z" },
    ];
    mocks.createServerClient.mockResolvedValue(sessionClient("super_admin"));
    mocks.getSupabaseAdmin.mockReturnValue(adminClient(undefined, rows));
    const { GET } = await import("./versions/route");

    const response = await GET(new Request("http://localhost"), ctx());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.current.id).toBe("C1");
    expect(payload.versions).toHaveLength(1);
    expect(payload.versions[0].id).toBe("O1");
  });

  it("restores an old version after archiving the current version", async () => {
    const oldVersion = { id: "O1", module: "system", slug: "kot-attendance", file: "1_operation.html", storage_path: "system/kot-attendance/_versions/1_operation.html.20260913-213000", size: 4, uploaded_by: "東海林", uploaded_at: "2026-09-13T12:20:00.000Z" };
    const admin = adminClient(vi.fn()
      .mockResolvedValueOnce({ data: new Blob(["old"]), error: null })
      .mockResolvedValueOnce({ data: new Blob(["current"]), error: null }), [oldVersion, { id: "V2" }, { id: "V3" }]);
    mocks.createServerClient.mockResolvedValue(sessionClient("super_admin"));
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { POST } = await import("./restore/route");

    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ versionId: "O1" }) }), ctx());

    expect(response.status).toBe(200);
    expect(admin._bucket.copy).toHaveBeenCalledWith("system/kot-attendance/1_operation.html", expect.stringMatching(/^system\/kot-attendance\/_versions\/1_operation\.html\.\d{8}-\d{6}$/));
    expect(admin._bucket.upload).toHaveBeenCalledWith("system/kot-attendance/1_operation.html", expect.any(ArrayBuffer), expect.objectContaining({ upsert: true }));
  });
});
