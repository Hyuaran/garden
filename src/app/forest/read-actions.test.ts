import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ allow: true, configured: false, admin: vi.fn(), legacy: vi.fn(), authorize: vi.fn() }));
vi.mock("@/lib/auth/leaf-forest-view.server", () => ({
  requireForestDataRead: async (...args: unknown[]) => { mocks.authorize(...args); if (!mocks.allow) throw new Error("denied"); },
  requireLeafForestRead: async (...args: unknown[]) => { mocks.authorize(...args); if (!mocks.allow) throw new Error("denied"); return { db: { from: mocks.legacy } }; },
}));
vi.mock("@/lib/auth/view-permission.server", () => ({
  ViewPermissionError: class extends Error {},
  readViewPermissions: async () => mocks.configured ? [{ page_key: "forest-journal", tab_key: "" }] : [],
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from: mocks.admin }) }));
import { readForestSnapshot, readForestHankanhi, readForestJournalMasters } from "./read-actions";
function query(data: unknown) {
  const result = { data, error: null };
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve) };
  for (const key of ["select", "eq", "order", "is", "maybeSingle"]) chain[key] = vi.fn(() => chain);
  return chain;
}
beforeEach(() => { vi.clearAllMocks(); mocks.allow = true; mocks.configured = false; mocks.admin.mockImplementation(() => query([])); mocks.legacy.mockImplementation(() => query([])); });
describe("Forest privileged readers", () => {
  it("denies before using the administrator connection", async () => {
    mocks.allow = false;
    await expect(readForestSnapshot("forest-dashboard")).rejects.toThrow("denied");
    await expect(readForestHankanhi("forest-dashboard", "matrix", "corp", 1)).rejects.toThrow("denied");
    await expect(readForestJournalMasters("forest-journal")).rejects.toThrow("denied");
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it("reads only the explicit core tables after authorization", async () => {
    await readForestSnapshot("forest-dashboard", "matrix");
    expect(mocks.authorize).toHaveBeenCalledWith("forest-dashboard", "matrix");
    expect(mocks.admin.mock.calls.map(([table]) => table)).toEqual(["companies", "fiscal_periods", "shinkouki"]);
  });
  it.each(["forest-reports", "forest-company-overview", "leaf-overview", "unknown"])("cannot use a placeholder grant to read financial data: %s", async page => {
    await expect(readForestSnapshot(page)).rejects.toThrow(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("retains RLS without settings and uses admin reads after a configured grant", async () => {
    await readForestJournalMasters("forest-journal");
    expect(mocks.legacy).toHaveBeenCalledWith("bud_corporations"); expect(mocks.admin).not.toHaveBeenCalled();
    mocks.configured = true;
    await readForestJournalMasters("forest-journal");
    expect(mocks.admin).toHaveBeenCalledWith("bud_corporations");
  });
  it("rejects invalid hankanhi requests before querying", async () => {
    await expect(readForestHankanhi("forest-dashboard", "matrix", "", 0)).rejects.toThrow();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not return fiscal periods or hankanhi using a progress screen grant", async () => {
    const snapshot = await readForestSnapshot("forest-shinkouki", "numbers");
    expect(snapshot.periods).toEqual([]);
    expect(mocks.admin).not.toHaveBeenCalledWith("fiscal_periods");
    await expect(readForestHankanhi("forest-shinkouki", "numbers", "corp", 1)).rejects.toThrow();
    expect(mocks.admin).not.toHaveBeenCalledWith("forest_hankanhi");
  });
});
