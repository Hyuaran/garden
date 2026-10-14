import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { writeInnoveraIngestLog, type InnoveraIngestMode } from "@/lib/innovera/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODES = new Set<InnoveraIngestMode>(["poll", "daily", "backfill"]);
const STATUSES = new Set(["success", "failed"]);

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "INNOVERA_INGEST_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const mode = typeof body?.mode === "string" && MODES.has(body.mode as InnoveraIngestMode)
    ? body.mode as InnoveraIngestMode
    : null;
  const status = typeof body?.status === "string" && STATUSES.has(body.status) ? body.status as "success" | "failed" : null;
  if (!mode || !status) return NextResponse.json({ ok: false, error: "mode and status are required" }, { status: 400 });

  try {
    await writeInnoveraIngestLog({
      run_id: typeof body?.run_id === "string" ? body.run_id : null,
      mode,
      range_from: typeof body?.range_from === "string" ? body.range_from : null,
      range_to: typeof body?.range_to === "string" ? body.range_to : null,
      fetched: numberOrNull(body?.fetched),
      sent: numberOrNull(body?.sent),
      upserted: numberOrNull(body?.upserted),
      skipped: numberOrNull(body?.skipped),
      status,
      error: typeof body?.error === "string" ? body.error : null,
      started_at: typeof body?.started_at === "string" ? body.started_at : null,
      finished_at: typeof body?.finished_at === "string" ? body.finished_at : null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[innovera-ingest/log] failed", error);
    return NextResponse.json({ ok: false, error: "INNOVERA 取り込みログを書き込めませんでした" }, { status: 500 });
  }
}
