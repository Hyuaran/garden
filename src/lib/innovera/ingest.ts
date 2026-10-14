import type { SupabaseClient } from "@supabase/supabase-js";

import type { InnoveraCallRaw } from "@/lib/innovera/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type InnoveraIngestMode = "poll" | "daily" | "backfill";

export type NormalizedInnoveraCall = {
  innovera_id: string;
  uniqid: string | null;
  linkedid: string | null;
  circuit_id: number;
  circuit_name: string | null;
  circuit_num: string | null;
  caller_num: string | null;
  callee_num: string | null;
  call_type: number | null;
  dial_status: number | null;
  talk_seconds: number;
  start_time: string;
  answer_time: string | null;
  end_time: string | null;
  who_hangup: string | null;
  record_file_flg: string | null;
  raw: InnoveraCallRaw;
  imported_at?: string;
};

export type InnoveraIngestResult = {
  ok: boolean;
  received: number;
  upserted: number;
  skipped: number;
};

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const current = String(value).trim();
  return current ? current : null;
}

function integer(value: unknown): number | null {
  const current = text(value);
  if (!current) return null;
  const parsed = Number(current);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function parseTalkSeconds(value: unknown): number {
  const current = text(value);
  if (!current) return 0;
  if (/^\d+$/.test(current)) return Number(current);
  const match = current.match(/^(\d{1,3}):([0-5]\d):([0-5]\d)$/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function parseInnoveraJst(value: unknown): string | null {
  const current = text(value);
  if (!current || current === "0000-00-00 00:00:00") return null;
  const match = current.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - 9, Number(mi), Number(s));
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeInnoveraRow(raw: InnoveraCallRaw): NormalizedInnoveraCall | null {
  const innoveraId = text(raw.id);
  const startTime = parseInnoveraJst(raw.start_time);
  if (!innoveraId || !startTime) return null;
  return {
    innovera_id: innoveraId,
    uniqid: text(raw.uniqid),
    linkedid: text(raw.linkedid),
    circuit_id: integer(raw.circuit_id) ?? 0,
    circuit_name: text(raw.circuit_name),
    circuit_num: text(raw.circuit_num),
    caller_num: text(raw.caller_num),
    callee_num: text(raw.callee_num),
    call_type: integer(raw.call_type),
    dial_status: integer(raw.dial_status),
    talk_seconds: parseTalkSeconds(raw.talk_time),
    start_time: startTime,
    answer_time: parseInnoveraJst(raw.answer_time),
    end_time: parseInnoveraJst(raw.end_time),
    who_hangup: text(raw.who_hangup),
    record_file_flg: text(raw.record_file_flg),
    raw,
  };
}

export function normalizeInnoveraRows(rows: InnoveraCallRaw[]) {
  const valid: NormalizedInnoveraCall[] = [];
  let skipped = 0;
  for (const row of rows) {
    const normalized = normalizeInnoveraRow(row);
    if (normalized) valid.push(normalized);
    else skipped += 1;
  }
  return { valid, skipped };
}

export async function upsertInnoveraCalls(
  rows: NormalizedInnoveraCall[],
  supabase: SupabaseClient = getSupabaseAdmin(),
) {
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("system_innovera_call")
    .upsert(rows.map((row) => ({ ...row, imported_at: new Date().toISOString() })), {
      onConflict: "innovera_id",
      ignoreDuplicates: false,
    });
  if (error) throw new Error(`system_innovera_call upsert failed: ${error.message}`);
  return rows.length;
}

export async function ingestInnoveraRows(
  rows: InnoveraCallRaw[],
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<InnoveraIngestResult> {
  const { valid, skipped } = normalizeInnoveraRows(rows);
  const upserted = await upsertInnoveraCalls(valid, supabase);
  return { ok: true, received: rows.length, upserted, skipped };
}

export async function writeInnoveraIngestLog(
  row: {
    run_id?: string | null;
    mode: InnoveraIngestMode;
    range_from?: string | null;
    range_to?: string | null;
    fetched?: number | null;
    sent?: number | null;
    upserted?: number | null;
    skipped?: number | null;
    status: "success" | "failed";
    error?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  },
  supabase: SupabaseClient = getSupabaseAdmin(),
) {
  const { error } = await supabase.from("system_innovera_ingest_log").insert({
    run_id: row.run_id ?? null,
    mode: row.mode,
    range_from: row.range_from ?? null,
    range_to: row.range_to ?? null,
    fetched: row.fetched ?? null,
    sent: row.sent ?? null,
    upserted: row.upserted ?? null,
    skipped: row.skipped ?? null,
    status: row.status,
    error: row.error ?? null,
    started_at: row.started_at ?? new Date().toISOString(),
    finished_at: row.finished_at ?? new Date().toISOString(),
  });
  if (error) throw new Error(`system_innovera_ingest_log insert failed: ${error.message}`);
}
