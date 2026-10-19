import { MAILBOX_DOMAINS } from "../mail-payment-check/classify";
import type { MailItem, MailAttachmentMetadata } from "../mail-payment-check/graph-mail";

export const CONTRACT_WORDS = ["契約書", "覚書", "合意書", "締結", "契約更新", "申込書兼契約書"];
export const TERMS_WORDS = ["条件表", "条件書", "インセンティブ", "単価表", "報酬表", "手数料表"];
export const EXCLUDE_WORDS = ["雇用契約", "誓約書", "入社", "退職"];
export const ELECTRONIC_SENDERS = [
  { domain: "moneyforward.com", name: "マネーフォワード クラウド契約" },
  // MF 決済（請求の知らせ）は電子契約ではないが、締結完了の言葉が無いので今までどおり除かれる
  { domain: "mfkessai.co.jp", name: "マネーフォワード ケッサイ" },
  { domain: "cloudsign.jp", name: "クラウドサイン" },
  { domain: "gmosign.com", name: "GMO サイン" },
  { domain: "docusign.net", name: "DocuSign" },
  { domain: "echosign.com", name: "Adobe Sign" },
  { domain: "adobesign.com", name: "Adobe Sign" },
  { domain: "ninja-sign.com", name: "freee サイン" },
  { domain: "freee.co.jp", name: "freee サイン", addressIncludes: "sign" },
];
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
  return !direction(mail) || contains(mail.subject, EXCLUDE_WORDS) ||
    Boolean(electronicService(mail) && !isElectronicCompletion(mail));
}
export function electronicService(mail: MailItem) {
  const d = domain(mail.sender);
  return ELECTRONIC_SENDERS.find(s => (d === s.domain || d.endsWith(`.${s.domain}`)) &&
    (!s.addressIncludes || mail.sender.toLowerCase().includes(s.addressIncludes)));
}
export function isElectronicCompletion(mail: MailItem): boolean {
  return Boolean(electronicService(mail)) && /署名完了|締結が完了|締結完了|合意締結|completed/i.test(mail.subject) &&
    !/依頼|確認|ご案内/.test(mail.subject);
}
export function classifyAttachment(mail: MailItem, attachment: MailAttachmentMetadata): DocKind | null {
  if (excludedMail(mail) || attachment.isInline || attachment.size < MIN_ATTACHMENT_BYTES ||
    !EXTENSIONS.includes(attachment.name.split(".").pop()?.toLowerCase() ?? "") || contains(attachment.name, EXCLUDE_WORDS)) return null;
  if (isElectronicCompletion(mail)) return /\.pdf$/i.test(attachment.name) ? "contract" : null;
  const text = isForwardedMail(mail) || contains(attachment.name, [...CONTRACT_WORDS, ...TERMS_WORDS]) ? attachment.name : mail.subject;
  // 契約書は PDF だけ（Word は締結前の下書き・ひな形のため。東海林さん 2026-10-19）
  if (contains(text, CONTRACT_WORDS) && /\.pdf$/i.test(attachment.name)) return "contract";
  if (contains(text, TERMS_WORDS)) return direction(mail) === "out" ? "terms-out" : "terms-in";
  return null;
}
