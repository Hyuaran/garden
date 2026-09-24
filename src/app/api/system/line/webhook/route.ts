import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { parseLineSummaryKeyword, addDays, monthOf, todayJst } from "./_lib/line-keyword";
import { buildNhkVisitLineDailySummary, buildNhkVisitLineMonthSummary } from "@/app/system/forms/nhk-visit/_lib/nhk-visit-summary";
import { loadNhkVisitRows, monthStart, summaryLoadStart } from "@/app/system/forms/nhk-visit/_lib/nhk-visit-summary.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineSource = {
  type?: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
};

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  source?: LineSource;
  message?: { type?: string; text?: string };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

function sourceTarget(source?: LineSource) {
  if (!source) return null;
  if (source.type === "group" && source.groupId) return { id: source.groupId, type: "group" };
  if (source.type === "room" && source.roomId) return { id: source.roomId, type: "room" };
  if (source.type === "user" && source.userId) return { id: source.userId, type: "user" };
  return null;
}

function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function replyLine(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
  if (!response.ok) throw new Error(`LINE reply failed: ${response.status}`);
}

async function handleJoin(event: LineWebhookEvent) {
  const target = sourceTarget(event.source);
  if (!target || !event.replyToken) return;
  await getSupabaseAdmin().from("system_line_target").upsert({
    line_target_id: target.id,
    target_type: target.type,
    purpose: "nhk_visit",
    active: true,
    joined_at: new Date().toISOString(),
    left_at: null,
  }, { onConflict: "line_target_id" });
  await replyLine(event.replyToken, "この部屋で「集計」と送ると、その日の NHK 訪問の集計をお返しします。");
}

async function handleLeave(event: LineWebhookEvent) {
  const target = sourceTarget(event.source);
  if (!target) return;
  await getSupabaseAdmin()
    .from("system_line_target")
    .update({ active: false, left_at: new Date().toISOString() })
    .eq("line_target_id", target.id)
    .eq("purpose", "nhk_visit");
}

async function buildReplyForText(text: string) {
  const keyword = parseLineSummaryKeyword(text);
  if (!keyword) return null;
  const today = todayJst();
  if (keyword.kind === "month") {
    const month = monthOf(today);
    const rows = await loadNhkVisitRows(monthStart(month), today);
    return buildNhkVisitLineMonthSummary(rows, month);
  }

  const date = keyword.kind === "date" ? keyword.date : addDays(today, keyword.dateOffset);
  const rows = await loadNhkVisitRows(summaryLoadStart(date), date);
  return buildNhkVisitLineDailySummary(rows, date);
}

async function handleMessage(event: LineWebhookEvent) {
  if (event.message?.type !== "text" || !event.message.text || !event.replyToken) return;
  const reply = await buildReplyForText(event.message.text);
  if (reply) await replyLine(event.replyToken, reply);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 1 つのできごとで失敗しても 200 を返す（LINE に何度も送り直させない）
  for (const event of body.events ?? []) {
    try {
      if (event.type === "join") await handleJoin(event);
      if (event.type === "leave") await handleLeave(event);
      if (event.type === "message") await handleMessage(event);
    } catch (error) {
      console.error("line_webhook_event_failed", event.type, error instanceof Error ? error.message : error);
    }
  }

  return NextResponse.json({ ok: true });
}
