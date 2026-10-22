import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/mail-payment-check/graph-mail", () => ({ getGraphToken: vi.fn(async () => "mock-token"), graphFetch: vi.fn() }));
import { graphFetch } from "@/lib/mail-payment-check/graph-mail";
import { collect, mailboxes } from "./graph";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Graph NDR reader", () => {
  it("uses default boxes and permits additional boxes", () => {
    expect(mailboxes()).toHaveLength(3);
    vi.stubEnv("MAIL_NDR_WATCH_MAILBOXES", "shoji@example.com, a-kin@hyuaran.com,shoji@example.com");
    expect(mailboxes()).toEqual(["shoji@example.com", "a-kin@hyuaran.com"]);
  });
  it("paginates messages and attachments and excludes old NDRs", async () => {
    vi.stubEnv("MAIL_NDR_WATCH_MAILBOXES", "box@example.com");
    const ndr = { id: "ndr", subject: "Undeliverable: fallback", receivedDateTime: "2026-10-22T10:00:00Z", body: { content: "Diagnostic information 550 5.1.1" } };
    const next = "https://graph.microsoft.com/v1.0/next";
    vi.mocked(graphFetch)
      .mockResolvedValueOnce(Response.json({ value: [{ ...ndr, id: "old", receivedDateTime: "2026-10-20T00:00:00Z" }], "@odata.nextLink": next }))
      .mockResolvedValueOnce(Response.json({ value: [ndr] }))
      .mockResolvedValueOnce(Response.json({ value: [], "@odata.nextLink": next + "-attachment" }))
      .mockResolvedValueOnce(Response.json({ value: [{ "@odata.type": "#microsoft.graph.itemAttachment", item: { subject: "original", toRecipients: [{ emailAddress: { address: "to@example.com" } }] } }] }));
    const found = await collect("2026-10-22T09:00:00Z", "2026-10-22T09:00:00Z");
    expect(found).toHaveLength(1); expect(found[0]).toMatchObject({ original_subject: "original", recipients: "to@example.com", kind: "宛先不明" });
    const calls = vi.mocked(graphFetch).mock.calls;
    const url = new URL(calls[0][0]);
    expect(url.pathname).toBe("/v1.0/users/box%40example.com/messages");
    expect(url.searchParams.get("$filter")).toBe("receivedDateTime ge 2026-10-22T09:00:00Z");
    expect(url.searchParams.get("$orderby")).toBe("receivedDateTime desc");
    expect(calls[2][0]).toContain("$expand=microsoft.graph.itemAttachment/item");
    expect(calls).toHaveLength(4);
  });
  it("propagates Graph errors for outage handling", async () => {
    vi.stubEnv("MAIL_NDR_WATCH_MAILBOXES", "box@example.com");
    vi.mocked(graphFetch).mockResolvedValue(Response.json({}, { status: 503 }));
    await expect(collect("2026-10-22T09:00:00Z", "2026-10-22T09:00:00Z")).rejects.toThrow("Graph read failed (503)");
  });
});
