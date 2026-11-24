import type { RillMailBox } from "./types";
export type MailReadTabs = readonly string[];
/** Microsoft で確認済みの箱を絞るだけ。個人受信箱や共有箱を追加しない。 */
export function filterMailReadBoxes(boxes: RillMailBox[], tabs?: MailReadTabs) {
  return tabs ? boxes.filter(box => tabs.includes(box.id === "sent" ? "sent" : box.kind === "personal" ? "me" : "shared")) : boxes;
}

export function isMailPageForBox(page: string, path: string) {
  try {
    const base = "https://graph.microsoft.com/v1.0";
    const url = new URL(page.startsWith("/") ? base + page : page);
    // Microsoft returns nextLink as mailFolders('inbox') while we build mailFolders/inbox.
    const norm = (value: string) => decodeURIComponent(value).replace(/\('([^'()/]*)'\)/g, "/$1").toLowerCase();
    return url.origin === "https://graph.microsoft.com"
      && norm(url.pathname) === norm(new URL(base + path).pathname);
  } catch { return false; }
}
