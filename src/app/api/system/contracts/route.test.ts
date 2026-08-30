import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  existing: null as Record<string, unknown> | null,
  generate: vi.fn(), save: vi.fn(), saveOriginal: vi.fn(), insert: vi.fn(),
  update: vi.fn(), metadata: vi.fn(), download: vi.fn(), breadcrumbs: vi.fn(),
}));
const issuer = { company_id: "COMP-001", company_name: "株式会社ヒュアラン", representative: "代表者", address: "大阪府" };
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: vi.fn(async () => ({ userId: "U1" })) }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => table === "root_companies" ? {
      select: () => ({ eq: () => ({ order: async () => ({ data: [issuer] }) }) }),
    } : {
      select: () => ({ eq: (field: string) => ({ maybeSingle: async () => ({ data: field === "drive_file_id" ? mocks.existing : mocks.row, error: null }) }) }),
      insert: (values: Record<string, unknown>) => {
        mocks.insert(values);
        return { select: () => ({ single: async () => ({ data: { id: "NEW", ...values }, error: null }) }) };
      },
      update: (values: unknown) => { mocks.update(values); return { eq: async () => ({ error: null }) }; },
    },
  }),
}));
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({
  findOrCreateSubfolder: vi.fn(), listDriveFolderEntries: vi.fn(),
  getDriveFileMetadata: (...args: unknown[]) => mocks.metadata(...args),
  downloadFile: (...args: unknown[]) => mocks.download(...args),
}));
vi.mock("@/app/system/contracts/_lib/contract-drive.server", () => ({
  getContractDriveBreadcrumbs: (...args: unknown[]) => mocks.breadcrumbs(...args),
  saveOriginalContract: (...args: unknown[]) => mocks.saveOriginal(...args),
  savePartnerTemplate: (...args: unknown[]) => mocks.save(...args),
}));
vi.mock("@/app/system/contracts/_lib/contract-template.server", () => ({ generatePartnerTemplate: (...args: unknown[]) => mocks.generate(...args) }));
import { POST } from "./route";

function templateRequest() {
  const form = new FormData();
  form.set("action", "template"); form.set("id", "C1"); form.set("issuerId", "COMP-001"); form.set("product", "商材A");
  return { formData: async () => form } as Request;
}

function registrationRequest(action: "register" | "register-drive", driveFileId = "DRIVE-ORIGINAL") {
  const form = new FormData();
  form.set("action", action); form.set("counterparty", "上位店"); form.set("companyId", "COMP-001");
  form.set("contractType", "業務委託契約書"); form.set("concludedOn", "2026-08-30"); form.set("note", "確認済み");
  form.set("extractedText", JSON.stringify(["page one", "page two"]));
  if (action === "register-drive") form.set("driveFileId", driveFileId);
  else form.set("file", new File(["%PDF"], "新規契約.pdf", { type: "application/pdf" }));
  return { formData: async () => form } as Request;
}

describe("contract registration API", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.row = null; mocks.existing = null;
    mocks.metadata.mockResolvedValue({ id: "DRIVE-ORIGINAL", name: "既存契約.pdf", mimeType: "application/pdf", parents: ["PARTNER-FOLDER"], webViewLink: "https://drive.example/original" });
    mocks.breadcrumbs.mockResolvedValue([{ id: null, name: "契約書" }, { id: "TOP", name: "01_契約書　上位店" }, { id: "PARTNER-FOLDER", name: "上位店_HYR" }]);
    mocks.download.mockResolvedValue(Buffer.from("%PDF"));
    mocks.saveOriginal.mockResolvedValue({ status: "generated", fileId: "DRIVE-UPLOADED", url: "https://drive.example/uploaded", folderName: "上位店_HYR" });
    process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID = "ROOT";
  });

  it("uses the existing Drive file ID without saving another original", async () => {
    const response = await POST(registrationRequest("register-drive"));
    expect(response.status).toBe(201); expect(mocks.saveOriginal).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ drive_file_id: "DRIVE-ORIGINAL", drive_url: "https://drive.example/original", drive_folder_name: "上位店_HYR" }));
  });

  it("keeps upload registration saving the original to Drive", async () => {
    const response = await POST(registrationRequest("register"));
    expect(response.status).toBe(201); expect(mocks.saveOriginal).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ drive_file_id: "DRIVE-UPLOADED" }));
  });

  it("rejects a second registration on the server with a user-facing message", async () => {
    const first = await POST(registrationRequest("register-drive"));
    mocks.existing = { id: "NEW" };
    const second = await POST(registrationRequest("register-drive"));
    const body = await second.json();
    expect(first.status).toBe(201); expect(second.status).toBe(409); expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(body.error).toBe("この契約書はすでに登録されています。");
    expect(body.error).not.toMatch(/drive|file|id|database|duplicate|constraint|DB/i);
  });

  it("returns the selected Drive PDF for browser-side extraction", async () => {
    const form = new FormData(); form.set("action", "read-drive-file"); form.set("driveFileId", "DRIVE-ORIGINAL");
    const response = await POST({ formData: async () => form } as Request);
    expect(response.status).toBe(200); expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(mocks.download).toHaveBeenCalledWith("DRIVE-ORIGINAL");
  });
});

describe("contract template API extracted text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.row = { id: "C1", counterparty: "上位店", contract_type: "契約書", extracted_text: JSON.stringify(["page one", "page two"]) };
    mocks.generate.mockResolvedValue({ pdf: Buffer.from("pdf"), docx: Buffer.from("docx") });
    mocks.save.mockResolvedValue({ status: "generated", pdf: { fileId: "P", url: "PU" }, docx: { fileId: "D", url: "DU" } });
  });
  it("builds a template from the text saved at registration", async () => {
    const response = await POST(templateRequest());
    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(["page one", "page two"], expect.objectContaining({ title: "契約書" }));
  });
  it("guides the user to re-register an old row without extracted text", async () => {
    mocks.row = { id: "C1", counterparty: "上位店", contract_type: "契約書", extracted_text: null };
    const response = await POST(templateRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("元の契約書を読み取れていないため、ひな形を作成できません。登録し直してください。");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
