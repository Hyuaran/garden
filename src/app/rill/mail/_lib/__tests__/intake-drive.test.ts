import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bestEffortIntakeDriveMirror,
  intakeDriveFileName,
  intakeDriveFolderPath,
  type IntakeDriveClient,
  type IntakeDriveMirrorInput,
} from "../intake-drive";

const input: IntakeDriveMirrorInput = {
  kind: "請求",
  receivedAt: "2026-07-17T23:50:00Z",
  fromName: "e/Fax\n東京",
  fromAddress: "fax@example.com",
  subject: "274217からのeFax:メッセージです/確認してください",
  originalFileName: "scan.PDF",
  attachmentIndex: 2,
  bytes: Buffer.from("pdf"),
  mimeType: "application/pdf",
};

afterEach(() => vi.restoreAllMocks());

describe("Rill Mail intake Drive mirror", () => {
  it("maps each intake kind and UTC month to the Drive folder path", () => {
    expect(intakeDriveFolderPath("請求", input.receivedAt)).toEqual({ root: "Garden_取込トレイ", kind: "請求", month: "2026-07" });
    expect(intakeDriveFolderPath("入金", input.receivedAt).kind).toBe("入金");
    expect(intakeDriveFolderPath("条件", input.receivedAt).kind).toBe("条件");
    expect(intakeDriveFolderPath("周知", input.receivedAt).kind).toBe("周知");
    expect(() => intakeDriveFolderPath("その他" as "請求", input.receivedAt)).toThrow("Invalid intake kind");
    expect(() => intakeDriveFolderPath("請求", "not-a-date")).toThrow("Invalid intake received date");
  });

  it("builds a sanitized business filename with attachment suffix", () => {
    expect(intakeDriveFileName(input)).toBe("20260717_eFax東京_274217からのeFaxメッセージで_2.pdf");
    expect(intakeDriveFileName({ ...input, fromName: "", fromAddress: "sender@example.com", subject: "\n/:*?\"<>|" })).toBe("20260717_sender_無題_2.pdf");
  });

  it("keeps intake successful when the mocked Drive client fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client: IntakeDriveClient = {
      findOrCreateAppFolder: vi.fn().mockRejectedValue(new Error("Drive unavailable")),
      findOrCreateSubfolder: vi.fn(),
      uploadToFolder: vi.fn(),
    };
    await expect(bestEffortIntakeDriveMirror(input, client)).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith("Rill Mail intake Drive mirror failed", "Drive unavailable");
  });

  it("creates the folder chain and returns the uploaded file ID", async () => {
    const client: IntakeDriveClient = {
      findOrCreateAppFolder: vi.fn().mockResolvedValue("root"),
      findOrCreateSubfolder: vi.fn().mockResolvedValueOnce("kind").mockResolvedValueOnce("month"),
      uploadToFolder: vi.fn().mockResolvedValue({ id: "drive-file", webViewLink: null }),
    };
    await expect(bestEffortIntakeDriveMirror(input, client)).resolves.toBe("drive-file");
    expect(client.findOrCreateSubfolder).toHaveBeenNthCalledWith(1, "root", "請求");
    expect(client.findOrCreateSubfolder).toHaveBeenNthCalledWith(2, "kind", "2026-07");
    expect(client.uploadToFolder).toHaveBeenCalledWith("month", expect.stringContaining("_2.pdf"), input.bytes, input.mimeType);
  });
});
