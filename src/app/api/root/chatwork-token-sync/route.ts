import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { syncChatworkTokens } from "@/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { kotEmployeeId?: unknown } | null;
  const kotEmployeeId = typeof body?.kotEmployeeId === "string" && body.kotEmployeeId.trim()
    ? body.kotEmployeeId.trim()
    : undefined;
  const result = await syncChatworkTokens({ kotEmployeeId });
  return NextResponse.json(result);
}
