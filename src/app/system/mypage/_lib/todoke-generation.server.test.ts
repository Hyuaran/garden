import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  render: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
vi.mock("./todoke-pdf.server", () => ({
  renderEmergencyContactPdf: mocks.render,
}));
vi.mock("./todoke-drive.server", () => ({ saveTodokePdf: mocks.save }));
import { generateEmergencyContactPdf } from "./todoke-generation.server";
import type { SubmissionRow } from "./submission-types";
const row = {
  id: "1",
  employee_id: "E1",
  submission_type: "emergency_contact",
  payload: {
    kind: "change",
    selfAddress: "東京都",
    selfPhone: "090",
    ecName: "家族",
    ecRelationship: "母",
    ecAddress: "同上",
    ecPhone: "080",
  },
  status: "received",
  proposed_one_way: null,
  kintone_status: "not_applicable",
  kintone_note: null,
  created_at: "2026-08-27T00:00:00Z",
} as SubmissionRow;
describe("todoke generation", () => {
  beforeEach(() => {
    process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID = "root";
    mocks.render.mockResolvedValue(Buffer.from("pdf"));
    mocks.save.mockResolvedValue({
      status: "generated",
      fileId: "file",
      url: "https://drive/file",
      note: null,
    });
    mocks.admin.mockReset();
    mocks.render.mockClear();
    mocks.save.mockClear();
  });
  it.each([
    ["COMP-001", "株式会社ヒュアラン", "後道翔太"],
    ["COMP-002", "株式会社ガーデン", "代表者B"],
    ["COMP-003", "株式会社ブルーム", "代表者C"],
  ])(
    "inserts the company for %s",
    async (companyId, companyName, representative) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({
            data: {
              company_name: companyName,
              representative,
              address: "住所",
            },
            error: null,
          }),
      };
      mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
      expect(
        await generateEmergencyContactPdf(row, {
          name: "社員A",
          employee_number: "0008",
          company_id: companyId,
        }),
      ).toMatchObject({ status: "generated", url: "https://drive/file" });
      expect(mocks.render).toHaveBeenLastCalledWith(
        expect.objectContaining({
          companyName,
          representative,
          employeeName: "社員A",
          kind: "change",
        }),
      );
      expect(mocks.save).toHaveBeenLastCalledWith(
        expect.any(Buffer),
        "0008",
        "社員A",
        expect.any(Date),
      );
    },
  );
  it("skips before rendering when the root folder is unset", async () => {
    delete process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID;
    expect(
      await generateEmergencyContactPdf(row, {
        name: "社員A",
        employee_number: "0008",
        company_id: "COMP-001",
      }),
    ).toMatchObject({ status: "skipped" });
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("records generation failures", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error("Drive stopped")),
    };
    mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
    expect(
      await generateEmergencyContactPdf(row, {
        name: "社員A",
        employee_number: "0008",
        company_id: "COMP-001",
      }),
    ).toMatchObject({
      status: "failed",
      note: expect.stringContaining("Drive stopped"),
    });
  });
});
