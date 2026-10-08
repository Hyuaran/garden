export type InnoveraUser = {
  id: string;
  name?: string | null;
  number?: string | null;
  default_circuit_id?: string | null;
  section_ids?: unknown;
  [key: string]: unknown;
};

export type InnoveraCircuit = {
  id: string;
  name?: string | null;
  number?: string | null;
  free_number?: string | null;
  circuit_num?: string | null;
  out_users_id?: string | null;
  in_users_id?: string | null;
  [key: string]: unknown;
};

export type InnoveraCallRaw = {
  id: string;
  uniqid?: string | null;
  circuit_id?: string | null;
  circuit_name?: string | null;
  caller_num?: string | null;
  caller_name?: string | null;
  callee_num?: string | null;
  callee_name?: string | null;
  call_type?: string | number | null;
  dial_status?: string | number | null;
  talk_time?: string | null;
  start_time?: string | null;
  answer_time?: string | null;
  end_time?: string | null;
  record_file_flg?: string | number | null;
  who_hangup?: string | null;
  [key: string]: unknown;
};

type InnoveraResponse<T> = {
  result?: boolean;
  error_code?: string | number | null;
  data?: T;
};

type ParamValue = string | number | boolean | null | undefined;

const BASE_TIMEOUT_MS = 25_000;
const LIST_CACHE_MS = 10 * 60_000;
const CALL_CACHE_MS = 60_000;

const cache = new Map<string, { expiresAt: number; value: unknown }>();

function getConfig() {
  const host = process.env.INNOVERA_API_HOST;
  const apiKey = process.env.INNOVERA_API_KEY;
  if (!host || !apiKey) throw new Error("innovera_unreachable:missing config");
  return { host, apiKey };
}

function normalizeHost(host: string) {
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function cacheKey(ckey: string, akey: string, params: Record<string, unknown>) {
  return JSON.stringify([ckey, akey, Object.entries(params).sort(([a], [b]) => a.localeCompare(b))]);
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await loader();
  cache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

function appendParam(body: URLSearchParams, key: string, value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) appendParam(body, key.endsWith("[]") ? key : `${key}[]`, item);
    return;
  }
  if (value === null || value === undefined) return;
  body.append(key, String(value));
}

function stripPassword<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripPassword) as T;
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.toLowerCase() === "password") continue;
    next[key] = stripPassword(item);
  }
  return next as T;
}

const RETRY_DELAY_MS = process.env.VITEST ? 0 : 2_000;

function isTransientInnoveraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("innovera_unreachable:fetch") || /^innovera_unreachable:http 5\d\d$/.test(message);
}

// Vercel → INNOVERA の接続が一時的に途切れることがあるので、接続エラー・5xx は 2 秒おいて 1 回だけやり直す
export async function callInnovera<T>(
  ckey: string,
  akey: string,
  params: Record<string, ParamValue | ParamValue[]> = {},
): Promise<T> {
  try {
    return await callInnoveraOnce<T>(ckey, akey, params);
  } catch (error) {
    if (!isTransientInnoveraError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return await callInnoveraOnce<T>(ckey, akey, params);
  }
}

async function callInnoveraOnce<T>(
  ckey: string,
  akey: string,
  params: Record<string, ParamValue | ParamValue[]> = {},
): Promise<T> {
  const { host, apiKey } = getConfig();
  const url = `https://${normalizeHost(host)}/pbx/api/front/index/?ckey=${encodeURIComponent(ckey)}&akey=${encodeURIComponent(akey)}`;
  const body = new URLSearchParams();
  body.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) appendParam(body, key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BASE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`innovera_unreachable:http ${response.status}`);
    const payload = (await response.json()) as InnoveraResponse<T>;
    if (payload.result === false) throw new Error(`innovera_unreachable:${payload.error_code ?? "result_false"}`);
    return stripPassword(payload.data as T);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("innovera_unreachable:")) throw error;
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "unknown";
    throw new Error(`innovera_unreachable:fetch ${name}`);
  } finally {
    clearTimeout(timer);
  }
}

export function listInnoveraUsers() {
  return cached(cacheKey("users", "search", {}), LIST_CACHE_MS, () =>
    callInnovera<InnoveraUser[]>("users", "search"),
  );
}

export function listInnoveraCircuits() {
  return cached(cacheKey("circuit", "search", {}), LIST_CACHE_MS, () =>
    callInnovera<InnoveraCircuit[]>("circuit", "search"),
  );
}

export type SearchInnoveraCallsParams = {
  from: string;
  to: string;
  uniqid?: string;
  number?: string;
  page?: number;
};

const CALL_SEARCH_LIMIT = 50000;
const CALL_SEARCH_MAX_PAGES = 5;

async function searchInnoveraCallsPage(params: SearchInnoveraCallsParams, page: number) {
  const requestParams: Record<string, ParamValue> = {
    start_time_start: params.from,
    start_time_end: params.to,
    page,
    limit: CALL_SEARCH_LIMIT,
  };
  if (params.uniqid) requestParams.uniqid = params.uniqid;
  if (params.number) requestParams.cdr_number = params.number;
  return cached(cacheKey("cdr", "search", requestParams), CALL_CACHE_MS, () =>
    callInnovera<InnoveraCallRaw[]>("cdr", "search", requestParams),
  );
}

export async function searchInnoveraCalls(params: SearchInnoveraCallsParams) {
  const firstPage = params.page ?? 1;
  const all: InnoveraCallRaw[] = [];
  for (let page = firstPage; page < firstPage + CALL_SEARCH_MAX_PAGES; page += 1) {
    const rows = await searchInnoveraCallsPage(params, page);
    all.push(...rows);
    if (rows.length < CALL_SEARCH_LIMIT) break;
  }
  return all;
}

export async function getInnoveraRecordingUrl(cdrId: string) {
  const data = await callInnovera<{ filepath?: string | null; record_type?: string | number | null }>(
    "cdr",
    "record",
    { cdr_id: cdrId },
  );
  return data;
}

export function setInnoveraDefaultCircuit(userId: string, circuitId: string) {
  return callInnovera<unknown>("users", "bulk_initial_circuit", {
    circuit_id: circuitId,
    "users_ids[]": [userId],
  });
}
