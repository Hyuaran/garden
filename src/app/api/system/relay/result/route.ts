import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { completeRelayJob } from "@/lib/relay/queue.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "RELAY_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let body: { id?: string; ok?: boolean; result?: unknown; error?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  try {
    const found = await completeRelayJob(body.id, {
      ok: body.ok === true,
      result: body.result,
      error: body.error,
    });
    if (!found) return NextResponse.json({ ok: false, error: "relay_job_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: jsonError(error) }, { status: 500 });
  }
}
