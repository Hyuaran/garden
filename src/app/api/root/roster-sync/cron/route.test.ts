import { getRosterDirection, retryRosterPushes } from '@/app/root/_lib/roster-push.server';
vi.mock('@/app/root/_lib/roster-push.server',()=>({getRosterDirection:vi.fn(async()=> 'kintone_to_garden'),retryRosterPushes:vi.fn(async()=>({sent:1}))}));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyCronRequest: vi.fn(),
  syncRootRoster: vi.fn(),
  syncRichMenus: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronRequest: mocks.verifyCronRequest }));
vi.mock("@/lib/line/richmenu.server", () => ({ syncRichMenus: mocks.syncRichMenus }));
vi.mock("@/app/root/_lib/roster-sync.server", () => ({ syncRootRoster: mocks.syncRootRoster }));

describe("root roster sync cron route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.verifyCronRequest.mockReset();
    mocks.syncRootRoster.mockReset();
    mocks.syncRichMenus.mockReset();
  });

  it("rejects invalid cron requests", async () => {
    mocks.verifyCronRequest.mockReturnValue({ ok: false, status: 401, reason: "Invalid token" });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/root/roster-sync/cron"));

    expect(response.status).toBe(401);
    expect(mocks.syncRootRoster).not.toHaveBeenCalled();
    expect(mocks.syncRichMenus).not.toHaveBeenCalled();
  });

  it("runs apply sync for valid cron requests", async () => {
    mocks.verifyCronRequest.mockReturnValue({ ok: true });
    mocks.syncRootRoster.mockResolvedValue({ ok: true, dryRun: false });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/root/roster-sync/cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.syncRootRoster).toHaveBeenCalledWith({ dryRun: false });
    expect(mocks.syncRichMenus).toHaveBeenCalledTimes(1);
    expect(mocks.syncRootRoster.mock.invocationCallOrder[0]).toBeLessThan(mocks.syncRichMenus.mock.invocationCallOrder[0]);
  });
});

it('retries pushes without importing in garden direction',async()=>{
 mocks.syncRootRoster.mockClear();mocks.syncRichMenus.mockClear();
 vi.mocked(getRosterDirection).mockResolvedValueOnce('garden_to_kintone');mocks.verifyCronRequest.mockReturnValue({ok:true});
 const {GET}=await import('./route');await GET(new Request('http://localhost'));
 expect(mocks.syncRootRoster).not.toHaveBeenCalled();expect(retryRosterPushes).toHaveBeenCalled();expect(mocks.syncRichMenus).toHaveBeenCalled();
});
