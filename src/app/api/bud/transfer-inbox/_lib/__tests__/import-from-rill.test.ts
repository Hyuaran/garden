import { describe, expect, it } from "vitest";
import { buildRillTransferInboxRow, rillTransferDriveFileId, rillTransferStoragePath, type RillTransferInboxSource } from "../import-from-rill";

const source: RillTransferInboxSource = {
  intakeId: "123e4567-e89b-12d3-a456-426614174000",
  fileName: "請求書 7月.pdf",
  mimeType: "application/pdf",
  importedAt: "2026-07-19T01:02:03Z",
  messageId: "message-1",
  attachmentId: "attachment-2",
  fromName: "取引先",
  fromAddress: "vendor@example.com",
  subject: "7月分請求書",
  storagePath: "seikyu/2026/07/intake.pdf",
};

describe("Bud transfer inbox import from Rill", () => {
  it("uses the Garden intake ID as a stable duplicate key", () => {
    expect(rillTransferDriveFileId(source.intakeId)).toBe(`rill:${source.intakeId}`);
    expect(rillTransferDriveFileId(source.intakeId)).toBe(rillTransferDriveFileId(source.intakeId));
  });

  it("builds an ASCII target path in the existing Bud bucket", () => {
    expect(rillTransferStoragePath(source.intakeId, source.fileName)).toBe(`transfer-inbox/rill/${source.intakeId}/____7_.pdf`);
  });

  it("builds a pending Rill row with mail metadata", () => {
    expect(buildRillTransferInboxRow(source, "target.pdf", "https://storage/target.pdf")).toEqual({
      drive_file_id: `rill:${source.intakeId}`,
      file_name: source.fileName,
      mime_type: "application/pdf",
      storage_path: "target.pdf",
      public_url: "https://storage/target.pdf",
      imported_at: source.importedAt,
      status: "pending",
      source: "rill",
      mail_meta: {
        message_id: source.messageId,
        attachment_id: source.attachmentId,
        from: "取引先 <vendor@example.com>",
        subject: source.subject,
        received_at: source.importedAt,
        garden_intake_id: source.intakeId,
      },
    });
  });
});
