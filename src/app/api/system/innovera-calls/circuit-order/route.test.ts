import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";
const mocks = vi.hoisted(() => ({ role: "super_admin", rpc: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/innovera/calls.server", () => ({ requireCallAccess: async () => ({ role: mocks.role }), callAccessErrorResponse: (e: unknown) => { throw e; } }));
vi.mock("@/lib/innovera/client", () => ({ listInnoveraCircuits: async () => [{ id: "a", name: "A" }, { id: "b", name: "B" }] }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc, from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }) }) }));
const put = (body: unknown) => PUT(new Request("http://localhost/api/system/innovera-calls/circuit-order", { method: "PUT", body: JSON.stringify(body) }));
describe("circuit order", () => {
  beforeEach(() => { mocks.role = "super_admin"; vi.clearAllMocks(); });
  it.each(["admin", "manager", "staff", "cs"])("denies %s on GET and PUT", async role => {
    mocks.role = role;
    for (const response of [await GET(), await put({})]) {
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe("並び順を変更する権限がありません");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { groups: [{ name: "", circuitIds: [] }], other: [] },
    { groups: [{ name: " 重複", circuitIds: [] }], other: [] },
    { groups: [{ name: "あ".repeat(31), circuitIds: [] }], other: [] },
    { groups: [{ name: "同じ", circuitIds: [] }, { name: "同じ", circuitIds: [] }], other: [] },
    { groups: [{ name: "代表", circuitIds: ["a"] }], other: ["a"] },
    { groups: [], other: ["missing"] },
    { groups: [{ id: "invalid", name: "代表", circuitIds: [] }], other: [] },
  ])("rejects invalid body %j", async body => { expect((await put(body)).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("sends the complete snapshot to the atomic function and returns all circuits", async () => {
    const body = { groups: [{ name: "代表", circuitIds: ["b"] }], other: ["a"] };
    const response = await put(body);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("system_innovera_save_circuit_order", { p_groups: body.groups, p_other: body.other });
    expect((await response.json()).circuits.map((c: { id: string }) => c.id)).toEqual(["a", "b"]);
    expect((await (await GET()).json()).circuitGroups[0].name).toBe("その他");
  });
});
