const CHATWORK_API_BASE = "https://api.chatwork.com/v2";

export class CallReportChatworkError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? "Chatwork API request failed" : `Chatwork API request failed (${status})`);
    this.name = "CallReportChatworkError";
  }
}

export async function sendCallReportMessage(text: string, fetchImpl: typeof fetch = fetch) {
  const token = process.env.CHATWORK_API_TOKEN;
  // CHATWORK_ROOM_KYOUYU_ID（本番＝HRグループ【共有】）があればそれを使い、
  // 無ければ CHATWORK_DEV_ROOM_ID（開発ルーム・テスト用）へフォールバック。
  const roomId = process.env.CHATWORK_ROOM_KYOUYU_ID || process.env.CHATWORK_DEV_ROOM_ID;
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

export async function sendCallReportWithAttachment(
  text: string,
  pdf: Uint8Array,
  filename: string,
  fetchImpl: typeof fetch = fetch,
) {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_KYOUYU_ID || process.env.CHATWORK_DEV_ROOM_ID;
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
