import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { parseLineSummaryKeyword, addDays, monthOf, todayJst } from "./_lib/line-keyword";
import { findLineSummaryDefinition, LINE_SUMMARIES } from "./_lib/summary-registry";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ChatworkClient } from '@/lib/chatwork/client';
import { chatworkGroupBody, groupMessage, parseGroupCode } from '@/lib/line/groups';

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
  message?: { type?: string; text?: string; fileName?: string };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

type LineTargetRow = {
  summary_keywords?: string[] | null;
  label?: string | null;
  chatwork_room_id?: string | null;
  notify_enabled?: boolean;
  account?: string;
  linked_at?: string | null;
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
    summary_keywords: ["NHK"],
    active: true,
    joined_at: new Date().toISOString(),
    left_at: null,
  }, { onConflict: "line_target_id" });
  await replyLine(event.replyToken, "この部屋で「NHK集計」と送ると、その日の NHK 訪問の集計をお返しします。「合言葉」で使える集計を確認できます。");
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

async function loadLineTarget(event: LineWebhookEvent) {
  const target = sourceTarget(event.source);
  if (!target) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("system_line_target")
    .select("summary_keywords,label,chatwork_room_id,notify_enabled,account,linked_at")
    .eq("line_target_id", target.id)
    .eq("active", true)
    .maybeSingle<LineTargetRow>();
  if (error) throw error;
  return data;
}

function targetSummaryKeywords(target: LineTargetRow) {
  return (target.summary_keywords ?? []).filter((keyword): keyword is string => Boolean(keyword));
}

function buildKeywordListReply(summaryKeywords: readonly string[]) {
  const available = summaryKeywords
    .map((keyword) => findLineSummaryDefinition(keyword))
    .filter((summary): summary is NonNullable<typeof summary> => Boolean(summary));
  if (available.length === 0) return null;
  return [
    "この部屋で使える合言葉",
    ...available.flatMap((summary) => [
      `${summary.keyword}集計　　今日の集計`,
      `${summary.keyword}集計 昨日　　昨日の集計`,
      `${summary.keyword}集計 20260924　　その日の集計`,
      `${summary.keyword}今月　　今月の累計`,
    ]),
  ].join("\n");
}

async function buildReplyForText(text: string, target: LineTargetRow) {
  const summaryKeywords = targetSummaryKeywords(target);
  const keyword = parseLineSummaryKeyword(text, summaryKeywords);
  if (!keyword) return null;
  if (keyword.kind === "list") return buildKeywordListReply(summaryKeywords);

  const summary = findLineSummaryDefinition(keyword.summaryKeyword);
  if (!summary) return null;
  const today = todayJst();
  if (keyword.kind === "month") {
    const month = monthOf(today);
    return summary.buildMonth(month);
  }

  const date = keyword.kind === "date" ? keyword.date : addDays(today, keyword.dateOffset);
  return summary.buildDay(date);
}

async function handleMessage(event: LineWebhookEvent) {
  const source = sourceTarget(event.source);
  if (!source || !event.message) return;
  const code = event.message.type === 'text' ? parseGroupCode(event.message.text || '') : null;
  if (code && source.type !== 'user') {
    const {data,error} = await getSupabaseAdmin().rpc('link_line_group', {p_code:code,p_target:source.id,p_type:source.type});
    if (error) throw error;
    if (!event.replyToken) return;
    if (data) {
      await replyLine(event.replyToken, `このグループを「${data}」として登録しました。書き込みは Garden の知らせ先へ届きます。`);
      return;
    }
    // 同じコードをもう一度送ったときなど、すでに結ばれているグループには「登録済み」と返す
    const linked = await loadLineTarget(event);
    await replyLine(event.replyToken, linked?.linked_at
      ? `このグループは「${linked.label || '（名前なし）'}」としてもう登録済みです。`
      : '確認コードが見つかりません。Garden で作り直してください。');
    return;
  }
  const target = await loadLineTarget(event);
  if (!target || (target.account && target.account !== 'dev')) return;
  if (event.message.type === 'text' && event.message.text) {
    const keyword = parseLineSummaryKeyword(event.message.text, targetSummaryKeywords(target));
    if (keyword) {
      const reply = await buildReplyForText(event.message.text, target);
      if (reply && event.replyToken) await replyLine(event.replyToken, reply);
      return;
    }
    if (parseLineSummaryKeyword(event.message.text, LINE_SUMMARIES.map(s=>s.keyword))) return;
  }
  const text = groupMessage(event.message);
  if (source.type === 'user' || !event.source?.userId || !text || !target.linked_at || !target.notify_enabled || !target.chatwork_room_id) return;
  let name = '（名前を取得できませんでした）';
  try {
    const response = await fetch(`https://api.line.me/v2/bot/${source.type}/${encodeURIComponent(source.id)}/member/${encodeURIComponent(event.source.userId)}`, {
      headers: {Authorization:`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`},
    });
    if (response.ok) { const profile = await response.json(); if (typeof profile.displayName === 'string' && profile.displayName) name = profile.displayName; }
  } catch { /* 表示名の取得に失敗しても知らせる */ }
  await new ChatworkClient(process.env.CHATWORK_API_TOKEN || '', {
    dryRun: /^(true|1|yes)$/i.test(process.env.BLOOM_CHATWORK_DRY_RUN || ''),
  }).sendMessage(target.chatwork_room_id, chatworkGroupBody(target.label,name,text));
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
