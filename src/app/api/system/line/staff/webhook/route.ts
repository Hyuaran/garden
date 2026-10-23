import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getLineStaffProfile, replyLineStaff } from "@/lib/line/staff-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineSource = { type?: string; userId?: string };
type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  source?: LineSource;
  message?: { type?: string; text?: string };
};
type LineWebhookBody = { events?: LineWebhookEvent[] };
type EmployeeRow = {
  employee_id?: string | null;
  employee_number?: string | null;
  name?: string | null;
  line_user_id?: string | null;
};

// 公式 LINE「official｜通知」はシフト連絡以外の業務でも使う（2026-10-23 東海林さん）＝用途を限らない言い方に
const LINK_GUIDE = "アカウント登録のために、『連携 社員番号』（例：連携 1568）と送ってください。";
const FOLLOW_REPLY = `official｜通知です。${LINK_GUIDE}`;

function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_STAFF_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

function parseLinkText(text: string) {
  const normalized = normalizeDigits(text.trim()).replace(/\u3000/g, " ");
  // 「連携 1568」「連携　１５６８」「連携1568」（空白なし）のどれでも通す
  const match = normalized.match(/^連携\s*(\d{3,5})$/);
  return match ? match[1].padStart(4, "0") : null;
}

function todayJstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function isoToJstDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function reply(replyToken: string | undefined, text: string) {
  if (!replyToken) return;
  await replyLineStaff(replyToken, text);
}

async function displayNameFor(lineUserId: string) {
  try {
    return (await getLineStaffProfile(lineUserId)).displayName || null;
  } catch {
    return null;
  }
}

async function handleFollow(event: LineWebhookEvent) {
  await reply(event.replyToken, FOLLOW_REPLY);
}

async function handleLink(event: LineWebhookEvent, employeeNumber: string) {
  const lineUserId = event.source?.userId;
  if (!lineUserId || !event.replyToken) return;
  const client = getSupabaseAdmin();
  const { data: employee, error } = await client
    .from("root_employees")
    .select("employee_id,employee_number,name,line_user_id")
    .eq("employee_number", employeeNumber)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle<EmployeeRow>();
  if (error) throw error;
  if (!employee?.employee_number) {
    // 名簿に無い人も「連携前の一覧」に残す（名簿を直したあと、画面から手で紐づけられるように）。送ってきた文を last_text に
    await rememberPending(lineUserId, `連携 ${employeeNumber}`);
    await reply(event.replyToken, `社員番号 ${Number(employeeNumber)} が名簿に見つかりません。番号を確かめて、もう一度『連携 社員番号』と送ってください。`);
    return;
  }
  if (employee.line_user_id && employee.line_user_id !== lineUserId) {
    await reply(event.replyToken, "この社員番号はすでに別の LINE と紐づいています。事務へ連絡してください。");
    return;
  }

  const { data: sameLineRows, error: sameLineError } = await client
    .from("root_employees")
    .select("employee_id,employee_number")
    .eq("line_user_id", lineUserId);
  if (sameLineError) throw sameLineError;
  const previousIds = (sameLineRows ?? [])
    .map((row) => String((row as { employee_id?: unknown }).employee_id ?? ""))
    .filter((id) => id && id !== employee.employee_id);
  if (previousIds.length > 0) {
    const { error: clearError } = await client
      .from("root_employees")
      .update({ line_user_id: null, line_display_name: null, line_link_source: "admin_unlink" })
      .in("employee_id", previousIds);
    if (clearError) throw clearError;
  }

  const displayName = await displayNameFor(lineUserId);
  const { error: updateError } = await client
    .from("root_employees")
    .update({
      line_user_id: lineUserId,
      line_display_name: displayName,
      line_linked_at: new Date().toISOString(),
      line_link_source: "self",
    })
    .eq("employee_number", employeeNumber)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (updateError) throw updateError;
  await client.from("system_line_staff_pending").delete().eq("line_user_id", lineUserId);
  await reply(event.replyToken, `${String(employee.name ?? "").trim() || employeeNumber}さんとして登録しました。ありがとうございます。`);
}

async function handleUnlinkedText(event: LineWebhookEvent, text: string) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const client = getSupabaseAdmin();
  const { data: linked, error: linkedError } = await client
    .from("root_employees")
    .select("employee_id")
    .eq("line_user_id", lineUserId)
    .neq("line_link_source", "unfollowed")
    .maybeSingle();
  if (linkedError) throw linkedError;
  if (linked) return;

  const { shouldReply } = await rememberPending(lineUserId, text);
  if (shouldReply) await reply(event.replyToken, LINK_GUIDE);
}

// 連携前の一覧（system_line_staff_pending）に残す。戻り値＝今日はまだ案内を返していないか（1 人 1 日 1 回）
async function rememberPending(lineUserId: string, text: string) {
  const client = getSupabaseAdmin();
  const { data: pending } = await client
    .from("system_line_staff_pending")
    .select("last_seen_at,first_seen_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle<{ last_seen_at?: string | null; first_seen_at?: string | null }>();
  const shouldReply = isoToJstDate(pending?.last_seen_at) !== todayJstDate();
  const displayName = await displayNameFor(lineUserId);
  const now = new Date().toISOString();
  const { error: upsertError } = await client
    .from("system_line_staff_pending")
    .upsert({
      line_user_id: lineUserId,
      display_name: displayName,
      last_text: text.slice(0, 100),
      last_seen_at: now,
      // 最初に来た日時は 2 回目以降も残す
      first_seen_at: pending?.first_seen_at ?? now,
    }, { onConflict: "line_user_id" });
  if (upsertError) throw upsertError;
  return { shouldReply };
}

async function handleMessage(event: LineWebhookEvent) {
  if (event.message?.type !== "text" || !event.message.text) return;
  const employeeNumber = parseLinkText(event.message.text);
  if (employeeNumber) await handleLink(event, employeeNumber);
  else await handleUnlinkedText(event, event.message.text);
}

async function handleUnfollow(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  await getSupabaseAdmin()
    .from("root_employees")
    .update({ line_link_source: "unfollowed", line_linked_at: new Date().toISOString() })
    .eq("line_user_id", lineUserId);
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

  for (const event of body.events ?? []) {
    try {
      if (event.type === "follow") await handleFollow(event);
      if (event.type === "message") await handleMessage(event);
      if (event.type === "unfollow") await handleUnfollow(event);
    } catch (error) {
      console.error("line_staff_webhook_event_failed", event.type, error instanceof Error ? error.message : error);
    }
  }

  return NextResponse.json({ ok: true });
}
