import { MAILBOX_DOMAINS } from "../mail-payment-check/classify";
import type { MailItem, MailAttachmentMetadata } from "../mail-payment-check/graph-mail";

export const CONTRACT_WORDS = ["契約書", "覚書", "合意書", "締結", "契約更新", "申込書兼契約書"];
export const TERMS_WORDS = ["条件表", "条件書", "インセンティブ", "単価表", "報酬表", "手数料表"];
export const EXCLUDE_WORDS = ["雇用契約", "誓約書", "入社", "退職"];
export const ELECTRONIC_SENDERS = ["cloudsign.jp", "moneyforward.com", "mfkessai.co.jp", "contract.moneyforward.com"];
export const EXTENSIONS = ["pdf", "xlsx", "xls", "docx", "doc"];
// 正本に数値の指定がないため初版は 1 KiB 未満を除外する。
export const MIN_ATTACHMENT_BYTES = 1024;
export type DocKind = "contract" | "terms-in" | "terms-out";
export const ROOTS: Record<DocKind, { id: string; label: string }> = {
  contract: { id: "1qMXezqvcjTBcnIE-cBUxuhtPpTSIXccG", label: "契約書（13_契約書）" },
  "terms-in": { id: "1HTksA-90dq3JxVAcEdJl3IpLYlBZhFOn", label: "条件表・上位店から（02_条件表　上位店）" },
  "terms-out": { id: "1-bu9HacEwLGhnVvVR9qYakN7SdHEQdnn", label: "条件表・傘下店へ（03_条件表　パートナー）" },
};
const contains = (text: string, words: string[]) => words.some(word => text.includes(word));
const domain = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";
export const isOwn = (email: string) => [...MAILBOX_DOMAINS, "garden-os.net"].some(d => domain(email) === d);
export function isForwardedMail(mail: MailItem): boolean {
  return isOwn(mail.sender) && /^(?:\s*re\s*[:：]\s*)*\s*(?:fw|fwd|転送)\s*[:：]/i.test(mail.subject);
}
export function direction(mail: MailItem): "in" | "out" | null {
  if (!isOwn(mail.sender) || isForwardedMail(mail)) return "in";
  return mail.toRecipients?.some(address => !isOwn(address)) ? "out" : null;
}
export function excludedMail(mail: MailItem): boolean {
  const d = domain(mail.sender);
  return !direction(mail) || contains(mail.subject, EXCLUDE_WORDS) ||
    ELECTRONIC_SENDERS.some(sender => d === sender || d.endsWith(`.${sender}`));
}
export function classifyAttachment(mail: MailItem, attachment: MailAttachmentMetadata): DocKind | null {
  if (excludedMail(mail) || attachment.isInline || attachment.size < MIN_ATTACHMENT_BYTES ||
    !EXTENSIONS.includes(attachment.name.split(".").pop()?.toLowerCase() ?? "") || contains(attachment.name, EXCLUDE_WORDS)) return null;
  const text = isForwardedMail(mail) || contains(attachment.name, [...CONTRACT_WORDS, ...TERMS_WORDS]) ? attachment.name : mail.subject;
  if (contains(text, CONTRACT_WORDS)) return "contract";
  if (contains(text, TERMS_WORDS)) return direction(mail) === "out" ? "terms-out" : "terms-in";
  return null;
}
