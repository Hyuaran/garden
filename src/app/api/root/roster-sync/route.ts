import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/system/mypage/_lib/submission-server";
import { getLatestRosterSyncLog, syncRootRoster } from "@/app/root/_lib/roster-sync.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  const latest = await getLatestRosterSyncLog();
  return NextResponse.json({ ok: true, latest });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { dryRun?: unknown } | null;
  const dryRun = body?.dryRun !== false;
  const result = await syncRootRoster({ dryRun });
  return NextResponse.json(result);
}
