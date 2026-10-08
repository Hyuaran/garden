import { NextResponse } from "next/server";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";
import { applyUiFilters, counts, filterOptions, loadAllowedCallsForRange, validateRange } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallAccess();
    const searchParams = new URL(request.url).searchParams;
    const range = validateRange(searchParams);
    const calls = await loadAllowedCallsForRange(ctx, range.innovera);
    const filtered = applyUiFilters(calls, searchParams, ctx.ownExtensions);
    return NextResponse.json({
      ok: true,
      range: { from: range.from, to: range.to },
      access: ctx.access,
      ownExtension: ctx.ownExtension,
      ownExtensions: ctx.ownExtensions,
      calls: filtered.map(({ raw: _raw, ...call }) => call),
      counts: counts(filtered),
      filterOptions: filterOptions(calls),
    });
  } catch (error) {
    try {
      return callAccessErrorResponse(error);
    } catch {
      const message = error instanceof Error ? error.message : "";
      const isInputError = message.includes("日付") || message.includes("日時") || message.includes("開始") || message.includes("1年") || message.includes("31 日");
      return NextResponse.json(
        { ok: false, error: isInputError ? message : "INNOVERA に接続できませんでした。少し待ってからもう一度押してください。", detail: isInputError ? undefined : message },
        { status: isInputError ? 400 : 500 },
      );
    }
  }
}
