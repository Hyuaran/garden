import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ChatworkClient } from "@/lib/chatwork/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InboxEvent = {
  type?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string; fileName?: string; address?: string };
};

function messageText(message: NonNullable<InboxEvent["message"]>) {
  switch (message.type) {
    case "text": return message.text ?? "";
    case "image": return "（画像）";
    case "video": return "（動画）";
    case "audio": return "（音声）";
    case "sticker": return "（スタンプ）";
    case "file": return `（ファイル：${message.fileName || "名前なし"}）`;
    case "location": return `（位置情報：${message.address || "住所なし"}）`;
    default: return "（未対応のメッセージ）";
  }
}

const safe = (value: string) => value.replace(/\[/g, "［");

export async function POST(request: Request, { params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  if (account !== "hikari" && account !== "shokai") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const prefix = account === "hikari" ? "LINE_HIKARI" : "LINE_SHOKAI";
  const label = account === "hikari" ? "ヒカリのプロ" : "紹介キャンペーン事務局";
  const secret = process.env[`${prefix}_CHANNEL_SECRET`];
  const token = process.env[`${prefix}_CHANNEL_ACCESS_TOKEN`];
  const roomId = process.env.LINE_INBOX_CHATWORK_ROOM_ID || process.env.CHATWORK_DEV_ROOM_ID;
  const chatworkToken = process.env.CHATWORK_API_TOKEN;
  const missing = [
    !secret && `${prefix}_CHANNEL_SECRET`,
    !token && `${prefix}_CHANNEL_ACCESS_TOKEN`,
    !roomId && "LINE_INBOX_CHATWORK_ROOM_ID or CHATWORK_DEV_ROOM_ID",
    !chatworkToken && "CHATWORK_API_TOKEN",
  ].filter(Boolean);
  if (!secret || !token || !roomId || !chatworkToken) {
    console.error("line_inbox_configuration_missing", account, missing);
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const rawBody = await request.text();
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("base64"));
  const signature = Buffer.from(request.headers.get("x-line-signature") || "");
  if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let events: InboxEvent[];
  try {
    const body = JSON.parse(rawBody);
    if (!body || (body.events !== undefined && !Array.isArray(body.events))) throw new Error("Invalid events");
    events = body.events ?? [];
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  for (const event of events) {
    try {
      if (event?.type !== "message" || event.source?.type !== "user" || !event.message) continue;
      let name = "（名前を取得できませんでした）";
      if (event.source.userId) {
        try {
          const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(event.source.userId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error(`Profile HTTP ${response.status}`);
          const profile = await response.json();
          if (typeof profile.displayName === "string" && profile.displayName) name = profile.displayName;
        } catch (error) {
          console.error("line_inbox_profile_failed", account, error instanceof Error ? error.message : error);
        }
      }
      await new ChatworkClient(chatworkToken, {
        dryRun: /^(true|1|yes)$/i.test(process.env.BLOOM_CHATWORK_DRY_RUN || ""),
      }).sendMessage(roomId, `[info][title]${label} からメッセージが届きました[/title]送信者：${safe(name)}\n${safe(messageText(event.message))}[/info]`);
    } catch (error) {
      console.error("line_inbox_event_failed", account, error instanceof Error ? error.message : error);
    }
  }
  return NextResponse.json({ ok: true });
}
