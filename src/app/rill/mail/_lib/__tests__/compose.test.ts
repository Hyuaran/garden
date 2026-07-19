import { afterEach, describe, expect, it, vi } from "vitest";
import { appendAttachments, attachmentUploadMethod, isValidEmailAddress, MAX_ATTACHMENT_BYTES, recipientSuggestions, removeAttachment, replyAllRecipients, scheduleDelayedSend, validateAttachmentSizes, validateComposeInput, type ComposeDraft } from "../compose";

const draft = { id: "d1", mode: "new", box: "me", to: ["a@example.com"], cc: [], subject: "Subject", bodyText: "Body", quote: "", fromLabel: "Me", ccVisible: false, attachments: [] } satisfies ComposeDraft;

describe("Rill Mail compose rules", () => {
  afterEach(() => vi.useRealTimers());

  it("validates single and multiple recipients and rejects invalid or empty input", () => {
    expect(isValidEmailAddress("a@example.com")).toBe(true);
    expect(() => validateComposeInput(draft)).not.toThrow();
    expect(() => validateComposeInput({ ...draft, to: ["a@example.com", "b@example.jp"] })).not.toThrow();
    expect(() => validateComposeInput({ ...draft, to: [] })).toThrow();
    expect(() => validateComposeInput({ ...draft, to: ["invalid"] })).toThrow();
  });

  it("requires a source message for reply, replyAll and forward", () => {
    for (const mode of ["reply", "replyAll", "forward"] as const) expect(() => validateComposeInput({ ...draft, mode, sourceMessageId: undefined })).toThrow("sourceMessageId");
    expect(() => validateComposeInput({ ...draft, mode: "reply", sourceMessageId: "m1" })).not.toThrow();
  });

  it("keeps Cc on reply-all while excluding self and To duplicates", () => {
    expect(replyAllRecipients({
      fromAddress: "sender@example.com",
      to: ["me@example.com", "to@example.com"],
      cc: ["cc@example.com", "ME@example.com", "to@example.com", "CC@example.com"],
    }, "me@example.com")).toEqual({
      to: ["sender@example.com", "to@example.com"],
      cc: ["cc@example.com"],
    });
  });

  it("deduplicates sender suggestions case-insensitively and matches prefixes", () => {
    expect(recipientSuggestions(["Alice@Example.com", "alice@example.com", "bob@example.com", "bad"], "ali")).toEqual(["Alice@Example.com"]);
  });

  it("accepts the 25MB attachment boundary and rejects per-file and total overflow", () => {
    expect(() => validateAttachmentSizes([], [{ size: MAX_ATTACHMENT_BYTES }])).not.toThrow();
    expect(() => validateAttachmentSizes([], [{ size: MAX_ATTACHMENT_BYTES + 1 }])).toThrow("1ファイル");
    expect(() => validateAttachmentSizes([{ size: MAX_ATTACHMENT_BYTES - 1 }], [{ size: 2 }])).toThrow("合計");
  });

  it("selects simple upload through 3MB and session upload above it", () => {
    expect(attachmentUploadMethod(3 * 1024 * 1024)).toBe("simple");
    expect(attachmentUploadMethod(3 * 1024 * 1024 + 1)).toBe("session");
  });

  it("adds and removes attachments without mutating the draft list", () => {
    const file = { name: "invoice.pdf", size: 12, type: "application/pdf" } as File;
    const added = appendAttachments([], [file], () => "a1");
    expect(added).toMatchObject([{ id: "a1", name: "invoice.pdf", size: 12 }]);
    expect(removeAttachment(added, "a1")).toEqual([]);
    expect(added).toHaveLength(1);
  });

  it("restores a scheduled draft when cancelled", () => {
    vi.useFakeTimers();
    const cancelled = vi.fn(); const send = vi.fn(async () => undefined);
    const job = scheduleDelayedSend(draft, send, { cancelled, succeeded: vi.fn(), failed: vi.fn() });
    expect(job.cancel()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(cancelled).toHaveBeenCalledWith(draft); expect(send).not.toHaveBeenCalled();
  });

  it("keeps attachment state while a delayed draft is cancelled", () => {
    vi.useFakeTimers();
    const withAttachment = { ...draft, attachments: [{ id: "a1", name: "invoice.pdf", size: 12, type: "application/pdf", file: {} as File }] };
    const cancelled = vi.fn();
    scheduleDelayedSend(withAttachment, async () => undefined, { cancelled, succeeded: vi.fn(), failed: vi.fn() }).cancel();
    expect(cancelled).toHaveBeenCalledWith(withAttachment);
  });

  it("fires after the delay and reports success or restores on failure", async () => {
    vi.useFakeTimers();
    const succeeded = vi.fn(); const failed = vi.fn();
    scheduleDelayedSend(draft, async () => undefined, { cancelled: vi.fn(), succeeded, failed });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(succeeded).toHaveBeenCalled();
    scheduleDelayedSend(draft, async () => { throw new Error("failed"); }, { cancelled: vi.fn(), succeeded, failed });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(failed).toHaveBeenCalledWith(draft);
  });
});
