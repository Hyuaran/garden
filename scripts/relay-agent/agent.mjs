#!/usr/bin/env node
import { mkdir, readdir, readFile, rm, stat, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_CONFIG = {
  transport: "supabase",
  apiBase: "https://garden-os.net",
  pullWaitMs: 25000,
  idleSleepMs: 2000,
  errorSleepMs: 5000,
  logDir: "logs",
  logKeepDays: 7,
  agentVersion: "1.2.0",
};

const DEFAULT_INNOVERA_TIMEOUT_MS = 25000;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function normalizeConfig(raw, baseDir = scriptDir) {
  const config = { ...DEFAULT_CONFIG, ...raw };
  if (!["supabase", "garden"].includes(config.transport)) throw new Error("Invalid transport");
  config.pullWaitMs = toPositiveInteger(config.pullWaitMs, DEFAULT_CONFIG.pullWaitMs);
  config.idleSleepMs = toPositiveInteger(config.idleSleepMs, DEFAULT_CONFIG.idleSleepMs);
  config.errorSleepMs = toPositiveInteger(config.errorSleepMs, DEFAULT_CONFIG.errorSleepMs);
  config.logKeepDays = toPositiveInteger(config.logKeepDays, DEFAULT_CONFIG.logKeepDays);
  config.apiBase = String(config.apiBase || DEFAULT_CONFIG.apiBase).replace(/\/+$/, "");
  config.agentVersion = String(config.agentVersion || DEFAULT_CONFIG.agentVersion);
  config.logDir = path.isAbsolute(config.logDir) ? config.logDir : path.join(baseDir, config.logDir);
  return config;
}

export async function loadConfig(configPath) {
  const resolvedPath = configPath ? path.resolve(configPath) : path.join(scriptDir, "config.json");
  const raw = JSON.parse(await readFile(resolvedPath, "utf8"));
  return normalizeConfig(raw, path.dirname(resolvedPath));
}

export function parseArgs(argv = process.argv.slice(2)) {
  const parsed = { once: false, configPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--once") {
      parsed.once = true;
    } else if (item === "--config") {
      const value = argv[index + 1];
      if (!value) throw new Error("--config requires a path.");
      parsed.configPath = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  return parsed;
}

export function validateEnvironment(env = process.env, config = DEFAULT_CONFIG) {
  const required = ["RELAY_SECRET", "INNOVERA_API_HOST", "INNOVERA_API_KEY"];
  if (isSupabase(config)) required.push("SUPABASE_URL", "SUPABASE_ANON_KEY");
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`起動に必要な環境変数がありません: ${missing.join(", ")}`);
  }
}

function jstParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(now);
}

function jstDate(now = new Date()) {
  return jstParts(now).slice(0, 10).replaceAll("-", "");
}

export function createLogger(config, { now = () => new Date() } = {}) {
  return {
    async write(level, message, fields = {}) {
      await mkdir(config.logDir, { recursive: true });
      const safeFields = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) safeFields[key] = value;
      }
      const suffix = Object.keys(safeFields).length > 0 ? ` ${JSON.stringify(safeFields)}` : "";
      const line = `${jstParts(now())} JST ${level} ${message}${suffix}\n`;
      await appendFile(path.join(config.logDir, `${jstDate(now())}.log`), line, "utf8");
      process.stdout.write(line);
    },
  };
}

export async function cleanupOldLogs(config, now = new Date()) {
  await mkdir(config.logDir, { recursive: true });
  const keepMs = config.logKeepDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(config.logDir, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && /^\d{8}\.log$/.test(entry.name))
    .map(async (entry) => {
      const fullPath = path.join(config.logDir, entry.name);
      const info = await stat(fullPath);
      if (now.getTime() - info.mtimeMs > keepMs) await rm(fullPath, { force: true });
    }));
}

function isSupabase(config) { return (config.transport ?? DEFAULT_CONFIG.transport) === "supabase"; }
function rpcRequest(name, body, env) {
  return { url: env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + name, init: {
    method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify(body),
  } };
}

export function buildPullRequest(config, env = process.env) {
  if (isSupabase(config)) return rpcRequest("system_relay_agent_pull", { p_secret: env.RELAY_SECRET, p_agent_version: config.agentVersion }, env);
  return {
    url: `${config.apiBase}/api/system/relay/pull`,
    init: {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RELAY_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ agentVersion: config.agentVersion, waitMs: config.pullWaitMs }),
    },
  };
}

