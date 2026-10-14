import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { pullRelayJob, touchRelayHeartbeat } from "@/lib/relay/queue.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: Request) {
  const auth = verifyBearerRequest(request, "RELAY_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  let body: { agentVersion?: string; waitMs?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await touchRelayHeartbeat(body.agentVersion);
    const waitMs = Math.min(Number.isFinite(body.waitMs) ? Number(body.waitMs) : 25_000, 25_000);
    const job = await pullRelayJob({ waitMs });
    return NextResponse.json({
      ok: true,
      job: job ? { id: job.id, kind: job.kind, request: job.request } : null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: jsonError(error) }, { status: 500 });
  }
}
