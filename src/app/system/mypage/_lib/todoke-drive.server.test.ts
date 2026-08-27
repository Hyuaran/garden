import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  folder: vi.fn(),
  exists: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({
  findOrCreateSubfolder: mocks.folder,
  folderHasFile: mocks.exists,
  uploadToFolder: mocks.upload,
}));
import { employeeTodokeFolderName, saveTodokePdf } from "./todoke-drive.server";
describe("todoke Drive save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID = "root";
    mocks.folder.mockResolvedValue("folder");
    mocks.exists.mockResolvedValue(false);
    mocks.upload.mockResolvedValue({
      id: "file",
      webViewLink: "https://drive/file",
    });
  });
  it("creates the type folder and uploads the PDF", async () => {
    expect(
      await saveTodokePdf(
        Buffer.from("pdf"),
        "0008",
        "東海林 美琴",
        new Date("2026-08-26T15:01:02Z"),
      ),
    ).toMatchObject({ status: "generated", fileId: "file" });
    expect(mocks.folder).toHaveBeenCalledWith("root", "0008_東海林美琴");
    expect(mocks.upload).toHaveBeenCalledWith(
      "folder",
      "緊急連絡先届_20260827.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
  });
  it("adds seconds when the daily filename already exists", async () => {
    mocks.exists.mockResolvedValue(true);
    await saveTodokePdf(
      Buffer.from("pdf"),
      "0008",
      "東海林　美琴",
      new Date("2026-08-26T15:01:02Z"),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      "folder",
      "緊急連絡先届_20260827_000102.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
  });
  it("skips without the root folder", async () => {
    delete process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID;
    expect(await saveTodokePdf(Buffer.from("pdf"), "0008", "社員A")).toMatchObject({
      status: "skipped",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("removes half-width and full-width spaces from the employee folder", () => {
    expect(employeeTodokeFolderName("0008", "東海林 　美琴")).toBe("0008_東海林美琴");
  });
});
