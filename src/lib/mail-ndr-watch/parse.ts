import sanitizeHtml from "sanitize-html";

export type Message = {
  id: string; subject?: string; receivedDateTime?: string; sentDateTime?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  sender?: { emailAddress?: { address?: string; name?: string } };
  /** Exchange の「配信不能」は本文が空で、中身はメールの元データ（MIME）の report 部分にある。graph.ts が入れる */
  reportText?: string;
  toRecipients?: { emailAddress?: { address?: string; name?: string } }[];
  body?: { content?: string }; hasAttachments?: boolean;
};
export type Alert = { message_id: string; mailbox: string; kind: string; original_subject: string; recipients: string; original_sent_at: string | null; received_at: string };
export function plainText(content = "") {
  return sanitizeHtml(content.replace(/<\/(?:div|p|tr)>|<br\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} });
}
export function classify(text: string): string {
  if (/SendAsDenied|ec\s*=\s*1244|代理として送信するアクセス権がありません|SOBO rights/i.test(text)) return "SendAsDenied（送信権限不足）";
  if (/RESOLVER\.ADR|550\s+5\.1\.1|存在しません|RecipientNotFound/i.test(text)) return "宛先不明";
  if (/550\s+5\.7\.520/i.test(text)) return "外部転送ブロック";
  if (/5\.2\.2|5\.3\.4|mailbox full|容量|サイズ/i.test(text)) return "容量・サイズ超過";
  return "その他";
}
// 2026-10-22 実物：差出人は名前もアドレスも「システム管理者」、件名は「配信不能: 元の件名」、本文は空
export function isNdrCandidate(message: Message): boolean {
  const sender = message.from?.emailAddress;
  return /^(postmaster@|MicrosoftExchange)/i.test(sender?.address ?? "")
    || /^(Microsoft Outlook|System Administrator|Mail Delivery Subsystem|システム管理者)$/i.test(sender?.name ?? "")
    || /^システム管理者$/.test(sender?.address ?? "")
    || /^(?:配信できませんでした|Undeliverable|Delivery has failed|宛先不明|Delivery Status Notification|配信不能)/i.test((message.subject ?? "").trim());
}
export const reportedText = (message: Message) => [plainText(message.body?.content), message.reportText ?? ""].join("\n");
export function isNdr(message: Message): boolean {
  const text = reportedText(message);
  const diagnostic = /Delivery has failed|Action:\s*failed|Status:\s*5\.|Diagnostic information|診断情報|応答の例外|#550|RESOLVER|SendAsDenied|\b5\.\d{1,3}\.\d{1,3}\b|ec\s*=\s*1244|代理として送信するアクセス権がありません|SOBO rights/i.test(text);
  const sender = message.from?.emailAddress;
  const candidate = isNdrCandidate(message);
  return candidate && diagnostic;
}
function validDate(value?: string): string | null {
  if (!value) return null;
  // タイムゾーンのない日本語メールの日時は日本時間として扱う。
  const normalized = value.trim().replace(/年|月|\//g, "-").replace(/日/g, "");
  const date = new Date(/^\d{4}-\d{1,2}-\d{1,2}[ T]\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized) ? normalized.replace(" ", "T") + "+09:00" : normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
// Exchange の「配信不能」（Status 5.4.0・SendAsDenied の文字は無い）では、元のメールの差出人（From）が実際に送った箱（Sender）と違う＝代理送信の権限不足と見なす
// （2026-10-22 実物 10 通：送った箱は keiri@hyuaran1.onmicrosoft.com、差出人は cs@hyuaran.com／keiri@hyuaran.com／keiri@centerrise.co.jp／kanri_honbu@centerrise.co.jp。keiri@hyuaran.com も別の箱）
export function inferKind(text: string, mailbox: string, original?: Message) {
  const kind = classify(text);
  const from = original?.from?.emailAddress?.address?.toLowerCase();
  const sentBy = (original?.sender?.emailAddress?.address ?? mailbox).toLowerCase();
  if (kind === "その他" && from && from !== sentBy) return `SendAsDenied（送信権限不足・差出人 ${from}）`;
  return kind;
}
export function makeAlert(mailbox: string, message: Message, original?: Message): Alert {
  const text = reportedText(message);
  const toLine = text.match(/^(?:To|宛先|受信者)\s*[:：]\s*(.+)$/im)?.[1];
  const recipients = original?.toRecipients?.map(r => r.emailAddress?.name || r.emailAddress?.address || "").filter(Boolean) ?? [];
  if (!recipients.length && toLine) recipients.push(...toLine.split(/[;,；、]/).map(s => s.trim()).filter(Boolean));
  // 届かなかった宛先は配信状況（delivery-status）の X-Display-Name／Final-recipient からも拾う
  if (!recipients.length) recipients.push(...[...text.matchAll(/^Final-recipient:\s*RFC822;\s*(\S+)/gim)].map(m => m[1]));
  return {
    message_id: message.id, mailbox, kind: inferKind(text, mailbox, original),
    original_subject: original?.subject || (message.subject ?? "").replace(/^(?:(?:配信できませんでした|Undeliverable|Delivery has failed|宛先不明|Delivery Status Notification|配信不能)\s*[:：]\s*)+/i, "") || "記録なし",
    recipients: recipients.length ? recipients[0] + (recipients.length > 1 ? ` 他${recipients.length - 1}件` : "") : "記録なし",
    original_sent_at: validDate(original?.sentDateTime) ?? validDate(text.match(/^(?:送信日時|Sent)\s*[:：]\s*(.+)$/im)?.[1]),
    received_at: message.receivedDateTime!,
  };
}
export function japanTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "記録なし";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}
export function formatAlert(a: Alert) {
  const safe = (s: string) => s.replace(/\[/g, "［").replace(/\]/g, "］").replace(/[\r\n]+/g, " ");
  return `[info][title]メール送信失敗を検知[/title]\n種別：${safe(a.kind)}\n差出人アカウント：${safe(a.mailbox)}\n元件名：${safe(a.original_subject)}\n送信日時：${japanTime(a.original_sent_at)}\n宛先：${safe(a.recipients)}\n配信不能の通知の受信：${japanTime(a.received_at)}\n→ 相手に届いていません。再送が必要です。[/info]`;
}
