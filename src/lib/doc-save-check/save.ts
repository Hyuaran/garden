import { findOrCreateSubfolder, uploadToFolder } from "@/app/api/bud/expense-drive/_lib/drive";
import type { MailItem } from "../mail-payment-check/graph-mail";

export function safeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/[. ]+$/g, "_");
}
export function savedFilename(mail: MailItem, original: string): string {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(mail.receivedAt)).replace(/-/g, "");
  return safeFilename(`${date}_${mail.senderName || mail.sender}_${original}`);
}
export function createSaver() {
  const folders = new Map<string, string>();
  return async (root: string, mail: MailItem, name: string, content: Buffer, mime: string) => {
    let folder = folders.get(root);
    if (!folder) {
      folder = await findOrCreateSubfolder(root, "00_自動保存（未整理）");
      folders.set(root, folder);
    }
    const fileName = savedFilename(mail, name);
    const result = await uploadToFolder(folder, fileName, content, mime);
    return { id: result.id, url: result.webViewLink ?? `https://drive.google.com/file/d/${result.id}/view`, fileName };
  };
}
