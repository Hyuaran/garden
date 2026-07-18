import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidEmailAddress, recipientSuggestions, scheduleDelayedSend, validateComposeInput, type ComposeDraft } from "../compose";

const draft = { id: "d1", mode: "new", box: "me", to: ["a@example.com"], cc: [], subject: "Subject", bodyText: "Body", quote: "", fromLabel: "Me", ccVisible: false } satisfies ComposeDraft;

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

  it("deduplicates sender suggestions case-insensitively and matches prefixes", () => {
    expect(recipientSuggestions(["Alice@Example.com", "alice@example.com", "bob@example.com", "bad"], "ali")).toEqual(["Alice@Example.com"]);
  });

  it("restores a scheduled draft when cancelled", () => {
    vi.useFakeTimers();
    const cancelled = vi.fn(); const send = vi.fn(async () => undefined);
    const job = scheduleDelayedSend(draft, send, { cancelled, succeeded: vi.fn(), failed: vi.fn() });
    expect(job.cancel()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(cancelled).toHaveBeenCalledWith(draft); expect(send).not.toHaveBeenCalled();
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
