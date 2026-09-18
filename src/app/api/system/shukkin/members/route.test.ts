import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  requireManager: vi.fn(),
}));

const db = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => auth);
vi.mock("@/lib/supabase/admin", () => db);

function selectChain(data: unknown[] = []) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
  };
  return chain;
}

function upsertChain(data: unknown[] = []) {
  const chain = {
    upsert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
  };
  return chain;
}

describe("/api/system/shukkin/members", () => {
  beforeEach(() => {
    vi.resetModules();
    auth.requireStaff.mockReset();
    auth.requireManager.mockReset();
    db.getSupabaseAdmin.mockReset();
  });

  it("allows staff to read members", async () => {
    auth.requireStaff.mockResolvedValue({ userId: "u1" });
    const memberChain = selectChain([{ employee_number: "1392", group_name: "小泉チーム", sort_order: 10, active: true, display_name: null }]);
    const employeeChain = selectChain([{ employee_number: "1392", name: "田中 実花" }]);
    const from = vi.fn((table: string) => table === "root_employees" ? employeeChain : memberChain);
    db.getSupabaseAdmin.mockReturnValue({ from });
    const route = await import("./route");
    const response = await route.GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(memberChain.select).toHaveBeenCalledWith("employee_number,group_name,sort_order,active,display_name");
    expect(employeeChain.select).toHaveBeenCalledWith("employee_number,name");
    expect(employeeChain.in).toHaveBeenCalledWith("employee_number", ["1392"]);
    expect(body.members[0]).toMatchObject({ employeeNumber: "1392", name: "田中 実花", groupName: "小泉チーム" });
  });

  it("does not allow non-managers to save members", async () => {
    auth.requireManager.mockResolvedValue(null);
    const route = await import("./route");
    const response = await route.PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify({ members: [] }) }));
    expect(response.status).toBe(403);
  });

  it("allows managers to save members", async () => {
    auth.requireManager.mockResolvedValue({ userId: "u1" });
    const memberChain = upsertChain([{ employee_number: "1392", group_name: "小泉チーム", sort_order: 10, active: true, display_name: "田中 実花" }]);
    const employeeChain = selectChain([{ employee_number: "1392", name: "田中 実花" }]);
    const from = vi.fn((table: string) => table === "root_employees" ? employeeChain : memberChain);
    db.getSupabaseAdmin.mockReturnValue({ from });
    const route = await import("./route");
    const response = await route.PUT(new Request("http://localhost", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ members: [{ employeeNumber: "1392", groupName: "小泉チーム", sortOrder: 10, displayName: "田中 実花" }] }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(memberChain.upsert).toHaveBeenCalledWith([{
      employee_number: "1392",
      group_name: "小泉チーム",
      sort_order: 10,
      active: true,
      display_name: "田中 実花",
      updated_by: "u1",
    }], { onConflict: "employee_number" });
    expect(body.members[0].employeeNumber).toBe("1392");
    expect(body.members[0].displayName).toBe("田中 実花");
  });
});
