import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  manager: vi.fn(),
  admin: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireManager: mocks.manager,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
vi.mock(
  "@/app/root/contracts/_lib/employment-contract-generation.server",
  () => ({ generateEmploymentContractPdf: mocks.generate }),
);
import { POST } from "./route";
const payload = {
  kind: "new",
  contractStart: "2026-09-01",
  contractEnd: "2027-03-31",
  jobType: "sales",
  jobTypeOther: "",
  hourlyWage: 1200,
  workLocation: "大阪市",
  concludedOn: "2026-08-28",
  employeeAddress: "",
};
function setup(address = "〒530-0001 大阪市") {
  const employee = {
    employee_id: "E1",
    employee_number: "0001",
    name: "社員A",
    company_id: "COMP-001",
    employment_type: "アルバイト",
    is_active: true,
    root_companies: {
      company_name: "株式会社ヒュアラン",
      representative: "後道翔太",
      address,
    },
  };
  const employeeQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: employee }),
  };
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const contractQuery = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({
        data: {
          id: "C1",
          employee_id: "E1",
          payload,
          created_at: "2026-08-28T00:00:00Z",
        },
        error: null,
      }),
    update: vi.fn().mockReturnValue({ eq: updateEq }),
  };
  mocks.admin.mockReturnValue({
    from: vi.fn((table: string) =>
      table === "root_employees" ? employeeQuery : contractQuery,
    ),
  });
  return { contractQuery, updateEq };
}
describe("root contract route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.mockResolvedValue({ userId: "U1" });
  });
  it.each(["generated", "skipped", "failed"] as const)(
    "stores %s",
    async (status) => {
      const { contractQuery } = setup();
      mocks.generate.mockResolvedValue({
        status,
        fileId: status === "generated" ? "F" : null,
        url: status === "generated" ? "U" : null,
        note: status === "failed" ? "failed" : null,
      });
      const response = await POST(
        new Request("http://localhost/api/root/contracts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ employee_id: "E1", payload }),
        }),
      );
      expect(response.status).toBe(201);
      expect(contractQuery.insert).toHaveBeenCalledWith({
        employee_id: "E1",
        payload,
        pdf_status: "skipped",
      });
      expect(contractQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ pdf_status: status }),
      );
    },
  );
  it("rejects missing company address before insert", async () => {
    const { contractQuery } = setup("");
    const response = await POST(
      new Request("http://localhost/api/root/contracts", {
        method: "POST",
        body: JSON.stringify({ employee_id: "E1", payload }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error:
        "会社マスタに住所が未登録です。Root＞会社 で住所を登録してください",
    });
    expect(contractQuery.insert).not.toHaveBeenCalled();
  });
});
