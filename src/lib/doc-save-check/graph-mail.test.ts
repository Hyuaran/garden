import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMailboxMessages, fetchMessageAttachments, fetchMessageAttachmentContent, graphFetch } from "../mail-payment-check/graph-mail";
describe("Graph の共通読み取り", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("添付は全ページの通常fileAttachmentだけ", async () => {
    const file = { "@odata.type": "#microsoft.graph.fileAttachment", name: "契約書.pdf", id: "a", size: 1024, contentType: "application/pdf" };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ value: [file, { ...file, isInline: true }, { "@odata.type": "#microsoft.graph.itemAttachment" }], "@odata.nextLink": "https://graph.microsoft.com/page2" }))
      .mockResolvedValueOnce(Response.json({ value: [file] }));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchMessageAttachments("box", "message", "token")).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("$select")).toBe("id,name,contentType,size,isInline");
  });
  it("宛先と添付フラグ・箱ごとのIDを保持し、同じメールをまとめる", async () => {
    for (const key of ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET"]) vi.stubEnv(key, "test");
    const message = { id: "id1", internetMessageId: "same", from: { emailAddress: { address: "from@example.jp" } }, toRecipients: [{ emailAddress: { address: "to@example.jp" } }], hasAttachments: true };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "token" }))
      .mockResolvedValueOnce(Response.json({ value: [message] })).mockResolvedValueOnce(Response.json({ value: [{ ...message, id: "id2" }] }));
    vi.stubGlobal("fetch", fetch);
    const result = await fetchMailboxMessages("2026-10-01T00:00:00Z", ["a", "b"], true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ toRecipients: ["to@example.jp"], hasAttachments: true, messageIdsByMailbox: { a: "id1", b: "id2" } });
    expect(new URL(fetch.mock.calls[1][0]).pathname).toBe("/v1.0/users/a/messages");
  });
  it("429と通信切れを再試行、恒久エラーは再試行しない", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValueOnce(Error("network")).mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "1" } })).mockResolvedValueOnce(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    const result = graphFetch("https://test.invalid");
    await vi.runAllTimersAsync();
    expect((await result).status).toBe(403); expect(fetch).toHaveBeenCalledTimes(3);
  });
});

it("候補の本文を取得し、中身の欠落とHTTPエラーを検出する", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ contentBytes: "eA==" }))
    .mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(new Response("", { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  try {
    expect(await fetchMessageAttachmentContent("box", "m/1", "a/1", "token")).toBe("eA==");
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe("/v1.0/users/box/messages/m%2F1/attachments/a%2F1");
    await expect(fetchMessageAttachmentContent("box", "m", "a", "token")).rejects.toThrow();
    await expect(fetchMessageAttachmentContent("box", "m", "a", "token")).rejects.toThrow("403");
  } finally { vi.unstubAllGlobals(); }
});
