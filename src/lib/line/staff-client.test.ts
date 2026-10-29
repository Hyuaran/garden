import { describe, expect, it, vi } from "vitest";
import { getLineStaffProfile, getLineStaffQuota, pushLineStaff, replyLineStaff } from "./staff-client";

describe("line staff client", () => {
  it('同じ返信に最大5つの吹き出しをまとめる', async () => {
    const fetchImpl=vi.fn(async(_url: RequestInfo | URL, _init?: RequestInit)=>new Response('{}'));
    await replyLineStaff('same-token',['成功','あいさつ','3','4','5','6'],{fetchImpl,token:'test'});
    const body=JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.replyToken).toBe('same-token');expect(body.messages).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("sends reply and multicast with the staff token", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await replyLineStaff("reply-token", "本文", { fetchImpl, token: "staff-token" });
    await pushLineStaff(["U1", "U2"], "連絡", { fetchImpl, token: "staff-token" });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://api.line.me/v2/bot/message/reply", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer staff-token" }),
      body: JSON.stringify({ replyToken: "reply-token", messages: [{ type: "text", text: "本文" }] }),
    }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://api.line.me/v2/bot/message/multicast", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ to: ["U1", "U2"], messages: [{ type: "text", text: "連絡" }] }),
    }));
  });

  it("loads profile and quota", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith("/profile/U1")) return new Response(JSON.stringify({ displayName: "山田" }), { status: 200 });
      if (value.endsWith("/message/quota")) return new Response(JSON.stringify({ type: "limited", value: 200 }), { status: 200 });
      return new Response(JSON.stringify({ totalUsage: 18 }), { status: 200 });
    });

    await expect(getLineStaffProfile("U1", { fetchImpl, token: "staff-token" })).resolves.toEqual({ displayName: "山田" });
    await expect(getLineStaffQuota({ fetchImpl, token: "staff-token" })).resolves.toEqual({ quota: 200, used: 18, remaining: 182 });
  });

  it("throws a compact http error", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 429 }));

    await expect(pushLineStaff(["U1"], "本文", { fetchImpl, token: "staff-token" })).rejects.toThrow("line_staff:http 429");
  });
});
