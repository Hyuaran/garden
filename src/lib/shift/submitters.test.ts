import { beforeEach, expect, it, vi } from "vitest";
import { isShiftEligible, type ShiftEmployee } from "./eligibility";

const mocks = vi.hoisted(() => ({ context: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/auth/view-permission.server", () => ({
  viewPermissionContext: mocks.context,
  ViewPermissionError: class extends Error {
    constructor(message: string, public status = 403) { super(message); }
  },
}));
vi.mock("./submitters.server", () => ({ readSubmitters: mocks.read, writeSubmitter: mocks.write }));
import { submittersRoute } from "./submitters-route.server";

const employee: ShiftEmployee = {
  employee_id: "EMP-1490", name: "藤木", is_active: true,
  employment_type: "アルバイト", business: "ブロードバンド事業", current_team: "石原チーム",
};
const include = [{ employee_id: employee.employee_id, mode: "include" as const }];
it("決まりに追加・除外を適用し、新入社員にも決まりを適用する", () => {
  expect(isShiftEligible(employee)).toBe(true);
  expect(isShiftEligible({ ...employee, employment_type: "outsource" })).toBe(false);
  expect(isShiftEligible({ ...employee, employment_type: "outsource" }, include)).toBe(true);
  expect(isShiftEligible(employee, [{ employee_id: employee.employee_id, mode: "exclude" }])).toBe(false);
  expect(isShiftEligible({ ...employee, employee_id: "new" }, include)).toBe(true);
});
it("追加済みでも無効・削除・当日以前の退職者を含めない", () => {
  for (const state of [{ is_active: false }, { deleted_at: "2026-11-04" },
    { termination_date: "2026-11-04" }, { termination_date: "2026-11-03" }]) {
    expect(isShiftEligible({ ...employee, ...state }, include, "2026-11-04")).toBe(false);
  }
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ viewer: { role: "super_admin", employeeId: "admin" } });
  mocks.read.mockResolvedValue({ employees: [], settings: [] });
  mocks.write.mockResolvedValue(true);
});
it.each(["GET", "POST", "DELETE"])("%s は全権管理者以外403", async method => {
  mocks.context.mockResolvedValue({ viewer: { role: "manager" } });
  expect((await submittersRoute(new Request("http://localhost/api/system/shift/submitters", { method }))).status).toBe(403);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
it("追加と復元は設定だけを更新する", async () => {
  for (const method of ["POST", "DELETE"]) {
    const result = await submittersRoute(new Request("http://localhost/api/system/shift/submitters", {
      method, body: JSON.stringify({ employee_id: "EMP-1490", mode: "include" }),
    }));
    expect(result.status).toBe(200);
    expect(mocks.write).toHaveBeenLastCalledWith("EMP-1490", method === "POST" ? "include" : null, "admin");
  }
});
