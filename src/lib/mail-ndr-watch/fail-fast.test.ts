import { afterEach, expect, it, vi } from "vitest";
import { graphFetch } from "../mail-payment-check/graph-mail";
import { collect } from "./graph";
import { runWatch, type Dependencies, type State } from "./run";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it("retries 502 once, stops at the first mailbox and notifies once per outage", async () => {
  vi.useFakeTimers();
  for (const name of ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET"]) vi.stubEnv(name, "mock");
  const fetch = vi.fn(async (url: string) => url.includes("/token")
    ? Response.json({ access_token: "mock" }) : Response.json({}, { status: 502 }));
  vi.stubGlobal("fetch", fetch);
  let state: State = { started_at: "2026-11-12T00:00:00Z", last_run_at: null, outage: false, outage_notified: false };
  const deps: Dependencies = {
    readState: async () => state, initialize: async () => state,
    lock: async () => true, unlock: async () => {},
    saveState: async s => { state = { ...s }; }, known: async () => false,
    saveAlert: vi.fn(), collect, send: vi.fn(async () => {}),
  };
  for (let n = 0; n < 2; n++) {
    const result = runWatch(deps, false, new Date("2026-11-13T00:00:00Z"));
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ ok: false });
  }
  const reads = fetch.mock.calls.filter(([url]) => url.includes("/messages"));
  expect(reads).toHaveLength(4);
  expect(new Set(reads.map(([url]) => new URL(url).pathname)).size).toBe(1);
  expect(deps.send).toHaveBeenCalledTimes(1);
});

it("limits timeouts to one retry and returns failure", async () => {
  vi.useFakeTimers();
  for (const name of ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET"]) vi.stubEnv(name, "mock");
  vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
    expect(ms).toBe(15_000);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), ms);
    return controller.signal;
  });
  const fetch = vi.fn((url: string, init?: RequestInit) => url.includes("/token")
    ? Promise.resolve(Response.json({ access_token: "mock" })) : new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetch);
  const result = collect("2026-11-12T00:00:00Z", "2026-11-12T00:00:00Z").catch(error => error);
  await vi.runAllTimersAsync();
  expect((await result).name).toBe("TimeoutError");
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("preserves the default three retries for shared callers", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(async () => Response.json({}, { status: 502 }));
  vi.stubGlobal("fetch", fetch);
  const result = graphFetch("https://mock.invalid");
  await vi.runAllTimersAsync();
  expect((await result).status).toBe(502);
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(fetch.mock.calls[0]).toEqual(["https://mock.invalid", undefined]);
});
