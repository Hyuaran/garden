import { createHash } from "node:crypto";
import type { MailItem, MailAttachmentMetadata } from "../mail-payment-check/graph-mail";
import { classifyAttachment, excludedMail, isElectronicCompletion, isForwardedMail, ROOTS, type DocKind, MIN_ATTACHMENT_BYTES } from "./classify";

export type JudgedItem = {
  md5: string; kind: DocKind; rootFolderId: string; mail: MailItem; fileName: string;
  status: "saved" | "missing" | "previously-saved" | "autosaved" | "superseded" | "needs-download"; driveUrl?: string;
};
export type JudgeCounts = { candidateMails: number; attachments: number; saved: number; missing: number; previouslySaved: number; autosaved: number; superseded: number; needsDownload: number };
export type JudgeDeps = {
  attachments(mail: MailItem): Promise<MailAttachmentMetadata[]>;
  content(mail: MailItem, attachment: MailAttachmentMetadata): Promise<string>;
  index(root: string): Promise<Set<string>>;
  wasSaved(md5: string): Promise<boolean>;
  save?: (root: string, mail: MailItem, name: string, content: Buffer, mime: string) => Promise<{ id: string; url: string; fileName: string }>;
  record?: (item: JudgedItem, file: { id: string; url: string; fileName: string }) => Promise<void>;
};
export async function judgeMails(mails: MailItem[], deps: JudgeDeps, lastSuccessfulRunAt?: string) {
  const items: JudgedItem[] = [];
  const counts: JudgeCounts = { candidateMails: 0, attachments: 0, saved: 0, missing: 0, previouslySaved: 0, autosaved: 0, superseded: 0, needsDownload: 0 };
  const seen = new Set<string>();
  const indexes = new Map<string, Set<string>>();
  // 読み取りが全て成功してから保存する。読めないものを「未保存」と決め付けない。
  const candidates: Array<{ item: JudgedItem; attachment: MailAttachmentMetadata; content: Buffer }> = [];
  for (const mail of [...mails].sort((a, b) => Number(isForwardedMail(a)) - Number(isForwardedMail(b)))) {
    if (excludedMail(mail)) continue;
    const attachments = mail.hasAttachments ? await deps.attachments(mail) : [];
    if (isElectronicCompletion(mail) && !attachments.some(a => !a.isInline && /\.pdf$/i.test(a.name))) {
      if (!lastSuccessfulRunAt || Date.parse(mail.receivedAt) > Date.parse(lastSuccessfulRunAt)) {
        items.push({ md5: "", kind: "contract", rootFolderId: ROOTS.contract.id, mail, fileName: "", status: "needs-download" });
        counts.candidateMails++;
        counts.needsDownload++;
      }
      continue;
    }
    let candidate = false;
    for (const attachment of attachments) {
      const kind = classifyAttachment(mail, attachment);
      if (!kind) continue;
      const content = Buffer.from(await deps.content(mail, attachment), "base64");
      if (content.length < MIN_ATTACHMENT_BYTES) continue;
      candidate = true;
      const md5 = createHash("md5").update(content).digest("hex");
      if (seen.has(md5)) continue;
      seen.add(md5);
      counts.attachments++;
      const rootFolderId = ROOTS[kind].id;
      if (!indexes.has(rootFolderId)) indexes.set(rootFolderId, await deps.index(rootFolderId));
      const status = indexes.get(rootFolderId)!.has(md5) ? "saved" : await deps.wasSaved(md5) ? "previously-saved" : "missing";
      const item: JudgedItem = { md5, kind, rootFolderId, mail, fileName: attachment.name, status };
      candidates.push({ item, attachment, content });
    }
    if (candidate) counts.candidateMails++;
  }
  // 自動保存前の saved だけを照合元にする。
  const saved = candidates.filter(({ item }) => item.status === "saved").map(({ item }) => item);
  for (const { item } of candidates) {
    if (item.status === "missing" && saved.some(newer =>
      senderDomain(newer.mail.sender) === senderDomain(item.mail.sender) &&
      normalizedVersionName(newer.fileName) === normalizedVersionName(item.fileName) &&
      Date.parse(newer.mail.receivedAt) >= Date.parse(item.mail.receivedAt)
    )) item.status = "superseded";
  }
  for (const { item, attachment, content } of candidates) {
    if (item.status === "missing" && deps.save && deps.record) {
      const file = await deps.save(item.rootFolderId, item.mail, attachment.name, content, attachment.contentType);
      // アップロード直後に永続記録する。通知失敗後の再実行でも再保存しない。
      await deps.record(item, file);
      item.status = "autosaved"; item.driveUrl = file.url;
    }
    items.push(item);
    if (item.status === "previously-saved") {
      counts.previouslySaved++;

    }
    else if (item.status !== "needs-download") counts[item.status]++;
  }
  return { items, counts };
}

const senderDomain = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";
export function normalizedVersionName(name: string): string {
  return name.replace(/[Ａ-Ｚａ-ｚ０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .toLowerCase().replace(/[【\[（(\s_]*(?:再々送|再再送|再送)[】\]）)\s_]*/g, "");
}