export function buildResultRequest(config, payload, env = process.env) {
  if (isSupabase(config)) return rpcRequest("system_relay_agent_result", { p_secret: env.RELAY_SECRET, p_id: payload.id, p_ok: payload.ok, p_result: payload.result ?? null, p_error: payload.error ?? null }, env);
  return {
    url: `${config.apiBase}/api/system/relay/result`,
    init: {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RELAY_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  };
}

async function readJsonResponse(response, label) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${label}:json`);
  }
  return payload;
}

async function relayResponse(response, label) {
  if ([401, 403].includes(response.status)) throw new Error(label + ":unauthorized");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (payload?.message === "unauthorized") throw new Error(label + ":unauthorized");
    throw new Error(label + ":http " + response.status);
  }
  return readJsonResponse(response, label);
}
export async function parsePullResponse(response, transport = "garden") {
  const payload = await relayResponse(response, "pull");
  if (transport === "garden" && (!payload || payload.ok !== true || !("job" in payload))) throw new Error("pull:invalid");
  const job = transport === "supabase" ? payload : payload.job;
  if (job === null) return null;
  if (!job || !job.id || !job.kind) throw new Error("pull:invalid_job");
  return job;
}
export async function parseResultResponse(response, transport = "garden") {
  const payload = await relayResponse(response, "result");
  if (transport === "supabase" ? payload !== true : !payload || payload.ok !== true) throw new Error("result:invalid");
  return payload;
}

function normalizeInnoveraHost(host) {
  return String(host).replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function appendInnoveraParam(body, key, value) {
  if (Array.isArray(value)) {
    const arrayKey = key.endsWith("[]") ? key : `${key}[]`;
    for (const item of value) appendInnoveraParam(body, arrayKey, item);
    return;
  }
  if (value === null || value === undefined) return;
  body.append(key, String(value));
}

export function buildInnoveraRequest(request, env = process.env) {
  if (!request || typeof request !== "object") throw new Error("request is missing");
  const { ckey, akey, params = {} } = request;
  if (!ckey || !akey) throw new Error("ckey or akey is missing");
  const url = `https://${normalizeInnoveraHost(env.INNOVERA_API_HOST)}/pbx/api/front/index/?ckey=${encodeURIComponent(ckey)}&akey=${encodeURIComponent(akey)}`;
  const body = new URLSearchParams();
  body.set("api_key", env.INNOVERA_API_KEY);
  for (const [key, value] of Object.entries(params)) appendInnoveraParam(body, key, value);
  return {
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  };
}

async function callInnovera(request, { fetch: fetchImpl = fetch, env = process.env, timeoutMs = DEFAULT_INNOVERA_TIMEOUT_MS } = {}) {
  const built = buildInnoveraRequest(request, env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(built.url, { ...built.init, signal: controller.signal });
    if (!response.ok) throw new Error(`http ${response.status}`);
    return await readJsonResponse(response, "innovera");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("http ")) throw error;
    if (error instanceof Error && error.message === "innovera:json") throw new Error("json");
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "unknown";
    throw new Error(`fetch ${name}`);
  } finally {
    clearTimeout(timer);
  }
}

