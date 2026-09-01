import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ readDetail: vi.fn(), buildPdf: vi.fn(), savePdf: vi.fn(), adminDownload: vi.fn() }));
vi.mock("./onboarding-admin.server", () => ({ readAdminOnboardingDetailForFuyou: mocks.readDetail }));
// 用紙は管理者側の接続で読むため、そちらを差し替える。
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ storage: { from: () => ({ download: mocks.adminDownload }) } }) }));
import { createAndSaveFuyouPdf } from "./onboarding-fuyou.server";
import { emptyInput } from "./onboarding";

function query(data: unknown, error: unknown = null) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
}

function context(company: unknown = { company_name: "株式会社Garden", corporate_number: "1234567890123", address: "大阪市中央区" }) {
  const companyQuery = query(company);
  const storageDownload = vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
  return {
    supabase: {
      from: vi.fn(() => companyQuery),
      storage: { from: vi.fn(() => ({ download: storageDownload })) },
    },
    managerEmployeeId: "EMP-MANAGER",
    companyQuery,
    storageDownload,
  };
}

describe("扶養控除申告書の生成保存", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.buildPdf.mockResolvedValue(Buffer.from("pdf"));
    mocks.adminDownload.mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
    mocks.savePdf.mockResolvedValue({ filename: "saved.pdf", folderLabel: "経理部 ／ 12_扶養控除申告書", fileId: "FILE", url: null });
  });

  it("管理者コンテキストの対象社員から会社と白紙PDFを読み、Drive保存は差し替えられる", async () => {
    const values = { ...emptyInput(), name: "上田 基人", my_number: "123456789012" };
    mocks.readDetail.mockResolvedValue({
      employee: { employee_id: "EMP-1", name: "上田 基人", hire_date: null, birthday: null, company_id: "COMP-1" },
      values,
      status: "submitted",
      submittedAt: null,
      admin: {},
      adminUpdatedAt: null,
    });
    const c = context();
    const result = await createAndSaveFuyouPdf(c as never, "EMP-1", { buildPdf: mocks.buildPdf, savePdf: mocks.savePdf });

    expect(mocks.readDetail).toHaveBeenCalledWith(c, "EMP-1");
    expect(c.supabase.from).toHaveBeenCalledWith("root_companies");
    expect(c.companyQuery.select).toHaveBeenCalledWith("company_name,corporate_number,address");
    expect(c.companyQuery.eq).toHaveBeenCalledWith("company_id", "COMP-1");
    expect(mocks.adminDownload).toHaveBeenCalledWith("forms/reiwa8-fuyou.pdf");
    expect(c.storageDownload).not.toHaveBeenCalled();
    expect(mocks.buildPdf).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), {
      company: { company_name: "株式会社Garden", corporate_number: "1234567890123", address: "大阪市中央区" },
      values,
    });
    expect(mocks.savePdf).toHaveBeenCalledWith("【扶養控除申告書】上田基人_令和8年分_給与所得者の扶養控除等(異動)申告書.pdf", Buffer.from("pdf"));
    expect(result.filename).toBe("saved.pdf");
  });

  it("所属法人が無い場合はPDFもDrive保存も行わない", async () => {
    mocks.readDetail.mockResolvedValue({
      employee: { employee_id: "EMP-1", name: "上田", hire_date: null, birthday: null, company_id: null },
      values: emptyInput(),
      status: "submitted",
      submittedAt: null,
      admin: {},
      adminUpdatedAt: null,
    });
    await expect(createAndSaveFuyouPdf(context() as never, "EMP-1", { buildPdf: mocks.buildPdf, savePdf: mocks.savePdf })).rejects.toMatchObject({ status: 409 });
    expect(mocks.buildPdf).not.toHaveBeenCalled();
    expect(mocks.savePdf).not.toHaveBeenCalled();
  });
});
