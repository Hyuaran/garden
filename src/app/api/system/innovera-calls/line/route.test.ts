import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { listInnoveraCircuits } from "@/lib/innovera/client";

const mocks = vi.hoisted(() => ({
  employee: {
    employee_id: "EMP-1",
    name: "Agent",
    innovera_extension: "2040",
    innovera_mobile_extension: "1003",
  } as Record<string, unknown>,
  insert: vi.fn(async () => ({ error: null })),
  groups: [] as { id: string; name: string; sort_order: number }[],
  positions: [] as { circuit_id: string; group_id: string | null; sort_order: number }[],
  setDefaultCircuit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/innovera/calls.server", () => ({
  requireCallAccess: vi.fn(async () => ({
    supabase: {},
    employeeId: "EMP-1",
    employeeName: "Agent",
    role: "cs",
    access: "own",
    ownExtension: "2040",
    ownExtensions: ["2040", "1003"],
  })),
  callAccessErrorResponse: vi.fn((error) => { throw error; }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === "system_innovera_line_change_log") return { insert: mocks.insert };
      if (table === "system_innovera_circuit_groups" || table === "system_innovera_circuit_positions") return {
        select: () => ({ order: async () => ({ data: table.endsWith("groups") ? mocks.groups : mocks.positions, error: null }) }),
      };
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: mocks.employee, error: null })),
          })),
        })),
      };
    }),
  }),
}));

vi.mock("@/lib/innovera/client", () => ({
  listInnoveraUsers: vi.fn(async () => [
    { id: "user-pc", name: "Agent PC", number: "2040", default_circuit_id: "circuit-1" },
    { id: "user-mobile", name: "Agent Mobile", number: "1003", default_circuit_id: "circuit-2" },
  ]),
  listInnoveraCircuits: vi.fn(async () => [
    { id: "circuit-1", name: "Line 1", number: "0501", free_number: "0120", circuit_num: "1", out_users_id: "#user-pc#" },
    { id: "circuit-2", name: "Line 2", number: "0502", free_number: "", circuit_num: "2", out_users_id: "#user-mobile#" },
  ]),
  setInnoveraDefaultCircuit: mocks.setDefaultCircuit,
}));

describe("innovera calls line route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.groups = []; mocks.positions = [];
    mocks.employee = {
      employee_id: "EMP-1",
      name: "Agent",
      innovera_extension: "2040",
      innovera_mobile_extension: "1003",
    };
  });

  it("uses the PC extension to find the INNOVERA user", async () => {
    const response = await GET(new Request("http://localhost/api/system/innovera-calls/line"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.user.id).toBe("user-pc");
    expect(body.employee).toMatchObject({ extension: "2040", mobileExtension: "1003" });
    expect(body.circuits.map((circuit: { id: string }) => circuit.id)).toEqual(["circuit-1"]);
  });

  it("returns saved headings and order, appends new circuits, omits removed and forbidden circuits", async () => {
    const original = await listInnoveraCircuits();
    vi.mocked(listInnoveraCircuits).mockResolvedValueOnce([
      ...original,
      { ...original[0], id: "new" },
      { ...original[0], id: "saved-other" },
      { ...original[0], id: "saved-first" },
    ]);
    mocks.groups = [{ id: "g1", name: "代表番号", sort_order: 0 }, { id: "g2", name: "空", sort_order: 1 }];
    mocks.positions = [
      { circuit_id: "saved-first", group_id: "g1", sort_order: 0 },
      { circuit_id: "removed", group_id: "g1", sort_order: 1 },
      { circuit_id: "circuit-2", group_id: "g1", sort_order: 2 },
      { circuit_id: "saved-other", group_id: null, sort_order: 0 },
    ];
    const response = await GET(new Request("http://localhost/api/system/innovera-calls/line"));
    const body = await response.json();
    expect(body.circuits.map((c: { id: string }) => c.id)).toEqual(["saved-first", "saved-other", "circuit-1", "new"]);
    expect(body.circuitGroups.map((g: { id: string | null; name: string; circuits: { id: string }[] }) => ({ ...g, circuits: g.circuits.map(c => c.id) }))).toEqual([
      { id: "g1", name: "代表番号", circuits: ["saved-first"] }, { id: "g2", name: "空", circuits: [] },
      { id: null, name: "その他", circuits: ["saved-other", "circuit-1", "new"] },
    ]);
  });

  it("returns 400 when only the mobile extension is registered", async () => {
    mocks.employee = {
      employee_id: "EMP-1",
      name: "Agent",
      innovera_extension: null,
      innovera_mobile_extension: "1003",
    };
    const response = await GET(new Request("http://localhost/api/system/innovera-calls/line"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("PC 版の内線番号が登録されていないため、発信番号は変更できません");
  });

  it("changes the default circuit for the PC user", async () => {
    const response = await POST(new Request("http://localhost/api/system/innovera-calls/line", {
      method: "POST",
      body: JSON.stringify({ circuitId: "circuit-1" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.setDefaultCircuit).toHaveBeenCalledWith("user-pc", "circuit-1");
  });
});
