"use server";

import {
  formatApprovedMessage,
  formatRejectedMessage,
  formatBatchApprovedMessage,
  formatBatchRejectedMessage,
  type TransferNotifyContext,
  type BatchNotifyContext,
} from "../_lib/chatwork-formatter";

const CHATWORK_API_BASE = "https://api.chatwork.com/v2";

interface ChatworkNotifyResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

async function postChatworkMessage(
  body: string,
): Promise<ChatworkNotifyResult> {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_BUD_ROOM_ID;

  if (!token || !roomId) {
    console.warn(
      "[chatwork-notify] CHATWORK_API_TOKEN または CHATWORK_BUD_ROOM_ID が未設定。通知スキップ。",
    );
    return { success: false, skipped: true, error: "env not configured" };
  }

  try {
    const params = new URLSearchParams();
    params.set("body", body);
    params.set("self_unread", "0");

    const res = await fetch(`${CHATWORK_API_BASE}/rooms/${roomId}/messages`, {
      method: "POST",
      headers: {
        "X-ChatWorkToken": token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(
        `[chatwork-notify] HTTP ${res.status}: ${text.substring(0, 200)}`,
      );
      return { success: false, error: `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e) {
    console.warn("[chatwork-notify] fetch error:", e);
    return { success: false, error: (e as Error).message };
  }
}

export async function notifyTransferApproved(
  ctx: TransferNotifyContext,
): Promise<ChatworkNotifyResult> {
  return postChatworkMessage(formatApprovedMessage(ctx));
}

export async function notifyTransferRejected(
  ctx: TransferNotifyContext,
): Promise<ChatworkNotifyResult> {
  return postChatworkMessage(formatRejectedMessage(ctx));
}

export async function notifyBatchApproved(
  ctx: BatchNotifyContext,
): Promise<ChatworkNotifyResult> {
  return postChatworkMessage(formatBatchApprovedMessage(ctx));
}

export async function notifyBatchRejected(
  ctx: BatchNotifyContext,
): Promise<ChatworkNotifyResult> {
  return postChatworkMessage(formatBatchRejectedMessage(ctx));
}
