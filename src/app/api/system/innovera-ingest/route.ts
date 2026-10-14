import { NextResponse } from "next/server";

import { ingestInnoveraRows, type InnoveraIngestMode } from "@/lib/innovera/ingest";
import type { InnoveraCallRaw } from "@/lib/innovera/client";
import { verifyBearerRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODES = new Set<InnoveraIngestMode>(["poll", "daily", "backfill"]);

function parseBody(body: unknown): { rows: InnoveraCallRaw[]; mode: InnoveraIngestMode; run_id: string | null } {
  if (!body || typeof body !== "object") throw new Error("body must be an object");
  const rowValue = (body as { rows?: unknown }).rows;
  if (!Array.isArray(rowValue)) throw new Error("rows must be an array");
  if (rowValue.length > 500) throw new Error("rows must contain at most 500 items");
  const modeValue = (body as { mode?: unknown }).mode;
  const mode = typeof modeValue === "string" && MODES.has(modeValue as InnoveraIngestMode)
    ? modeValue as InnoveraIngestMode
    : "poll";
  const runIdValue = (body as { run_id?: unknown }).run_id;
  return {
    rows: rowValue as InnoveraCallRaw[],
    mode,
    run_id: typeof runIdValue === "string" ? runIdValue : null,
  };
}

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "INNOVERA_INGEST_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let parsed: ReturnType<typeof parseBody>;
  try {
    parsed = parseBody(await request.json());
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid request",
    }, { status: 400 });
  }

  try {
    const result = await ingestInnoveraRows(parsed.rows);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[innovera-ingest] failed", error);
    return NextResponse.json({ ok: false, error: "INNOVERA 取り込みに失敗しました" }, { status: 500 });
  }
}
