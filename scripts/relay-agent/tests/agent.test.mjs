import { describe, expect, it, vi } from "vitest";
import {
  buildInnoveraRequest,
  buildPullRequest,
  handleJob,
  parsePullResponse,
} from "../agent.mjs";

function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn(async () => payload),
  };
}

describe("relay agent", () => {
  it("builds pull requests with bearer auth and wait body", () => {
    const request = buildPullRequest(
      { apiBase: "https://garden-os.net", pullWaitMs: 25000, agentVersion: "1.0.0" },
      { RELAY_SECRET: "secret-value" },
    );
    expect(request.url).toBe("https://garden-os.net/api/system/relay/pull");
    expect(request.init.headers.authorization).toBe("Bearer secret-value");
    expect(JSON.parse(request.init.body)).toEqual({ agentVersion: "1.0.0", waitMs: 25000 });
  });

  it("classifies pull auth, http, and invalid json responses", async () => {
    await expect(parsePullResponse(response(401, { ok: false }))).rejects.toThrow("pull:unauthorized");
    await expect(parsePullResponse(response(503, { ok: false }))).rejects.toThrow("pull:http 503");
    await expect(parsePullResponse({
      status: 200,
      ok: true,
      json: vi.fn(async () => {
        throw new Error("not json");
      }),
    })).rejects.toThrow("pull:json");
  });

  it("returns null when Garden has no job", async () => {
    await expect(parsePullResponse(response(200, { ok: true, job: null }))).resolves.toBeNull();
  });

  it("sends INNOVERA url and form body including array params", async () => {
    const request = buildInnoveraRequest(
      {
        ckey: "users",
        akey: "search",
        params: {
          name: "garden",
          empty: null,
          ids: [1, 2],
          "users_ids[]": ["a", "b"],
        },
      },
      { INNOVERA_API_HOST: "https://example.innovera.jp/", INNOVERA_API_KEY: "api-key" },
    );
    expect(request.url).toBe("https://example.innovera.jp/pbx/api/front/index/?ckey=users&akey=search");
    expect(request.init.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(request.init.body.get("api_key")).toBe("api-key");
    expect(request.init.body.get("name")).toBe("garden");
    expect(request.init.body.has("empty")).toBe(false);
    expect(request.init.body.getAll("ids[]")).toEqual(["1", "2"]);
    expect(request.init.body.getAll("users_ids[]")).toEqual(["a", "b"]);
  });

  it("passes INNOVERA JSON through unchanged, including result false", async () => {
    const payload = { result: false, error_code: "E001", data: { password: "kept-by-relay" } };
    const fetch = vi.fn(async () => response(200, payload));
    const result = await handleJob(
      { id: "job-1", kind: "innovera", request: { ckey: "users", akey: "search", params: {} } },
      { fetch, env: { INNOVERA_API_HOST: "host.example", INNOVERA_API_KEY: "key" } },
    );
    expect(result).toEqual({ id: "job-1", ok: true, result: payload });
  });

  it("returns ok false for INNOVERA connection failures", async () => {
    const fetch = vi.fn(async () => {
      throw Object.assign(new Error("network down"), { name: "TypeError" });
    });
    const result = await handleJob(
      { id: "job-2", kind: "innovera", request: { ckey: "cdr", akey: "search", params: {} } },
      { fetch, env: { INNOVERA_API_HOST: "host.example", INNOVERA_API_KEY: "key" } },
    );
    expect(result.id).toBe("job-2");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^innovera: fetch TypeError/);
  });

  it("rejects KOT requests without an allowed method", async () => {
    await expect(handleJob({ id: "job-3", kind: "kot", request: {} })).resolves.toEqual({
      id: "job-3",
      ok: false,
      error: "kot: この操作は許可していません",
    });
  });
});
