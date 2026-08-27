import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  employee: vi.fn(),
  admin: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireEmployee: mocks.employee,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
vi.mock("@/app/system/mypage/_lib/todoke-generation.server", () => ({
  generateEmergencyContactPdf: mocks.generate,
}));
import { POST } from "./route";

const payload = {
  kind: "new",
  selfAddress: "東京都",
  selfPhone: "090",
  ecName: "家族",
  ecRelationship: "母",
  ecAddress: "同上",
  ecPhone: "080",
};
describe("mypage submission PDF flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.employee.mockResolvedValue({
      employee_id: "E1",
      employee_number: "0008",
      name: "社員A",
      company_id: "COMP-001",
    });
    mocks.generate.mockResolvedValue({
      status: "generated",
      fileId: "file-1",
      url: "https://drive/file-1",
      note: null,
    });
  });
  it("accepts the submission and stores generated Drive metadata", async () => {
    const inserted = {
      id: "sub-1",
      employee_id: "E1",
      submission_type: "emergency_contact",
      payload,
      status: "received",
      created_at: "2026-08-27T00:00:00Z",
    };
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    };
    mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
    const response = await POST(
      new Request("http://localhost/api/system/mypage/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "emergency_contact", payload }),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sub-1" }),
      { name: "社員A", employee_number: "0008", company_id: "COMP-001" },
      new Date("2026-08-27T00:00:00Z"),
    );
    expect(query.update).toHaveBeenCalledWith({
      pdf_status: "generated",
      pdf_drive_file_id: "file-1",
      pdf_drive_url: "https://drive/file-1",
      pdf_note: null,
    });
    expect(updateEq).toHaveBeenCalledWith("id", "sub-1");
  });
  it("rejects an emergency contact without an address", async () => {
    const response = await POST(
      new Request("http://localhost/api/system/mypage/submissions", {
        method: "POST",
        body: JSON.stringify({
          type: "emergency_contact",
          payload: { ...payload, ecAddress: "" },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
