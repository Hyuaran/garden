import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  folder: vi.fn(),
  exists: vi.fn(),
  metadata: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({
  findOrCreateSubfolder: mocks.folder,
  folderHasFile: mocks.exists,
  getDriveFolderMetadata: mocks.metadata,
  uploadToFolder: mocks.upload,
}));
import {
  getContractDriveBreadcrumbs,
  saveOriginalContract,
  savePartnerTemplate,
} from "./contract-drive.server";
describe("contract Drive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID = "root";
    mocks.folder.mockResolvedValueOnce("top").mockResolvedValueOnce("leaf");
    mocks.exists.mockResolvedValue(false);
    mocks.upload.mockResolvedValue({ id: "F", webViewLink: "U" });
  });
  it("creates the original hierarchy", async () => {
    expect(
      await saveOriginalContract(
        Buffer.from("pdf"),
        "契約.pdf",
        "A社",
        "COMP-001",
      ),
    ).toMatchObject({ status: "generated", folderName: "A社_HR" });
    expect(mocks.folder).toHaveBeenNthCalledWith(
      1,
      "root",
      "01_契約書　上位店",
    );
    expect(mocks.folder).toHaveBeenNthCalledWith(2, "top", "A社_HR");
    expect(mocks.upload).toHaveBeenCalledWith(
      "leaf",
      "契約.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
  });
  it("creates template product hierarchy", async () => {
    mocks.folder.mockReset().mockResolvedValueOnce("top").mockResolvedValueOnce("product").mockResolvedValueOnce("leaf");
    await savePartnerTemplate(
      { pdf: Buffer.from("pdf"), docx: Buffer.from("docx") },
      { pdf: "ひな形.pdf", docx: "ひな形.docx" },
      "関電ガス",
      "A社",
    );
    expect(mocks.folder).toHaveBeenNthCalledWith(
      1,
      "root",
      "05_パートナー配布用ひな形",
    );
    expect(mocks.folder).toHaveBeenNthCalledWith(2, "top", "関電ガス");
    expect(mocks.folder).toHaveBeenNthCalledWith(3, "product", "A社");
    expect(mocks.upload).toHaveBeenCalledWith("leaf", "ひな形.pdf", expect.any(Buffer), "application/pdf");
    expect(mocks.upload).toHaveBeenCalledWith("leaf", "ひな形.docx", expect.any(Buffer), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });
  it("skips without env", async () => {
    delete process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID;
    expect(
      await saveOriginalContract(Buffer.from("pdf"), "契約.pdf", "A社", "ALL"),
    ).toMatchObject({ status: "skipped", folderName: "A社_ALL" });
    expect(mocks.folder).not.toHaveBeenCalled();
  });
  it("restores breadcrumbs from Drive parent metadata", async () => {
    mocks.metadata.mockImplementation(async (id: string) => ({
      id,
      name: id === "ash" ? "ASH株式会社_ART" : "01_契約書　上位店",
      mimeType: "application/vnd.google-apps.folder",
      parents: [id === "ash" ? "top" : "root"],
    }));
    await expect(getContractDriveBreadcrumbs("ash", "root")).resolves.toEqual([
      { id: null, name: "契約書" },
      { id: "top", name: "01_契約書　上位店" },
      { id: "ash", name: "ASH株式会社_ART" },
    ]);
  });
});
