import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { runInnoveraSync } from "@/lib/innovera/sync.server";
import { checkRelayHeartbeat } from "@/lib/relay/monitor.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  await checkRelayHeartbeat().catch(() => undefined);
  const result = await runInnoveraSync({ apply: true, trigger: "cron" });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
