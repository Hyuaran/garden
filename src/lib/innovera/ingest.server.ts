import type { SupabaseClient } from "@supabase/supabase-js";

import { callInnovera, type InnoveraCallRaw } from "@/lib/innovera/client";
import {
  ingestInnoveraRows,
  normalizeInnoveraRows,
  upsertInnoveraCalls,
  writeInnoveraIngestLog,
  type InnoveraIngestMode,
} from "@/lib/innovera/ingest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const PAGE_LIMIT = 1000;
const UPSERT_BATCH_SIZE = 500;

export type RunInnoveraIngestOptions = {
  mode: InnoveraIngestMode;
  from: Date;
  to: Date;
  runId?: string;
  supabase?: SupabaseClient;
};

export function formatInnoveraJst(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function chunkRows<T>(rows: T[], size = UPSERT_BATCH_SIZE) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

export async function fetchInnoveraCdrRange(from: Date, to: Date) {
  const all: InnoveraCallRaw[] = [];
  for (let page = 1; ; page += 1) {
    const rows = await callInnovera<InnoveraCallRaw[]>("cdr", "search", {
      start_time_start: formatInnoveraJst(from),
      start_time_end: formatInnoveraJst(to),
      page,
      limit: PAGE_LIMIT,
    });
    all.push(...rows);
    if (rows.length < PAGE_LIMIT) break;
  }
  return all;
}

export async function runInnoveraIngest(options: RunInnoveraIngestOptions) {
  const supabase = options.supabase ?? getSupabaseAdmin();
  const startedAt = new Date();
  const runId = options.runId ?? `${options.mode}-${startedAt.toISOString()}`;
  let fetched = 0;
  let sent = 0;
  let upserted = 0;
  let skipped = 0;
  try {
    const rawRows = await fetchInnoveraCdrRange(options.from, options.to);
    fetched = rawRows.length;
    const { valid, skipped: invalidRows } = normalizeInnoveraRows(rawRows);
    skipped += invalidRows;
    for (const chunk of chunkRows(valid)) {
      sent += chunk.length;
      upserted += await upsertInnoveraCalls(chunk, supabase);
    }
    const finishedAt = new Date();
    await writeInnoveraIngestLog({
      run_id: runId,
      mode: options.mode,
      range_from: options.from.toISOString(),
      range_to: options.to.toISOString(),
      fetched,
      sent,
      upserted,
      skipped,
      status: "success",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
    }, supabase);
    return { ok: true, run_id: runId, mode: options.mode, fetched, sent, upserted, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeInnoveraIngestLog({
      run_id: runId,
      mode: options.mode,
      range_from: options.from.toISOString(),
      range_to: options.to.toISOString(),
      fetched,
      sent,
      upserted,
      skipped,
      status: "failed",
      error: message,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    }, supabase).catch((logError) => {
      console.error("[innovera-ingest] failed to write failure log", logError);
    });
    return { ok: false, run_id: runId, mode: options.mode, fetched, sent, upserted, skipped, error: message };
  }
}

export async function runInnoveraIngestBatch(
  rows: InnoveraCallRaw[],
  supabase: SupabaseClient = getSupabaseAdmin(),
) {
  return ingestInnoveraRows(rows, supabase);
}

export async function getCronRange(supabase: SupabaseClient = getSupabaseAdmin(), now = new Date()) {
  // 前回の終わりは 5 分ごと（poll）と深夜の読み返し（daily）の記録だけから取る。
  // 過去分（backfill）の記録を見ると、バックフィル中に古い日から読み直してしまうため
  const { data } = await supabase
    .from("system_innovera_ingest_log")
    .select("range_to")
    .eq("status", "success")
    .in("mode", ["poll", "daily"])
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ range_to: string | null }>();
  const fallback = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const from = data?.range_to ? new Date(new Date(data.range_to).getTime() - 180 * 60 * 1000) : fallback;
  return { from, to: now };
}

export function getDailyRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const todayTokyoMidnight = new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0));
  const yesterdayTokyoMidnight = new Date(todayTokyoMidnight.getTime() - 24 * 60 * 60 * 1000);
  const todayTokyoThree = new Date(todayTokyoMidnight.getTime() + 3 * 60 * 60 * 1000);
  return {
    from: new Date(yesterdayTokyoMidnight.getTime() - 9 * 60 * 60 * 1000),
    to: new Date(todayTokyoThree.getTime() - 9 * 60 * 60 * 1000),
  };
}
