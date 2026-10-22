import { getGraphToken, graphFetch } from "@/lib/mail-payment-check/graph-mail";
import { isNdr, isNdrCandidate, makeAlert, plainText, type Message, type Alert } from "./parse";
export const DEFAULT_MAILBOXES = "shoji@hyuaran1.onmicrosoft.com,keiri@hyuaran1.onmicrosoft.com,cs@hyuaran1.onmicrosoft.com";
export function mailboxes() { return [...new Set((process.env.MAIL_NDR_WATCH_MAILBOXES ?? DEFAULT_MAILBOXES).split(",").map(s => s.trim()).filter(Boolean))]; }
export async function collect(since: string, startedAt: string): Promise<Alert[]> {
  const token = await getGraphToken();
  async function page<T>(url: string): Promise<{ value?: T[]; "@odata.nextLink"?: string }> {
    if (!url.startsWith("https://graph.microsoft.com/v1.0/")) throw new Error("Invalid Graph pagination URL");
    const response = await graphFetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"' }, cache: "no-store" });
    if (!response.ok) throw new Error(`Graph read failed (${response.status})`);
    return response.json();
  }
  const alerts: Alert[] = [];
  for (const mailbox of mailboxes()) {
    const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages`;
    const params = new URLSearchParams({ $filter: `receivedDateTime ge ${since}`, $orderby: "receivedDateTime desc", $select: "id,subject,receivedDateTime,from,body,hasAttachments", $top: "100" });
    let url: string | undefined = `${base}?${params}`;
    while (url) {
      const data: { value?: Message[]; "@odata.nextLink"?: string } = await page<Message>(url);
      for (const message of data.value ?? []) {
        if (!message.receivedDateTime || !(Date.parse(message.receivedDateTime) >= Date.parse(startedAt)) || !isNdrCandidate(message)) continue;
        // Exchange の「配信不能」は本文が空で、中身はメールの元データ（MIME）の report 部分にある（2026-10-22 実物）。元のメールの部分（message/rfc822）より前だけを使う
        if (!plainText(message.body?.content).trim()) {
          const raw = await graphFetch(`${base}/${encodeURIComponent(message.id)}/$value`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
          if (raw.ok) { const mime = await raw.text(); const cut = mime.search(/Content-Type:\s*message\/rfc822/i); message.reportText = (cut >= 0 ? mime.slice(0, cut) : mime).slice(0, 20000); }
        }
        if (!isNdr(message)) continue;
        let original: Message | undefined;
        let attachments: string | undefined = `${base}/${encodeURIComponent(message.id)}/attachments?$expand=microsoft.graph.itemAttachment/item`;
        while (attachments) {
          const result: { value?: { "@odata.type"?: string; item?: Message }[]; "@odata.nextLink"?: string } = await page(attachments);
          original ??= result.value?.find(a => a["@odata.type"] === "#microsoft.graph.itemAttachment" && a.item)?.item;
          attachments = result["@odata.nextLink"];
        }
        alerts.push(makeAlert(mailbox, message, original));
      }
      url = data["@odata.nextLink"];
    }
  }
  return alerts;
}
