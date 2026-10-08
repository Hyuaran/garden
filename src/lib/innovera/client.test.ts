import { beforeEach, describe, expect, it, vi } from "vitest";
import { callInnovera, listInnoveraUsers, setInnoveraDefaultCircuit } from "./client";

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

    vi.mocked(fetch).mockRejectedValueOnce(new DOMException("The operation was aborted.", "TimeoutError"));
    await expect(callInnovera("cdr", "search")).rejects.toThrow("innovera_unreachable:fetch TimeoutError");
  });
});
