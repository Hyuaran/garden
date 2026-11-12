// target="dev" はテスト送信（mode: "test"）。本番の送り先に関係なく開発ルームへ送る（2026-11-12 東海林さん「テストは全て開発ルームで」）
export type CallReportRoomTarget = "live" | "dev";
function callReportRoomId(target: CallReportRoomTarget = "live") {
  if (target === "dev") return process.env.CHATWORK_DEV_ROOM_ID;
  return process.env.CHATWORK_ROOM_KYOUYU_ID || process.env.CHATWORK_DEV_ROOM_ID;
}

const CHATWORK_API_BASE = "https://api.chatwork.com/v2";

export class CallReportChatworkError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? "Chatwork API request failed" : `Chatwork API request failed (${status})`);
    this.name = "CallReportChatworkError";
  }
}

export async function sendCallReportMessage(text: string, fetchImpl: typeof fetch = fetch, target: CallReportRoomTarget = "live") {
  const token = process.env.CHATWORK_API_TOKEN;
  // CHATWORK_ROOM_KYOUYU_ID（配信先）があればそれを使い、
  // 無ければ CHATWORK_DEV_ROOM_ID（開発ルーム・テスト用）へフォールバック。
  const roomId = callReportRoomId(target);
  if (!token || !roomId) throw new Error("Chatwork配信ルーム設定が不足しています");

  const form = new URLSearchParams({ body: text });
  let response: Response;
  try {
    response = await fetchImpl(`${CHATWORK_API_BASE}/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: {
        "X-ChatWorkToken": token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new CallReportChatworkError(null);
  }
  if (!response.ok) throw new CallReportChatworkError(response.status);
  return { ok: true as const };
}

export async function sendKanriReportMessage(text: string, fetchImpl: typeof fetch = fetch) {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.KANRI_CHATWORK_ROOM_ID || process.env.CHATWORK_DEV_ROOM_ID;
  if (!token || !roomId) throw new Error("Chatwork配信ルーム設定が不足しています");

  const form = new URLSearchParams({ body: text });
  let response: Response;
  try {
    response = await fetchImpl(`${CHATWORK_API_BASE}/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: {
        "X-ChatWorkToken": token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new CallReportChatworkError(null);
  }
  if (!response.ok) throw new CallReportChatworkError(response.status);
  return { ok: true as const, roomId };
}

export async function sendChatworkMessageWithToken({
  token,
  roomId,
  text,
  fetchImpl = fetch,
}: {
  token: string;
  roomId: string;
  text: string;
  fetchImpl?: typeof fetch;
}) {
  if (!token || !roomId) throw new Error("Chatwork配信ルーム設定が不足しています");

  const form = new URLSearchParams({ body: text });
  let response: Response;
  try {
    response = await fetchImpl(`${CHATWORK_API_BASE}/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: {
        "X-ChatWorkToken": token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new CallReportChatworkError(null);
  }
  if (!response.ok) throw new CallReportChatworkError(response.status);
  const json = await response.json().catch(() => ({})) as { message_id?: string | number };
  return { ok: true as const, roomId, messageId: json.message_id == null ? null : String(json.message_id) };
}

export async function getChatworkMe(token: string, fetchImpl: typeof fetch = fetch) {
  if (!token) throw new Error("Chatwork API トークンがありません");
  let response: Response;
  try {
    response = await fetchImpl(`${CHATWORK_API_BASE}/me`, {
      method: "GET",
      headers: { "X-ChatWorkToken": token },
      cache: "no-store",
    });
  } catch {
    throw new CallReportChatworkError(null);
  }
  if (!response.ok) throw new CallReportChatworkError(response.status);
  const json = await response.json() as { name?: unknown; account_id?: unknown };
  return {
    name: String(json.name ?? ""),
    accountId: json.account_id == null ? null : String(json.account_id),
  };
}

export async function sendCallReportWithAttachment(
  text: string,
  pdf: Uint8Array,
  filename: string,
  fetchImpl: typeof fetch = fetch,
  target: CallReportRoomTarget = "live",
) {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = callReportRoomId(target);
  if (!token || !roomId) throw new Error("Chatwork配信ルーム設定が不足しています");

  const form = new FormData();
  form.set("message", text);
  const pdfBytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  form.set("file", new Blob([pdfBytes], { type: "application/pdf" }), filename);
  let response: Response;
  try {
    response = await fetchImpl(`${CHATWORK_API_BASE}/rooms/${encodeURIComponent(roomId)}/files`, {
      method: "POST",
      headers: { "X-ChatWorkToken": token },
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new CallReportChatworkError(null);
  }
  if (!response.ok) throw new CallReportChatworkError(response.status);
  return { ok: true as const };
}
