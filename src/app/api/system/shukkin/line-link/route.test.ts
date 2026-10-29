import "@/lib/auth/__tests__/system-view-fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock('@/lib/line/richmenu.server',()=>({syncRichMenus:vi.fn(async()=>{})}));

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

function request(body: unknown) {
  return new Request("http://localhost/api/system/shukkin/line-link", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/system/shukkin/line-link", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireManager.mockResolvedValue({ employee_id: "EMP-1" });
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("links a pending LINE account to an employee and removes pending", async () => {
    const updates: unknown[] = [];
    const deleted: string[] = [];
    const pendingSelect = {
      select: vi.fn(() => pendingSelect),
      eq: vi.fn(() => pendingSelect),
      maybeSingle: vi.fn(() => Promise.resolve({ data: { display_name: "LINE表示名" }, error: null })),
    };
    const pendingDelete = {
      delete: vi.fn(() => pendingDelete),
      eq: vi.fn((_: string, value: string) => {
        deleted.push(value);
        return Promise.resolve({ data: null, error: null });
      }),
    };
    let pendingCount = 0;
    const rootBuilder = {
      update: vi.fn((row: unknown) => {
        updates.push(row);
        return rootBuilder;
      }),
      eq: vi.fn(() => rootBuilder),
      is: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "system_line_staff_pending") {
          pendingCount += 1;
          return pendingCount === 1 ? pendingSelect : pendingDelete;
        }
        return rootBuilder;
      }),
    });
    const { POST } = await import("./route");

    const response = await POST(request({ lineUserId: "U1568", employeeNumber: "1568" }));

    expect(response.status).toBe(200);
    expect(updates).toEqual([
      expect.objectContaining({ line_user_id: null, line_link_source: "admin_unlink" }),
      expect.objectContaining({ line_user_id: "U1568", line_display_name: "LINE表示名", line_link_source: "admin" }),
    ]);
    expect(deleted).toEqual(["U1568"]);
  });
});