export function buildKotRequest(request, env = process.env) {
  const employeePut = request?.method === "PUT" && /^\/employees\/[a-zA-Z0-9-]+\?updateDate=\d{4}-\d{2}-\d{2}$/.test(request.path);
  if (request?.method === "GET" && request.path?.startsWith("/employees/")) {
    const params = new URLSearchParams(request.path.split("?")[1]);
    if (!/^\/employees\/[a-zA-Z0-9]+(?:\?|$)/.test(request.path) || [...params].some(([key, value]) => !["includeResigner", "date"].includes(key) || params.getAll(key).length !== 1 || (key === "includeResigner" ? !/^(true|false)$/.test(value) : !/^\d{4}-\d{2}-\d{2}$/.test(value)))) throw new Error("kot: この操作は許可していません");
  }
  if (request?.method !== "GET" && !(request?.method === "POST" && request.path === "/employees") && !employeePut) throw new Error("kot: この操作は許可していません");
  let body;
  if (request.method === "POST" || request.method === "PUT") {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) throw new Error("kot: JSON 本文が必要です");
    body = JSON.stringify(request.body);
    if (Buffer.byteLength(body, "utf8") > 16384) throw new Error("kot: 本文が大きすぎます");
  }
  const value = request.path;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { throw new Error("kot: path が不正です"); }
  if (typeof value !== "string" || !/^\/[a-zA-Z0-9_-]/.test(value) ||
      /\.\.|[\\:#\s]|\/\//.test(decoded) || /%/.test(decoded)) throw new Error("kot: path が不正です");
  if (request.method === "GET") {
    const pathname = value.split("?")[0];
    if (!/^\/(?:employees(?:\/[a-zA-Z0-9]+)?|divisions|working-types|monthly-workings\/\d{4}-\d{2}|daily-workings\/\d{4}-\d{2}-\d{2})$/.test(pathname)) throw new Error("kot: この操作は許可していません");
  }
  if (!env.KOT_API_TOKEN) throw new Error("kot: KOT の鍵がホスト PC にありません");
  return { url: `https://api.kingtime.jp/v1.0${value}`, init: {
    method: request.method, body, redirect: "error",
    headers: { Authorization: `Bearer ${env.KOT_API_TOKEN}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}) },
  } };
}

async function callKot(request, { fetch: fetchImpl = fetch, env = process.env, timeoutMs = 20000, sleep: pause = sleep } = {}) {
  const built = buildKotRequest(request, env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let attempt = 0; attempt <= 3; attempt += 1) {
      const response = await fetchImpl(built.url, { ...built.init, signal: controller.signal });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500 && response.status < 600) && request.method === "GET" && attempt < 3) {
          await response.body?.cancel();
          await pause(500 * 2 ** attempt);
          continue;
        }
        if (response.status === 403) {
          const body = await response.json().catch(() => null);
          if (Array.isArray(body?.errors) && body.errors.some(item => Number(item?.code) === 105)) {
            throw new Error("kot: 403 RATE_LIMITED");
          }
        }
        throw new Error(`kot: ${response.status} HTTP エラー`);
      }
      const text = await response.text();
      if (request.method === "PUT" && !text.trim()) return null;
      if (Buffer.byteLength(text, "utf8") > 4 * 1024 * 1024) throw new Error("kot: 応答が大きすぎます");
      let result;
      try { result = JSON.parse(text); } catch { throw new Error("kot: JSON を解釈できません"); }
      if (Buffer.byteLength(JSON.stringify(result), "utf8") > 4 * 1024 * 1024) throw new Error("kot: 応答が大きすぎます");
      return result;
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("kot:")) throw error;
    throw new Error("kot: ホストへ到達できませんでした");
  } finally { clearTimeout(timer); }
}

function shortError(error) {
  if (error instanceof Error && error.message) return error.message.slice(0, 160);
  return String(error).slice(0, 160);
}

export async function handleJob(job, options = {}) {
  if (!job || !job.id) return { id: undefined, ok: false, error: "job id is missing" };
  if (job.kind === "kot") {
    try {
      return { id: job.id, ok: true, result: await callKot(job.request, options) };
    } catch (error) {
      return { id: job.id, ok: false, error: shortError(error) };
    }
  }
  if (job.kind !== "innovera") {
    return { id: job.id, ok: false, error: `unsupported kind: ${job.kind}` };
  }
  try {
    const result = await callInnovera(job.request, options);
    return { id: job.id, ok: true, result };
  } catch (error) {
    return { id: job.id, ok: false, error: `innovera: ${shortError(error)}` };
  }
}

const IDLE_LOG_EVERY = 120; // 仕事なしのログは 120 回に 1 行だけ記録する
let idleCount = 0;

// RPC は 30 秒、Garden の pull は待ち時間＋15 秒で打ち切る。
async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function pullOnce(config, logger, fetchImpl = fetch) {
  if (idleCount % IDLE_LOG_EVERY === 0) await logger.write("info", "取りに行く", { transport: config.transport ?? DEFAULT_CONFIG.transport });
  const pullRequest = buildPullRequest(config);
  const response = await fetchWithTimeout(fetchImpl, pullRequest.url, pullRequest.init, isSupabase(config) ? 30000 : config.pullWaitMs + 15000);
  const job = await parsePullResponse(response, config.transport ?? DEFAULT_CONFIG.transport);
  if (!job) {
    idleCount += 1;
    if (idleCount % IDLE_LOG_EVERY === 1) await logger.write("info", "待機中（仕事なし）", { wait_ms: isSupabase(config) ? config.idleSleepMs : config.pullWaitMs });
    return false;
  }
  idleCount = 0;
  await logger.write("info", "job開始", { id: job.id, kind: job.kind });
  const resultPayload = await handleJob(job, { fetch: fetchImpl });
  const resultRequest = buildResultRequest(config, resultPayload);
  const resultResponse = await fetchWithTimeout(fetchImpl, resultRequest.url, resultRequest.init, 30000);
  await parseResultResponse(resultResponse, config.transport ?? DEFAULT_CONFIG.transport);
  await logger.write(resultPayload.ok ? "info" : "error", "job完了", { id: job.id, kind: job.kind, ok: resultPayload.ok });
  return true;
}

export async function run(config, { once = false, logger = createLogger(config), fetchImpl = fetch, sleep: pause = sleep } = {}) {
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await cleanupOldLogs(config);
    await logger.write("info", "relay agent started", { version: config.agentVersion, transport: config.transport ?? DEFAULT_CONFIG.transport });
    do {
      try {
        const hadJob = await pullOnce(config, logger, fetchImpl);
        if (!once && !hadJob && !stopping) await pause(config.idleSleepMs);
      } catch (error) {
        const message = shortError(error);
        if (message === "pull:unauthorized" || message === "result:unauthorized") {
          await logger.write("error", "認証エラー: RELAY_SECRET が違います", {});
        } else {
          await logger.write("error", "処理エラー", { error: message });
        }
        if (once) throw error;
        if (!stopping) await pause(config.errorSleepMs);
      }
    } while (!once && !stopping);
    await logger.write("info", "relay agent stopped");
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

async function main() {
  try {
    const args = parseArgs();
    const config = await loadConfig(args.configPath);
    validateEnvironment(process.env, config);
    await run(config, { once: args.once });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
