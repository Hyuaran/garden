import "@/lib/auth/__tests__/system-view-fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadKanriPoints: vi.fn(),
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/app/system/kanri/_lib/kanri-points.server", () => ({ loadKanriPoints: mocks.loadKanriPoints }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

describe("system kanri month settings route", () => {
  beforeEach(() => {
    mocks.loadKanriPoints.mockReset();
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/month-settings/2026-09"), {
      params: Promise.resolve({ yearMonth: "2026-09" }),
    });

    expect(response.status).toBe(403);
  });

  it("saves and reads holidays", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const saved = { year_month: "2026-09", holidays: ["2026-09-08", "2026-09-15"] };
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        upsert: (row: unknown) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { ...saved, row }, error: null }),
          }),
        }),
      }),
    });
    const { PUT } = await import("./route");

    const response = await PUT(new Request("http://localhost/api/system/kanri/month-settings/2026-09", {
      method: "PUT",
      body: JSON.stringify({ holidays: saved.holidays }),
    }), { params: Promise.resolve({ yearMonth: "2026-09" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.setting.holidays).toEqual(saved.holidays);
  });
});

it("reads the selected month's product columns with the shared loader", async () => {
 mocks.requireManager.mockResolvedValue({userId:"user-1"});
 mocks.loadKanriPoints.mockResolvedValue({data:[{product:"新商材"}],error:null});
 mocks.getSupabaseAdmin.mockReturnValue({from:()=>({select:()=>({eq:()=>({maybeSingle:()=>Promise.resolve({data:null,error:null})})})})});
 const {GET}=await import("./route");
 const response=await GET(new Request("http://localhost/api/system/kanri/month-settings/2026-11"),{params:Promise.resolve({yearMonth:"2026-11"})});
 expect(response.status).toBe(200);expect(mocks.loadKanriPoints).toHaveBeenCalledWith("2026-11");expect((await response.json()).products).toEqual(["新商材"]);
});
