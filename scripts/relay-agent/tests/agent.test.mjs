import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildInnoveraRequest,
  buildResultRequest,
  parseResultResponse,
  DEFAULT_CONFIG,
  validateEnvironment,
  run,
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
    const env = { RELAY_SECRET: randomUUID() };
    const request = buildPullRequest(
      { transport: "garden", apiBase: "https://garden-os.net", pullWaitMs: 25000, agentVersion: "1.0.0" },
      env,
    );
    expect(request.url).toBe("https://garden-os.net/api/system/relay/pull");
    expect(request.init.headers.authorization).toBe(`Bearer ${env.RELAY_SECRET}`);
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


describe("supabase transport", () => {
  const config = { ...DEFAULT_CONFIG };
  const env = { SUPABASE_URL: "https://project.supabase.co/", SUPABASE_ANON_KEY: randomUUID(), RELAY_SECRET: randomUUID(), INNOVERA_API_HOST: "example.test", INNOVERA_API_KEY: randomUUID() };
  it("defaults to supabase 1.2.0 with 2000ms idle sleep and validates environment", () => {
    expect(config).toMatchObject({ transport: "supabase", agentVersion: "1.2.0", idleSleepMs: 2000 });
    expect(() => validateEnvironment(env, config)).not.toThrow();
    expect(() => validateEnvironment({ ...env, SUPABASE_URL: undefined }, config)).toThrow("SUPABASE_URL");
    expect(() => validateEnvironment({ ...env, SUPABASE_URL: undefined, SUPABASE_ANON_KEY: undefined }, { transport: "garden" })).not.toThrow();
  });
  it("builds authenticated RPC pull and result requests", () => {
    const pull = buildPullRequest(config, env);
    expect(pull.url).toBe("https://project.supabase.co/rest/v1/rpc/system_relay_agent_pull");
    expect(pull.init.method).toBe("POST");
    expect(pull.init.headers).toEqual({ apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY, "content-type": "application/json" });
    expect(JSON.parse(pull.init.body)).toEqual({ p_secret: env.RELAY_SECRET, p_agent_version: "1.2.0" });
    for (const ok of [true, false]) {
      const payload = { id: randomUUID(), ok, result: ok ? { data: 1 } : null, error: ok ? null : "failed" };
      const result = buildResultRequest(config, payload, env);
      expect(result.url).toBe("https://project.supabase.co/rest/v1/rpc/system_relay_agent_result");
      expect(result.init.headers).toEqual(pull.init.headers);
      expect(JSON.parse(result.init.body)).toEqual({ p_secret: env.RELAY_SECRET, p_id: payload.id, p_ok: ok, p_result: payload.result, p_error: payload.error });
    }
  });
  it("keeps Garden result request and response contract", async () => {
    const payload = { id: randomUUID(), ok: true, result: null };
    const built = buildResultRequest({ ...config, transport: "garden" }, payload, env);
    expect(built.url).toBe("https://garden-os.net/api/system/relay/result");
    expect(built.init.headers.authorization).toBe("Bearer " + env.RELAY_SECRET);
    expect(JSON.parse(built.init.body)).toEqual(payload);
    await expect(parseResultResponse(response(200, { ok: true }))).resolves.toEqual({ ok: true });
  });
  it("parses RPC jobs, no job, completion and rejected credentials", async () => {
    const job = { id: randomUUID(), kind: "kot", request: {} };
    await expect(parsePullResponse(response(200, job), "supabase")).resolves.toEqual(job);
    await expect(parsePullResponse(response(200, null), "supabase")).resolves.toBeNull();
    await expect(parseResultResponse(response(200, true), "supabase")).resolves.toBe(true);
    await expect(parseResultResponse(response(200, false), "supabase")).rejects.toThrow("result:invalid");
    for (const status of [401, 403, 400]) {
      await expect(parsePullResponse(response(status, { message: "unauthorized" }), "supabase")).rejects.toThrow("pull:unauthorized");
      await expect(parseResultResponse(response(status, { message: "unauthorized" }), "supabase")).rejects.toThrow("result:unauthorized");
    }
  });
  it("sleeps after idle and auth errors and posts handled job results", async () => {
    const logDir = await mkdtemp(path.join(os.tmpdir(), "relay-agent-"));
    const logger = { write: vi.fn(async () => {}) };
    vi.stubEnv("SUPABASE_URL", env.SUPABASE_URL);
    vi.stubEnv("SUPABASE_ANON_KEY", env.SUPABASE_ANON_KEY);
    vi.stubEnv("RELAY_SECRET", env.RELAY_SECRET);
    try {
      for (const [reply, delay] of [[response(200, null), 2000], [response(403, {}), config.errorSleepMs]]) {
        const pause = vi.fn(async () => { process.emit("SIGTERM"); });
        await run({ ...config, logDir }, { logger, fetchImpl: vi.fn(async () => reply), sleep: pause });
        expect(pause).toHaveBeenCalledWith(delay);
      }
      const job = { id: randomUUID(), kind: "unsupported", request: {} };
      const fetchImpl = vi.fn().mockResolvedValueOnce(response(200, job)).mockResolvedValueOnce(response(200, true));
      await run({ ...config, logDir }, { logger, fetchImpl, once: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(fetchImpl.mock.calls[1][0]).toContain("system_relay_agent_result");
      expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({ p_id: job.id, p_ok: false, p_error: "unsupported kind: unsupported" });
    } finally { vi.unstubAllEnvs(); await rm(logDir, { recursive: true, force: true }); }
  });
});
