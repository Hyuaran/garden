import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  generate: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
}));
const issuer = { company_id: "COMP-001", company_name: "株式会社ヒュアラン", representative: "代表者", address: "大阪府" };
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: vi.fn(async () => ({ userId: "U1" })) }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => table === "root_companies" ? {
      select: () => ({ eq: () => ({ order: async () => ({ data: [issuer] }) }) }),
    } : {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.row }) }) }),
      update: (values: unknown) => { mocks.update(values); return { eq: async () => ({ error: null }) }; },
    },
  }),
}));
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({ findOrCreateSubfolder: vi.fn(), listDriveFolderEntries: vi.fn() }));
vi.mock("@/app/system/contracts/_lib/contract-drive.server", () => ({
  saveOriginalContract: vi.fn(),
  savePartnerTemplate: (...args: unknown[]) => mocks.save(...args),
}));
vi.mock("@/app/system/contracts/_lib/contract-template.server", () => ({
  generatePartnerTemplate: (...args: unknown[]) => mocks.generate(...args),
}));
import { POST } from "./route";

function templateRequest() {
  const form = new FormData();
  form.set("action", "template"); form.set("id", "C1"); form.set("issuerId", "COMP-001"); form.set("product", "商材A");
  return new Request("http://localhost/api/system/contracts", { method: "POST", body: form });
}

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
