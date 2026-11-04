import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { runScheduledBroadcasts } from '@/lib/line/scheduled.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  }
  return NextResponse.json(await runScheduledBroadcasts());
}
