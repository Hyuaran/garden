import { NextResponse } from "next/server";

import { buildNhkVisitChatworkSummary } from "@/app/system/forms/nhk-visit/_lib/nhk-visit-summary";
import { loadNhkVisitRows, summaryLoadStart } from "@/app/system/forms/nhk-visit/_lib/nhk-visit-summary.server";
import { ChatworkClient } from "@/lib/chatwork";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function resolveRoomId() {
  return process.env.NHK_REPORT_CHATWORK_ROOM_ID || process.env.CHATWORK_DEV_ROOM_ID || "";
}

function logDestination(roomId: string) {
  return `chatwork:${roomId}`;
}

async function alreadySent(reportDate: string, destination: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("system_nhk_visit_daily_report_log")
    .select("id")
    .eq("report_date", reportDate)
    .eq("destination", destination)
    .eq("succeeded", true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function insertLog(reportDate: string, destination: string, body: string, succeeded: boolean, error: string | null) {
  await getSupabaseAdmin().from("system_nhk_visit_daily_report_log").insert({
    report_date: reportDate,
    destination,
    body,
    succeeded,
    error,
  });
}

// Vercel の定時実行は GET で呼ぶ。手で動かすときの POST も受ける（既存の定時実行と同じ形）
async function handler(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date") || todayJst();
  if (!validDate(reportDate)) return NextResponse.json({ ok: false, error: "invalid_date" }, { status: 400 });

  const roomId = resolveRoomId();
  if (!roomId) return NextResponse.json({ ok: false, error: "chatwork_room_not_configured" }, { status: 500 });
  const destination = logDestination(roomId);

  if (await alreadySent(reportDate, destination)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_sent" });
  }

  const rows = await loadNhkVisitRows(summaryLoadStart(reportDate), reportDate);
  const body = buildNhkVisitChatworkSummary(rows, reportDate);

  try {
    const token = process.env.CHATWORK_API_TOKEN;
    if (!token) throw new Error("CHATWORK_API_TOKEN is not configured");
    const client = new ChatworkClient(token);
    const result = await client.sendMessage(roomId, body);
    await insertLog(reportDate, destination, body, true, null);
    return NextResponse.json({ ok: true, messageId: result.message_id, destination });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await insertLog(reportDate, destination, body, false, message).catch(() => undefined);
    return NextResponse.json({ ok: false, error: "chatwork_send_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) { return handler(request); }
export async function POST(request: Request) { return handler(request); }
