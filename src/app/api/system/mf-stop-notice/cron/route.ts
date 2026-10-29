import { NextResponse } from "next/server";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { runMfStopNoticeCron } from "@/lib/mf-stop-notice/run.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  try {
    const result = await runMfStopNoticeCron(new URL(request.url).searchParams.get("dryRun") === "1");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "mf_stop_notice_failed" }, { status: 500 });
  }
}
