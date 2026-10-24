import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ requireEmployee: vi.fn(), getSupabaseAdmin: vi.fn(), fetchKotEmployeeByCode: vi.fn(), fetchKotHireOptions: vi.fn(), updateKotEmployee: vi.fn(), insert: vi.fn() }));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireEmployee: m.requireEmployee }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: m.getSupabaseAdmin }));
vi.mock("@/app/root/_lib/kot-api", async importOriginal => ({ ...await importOriginal<typeof import("@/app/root/_lib/kot-api")>(), fetchKotEmployeeByCode: m.fetchKotEmployeeByCode, fetchKotHireOptions: m.fetchKotHireOptions, updateKotEmployee: m.updateKotEmployee }));
import { GET, PATCH } from "./route";
let role = "super_admin";
const context = { params: Promise.resolve({ employeeId: "EMP-1" }) };
const request = (body: unknown) => new Request("http://localhost/api/root/employees/EMP-1/kot", { method: "PATCH", body: JSON.stringify(body) });
beforeEach(() => {
 vi.clearAllMocks(); vi.stubEnv("KOT_EMPLOYEE_UPDATE_ENABLED", "true"); role = "super_admin";
 m.requireEmployee.mockResolvedValue({ employee_id: "actor", userId: "user", employee_number: "1" });
 m.insert.mockResolvedValue({ error: null });
 m.getSupabaseAdmin.mockReturnValue({ from: (table: string) => {
  if (table === "root_audit_log") return { insert: m.insert };
  return { select: (columns: string) => { const query = { eq: () => query, is: () => query, maybeSingle: async () => ({ data: columns === "garden_role" ? { garden_role: role } : { kot_employee_id: "1571" }, error: null }) }; return query; } };
 } });
 m.fetchKotEmployeeByCode.mockResolvedValue({ key: "key-1", code: "1571", divisionCode: "1", typeCode: "a" });
 m.fetchKotHireOptions.mockResolvedValue({ divisions: [{ code: "1", name: "本社" }, { code: "2", name: "事務" }], workingTypes: [{ code: "a", name: "社員" }] });
});
afterEach(() => vi.unstubAllEnvs());
it.each(["admin", "manager", "staff"])("rejects %s for both methods", async value => {
 role = value;
 expect((await GET(new Request("http://localhost"), context)).status).toBe(403);
 expect((await PATCH(request({ divisionCode: "2", updateDate: "2026-10-24" }), context)).status).toBe(403);
 expect(m.fetchKotEmployeeByCode).not.toHaveBeenCalled(); expect(m.updateKotEmployee).not.toHaveBeenCalled();
});
it("returns current codes and options without employee key", async () => {
 const response = await GET(new Request("http://localhost"), context);
 expect(await response.json()).toMatchObject({ code: "1571", divisionCode: "1", typeCode: "a" });
 expect(m.fetchKotEmployeeByCode).toHaveBeenCalledWith("1571");
});
it("updates only supplied fields and records before and after once", async () => {
 expect((await PATCH(request({ divisionCode: "2", updateDate: "2026-10-24" }), context)).status).toBe(200);
 expect(m.updateKotEmployee).toHaveBeenCalledExactlyOnceWith("key-1", { divisionCode: "2" }, "2026-10-24");
 expect(m.insert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ action: "kot_employee_update", target_id: "EMP-1", payload: { updateDate: "2026-10-24", before: { divisionCode: "1", typeCode: "a" }, after: { divisionCode: "2", typeCode: "a" } } }));
});
it("stops before KOT reads when disabled", async () => {
 vi.stubEnv("KOT_EMPLOYEE_UPDATE_ENABLED", "");
 expect((await PATCH(request({ divisionCode: "2", updateDate: "2026-10-24" }), context)).status).toBe(400);
 expect(m.fetchKotEmployeeByCode).not.toHaveBeenCalled();
});
it.each([{divisionCode:"",updateDate:"2026-10-24"},{divisionCode:"2",updateDate:"2026-02-30"},{lastName:"山田",updateDate:"2026-10-24"}])("rejects invalid input", async body => {
 expect((await PATCH(request(body),context)).status).toBe(400);expect(m.updateKotEmployee).not.toHaveBeenCalled();
});
it("does not audit failed KOT writes", async () => {
 m.updateKotEmployee.mockRejectedValueOnce(new Error("KOT が止まっています"));
 expect((await PATCH(request({ divisionCode: "2", updateDate: "2026-10-24" }), context)).status).toBe(400);
 expect(m.insert).not.toHaveBeenCalled();
});
it("reports audit failure without retrying update", async () => {
 m.insert.mockResolvedValueOnce({ error: { message: "failed" } });
 const response = await PATCH(request({ divisionCode: "2", updateDate: "2026-10-24" }), context);
 expect(response.status).toBe(500);expect((await response.json()).error).toContain("再反映せず");expect(m.updateKotEmployee).toHaveBeenCalledTimes(1);
});