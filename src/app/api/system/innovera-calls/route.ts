import { NextResponse } from "next/server";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";
import { applyUiFilters, counts, loadAllowedCallsForDate, validateDate } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallAccess();
    const searchParams = new URL(request.url).searchParams;
    const date = validateDate(searchParams.get("date"));
    const calls = await loadAllowedCallsForDate(ctx, date);
    const filtered = applyUiFilters(calls, searchParams, ctx.ownExtensions);
    return NextResponse.json({
      ok: true,
      date,
      access: ctx.access,
      ownExtension: ctx.ownExtension,
      ownExtensions: ctx.ownExtensions,
      calls: filtered.map(({ raw: _raw, ...call }) => call),
      counts: counts(filtered),
    });
  } catch (error) {
    try {
      return callAccessErrorResponse(error);
    } catch {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "INNOVERA に接続できませんでした。少し待ってからもう一度押してください。" },
        { status: error instanceof Error && (error.message.includes("日付") || error.message.includes("1年")) ? 400 : 500 },
      );
    }
  }
}
