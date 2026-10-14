import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  enqueueRelayJob: vi.fn(),
  waitRelayJob: vi.fn(),
  getRelayHeartbeat: vi.fn(),
  isRelayAlive: vi.fn(),
}));

vi.mock("@/lib/relay/queue.server", () => relayMocks);

import { callInnovera, listInnoveraUsers, searchInnoveraCalls, setInnoveraDefaultCircuit } from "./client";

describe("innovera client", () => {
  beforeEach(() => {
    vi.stubEnv("INNOVERA_API_HOST", "api.example.test");
    vi.stubEnv("INNOVERA_API_KEY", "secret");
    vi.stubEnv("INNOVERA_RELAY_MODE", "direct");
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
    relayMocks.enqueueRelayJob.mockResolvedValue({ id: "job-1" });
    relayMocks.getRelayHeartbeat.mockResolvedValue({ last_seen_at: new Date().toISOString() });
    relayMocks.isRelayAlive.mockReturnValue(true);
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
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
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

  it("uses the relay queue in queue mode and strips returned password fields", async () => {
    vi.stubEnv("INNOVERA_RELAY_MODE", "queue");
    vi.stubEnv("INNOVERA_API_KEY", "");
    relayMocks.waitRelayJob.mockResolvedValue({
      result: true,
      data: [{ id: "u2", password: "hidden" }],
    });

    const data = await callInnovera<Array<{ id: string }>>("users", "search", { section_ids: [1, 2] });

    expect(data).toEqual([{ id: "u2" }]);
    expect(relayMocks.enqueueRelayJob).toHaveBeenCalledWith("innovera", {
      ckey: "users",
      akey: "search",
      params: { section_ids: [1, 2] },
    }, "screen");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails fast without retry when the relay heartbeat is stale", async () => {
    vi.stubEnv("INNOVERA_RELAY_MODE", "queue");
    relayMocks.isRelayAlive.mockReturnValue(false);

    await expect(callInnovera("cdr", "search")).rejects.toThrow("innovera_unreachable:relay_down");
    expect(relayMocks.enqueueRelayJob).not.toHaveBeenCalled();
  });

  it("keeps INNOVERA result false errors from relay results", async () => {
    vi.stubEnv("INNOVERA_RELAY_MODE", "queue");
    relayMocks.waitRelayJob.mockResolvedValue({ result: false, error_code: 999, data: null });

    await expect(callInnovera("cdr", "search")).rejects.toThrow("innovera_unreachable:999");
  });
});
