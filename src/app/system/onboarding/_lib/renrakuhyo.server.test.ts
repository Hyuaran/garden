import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ readDetail: vi.fn(), buildExcel: vi.fn(), buildPdf: vi.fn(), saveFiles: vi.fn(), adminDownload: vi.fn() }));
vi.mock("./onboarding-admin.server", () => ({ readAdminOnboardingDetailForFuyou: mocks.readDetail }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ storage: { from: () => ({ download: mocks.adminDownload }) } }) }));
import { createAndSaveRenrakuhyo } from "./renrakuhyo.server";
import { emptyInput } from "./onboarding";
import { emptyAdminInput } from "./onboarding-admin";

function query(data: unknown, error: unknown = null) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
}

function context(company: unknown = { company_name: "株式会社Garden" }) {
  const companyQuery = query(company);
  return {
    supabase: { from: vi.fn(() => companyQuery) },
    managerEmployeeId: "EMP-MANAGER",
    companyQuery,
  };
}

describe("入社連絡表の生成保存", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.buildExcel.mockResolvedValue(Buffer.from("xlsx"));
    mocks.buildPdf.mockResolvedValue(Buffer.from("pdf"));
    mocks.adminDownload.mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
    mocks.saveFiles.mockResolvedValue({ xlsxFilename: "a.xlsx", pdfFilename: "a.pdf", folderLabel: "経理部 ／ 30_入社連絡票" });
  });

  it("管理者コンテキストの対象社員から会社と白紙2種を読み、Drive保存は差し替えられる", async () => {
    const values = { ...emptyInput(), name: "吉田 ひな", name_kana: "ヨシダ　ヒナ", my_number: "123456789012" };
    const admin = { ...emptyAdminInput(), health_insurance: "加入", pension_insurance: "加入", employment_insurance: "加入" };
    mocks.readDetail.mockResolvedValue({
      employee: { employee_id: "EMP-1", name: "吉田 ひな", hire_date: "2026-09-01", birthday: null, company_id: "COMP-1" },
      values,
      status: "submitted",
      submittedAt: null,
      admin,
      adminUpdatedAt: null,
    });
    const c = context();
    const result = await createAndSaveRenrakuhyo(c as never, "EMP-1", { buildExcel: mocks.buildExcel, buildPdf: mocks.buildPdf, saveFiles: mocks.saveFiles });

    expect(mocks.readDetail).toHaveBeenCalledWith(c, "EMP-1");
    expect(c.supabase.from).toHaveBeenCalledWith("root_companies");
    expect(c.companyQuery.select).toHaveBeenCalledWith("company_name");
    expect(c.companyQuery.eq).toHaveBeenCalledWith("company_id", "COMP-1");
    expect(mocks.adminDownload).toHaveBeenCalledWith("forms/tlcc-nyusha-renrakuhyo.xlsx");
    expect(mocks.adminDownload).toHaveBeenCalledWith("forms/tlcc-nyusha-renrakuhyo.pdf");
    expect(mocks.buildExcel.mock.calls[0][1]).toMatchObject({ mynumber: " マイナンバー※12桁：  1234-5678-9012" });
    expect(mocks.buildPdf.mock.calls[0][1]).toMatchObject({ company_name: "会社名        株式会社Garden" });
    expect(mocks.saveFiles).toHaveBeenCalledWith({
      xlsx: { filename: "01【提出用ヨシダヒナ】TLCC様入社連絡表.xlsx", content: Buffer.from("xlsx") },
      pdf: { filename: "01【提出用ヨシダヒナ】TLCC様入社連絡表.pdf", content: Buffer.from("pdf") },
    });
    expect(result.folderLabel).toBe("経理部 ／ 30_入社連絡票");
  });

  it("責任者コンテキストで読めない社員や法人ではファイル保存しない", async () => {
    mocks.readDetail.mockResolvedValue(null);
    await expect(createAndSaveRenrakuhyo(context() as never, "EMP-404", { buildExcel: mocks.buildExcel, buildPdf: mocks.buildPdf, saveFiles: mocks.saveFiles })).rejects.toMatchObject({ status: 404 });
    expect(mocks.saveFiles).not.toHaveBeenCalled();

    mocks.readDetail.mockResolvedValue({
      employee: { employee_id: "EMP-1", name: "吉田", hire_date: null, birthday: null, company_id: null },
      values: emptyInput(),
      status: "submitted",
      submittedAt: null,
      admin: emptyAdminInput(),
      adminUpdatedAt: null,
    });
    await expect(createAndSaveRenrakuhyo(context() as never, "EMP-1", { buildExcel: mocks.buildExcel, buildPdf: mocks.buildPdf, saveFiles: mocks.saveFiles })).rejects.toMatchObject({ status: 409 });
    expect(mocks.saveFiles).not.toHaveBeenCalled();
  });
});
