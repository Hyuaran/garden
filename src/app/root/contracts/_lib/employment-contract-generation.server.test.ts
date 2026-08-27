import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ render: vi.fn(), save: vi.fn() }));
vi.mock("./employment-contract-pdf.server", () => ({
  renderEmploymentContractPdf: mocks.render,
}));
vi.mock("@/app/system/mypage/_lib/todoke-drive.server", () => ({
  saveTodokePdf: mocks.save,
}));
import { generateEmploymentContractPdf } from "./employment-contract-generation.server";
const payload = {
  kind: "new" as const,
  contractStart: "2026-09-01",
  contractEnd: "2027-03-31",
  jobType: "sales" as const,
  jobTypeOther: "",
  hourlyWage: 1200,
  workLocation: "大阪市",
  concludedOn: "2026-08-28",
  employeeAddress: "",
};
const row = {
  id: "1",
  employee_id: "E1",
  payload,
  pdf_status: "skipped" as const,
  pdf_drive_file_id: null,
  pdf_drive_url: null,
  pdf_note: null,
  created_at: "2026-08-28T00:00:00Z",
};
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
    address: "〒530-0001 大阪市",
  },
};
describe("employment contract generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID = "root";
    mocks.render.mockResolvedValue(Buffer.from("pdf"));
    mocks.save.mockResolvedValue({
      status: "generated",
      fileId: "f",
      url: "u",
      note: null,
    });
  });
  it("inserts company and saves to the person folder", async () => {
    expect(await generateEmploymentContractPdf(row, employee)).toMatchObject({
      status: "generated",
    });
    expect(mocks.render).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "株式会社ヒュアラン",
        representative: "後道翔太",
        companyAddress: "〒530-0001 大阪市",
        employeeName: "社員A",
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      "0001",
      "社員A",
      "雇用契約書",
      expect.any(Date),
    );
  });
  it("skips without Drive env", async () => {
    delete process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID;
    expect(await generateEmploymentContractPdf(row, employee)).toMatchObject({
      status: "skipped",
    });
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("returns failed for generation errors", async () => {
    mocks.render.mockRejectedValue(new Error("render failed"));
    expect(await generateEmploymentContractPdf(row, employee)).toMatchObject({
      status: "failed",
      note: expect.stringContaining("render failed"),
    });
  });
});
