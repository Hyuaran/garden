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
};

type GraphMessage = {
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
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
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

async function listMailboxMessages(mailbox: string, sinceIso: string, token: string): Promise<GraphMessage[]> {
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${sinceIso}`,
    $select: "id,internetMessageId,subject,receivedDateTime,from",
    $orderby: "receivedDateTime desc",
    $top: "100",
  });
  let url: string | null = `${GRAPH}/users/${encodeURIComponent(mailbox)}/messages?${params.toString()}`;
  const rows: GraphMessage[] = [];
  while (url) {
    const response: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
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
export async function fetchMailboxMessages(sinceIso: string, mailboxes: string[] = MAILBOXES): Promise<MailFetchResult> {
  const token = await getGraphToken();
  const byId = new Map<string, MailItem>();
  const failedMailboxes: MailFetchResult["failedMailboxes"] = [];

  for (const mailbox of mailboxes) {
    let messages: GraphMessage[];
    try {
      messages = await listMailboxMessages(mailbox, sinceIso, token);
    } catch (error) {
      failedMailboxes.push({ mailbox, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    for (const message of messages) {
      const key = message.internetMessageId || message.id;
      const existing = byId.get(key);
      if (existing) {
        if (!existing.mailboxes.includes(mailbox)) existing.mailboxes.push(mailbox);
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
      });
    }
  }
  return { items: [...byId.values()], failedMailboxes };
}
