/**
 * Microsoft Graph（アプリ garden-bud-mail・Mail.Read のアプリ権限）で 24 箱の受信メールを読む。
 * 読むだけ。どの箱を読めるかは Exchange の ApplicationAccessPolicy（許可グループ）で絞られている。
 */
import { MAILBOXES } from "./classify";

const GRAPH = "https://graph.microsoft.com/v1.0";

export type MailItem = {
  id: string;
  internetMessageId: string;
  mailboxes: string[];
  receivedAt: string;
  sender: string;
  senderName: string;
  subject: string;
  toRecipients?: string[];
  hasAttachments?: boolean;
  messageIdsByMailbox?: Record<string, string>;
};

type GraphMessage = {
  toRecipients?: Array<{ emailAddress?: { address?: string | null } }>;
  hasAttachments?: boolean;
  id: string;
  internetMessageId?: string | null;
  subject?: string | null;
  receivedDateTime?: string | null;
  from?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null;
};

export async function getGraphToken(): Promise<string> {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) throw new Error("MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET が設定されていません");
  const response = await graphFetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
    cache: "no-store",
  });
  const body = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) throw new Error(`Microsoft のサインインに失敗しました（${body.error ?? response.status}）`);
  return body.access_token;
}

async function listMailboxMessages(mailbox: string, sinceIso: string, token: string, details: boolean): Promise<GraphMessage[]> {
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${sinceIso}`,
    $select: "id,internetMessageId,subject,receivedDateTime,from" + (details ? ",toRecipients,hasAttachments" : ""),
    $orderby: "receivedDateTime desc",
    $top: "100",
  });
  let url: string | null = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages?${params.toString()}`;
  const rows: GraphMessage[] = [];
  while (url) {
    const response: Response = await graphFetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
      throw new Error(`${mailbox} を読めません（${body.error?.code ?? response.status}）`);
    }
    const body = (await response.json()) as { value?: GraphMessage[]; "@odata.nextLink"?: string };
    rows.push(...(body.value ?? []));
    url = body["@odata.nextLink"] ?? null;
  }
  return rows;
}

export type MailFetchResult = { items: MailItem[]; failedMailboxes: Array<{ mailbox: string; error: string }> };

/** 24 箱を読み、同じメール（internetMessageId が同じ）は 1 件にまとめる */
export async function fetchMailboxMessages(sinceIso: string, mailboxes: string[] = MAILBOXES, details = false): Promise<MailFetchResult> {
  const token = await getGraphToken();
  const byId = new Map<string, MailItem>();
  const failedMailboxes: MailFetchResult["failedMailboxes"] = [];

  for (const mailbox of mailboxes) {
    let messages: GraphMessage[];
    try {
      messages = await listMailboxMessages(mailbox, sinceIso, token, details);
    } catch (error) {
      failedMailboxes.push({ mailbox, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    for (const message of messages) {
      const key = message.internetMessageId || message.id;
      const existing = byId.get(key);
      if (existing) {
        if (!existing.mailboxes.includes(mailbox)) existing.mailboxes.push(mailbox);
        if (details) (existing.messageIdsByMailbox ??= {})[mailbox] = message.id;
        continue;
      }
      byId.set(key, {
        id: message.id,
        internetMessageId: key,
        mailboxes: [mailbox],
        receivedAt: message.receivedDateTime ?? "",
        sender: message.from?.emailAddress?.address ?? "",
        senderName: message.from?.emailAddress?.name ?? "",
        subject: message.subject ?? "",
        ...(details ? {
          toRecipients: (message.toRecipients ?? []).map(r => r.emailAddress?.address ?? "").filter(Boolean),
          hasAttachments: message.hasAttachments ?? false,
          messageIdsByMailbox: { [mailbox]: message.id },
        } : {}),
      });
    }
  }
  return { items: [...byId.values()], failedMailboxes };
}
/** 読み取り・トークン取得の一時的な失敗は最大3回再試行する。 */
export async function graphFetch(url: string, init?: RequestInit): Promise<Response> {
  for (let retry = 0; ; retry++) {
    let response: Response;
    try { response = await fetch(url, init); }
    catch (error) {
      if (retry >= 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** retry));
      continue;
    }
    if ((response.status !== 429 && response.status < 500) || retry >= 3) return response;
    const seconds = Number(response.headers.get("Retry-After"));
    await new Promise(resolve => setTimeout(resolve, Math.min(30000, seconds > 0 ? seconds * 1000 : 500 * 2 ** retry)));
  }
}

export type MailAttachment = { id: string; name: string; contentType: string; size: number; contentBytes: string; isInline?: boolean };
export type MailAttachmentMetadata = Omit<MailAttachment, "contentBytes">;
/** 通常のファイル添付の一覧のみ。中身は候補の分類後に取得する。 */
export async function fetchMessageAttachments(mailbox: string, messageId: string, token?: string): Promise<MailAttachmentMetadata[]> {
  const accessToken = token ?? await getGraphToken();
  let url: string | null = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size,isInline`;
  const attachments: MailAttachmentMetadata[] = [];
  while (url) {
    const response = await graphFetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`添付を読めません（${mailbox}: ${response.status}）`);
    const body: { value?: Array<MailAttachmentMetadata & { "@odata.type"?: string }>; "@odata.nextLink"?: string } = await response.json();
    for (const attachment of body.value ?? []) {
      if (attachment["@odata.type"] === "#microsoft.graph.fileAttachment" && !attachment.isInline) {
        attachments.push(attachment);
      }
    }
    url = body["@odata.nextLink"] ?? null;
  }
  return attachments;
}

/** 候補となった添付だけ中身を取得する。 */
export async function fetchMessageAttachmentContent(mailbox: string, messageId: string, attachmentId: string, token?: string): Promise<string> {
  const accessToken = token ?? await getGraphToken();
  const url = GRAPH + "/users/" + encodeURIComponent(mailbox) + "/messages/" + encodeURIComponent(messageId) + "/attachments/" + encodeURIComponent(attachmentId);
  // contentBytes は fileAttachment だけの項目なので $select で指定すると 400 になる（2026-10-19 実測）＝指定せずに取る
  const response = await graphFetch(url, { headers: { Authorization: "Bearer " + accessToken }, cache: "no-store" });
  if (!response.ok) throw new Error(`添付の中身を読めません（${mailbox}: ${response.status}）`);
  const body = await response.json() as { contentBytes?: string };
  if (typeof body.contentBytes !== "string") throw new Error(`添付の中身を読めません（${attachmentId}）`);
  return body.contentBytes;
}
