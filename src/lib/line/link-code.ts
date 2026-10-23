import { randomInt } from "node:crypto";
export const LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function createLinkCode() { return Array.from({ length: 4 }, () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]).join(""); }
export function parseOneTimeLink(text: string) {
  const match = text.normalize("NFKC").toUpperCase().replace(/\s/g, "").match(/^連携(\d{3,5})[-ー−]([A-Z0-9]{4})$/);
  return match ? { employeeNumber: match[1].padStart(4, "0"), code: match[2] } : null;
}
