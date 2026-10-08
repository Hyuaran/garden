import { beforeEach, describe, expect, it, vi } from "vitest";
import { callInnovera, listInnoveraUsers, searchInnoveraCalls, setInnoveraDefaultCircuit } from "./client";

describe("innovera client", () => {
  beforeEach(() => {
    vi.stubEnv("INNOVERA_API_HOST", "api.example.test");
    vi.stubEnv("INNOVERA_API_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("posts form params and strips password fields", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      result: true,
      data: [{ id: "u1", number: "2040", password: "hidden" }],
    })));
    const data = await listInnoveraUsers();
    expect(data).toEqual([{ id: "u1", number: "2040" }]);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(init?.body)).toContain("api_key=secret");
  });

  it("serializes array params with bracket names", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ result: true, data: {} })));
    await setInnoveraDefaultCircuit("u1", "c1");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(init?.body)).toContain("users_ids%5B%5D=u1");
  });

  it("throws result false and timeout-shaped errors", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ result: false, error_code: 999, data: null })));
    await expect(callInnovera("cdr", "search")).rejects.toThrow("innovera_unreachable:999");

    vi.mocked(fetch).mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError"));
    await expect(callInnovera("cdr", "search")).rejects.toThrow("innovera_unreachable:fetch TimeoutError");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it("retries once after a transient connection error and succeeds", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: [{ id: "c1" }] })));
    const data = await callInnovera<Array<{ id: string }>>("circuit", "search");
    expect(data).toEqual([{ id: "c1" }]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("does not retry when INNOVERA answers result false", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ result: false, error_code: 999, data: null })));
    await expect(callInnovera("cdr", "search")).rejects.toThrow("innovera_unreachable:999");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("continues call search while full pages are returned", async () => {
    const fullPage = Array.from({ length: 50000 }, (_, index) => ({ id: `cdr-${index}` }));
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: fullPage })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: [{ id: "cdr-last" }] })));
    const data = await searchInnoveraCalls({ from: "2026-10-08 00:00:00", to: "2026-10-08 23:59:59" });
    expect(data).toHaveLength(50001);
    expect(String(vi.mocked(fetch).mock.calls[0][1]?.body)).toContain("page=1");
    expect(String(vi.mocked(fetch).mock.calls[1][1]?.body)).toContain("page=2");
  });
});
