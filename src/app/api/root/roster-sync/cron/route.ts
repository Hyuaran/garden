import { NextResponse } from "next/server";
import { syncRootRoster } from "@/app/root/_lib/roster-sync.server";
import { verifyCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyCronRequest(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  const result = await syncRootRoster({ dryRun: false });
  return NextResponse.json(result);
}
