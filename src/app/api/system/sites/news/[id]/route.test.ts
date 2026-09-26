import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

function adminMock() {
  const updates: unknown[] = [];
  const news = {
    update: vi.fn((payload) => {
      updates.push(payload);
      return {
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: { id: "news-1", title: "変更", body: "元の本文", published_on: "2026-09-26", is_published: false },
              error: null,
            }),
          }),
        }),
      };
    }),
  };
  const audit = { insert: vi.fn(() => Promise.resolve({ error: null })) };
  return {
    updates,
    audit,
    client: {
      from: vi.fn((table: string) => table === "root_audit_log" ? audit : news),
    },
  };
}

describe("system site news patch API", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireManager.mockResolvedValue({ userId: "u2", employee_number: "0002", name: "責任者" });
  });

  it("partially updates without clearing omitted columns and writes audit", async () => {
    const admin = adminMock();
    mocks.getSupabaseAdmin.mockReturnValue(admin.client);
    const { PATCH } = await import("./route");

    const response = await PATCH(new Request("http://localhost/api/system/sites/news/news-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "変更", is_published: false }),
    }), { params: Promise.resolve({ id: "news-1" }) });

    expect(response.status).toBe(200);
    expect(admin.updates[0]).toEqual({ title: "変更", is_published: false });
    expect(admin.audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: "site_news_update",
      target_type: "system_site_news",
      target_id: "news-1",
    }));
  });
});
