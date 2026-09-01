import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
import { applyAdminOnboarding, readAdminOnboardingList, readMyNumberForAdmin, type AdminContext } from "./onboarding-admin.server";

function chain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then(resolve: (value: unknown) => void) { return Promise.resolve(result).then(resolve); },
  };
}

describe("事務用入社手続きサーバー処理", () => {
  beforeEach(() => vi.resetAllMocks());

  it("一覧の従業員台帳はadmin接続で読み、入社日を表示し、マイナンバーはマスク済みにする", async () => {
    const onboardingQuery = chain({ data: [{ employee_id: "EMP-1559", name: "吉田 陽菜", my_number: "123456785540", dependents: [{ name: "家族", my_number: "111122223333" }], status: "submitted", submitted_at: "2026-09-01T00:00:00Z" }], error: null });
    const employeeQuery = chain({ data: [{ employee_id: "EMP-1559", name: "吉田 陽菜", hire_date: "2026-09-01", birthday: "2000-01-01", company_id: "COMP-1" }], error: null });
    const userSupabase = { from: vi.fn(() => onboardingQuery) };
    const adminSupabase = { from: vi.fn(() => employeeQuery) };
    mocks.getSupabaseAdmin.mockReturnValue(adminSupabase);

    const rows = await readAdminOnboardingList({ supabase: userSupabase, managerEmployeeId: "EMP-M" } as unknown as AdminContext);

    expect(rows[0].hireDate).toBe("2026-09-01");
    expect(adminSupabase.from).toHaveBeenCalledWith("root_employees");
    expect(employeeQuery.select).toHaveBeenCalledWith("employee_id,name,hire_date,birthday,company_id");
    // 社員番号を取ってこないと台帳と結びつかず、入社日が空になり氏名のリンクも壊れる。
    expect(onboardingQuery.select).toHaveBeenCalledWith(expect.stringContaining("employee_id"));
    expect(JSON.stringify(rows)).not.toMatch(/123456785540|111122223333/);
  });

  it("交通費の確定額はカンマ付きでも従業員台帳へ数値反映する", async () => {
    const systemSave = chain({ error: null });
    const systemRead = chain({ data: { employee_id: "EMP-1", commute_fixed_monthly: "20,000", commute_cap_monthly: "30,000", status: "submitted" }, error: null });
    const rootUpdate = chain({ error: null });
    const userSupabase = {
      from: vi.fn((table: string) => {
        if (table === "system_onboarding") return userSupabase.from.mock.calls.filter(([name]) => name === "system_onboarding").length === 1 ? systemSave : systemRead;
        return rootUpdate;
      }),
    };
    const employeeQuery = chain({ data: [{ employee_id: "EMP-1", name: "吉田 陽菜", hire_date: "2026-09-01", birthday: null, company_id: null }], error: null });
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => employeeQuery) });

    await applyAdminOnboarding({ supabase: userSupabase, managerEmployeeId: "EMP-M" } as unknown as AdminContext, "EMP-1", { commute_fixed_monthly: "20,000", commute_cap_monthly: "30,000" });

    expect(rootUpdate.update).toHaveBeenCalledWith({ dependents_count: 0, commute_monthly_cap: 30000, commute_daily_allowance: 1000 });
  });

  it("見るactionは本人と扶養家族の全桁を返し、監査ログに12桁を入れない", async () => {
    const systemQuery = chain({ data: { my_number: "123456785540", dependents: [{ my_number: "111122223333" }] }, error: null });
    const auditQuery = chain({ error: null });
    const supabase = { from: vi.fn((table: string) => table === "root_audit_log" ? auditQuery : systemQuery) };

    const self = await readMyNumberForAdmin({ supabase, managerEmployeeId: "EMP-M" } as unknown as AdminContext, "EMP-1", { kind: "self" });
    const dependent = await readMyNumberForAdmin({ supabase, managerEmployeeId: "EMP-M" } as unknown as AdminContext, "EMP-1", { kind: "dependent", index: 0 });

    expect(self.myNumber).toBe("123456785540");
    expect(dependent.myNumber).toBe("111122223333");
    expect(auditQuery.insert).toHaveBeenCalledWith({
      actor_emp_num: "EMP-M",
      action: "my_number_view",
      target_type: "system_onboarding",
      target_id: "EMP-1",
      payload: { kind: "self" },
    });
    expect(auditQuery.insert).toHaveBeenCalledWith({
      actor_emp_num: "EMP-M",
      action: "my_number_view",
      target_type: "system_onboarding",
      target_id: "EMP-1",
      payload: { kind: "dependent", index: 1 },
    });
    expect(JSON.stringify(auditQuery.insert.mock.calls)).not.toMatch(/123456785540|111122223333/);
  });
});
