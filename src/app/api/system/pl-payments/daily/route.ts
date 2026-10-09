import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";
import { runPlPaymentsDaily } from "@/lib/pl-payments/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const result = await runPlPaymentsDaily({ apply: !dry, trigger: "daily" });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
