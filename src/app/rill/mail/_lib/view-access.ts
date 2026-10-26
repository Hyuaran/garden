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
    return url.origin === "https://graph.microsoft.com"
      && decodeURIComponent(url.pathname).toLowerCase() === decodeURIComponent(new URL(base + path).pathname).toLowerCase();
  } catch { return false; }
}
