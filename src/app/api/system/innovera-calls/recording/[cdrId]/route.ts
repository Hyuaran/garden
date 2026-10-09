import { NextResponse } from "next/server";
import { canPlayRecording, isCallFinished, normalizeCall } from "@/lib/innovera/calls";
import { getInnoveraRecordingUrl, searchInnoveraCalls } from "@/lib/innovera/client";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { dayRange, validateDate } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function writePlayLog(ctx: Awaited<ReturnType<typeof requireCallAccess>>, call: ReturnType<typeof normalizeCall>) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const admin = getSupabaseAdmin();
  const { data: recent } = await admin
    .from("system_innovera_recording_play_log")
    .select("id")
    .eq("employee_id", ctx.employeeId)
    .eq("cdr_id", call.id)
    .gte("played_at", fiveMinutesAgo)
    .limit(1);
  if (recent?.length) return;
  await admin.from("system_innovera_recording_play_log").insert({
    employee_id: ctx.employeeId,
    access: ctx.access,
    cdr_id: call.id,
    uniqid: call.uniqid,
    call_started_at: call.startTime,
    own_extension: ctx.ownExtension,
    call_extension: call.extension,
    counterpart_number: call.counterpartNumber,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ cdrId: string }> },
) {
  try {
    const ctx = await requireCallAccess();
    const { cdrId } = await context.params;
    const searchParams = new URL(request.url).searchParams;
    const uniqid = searchParams.get("uniqid") || "";
    const date = validateDate(searchParams.get("date"));
    if (!uniqid) return NextResponse.json({ ok: false, error: "uniqid is required" }, { status: 400 });

    const range = dayRange(date);
    const rawCalls = await searchInnoveraCalls({ ...range, uniqid });
    const raw = rawCalls.find((call) => String(call.uniqid ?? "") === uniqid && String(call.id ?? "") === cdrId);
    if (!raw) return NextResponse.json({ ok: false, error: "録音を確認できませんでした" }, { status: 404 });
    if (!isCallFinished(raw)) {
      return NextResponse.json({ ok: false, error: "通話中は再生できません" }, { status: 409 });
    }
    if (!canPlayRecording(raw, ctx.access, ctx.ownExtensions, new Date(), ctx.ownWindows)) {
      return NextResponse.json({ ok: false, error: "この録音は聞けません" }, { status: 403 });
    }

    const record = await getInnoveraRecordingUrl(cdrId);
    if (!record.filepath) return NextResponse.json({ ok: false, error: "録音ファイルが見つかりません" }, { status: 404 });
    const headers = new Headers();
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) headers.set("range", rangeHeader);
    const upstream = await fetch(record.filepath, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ ok: false, error: "この録音は聞けません" }, { status: upstream.status });
    }

    const call = normalizeCall(raw);
    await writePlayLog(ctx, call);
    const responseHeaders = new Headers();
    for (const key of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    responseHeaders.set("content-type", upstream.headers.get("content-type") || "audio/wav");
    responseHeaders.set("cache-control", "private, no-store");
    responseHeaders.set("content-disposition", "inline");
    responseHeaders.set("accept-ranges", upstream.headers.get("accept-ranges") || "bytes");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    try {
      return callAccessErrorResponse(error);
    } catch {
      return NextResponse.json({ ok: false, error: "INNOVERA に接続できませんでした" }, { status: 500 });
    }
  }
}
