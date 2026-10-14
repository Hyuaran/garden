#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAGE_LIMIT = 1000;
const INGEST_LIMIT = 500;
const RATE_LIMIT_WAIT_MS = 60_000;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(scriptDir, "state.json");

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { dry: false, api: "https://garden-os.net" };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--dry") out.dry = true;
    else if (current === "--from") out.from = argv[++index];
    else if (current === "--to") out.to = argv[++index];
    else if (current === "--api") out.api = argv[++index]?.replace(/\/+$/, "");
    else throw new Error(`Unknown argument: ${current}`);
  }
  if (!out.to) throw new Error("--to is required");
  return out;
}

export function splitDays(from, to) {
  const days = [];
  const cursor = new Date(`${from}T00:00:00+09:00`);
  const end = new Date(`${to}T00:00:00+09:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
    throw new Error("Invalid --from/--to date range");
  }
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function nextDate(date) {
  const current = new Date(`${date}T00:00:00+09:00`);
  current.setDate(current.getDate() + 1);
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadState() {
  if (!fs.existsSync(statePath)) return {};
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function saveState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function formDate(day, end = false) {
  return `${day} ${end ? "23:59:59" : "00:00:00"}`;
}

function normalizeHost(host) {
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export async function fetchInnoveraDay(day, env = process.env, fetchImpl = fetch) {
  const host = env.INNOVERA_API_HOST;
  const apiKey = env.INNOVERA_API_KEY;
  if (!host || !apiKey) throw new Error("INNOVERA_API_HOST and INNOVERA_API_KEY are required");
  const url = `https://${normalizeHost(host)}/pbx/api/front/index/?ckey=cdr&akey=search`;
  const all = [];
  for (let page = 1; ; page += 1) {
    const body = new URLSearchParams();
    body.set("api_key", apiKey);
    body.set("start_time_start", formDate(day));
    body.set("start_time_end", formDate(day, true));
    body.set("page", String(page));
    body.set("limit", String(PAGE_LIMIT));
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (response.status === 429) {
      await sleep(RATE_LIMIT_WAIT_MS);
      page -= 1;
      continue;
    }
    if (!response.ok) throw new Error(`INNOVERA HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.result === false) throw new Error(`INNOVERA result false: ${payload.error_code ?? "unknown"}`);
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    all.push(...rows);
    if (rows.length < PAGE_LIMIT) break;
  }
  return all;
}

export function chunks(rows, size = INGEST_LIMIT) {
  const out = [];
  for (let index = 0; index < rows.length; index += size) out.push(rows.slice(index, index + size));
  return out;
}

export async function postIngest(api, secret, rows, runId, fetchImpl = fetch) {
  let upserted = 0;
  let skipped = 0;
  let sent = 0;
  for (const chunk of chunks(rows)) {
    sent += chunk.length;
    const response = await fetchImpl(`${api}/api/system/innovera-ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ rows: chunk, mode: "backfill", run_id: runId }),
    });
    if (!response.ok) throw new Error(`ingest HTTP ${response.status}`);
    const body = await response.json();
    upserted += Number(body.upserted ?? 0);
    skipped += Number(body.skipped ?? 0);
  }
  return { sent, upserted, skipped };
}

export async function postLog(api, secret, payload, fetchImpl = fetch) {
  const response = await fetchImpl(`${api}/api/system/innovera-ingest/log`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`log HTTP ${response.status}`);
}

export async function main(argv = process.argv.slice(2), env = process.env, fetchImpl = fetch) {
  const args = parseArgs(argv);
  const secret = env.INNOVERA_INGEST_SECRET;
  if (!secret && !args.dry) throw new Error("INNOVERA_INGEST_SECRET is required");
  const state = loadState();
  const from = args.from ?? state.nextDate;
  if (!from) throw new Error("--from is required for the first run");
  for (const day of splitDays(from, args.to)) {
    const runId = `backfill-${day}`;
    const startedAt = new Date().toISOString();
    let log = {
      run_id: runId,
      mode: "backfill",
      range_from: `${day}T00:00:00+09:00`,
      range_to: `${day}T23:59:59+09:00`,
      fetched: 0,
      sent: 0,
      upserted: 0,
      skipped: 0,
      status: "success",
      error: null,
      started_at: startedAt,
      finished_at: null,
    };
    try {
      const rows = await fetchInnoveraDay(day, env, fetchImpl);
      log.fetched = rows.length;
      if (!args.dry) Object.assign(log, await postIngest(args.api, secret, rows, runId, fetchImpl));
      log.finished_at = new Date().toISOString();
    } catch (error) {
      log.status = "failed";
      log.error = error instanceof Error ? error.message : String(error);
      log.finished_at = new Date().toISOString();
      if (!args.dry) await postLog(args.api, secret, log, fetchImpl).catch(() => undefined);
      throw error;
    }
    if (!args.dry) await postLog(args.api, secret, log, fetchImpl);
    saveState({ nextDate: nextDate(day), lastRunId: runId, updatedAt: new Date().toISOString() });
    console.log(`${day}: fetched=${log.fetched} sent=${log.sent} upserted=${log.upserted} skipped=${log.skipped}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
