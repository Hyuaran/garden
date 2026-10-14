import { NextResponse } from "next/server";
import { decryptToken } from "@/app/rill/mail/_lib/token-crypto";
import { sendChatworkMessageWithToken } from "@/app/system/_lib/chatwork";
import { ensureOwnChatworkToken, TOKEN_MISSING_MESSAGE } from "@/app/system/_lib/chatwork-own-token.server";
import { requireStaff } from "@/app/system/mypage/_lib/submission-server";

export const runtime = "nodejs";

const CHATWORK_FAILED_MESSAGE = "Chatwork に送れませんでした。しばらくしてからもう一度お試しください";
const TEXT_MAX_LENGTH = 4000;

function targetRoomId() {
  return process.env.SHUKKIN_CHATWORK_ROOM_ID || process.env.CHATWORK_DEV_ROOM_ID || "";
}

function roomLabel() {
  return process.env.SHUKKIN_CHATWORK_ROOM_ID ? "本番ルーム" : "開発ルーム（テスト）";
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, roomLabel: roomLabel() });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await request.json().catch(() => null) as { text?: unknown; date?: unknown; time?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const time = typeof body?.time === "string" ? body.time : "";

  if (!text.trim()) return NextResponse.json({ ok: false, error: "送る文面がありません" }, { status: 400 });
  if (text.length > TEXT_MAX_LENGTH) return NextResponse.json({ ok: false, error: "文面が長すぎます" }, { status: 400 });

  const roomId = targetRoomId();
  if (!roomId) return NextResponse.json({ ok: false, error: "送り先のルームが設定されていません" }, { status: 500 });

  const employeeId = String(staff.employee_id);
  const token = await ensureOwnChatworkToken({
    employee_id: employeeId,
    kot_employee_id: staff.kot_employee_id ? String(staff.kot_employee_id) : null,
  });
  if (!token.tokenEnc) {
    return NextResponse.json({ ok: false, error: TOKEN_MISSING_MESSAGE }, { status: 400 });
  }

  try {
    const sentAt = new Date().toISOString();
    const sendResult = await sendChatworkMessageWithToken({
      token: decryptToken(token.tokenEnc),
      roomId,
      text,
    });
    console.info("[shukkin.chatwork]", { employeeId, date, time, roomId, ok: true, messageId: sendResult.messageId });
    return NextResponse.json({
      ok: true,
      roomId: sendResult.roomId,
      messageId: sendResult.messageId,
      sentAt,
    });
  } catch (error) {
    console.error("[shukkin.chatwork]", error instanceof Error ? error.message : String(error));
    console.info("[shukkin.chatwork]", { employeeId, date, time, roomId, ok: false, messageId: null });
    return NextResponse.json({ ok: false, error: CHATWORK_FAILED_MESSAGE }, { status: 502 });
  }
}
