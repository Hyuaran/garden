import { describe, expect, it, vi } from "vitest";
import { buildKotRequest, handleJob, validateEnvironment } from "../agent.mjs";
const request = { method: "GET", path: "/employees?date=2026-10-20" };
const env = { KOT_API_TOKEN: "test-secret" };
const job = (req = request) => ({ id: "kot-1", kind: "kot", request: req });
describe("KOT relay", () => {
  it("sends GET to the fixed host and passes JSON through", async () => {
    const fetch = vi.fn(async () => Response.json([{ code: "001" }]));
    expect(await handleJob(job(), { fetch, env })).toEqual({ id: "kot-1", ok: true, result: [{ code: "001" }] });
    expect(fetch.mock.calls[0][0]).toBe("https://api.kingtime.jp/v1.0/employees?date=2026-10-20");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error", headers: { Authorization: "Bearer test-secret" } });
  });
  it.each(["POST", "PUT", "DELETE", undefined])("rejects method %s", method => {
    expect(() => buildKotRequest({ ...request, method }, env)).toThrow("許可していません");
  });
  it.each(["https://evil.test/", "//evil.test", "/../employees", "/%2e%2e/employees", "/%252e%252e/employees", "/a\\b", "/a#b", "/a\nb", "/a?url=https://evil.test"])("rejects unsafe path %s", path => {
    expect(() => buildKotRequest({ ...request, path }, env)).toThrow("path");
  });
  it("missing KOT token only fails the KOT job", async () => {
    expect(() => validateEnvironment({ RELAY_SECRET: "x", INNOVERA_API_HOST: "x", INNOVERA_API_KEY: "x" })).not.toThrow();
    const fetch = vi.fn();
    expect(await handleJob(job(), { fetch, env: {} })).toMatchObject({ ok: false, error: "kot: KOT の鍵がホスト PC にありません" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([429, 503])("retries %s up to three times", async status => {
    const fetch = vi.fn().mockImplementation(async () => new Response(null, { status }));
    const sleep = vi.fn(async () => {});
    expect(await handleJob(job(), { fetch, env, sleep })).toMatchObject({ ok: false, error: `kot: ${status} HTTP エラー` });
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });
  it("recovers after a retry", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429 })).mockResolvedValueOnce(Response.json([]));
    expect(await handleJob(job(), { fetch, env, sleep: async () => {} })).toMatchObject({ ok: true, result: [] });
  });
  it("rejects responses above 4MB", async () => {
    expect(await handleJob(job(), { env, fetch: async () => Response.json("あ".repeat(1500000)) })).toMatchObject({ ok: false, error: "kot: 応答が大きすぎます" });
  });
  it("does not expose upstream bodies or network errors", async () => {
    expect(await handleJob(job(), { env, fetch: async () => new Response("private", { status: 403 }) })).toMatchObject({ error: "kot: 403 HTTP エラー" });
    expect(await handleJob(job(), { env, fetch: async () => { throw new Error("test-secret"); } })).toMatchObject({ error: "kot: ホストへ到達できませんでした" });
  });
});

it("preserves KOT-specific rate limits without returning the body", async () => {
  const result = await handleJob({ id: "rate", kind: "kot", request: { method: "GET", path: "/employees" } }, {
    env: { KOT_API_TOKEN: "secret" },
    fetch: async () => Response.json({ errors: [{ code: 105, message: "private" }] }, { status: 403 }),
  });
  expect(result).toEqual({ id: "rate", ok: false, error: "kot: 403 RATE_LIMITED" });
});
