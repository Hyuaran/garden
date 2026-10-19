// 副作用のない共通fixture。テストモジュールから分離する。
import type { MailItem, MailAttachment } from "../mail-payment-check/graph-mail";
export const mail: MailItem = { id: "m", internetMessageId: "im", mailboxes: ["keiri@hyuaran.com"], receivedAt: "2026-10-27T16:00:00Z", sender: "vendor@example.jp", senderName: "A/B", subject: "契約書送付", toRecipients: ["keiri@hyuaran.com"], hasAttachments: true };
export const attachment: MailAttachment = { id: "a", name: "契約書.pdf", size: 1024, contentType: "application/pdf", contentBytes: Buffer.alloc(1024, 1).toString("base64") };
