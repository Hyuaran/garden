import { describe, expect, it } from "vitest";

import { buildMailInboxDriveFileId, isSupportedMailAttachment } from "../import-from-mail";

describe("isSupportedMailAttachment", () => {
  it("accepts PDF file attachments", () => {
    expect(
      isSupportedMailAttachment({
        "@odata.type": "#microsoft.graph.fileAttachment",
        contentType: "application/pdf",
        contentBytes: "Zm9v",
      }),
    ).toBe(true);
  });

  it("accepts JPEG and PNG file attachments", () => {
    expect(
      isSupportedMailAttachment({
        "@odata.type": "#microsoft.graph.fileAttachment",
        contentType: "image/jpeg",
        contentBytes: "Zm9v",
      }),
    ).toBe(true);
    expect(
      isSupportedMailAttachment({
        "@odata.type": "#microsoft.graph.fileAttachment",
        contentType: "image/png",
        contentBytes: "Zm9v",
      }),
    ).toBe(true);
  });

  it("rejects non-file attachments", () => {
    expect(
      isSupportedMailAttachment({
        "@odata.type": "#microsoft.graph.itemAttachment",
        contentType: "application/pdf",
        contentBytes: "Zm9v",
      }),
    ).toBe(false);
  });

  it("rejects unsupported content types", () => {
    expect(
      isSupportedMailAttachment({
        "@odata.type": "#microsoft.graph.fileAttachment",
        contentType: "text/plain",
        contentBytes: "Zm9v",
      }),
    ).toBe(false);
  });

  it("rejects attachments without content bytes", () => {
    expect(
      isSupportedMailAttachment({
        "@odata.type": "#microsoft.graph.fileAttachment",
        contentType: "application/pdf",
        contentBytes: null,
      }),
    ).toBe(false);
  });
});

describe("buildMailInboxDriveFileId", () => {
  it("builds the unique inbox key", () => {
    expect(buildMailInboxDriveFileId("message-1", "attachment-2")).toBe("mail:message-1:attachment-2");
  });
});
