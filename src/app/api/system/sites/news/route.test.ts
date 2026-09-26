import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireStaff: mocks.requireStaff,
  requireManager: mocks.requireManager,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

function request(body: unknown) {
  return new Request("http://localhost/api/system/sites/news", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function adminMock() {
  const inserts: unknown[] = [];
  const listQuery = {
    select: vi.fn(() => listQuery),
    eq: vi.fn(() => listQuery),
    order: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  const inserted = {
    id: "news-1",
    company_id: "COMP-001",
    published_on: "2026-09-26",
    title: "手動のお知らせ",
    body: "本文",
    kind: "manual",
    source_field: null,
    is_published: true,
  };
  const newsInsert = {
    insert: vi.fn((payload) => {
      inserts.push(payload);
      return {
        select: () => ({ single: () => Promise.resolve({ data: inserted, error: null }) }),
      };
    }),
  };
  const auditInsert = { insert: vi.fn((payload) => Promise.resolve({ data: payload, error: null })) };
  return {
    inserts,
    auditInsert,
    client: {
      from: vi.fn((table: string) => {
        if (table === "root_audit_log") return auditInsert;
        if (table === "system_site_news") return { ...listQuery, ...newsInsert };
        return {};
      }),
    },
  };
}

describe("system site news API", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireStaff.mockResolvedValue({ userId: "u1", employee_number: "0001", name: "社員" });
    mocks.requireManager.mockResolvedValue({ userId: "u2", employee_number: "0002", name: "責任者" });
  });

  it("rejects staff POST with 403", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(request({ company_id: "COMP-001", published_on: "2026-09-26", title: "題名", body: "" }));
    expect(response.status).toBe(403);
  });

  it("creates manual news as manager and writes audit", async () => {
    const admin = adminMock();
    mocks.getSupabaseAdmin.mockReturnValue(admin.client);
    const { POST } = await import("./route");

    const response = await POST(request({ company_id: "COMP-001", published_on: "2026-09-26", title: "手動のお知らせ", body: "本文" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.news.kind).toBe("manual");
    expect(admin.inserts[0]).toMatchObject({ company_id: "COMP-001", kind: "manual", created_by: "責任者" });
    expect(admin.auditInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: "site_news_update",
      target_type: "system_site_news",
      target_id: "news-1",
    }));
  });
});
