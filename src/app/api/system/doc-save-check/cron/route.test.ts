import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runDocSaveCheck: vi.fn(),
  allowAdminDryRun: vi.fn(),
}));

vi.mock("@/lib/doc-save-check/run", () => ({ runDocSaveCheck: mocks.runDocSaveCheck }));
vi.mock("@/lib/pl-payments/admin-dry-run", () => ({ allowAdminDryRun: mocks.allowAdminDryRun }));

import { GET } from "./route";

describe("/api/system/doc-save-check/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret";
    mocks.runDocSaveCheck.mockResolvedValue({ ok: true, applied: true });
    mocks.allowAdminDryRun.mockResolvedValue(false);
  });

  it("合言葉が正しければ本運転", async () => {
    const response = await GET(new Request("http://test/api/system/doc-save-check/cron", { headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.runDocSaveCheck).toHaveBeenCalledWith({ apply: true, trigger: "cron", force: false });
  });

  it("合言葉が無ければ動かない", async () => {
    const response = await GET(new Request("http://test/api/system/doc-save-check/cron"));
    expect(response.status).not.toBe(200);
    expect(mocks.runDocSaveCheck).not.toHaveBeenCalled();
  });

  it("管理者ログインはdryだけ許可し、forceを渡す", async () => {
    mocks.allowAdminDryRun.mockResolvedValue(true);
    const response = await GET(new Request("http://test/api/system/doc-save-check/cron?dry=1&force=1"));
    expect(response.status).toBe(200);
    expect(mocks.runDocSaveCheck).toHaveBeenCalledWith({ apply: false, trigger: "cron", force: true });
    mocks.runDocSaveCheck.mockClear();
    const live = await GET(new Request("http://test/api/system/doc-save-check/cron?force=1"));
    expect(live.status).not.toBe(200);
    expect(mocks.runDocSaveCheck).not.toHaveBeenCalled();
  });

  it("管理者でなければdryも拒否し、実行失敗は500", async () => {
    const denied = await GET(new Request("http://test/api/system/doc-save-check/cron?dry=1"));
    expect(denied.status).not.toBe(200);
    mocks.runDocSaveCheck.mockResolvedValue({ ok: false });
    const failed = await GET(new Request("http://test/api/system/doc-save-check/cron?dry=1", { headers: { authorization: "Bearer secret" } }));
    expect(failed.status).toBe(500);
  });
});

