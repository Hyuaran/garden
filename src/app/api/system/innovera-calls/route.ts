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
      const message = error instanceof Error ? error.message : "";
      const isInputError = message.includes("日付") || message.includes("1年");
      return NextResponse.json(
        { ok: false, error: isInputError ? message : "INNOVERA に接続できませんでした。少し待ってからもう一度押してください。", detail: isInputError ? undefined : message },
        { status: isInputError ? 400 : 500 },
      );
    }
  }
}
