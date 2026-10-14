import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { RelayHeartbeatRow, RelayJobRow, RelayKind, RelayRequest, RelayResult } from "./types";

const DEFAULT_WAIT_MS = 25_000;
const DEFAULT_INTERVAL_MS = 1_000;
const JOB_TTL_MS = 60_000;
const HEARTBEAT_ALIVE_MS = 2 * 60_000;
const HEARTBEAT_ID = "host-pc";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relayError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}

function isNotFoundError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "PGRST116",
  );
}

export async function enqueueRelayJob(kind: RelayKind, request: RelayRequest, requestedBy: string) {
  const expiresAt = new Date(Date.now() + JOB_TTL_MS).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("system_relay_jobs")
    .insert({
      kind,
      request,
      requested_by: requestedBy,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error) throw new Error(relayError(error));
  return data as RelayJobRow;
}

export async function waitRelayJob(
  id: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<RelayResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const { data, error } = await getSupabaseAdmin()
      .from("system_relay_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(relayError(error));
    const row = data as RelayJobRow | null;
    if (!row) throw new Error("relay_job_not_found");
    if (row.status === "done") return row.result;
    if (row.status === "failed") throw new Error(row.error || "relay_failed");
    if (row.status === "expired") throw new Error("relay_timeout");
    await sleep(intervalMs);
  }

  await getSupabaseAdmin()
    .from("system_relay_jobs")
    .update({ status: "expired", finished_at: new Date().toISOString(), error: "relay_timeout" })
    .eq("id", id)
    .in("status", ["queued", "running"]);
  throw new Error("relay_timeout");
}

async function expireQueuedJobs(nowIso: string) {
  await getSupabaseAdmin()
    .from("system_relay_jobs")
    .update({ status: "expired", finished_at: nowIso, error: "relay_timeout" })
    .eq("status", "queued")
    .lte("expires_at", nowIso);
}

async function findQueuedJob(nowIso: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("system_relay_jobs")
    .select("*")
    .eq("status", "queued")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(relayError(error));
  return ((data as RelayJobRow[] | null) ?? [])[0] ?? null;
}

async function claimQueuedJob(id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("system_relay_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (error && !isNotFoundError(error)) throw new Error(relayError(error));
  return (data as RelayJobRow | null) ?? null;
}

export async function pullRelayJob(options: { waitMs?: number } = {}) {
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const deadline = Date.now() + waitMs;

  // 期限切れの片付けは 1 回の pull につき最初だけ（毎秒やらない＝ホスト PC が常に聞きに来るため DB の負荷を抑える）
  await expireQueuedJobs(new Date().toISOString());

  while (Date.now() <= deadline) {
    const nowIso = new Date().toISOString();
    const candidate = await findQueuedJob(nowIso);
    if (candidate) {
      const claimed = await claimQueuedJob(candidate.id);
      if (claimed) return claimed;
      continue;
    }
    await sleep(DEFAULT_INTERVAL_MS);
  }

  return null;
}

export async function completeRelayJob(
  id: string,
  completion: { ok: boolean; result?: RelayResult; error?: string },
) {
  const patch = completion.ok
    ? { status: "done", result: completion.result ?? null, error: null, finished_at: new Date().toISOString() }
    : { status: "failed", result: completion.result ?? null, error: completion.error || "relay_failed", finished_at: new Date().toISOString() };
  const { data, error } = await getSupabaseAdmin()
    .from("system_relay_jobs")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error && !isNotFoundError(error)) throw new Error(relayError(error));
  if (!data) return false;
  return true;
}

export async function touchRelayHeartbeat(agentVersion?: string | null) {
  const nowIso = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("system_relay_heartbeat")
    .upsert({
      id: HEARTBEAT_ID,
      last_seen_at: nowIso,
      agent_version: agentVersion ?? null,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error) throw new Error(relayError(error));
  return data as RelayHeartbeatRow;
}

export async function getRelayHeartbeat() {
  const { data, error } = await getSupabaseAdmin()
    .from("system_relay_heartbeat")
    .select("*")
    .eq("id", HEARTBEAT_ID)
    .maybeSingle();
  if (error) throw new Error(relayError(error));
  return (data as RelayHeartbeatRow | null) ?? null;
}

export function isRelayAlive(heartbeat: RelayHeartbeatRow | null, now = new Date()) {
  if (!heartbeat) return false;
  const seen = new Date(heartbeat.last_seen_at).getTime();
  return Number.isFinite(seen) && now.getTime() - seen <= HEARTBEAT_ALIVE_MS;
}
